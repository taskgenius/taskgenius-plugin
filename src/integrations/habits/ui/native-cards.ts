import { App, Component, Events, MarkdownRenderChild, Menu, Notice, setIcon } from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { HabitDefinition } from "../types";
import { isDailyComplete, isActive, flexiblePeriodTotal, isFlexible } from "../stats";
import { addDays, toDateKey, fromDateKey, habitAccent, stepOf } from "../utils";
import { HabitModal } from "./habit-modal";
import { t } from "../i18n";
import { addDayStatusItems } from "./day-status";
import { ConfirmModal } from "./confirm-modal";

/** Task Genius cards, backed by the same Markdown notes as the dashboard. */
export class NativeHabitCards extends MarkdownRenderChild {
	private selectedDate = new Date();
	private query = "";
	private events?: Component;
	private pending = new Set<string>();
	private saved = new Map<string, Map<string, number>>();
	constructor(private app: App, private store: HabitStore, private settings: HabitsPluginSettings, private bus: Events, root: HTMLElement) { super(root); }
	setSearchQuery(query: string): void { this.query = query.trim().toLocaleLowerCase(); this.render(); }
	onload(): void {
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
		if (this.events) this.removeChild(this.events);
		this.events = this.addChild(new Component()); this.containerEl.empty();
		const nav = this.containerEl.createDiv({ cls: "tg-native-habit-nav" });
		this.button(nav, "chevron-left", t("Previous day"), () => { this.selectedDate = addDays(this.selectedDate, -1); this.render(); });
		const date = nav.createEl("input", { attr: { type: "date", "aria-label": t("Date") } }); date.value = toDateKey(this.selectedDate);
		this.events.registerDomEvent(date, "change", () => { const next = fromDateKey(date.value); if (next) { this.selectedDate = next; this.render(); } });
		this.button(nav, "chevron-right", t("Next day"), () => { this.selectedDate = addDays(this.selectedDate, 1); this.render(); });
		this.button(nav, "plus", t("Add habit"), () => new HabitModal(this.app, this.store, () => this.render(), null, this.settings.experimental.noteHabits).open());
		const key = toDateKey(this.selectedDate);
		for (const original of this.store.getHabits().filter(habit => !habit.stopped && (!this.query || `${habit.name} ${habit.group}`.toLocaleLowerCase().includes(this.query)))) {
			const habit = { ...original, records: { ...original.records } };
			for (const [day, value] of this.saved.get(habit.path) || []) habit.records[day] = value;
			const card = this.containerEl.createDiv({ cls: "tg-native-habit-card" }); card.style.setProperty("--habit-accent", habitAccent(habit, this.settings.groups));
			const header = card.createDiv({ cls: "tg-native-habit-heading" });
			setIcon(header.createSpan(), "circle-check"); header.createEl("strong", { text: habit.name });
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
				const cell = grid.createEl("button", { cls: "tg-native-habit-cell", attr: { title: `${dayKey}: ${value}`, "aria-label": `${habit.name} ${dayKey}: ${value}` } });
				cell.toggleClass("is-complete", isDailyComplete(habit, dayKey));
				cell.toggleClass("is-rest", !isActive(habit, day));
				cell.disabled = this.pending.has(habit.path);
				this.events.registerDomEvent(cell, "click", () => { this.selectedDate = day; this.render(); });
			}
			const controls = body.createDiv({ cls: "tg-native-habit-controls" });
			const value = habit.records[key] || 0, done = isDailyComplete(habit, key);
			if (habit.type === "binary" && !isFlexible(habit)) {
				const toggle = this.button(controls, done ? "check-square" : "square", t("Check in"), () => void this.commit(original, key, value > 0 ? 0 : 1));
				toggle.disabled = this.pending.has(habit.path); toggle.toggleClass("is-complete", done);
			} else if (habit.type === "note") {
				this.button(controls, "file-text", t("Open note"), () => void this.app.workspace.openLinkText(habit.path, "", false));
			} else {
				const minus = this.button(controls, "minus", t("Decrease"), () => void this.commit(original, key, Math.max(0, value - stepOf(habit))));
				controls.createSpan({ text: `${value}${habit.unit ? ` ${habit.unit}` : ""}` });
				const plus = this.button(controls, "plus", t("Increase"), () => void this.commit(original, key, value + stepOf(habit)));
				minus.disabled = this.pending.has(habit.path) || value <= 0; plus.disabled = this.pending.has(habit.path);
			}
			if (isFlexible(habit)) card.createDiv({ cls: "tg-native-habit-period", text: `${t("Period progress")}: ${flexiblePeriodTotal(habit, this.selectedDate)} / ${habit.target}` });
		}
	}
	private async commit(habit: HabitDefinition, key: string, value: number): Promise<void> {
		if (this.pending.has(habit.path)) return; this.pending.add(habit.path); this.render();
		try { await this.store.setRecord(habit, key, value); const saved = this.saved.get(habit.path) || new Map(); saved.set(key, value); this.saved.set(habit.path, saved); }
		catch (error) { new Notice(String(error)); }
		finally { this.pending.delete(habit.path); this.render(); }
	}
}
