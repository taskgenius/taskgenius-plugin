import {
	App,
	Component,
	Menu,
	Modal,
	Notice,
	Setting,
	setIcon,
} from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitDefinition } from "../types";
import { t } from "../i18n";
import {
	isActive,
	isComplete,
	isFailedOn,
	isPausedOn,
	isSkippedOn,
} from "../stats";
import { fromDateKey, toDateKey } from "../utils";
import { applyHabitIcon } from "./icon-suggest-modal";

/**
 * How a habit was taken off a day's lists (issue #27):
 * - `failed`: "Fail for today" — the day counts as a miss.
 * - `skipped`: "Skip for today" — the day counts as a one-day pause.
 * - `snoozed`: hidden until a chosen time today, with no effect on stats.
 */
export type DayStatus = "failed" | "skipped" | "snoozed";

/** The habit's status on `dateKey`, or null when it's still on the list. */
export function dayStatus(
	habit: HabitDefinition,
	dateKey: string,
	store: HabitStore,
	now = new Date(),
): DayStatus | null {
	if (isFailedOn(habit, dateKey)) {
		return "failed";
	}
	if (isSkippedOn(habit, dateKey)) {
		return "skipped";
	}
	// A snooze is about the here and now, so it only hides today's card;
	// browsing another day shows the habit as normal.
	if (
		dateKey === toDateKey(now) &&
		store.snoozedUntil(habit, now.getTime()) !== null
	) {
		return "snoozed";
	}
	return null;
}

function formatTime(until: number): string {
	return new Date(until).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

/** Short label for a closed habit, e.g. "Snoozed until 3:30 PM". */
export function dayStatusLabel(
	habit: HabitDefinition,
	status: DayStatus,
	store: HabitStore,
): string {
	if (status === "failed") {
		return t("Failed");
	}
	if (status === "skipped") {
		return t("Skipped");
	}
	const until = store.snoozedUntil(habit);
	return until === null
		? t("Snoozed")
		: t("Snoozed until {time}", { time: formatTime(until) });
}

export const DAY_STATUS_ICON: Record<DayStatus, string> = {
	failed: "x",
	skipped: "skip-forward",
	snoozed: "alarm-clock",
};

/** Put a habit back on the day's list. */
export async function reopenDay(
	habit: HabitDefinition,
	dateKey: string,
	status: DayStatus,
	store: HabitStore,
): Promise<void> {
	if (status === "snoozed") {
		await store.clearSnooze(habit);
	} else {
		await store.setDayStatus(habit, dateKey, null);
	}
}

/**
 * Add the day actions to a habit's right-click / long-press menu: Fail and
 * Skip for the given day, plus Snooze when that day is today. A habit
 * already taken off the day gets a single "undo" item instead. Nothing is
 * added for a day the habit isn't due on or is paused for. Ends with a
 * separator when it added anything, so it belongs at the top of the menu.
 */
export function addDayStatusItems(
	menu: Menu,
	app: App,
	store: HabitStore,
	habit: HabitDefinition,
	dateKey: string,
	onChange: () => void,
): void {
	const date = fromDateKey(dateKey);
	if (!date || !isActive(habit, date)) {
		return;
	}
	const today = dateKey === toDateKey(new Date());
	const status = dayStatus(habit, dateKey, store);
	if (status) {
		const title =
			status === "failed"
				? t("Undo fail")
				: status === "skipped"
					? t("Undo skip")
					: t("End snooze");
		menu.addItem((item) =>
			item
				.setTitle(title)
				.setIcon("undo-2")
				.onClick(async () => {
					await reopenDay(habit, dateKey, status, store);
					onChange();
				}),
		);
		menu.addSeparator();
		return;
	}
	if (isPausedOn(habit, dateKey)) {
		return;
	}

	// Failing a habit you've already reached the target for would throw
	// the completion away; limit habits are "complete" until they slip,
	// so they can always be failed.
	if (habit.goalDirection === "max" || !isComplete(habit, dateKey)) {
		menu.addItem((item) =>
			item
				.setTitle(today ? t("Fail for today") : t("Fail this day"))
				.setIcon(DAY_STATUS_ICON.failed)
				.onClick(async () => {
					await store.setDayStatus(habit, dateKey, "failed");
					new Notice(t('Marked "{name}" as failed.', { name: habit.name }));
					onChange();
				}),
		);
	}
	menu.addItem((item) =>
		item
			.setTitle(today ? t("Skip for today") : t("Skip this day"))
			.setIcon(DAY_STATUS_ICON.skipped)
			.onClick(async () => {
				await store.setDayStatus(habit, dateKey, "skipped");
				new Notice(t('Skipped "{name}".', { name: habit.name }));
				onChange();
			}),
	);
	if (today) {
		menu.addItem((item) =>
			item
				.setTitle(t("Snooze…"))
				.setIcon(DAY_STATUS_ICON.snoozed)
				.onClick(() => {
					new SnoozeModal(app, store, habit, onChange).open();
				}),
		);
	}
	menu.addSeparator();
}

/**
 * Picks how long to snooze a habit: quick presets, or a time later today.
 */
export class SnoozeModal extends Modal {
	constructor(
		app: App,
		private store: HabitStore,
		private habit: HabitDefinition,
		private onChange: () => void,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl)
			.setName(t('Snooze "{name}"', { name: this.habit.name }))
			.setHeading();
		contentEl.createEl("p", {
			cls: "setting-item-description",
			text: t(
				"It leaves today's lists and comes back on its own. Snoozing never counts for or against the habit.",
			),
		});

		const presets = new Setting(contentEl).setName(t("Snooze for"));
		for (const [minutes, label] of [
			[30, t("30 minutes")],
			[60, t("1 hour")],
			[180, t("3 hours")],
		] as const) {
			presets.addButton((button) =>
				button.setButtonText(label).onClick(() => {
					void this.snooze(Date.now() + minutes * 60_000);
				}),
			);
		}

		// Default the picker to two hours from now, on a quarter hour.
		const suggested = new Date(Date.now() + 2 * 3_600_000);
		suggested.setMinutes(Math.ceil(suggested.getMinutes() / 15) * 15, 0, 0);
		let time = `${String(suggested.getHours()).padStart(2, "0")}:${String(
			suggested.getMinutes(),
		).padStart(2, "0")}`;
		new Setting(contentEl)
			.setName(t("Snooze until"))
			.addText((text) => {
				text.inputEl.type = "time";
				text.setValue(time).onChange((value) => {
					time = value;
				});
			})
			.addButton((button) =>
				button
					.setButtonText(t("Snooze"))
					.setCta()
					.onClick(() => {
						const match = /^(\d{1,2}):(\d{2})$/.exec(time);
						if (!match) {
							return;
						}
						const until = new Date();
						until.setHours(Number(match[1]), Number(match[2]), 0, 0);
						if (until.getTime() <= Date.now()) {
							new Notice(t("Pick a time later today."));
							return;
						}
						void this.snooze(until.getTime());
					}),
			);
	}

	private async snooze(until: number): Promise<void> {
		this.close();
		await this.store.snoozeHabit(this.habit, until);
		new Notice(
			t('Snoozed "{name}" until {time}.', {
				name: this.habit.name,
				time: formatTime(until),
			}),
		);
		this.onChange();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** A habit taken off the day's list, with how. */
export interface ClosedHabit {
	habit: HabitDefinition;
	status: DayStatus;
}

/**
 * The "N hidden for today" disclosure under a list of habits: collapsed
 * by default, expanding to one row per hidden habit with its status and
 * an Undo button that puts it back on the list.
 */
export function renderClosedHabits(
	container: HTMLElement,
	component: Component,
	store: HabitStore,
	closed: ClosedHabit[],
	dateKey: string,
	open: boolean,
	onToggle: (open: boolean) => void,
	/** Called after an Undo, with the habit put back on the list. */
	onChange: (habit: HabitDefinition) => void,
): void {
	if (closed.length === 0) {
		return;
	}
	const today = dateKey === toDateKey(new Date());
	const wrap = container.createDiv({ cls: "habits-closed" });
	const toggle = wrap.createEl("button", {
		cls: "habits-closed-toggle",
		attr: { type: "button", "aria-expanded": String(open) },
	});
	setIcon(toggle.createSpan({ cls: "habits-closed-chevron" }), open ? "chevron-down" : "chevron-right");
	toggle.createSpan({
		text: today
			? closed.length === 1
				? t("1 hidden for today")
				: t("{count} hidden for today", { count: closed.length })
			: closed.length === 1
				? t("1 hidden for this day")
				: t("{count} hidden for this day", { count: closed.length }),
	});
	component.registerDomEvent(toggle, "click", () => onToggle(!open));
	if (!open) {
		return;
	}

	const list = wrap.createDiv({ cls: "habits-closed-list" });
	for (const { habit, status } of closed) {
		const row = list.createDiv({ cls: `habits-closed-row is-${status}` });
		const icon = row.createSpan({ cls: "habits-closed-icon" });
		if (habit.icon) {
			applyHabitIcon(icon, habit.icon);
		}
		row.createSpan({ cls: "habits-closed-name", text: habit.name });
		const chip = row.createSpan({ cls: "habits-closed-status" });
		setIcon(chip.createSpan({ cls: "habits-closed-status-icon" }), DAY_STATUS_ICON[status]);
		chip.createSpan({ text: dayStatusLabel(habit, status, store) });
		const undo = row.createEl("button", {
			cls: "habits-closed-undo",
			text: t("Undo"),
			attr: { type: "button" },
		});
		component.registerDomEvent(undo, "click", async () => {
			undo.disabled = true;
			await reopenDay(habit, dateKey, status, store);
			onChange(habit);
		});
	}
}

/**
 * Re-render once the earliest active snooze among `habits` ends, so a
 * snoozed habit comes back on its own. Returns a cancel function; call it
 * before scheduling again (on every render) and when the view unloads.
 */
export function scheduleSnoozeRefresh(
	win: Window,
	store: HabitStore,
	habits: HabitDefinition[],
	refresh: () => void,
): () => void {
	const now = Date.now();
	let next: number | null = null;
	for (const habit of habits) {
		const until = store.snoozedUntil(habit, now);
		if (until !== null && (next === null || until < next)) {
			next = until;
		}
	}
	if (next === null) {
		return () => {};
	}
	// A beat after the snooze ends, so the check sees it as over.
	const id = win.setTimeout(refresh, next - now + 500);
	return () => win.clearTimeout(id);
}
