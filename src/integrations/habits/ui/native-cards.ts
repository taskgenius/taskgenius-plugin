import { renderMissedNotification } from "./missed-notification";
import { applyHabitIcon } from "./icon-suggest-modal";
import { App, Component, Events, MarkdownRenderChild, Menu, Notice, setIcon } from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { HabitDefinition } from "../types";
import { isDailyComplete, isActive, flexiblePeriodTotal, isFlexible, isPausedOn, limitOf } from "../stats";
import { addDays, toDateKey, fromDateKey, habitAccent, stepOf, sortHabits, formatValue, roundValue, friendlyDateLabel } from "../utils";
import { HabitModal } from "./habit-modal";
import { t } from "../i18n";
import { nativeCardHeat } from "./native-card-state";
import { renderClosedHabits, dayStatus, scheduleSnoozeRefresh } from "./day-status";
import { createNoteHabitEntry, notePathForDate } from "../note-habit";
import { addDayStatusItems } from "./day-status";
import { ConfirmModal } from "./confirm-modal";

/** Task Genius cards, backed by the same Markdown notes as the dashboard. */
export class NativeHabitCards extends MarkdownRenderChild {
	private disposed = false;
	private selectedDate = new Date();
	private query = "";
	private events?: Component;
	private pending = new Set<string>();
	private saved = new Map<string, Map<string, number>>();
	private closedOpen = false;
	private cancelSnooze = () => {};
	constructor(private app: App, private store: HabitStore, private settings: HabitsPluginSettings, private bus: Events, root: HTMLElement) { super(root); }
	setSearchQuery(query: string): void { const next = query.trim().toLocaleLowerCase(); if (next === this.query) return; this.query = next; this.render(); }
	onload(): void {
		this.disposed = false;
		this.containerEl.addClass("tg-native-habits");
		this.registerEvent(this.app.metadataCache.on("changed", file => { this.saved.delete(file.path); this.render(); }));
		for (const event of ["create", "delete", "rename"] as const) this.registerEvent(this.app.vault.on(event as "create", () => this.render()));
		this.registerEvent(this.bus.on("settings-changed", () => this.render()));
		this.render();
	}
	private button(root: HTMLElement, icon: string, label: string, action: () => void): HTMLButtonElement {
		const button = root.createEl("button", { cls: "clickable-icon", attr: { "aria-label": label, title: label } });
		setIcon(button, icon); this.events?.registerDomEvent(button, "click", action); return button;
	}
	private render(): void {
		if (this.disposed) return;
		if (this.events) this.removeChild(this.events);
		this.events = this.addChild(new Component()); this.containerEl.empty();
		const nav = this.containerEl.createDiv({ cls: "tg-native-habit-nav" });
		this.button(nav, "chevron-left", t("Previous day"), () => { this.selectedDate = addDays(this.selectedDate, -1); this.render(); });
		const label = nav.createEl("button", { text: friendlyDateLabel(this.selectedDate, new Date()), cls: "tg-native-habit-date-label", attr: { title: toDateKey(this.selectedDate), "aria-label": t("Today") } });
		this.events.registerDomEvent(label, "click", () => { this.selectedDate = new Date(); this.render(); });
		const date = this.containerEl.createEl("input", { cls: "tg-habit-date-picker", attr: { type: "date", tabindex: "-1", "aria-label": t("Date") } }); date.value = toDateKey(this.selectedDate);
		this.events.registerDomEvent(date, "change", () => { const next = fromDateKey(date.value); if (next) { this.selectedDate = next; this.render(); } });
		this.events.registerDomEvent(label, "contextmenu", event => { event.preventDefault(); if (typeof date.showPicker === "function") date.showPicker(); else date.click(); });
		this.button(nav, "chevron-right", t("Next day"), () => { this.selectedDate = addDays(this.selectedDate, 1); this.render(); });
		renderMissedNotification(nav, this.events, this.app, this.store, () => this.render());
		const add = this.button(nav, "plus", t("Add habit"), () => new HabitModal(this.app, this.store, () => this.render(), null, this.settings.experimental.noteHabits).open()); add.addClass("tg-habit-add");
		const key = toDateKey(this.selectedDate);
		const habits = sortHabits(this.store.getHabits().filter(habit => !habit.stopped && (!this.query || `${habit.name} ${habit.group}`.toLocaleLowerCase().includes(this.query))).map(original => {
			const habit = { ...original, records: { ...original.records } };
			for (const [day, value] of this.saved.get(habit.path) || []) { if (value > 0) habit.records[day] = value; else delete habit.records[day]; }
			return habit;
		}), this.settings.sortMode, this.settings.manualOrder, this.settings.groups, this.settings.groupOrder);
		this.cancelSnooze(); this.cancelSnooze = scheduleSnoozeRefresh(this.containerEl.win, this.store, habits, () => this.render());
		const scheduled = habits.filter(habit => isActive(habit, this.selectedDate) && (!habit.startDate || key >= habit.startDate));
		const closed = scheduled.flatMap(habit => { const status = dayStatus(habit, key, this.store); return status ? [{ habit, status }] : []; });
		const visible = scheduled.filter(habit => !closed.some(item => item.habit.path === habit.path));
		const ordered = [...visible.filter(habit => !isDailyComplete(habit, key) && !isPausedOn(habit, key)), ...visible.filter(habit => isDailyComplete(habit, key) && !isPausedOn(habit, key)), ...visible.filter(habit => isPausedOn(habit, key))];
		const cards = this.containerEl.createDiv({ cls: "tg-native-habit-cards" });
		cards.dataset.columns = this.settings.habitColumns || "auto";
		for (const habit of ordered) {
			const original = habit;
			const card = cards.createDiv({ cls: "tg-native-habit-card" });
			card.toggleClass("is-done", isDailyComplete(habit, key)); card.style.setProperty("--habit-accent", habitAccent(habit, this.settings.groups));
			const header = card.createDiv({ cls: "tg-native-habit-heading" });
			const icon = header.createSpan({ cls: "tg-native-habit-icon" });
			if (habit.icon || this.settings.groups[habit.group]?.icon) applyHabitIcon(icon, habit.icon || this.settings.groups[habit.group].icon); else setIcon(icon, "circle-check"); header.createEl("strong", { text: habit.name });
			this.button(header, "more-horizontal", t("More actions"), () => {
				const menu = new Menu();
				addDayStatusItems(menu, this.app, this.store, original, key, () => this.render());
				menu.addItem(item => item.setTitle(t("Edit habit")).setIcon("pencil").onClick(() => new HabitModal(this.app, this.store, () => this.render(), original, this.settings.experimental.noteHabits).open()));
				menu.addItem(item => item.setTitle(t("Open note")).setIcon("file-text").onClick(() => void this.app.workspace.openLinkText(habit.path, "", false)));
				menu.addItem(item => item.setTitle(habit.paused ? t("Resume habit") : t("Pause habit")).setIcon(habit.paused ? "play" : "pause").onClick(async () => {
					if (habit.paused) await this.store.resumeHabit(original); else await this.store.pauseHabit(original); this.render();
				}));
				menu.addItem(item => item.setTitle(t("Remove habit")).setIcon("trash").onClick(async () => {
					if (await ConfirmModal.ask(this.app, t("Remove habit"), t('Remove "{name}"? Its note will be moved to the trash.', { name: habit.name }))) { await this.store.deleteHabit(original); this.render(); }
				}));
				menu.showAtPosition({ x: header.getBoundingClientRect().right, y: header.getBoundingClientRect().bottom });
			});
			const body = card.createDiv({ cls: "tg-native-habit-body" });
			const grid = body.createDiv({ cls: "tg-native-habit-grid" });
			for (let offset = -29; offset <= 0; offset++) {
				const day = addDays(this.selectedDate, offset), dayKey = toDateKey(day), value = habit.records[dayKey] || 0;
				const heat = nativeCardHeat(habit, dayKey);
				const cell = grid.createEl("button", { cls: "tg-native-habit-cell", attr: { title: `${dayKey}: ${value}`, "aria-label": `${habit.name} ${dayKey}: ${value}` } });
				cell.toggleClass("is-complete", heat.level >= 2);
				cell.setAttribute("data-heat", String(heat.level));
				cell.toggleClass("is-over-limit", heat.overLimit);
				cell.toggleClass("is-rest", !isActive(habit, day));
				cell.disabled = this.pending.has(habit.path);
				this.events.registerDomEvent(cell, "click", () => { this.selectedDate = day; this.render(); });
			}
			const controls = body.createDiv({ cls: "tg-native-habit-controls" });
			const value = habit.records[key] || 0, done = isDailyComplete(habit, key), max = habit.goalDirection === "max";
			const total = isFlexible(habit) ? flexiblePeriodTotal(habit, this.selectedDate) : value;
			const goal = max ? limitOf(habit) : habit.type === "binary" && !isFlexible(habit) ? 1 : habit.target;
			const readout = card.createDiv({ cls: "tg-native-habit-goal" });
			readout.setText(`${max ? t("At most") : t("At least")}: ${formatValue(total)} / ${formatValue(goal)}${habit.unit ? ` ${habit.unit}` : ""}${isFlexible(habit) ? ` · ${habit.frequency === "flexibleWeekly" ? t("This week") : t("This month")}` : ""}`);
			if (isFlexible(habit) && habit.dailyTarget) readout.createSpan({ text: ` · ${t("Daily goal")}: ${habit.dailyTarget}` });
			if (isPausedOn(habit, key)) { controls.createSpan({ text: t("Paused") }); continue; }
			if (habit.type === "binary" && !isFlexible(habit)) {
				const toggle = this.button(controls, max ? value > 0 ? "x" : "circle-check" : done ? "check-square" : "square", max ? value > 0 ? t("Mark as clean") : t("Mark as slipped") : t("Check in"), () => void this.commit(original, key, value > 0 ? 0 : 1));
				toggle.disabled = this.pending.has(habit.path); toggle.toggleClass("is-complete", done); toggle.toggleClass("is-over-limit", max && !done);
			} else if (habit.type === "note") {
				this.button(controls, "file-text", t("Open this day's note"), () => void (async () => { const path = notePathForDate(habit, key); if (!this.app.vault.getAbstractFileByPath(path)) await createNoteHabitEntry(this.app, habit, key); await this.app.workspace.openLinkText(path, "", false); })());
			} else {
				const minus = this.button(controls, "minus", t("Decrease"), () => void this.commit(original, key, roundValue(Math.max(0, value - (habit.type === "timed" ? 5 : stepOf(habit))))));
				controls.createSpan({ text: `${value}${habit.unit ? ` ${habit.unit}` : ""}` });
				const plus = this.button(controls, "plus", t("Increase"), () => void this.commit(original, key, roundValue(value + (habit.type === "timed" ? 5 : stepOf(habit)))));
				minus.disabled = this.pending.has(habit.path) || value <= 0; plus.disabled = this.pending.has(habit.path);
			}
		}
		renderClosedHabits(this.containerEl, this.events, this.store, closed, key, this.closedOpen, open => { this.closedOpen = open; this.render(); }, () => this.render());
	}
	onunload(): void { this.disposed = true; this.cancelSnooze(); }
	private async commit(habit: HabitDefinition, key: string, value: number): Promise<void> {
		if (this.pending.has(habit.path)) return; this.pending.add(habit.path); this.render();
		try { await this.store.setRecord(habit, key, value); const saved = this.saved.get(habit.path) || new Map(); saved.set(key, value); this.saved.set(habit.path, saved); }
		catch (error) { new Notice(String(error)); }
		finally { this.pending.delete(habit.path); this.render(); }
	}
}
