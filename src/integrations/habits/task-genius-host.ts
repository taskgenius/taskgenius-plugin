import { PluginSettingTab, type PluginManifest } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import HabitsPlugin from "./main";
import { HabitsSettingTab, type HabitsPluginSettings } from "./settings";
import "./scoped.css";
import "./task-genius.css";

/** The integration owns a settings namespace, never a second plugin data.json. */
export class TaskGeniusHabits extends HabitsPlugin {
	readonly ready: Promise<void>;
	private resolveReady!: () => void;
	private rejectReady!: (reason: unknown) => void;
	private disposed = false;
	embeddedSettings?: HabitsSettingTab;

	constructor(readonly host: TaskProgressBarPlugin) {
		super(host.app, {
			...host.manifest,
			id: `${host.manifest.id}-habits`,
			name: "Task Genius: Habits",
		} as PluginManifest);
		this.ready = new Promise((resolve, reject) => {
			this.resolveReady = resolve;
			this.rejectReady = reject;
		});
	}

	async onload(): Promise<void> {
		try {
			await super.onload();
			this.resolveReady();
		} catch (error) {
			this.rejectReady(error);
		}
	}

	onunload(): void { this.disposed = true; }
	protected integrationActive(): boolean { return !this.disposed; }

	/** Read the previous plugin's non-secret configuration only on first use. */
	async loadData(): Promise<Partial<HabitsPluginSettings> | null> {
		if (this.host.settings.habitsIntegration) {
			const saved = JSON.parse(JSON.stringify(this.host.settings.habitsIntegration));
			// Fold the two former selectors into one without changing the visible layout.
			if (saved.nativeLayout === "cards" || (!saved.nativeLayout && !saved.layoutUnified)) saved.dashboardLayout = "cards";
			delete saved.nativeLayout;
			saved.layoutUnified = true;
			saved.experimental = { ...saved.experimental, rescheduling: true };
			return saved;
		}
		try {
			const path = `${this.app.vault.configDir}/plugins/habits/data.json`;
			const previous = JSON.parse(await this.app.vault.adapter.read(path));
			const { aiSummary, reminders, ...compatible } = previous;
			// Keys and external writes require deliberate configuration in the host.
			return { ...compatible, dashboardLayout: "cards", layoutUnified: true };
		} catch { return { dashboardLayout: "cards", layoutUnified: true }; }
	}

	async saveData(data: HabitsPluginSettings): Promise<void> {
		this.host.settings.habitsIntegration = JSON.parse(JSON.stringify(data));
		await this.host.saveSettings();
	}

	addSettingTab(tab: PluginSettingTab): void {
		this.embeddedSettings = tab as HabitsSettingTab;
	}

	renderSettings(container: HTMLElement): void {
		container.addClass("tg-habits-surface");
		if (this.embeddedSettings) {
			this.embeddedSettings.containerEl = container;
			this.embeddedSettings.display();
		}
	}

	/** Always own prefixed blocks; claim legacy blocks only without Habits. */
	registerMarkdownCodeBlockProcessor(
		language: string,
		handler: Parameters<HabitsPlugin["registerMarkdownCodeBlockProcessor"]>[1],
		sortOrder?: number,
	): ReturnType<HabitsPlugin["registerMarkdownCodeBlockProcessor"]> {
		const scoped: typeof handler = (source, el, context) => {
			el.addClass("tg-habits-surface");
			return handler(source, el, context);
		};
		const result = super.registerMarkdownCodeBlockProcessor(`tg-${language}`, scoped, sortOrder);
		if (this.backgroundSyncAllowed()) {
			super.registerMarkdownCodeBlockProcessor(language, scoped, sortOrder);
		}
		return result;
	}

	protected backgroundSyncAllowed(): boolean {
		const plugins = (this.app as any).plugins;
		return !this.disposed && this.host.settings.habit.enableHabits && !plugins?.enabledPlugins?.has("habits");
	}

}
