import {
	App,
	MarkdownRenderChild,
	Menu,
	TFile,
	debounce,
	normalizePath,
	setIcon,
	setTooltip,
	type Events,
} from "obsidian";
import { t } from "../i18n";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { HabitDefinition } from "../types";
import {
	flexiblePeriodTotal,
	getStatsRange,
	habitStats,
	isActive,
	isFlexible,
	isPausedOn,
	limitOf,
	rescheduleSource,
	type DateRange,
} from "../stats";
import { createNoteHabitEntry, notePathForDate } from "../note-habit";
import {
	addDayStatusItems,
	DAY_STATUS_ICON,
	dayStatus,
	dayStatusLabel,
	reopenDay,
	scheduleSnoozeRefresh,
} from "./day-status";
import {
	formatTimeOfDay,
	formatValue,
	friendlyDateLabel,
	fromDateKey,
	groupHabits,
	habitScheduleLabel,
	roundValue,
	sectionLabel,
	registerLongPress,
	sortHabits,
	stepOf,
	toDateKey,
} from "../utils";

/** One column of period counts: a header label and its date range. */
interface PeriodColumn {
	label: string;
	range: DateRange;
}

/**
 * Renders a `habits-table` code block: one row per active habit with its
 * schedule and completed/due counts for the current week and the last three
 * calendar months. Counts come from {@link habitStats}, so they follow the
 * same rules as everywhere else — only due days count, paused days and days
 * before the habit existed are excluded, and periods cut off at today.
 */
export class HabitsTable extends MarkdownRenderChild {
	constructor(
		private app: App,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
		private pluginEvents: Events,
		root: HTMLElement,
	) {
		super(root);
	}

	/** Cancels the pending refresh for when a snooze ends. */
	private cancelSnoozeRefresh: () => void = () => {};
	/** Last time a Today-cell menu opened; guards double-fire on long-press. */
	private lastMenuAt = 0;

	onunload(): void {
		this.cancelSnoozeRefresh();
	}

	onload(): void {
		this.containerEl.addClass("habits-table-block");
		// Same freshness contract as the dashboard: re-render whenever a
		// habit note changes on disk, from any pane, device sync included.
		const requestRender = debounce(() => this.render(), 250, true);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.isHabitFile(file.path)) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (this.isHabitFile(file.path)) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.isHabitFile(file.path)) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (
					this.isHabitFile(file.path) ||
					this.isHabitFile(oldPath)
				) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.pluginEvents.on("settings-changed", () => {
				requestRender();
			}),
		);
		this.render();
	}

	/** True when the path lives inside the configured habits folder. */
	private isHabitFile(path: string): boolean {
		const folder = normalizePath(this.getSettings().habitsFolder);
		return path === folder || path.startsWith(`${folder}/`);
	}

	private render(): void {
		const root = this.containerEl;
		root.empty();

		const habits = this.store
			.getHabits()
			.filter((habit) => !habit.stopped);
		if (habits.length === 0) {
			root.createDiv({
				cls: "habits-table-empty",
				text: t("No habits to show stats for yet."),
			});
			return;
		}

		const today = new Date();
		this.cancelSnoozeRefresh();
		this.cancelSnoozeRefresh = scheduleSnoozeRefresh(
			root.win,
			this.store,
			habits,
			() => this.render(),
		);
		const columns = this.periodColumns(today);
		const settings = this.getSettings();
		const sections = groupHabits(
			sortHabits(habits, "time", []),
			settings.tableGrouping,
			settings.groupOrder,
		);
		const showSections =
			sections.length > 1 || (sections[0] && sections[0].key !== "");

		const table = root.createEl("table", { cls: "habits-table" });
		const head = table.createEl("thead").createEl("tr");
		head.createEl("th", { text: t("Habit") });
		head.createEl("th", { text: t("Schedule") });
		head.createEl("th", { text: t("Today") });
		for (const column of columns) {
			head.createEl("th", {
				cls: "habits-table-count",
				text: column.label,
			});
		}

		const body = table.createEl("tbody");
		for (const section of sections) {
			if (showSections) {
				const row = body.createEl("tr", {
					cls: "habits-table-group",
				});
				row.createEl("td", {
					text: sectionLabel(section.key),
					attr: { colspan: String(3 + columns.length) },
				});
			}
			for (const habit of section.habits) {
				this.renderRow(body, habit, columns, today);
			}
		}
	}

	private renderRow(
		body: HTMLElement,
		habit: HabitDefinition,
		columns: PeriodColumn[],
		today: Date,
	): void {
		const row = body.createEl("tr");

		const nameCell = row.createEl("td", { cls: "habits-table-name" });
		const link = nameCell.createEl("a", {
			cls: "habits-table-link",
			text: habit.name,
		});
		this.registerDomEvent(link, "click", (evt) => {
			evt.preventDefault();
			void this.app.workspace.openLinkText(habit.path, "", false);
		});
		if (habit.paused) {
			const badge = nameCell.createSpan({
				cls: "habits-table-paused",
				attr: { "aria-label": t("Paused") },
			});
			setIcon(badge, "pause");
		}
		if (this.getSettings().experimental.rescheduling) {
			const movedFrom = rescheduleSource(habit, toDateKey(today));
			if (movedFrom) {
				const badge = nameCell.createSpan({
					cls: "habits-table-rescheduled",
				});
				setIcon(badge, "calendar");
				const movedFromDate = fromDateKey(movedFrom);
				setTooltip(
					badge,
					t("Rescheduled from {date}", {
						date: movedFromDate
							? friendlyDateLabel(movedFromDate, today)
							: movedFrom,
					}),
				);
			}
		}

		row.createEl("td", {
			cls: "habits-table-schedule",
			text: this.scheduleText(habit),
		});

		const todayCell = row.createEl("td", { cls: "habits-table-today" });
		this.renderTodayCell(todayCell, habit, today);
		// Right-click (or long-press) the Today cell to fail, skip or
		// snooze the habit for today, like a dashboard card's menu.
		const openMenu = (x: number, y: number): void => {
			const now = Date.now();
			if (now - this.lastMenuAt < 500) {
				return;
			}
			this.lastMenuAt = now;
			const menu = new Menu();
			addDayStatusItems(
				menu,
				this.app,
				this.store,
				habit,
				toDateKey(today),
				() => this.renderTodayCell(todayCell, habit, today),
			);
			menu.showAtPosition({ x, y });
		};
		this.registerDomEvent(todayCell, "contextmenu", (evt: MouseEvent) => {
			evt.preventDefault();
			openMenu(evt.clientX, evt.clientY);
		});
		registerLongPress(this, todayCell, openMenu);

		for (const column of columns) {
			const stats = habitStats(habit, column.range, today);
			row.createEl("td", {
				cls: "habits-table-count",
				text:
					stats.days > 0
						? `${stats.completed}/${stats.days}`
						: "–",
			});
		}
	}

	/**
	 * The interactive Today column, sitting between the schedule and the
	 * period counts: log today's value without leaving the table.
	 * Binary habits get the Done/Not done pill, limit habits the
	 * slip toggle, counted and timed habits a compact stepper, and note
	 * habits a button to open (or create) today's note — their completion
	 * comes from the note's own content, never a manually-set value. Habits
	 * not due today show a dash; paused habits a pause glyph. The cell
	 * redraws itself optimistically on click — the count columns catch up
	 * when the note change comes back through the metadata cache.
	 */
	private renderTodayCell(
		cell: HTMLElement,
		habit: HabitDefinition,
		today: Date,
	): void {
		cell.empty();
		const dateKey = toDateKey(today);

		// Failed, skipped or snoozed for today: the row stays (its period
		// counts are still useful) but the cell says so, and a click puts
		// the habit back.
		const status = isActive(habit, today)
			? dayStatus(habit, dateKey, this.store)
			: null;
		if (status) {
			const pill = this.createPill(
				cell,
				DAY_STATUS_ICON[status],
				dayStatusLabel(habit, status, this.store),
				t("Undo"),
				false,
			);
			pill.addClass("habits-table-closed");
			pill.addClass(`is-${status}`);
			setTooltip(pill, t("Click to undo"));
			this.registerDomEvent(pill, "click", async () => {
				pill.disabled = true;
				await reopenDay(habit, dateKey, status, this.store);
				this.renderTodayCell(cell, habit, today);
			});
			return;
		}

		if (isPausedOn(habit, dateKey)) {
			const badge = cell.createSpan({
				cls: "habits-table-paused",
				attr: { "aria-label": t("Paused") },
			});
			setIcon(badge, "pause");
			return;
		}
		if (!isActive(habit, today)) {
			cell.createSpan({ cls: "habits-table-notdue", text: "–" });
			return;
		}

		if (habit.type === "note") {
			this.renderNoteCell(cell, habit, dateKey);
			return;
		}

		const value = habit.records[dateKey] ?? 0;
		const commit = async (next: number): Promise<void> => {
			const clamped = roundValue(Math.max(0, next));
			// Mirror the write locally so the cell can redraw immediately;
			// the store keeps zero-values out of frontmatter, so do the same.
			if (clamped > 0) {
				habit.records[dateKey] = clamped;
			} else {
				delete habit.records[dateKey];
			}
			this.renderTodayCell(cell, habit, today);
			await this.store.setRecord(habit, dateKey, clamped);
		};

		if (isFlexible(habit)) {
			// Still logs today's own value via `commit`; only the readout
			// shows the whole period's running total instead of today's.
			const step = habit.type === "timed" ? 5 : stepOf(habit);
			const goal = habit.goalDirection === "max" ? limitOf(habit) : habit.target > 0 ? habit.target : 1;
			const periodTotal = flexiblePeriodTotal(habit, today);
			const stepper = cell.createDiv({ cls: "habits-table-stepper" });
			const minus = stepper.createEl("button", {
				cls: "habits-icon-button habits-table-mini",
				attr: {
					type: "button",
					"aria-label": t("Decrease by {n}", { n: formatValue(step) }),
				},
			});
			setIcon(minus, "minus");
			this.registerDomEvent(minus, "click", () => {
				void commit(value - step);
			});
			stepper.createSpan({
				cls: "habits-table-value",
				text: `${formatValue(periodTotal)}/${formatValue(goal)}`,
			});
			const plus = stepper.createEl("button", {
				cls: "habits-icon-button habits-table-mini",
				attr: {
					type: "button",
					"aria-label": t("Increase by {n}", { n: formatValue(step) }),
				},
			});
			setIcon(plus, "plus");
			this.registerDomEvent(plus, "click", () => {
				void commit(value + step);
			});
			return;
		}

		if (habit.type === "binary" && habit.goalDirection === "max") {
			const slipped = value >= 1;
			const pill = this.createPill(
				cell,
				slipped ? "x" : "check",
				slipped ? t("Slipped") : t("Clean"),
				slipped ? t("Mark as clean") : t("Mark as slipped"),
				slipped,
			);
			pill.addClass("habits-table-slip");
			this.registerDomEvent(pill, "click", () => {
				void commit(slipped ? 0 : 1);
			});
			return;
		}

		if (habit.type === "binary") {
			const done = value >= 1;
			const pill = this.createPill(
				cell,
				done ? "check" : "circle",
				done ? t("Done") : t("Not done"),
				done ? t("Mark as not done") : t("Mark as done"),
				done,
			);
			this.registerDomEvent(pill, "click", () => {
				void commit(done ? 0 : 1);
			});
			return;
		}

		// Counted and timed habits: [−] value/goal [+]. Timed habits step
		// in 5-minute chunks, matching the spirit of the panel's steppers.
		const step = habit.type === "timed" ? 5 : stepOf(habit);
		const goal =
			habit.goalDirection === "max" ? limitOf(habit) : habit.target;
		const stepper = cell.createDiv({ cls: "habits-table-stepper" });
		const minus = stepper.createEl("button", {
			cls: "habits-icon-button habits-table-mini",
			attr: {
					type: "button",
					"aria-label": t("Decrease by {n}", { n: formatValue(step) }),
				},
		});
		setIcon(minus, "minus");
		this.registerDomEvent(minus, "click", () => {
			void commit(value - step);
		});
		stepper.createSpan({
			cls: "habits-table-value",
			text: `${formatValue(value)}/${formatValue(goal)}`,
		});
		const plus = stepper.createEl("button", {
			cls: "habits-icon-button habits-table-mini",
			attr: {
				type: "button",
				"aria-label": t("Increase by {n}", { n: formatValue(step) }),
			},
		});
		setIcon(plus, "plus");
		this.registerDomEvent(plus, "click", () => {
			void commit(value + step);
		});
	}

	/**
	 * Note habits are completed by the note's own content (chars, checklist,
	 * or both — see `noteCompletionMode`), never by a manually-set value, so
	 * the Today cell offers only a button to open or create that day's note
	 * rather than the +/- stepper the other types get.
	 */
	private renderNoteCell(
		cell: HTMLElement,
		habit: HabitDefinition,
		dateKey: string,
	): void {
		const notePath = notePathForDate(habit, dateKey);
		const exists =
			this.app.vault.getAbstractFileByPath(notePath) instanceof TFile;
		const button = cell.createEl("button", {
			cls: "habits-icon-button habits-table-mini",
			attr: { type: "button" },
		});
		setIcon(button, exists ? "file-text" : "square-pen");
		setTooltip(
			button,
			exists ? t("Open this day's note") : t("Write this day's note"),
		);
		this.registerDomEvent(button, "click", async () => {
			if (exists) {
				void this.app.workspace.openLinkText(notePath, "", false);
				return;
			}
			const file = await createNoteHabitEntry(this.app, habit, dateKey);
			if (file) {
				void this.app.workspace.openLinkText(file.path, "", false);
			}
		});
	}

	/** The Done/Not done-style pill used by the binary today controls. */
	private createPill(
		cell: HTMLElement,
		icon: string,
		label: string,
		ariaLabel: string,
		active: boolean,
	): HTMLButtonElement {
		const pill = cell.createEl("button", {
			cls: "habits-table-toggle",
			attr: {
				type: "button",
				"aria-label": ariaLabel,
				"aria-pressed": String(active),
			},
		});
		pill.toggleClass("is-done", active);
		const glyph = pill.createSpan({ cls: "habits-table-toggle-icon" });
		setIcon(glyph, icon);
		pill.createSpan({ text: label });
		return pill;
	}

	/**
	 * The schedule cell always names the cadence — a daily habit reads
	 * "Daily" rather than the empty label cards use — plus the planned
	 * time when one is set.
	 */
	private scheduleText(habit: HabitDefinition): string {
		const schedule = habitScheduleLabel(habit) || t("Daily");
		const times = habit.times.map(formatTimeOfDay).join(", ");
		return times ? `${schedule} · ${times}` : schedule;
	}

	/**
	 * The four count columns: the current calendar week (Monday-first,
	 * matching the stats view) and the current plus two previous calendar
	 * months, labelled with locale month names.
	 */
	private periodColumns(today: Date): PeriodColumn[] {
		const columns: PeriodColumn[] = [
			{
				label: t("This week"),
				range: getStatsRange(today, "weekly", "calendar"),
			},
		];
		for (let back = 0; back < 3; back++) {
			const start = new Date(
				today.getFullYear(),
				today.getMonth() - back,
				1,
			);
			const end = new Date(
				today.getFullYear(),
				today.getMonth() - back + 1,
				0,
			);
			columns.push({
				label: start.toLocaleDateString(undefined, {
					month: "short",
				}),
				range: { start, end },
			});
		}
		return columns;
	}
}
