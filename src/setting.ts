import { App, PluginSettingTab, setIcon, Setting, debounce } from "obsidian";
import TaskProgressBarPlugin from ".";

import { t } from "./translations/helper";
import "./styles/setting.scss";
import "./styles/setting-v2.scss";
import "./styles/beta-warning.scss";
import "./styles/settings-search.scss";
import "./styles/settings-migration.scss";
import "./styles/workspace-settings-selector.scss";
import "./styles/settings-modal.scss";
import { SettingsModal } from "./components/features/settings/SettingsModal";

export class TaskProgressBarSettingTab extends PluginSettingTab {
	plugin: TaskProgressBarPlugin;
	private debouncedApplySettings: () => void;
	private debouncedApplyNotifications: () => void;

	icon = "task-genius";
	public containerEl: HTMLElement;

	constructor(app: App, plugin: TaskProgressBarPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// Initialize debounced functions
		this.debouncedApplySettings = debounce(
			async () => {
				await plugin.saveSettings();

				// Update dataflow orchestrator with new settings
				if (plugin.dataflowOrchestrator) {
					// Call async updateSettings and await to ensure incremental reindex completes
					await plugin.dataflowOrchestrator.updateSettings(
						plugin.settings,
					);
				}

				// Reload notification manager to apply changes immediately
				await plugin.notificationManager?.reloadSettings();

				// Trigger view updates to reflect setting changes
				await plugin.triggerViewUpdate();
			},
			100,
			true,
		);

		this.debouncedApplyNotifications = debounce(
			async () => {
				await plugin.saveSettings();
				// Only refresh notification-related UI; do not touch dataflow orchestrator
				await plugin.notificationManager?.reloadSettings();
				// Minimal view updates are unnecessary here
			},
			100,
			true,
		);
	}

	applySettingsUpdate() {
		this.debouncedApplySettings();
	}

	// Lightweight updater for notifications/tray changes to avoid reloading task caches
	applyNotificationsUpdateLight() {
		this.debouncedApplyNotifications();
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass("task-genius-settings-entry");

		// Header section
		const headerEl = containerEl.createDiv({
			cls: "settings-entry-header",
		});

		// Logo and title
		const titleContainer = headerEl.createDiv({
			cls: "settings-entry-title-container",
		});
		const logoEl = titleContainer.createSpan({
			cls: "settings-entry-logo",
		});
		setIcon(logoEl, "task-genius");

		const titleTextContainer = titleContainer.createDiv({
			cls: "settings-entry-title-text",
		});
		titleTextContainer.createEl("h2", { text: "Task Genius" });
		titleTextContainer.createEl("span", {
			cls: "settings-entry-version",
			text: `v${this.plugin.manifest.version}`,
		});

		// Description
		const descEl = headerEl.createDiv({ cls: "settings-entry-desc" });
		descEl.createEl("p", {
			text: t(
				"A comprehensive task management plugin for Obsidian with advanced progress tracking, workflows, and productivity features.",
			),
		});

		// Main action button
		// const actionContainer = containerEl.createDiv({
		// 	cls: "settings-entry-action",
		// });

		new Setting(containerEl)
			.setName(t("Open Settings"))
			.setDesc(
				t(
					"Configure all Task Genius features in a dedicated settings window.",
				),
			)
			.addButton((button) => {
				button
					.setButtonText(t("Open Settings"))
					.setCta()
					.onClick(() => {
						new SettingsModal(this.app, this.plugin).open();
					});
			});

		// Quick links section
		const linksContainer = containerEl.createDiv({
			cls: "settings-entry-links",
		});
		linksContainer.createEl("h3", { text: t("Quick Links") });

		const linksGrid = linksContainer.createDiv({
			cls: "settings-entry-links-grid",
		});

		const quickLinks = [
			{
				icon: "book",
				text: t("Documentation"),
				url: "https://taskgenius.md/docs",
			},
			{
				icon: "github",
				text: t("GitHub"),
				url: "https://github.com/Quorafind/Obsidian-Task-Genius",
			},
			{
				icon: "heart",
				text: t("Support"),
				url: "https://www.buymeacoffee.com/boninall",
			},
			{
				icon: "message-circle",
				text: t("Discord"),
				url: "https://discord.gg/TBnXTjSs",
			},
		];

		quickLinks.forEach((link) => {
			const linkEl = linksGrid.createEl("a", {
				cls: "settings-entry-link",
				href: link.url,
			});
			linkEl.setAttr("target", "_blank");

			const iconEl = linkEl.createSpan({
				cls: "settings-entry-link-icon",
			});
			setIcon(iconEl, link.icon);
			linkEl.createSpan({ text: link.text });
		});

		// Features overview
		const featuresContainer = containerEl.createDiv({
			cls: "settings-entry-features",
		});
		featuresContainer.createEl("h3", { text: t("Features") });

		const features = [
			{
				icon: "trending-up",
				title: t("Progress Tracking"),
				desc: t("Visual progress bars for tasks and projects"),
			},
			{
				icon: "git-branch",
				title: t("Workflows"),
				desc: t("Custom task workflows with stages"),
			},
			{
				icon: "calendar-clock",
				title: t("Time Management"),
				desc: t("Due dates, priorities, and scheduling"),
			},
			{
				icon: "gift",
				title: t("Gamification"),
				desc: t("Rewards and habits for motivation"),
			},
			{
				icon: "layout",
				title: t("Multiple Views"),
				desc: t("Kanban, calendar, timeline, and more"),
			},
			{
				icon: "zap",
				title: t("Quick Capture"),
				desc: t("Fast task creation from anywhere"),
			},
		];

		const featuresGrid = featuresContainer.createDiv({
			cls: "settings-entry-features-grid",
		});

		features.forEach((feature) => {
			const featureEl = featuresGrid.createDiv({
				cls: "settings-entry-feature",
			});

			const iconContainer = featureEl.createDiv({
				cls: "settings-entry-feature-icon",
			});
			setIcon(iconContainer, feature.icon);

			const textContainer = featureEl.createDiv({
				cls: "settings-entry-feature-text",
			});
			textContainer.createEl("strong", { text: feature.title });
			textContainer.createEl("span", { text: feature.desc });
		});
	}

	/**
	 * Open the settings modal with a specific tab
	 */
	public openTab(tabId: string) {
		const modal = new SettingsModal(this.app, this.plugin);
		modal.open();
		modal.openTab(tabId);
	}

	/**
	 * Switch to a specific tab (opens modal)
	 */
	public switchToTab(tabId: string) {
		this.openTab(tabId);
	}

	/**
	 * Navigate to a specific tab via URI
	 */
	public navigateToTab(
		tabId: string,
		_section?: string,
		_search?: string,
	): void {
		this.openTab(tabId);
	}
}
