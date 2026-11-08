import { t as settingsText } from "@/translations/helper";
import { Modal, setIcon, Setting } from "obsidian";
import { t } from "@/translations/helper";
import { allStatusCollections } from "@/common/task-status";
import { TaskProgressBarSettingTab } from "@/setting";
import { getTasksAPI } from "@/utils";
import {
	DEFAULT_SETTINGS,
	TaskStatusConfig,
	StatusCycle,
} from "@/common/setting-definition";
import * as taskStatusModule from "@/common/task-status";
import Sortable from "sortablejs";
import { ListConfigModal } from "@/components/ui/modals/ListConfigModal";

export function renderTaskStatusSettingsTab(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement,
) {
	new Setting(containerEl)
		.setName(t("Checkbox Status Settings"))
		.setDesc(t("Configure checkbox status settings"))
		.setHeading();

	// Check if Tasks plugin is installed and show compatibility warning
	const tasksAPI = getTasksAPI(settingTab.plugin);
	if (tasksAPI) {
		const warningBanner = containerEl.createDiv({
			cls: "tasks-compatibility-warning",
		});

		warningBanner.createEl("div", {
			cls: "tasks-warning-icon",
			text: "⚠️",
		});

		const warningContent = warningBanner.createDiv({
			cls: "tasks-warning-content",
		});

		warningContent.createEl("div", {
			cls: "tasks-warning-title",
			text: t("Tasks Plugin Detected"),
		});

		const warningText = warningContent.createEl("div", {
			cls: "tasks-warning-text",
		});

		warningText.createEl("span", {
			text: t(
				"Current status management and date management may conflict with the Tasks plugin. Please check the ",
			),
		});

		const compatibilityLink = warningText.createEl("a", {
			text: t("compatibility documentation"),
			href: "https://taskgenius.md/docs/compatibility",
		});
		compatibilityLink.setAttribute("target", "_blank");
		compatibilityLink.setAttribute("rel", "noopener noreferrer");

		warningText.createEl("span", {
			text: t(" for more information."),
		});
	}

	new Setting(containerEl)
		.setName(t("Auto complete parent checkbox"))
		.setDesc(
			t(
				"Toggle this to allow this plugin to auto complete parent checkbox when all child tasks are completed.",
			),
		)
		.addToggle((toggle) =>
			toggle
				.setValue(settingTab.plugin.settings.autoCompleteParent)
				.onChange(async (value) => {
					settingTab.plugin.settings.autoCompleteParent = value;
					settingTab.applySettingsUpdate();
				}),
		);

	new Setting(containerEl)
		.setName(t("Mark parent as 'In Progress' when partially complete"))
		.setDesc(
			t(
				"When some but not all child tasks are completed, mark the parent checkbox as 'In Progress'. Only works when 'Auto complete parent' is enabled.",
			),
		)
		.addToggle((toggle) =>
			toggle
				.setValue(
					settingTab.plugin.settings
						.markParentInProgressWhenPartiallyComplete,
				)
				.onChange(async (value) => {
					settingTab.plugin.settings.markParentInProgressWhenPartiallyComplete =
						value;
					settingTab.applySettingsUpdate();
				}),
		);

	// Checkbox Status Settings
	new Setting(containerEl)
		.setName(t("Checkbox Status Settings"))
		.setDesc(
			t(
				"Select a predefined checkbox status collection or customize your own",
			),
		)
		.setHeading()
		.addDropdown((dropdown) => {
			dropdown.addOption("custom", settingsText("Custom"));
			for (const statusCollection of allStatusCollections) {
				dropdown.addOption(statusCollection, statusCollection);
			}

			// Set default value to custom
			dropdown.setValue("custom");

			dropdown.onChange(async (value) => {
				if (value === "custom") {
					return;
				}

				// Confirm before applying the theme
				const modal = new Modal(settingTab.app);
				modal.titleEl.setText(settingsText("Apply {{value0}} Theme?", { interpolation: { value0: String(value) } }));

				const content = modal.contentEl.createDiv();
				content.setText(
					settingsText("This will override your current checkbox status settings with the {{value0}} theme. Do you want to continue?", { interpolation: { value0: String(value) } }),
				);

				const buttonContainer = modal.contentEl.createDiv({
					cls: "tg-modal-button-container modal-button-container",
				});

				const cancelButton = buttonContainer.createEl("button");
				cancelButton.setText(t("Cancel"));
				cancelButton.addEventListener("click", () => {
					dropdown.setValue("custom");
					modal.close();
				});

				const confirmButton = buttonContainer.createEl("button");
				confirmButton.setText(t("Apply Theme"));
				confirmButton.addClass("mod-cta");
				confirmButton.addEventListener("click", async () => {
					modal.close();

					// Apply the selected theme's task statuses
					try {
						// Get the function based on the selected theme
						const functionName =
							value.toLowerCase() + "SupportedStatuses";

						// Use type assertion for the dynamic function access
						const getStatuses = (taskStatusModule as any)[
							functionName
						];

						if (typeof getStatuses === "function") {
							const statuses = getStatuses();

							// Update cycle and marks
							const cycle =
								settingTab.plugin.settings.taskStatusCycle;
							const marks =
								settingTab.plugin.settings.taskStatusMarks;
							const excludeMarks =
								settingTab.plugin.settings
									.excludeMarksFromCycle;

							// Clear existing cycle, marks and excludeMarks
							cycle.length = 0;
							Object.keys(marks).forEach(
								(key) => delete marks[key],
							);
							excludeMarks.length = 0;

							// Add new statuses to cycle and marks
							for (const [symbol, name, type] of statuses) {
								const realName = (name as string)
									.split("/")[0]
									.trim();
								// Add to cycle if not already included
								if (!cycle.includes(realName)) {
									cycle.push(realName);
								}

								// Add to marks
								marks[realName] = symbol;

								// Add to excludeMarks if not space or x
								if (symbol !== " " && symbol !== "x") {
									excludeMarks.push(realName);
								}
							}

							// Also update the main taskStatuses object based on the theme
							const statusMap: Record<string, string[]> = {
								completed: [],
								inProgress: [],
								abandoned: [],
								notStarted: [],
								planned: [],
							};
							for (const [symbol, _, type] of statuses) {
								if (type in statusMap) {
									statusMap[
										type as keyof typeof statusMap
									].push(symbol);
								}
							}
							// Corrected loop and assignment for TaskStatusConfig here too
							for (const type of Object.keys(statusMap) as Array<
								keyof TaskStatusConfig
							>) {
								if (
									type in
										settingTab.plugin.settings
											.taskStatuses &&
									statusMap[type] &&
									statusMap[type].length > 0
								) {
									settingTab.plugin.settings.taskStatuses[
										type
									] = statusMap[type].join("|");
								}
							}

							// Save settings and refresh the display
							settingTab.applySettingsUpdate();
							settingTab.display();
						}
					} catch (error) {
						console.error(
							"Failed to apply checkbox status theme:",
							error,
						);
					}
				});

				modal.open();
			});
		});

	/**
	 * Helper function to create a status symbol configuration button
	 * @param statusKey - The key in taskStatuses config (e.g., "completed")
	 * @param config - Configuration for the status button
	 */
	const createStatusConfigButton = (
		statusKey: keyof TaskStatusConfig,
		config: {
			title: string;
			description: string;
			placeholder: string;
			icon: string;
			// Special handling: Not Started needs to preserve spaces
			preserveEmpty?: boolean;
		},
	) => {
		// Create icon fragment
		const statusIcon = createFragment();
		statusIcon.createEl(
			"span",
			{
				cls: "tg-status-icon",
			},
			(el) => {
				setIcon(el, config.icon);
			},
		);

		statusIcon.createEl(
			"span",
			{
				cls: "tg-status-text",
			},
			(el) => {
				el.setText(t(config.title));
			},
		);

		// Create setting with button
		new Setting(containerEl)
			.setName(statusIcon)
			.setDesc(t(config.description))
			.addButton((button) => {
				const getStatusSymbols = () => {
					const value =
						settingTab.plugin.settings.taskStatuses[statusKey];
					const symbols = value.split("|");
					// Not Started needs to preserve spaces, others filter empty strings
					return config.preserveEmpty
						? symbols
						: symbols.filter((v) => v.length > 0);
				};

				const updateButtonText = () => {
					const symbols = getStatusSymbols();
					if (symbols.length === 0) {
						button.setButtonText(t("Configure Symbols"));
					} else {
						button.setButtonText(
							t("{{count}} symbol(s) configured", {
								interpolation: {
									count: symbols.length.toString(),
								},
							}),
						);
					}
				};

				updateButtonText();
				button.onClick(() => {
					new ListConfigModal(settingTab.plugin, {
						title: t("{{status}} Task Symbols", {
							interpolation: { status: t(config.title) },
						}),
						description: t(config.description),
						placeholder: config.placeholder,
						values: getStatusSymbols(),
						onSave: async (values) => {
							settingTab.plugin.settings.taskStatuses[statusKey] =
								values.join("|") ||
								DEFAULT_SETTINGS.taskStatuses[statusKey];
							await settingTab.applySettingsUpdate();
							updateButtonText();

							// Update Task Genius Icon Manager
							if (settingTab.plugin.taskGeniusIconManager) {
								settingTab.plugin.taskGeniusIconManager.update();
							}
						},
					}).open();
				});
			});
	};

	// Configure Completed status
	createStatusConfigButton("completed", {
		title: settingsText("Completed"),
		description:
			settingsText("Configure symbols that represent completed tasks in square brackets"),
		placeholder: "x",
		icon: "completed",
	});

	// Configure Planned status
	createStatusConfigButton("planned", {
		title: settingsText("Planned"),
		description:
			settingsText("Configure symbols that represent planned tasks in square brackets"),
		placeholder: "?",
		icon: "planned",
	});

	// Configure In Progress status
	createStatusConfigButton("inProgress", {
		title: settingsText("In Progress"),
		description:
			settingsText("Configure symbols that represent tasks in progress in square brackets"),
		placeholder: "/",
		icon: "inProgress",
	});

	// Configure Abandoned status
	createStatusConfigButton("abandoned", {
		title: settingsText("Abandoned"),
		description:
			settingsText("Configure symbols that represent abandoned tasks in square brackets"),
		placeholder: "-",
		icon: "abandoned",
	});

	// Configure Not Started status (preserves empty spaces)
	createStatusConfigButton("notStarted", {
		title: settingsText("Not Started"),
		description:
			settingsText('Configure symbols that represent not started tasks in square brackets. Default is space " "'),
		placeholder: " ",
		icon: "notStarted",
		preserveEmpty: true,
	});

	new Setting(containerEl)
		.setName(t("Count other statuses as"))
		.setDesc(
			t(
				'Select the status to count other statuses as. Default is "Not Started".',
			),
		)
		.addDropdown((dropdown) => {
			dropdown.addOption("notStarted", settingsText("Not Started"));
			dropdown.addOption("abandoned", settingsText("Abandoned"));
			dropdown.addOption("planned", settingsText("Planned"));
			dropdown.addOption("completed", settingsText("Completed"));
			dropdown.addOption("inProgress", settingsText("In Progress"));
			dropdown.setValue(
				settingTab.plugin.settings.countOtherStatusesAs || "notStarted",
			);
			dropdown.onChange((value) => {
				settingTab.plugin.settings.countOtherStatusesAs = value;
				settingTab.applySettingsUpdate();
			});
		});

	// Task Counting Settings
	new Setting(containerEl)
		.setName(t("Task Counting Settings"))
		.setDesc(t("Configure which task markers to count or exclude"))
		.setHeading();

	new Setting(containerEl)
		.setName(t("Exclude specific task markers"))
		.setDesc(
			t('Specify task markers to exclude from counting. Example: "?|/"'),
		)
		.addText((text) =>
			text
				.setPlaceholder("")
				.setValue(settingTab.plugin.settings.excludeTaskMarks)
				.onChange(async (value) => {
					settingTab.plugin.settings.excludeTaskMarks = value;
					settingTab.applySettingsUpdate();
				}),
		);

	new Setting(containerEl)
		.setName(t("Only count specific task markers"))
		.setDesc(t("Toggle this to only count specific task markers"))
		.addToggle((toggle) =>
			toggle
				.setValue(settingTab.plugin.settings.useOnlyCountMarks)
				.onChange(async (value) => {
					settingTab.plugin.settings.useOnlyCountMarks = value;
					settingTab.applySettingsUpdate();

					setTimeout(() => {
						settingTab.display();
					}, 200);
				}),
		);

	if (settingTab.plugin.settings.useOnlyCountMarks) {
		new Setting(containerEl)
			.setName(t("Specific task markers to count"))
			.setDesc(
				t('Specify which task markers to count. Example: "x|X|>|/"'),
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.onlyCountTaskMarks)
					.setValue(settingTab.plugin.settings.onlyCountTaskMarks)
					.onChange(async (value) => {
						if (value.length === 0) {
							settingTab.plugin.settings.onlyCountTaskMarks =
								DEFAULT_SETTINGS.onlyCountTaskMarks;
						} else {
							settingTab.plugin.settings.onlyCountTaskMarks =
								value;
						}
						settingTab.applySettingsUpdate();
					}),
			);
	}

	// Check Switcher section
	new Setting(containerEl).setName(t("Checkbox Switcher")).setHeading();

	new Setting(containerEl)
		.setName(t("Enable checkbox status switcher"))
		.setDesc(
			t(
				"Enable/disable the ability to cycle through task states by clicking.",
			),
		)
		.addToggle((toggle) => {
			toggle
				.setValue(settingTab.plugin.settings.enableTaskStatusSwitcher)
				.onChange(async (value) => {
					settingTab.plugin.settings.enableTaskStatusSwitcher = value;
					settingTab.applySettingsUpdate();

					setTimeout(() => {
						settingTab.display();
					}, 200);
				});
		});

	if (settingTab.plugin.settings.enableTaskStatusSwitcher) {
		new Setting(containerEl)
			.setName(t("Show indicator with checkbox"))
			.setDesc(
				t(
					"Show the status indicator directly next to the checkbox. When enabled, a indicator will be shown next to the checkbox.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						settingTab.plugin.settings.enableIndicatorWithCheckbox,
					)
					.onChange(async (value) => {
						settingTab.plugin.settings.enableIndicatorWithCheckbox =
							value;
						settingTab.applySettingsUpdate();
					}),
			);
	}

	if (settingTab.plugin.settings.enableTaskStatusSwitcher) {
		new Setting(containerEl)
			.setName(t("Task mark display style"))
			.setDesc(
				t(
					"Choose how task marks are displayed: default checkboxes, custom text marks, or Task Genius icons.",
				),
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("default", t("Default checkboxes"));
				dropdown.addOption("textmarks", t("Custom text marks"));
				dropdown.addOption("icons", t("Task Genius icons"));

				// Determine current value based on existing settings
				let currentValue = "default";
				if (settingTab.plugin.settings.enableTaskGeniusIcons) {
					currentValue = "icons";
				} else if (settingTab.plugin.settings.enableCustomTaskMarks) {
					currentValue = "textmarks";
				}

				dropdown.setValue(currentValue);

				dropdown.onChange(async (value) => {
					// Reset all options first
					settingTab.plugin.settings.enableCustomTaskMarks = false;
					settingTab.plugin.settings.enableTaskGeniusIcons = false;

					// Set the selected option
					if (value === "textmarks") {
						settingTab.plugin.settings.enableCustomTaskMarks = true;
					} else if (value === "icons") {
						settingTab.plugin.settings.enableTaskGeniusIcons = true;
					}

					settingTab.applySettingsUpdate();

					// Update Task Genius Icon Manager
					if (settingTab.plugin.taskGeniusIconManager) {
						settingTab.plugin.taskGeniusIconManager.update();
					}

					// Refresh display to show/hide dependent options
					setTimeout(() => {
						settingTab.display();
					}, 200);
				});
			});

		// Show text mark source mode option only when custom text marks are enabled
		if (settingTab.plugin.settings.enableCustomTaskMarks) {
			new Setting(containerEl)
				.setName(t("Enable text mark in source mode"))
				.setDesc(
					t(
						"Make the text mark in source mode follow the checkbox status cycle when clicked.",
					),
				)
				.addToggle((toggle) => {
					toggle
						.setValue(
							settingTab.plugin.settings
								.enableTextMarkInSourceMode,
						)
						.onChange(async (value) => {
							settingTab.plugin.settings.enableTextMarkInSourceMode =
								value;
							settingTab.applySettingsUpdate();
						});
				});
		}
	}

	new Setting(containerEl)
		.setName(t("Enable cycle complete status"))
		.setDesc(
			t(
				"Enable/disable the ability to automatically cycle through task states when pressing a mark.",
			),
		)
		.addToggle((toggle) => {
			toggle
				.setValue(settingTab.plugin.settings.enableCycleCompleteStatus)
				.onChange(async (value) => {
					settingTab.plugin.settings.enableCycleCompleteStatus =
						value;
					settingTab.applySettingsUpdate();

					setTimeout(() => {
						settingTab.display();
					}, 200);
				});
		});

	if (settingTab.plugin.settings.enableCycleCompleteStatus) {
		// Initialize statusCycles from legacy settings if needed
		if (
			!settingTab.plugin.settings.statusCycles ||
			settingTab.plugin.settings.statusCycles.length === 0
		) {
			settingTab.plugin.settings.statusCycles = [
				{
					id: `cycle-${Date.now()}`,
					name: t("Default Cycle"),
					description: t("Migrated from legacy settings"),
					priority: 0,
					cycle: [...settingTab.plugin.settings.taskStatusCycle],
					marks: { ...settingTab.plugin.settings.taskStatusMarks },
					enabled: true,
				},
			];
			settingTab.applySettingsUpdate();
		}

		new Setting(containerEl)
			.setName(t("Status Cycles Management"))
			.setDesc(
				t(
					"Configure multiple status cycles with different workflows. You can apply preset themes or create custom cycles.",
				),
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("custom", settingsText("Custom"));
				for (const statusCollection of allStatusCollections) {
					dropdown.addOption(statusCollection, statusCollection);
				}

				// Set default value to custom
				dropdown.setValue("custom");

				dropdown.onChange(async (value) => {
					if (value === "custom") {
						return;
					}

					// Confirm before applying the theme
					const modal = new Modal(settingTab.app);
					modal.titleEl.setText(settingsText("Add {{value0}} Theme as New Cycle?", { interpolation: { value0: String(value) } }));

					const content = modal.contentEl.createDiv();
					content.setText(
						settingsText("This will add a new status cycle based on the {{value0}} theme.", { interpolation: { value0: String(value) } }),
					);

					const buttonContainer = modal.contentEl.createDiv({
						cls: "tg-modal-button-container modal-button-container",
					});

					const cancelButton = buttonContainer.createEl("button");
					cancelButton.setText(t("Cancel"));
					cancelButton.addEventListener("click", () => {
						dropdown.setValue("custom");
						modal.close();
					});

					const confirmButton = buttonContainer.createEl("button");
					confirmButton.setText(t("Add Cycle"));
					confirmButton.addClass("mod-cta");
					confirmButton.addEventListener("click", async () => {
						modal.close();

						// Add a new cycle based on the selected theme
						try {
							// Get the function based on the selected theme
							const functionName =
								value.toLowerCase() + "SupportedStatuses";

							// Use type assertion for the dynamic function access
							const getStatuses = (taskStatusModule as any)[
								functionName
							];

							if (typeof getStatuses === "function") {
								const statuses = getStatuses();

								// Create new cycle arrays
								const newCycle: string[] = [];
								const newMarks: Record<string, string> = {};

								// Add new statuses to cycle and marks
								for (const [symbol, name, type] of statuses) {
									const realName = (name as string)
										.split("/")[0]
										.trim();
									// Add to cycle if not already included
									if (!newCycle.includes(realName)) {
										newCycle.push(realName);
									}

									// Add to marks
									newMarks[realName] = symbol;
								}

								// Create the new status cycle
								const newStatusCycle: StatusCycle = {
									id: `cycle-${Date.now()}`,
									name: value,
									description: settingsText("{{value0}} theme workflow", { interpolation: { value0: String(value) } }),
									priority:
										settingTab.plugin.settings.statusCycles!
											.length,
									cycle: newCycle,
									marks: newMarks,
									enabled: true,
								};

								// Add to statusCycles array
								settingTab.plugin.settings.statusCycles!.push(
									newStatusCycle,
								);

								// Also update the main taskStatuses object based on the theme
								const statusMap: Record<string, string[]> = {
									completed: [],
									inProgress: [],
									abandoned: [],
									notStarted: [],
									planned: [],
								};
								for (const [symbol, _, type] of statuses) {
									if (type in statusMap) {
										statusMap[
											type as keyof typeof statusMap
										].push(symbol);
									}
								}
								// Corrected loop and assignment for TaskStatusConfig here too
								for (const type of Object.keys(
									statusMap,
								) as Array<keyof TaskStatusConfig>) {
									if (
										type in
											settingTab.plugin.settings
												.taskStatuses &&
										statusMap[type] &&
										statusMap[type].length > 0
									) {
										settingTab.plugin.settings.taskStatuses[
											type
										] = statusMap[type].join("|");
									}
								}

								// Save settings and refresh the display
								settingTab.applySettingsUpdate();
								settingTab.display();
							}
						} catch (error) {
							console.error(
								"Failed to apply checkbox status theme:",
								error,
							);
						}
					});

					modal.open();
				});
			});

		// Render the unified multi-cycle management interface
		renderMultiCycleManagement(settingTab, containerEl);
	}

	// Auto Date Manager Settings
	new Setting(containerEl)
		.setName(t("Auto Date Manager"))
		.setDesc(
			t("Automatically manage dates based on checkbox status changes"),
		)
		.setHeading();

	new Setting(containerEl)
		.setName(t("Enable auto date manager"))
		.setDesc(
			t(
				"Toggle this to enable automatic date management when checkbox status changes. Dates will be added/removed based on your preferred metadata format (Tasks emoji format or Dataview format).",
			),
		)
		.addToggle((toggle) =>
			toggle
				.setValue(settingTab.plugin.settings.autoDateManager.enabled)
				.onChange(async (value) => {
					settingTab.plugin.settings.autoDateManager.enabled = value;
					settingTab.applySettingsUpdate();
					setTimeout(() => {
						settingTab.display();
					}, 200);
				}),
		);

	if (settingTab.plugin.settings.autoDateManager.enabled) {
		new Setting(containerEl)
			.setName(t("Manage completion dates"))
			.setDesc(
				t(
					"Automatically add completion dates when tasks are marked as completed, and remove them when changed to other statuses.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						settingTab.plugin.settings.autoDateManager
							.manageCompletedDate,
					)
					.onChange(async (value) => {
						settingTab.plugin.settings.autoDateManager.manageCompletedDate =
							value;
						settingTab.applySettingsUpdate();
					}),
			);

		new Setting(containerEl)
			.setName(t("Manage start dates"))
			.setDesc(
				t(
					"Automatically add start dates when tasks are marked as in progress, and remove them when changed to other statuses.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						settingTab.plugin.settings.autoDateManager
							.manageStartDate,
					)
					.onChange(async (value) => {
						settingTab.plugin.settings.autoDateManager.manageStartDate =
							value;
						settingTab.applySettingsUpdate();
					}),
			);

		new Setting(containerEl)
			.setName(t("Manage cancelled dates"))
			.setDesc(
				t(
					"Automatically add cancelled dates when tasks are marked as abandoned, and remove them when changed to other statuses.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						settingTab.plugin.settings.autoDateManager
							.manageCancelledDate,
					)
					.onChange(async (value) => {
						settingTab.plugin.settings.autoDateManager.manageCancelledDate =
							value;
						settingTab.applySettingsUpdate();
					}),
			);
	}
}

/**
 * Render the unified multi-cycle management interface
 * This replaces the old single-cycle UI and integrates all cycle management features
 */
function renderMultiCycleManagement(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement,
) {
	// Quick Templates section - buttons to add preset cycles
	new Setting(containerEl)
		.setName(t("Quick Templates"))
		.setDesc(t("Quickly add common workflow patterns"))
		.addButton((button) => {
			button
				.setButtonText(t("Add Simple Cycle"))
				.setTooltip(t("TODO ↔ DONE"))
				.onClick(() => {
					settingTab.plugin.settings.statusCycles!.push({
						id: `cycle-${Date.now()}`,
						name: t("Simple"),
						description: t("Quick TODO/DONE cycle"),
						priority:
							settingTab.plugin.settings.statusCycles!.length,
						cycle: ["TODO", "DONE"],
						marks: {
							TODO: " ",
							DONE: "x",
						},
						enabled: true,
					});
					settingTab.applySettingsUpdate();
					setTimeout(() => settingTab.display(), 200);
				});
		})
		.addButton((button) => {
			button
				.setButtonText(t("Add Detailed Cycle"))
				.setTooltip(t("TODO → PLAN → IN PROGRESS → DONE"))
				.onClick(() => {
					settingTab.plugin.settings.statusCycles!.push({
						id: `cycle-${Date.now()}`,
						name: t("Detailed"),
						description: t("Full project workflow"),
						priority:
							settingTab.plugin.settings.statusCycles!.length,
						cycle: ["TODO", "PLAN", "IN PROGRESS", "DONE"],
						marks: {
							TODO: " ",
							PLAN: "?",
							"IN PROGRESS": "/",
							DONE: "x",
						},
						enabled: true,
					});
					settingTab.applySettingsUpdate();
					setTimeout(() => settingTab.display(), 200);
				});
		})
		.addButton((button) => {
			button
				.setButtonText(t("Add Number Cycle"))
				.setTooltip(t("1 → 2 → 3 → 4 → 5"))
				.onClick(() => {
					settingTab.plugin.settings.statusCycles!.push({
						id: `cycle-${Date.now()}`,
						name: t("Progress Tracker"),
						description: t("Numeric progress tracking"),
						priority:
							settingTab.plugin.settings.statusCycles!.length,
						cycle: ["1", "2", "3", "4", "5"],
						marks: {
							"1": "1",
							"2": "2",
							"3": "3",
							"4": "4",
							"5": "5",
						},
						enabled: true,
					});
					settingTab.applySettingsUpdate();
					setTimeout(() => settingTab.display(), 200);
				});
		});

	// Container for all cycles with sortable support
	const cyclesContainer = containerEl.createDiv({
		cls: "status-cycles-container",
	});

	// Sort cycles by priority
	const sortedCycles = [...settingTab.plugin.settings.statusCycles!].sort(
		(a, b) => a.priority - b.priority,
	);

	// Render each cycle
	sortedCycles.forEach((cycle, index) => {
		const cycleCard = cyclesContainer.createDiv({
			cls: "status-cycle-card",
		});
		cycleCard.setAttribute("data-cycle-id", cycle.id);

		// Card header with collapse button, up/down buttons, title and controls
		const cardHeader = cycleCard.createDiv({
			cls: "status-cycle-header",
		});

		// Collapse button
		const collapseButton = cardHeader.createDiv({
			cls: "status-cycle-collapse-button",
		});
		setIcon(collapseButton, "chevron-down");
		collapseButton.setAttribute("title", t("Collapse/Expand"));
		collapseButton.addEventListener("click", () => {
			cycleCard.classList.toggle("collapsed");
			collapseButton.empty();
			setIcon(
				collapseButton,
				cycleCard.classList.contains("collapsed")
					? "chevron-right"
					: "chevron-down",
			);
		});

		// Up/Down buttons container
		const upDownButtons = cardHeader.createDiv({
			cls: "status-cycle-updown-buttons",
		});

		const upButton = upDownButtons.createDiv({
			cls: "status-cycle-button",
		});
		setIcon(upButton, "chevron-up");
		upButton.setAttribute("title", t("Move up"));
		if (index === 0) {
			upButton.classList.add("disabled");
		} else {
			upButton.addEventListener("click", () => {
				const cycles = settingTab.plugin.settings.statusCycles!;
				const currentIndex = cycles.findIndex((c) => c.id === cycle.id);
				if (currentIndex > 0) {
					// Swap priorities
					const temp = cycles[currentIndex - 1].priority;
					cycles[currentIndex - 1].priority =
						cycles[currentIndex].priority;
					cycles[currentIndex].priority = temp;
					settingTab.applySettingsUpdate();
					setTimeout(() => settingTab.display(), 200);
				}
			});
		}

		const downButton = upDownButtons.createDiv({
			cls: "status-cycle-button",
		});
		setIcon(downButton, "chevron-down");
		downButton.setAttribute("title", t("Move down"));
		if (index === sortedCycles.length - 1) {
			downButton.classList.add("disabled");
		} else {
			downButton.addEventListener("click", () => {
				const cycles = settingTab.plugin.settings.statusCycles!;
				const currentIndex = cycles.findIndex((c) => c.id === cycle.id);
				if (currentIndex < cycles.length - 1) {
					// Swap priorities
					const temp = cycles[currentIndex + 1].priority;
					cycles[currentIndex + 1].priority =
						cycles[currentIndex].priority;
					cycles[currentIndex].priority = temp;
					settingTab.applySettingsUpdate();
					setTimeout(() => settingTab.display(), 200);
				}
			});
		}

		// Content-editable title
		const titleElement = cardHeader.createDiv({
			cls: "status-cycle-title",
		});
		titleElement.setAttribute("contenteditable", "true");
		titleElement.textContent = cycle.name;
		titleElement.addEventListener("blur", () => {
			const newName = titleElement.textContent?.trim() || "Unnamed Cycle";
			if (newName !== cycle.name) {
				cycle.name = newName;
				settingTab.applySettingsUpdate();
			}
		});
		titleElement.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				titleElement.blur();
			}
		});

		// Control buttons (toggle, copy, delete)
		const controlsContainer = cardHeader.createDiv({
			cls: "status-cycle-controls",
		});

		const headerSetting = new Setting(controlsContainer)
			.addToggle((toggle) => {
				toggle
					.setValue(cycle.enabled)
					.setTooltip(t("Enable/disable this cycle"))
					.onChange(async (value) => {
						cycle.enabled = value;
						settingTab.applySettingsUpdate();
						setTimeout(() => settingTab.display(), 200);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("copy")
					.setTooltip(t("Copy this cycle"))
					.onClick(() => {
						// Create a deep copy of the cycle
						const copiedCycle: StatusCycle = {
							id: `cycle-${Date.now()}`,
							name: `${cycle.name} (Copy)`,
							description: cycle.description,
							priority:
								settingTab.plugin.settings.statusCycles!.length,
							cycle: [...cycle.cycle],
							marks: { ...cycle.marks },
							enabled: cycle.enabled,
							color: cycle.color,
							icon: cycle.icon,
						};
						settingTab.plugin.settings.statusCycles!.push(
							copiedCycle,
						);
						settingTab.applySettingsUpdate();
						setTimeout(() => settingTab.display(), 200);
					});
			})
			.addExtraButton((button) => {
				button
					.setIcon("trash")
					.setTooltip(t("Delete this cycle"))
					.onClick(() => {
						const cycleIndex =
							settingTab.plugin.settings.statusCycles!.findIndex(
								(c) => c.id === cycle.id,
							);
						if (cycleIndex !== -1) {
							settingTab.plugin.settings.statusCycles!.splice(
								cycleIndex,
								1,
							);
							settingTab.applySettingsUpdate();
							setTimeout(() => settingTab.display(), 200);
						}
					});
			});

		// Cycle details
		const cardBody = cycleCard.createDiv({
			cls: "status-cycle-body",
		});

		// Status list heading
		new Setting(cardBody)
			.setName(t("Status sequence"))
			.setDesc(t("Define the statuses in cycling order"))
			.setHeading();

		// Status list container
		const statusListContainer = cardBody.createDiv({
			cls: "status-list-container",
		});

		// Render each status in the cycle
		cycle.cycle.forEach((statusName, statusIndex) => {
			const statusRow = statusListContainer.createDiv({
				cls: "status-row",
			});
			statusRow.setAttribute("data-status-name", statusName);

			// Add drag handle for status
			const statusDragHandle = statusRow.createDiv({
				cls: "status-drag-handle",
			});
			setIcon(statusDragHandle, "grip-vertical");
			statusDragHandle.setAttribute("title", t("Drag to reorder"));

			const statusSetting = new Setting(statusRow);
			statusSetting
				.setName(`#${statusIndex + 1}`)
				.addText((text) => {
					text.setValue(statusName)
						.setPlaceholder(t("Status name"))
						.onChange((value) => {
							const oldName = cycle.cycle[statusIndex];
							cycle.cycle[statusIndex] = value;

							// Update marks
							if (cycle.marks[oldName]) {
								cycle.marks[value] = cycle.marks[oldName];
								delete cycle.marks[oldName];
							}

							settingTab.applySettingsUpdate();
						});
					text.inputEl.style.width = "150px";
				})
				.addText((text) => {
					text.setValue(cycle.marks[statusName] || " ")
						.setPlaceholder(t("Mark"))
						.onChange((value) => {
							cycle.marks[statusName] = value.charAt(0) || " ";
							settingTab.applySettingsUpdate();
						});
					text.inputEl.style.width = "50px";
					text.inputEl.maxLength = 1;
				})
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip(t("Remove this status"))
						.onClick(() => {
							cycle.cycle.splice(statusIndex, 1);
							delete cycle.marks[statusName];
							settingTab.applySettingsUpdate();
							setTimeout(() => settingTab.display(), 200);
						});
				});
		});

		// Initialize Sortable.js for status reordering
		new Sortable(statusListContainer, {
			animation: 150,
			handle: ".status-drag-handle",
			draggable: ".status-row",
			ghostClass: "status-row-ghost",
			chosenClass: "status-row-chosen",
			dragClass: "status-row-drag",
			filter: ".setting-item", // Exclude the add button
			onEnd: (evt) => {
				if (evt.oldIndex !== undefined && evt.newIndex !== undefined) {
					// Reorder the status array
					const movedStatus = cycle.cycle.splice(evt.oldIndex, 1)[0];
					cycle.cycle.splice(evt.newIndex, 0, movedStatus);

					settingTab.applySettingsUpdate();
					setTimeout(() => settingTab.display(), 200);
				}
			},
		});

		// Add status button
		new Setting(statusListContainer).addButton((button) => {
			button.setButtonText(t("+ Add Status")).onClick(() => {
				const newStatus = `STATUS_${cycle.cycle.length + 1}`;
				cycle.cycle.push(newStatus);
				cycle.marks[newStatus] = " ";
				settingTab.applySettingsUpdate();
				setTimeout(() => settingTab.display(), 200);
			});
		});
	});

	// Add new custom cycle button
	new Setting(cyclesContainer).addButton((button) => {
		button
			.setButtonText(t("+ Add Custom Cycle"))
			.setCta()
			.onClick(() => {
				settingTab.plugin.settings.statusCycles!.push({
					id: `cycle-${Date.now()}`,
					name: t("Custom Cycle"),
					description: "",
					priority: settingTab.plugin.settings.statusCycles!.length,
					cycle: ["TODO", "DONE"],
					marks: {
						TODO: " ",
						DONE: "x",
					},
					enabled: true,
				});
				settingTab.applySettingsUpdate();
				setTimeout(() => settingTab.display(), 200);
			});
	});
}
