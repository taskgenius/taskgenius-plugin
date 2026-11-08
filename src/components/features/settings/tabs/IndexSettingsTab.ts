import { t as settingsText } from "@/translations/helper";
import { Setting, Notice, setIcon } from "obsidian";
import { TaskProgressBarSettingTab } from "@/setting";
import { t } from "@/translations/helper";
import { SingleFolderSuggest } from "@/components/ui/inputs/AutoComplete";
import { ConfirmModal } from "@/components/ui/modals/ConfirmModal";
import { ListConfigModal } from "@/components/ui/modals/ListConfigModal";
import { createFileSourceSettings } from "../components/FileSourceSettingsSection";
import type {
	FileFilterScopeControls,
	TaskProgressBarSettings,
} from "@/common/setting-definition";
import { FileSourceConfiguration } from "@/types/file-source";

/**
 * Renders the Index Settings tab that consolidates all indexing-related settings
 * including Inline Tasks, Whole-note tasks, and Project detection
 */
export function renderIndexSettingsTab(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement,
) {
	// Main heading
	new Setting(containerEl)
		.setName(t("Where tasks come from"))
		.setDesc(
			t(
				"Task Genius reads checkboxes in your notes. You can also use an entire note as a task.",
			),
		)
		.setHeading();

	// ========================================
	// SECTION 0: Core Architecture Configuration
	// ========================================

	// ========================================
	// SECTION 1: Task Source Configuration
	// ========================================
	const scopeControls = ensureScopeControls(settingTab.plugin.settings);

	const taskSourceWrapper = containerEl.createDiv({
		cls: "tg-index-task-source-wrapper",
	});
	const switcherRow = taskSourceWrapper.createDiv({
		cls: "fluent-view-tabs tg-index-task-source-switcher",
	});
	const inlineSwitcherButton = switcherRow.createEl("button", {
		cls: "fluent-view-tab clickable-icon",
	});
	const inlineTabIcon = inlineSwitcherButton.createSpan({
		cls: "fluent-view-tab-icon",
	});
	setIcon(inlineTabIcon, "check-square");
	inlineSwitcherButton
		.createSpan({ cls: "fluent-view-tab-label" })
		.setText(t("Tasks in notes"));

	const fileSwitcherButton = switcherRow.createEl("button", {
		cls: "fluent-view-tab clickable-icon",
	});
	const fileTabIcon = fileSwitcherButton.createSpan({
		cls: "fluent-view-tab-icon",
	});
	setIcon(fileTabIcon, "file-text");
	fileSwitcherButton
		.createSpan({ cls: "fluent-view-tab-label" })
		.setText(t("Whole-note tasks"));

	const sourcePanels = taskSourceWrapper.createDiv({
		cls: "tg-index-task-source-panels",
	});
	const inlineContainer = sourcePanels.createDiv({
		cls: "tg-index-task-source-panel",
	});
	const fileContainer = sourcePanels.createDiv({
		cls: "tg-index-task-source-panel",
	});

	// Inline task configuration content is rendered into inlineContainer
	(() => {
		let containerEl: HTMLElement = inlineContainer;
		const inlineBodyEl = containerEl.createDiv({ cls: "tg-source-settings-body" });
		containerEl = inlineBodyEl;

		new Setting(containerEl)
			.setName(t("Task writing format"))
			.setDesc(t("Existing task dates and priorities are read automatically."))
			.setHeading();

		new Setting(containerEl)
			.setName(t("Save dates and priorities as"))
			.setDesc(
				t(
					"Choose how new dates and priorities appear in your notes. Existing tasks do not need conversion.",
				),
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("dataview", t("Inline properties"))
					.addOption("tasks", t("Task icons (recommended)"))
					.setValue(settingTab.plugin.settings.preferMetadataFormat)
					.onChange(async (value) => {
						settingTab.plugin.settings.preferMetadataFormat =
							value as "dataview" | "tasks";
						settingTab.applySettingsUpdate();
						// Re-render the settings to update prefix configuration UI
						setTimeout(() => {
							settingTab.display();
						}, 200);
					});
			});

		new Setting(containerEl)
			.setName(t("Exclude tasks in these sections"))
			.setDesc(
				t(
					"For example, exclude tasks below an Archive heading. Leave blank to include all sections.",
				),
			)
			.addButton((button) => {
				const getIgnoreHeadings = () => {
					const value =
						settingTab.plugin.settings.ignoreHeading || "";
					return value
						.split(",")
						.map((h) => h.trim())
						.filter((h) => h);
				};

				const updateButtonText = () => {
					const headings = getIgnoreHeadings();
					if (headings.length === 0) {
						button.setButtonText(t("Configure Ignore Headings"));
					} else {
						button.setButtonText(
							t("{{count}} heading(s) configured", {
								interpolation: {
									count: headings.length.toString(),
								},
							}),
						);
					}
				};

				updateButtonText();
				button.onClick(() => {
					new ListConfigModal(settingTab.plugin, {
						title: t("Configure Ignore Headings"),
						description: t(
							"Add headings to ignore. Tasks under these headings will be excluded from indexing. Examples: '## Project', '## Inbox', '# Archive'",
						),
						placeholder: t("Enter heading (e.g., ## Inbox)"),
						values: getIgnoreHeadings(),
						onSave: (values) => {
							settingTab.plugin.settings.ignoreHeading =
								values.join(", ");
							settingTab.applySettingsUpdate();
							updateButtonText();
							new Notice(
								t(
									"Heading filters updated. Rebuild the task index to apply to existing tasks.",
								),
								6000,
							);
						},
					}).open();
				});
			});

		new Setting(containerEl)
			.setName(t("Only include tasks in these sections"))
			.setDesc(
				t(
					"Optional: only read tasks below the selected headings. Leave blank to include all sections.",
				),
			)
			.addButton((button) => {
				const getFocusHeadings = () => {
					const value = settingTab.plugin.settings.focusHeading || "";
					return value
						.split(",")
						.map((h) => h.trim())
						.filter((h) => h);
				};

				const updateButtonText = () => {
					const headings = getFocusHeadings();
					if (headings.length === 0) {
						button.setButtonText(t("Configure Focus Headings"));
					} else {
						button.setButtonText(
							t("{{count}} heading(s) configured", {
								interpolation: {
									count: headings.length.toString(),
								},
							}),
						);
					}
				};

				updateButtonText();
				button.onClick(() => {
					new ListConfigModal(settingTab.plugin, {
						title: t("Configure Focus Headings"),
						description: t(
							"Add headings to focus on. Only tasks under these headings will be included in indexing. Examples: '## Project', '## Inbox', '# Tasks'",
						),
						placeholder: t("Enter heading (e.g., ## Tasks)"),
						values: getFocusHeadings(),
						onSave: (values) => {
							settingTab.plugin.settings.focusHeading =
								values.join(", ");
							settingTab.applySettingsUpdate();
							updateButtonText();
							new Notice(
								t(
									"Heading filters updated. Rebuild the task index to apply to existing tasks.",
								),
								6000,
							);
						},
					}).open();
				});
			});

		new Setting(containerEl)
			.setName(t("Use the journal date for tasks"))
			.setDesc(
				t(
					"Use the date in the journal filename when arranging its tasks.",
				),
			)
			.addToggle((toggle) => {
				toggle.setValue(
					settingTab.plugin.settings.useDailyNotePathAsDate,
				);
				toggle.onChange((value) => {
					settingTab.plugin.settings.useDailyNotePathAsDate = value;
					settingTab.applySettingsUpdate();

					setTimeout(() => {
						settingTab.display();
					}, 200);
				});
			});

		if (settingTab.plugin.settings.useDailyNotePathAsDate) {
			const descFragment = document.createDocumentFragment();
			descFragment.createEl("div", {
				text: t(
					"Task Genius will use moment.js and also this format to parse the daily note path.",
				),
			});
			descFragment.createEl("div", {
				text: t(
					"You need to set `yyyy` instead of `YYYY` in the format string. And `dd` instead of `DD`.",
				),
			});
			new Setting(containerEl)
				.setName(t("Daily note format"))
				.setDesc(descFragment)
				.addText((text) => {
					text.setValue(settingTab.plugin.settings.dailyNoteFormat);
					text.onChange((value) => {
						settingTab.plugin.settings.dailyNoteFormat = value;
						settingTab.applySettingsUpdate();
					});
				});

			new Setting(containerEl)
				.setName(t("Daily note path"))
				.setDesc(t("Select the folder that contains the daily note."))
				.addText((text) => {
					new SingleFolderSuggest(
						settingTab.app,
						text.inputEl,
						settingTab.plugin,
					);
					text.setValue(settingTab.plugin.settings.dailyNotePath);
					text.onChange((value) => {
						settingTab.plugin.settings.dailyNotePath = value;
						settingTab.applySettingsUpdate();
					});
				});

			new Setting(containerEl)
				.setName(t("Use as date type"))
				.setDesc(
					t(
						"You can choose due, start, or scheduled as the date type for tasks.",
					),
				)
				.addDropdown((dropdown) => {
					dropdown
						.addOption("due", t("Due"))
						.addOption("start", t("Start"))
						.addOption("scheduled", t("Scheduled"))
						.setValue(settingTab.plugin.settings.useAsDateType)
						.onChange(async (value) => {
							settingTab.plugin.settings.useAsDateType = value as
								| "due"
								| "start"
								| "scheduled";
							settingTab.applySettingsUpdate();
						});
				});
		}

		// File Metadata Inheritance Settings
		new Setting(containerEl)
			.setName(t("File Metadata Inheritance"))
			.setDesc(
				t("Configure how tasks inherit metadata from file frontmatter"),
			)
			.setHeading();

		new Setting(containerEl)
			.setName(t("Enable file metadata inheritance"))
			.setDesc(
				t(
					"Allow tasks to inherit metadata properties from their file's frontmatter",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						settingTab.plugin.settings.fileMetadataInheritance
							.enabled,
					)
					.onChange(async (value) => {
						settingTab.plugin.settings.fileMetadataInheritance.enabled =
							value;
						settingTab.applySettingsUpdate();

						new ConfirmModal(settingTab.plugin, {
							title: t("Reindex"),
							message: t(
								"This change affects how tasks inherit metadata from files. Rebuild the index now so changes take effect immediately?",
							),
							confirmText: t("Reindex"),
							cancelText: t("Cancel"),
							onConfirm: async (confirmed: boolean) => {
								if (!confirmed) return;
								try {
									new Notice(
										t(
											"Clearing task cache and rebuilding index...",
										),
									);
									await settingTab.plugin.dataflowOrchestrator?.onSettingsChange(
										["parser"],
									);
									new Notice(
										t("Task index completely rebuilt"),
									);
								} catch (error) {
									console.error(
										"Failed to reindex after inheritance setting change:",
										error,
									);
									new Notice(t("Failed to reindex tasks"));
								}
							},
						}).open();

						setTimeout(() => {
							settingTab.display();
						}, 200);
					}),
			);

		if (settingTab.plugin.settings.fileMetadataInheritance.enabled) {
			new Setting(containerEl)
				.setName(t("Inherit from frontmatter"))
				.setDesc(
					t(
						"Tasks inherit metadata properties like priority, context, etc. from file frontmatter when not explicitly set on the task",
					),
				)
				.addToggle((toggle) =>
					toggle
						.setValue(
							settingTab.plugin.settings.fileMetadataInheritance
								.inheritFromFrontmatter,
						)
						.onChange(async (value) => {
							settingTab.plugin.settings.fileMetadataInheritance.inheritFromFrontmatter =
								value;
							settingTab.applySettingsUpdate();

							new ConfirmModal(settingTab.plugin, {
								title: t("Reindex"),
								message: t(
									"This change affects how tasks inherit metadata from files. Rebuild the index now so changes take effect immediately?",
								),
								confirmText: t("Reindex"),
								cancelText: t("Cancel"),
								onConfirm: async (confirmed: boolean) => {
									if (!confirmed) return;
									try {
										new Notice(
											t(
												"Clearing task cache and rebuilding index...",
											),
										);
										await settingTab.plugin.dataflowOrchestrator?.onSettingsChange(
											["parser"],
										);
										new Notice(
											t("Task index completely rebuilt"),
										);
									} catch (error) {
										console.error(
											"Failed to reindex after inheritance setting change:",
											error,
										);
										new Notice(
											t("Failed to reindex tasks"),
										);
									}
								},
							}).open();
						}),
				);

			new Setting(containerEl)
				.setName(t("Inherit from frontmatter for subtasks"))
				.setDesc(
					t(
						"Allow subtasks to inherit metadata from file frontmatter. When disabled, only top-level tasks inherit file metadata",
					),
				)
				.addToggle((toggle) =>
					toggle
						.setValue(
							settingTab.plugin.settings.fileMetadataInheritance
								.inheritFromFrontmatterForSubtasks,
						)
						.onChange(async (value) => {
							settingTab.plugin.settings.fileMetadataInheritance.inheritFromFrontmatterForSubtasks =
								value;
							settingTab.applySettingsUpdate();

							new ConfirmModal(settingTab.plugin, {
								title: t("Reindex"),
								message: t(
									"This change affects how tasks inherit metadata from files. Rebuild the index now so changes take effect immediately?",
								),
								confirmText: t("Reindex"),
								cancelText: t("Cancel"),
								onConfirm: async (confirmed: boolean) => {
									if (!confirmed) return;
									try {
										new Notice(
											t(
												"Clearing task cache and rebuilding index...",
											),
										);
										await settingTab.plugin.dataflowOrchestrator?.onSettingsChange(
											["parser"],
										);
										new Notice(
											t("Task index completely rebuilt"),
										);
									} catch (error) {
										console.error(
											"Failed to reindex after inheritance setting change:",
											error,
										);
										new Notice(
											t("Failed to reindex tasks"),
										);
									}
								},
							}).open();
						}),
				);
		}
	})();

	// ========================================
	// SECTION 2: File Task Configuration
	// ========================================
	(() => {
		const containerEl = fileContainer;
		const fileSourceSettings = settingTab.plugin.settings.fileSource;
		const fileTasksEnabled =
			scopeControls.fileTasksEnabled !== false &&
			Boolean(fileSourceSettings?.enabled);

		new Setting(containerEl)
			.setName(t("Enable file tasks"))
			.setDesc(
				t(
					"Allow Task Genius to recognize files as tasks using metadata, tags, or templates.",
				),
			)
			.addToggle((toggle) => {
				toggle.setValue(fileTasksEnabled);
				toggle.onChange((value) => {
					const controls = ensureScopeControls(
						settingTab.plugin.settings,
					);
					controls.fileTasksEnabled = value;

					if (!settingTab.plugin.settings.fileSource) {
						settingTab.plugin.settings.fileSource = {
							enabled: value,
						} as FileSourceConfiguration;
					} else {
						settingTab.plugin.settings.fileSource.enabled = value;
					}

					settingTab.applySettingsUpdate();
					updateFileBodyState(value);
					renderFileSourceSection();
					if (!value) {
						new Notice(
							t(
								"File task recognition disabled. Existing file tasks will be pruned shortly.",
							),
							6000,
						);
					}
				});
			});

		const fileBodyEl = containerEl.createDiv({
			cls: "tg-source-settings-body",
		});
		const updateFileBodyState = (enabled: boolean) => {
			fileBodyEl.classList.toggle("tg-source-disabled", !enabled);
		};
		updateFileBodyState(fileTasksEnabled);

		const fileSettingsContainer = fileBodyEl;

		const fileSourceContainerEl = fileSettingsContainer.createDiv(
			"file-source-container",
		);

		const renderFileSourceSection = () => {
			fileSourceContainerEl.empty();
			if (settingTab.plugin.settings.fileSource?.enabled) {
				createFileSourceSettings(
					fileSourceContainerEl,
					settingTab.plugin,
					{
						showEnableToggle: false,
					},
				);
			} else {
				fileSourceContainerEl.createDiv({
					cls: "setting-item-description",
					text: t(
						"File tasks are disabled. Enable them to configure recognition strategies.",
					),
				});
			}
		};

		renderFileSourceSection();
	})();

	const setActiveTaskSourcePanel = (panel: "inline" | "file") => {
		inlineContainer.toggleAttribute("hidden", panel !== "inline");
		fileContainer.toggleAttribute("hidden", panel !== "file");
		inlineSwitcherButton.classList.toggle("is-active", panel === "inline");
		fileSwitcherButton.classList.toggle("is-active", panel === "file");
	};

	const initialPanel: "inline" | "file" =
		scopeControls.inlineTasksEnabled === false &&
		scopeControls.fileTasksEnabled !== false
			? "file"
			: "inline";

	setActiveTaskSourcePanel(initialPanel);

	inlineSwitcherButton.addEventListener("click", () =>
		setActiveTaskSourcePanel("inline"),
	);
	fileSwitcherButton.addEventListener("click", () =>
		setActiveTaskSourcePanel("file"),
	);

	// ========================================
	// SECTION 5: Index Maintenance
	// ========================================
	new Setting(containerEl)
		.setName(t("Index Maintenance"))
		.setDesc(t("Tools for managing and rebuilding the task index"))
		.setHeading();

	new Setting(containerEl)
		.setName(t("Rebuild index"))
		.setDesc(
			t(
				"Force a complete rebuild of the task index. Use this if you notice missing or incorrect tasks.",
			),
		)
		.setClass("mod-warning")
		.addButton((button) => {
			button.setButtonText(t("Rebuild")).onClick(async () => {
				new ConfirmModal(settingTab.plugin, {
					title: t("Reindex"),
					message: t(
						"Are you sure you want to force reindex all tasks?",
					),
					confirmText: t("Reindex"),
					cancelText: t("Cancel"),
					onConfirm: async (confirmed: boolean) => {
						if (!confirmed) return;
						try {
							new Notice(
								t(
									"Clearing task cache and rebuilding index...",
								),
							);
							if (settingTab.plugin.dataflowOrchestrator) {
								await settingTab.plugin.dataflowOrchestrator.rebuild();
							}
							new Notice(t("Task index completely rebuilt"));
						} catch (error) {
							console.error(
								"Failed to force reindex tasks:",
								error,
							);
							new Notice(t("Failed to force reindex tasks"));
						}
					},
				}).open();
			});
		});
}

function ensureScopeControls(
	settings: TaskProgressBarSettings,
): FileFilterScopeControls {
	const scopeControls =
		settings.fileFilter.scopeControls ??
		(settings.fileFilter.scopeControls = {
			inlineTasksEnabled: true,
			fileTasksEnabled: settings.fileSource?.enabled ?? false,
		});

	if (scopeControls.inlineTasksEnabled === undefined) {
		scopeControls.inlineTasksEnabled = true;
	}
	if (scopeControls.fileTasksEnabled === undefined) {
		scopeControls.fileTasksEnabled = settings.fileSource?.enabled ?? false;
	}

	return scopeControls;
}
