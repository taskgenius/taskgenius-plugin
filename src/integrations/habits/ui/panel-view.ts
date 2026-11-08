import {
	debounce,
	Events,
	ItemView,
	Menu,
	normalizePath,
	setIcon,
	setTooltip,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { HabitDefinition } from "../types";
import {
	flexiblePeriodTotal,
	isActive,
	isComplete,
	isFlexible,
	isPausedOn,
	limitOf,
	missedInstances,
	rescheduleSource,
} from "../stats";
import { createNoteHabitEntry, notePathForDate } from "../note-habit";
import {
	allowsDecimals,
	cleanValue,
	formatTimeOfDay,
	formatValue,
	friendlyDateLabel,
	fromDateKey,
	groupHabits,
	habitAccent,
	registerLongPress,
	sectionLabel,
	roundValue,
	sortHabits,
	stepOf,
	toDateKey,
	type HabitSection,
} from "../utils";
import { t } from "../i18n";
import { HabitModal } from "./habit-modal";
import { MissedHabitsModal } from "./missed-habits-modal";
import {
	addDayStatusItems,
	dayStatus,
	renderClosedHabits,
	scheduleSnoozeRefresh,
	type ClosedHabit,
} from "./day-status";
import { ConfirmModal } from "./confirm-modal";
import { applyHabitIcon } from "./icon-suggest-modal";

export const HABITS_PANEL_VIEW_TYPE = "tg-habits-panel";

/**
 * Compact sidebar view for logging today's habits on the fly.
 *
 * Designed for narrow widths: one slim row per habit with the smallest
 * possible controls, a today summary in the header, and the same
 * incomplete → completed → paused ordering as the dashboard.
 */
export class HabitsPanelView extends ItemView {
	private habits: HabitDefinition[] = [];
	/** Suppresses event-driven reloads while a row celebration plays. */
	private suppressAutoReload = false;
	/** Whether the "hidden for today" list under the rows is expanded. */
	private closedOpen = false;
	/** Cancels the pending refresh for when a snooze ends. */
	private cancelSnoozeRefresh: () => void = () => {};

	constructor(
		leaf: WorkspaceLeaf,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
		private pluginEvents: Events,
	) {
		super(leaf);
	}

	getViewType(): string {
		return HABITS_PANEL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("Habits");
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("tg-habits-panel");

		const requestReload = debounce(() => this.autoReload(), 250, true);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.isHabitFile(file.path)) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (this.isHabitFile(file.path)) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.isHabitFile(file.path)) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (
					this.isHabitFile(file.path) ||
					this.isHabitFile(oldPath)
				) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.pluginEvents.on("settings-changed", () => {
				requestReload();
			}),
		);
		this.registerEvent(
			this.pluginEvents.on("comments-changed", () => {
				requestReload();
			}),
		);

		this.reload();
	}

	async onClose(): Promise<void> {
		this.cancelSnoozeRefresh();
		this.contentEl.empty();
	}

	/** True when the path lives inside the configured habits folder. */
	private isHabitFile(path: string): boolean {
		const folder = normalizePath(this.getSettings().habitsFolder);
		return path === folder || path.startsWith(`${folder}/`);
	}

	private autoReload(): void {
		if (this.suppressAutoReload) {
			return;
		}
		const active = this.contentEl.doc.activeElement;
		if (
			active instanceof HTMLInputElement &&
			this.contentEl.contains(active)
		) {
			return;
		}
		this.reload();
	}

	private reload(): void {
		const settings = this.getSettings();
		this.habits = sortHabits(
			this.store.getHabits().filter((habit) => !habit.stopped),
			settings.sortMode,
			settings.manualOrder,
			settings.groups,
			settings.groupOrder,
		);
		this.render();
	}

	private todayKey(): string {
		return toDateKey(new Date());
	}

	private valueOf(habit: HabitDefinition): number {
		return habit.records[this.todayKey()] ?? 0;
	}

	private isDone(habit: HabitDefinition): boolean {
		return isComplete(habit, this.todayKey());
	}

	private isPausedToday(habit: HabitDefinition): boolean {
		return isPausedOn(habit, this.todayKey());
	}

	/**
	 * Whether the habit should show/be interactive today — its normal due
	 * date, or every day for a flexible habit (see {@link isActive}).
	 */
	private isActiveToday(habit: HabitDefinition): boolean {
		return isActive(habit, new Date());
	}

	/**
	 * Incomplete first, completed next, paused parked at the end. Weekly and
	 * monthly habits are included only on the days they are due.
	 */
	private ordered(): HabitDefinition[] {
		const flat: HabitDefinition[] = [];
		for (const section of this.sections()) {
			flat.push(...section.habits);
		}
		return flat;
	}

	/**
	 * Whether the panel partitions into group sections; mirrors the
	 * dashboard — sections only while sorting by group, so other sort
	 * orders (manual especially) are honoured exactly.
	 */
	private sectioned(): boolean {
		const settings = this.getSettings();
		return settings.groupsEnabled && settings.sortMode === "group";
	}

	/** Whether the habit was failed, skipped or snoozed for today. */
	private isClosedToday(habit: HabitDefinition): boolean {
		return dayStatus(habit, this.todayKey(), this.store) !== null;
	}

	/** Habits due today but taken off the list, in order. */
	private closedHabits(): ClosedHabit[] {
		const closed: ClosedHabit[] = [];
		for (const habit of this.habits) {
			const status = this.isActiveToday(habit)
				? dayStatus(habit, this.todayKey(), this.store)
				: null;
			if (status) {
				closed.push({ habit, status });
			}
		}
		return closed;
	}

	/** Sections mirroring the dashboard's grouping behaviour. */
	private sections(): HabitSection[] {
		const due = this.habits.filter(
			(habit) => this.isActiveToday(habit) && !this.isClosedToday(habit),
		);
		return groupHabits(
			due,
			this.sectioned(),
			this.getSettings().groupOrder,
		)
			.map((section) => ({
				key: section.key,
				habits: this.applyStatusOrder(section.habits),
			}))
			.filter((section) => section.habits.length > 0);
	}

	/** Status partition applied to an already-sorted run of due habits. */
	private applyStatusOrder(due: HabitDefinition[]): HabitDefinition[] {
		// With status ordering off, every row keeps its sorted position.
		if (!this.getSettings().statusOrdering) {
			return due;
		}
		const active = due.filter((habit) => !this.isPausedToday(habit));
		return [
			...active.filter((habit) => !this.isDone(habit)),
			...active.filter((habit) => this.isDone(habit)),
			...due.filter((habit) => this.isPausedToday(habit)),
		];
	}

	private render(): void {
		const root = this.contentEl;
		root.empty();

		const header = root.createDiv({ cls: "habits-panel-header" });
		const title = header.createDiv({ cls: "habits-panel-title" });
		title.createSpan({ text: t("Today") });
		title.createSpan({
			cls: "habits-panel-date",
			text: new Date().toLocaleDateString(undefined, {
				weekday: "short",
				day: "numeric",
				month: "short",
			}),
		});

		const trackable = this.habits.filter(
			(habit) =>
				this.isActiveToday(habit) && !this.isPausedToday(habit),
		);
		const doneCount = trackable.filter((habit) =>
			this.isDone(habit),
		).length;
		if (trackable.length > 0) {
			const count = header.createDiv({ cls: "habits-panel-count" });
			count.setText(`${doneCount}/${trackable.length}`);
			count.toggleClass("is-all-done", doneCount === trackable.length);
			setTooltip(count, t("Habits completed today"));
		}

		if (this.getSettings().experimental.rescheduling) {
			const missedCount = missedInstances(this.habits, new Date()).length;
			if (missedCount > 0) {
				const missed = header.createEl("button", {
					cls: "habits-icon-button habits-panel-missed",
					attr: { type: "button", "aria-label": t("Missed habits") },
				});
				setIcon(missed, "bell");
				const badge = missed.createSpan({ cls: "habits-missed-badge" });
				badge.setText(String(missedCount));
				setTooltip(
					missed,
					missedCount === 1
						? t("1 missed habit")
						: t("{count} missed habits", { count: missedCount }),
				);
				this.registerDomEvent(missed, "click", () => {
					new MissedHabitsModal(this.app, this.store, this.habits, () =>
						this.reload(),
					).open();
				});
			}
		}

		const add = header.createEl("button", {
			cls: "habits-icon-button habits-panel-add",
			attr: { type: "button", "aria-label": t("Add habit") },
		});
		setIcon(add, "plus");
		this.registerDomEvent(add, "click", () => {
			new HabitModal(
				this.app,
				this.store,
				() => this.reload(),
				null,
				this.getSettings().experimental.noteHabits,
			).open();
		});

		if (this.habits.length === 0) {
			const empty = root.createDiv({ cls: "habits-panel-empty" });
			empty.createEl("p", { text: t("No habits yet.") });
			const button = empty.createEl("button", {
				cls: "mod-cta",
				text: t("Create habit"),
				attr: { type: "button" },
			});
			this.registerDomEvent(button, "click", () => {
				new HabitModal(
					this.app,
					this.store,
					() => this.reload(),
					null,
					this.getSettings().experimental.noteHabits,
				).open();
			});
			return;
		}

		this.cancelSnoozeRefresh();
		this.cancelSnoozeRefresh = scheduleSnoozeRefresh(
			root.win,
			this.store,
			this.habits,
			() => this.reload(),
		);
		const closed = this.closedHabits();
		const showClosed = (): void =>
			renderClosedHabits(
				root,
				this,
				this.store,
				closed,
				this.todayKey(),
				this.closedOpen,
				(open) => {
					this.closedOpen = open;
					this.render();
				},
				() => this.render(),
			);

		const due = this.ordered();
		if (due.length === 0) {
			const none = root.createDiv({ cls: "habits-panel-empty" });
			none.createEl("p", {
				text:
					closed.length > 0
						? t("Nothing left on today's list.")
						: t("Nothing due today."),
			});
			showClosed();
			return;
		}

		const list = root.createDiv({ cls: "habits-panel-list" });
		const settings = this.getSettings();
		for (const section of this.sections()) {
			if (this.sectioned()) {
				const header = list.createDiv({
					cls: "habits-panel-group",
				});
				const style = settings.groups[section.key];
				if (style?.icon) {
					const icon = header.createSpan({
						cls: "habits-group-icon",
					});
					applyHabitIcon(icon, style.icon);
					if (style.color) {
						icon.setCssProps({
							"--habits-accent": style.color,
						});
					}
				} else if (style?.color) {
					const swatch = header.createSpan({
						cls: "habits-group-swatch",
					});
					swatch.setCssProps({
						"--habits-accent": style.color,
					});
				}
				header.createSpan({
					text: sectionLabel(section.key),
				});
			}
			for (const habit of section.habits) {
				this.renderRow(list, habit);
			}
		}
		showClosed();
	}

	private renderRow(list: HTMLElement, habit: HabitDefinition): void {
		const row = list.createDiv({ cls: "habits-panel-row" });
		const accent = habitAccent(habit, this.getSettings().groups);
		if (accent) {
			row.setCssProps({ "--habits-accent": accent });
		}
		this.registerDomEvent(row, "contextmenu", (evt: MouseEvent) => {
			evt.preventDefault();
			this.showRowMenu(habit, evt.clientX, evt.clientY);
		});
		registerLongPress(this, row, (x, y) => {
			this.showRowMenu(habit, x, y);
		});

		const main = row.createDiv({ cls: "habits-panel-row-main" });
		if (habit.icon) {
			const icon = main.createSpan({ cls: "habits-panel-icon" });
			applyHabitIcon(icon, habit.icon);
		}
		const name = main.createEl("button", {
			cls: "habits-panel-name",
			text: habit.name,
			attr: {
				type: "button",
				"aria-label": t("Open the note for {name}", { name: habit.name }),
			},
		});
		setTooltip(name, `${habit.name} — ${t("Open habit note")}`);
		this.registerDomEvent(name, "click", () => {
			void this.app.workspace.openLinkText(habit.path, "", false);
		});

		if (habit.times.length > 0) {
			// All times stay visible; the name truncates instead and its
			// tooltip already reveals the full name.
			main.createSpan({
				cls: "habits-panel-time",
				text: habit.times.map(formatTimeOfDay).join(", "),
			});
		}

		if (this.getSettings().experimental.rescheduling) {
			const movedFrom = rescheduleSource(habit, toDateKey(new Date()));
			if (movedFrom) {
				const badge = main.createSpan({
					cls: "habits-panel-rescheduled",
				});
				setIcon(badge, "calendar");
				const movedFromDate = fromDateKey(movedFrom);
				setTooltip(
					badge,
					t("Rescheduled from {date}", {
						date: movedFromDate
							? friendlyDateLabel(movedFromDate, new Date())
							: movedFrom,
					}),
				);
			}
		}

		if (this.isPausedToday(habit)) {
			row.addClass("is-paused");
			const resume = main.createEl("button", {
				cls: "habits-icon-button habits-panel-mini",
				attr: { type: "button", "aria-label": t("Resume habit") },
			});
			setIcon(resume, "play");
			setTooltip(resume, t("Resume habit"));
			this.registerDomEvent(resume, "click", async () => {
				await this.store.resumeHabit(habit);
				this.reload();
			});
			return;
		}

		const done = this.isDone(habit);
		row.toggleClass("is-done", done);

		if (isFlexible(habit)) {
			this.renderFlexibleRow(main, habit, row);
			return;
		}

		if (habit.type === "binary" && habit.goalDirection === "max") {
			// A limit day is clean unless a slip is logged, so the toggle
			// inverts: it records the slip, and records it back away.
			const slipped = this.valueOf(habit) >= 1;
			row.toggleClass("is-slipped", slipped);
			const toggle = main.createEl("button", {
				cls: "habits-panel-toggle habits-panel-slip-toggle",
				attr: {
					type: "button",
					"aria-label": slipped
						? t("Mark as clean")
						: t("Mark as slipped"),
					"aria-pressed": String(slipped),
				},
			});
			setIcon(toggle, slipped ? "x" : "check");
			this.registerDomEvent(toggle, "click", async () => {
				await this.commit(habit, slipped ? 0 : 1, row);
			});
			return;
		}

		if (habit.type === "binary") {
			const toggle = main.createEl("button", {
				cls: "habits-panel-toggle",
				attr: {
					type: "button",
					"aria-label": done ? t("Mark as not done") : t("Mark as done"),
					"aria-pressed": String(done),
				},
			});
			setIcon(toggle, done ? "check" : "circle");
			this.registerDomEvent(toggle, "click", async () => {
				await this.commit(habit, done ? 0 : 1, row);
			});
			return;
		}

		if (habit.type === "note") {
			this.renderNoteRow(main, habit);
			return;
		}

		const value = this.valueOf(habit);
		const timed = habit.type === "timed";
		const step = stepOf(habit);
		const isMax = habit.goalDirection === "max";
		const goalValue = isMax ? limitOf(habit) : habit.target;
		row.toggleClass("is-slipped", isMax && !done);
		const valueBtn = main.createEl("button", {
			cls: "habits-panel-value",
			text: `${formatValue(value)}/${formatValue(goalValue)}`,
			attr: { type: "button", "aria-label": t("Edit value") },
		});
		setTooltip(valueBtn, t("Click to type a value"));
		this.registerDomEvent(valueBtn, "click", () => {
			this.editRowValue(habit, row, valueBtn);
		});

		const minus = main.createEl("button", {
			cls: "habits-icon-button habits-panel-mini",
			attr: {
				type: "button",
				"aria-label": t("Decrease by {n}", { n: formatValue(step) }),
			},
		});
		setIcon(minus, "minus");
		this.registerDomEvent(minus, "click", async () => {
			await this.commit(habit, value - step, row);
		});

		if (timed) {
			// Time gets logged in chunks, so offer 1, 5 and 10 minutes.
			for (const step of [1, 5, 10]) {
				const btn = main.createEl("button", {
					cls: "habits-icon-button habits-panel-mini habits-panel-step",
					text: `+${step}`,
					attr: {
						type: "button",
						"aria-label": t("Increase by {n}", { n: step }),
					},
				});
				this.registerDomEvent(btn, "click", async () => {
					await this.commit(habit, value + step, row);
				});
			}
		} else {
			const plus = main.createEl("button", {
				cls: "habits-icon-button habits-panel-mini",
				attr: {
					type: "button",
					"aria-label": t("Increase by {n}", { n: formatValue(step) }),
				},
			});
			setIcon(plus, "plus");
			this.registerDomEvent(plus, "click", async () => {
				await this.commit(habit, value + step, row);
			});
		}

		const progress = row.createDiv({ cls: "habits-panel-progress" });
		const fill = progress.createDiv({
			cls: "habits-panel-progress-fill",
		});
		const pct = isMax
			? goalValue > 0
				? Math.min(100, Math.round((value / goalValue) * 100))
				: value > 0
					? 100
					: 0
			: habit.target > 0
				? Math.min(100, Math.round((value / habit.target) * 100))
				: 0;
		fill.setCssProps({ "--habits-progress": `${pct}%` });
		if (isMax && !done) {
			progress.addClass("is-over");
		} else if (done) {
			progress.addClass("is-complete");
		}
	}

	/**
	 * Compact row for a flexible weekly/monthly habit: the same +1/−1 (and
	 * +5/+10 for timed) buttons as the plain counter row, still logging
	 * today's own value, but the readout and progress bar show the running
	 * total for the whole period (see {@link flexiblePeriodTotal}) instead
	 * of just today's — read-only, since it isn't itself what gets stored.
	 */
	private renderFlexibleRow(
		main: HTMLElement,
		habit: HabitDefinition,
		row: HTMLElement,
	): void {
		const value = this.valueOf(habit);
		const timed = habit.type === "timed";
		const step = stepOf(habit);
		const goalValue = habit.goalDirection === "max" ? limitOf(habit) : habit.target > 0 ? habit.target : 1;
		const periodTotal = flexiblePeriodTotal(habit, new Date());
		main.createSpan({
			cls: "habits-panel-value habits-panel-readout-value",
			text: `${formatValue(periodTotal)}/${formatValue(goalValue)}`,
		});

		const minus = main.createEl("button", {
			cls: "habits-icon-button habits-panel-mini",
			attr: {
				type: "button",
				"aria-label": t("Decrease by {n}", { n: formatValue(step) }),
			},
		});
		setIcon(minus, "minus");
		this.registerDomEvent(minus, "click", async () => {
			await this.commit(habit, value - step, row);
		});

		if (timed) {
			for (const step of [1, 5, 10]) {
				const btn = main.createEl("button", {
					cls: "habits-icon-button habits-panel-mini habits-panel-step",
					text: `+${step}`,
					attr: {
						type: "button",
						"aria-label": t("Increase by {n}", { n: step }),
					},
				});
				this.registerDomEvent(btn, "click", async () => {
					await this.commit(habit, value + step, row);
				});
			}
		} else {
			const plus = main.createEl("button", {
				cls: "habits-icon-button habits-panel-mini",
				attr: {
					type: "button",
					"aria-label": t("Increase by {n}", { n: formatValue(step) }),
				},
			});
			setIcon(plus, "plus");
			this.registerDomEvent(plus, "click", async () => {
				await this.commit(habit, value + step, row);
			});
		}

		const progress = row.createDiv({ cls: "habits-panel-progress" });
		const fill = progress.createDiv({ cls: "habits-panel-progress-fill" });
		const pct = goalValue > 0 ? Math.min(100, Math.round((periodTotal / goalValue) * 100)) : periodTotal > 0 ? 100 : 0;
		fill.setCssProps({ "--habits-progress": `${pct}%` });
		if (habit.goalDirection === "max") {
			progress.toggleClass("is-over", periodTotal > goalValue);
		} else if (periodTotal >= goalValue) {
			progress.addClass("is-complete");
		}
	}

	/**
	 * Compact row for a note habit: a read-only char-count/percentage
	 * readout (machine-derived, so not click-to-edit like other types) plus
	 * a single Write/Open action for today's note.
	 */
	private renderNoteRow(main: HTMLElement, habit: HabitDefinition): void {
		const value = this.valueOf(habit);
		main.createSpan({
			cls: "habits-panel-value habits-panel-readout-value",
			text: `${value}/${habit.target} ${habit.unit || "chars"}`,
		});

		const dateKey = this.todayKey();
		const notePath = notePathForDate(habit, dateKey);
		const exists =
			this.app.vault.getAbstractFileByPath(notePath) instanceof TFile;

		const action = main.createEl("button", {
			cls: "habits-icon-button habits-panel-mini",
			attr: { type: "button" },
		});
		if (exists) {
			setIcon(action, "file-text");
			setTooltip(action, t("Open today's note"));
			this.registerDomEvent(action, "click", () => {
				void this.app.workspace.openLinkText(notePath, "", false);
			});
		} else {
			setIcon(action, "square-pen");
			setTooltip(action, t("Write today's note"));
			this.registerDomEvent(action, "click", async () => {
				const file = await createNoteHabitEntry(
					this.app,
					habit,
					dateKey,
				);
				if (file) {
					void this.app.workspace.openLinkText(file.path, "", false);
					this.reload();
				}
			});
		}
	}

	/** Swap the value readout for an input so the user can type a value. */
	private editRowValue(
		habit: HabitDefinition,
		row: HTMLElement,
		valueBtn: HTMLElement,
	): void {
		const input = createEl("input", {
			cls: "habits-panel-value-input",
			attr: {
				type: "number",
				min: "0",
				step: allowsDecimals(habit) ? "any" : "1",
				inputmode: allowsDecimals(habit) ? "decimal" : "numeric",
				"aria-label": t("Value"),
			},
		});
		input.value = formatValue(this.valueOf(habit));
		valueBtn.replaceWith(input);
		input.focus();
		input.select();

		let done = false;
		const finish = async (save: boolean): Promise<void> => {
			if (done) {
				return;
			}
			done = true;
			if (save) {
				const parsed = Number(input.value);
				if (Number.isFinite(parsed)) {
					await this.commit(habit, cleanValue(habit, parsed), row);
					return;
				}
			}
			this.reload();
		};

		this.registerDomEvent(input, "keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				void finish(true);
			} else if (evt.key === "Escape") {
				evt.preventDefault();
				void finish(false);
			}
		});
		this.registerDomEvent(input, "blur", () => {
			void finish(true);
		});
	}

	/** Write a value for today, celebrating a fresh completion briefly. */
	private async commit(
		habit: HabitDefinition,
		value: number,
		row: HTMLElement,
	): Promise<void> {
		const wasDone = this.isDone(habit);
		const clamped = roundValue(Math.max(0, value));
		const dateKey = this.todayKey();
		if (clamped > 0) {
			habit.records[dateKey] = clamped;
		} else {
			delete habit.records[dateKey];
		}

		this.suppressAutoReload = true;
		try {
			await this.store.setRecord(habit, dateKey, clamped);
			// Limit habits celebrate quietly: recovering from a slip or
			// logging under the limit should not flash a completion check.
			if (
				!wasDone &&
				this.isDone(habit) &&
				habit.goalDirection !== "max" &&
				this.getSettings().animations
			) {
				row.addClass("is-celebrating");
				const flash = row.createDiv({ cls: "habits-panel-flash" });
				const icon = flash.createSpan({
					cls: "habits-panel-flash-icon",
				});
				setIcon(icon, "circle-check");
				await sleep(650);
			}
		} finally {
			this.suppressAutoReload = false;
		}
		this.reload();
	}

	/** Last time a row menu opened; guards double-fire on long-press. */
	private lastMenuAt = 0;

	private showRowMenu(habit: HabitDefinition, x: number, y: number): void {
		const now = Date.now();
		if (now - this.lastMenuAt < 500) {
			return;
		}
		this.lastMenuAt = now;
		const menu = new Menu();
		addDayStatusItems(menu, this.app, this.store, habit, this.todayKey(), () =>
			this.render(),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Open note"))
				.setIcon("file-text")
				.onClick(() => {
					void this.app.workspace.openLinkText(
						habit.path,
						"",
						false,
					);
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Edit habit"))
				.setIcon("pencil")
				.onClick(() => {
					new HabitModal(
						this.app,
						this.store,
						() => this.reload(),
						habit,
						this.getSettings().experimental.noteHabits,
					).open();
				}),
		);
		if (habit.paused) {
			menu.addItem((item) =>
				item
					.setTitle(t("Resume habit"))
					.setIcon("play")
					.onClick(async () => {
						await this.store.resumeHabit(habit);
						this.reload();
					}),
			);
		} else {
			menu.addItem((item) =>
				item
					.setTitle(t("Pause habit"))
					.setIcon("pause")
					.onClick(async () => {
						await this.store.pauseHabit(habit);
						this.reload();
					}),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle(t("Stop tracking"))
				.setIcon("circle-stop")
				.onClick(() => {
					new ConfirmModal(this.app, {
						title: t("Stop tracking"),
						message: t(
							'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.',
							{ name: habit.name },
						),
						confirmText: t("Stop tracking"),
						onConfirm: async () => {
							await this.store.stopHabit(habit);
							this.reload();
						},
					}).open();
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Remove habit"))
				.setIcon("trash")
				.onClick(() => {
					new ConfirmModal(this.app, {
						title: t("Remove habit"),
						message: t(
							'Remove "{name}"? Its note will be moved to the trash.',
							{ name: habit.name },
						),
						confirmText: t("Remove"),
						danger: true,
						onConfirm: async () => {
							await this.store.deleteHabit(habit);
							this.reload();
						},
					}).open();
				}),
		);
		menu.showAtPosition({ x, y });
	}
}
