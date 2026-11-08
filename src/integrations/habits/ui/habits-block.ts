import { App, MarkdownRenderChild, type Events } from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import { HabitsDashboard } from "./dashboard";
import { HabitsCompact } from "./habits-compact";

/** Hosts the chosen layout of the existing `habits` block. */
export class HabitsBlock extends MarkdownRenderChild {
	private view: MarkdownRenderChild | null = null;
	private compact: boolean | null = null;

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
		const compact = this.getSettings().dashboardLayout === "compact";
		if (compact === this.compact) return;
		this.compact = compact;
		if (this.view) this.removeChild(this.view);
		this.containerEl.empty();
		const root = this.containerEl.createDiv();
		const View = compact ? HabitsCompact : HabitsDashboard;
		this.view = this.addChild(new View(
			this.app, this.store, this.getSettings,
			this.pluginEvents, this.sourcePath, root,
		));
	}
}
