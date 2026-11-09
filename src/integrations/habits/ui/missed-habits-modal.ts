import { installHabitClose } from "./modal-close";
import {
	App,
	ButtonComponent,
	Modal,
	Notice,
	Setting,
	setIcon,
	setTooltip,
} from "obsidian";
import { t } from "../i18n";
import type { HabitStore } from "../habit-store";
import type { HabitDefinition } from "../types";
import {
	isRescheduleTargetOpen,
	isRescheduleEligible,
	missedInstances,
	trackingStartKey,
	type MissedInstance,
} from "../stats";
import { addDays, fromDateKey, friendlyDateLabel, toDateKey } from "../utils";
import { applyHabitIcon } from "./icon-suggest-modal";

/** How far past/future the date picker's own min/max reach, as a soft guardrail. */
const PICKER_WINDOW_DAYS = 180;

/**
 * Review missed habits and move one onto a different day (experimental).
 * The list re-scans on every return to it, so working through several
 * misses in one sitting updates live instead of going stale after the
 * first reschedule.
 */
export class MissedHabitsModal extends Modal {
	private removeCloseControl = () => {};
	constructor(
		app: App,
		private store: HabitStore,
		private habits: HabitDefinition[],
		private onChanged: () => void,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
	}

	onOpen(): void {
		this.modalEl.addClass("habits-modal");
		this.removeCloseControl(); this.removeCloseControl = installHabitClose(this);
		this.renderList();
	}

	onClose(): void {
		this.removeCloseControl();
		this.contentEl.empty();
	}

	private renderList(): void {
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl).setName(t("Missed habits")).setHeading();

		const today = new Date();
		const missed = missedInstances(this.habits, today);

		if (missed.length === 0) {
			contentEl.createEl("p", {
				cls: "habits-missed-empty",
				text: t("Nothing missed right now."),
			});
			return;
		}

		contentEl.createEl("p", {
			cls: "habits-missed-intro",
			text: t("Pick a habit to move it onto a different day."),
		});

		const list = contentEl.createDiv({ cls: "habits-missed-list" });
		for (const instance of missed) {
			this.renderCard(list, instance, today);
		}
	}

	private renderCard(
		list: HTMLElement,
		instance: MissedInstance,
		today: Date,
	): void {
		const { habit, dateKey } = instance;
		const date = fromDateKey(dateKey);
		const card = list.createDiv({ cls: "habits-missed-card" });
		card.setCssProps({
			"--habits-accent": habit.color || "var(--interactive-accent)",
		});

		const icon = card.createDiv({ cls: "habits-missed-icon" });
		if (habit.icon) {
			applyHabitIcon(icon, habit.icon);
		} else {
			setIcon(icon, "circle");
		}

		const info = card.createDiv({ cls: "habits-missed-info" });
		info.createDiv({ cls: "habits-missed-name", text: habit.name });
		info.createDiv({
			cls: "habits-missed-date",
			text: date ? friendlyDateLabel(date, today) : dateKey,
		});

		const button = card.createEl("button", {
			cls: "habits-icon-button habits-missed-reschedule",
			attr: { type: "button" },
			text: t("Reschedule"),
		});
		button.disabled = !isRescheduleEligible(habit);
		setTooltip(button, button.disabled ? t("This habit is already due every day. Ignore this miss or record it on its original day.") : t("Move this missed day onto a different one"));
		button.addEventListener("click", () => this.renderPicker(instance));
		const ignore = card.createEl("button", { text: t("Ignore"), attr: { type: "button" } });
		ignore.addEventListener("click", async () => {
			ignore.disabled = true;
			try { await this.store.ignoreMissedDay(habit, dateKey); this.habits = this.habits.map(item => item.path === habit.path ? { ...item, ignoredMisses: [...(item.ignoredMisses || []), dateKey] } : item); this.onChanged(); this.renderList(); }
			catch (error) { new Notice(String(error)); ignore.disabled = false; }
		});
	}

	private renderPicker(instance: MissedInstance): void {
		const { habit, dateKey } = instance;
		const { contentEl } = this;
		contentEl.empty();
		new Setting(contentEl).setName(t("Missed habits")).setHeading();

		const today = new Date();
		const missedDate = fromDateKey(dateKey);
		contentEl.createEl("p", {
			cls: "habits-missed-intro",
			text: t('Rescheduling "{name}" — missed {date}.', {
				name: habit.name,
				date: missedDate ? friendlyDateLabel(missedDate, today) : dateKey,
			}),
		});

		// A reschedule target before the habit started couldn't have been
		// due there anyway; keep the picker from offering it.
		const windowStart = toDateKey(addDays(today, -PICKER_WINDOW_DAYS));
		const min =
			windowStart > trackingStartKey(habit, today)
				? windowStart
				: trackingStartKey(habit, today);
		const max = toDateKey(addDays(today, PICKER_WINDOW_DAYS));

		let chosen = "";
		let confirmButton: ButtonComponent | null = null;
		const errorEl = contentEl.createDiv({ cls: "habits-missed-error" });

		const validate = (): void => {
			if (!chosen) {
				return;
			}
			const open = isRescheduleTargetOpen(habit, chosen);
			errorEl.setText(
				open
					? ""
					: t(
							"That day won't work — it's either already due for this habit or already claimed by another reschedule.",
						),
			);
			confirmButton?.setDisabled(!open);
		};

		new Setting(contentEl).setName(t("Move to")).addText((text) => {
			text.inputEl.type = "date";
			text.inputEl.min = min;
			text.inputEl.max = max;
			text.onChange((value) => {
				chosen = value;
				validate();
			});
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText(t("Back")).onClick(() => this.renderList()),
			)
			.addButton((button) => {
				confirmButton = button;
				button
					.setButtonText(t("Confirm"))
					.setCta()
					.setDisabled(true)
					.onClick(() => void this.confirm(habit, dateKey, chosen));
			});
	}

	private async confirm(
		habit: HabitDefinition,
		from: string,
		to: string,
	): Promise<void> {
		if (!isRescheduleTargetOpen(habit, to)) {
			new Notice(t("That day no longer works — pick another."));
			return;
		}
		try { await this.store.rescheduleHabit(habit, from, to); }
		catch (error) { new Notice(String(error)); return; }
		this.habits = this.habits.map(item => item.path === habit.path ? { ...item, reschedules: [...item.reschedules.filter(entry => entry.from !== from), { from, to }] } : item);
		this.onChanged();
		this.renderList();
	}
}
