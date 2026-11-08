import { t as settingsText } from "@/translations/helper";
import { Setting } from "obsidian";
import { TaskProgressBarSettingTab } from "@/setting";

export function renderTaskTimerSettingTab(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement
) {
    // Create task timer settings section
		const timerSection = containerEl.createDiv();
		timerSection.addClass("task-timer-settings-section");

		// Main enable/disable setting
		new Setting(timerSection)
			.setName(settingsText("Enable Task Timer"))
			.setDesc(
				settingsText("Enable task timer functionality for tracking time spent on tasks"),
			)
			.addToggle((toggle) => {
				toggle
					.setValue(settingTab.plugin.settings.taskTimer?.enabled || false)
					.onChange(async (value) => {
						if (!settingTab.plugin.settings.taskTimer) {
							settingTab.plugin.settings.taskTimer = {
								enabled: false,
								metadataDetection: {
									frontmatter: "task-timer",
									folders: [],
									tags: [],
								},
								timeFormat: "{h}hrs{m}mins",
								blockRefPrefix: "timer",
							};
						}
						settingTab.plugin.settings.taskTimer.enabled = value;
						settingTab.applySettingsUpdate();

						// Re-render the section to show/hide additional options
						settingTab.display();
					});
			});

		// Show additional settings only if timer is enabled
		if (settingTab.plugin.settings.taskTimer?.enabled) {
			// Metadata detection section
			const metadataSection = timerSection.createDiv();
			metadataSection.addClass("task-timer-metadata-section");

			const metadataHeading = metadataSection.createEl("h3");
			metadataHeading.setText(settingsText("Metadata Detection"));
			metadataHeading.addClass("task-timer-section-heading");

			// Frontmatter field setting
			new Setting(metadataSection)
				.setName(settingsText("Frontmatter field"))
				.setDesc(
					settingsText("Field name in frontmatter to check for enabling task timer (e.g., 'task-timer: true')"),
				)
				.addText((text) => {
					text.setValue(
						settingTab.plugin.settings.taskTimer?.metadataDetection
							?.frontmatter || "task-timer",
					).onChange(async (value) => {
						if (settingTab.plugin.settings.taskTimer?.metadataDetection) {
							settingTab.plugin.settings.taskTimer.metadataDetection.frontmatter =
								value;
							settingTab.applySettingsUpdate();
						}
					});
				});

			// Folder paths setting
			new Setting(metadataSection)
				.setName(settingsText("Folder paths"))
				.setDesc(
					settingsText("Comma-separated list of folder paths where task timer should be enabled"),
				)
				.addTextArea((textArea) => {
					textArea
						.setValue(
							settingTab.plugin.settings.taskTimer?.metadataDetection?.folders?.join(
								", ",
							) || "",
						)
						.onChange(async (value) => {
							if (
								settingTab.plugin.settings.taskTimer
									?.metadataDetection
							) {
								settingTab.plugin.settings.taskTimer.metadataDetection.folders =
									value
										.split(",")
										.map((f) => f.trim())
										.filter((f) => f);
								settingTab.applySettingsUpdate();
							}
						});
					textArea.inputEl.rows = 3;
				});

			// Tags setting
			new Setting(metadataSection)
				.setName(settingsText("Tags"))
				.setDesc(settingsText("Comma-separated list of tags that enable task timer"))
				.addTextArea((textArea) => {
					textArea
						.setValue(
							settingTab.plugin.settings.taskTimer?.metadataDetection?.tags?.join(
								", ",
							) || "",
						)
						.onChange(async (value) => {
							if (
								settingTab.plugin.settings.taskTimer
									?.metadataDetection
							) {
								settingTab.plugin.settings.taskTimer.metadataDetection.tags =
									value
										.split(",")
										.map((t) => t.trim())
										.filter((t) => t);
								settingTab.applySettingsUpdate();
							}
						});
					textArea.inputEl.rows = 3;
				});

			// Time format section
			const formatSection = timerSection.createDiv();
			formatSection.addClass("task-timer-format-section");

			const formatHeading = formatSection.createEl("h3");
			formatHeading.setText(settingsText("Time Format"));
			formatHeading.addClass("task-timer-section-heading");

			// Time format template setting
			new Setting(formatSection)
				.setName(settingsText("Time format template"))
				.setDesc(
					settingsText("Template for displaying completed task time. Use {h} for hours, {m} for minutes, {s} for seconds"),
				)
				.addText((text) => {
					text.setValue(
						settingTab.plugin.settings.taskTimer?.timeFormat ||
							"{h}hrs{m}mins",
					).onChange(async (value) => {
						if (settingTab.plugin.settings.taskTimer) {
							settingTab.plugin.settings.taskTimer.timeFormat = value;
							settingTab.applySettingsUpdate();
						}
					});
				});

			// Format examples
			const examplesDiv = formatSection.createDiv();
			examplesDiv.addClass("task-timer-examples");

			const examplesTitle = examplesDiv.createDiv();
			examplesTitle.addClass("task-timer-examples-title");
			examplesTitle.setText(settingsText("Format Examples:"));

			const examplesList = examplesDiv.createEl("ul");

			const examples = [
				{ format: "{h}hrs{m}mins", result: "2hrs30mins" },
				{ format: "{h}h {m}m {s}s", result: "2h 30m 45s" },
				{ format: "{h}:{m}:{s}", result: "2:30:45" },
				{ format: "({m}mins)", result: "(150mins)" },
			];

			examples.forEach((example) => {
				const listItem = examplesList.createEl("li");
				const codeEl = listItem.createEl("code");
				codeEl.setText(example.format);
				listItem.appendText(" → " + example.result);
			});

			// Block reference section
			const blockRefSection = timerSection.createDiv();
			blockRefSection.addClass("task-timer-blockref-section");

			const blockRefHeading = blockRefSection.createEl("h3");
			blockRefHeading.setText(settingsText("Block References"));
			blockRefHeading.addClass("task-timer-section-heading");

			// Block reference prefix setting
			new Setting(blockRefSection)
				.setName(settingsText("Block reference prefix"))
				.setDesc(
					settingsText("Prefix for generated block reference IDs (e.g., 'timer' creates ^timer-123456-7890)"),
				)
				.addText((text) => {
					text.setValue(
						settingTab.plugin.settings.taskTimer?.blockRefPrefix ||
							"timer",
					).onChange(async (value) => {
						if (settingTab.plugin.settings.taskTimer) {
							settingTab.plugin.settings.taskTimer.blockRefPrefix =
								value;
							settingTab.applySettingsUpdate();
						}
					});
				});

			// Commands section
			const commandsSection = timerSection.createDiv();
			commandsSection.addClass("task-timer-commands-section");

			const commandsHeading = commandsSection.createEl("h3");
			commandsHeading.setText(settingsText("Data Management"));
			commandsHeading.addClass("task-timer-section-heading");

			const commandsDesc = commandsSection.createDiv();
			commandsDesc.addClass("task-timer-commands-desc");

			const descParagraph = commandsDesc.createEl("p");
			descParagraph.setText(
				settingsText("Use the command palette to access timer data management:"),
			);

			const commandsList = commandsDesc.createEl("ul");

			const commands = [
				{
					name: settingsText("Export task timer data"),
					desc: settingsText("Export all timer data to JSON"),
				},
				{
					name: settingsText("Import task timer data"),
					desc: settingsText("Import timer data from JSON file"),
				},
				{
					name: settingsText("Export task timer data (YAML)"),
					desc: settingsText("Export to YAML format"),
				},
				{
					name: settingsText("Create task timer backup"),
					desc: settingsText("Create a backup of active timers"),
				},
				{
					name: settingsText("Show task timer statistics"),
					desc: settingsText("Display timer usage statistics"),
				},
			];

			commands.forEach((command) => {
				const listItem = commandsList.createEl("li");
				const strongEl = listItem.createEl("strong");
				strongEl.setText(command.name);
				listItem.appendText(" - " + command.desc);
			});
		}
}