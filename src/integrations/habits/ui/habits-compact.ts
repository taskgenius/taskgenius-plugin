import { App, Component, MarkdownRenderChild, Menu, Notice, TFile, debounce, normalizePath, setIcon, setTooltip, type Events } from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { HabitDefinition } from "../types";
import { t } from "../i18n";
import { flexiblePeriodTotal, isActive, isComplete, isFlexible, isPausedOn, limitOf } from "../stats";
import { addDays, formatValue, friendlyDateLabel, fromDateKey, groupHabits, habitAccent, parseNoteDate, registerLongPress, roundValue, sectionLabel, sortHabits, stepOf, toDateKey } from "../utils";
import { createNoteHabitEntry, notePathForDate } from "../note-habit";
import { HabitModal } from "./habit-modal";
import { applyHabitIcon } from "./icon-suggest-modal";
import { renderStatsView } from "./stats-view";
import { ConfirmModal } from "./confirm-modal";
import { addDayStatusItems, dayStatus, renderClosedHabits, scheduleSnoozeRefresh, type ClosedHabit } from "./day-status";

/** Compact layout of the `habits` dashboard, with date navigation. */
export class HabitsCompact extends MarkdownRenderChild {
	private selectedDate = new Date();
	private stats = false;
	private active = false;
	private pending = new Set<string>();
	private savedValues = new Map<string, Map<string, number>>();
	private renderEvents: Component | null = null;
	private lastMenuAt = -Infinity;
	/** Failed/skipped days just written, bridged until the metadata cache catches up (like savedValues). */
	private savedDays = new Map<string, { failed: string[]; skipped: string[] }>();
	/** Whether the "hidden for today" list under the rows is expanded. */
	private closedOpen = false;
	/** Cancels the pending refresh for when a snooze ends. */
	private cancelSnoozeRefresh: () => void = () => {};

	constructor(
		private app: App,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
		private pluginEvents: Events,
		private sourcePath: string,
		root: HTMLElement,
	) { super(root); }

	onload(): void {
		this.active = true;
		this.containerEl.addClass("habits-compact");
		const settings = this.getSettings();
		if (settings.followDailyNoteDate) {
			const name = (this.sourcePath.split("/").pop() ?? "").replace(/\.md$/, "");
			this.selectedDate = parseNoteDate(name, settings.dailyNoteDateFormat?.trim() || "YYYY-MM-DD") ?? new Date();
		}
		const refresh = debounce(() => this.render(), 250, true);
		const relevant = (path: string): boolean => {
			const folder = normalizePath(this.getSettings().habitsFolder);
			return path === folder || path.startsWith(`${folder}/`);
		};
		// Note habits can derive their completion from notes outside the habits folder.
		this.registerEvent(this.app.metadataCache.on("changed", file => {
			this.savedValues.delete(file.path);
			this.savedDays.delete(file.path);
			refresh();
		}));
		this.registerEvent(this.app.vault.on("create", () => refresh()));
		this.registerEvent(this.app.vault.on("delete", () => refresh()));
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (relevant(file.path) || relevant(oldPath) || file instanceof TFile) refresh();
		}));
		this.registerEvent(this.pluginEvents.on("settings-changed", () => refresh()));
		this.render();
	}

	onunload(): void {
		this.active = false;
		this.cancelSnoozeRefresh();
	}

	/** Remember a habit's failed/skipped days after a change, then repaint. */
	private dayChanged(habit: HabitDefinition): void {
		this.savedDays.set(habit.path, { failed: [...habit.failed], skipped: [...habit.skipped] });
		this.render();
	}

	private button(parent: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
		const button = parent.createEl("button", {
			cls: "habits-icon-button habits-compact-button",
			attr: { type: "button", "aria-label": label },
		});
		setIcon(button, icon);
		setTooltip(button, label);
		this.renderEvents?.registerDomEvent(button, "click", action);
		return button;
	}

	private render(): void {
		if (!this.active) return;
		if (this.renderEvents) this.removeChild(this.renderEvents);
		this.renderEvents = this.addChild(new Component());
		const root = this.containerEl;
		root.empty();
		const settings = this.getSettings();
		const habits = sortHabits(this.store.getHabits().filter(h => !h.stopped), settings.sortMode, settings.manualOrder, settings.groups, settings.groupOrder);
		// Bridge the delay between a successful disk write and metadata-cache refresh.
		for (const habit of habits) {
			for (const [key, value] of this.savedValues.get(habit.path) ?? []) {
				if (value > 0) habit.records[key] = value;
				else delete habit.records[key];
			}
			const days = this.savedDays.get(habit.path);
			if (days) {
				habit.failed = [...days.failed];
				habit.skipped = [...days.skipped];
			}
		}
		const header = root.createDiv({ cls: "habits-compact-header" });
		const stats = this.button(header, this.stats ? "home" : "chart-column", this.stats ? t("Back to habits") : t("View stats"), () => {
			this.stats = !this.stats;
			this.render();
		});
		stats.setAttribute("aria-pressed", String(this.stats));
		const nav = header.createDiv({ cls: "habits-compact-nav" });
		this.button(nav, "chevron-left", t("Previous day"), () => { this.selectedDate = addDays(this.selectedDate, -1); this.render(); });
		const dateButton = nav.createEl("button", { cls: "habits-compact-date", text: friendlyDateLabel(this.selectedDate, new Date()), attr: { type: "button", "aria-label": t("Choose a date") } });
		// Keep the native picker outside the flex navigation so theme styles on
		// date inputs cannot introduce a phantom gap between the buttons.
		const dateInput = root.createEl("input", { cls: "habits-compact-date-input", attr: { type: "date", tabindex: "-1", "aria-hidden": "true" } });
		dateInput.value = toDateKey(this.selectedDate);
		this.renderEvents.registerDomEvent(dateInput, "change", () => {
			const parsed = fromDateKey(dateInput.value);
			if (parsed) { this.selectedDate = parsed; this.render(); }
		});
		this.renderEvents.registerDomEvent(dateButton, "click", () => {
			dateInput.value = toDateKey(this.selectedDate);
			if (typeof dateInput.showPicker === "function") dateInput.showPicker();
			else dateInput.click();
		});
		this.button(nav, "chevron-right", t("Next day"), () => { this.selectedDate = addDays(this.selectedDate, 1); this.render(); });
		this.button(header, "plus", t("Add habit"), () => {
			new HabitModal(this.app, this.store, () => this.render(), null, settings.experimental.noteHabits).open();
		});
		if (this.stats) {
			renderStatsView(root.createDiv(), habits, "weekly", "calendar", this.selectedDate, undefined, undefined, undefined, settings.groups);
			return;
		}
		const key = toDateKey(this.selectedDate);
		this.cancelSnoozeRefresh();
		this.cancelSnoozeRefresh = scheduleSnoozeRefresh(root.win, this.store, habits, () => this.render());
		const scheduled = habits.filter(h => isActive(h, this.selectedDate) && (!h.startDate || key >= h.startDate));
		// Failed, skipped or snoozed habits leave the list but stay listed underneath.
		const closed: ClosedHabit[] = [];
		const due: HabitDefinition[] = [];
		for (const habit of scheduled) {
			const status = dayStatus(habit, key, this.store);
			if (status) closed.push({ habit, status });
			else due.push(habit);
		}
		const showClosed = (): void => renderClosedHabits(root, this.renderEvents ?? this, this.store, closed, key, this.closedOpen,
			open => { this.closedOpen = open; this.render(); },
			habit => this.dayChanged(habit));
		if (!due.length) {
			root.createDiv({ cls: "habits-compact-empty", text: closed.length ? t("Nothing left on this day's list.") : habits.length ? t("Nothing due today.") : t("No habits yet.") });
			showClosed();
			return;
		}
		const list = root.createDiv({ cls: "habits-compact-list" });
		const grouped = settings.groupsEnabled && settings.sortMode === "group";
		for (const section of groupHabits(due, grouped, settings.groupOrder)) {
			if (grouped) list.createDiv({ cls: "habits-compact-group", text: sectionLabel(section.key) });
			let ordered = section.habits;
			if (settings.statusOrdering) {
				const active = ordered.filter(habit => !isPausedOn(habit, key));
				ordered = [
					...active.filter(habit => !isComplete(habit, key)),
					...active.filter(habit => isComplete(habit, key)),
					...ordered.filter(habit => isPausedOn(habit, key)),
				];
			}
			for (const habit of ordered) this.renderRow(list, habit);
		}
		showClosed();
	}

	private renderRow(list: HTMLElement, habit: HabitDefinition): void {
		const key = toDateKey(this.selectedDate);
		const row = list.createDiv({ cls: "habits-compact-row" });
		setTooltip(row, t("Right-click or long-press for more options"));
		this.renderEvents?.registerDomEvent(row, "contextmenu", (evt: MouseEvent) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.showRowMenu(habit, evt.clientX, evt.clientY);
		});
		if (this.renderEvents) {
			registerLongPress(this.renderEvents, row, (x, y) => this.showRowMenu(habit, x, y));
		}
		row.setCssProps({ "--habits-accent": habitAccent(habit, this.getSettings().groups) || "var(--interactive-accent)" });
		row.toggleClass("is-done", isComplete(habit, key));
		const name = row.createEl("a", { cls: "habits-compact-name", href: habit.path });
		if (habit.icon) applyHabitIcon(name.createSpan({ cls: "habits-compact-icon" }), habit.icon);
		name.createSpan({ text: habit.name });
		this.renderEvents?.registerDomEvent(name, "click", evt => { evt.preventDefault(); void this.app.workspace.openLinkText(habit.path, this.sourcePath, false); });
		const controls = row.createDiv({ cls: "habits-compact-controls" });
		if (isPausedOn(habit, key)) { controls.createSpan({ text: t("Paused") }); return; }
		if (habit.type === "note") {
			const path = notePathForDate(habit, key);
			const exists = this.app.vault.getAbstractFileByPath(path) instanceof TFile;
			this.button(controls, exists ? "file-text" : "square-pen", exists ? t("Open this day's note") : t("Write this day's note"), () => {
				void (async () => {
					if (exists) await this.app.workspace.openLinkText(path, this.sourcePath, false);
					else { const file = await createNoteHabitEntry(this.app, habit, key); if (file) await this.app.workspace.openLinkText(file.path, this.sourcePath, false); }
				})();
			});
			return;
		}
		const value = habit.records[key] ?? 0;
		const busy = this.pending.has(habit.path);
		if (habit.type === "binary" && !isFlexible(habit)) {
			const active = value >= 1;
			const limit = habit.goalDirection === "max";
			const toggle = this.button(controls, active ? (limit ? "x" : "check") : "circle", limit ? (active ? t("Mark as clean") : t("Mark as slipped")) : (active ? t("Mark as not done") : t("Mark as done")), () => { void this.commit(habit, key, active ? 0 : 1); });
			toggle.addClass("habits-compact-toggle");
			toggle.setAttribute("aria-pressed", String(active));
			toggle.disabled = busy;
			return;
		}
		const flexible = isFlexible(habit);
		const total = flexible ? flexiblePeriodTotal(habit, this.selectedDate) : value;
		const target = habit.goalDirection === "max" ? limitOf(habit) : habit.target;
		const readout = controls.createSpan({ cls: "habits-compact-value" });
		readout.createSpan({ cls: "habits-compact-current", text: formatValue(total) });
		readout.createSpan({ text: ` / ${formatValue(target)}${habit.unit ? ` ${habit.unit}` : ""}${flexible ? ` ${habit.frequency === "flexibleWeekly" ? t("This week") : t("This month")}` : ""}` });
		const step = habit.type === "timed" ? 5 : stepOf(habit);
		const minus = this.button(controls, "minus", t("Decrease by {n}", { n: formatValue(step) }), () => { void this.commit(habit, key, roundValue(Math.max(0, value - step))); });
		minus.disabled = busy || value <= 0;
		const plus = this.button(controls, "plus", t("Increase by {n}", { n: formatValue(step) }), () => { void this.commit(habit, key, roundValue(value + step)); });
		plus.disabled = busy;
	}

	private showRowMenu(habit: HabitDefinition, x: number, y: number): void {
		const now = Date.now();
		if (!this.active || now - this.lastMenuAt < 500) return;
		this.lastMenuAt = now;
		const menu = new Menu();
		addDayStatusItems(menu, this.app, this.store, habit, toDateKey(this.selectedDate), () => this.dayChanged(habit));
		menu.addItem(item => item.setTitle(t("Open note")).setIcon("file-text").onClick(() => {
			void this.app.workspace.openLinkText(habit.path, this.sourcePath, false);
		}));
		menu.addItem(item => item.setTitle(t("Edit habit")).setIcon("pencil").onClick(() => {
			const settings = this.getSettings();
			new HabitModal(this.app, this.store, () => this.render(), habit,
				settings.experimental.noteHabits).open();
		}));
		menu.addItem(item => item.setTitle(habit.paused ? t("Resume habit") : t("Pause habit"))
			.setIcon(habit.paused ? "play" : "pause").onClick(async () => {
				if (habit.paused) await this.store.resumeHabit(habit);
				else await this.store.pauseHabit(habit);
				this.render();
			}));
		menu.addItem(item => item.setTitle(t("Stop tracking")).setIcon("circle-stop").onClick(() => {
			new ConfirmModal(this.app, {
				title: t("Stop tracking"),
				message: t('Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.', { name: habit.name }),
				confirmText: t("Stop tracking"),
				onConfirm: async () => { await this.store.stopHabit(habit); this.render(); },
			}).open();
		}));
		menu.addItem(item => item.setTitle(t("Remove habit")).setIcon("trash").onClick(() => {
			new ConfirmModal(this.app, {
				title: t("Remove habit"),
				message: t('Remove "{name}"? Its note will be moved to the trash.', { name: habit.name }),
				confirmText: t("Remove"),
				danger: true,
				onConfirm: async () => { await this.store.deleteHabit(habit); this.render(); },
			}).open();
		}));
		menu.showAtPosition({ x, y });
	}

	private async commit(habit: HabitDefinition, key: string, value: number): Promise<void> {
		if (this.pending.has(habit.path)) return;
		this.pending.add(habit.path);
		this.render();
		try {
			await this.store.setRecord(habit, key, value);
			const saved = this.savedValues.get(habit.path) ?? new Map<string, number>();
			saved.set(key, value);
			this.savedValues.set(habit.path, saved);
		} catch {
			new Notice(t("Could not save habit record."));
		} finally {
			this.pending.delete(habit.path);
			this.render();
		}
	}
}
