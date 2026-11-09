import { App, MarkdownRenderChild, type Events } from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import { HabitsDashboard } from "./dashboard";
import { NativeHabitCards } from "./native-cards";
import { HabitsCompact } from "./habits-compact";

/** Hosts the chosen layout of the existing `habits` block. */
export class HabitsBlock extends MarkdownRenderChild {
	private view: MarkdownRenderChild | null = null;
	private layout = "";
	private searchQuery = "";
	setSearchQuery(value: string): void {
		this.searchQuery = value.trim().toLocaleLowerCase();
		(this.view as HabitsDashboard | HabitsCompact | NativeHabitCards | null)?.setSearchQuery?.(this.searchQuery);
	}

	constructor(
		private app: App,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
		private pluginEvents: Events,
		private sourcePath: string,
		root: HTMLElement,
	) {
		super(root);
	}

	onload(): void {
		this.registerEvent(this.pluginEvents.on("settings-changed", () => this.updateLayout()));
		this.updateLayout();
	}

	private updateLayout(): void {
		const layout = this.getSettings().dashboardLayout;
		if (layout === this.layout) return;
		this.layout = layout;
		if (this.view) this.removeChild(this.view);
		this.containerEl.empty();
		const root = this.containerEl.createDiv();
		if (layout === "cards") {
			this.view = this.addChild(new NativeHabitCards(this.app, this.store, this.getSettings(), this.pluginEvents, root));
		} else {
			const View = layout === "compact" ? HabitsCompact : HabitsDashboard;
			this.view = this.addChild(new View(this.app, this.store, this.getSettings, this.pluginEvents, this.sourcePath, root));
		}
		if (this.searchQuery) (this.view as HabitsDashboard | HabitsCompact | NativeHabitCards).setSearchQuery?.(this.searchQuery);
	}
}
