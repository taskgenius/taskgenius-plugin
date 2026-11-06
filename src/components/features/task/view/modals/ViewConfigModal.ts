import {
	App,
	Modal,
	Setting,
	TextComponent,
	ButtonComponent,
	Notice,
	moment,
	setIcon,
} from "obsidian";
import { t } from "@/translations/helper";
import {
	CalendarSpecificConfig,
	KanbanSpecificConfig,
	GanttSpecificConfig,
	TwoColumnSpecificConfig,
	SpecificViewConfig,
	ViewConfig,
	ViewFilterRule,
	ViewMode,
	ForecastSpecificConfig,
	QuadrantSpecificConfig,
	DateExistType,
	PropertyExistType,
	DEFAULT_SETTINGS,
	SortCriterion,
} from "@/common/setting-definition";
import TaskProgressBarPlugin from "@/index";
import { FolderSuggest } from "@/components/ui/inputs/AutoComplete";
import { attachIconMenu } from "@/components/ui/menus/IconMenu";
import { ConfirmModal } from "@/components/ui/modals/ConfirmModal";
import {
	TaskFilterComponent,
	RootFilterState,
} from "@/components/features/task/filter/ViewTaskFilter";

export class ViewConfigModal extends Modal {
	private viewConfig: ViewConfig;
	private viewFilterRule: ViewFilterRule;
	private plugin: TaskProgressBarPlugin;
	private isCreate: boolean;
	private isCopyMode = false;
	private sourceViewId: string | null = null;
	private copySourceIdentifier: string | null = null;
	private onSave: (config: ViewConfig, rules: ViewFilterRule) => void;
	private originalViewConfig: string;
	private originalViewFilterRule: string;
	private hasChanges = false;

	// Advanced filter component
	private taskFilterComponent: TaskFilterComponent | null = null;
	private advancedFilterContainer: HTMLElement | null = null;
	private filterChangeHandler:
		| ((filterState: RootFilterState, leafId?: string) => void)
		| null = null;

	// References to input components to read values later
	private nameInput: TextComponent;
	private iconInput: TextComponent;

	// TwoColumnView specific settings
	private taskPropertyKeyInput: TextComponent;
	private leftColumnTitleInput: TextComponent;
	private rightColumnTitleInput: TextComponent;
	private multiSelectTextInput: TextComponent;
	private emptyStateTextInput: TextComponent;

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		initialViewConfig: ViewConfig | null, // Null for creating
		initialFilterRule: ViewFilterRule | null, // Null for creating
		onSave: (config: ViewConfig, rules: ViewFilterRule) => void,
		sourceViewForCopy?: ViewConfig, // 新增：可选的源视图用于拷贝
		sourceViewIdentifierForCopy?: string, // 新增：可选的源视图标识
	) {
		super(app);
		this.plugin = plugin;
		this.isCreate = initialViewConfig === null;

		const resolvedCopySource =
			sourceViewForCopy ??
			(sourceViewIdentifierForCopy
				? this.plugin.settings.viewConfiguration.find(
						(view) => view.id === sourceViewIdentifierForCopy,
					)
				: undefined);

		this.isCopyMode =
			sourceViewForCopy !== undefined ||
			sourceViewIdentifierForCopy !== undefined;

		this.sourceViewId =
			resolvedCopySource?.id ?? sourceViewIdentifierForCopy ?? null;
		this.copySourceIdentifier =
			sourceViewIdentifierForCopy ?? resolvedCopySource?.id ?? null;

		if (this.isCreate) {
			const newId = `custom_${Date.now()}`;

			if (this.isCopyMode && resolvedCopySource) {
				// 拷贝模式：基于源视图创建新视图
				this.viewConfig = {
					...JSON.parse(JSON.stringify(resolvedCopySource)), // 深拷贝源视图配置
					id: newId, // 使用新的ID
					name: t("Copy of ") + resolvedCopySource.name, // 修改名称
					type: "custom", // 确保类型为自定义
				};

				// Apply default region if not set (for backward compatibility)
				if (!this.viewConfig.region) {
					const bottomViewIds = [
						"habit",
						"calendar",
						"gantt",
						"kanban",
					];
					this.viewConfig.region = bottomViewIds.includes(
						resolvedCopySource.id,
					)
						? "bottom"
						: "top";
				}

				// 如果源视图有过滤规则，也拷贝过来
				this.viewFilterRule = resolvedCopySource.filterRules
					? JSON.parse(JSON.stringify(resolvedCopySource.filterRules))
					: initialFilterRule || {};
			} else {
				// 普通创建模式
				this.viewConfig = {
					id: newId,
					name: t("New custom view"),
					icon: "list-plus",
					type: "custom",
					visible: true,
					hideCompletedAndAbandonedTasks: false,
					filterBlanks: false,
					sortCriteria: [], // Initialize sort criteria as an empty array
					region: "top", // Default new custom views to top
				};
				this.viewFilterRule = initialFilterRule || {}; // Start with empty rules or provided defaults
			}
		} else {
			// Deep copy to avoid modifying original objects until save
			this.viewConfig = JSON.parse(JSON.stringify(initialViewConfig));
			this.viewFilterRule = JSON.parse(
				JSON.stringify(initialFilterRule || {}),
			);

			// Make sure sortCriteria exists
			if (!this.viewConfig.sortCriteria) {
				this.viewConfig.sortCriteria = [];
			}

			// Apply default region if not set (for backward compatibility)
			if (!this.viewConfig.region) {
				const bottomViewIds = ["habit", "calendar", "gantt", "kanban"];
				this.viewConfig.region = bottomViewIds.includes(
					this.viewConfig.id,
				)
					? "bottom"
					: "top";
			}
		}

		if (this.isCopyMode) {
			this.applyTwoColumnPresetIfNeeded(resolvedCopySource);
		}

		// Store original values for change detection
		this.originalViewConfig = JSON.stringify(this.viewConfig);
		this.originalViewFilterRule = JSON.stringify(this.viewFilterRule);

		this.onSave = onSave;
	}

	private applyTwoColumnPresetIfNeeded(sourceConfig?: ViewConfig): void {
		if (!this.isCopyMode) {
			return;
		}

		const hasTwoColumnConfig =
			this.viewConfig.specificConfig?.viewType === "twocolumn";

		const preset = this.buildTwoColumnPreset(
			this.copySourceIdentifier ?? sourceConfig?.id ?? null,
			sourceConfig,
		);

		if (!preset) {
			return;
		}

		if (hasTwoColumnConfig) {
			// Already a two column view; ensure task property aligns with preset if missing
			const currentConfig = this.viewConfig
				.specificConfig as TwoColumnSpecificConfig;
			if (!currentConfig.taskPropertyKey) {
				currentConfig.taskPropertyKey = preset.taskPropertyKey;
			}
			return;
		}

		this.viewConfig.specificConfig = preset;
	}

	private buildTwoColumnPreset(
		sourceIdentifier: string | null,
		sourceConfig?: ViewConfig,
	): TwoColumnSpecificConfig | null {
		if (!sourceIdentifier && !sourceConfig) {
			return null;
		}

		const identifier =
			sourceIdentifier ?? sourceConfig?.id ?? sourceConfig?.name ?? null;

		if (!identifier) {
			return null;
		}

		const normalized = identifier.toLowerCase();

		let propertyKey: string | null = null;

		const directKey =
			normalized.startsWith("twocolumn:") ||
			normalized.startsWith("two-column:") ||
			normalized.startsWith("property:");
		if (directKey) {
			const [, rawKey] = normalized.split(":");
			if (rawKey) {
				propertyKey = rawKey;
			}
		}

		if (!propertyKey) {
			if (normalized.includes("tag")) {
				propertyKey = "tags";
			} else if (normalized.includes("review")) {
				propertyKey = "project";
			} else if (normalized.includes("project")) {
				propertyKey = "project";
			} else if (normalized.includes("context")) {
				propertyKey = "context";
			} else if (normalized.includes("priority")) {
				propertyKey = "priority";
			} else if (normalized.includes("status")) {
				propertyKey = "status";
			} else if (normalized.includes("due")) {
				propertyKey = "dueDate";
			} else if (normalized.includes("schedule")) {
				propertyKey = "scheduledDate";
			} else if (normalized.includes("start")) {
				propertyKey = "startDate";
			} else if (normalized.includes("file")) {
				propertyKey = "filePath";
			}
		}

		if (!propertyKey) {
			return null;
		}

		let leftColumnTitle = this.resolveLeftColumnTitle(
			propertyKey,
			normalized,
			sourceConfig,
		);
		const rightColumnTitle = t("Tasks");
		let multiSelectText = t("selected items");
		let emptyStateText = t("No items selected");

		switch (propertyKey) {
			case "project":
				multiSelectText = t("projects selected");
				if (normalized.includes("review")) {
					emptyStateText = t("Select a project to review its tasks.");
					leftColumnTitle = t("Review Projects");
				} else {
					emptyStateText = t("Select a project to see related tasks");
					leftColumnTitle = t("Projects");
				}
				break;
			case "tags":
				leftColumnTitle = t("Tags");
				multiSelectText = t("tags selected");
				emptyStateText = t("Select a tag to see related tasks");
				break;
			case "context":
				leftColumnTitle = t("Contexts");
				break;
			case "priority":
				leftColumnTitle = t("Priority");
				break;
			case "status":
				leftColumnTitle = t("Status");
				break;
			case "dueDate":
				leftColumnTitle = t("Due Date");
				break;
			case "scheduledDate":
				leftColumnTitle = t("Scheduled Date");
				break;
			case "startDate":
				leftColumnTitle = t("Start Date");
				break;
			case "filePath":
				leftColumnTitle = t("Files");
				break;
		}

		return {
			viewType: "twocolumn",
			taskPropertyKey: propertyKey,
			leftColumnTitle,
			rightColumnDefaultTitle: rightColumnTitle,
			multiSelectText,
			emptyStateText,
		};
	}

	private resolveLeftColumnTitle(
		propertyKey: string,
		normalizedIdentifier: string,
		sourceConfig?: ViewConfig,
	): string {
		if (
			propertyKey === "project" &&
			normalizedIdentifier.includes("review")
		) {
			return t("Review Projects");
		}

		if (propertyKey === "project") {
			return t("Projects");
		}

		if (propertyKey === "tags") {
			return t("Tags");
		}

		if (propertyKey === "context") {
			return t("Contexts");
		}

		if (propertyKey === "priority") {
			return t("Priority");
		}

		if (propertyKey === "status") {
			return t("Status");
		}

		if (propertyKey === "dueDate") {
			return t("Due Date");
		}

		if (propertyKey === "scheduledDate") {
			return t("Scheduled Date");
		}

		if (propertyKey === "startDate") {
			return t("Start Date");
		}

		if (propertyKey === "filePath") {
			return t("Files");
		}

		if (sourceConfig?.name) {
			return sourceConfig.name;
		}

		return t("Items");
	}

	onOpen() {
		this.display();
	}

	private display() {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.toggleClass("task-genius-view-config-modal", true);

		const days = [
			{ value: -1, name: t("Locale Default") }, // Use -1 or undefined as sentinel
			{
				value: 0,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 7)),
			}, // Sunday (2024-01-07 is Sunday)
			{
				value: 1,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 8)),
			}, // Monday (2024-01-08 is Monday)
			{
				value: 2,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 9)),
			}, // Tuesday (2024-01-09 is Tuesday)
			{
				value: 3,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 10)),
			}, // Wednesday (2024-01-10 is Wednesday)
			{
				value: 4,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 11)),
			}, // Thursday (2024-01-11 is Thursday)
			{
				value: 5,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 12)),
			}, // Friday (2024-01-12 is Friday)
			{
				value: 6,
				name: new Intl.DateTimeFormat(window.navigator.language, {
					weekday: "long",
				}).format(new Date(2024, 0, 13)),
			}, // Saturday (2024-01-13 is Saturday)
		];

		// 设置标题，区分不同模式
		let title: string;
		if (this.isCreate) {
			if (this.isCopyMode) {
				title = t("Copy view: ") + (this.sourceViewId || "Unknown");
			} else {
				title = t("Create custom view");
			}
		} else {
			title = t("Edit view: ") + this.viewConfig.name;
		}
		this.titleEl.setText(title);

		// 在拷贝模式下显示源视图信息
		if (this.isCopyMode && this.sourceViewId) {
			const sourceViewConfig =
				this.plugin.settings.viewConfiguration.find(
					(v) => v.id === this.sourceViewId,
				);
			if (sourceViewConfig) {
				const infoEl = contentEl.createDiv({ cls: "copy-mode-info" });
				infoEl.createEl("p", {
					text:
						t("Creating a copy based on: ") + sourceViewConfig.name,
					cls: "setting-item-description",
				});
				infoEl.createEl("p", {
					text: t(
						"You can modify all settings below. The original view will remain unchanged.",
					),
					cls: "setting-item-description",
				});
			}
		}

		// --- Basic View Settings ---
		new Setting(contentEl).setName(t("View Name")).addText((text) => {
			this.nameInput = text;
			text.setValue(this.viewConfig.name).setPlaceholder(
				t("My Custom Task View"),
			);
			text.onChange(() => this.checkForChanges());
		});

		new Setting(contentEl)
			.setName(t("Icon name"))
			.setDesc(
				t(
					"Enter any Lucide icon name (e.g., list-checks, filter, inbox)",
				),
			)
			.addText((text) => {
				text.inputEl.hide();
				this.iconInput = text;
				text.setValue(this.viewConfig.icon).setPlaceholder("list-plus");
				text.onChange(() => this.checkForChanges());
			})
			.addButton((btn) => {
				try {
					btn.setIcon(this.viewConfig.icon);
				} catch (e) {
					console.error("Error setting icon:", e);
				}
				attachIconMenu(btn, {
					containerEl: this.modalEl,
					plugin: this.plugin,
					onIconSelected: (iconId) => {
						this.viewConfig.icon = iconId;
						this.checkForChanges();
						try {
							setIcon(btn.buttonEl, iconId);
						} catch (e) {
							console.error("Error setting icon:", e);
						}
						this.iconInput.setValue(iconId);
					},
				});
			});

		// Add Region setting for sidebar position
		// Default to 'bottom' for specific views for backward compatibility
		const bottomViewIds = ["habit", "calendar", "gantt", "kanban"];
		const defaultRegion = bottomViewIds.includes(this.viewConfig.id)
			? "bottom"
			: "top";

		new Setting(contentEl)
			.setName(t("Sidebar Position"))
			.setDesc(
				t(
					"Choose where this view appears in the sidebar. Views in the bottom section are visually separated from top section views.",
				),
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("top", t("Top Section"))
					.addOption("bottom", t("Bottom Section"))
					.setValue(this.viewConfig.region || defaultRegion)
					.onChange((value: "top" | "bottom") => {
						this.viewConfig.region = value;
						this.checkForChanges();
					});
			});

		// 检查是否为日历视图（原始ID或拷贝的日历视图）
		const isCalendarView =
			this.viewConfig.id === "calendar" ||
			(this.isCopyMode && this.sourceViewId === "calendar") ||
			this.viewConfig.specificConfig?.viewType === "calendar";

		// 检查是否为看板视图（原始ID或拷贝的看板视图）
		const isKanbanView =
			this.viewConfig.id === "kanban" ||
			(this.isCopyMode && this.sourceViewId === "kanban") ||
			this.viewConfig.specificConfig?.viewType === "kanban";

		// 检查是否为预测视图（原始ID或拷贝的预测视图）
		const isForecastView =
			this.viewConfig.id === "forecast" ||
			(this.isCopyMode && this.sourceViewId === "forecast") ||
			this.viewConfig.specificConfig?.viewType === "forecast";

		// 检查是否为四象限视图（原始ID或拷贝的四象限视图）
		const isQuadrantView =
			this.viewConfig.id === "quadrant" ||
			(this.isCopyMode && this.sourceViewId === "quadrant") ||
			this.viewConfig.specificConfig?.viewType === "quadrant";

		if (isCalendarView) {
			new Setting(contentEl)
				.setName(t("First day of week"))
				.setDesc(t("Overrides the locale default for calendar views."))
				.addDropdown((dropdown) => {
					days.forEach((day) => {
						dropdown.addOption(String(day.value), day.name);
					});

					let initialValue = -1; // Default to 'Locale Default'
					if (
						this.viewConfig.specificConfig?.viewType === "calendar"
					) {
						initialValue =
							(
								this.viewConfig
									.specificConfig as CalendarSpecificConfig
							).firstDayOfWeek ?? -1;
					}
					dropdown.setValue(String(initialValue));

					dropdown.onChange((value) => {
						const numValue = parseInt(value);
						const newFirstDayOfWeek =
							numValue === -1 ? undefined : numValue;

						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !==
								"calendar"
						) {
							this.viewConfig.specificConfig = {
								viewType: "calendar",
								firstDayOfWeek: newFirstDayOfWeek,
							};
						} else {
							(
								this.viewConfig
									.specificConfig as CalendarSpecificConfig
							).firstDayOfWeek = newFirstDayOfWeek;
						}
						this.checkForChanges();
					});
				});

			// Add weekend hiding toggle for calendar view
			new Setting(contentEl)
				.setName(t("Hide weekends"))
				.setDesc(
					t(
						"Hide weekend columns (Saturday and Sunday) in calendar views.",
					),
				)
				.addToggle((toggle) => {
					const currentValue =
						(
							this.viewConfig
								.specificConfig as CalendarSpecificConfig
						)?.hideWeekends ?? false;
					toggle.setValue(currentValue);
					toggle.onChange((value) => {
						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !==
								"calendar"
						) {
							this.viewConfig.specificConfig = {
								viewType: "calendar",
								firstDayOfWeek: undefined,
								hideWeekends: value,
							};
						} else {
							(
								this.viewConfig
									.specificConfig as CalendarSpecificConfig
							).hideWeekends = value;
						}
						this.checkForChanges();
					});
				});
		} else if (isKanbanView) {
			new Setting(contentEl)
				.setName(t("Group by"))
				.setDesc(
					t("Select which task property to use for creating columns"),
				)
				.addDropdown((dropdown) => {
					dropdown
						.addOption("status", t("Status"))
						.addOption("priority", t("Priority"))
						.addOption("tags", t("Tags"))
						.addOption("project", t("Project"))
						.addOption("dueDate", t("Due Date"))
						.addOption("scheduledDate", t("Scheduled Date"))
						.addOption("startDate", t("Start Date"))
						.addOption("context", t("Context"))
						.addOption("filePath", t("File Path"))
						.setValue(
							(
								this.viewConfig
									.specificConfig as KanbanSpecificConfig
							)?.groupBy || "status",
						)
						.onChange((value) => {
							if (
								!this.viewConfig.specificConfig ||
								this.viewConfig.specificConfig.viewType !==
									"kanban"
							) {
								this.viewConfig.specificConfig = {
									viewType: "kanban",
									showCheckbox: true,
									hideEmptyColumns: false,
									defaultSortField: "priority",
									defaultSortOrder: "desc",
									groupBy: value as any,
								};
							} else {
								(
									this.viewConfig
										.specificConfig as KanbanSpecificConfig
								).groupBy = value as any;
							}
							this.checkForChanges();
							// Refresh the modal to show/hide custom columns settings
							this.display();
						});
				});

			new Setting(contentEl)
				.setName(t("Show checkbox"))
				.setDesc(t("Show a checkbox for each task in the kanban view."))
				.addToggle((toggle) => {
					toggle.setValue(
						(this.viewConfig.specificConfig as KanbanSpecificConfig)
							?.showCheckbox as boolean,
					);
					toggle.onChange((value) => {
						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !== "kanban"
						) {
							this.viewConfig.specificConfig = {
								viewType: "kanban",
								showCheckbox: value,
								hideEmptyColumns: false,
								defaultSortField: "priority",
								defaultSortOrder: "desc",
								groupBy: "status",
							};
						} else {
							(
								this.viewConfig
									.specificConfig as KanbanSpecificConfig
							).showCheckbox = value;
						}
						this.checkForChanges();
					});
				});

			new Setting(contentEl)
				.setName(t("Hide empty columns"))
				.setDesc(t("Hide columns that have no tasks."))
				.addToggle((toggle) => {
					toggle.setValue(
						(this.viewConfig.specificConfig as KanbanSpecificConfig)
							?.hideEmptyColumns as boolean,
					);
					toggle.onChange((value) => {
						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !== "kanban"
						) {
							this.viewConfig.specificConfig = {
								viewType: "kanban",
								showCheckbox: true,
								hideEmptyColumns: value,
								defaultSortField: "priority",
								defaultSortOrder: "desc",
								groupBy: "status",
							};
						} else {
							(
								this.viewConfig
									.specificConfig as KanbanSpecificConfig
							).hideEmptyColumns = value;
						}
						this.checkForChanges();
					});
				});

			new Setting(contentEl)
				.setName(t("Default sort field"))
				.setDesc(
					t("Default field to sort tasks by within each column."),
				)
				.addDropdown((dropdown) => {
					dropdown
						.addOption("priority", t("Priority"))
						.addOption("dueDate", t("Due Date"))
						.addOption("scheduledDate", t("Scheduled Date"))
						.addOption("startDate", t("Start Date"))
						.addOption("createdDate", t("Created Date"))
						.setValue(
							(
								this.viewConfig
									.specificConfig as KanbanSpecificConfig
							)?.defaultSortField || "priority",
						)
						.onChange((value) => {
							if (
								!this.viewConfig.specificConfig ||
								this.viewConfig.specificConfig.viewType !==
									"kanban"
							) {
								this.viewConfig.specificConfig = {
									viewType: "kanban",
									showCheckbox: true,
									hideEmptyColumns: false,
									defaultSortField: value as any,
									defaultSortOrder: "desc",
									groupBy: "status",
								};
							} else {
								(
									this.viewConfig
										.specificConfig as KanbanSpecificConfig
								).defaultSortField = value as any;
							}
							this.checkForChanges();
						});
				});

			new Setting(contentEl)
				.setName(t("Default sort order"))
				.setDesc(t("Default order to sort tasks within each column."))
				.addDropdown((dropdown) => {
					dropdown
						.addOption("asc", t("Ascending"))
						.addOption("desc", t("Descending"))
						.setValue(
							(
								this.viewConfig
									.specificConfig as KanbanSpecificConfig
							)?.defaultSortOrder || "desc",
						)
						.onChange((value) => {
							if (
								!this.viewConfig.specificConfig ||
								this.viewConfig.specificConfig.viewType !==
									"kanban"
							) {
								this.viewConfig.specificConfig = {
									viewType: "kanban",
									showCheckbox: true,
									hideEmptyColumns: false,
									defaultSortField: "priority",
									defaultSortOrder: value as any,
									groupBy: "status",
								};
							} else {
								(
									this.viewConfig
										.specificConfig as KanbanSpecificConfig
								).defaultSortOrder = value as any;
							}
							this.checkForChanges();
						});
				});

			// Hidden Columns Management
			const kanbanConfigForHidden = this.viewConfig
				.specificConfig as KanbanSpecificConfig;
			const hiddenColumns = kanbanConfigForHidden?.hiddenColumns || [];
			if (hiddenColumns.length > 0) {
				new Setting(contentEl)
					.setName(t("Hidden Columns"))
					.setDesc(
						t(
							"Columns that are currently hidden from view. Click the eye icon to show them again.",
						),
					)
					.setHeading();

				hiddenColumns.forEach((colTitle, index) => {
					new Setting(contentEl)
						.setName(colTitle)
						.addButton((button) => {
							button
								.setIcon("eye")
								.setTooltip(t("Unhide column"))
								.onClick(() => {
									const config = this.viewConfig
										.specificConfig as KanbanSpecificConfig;
									if (config.hiddenColumns) {
										config.hiddenColumns.splice(index, 1);
										this.checkForChanges();
										this.display(); // Refresh to update list
									}
								});
						});
				});
			}

			// Custom columns configuration for non-status grouping
			const kanbanConfig = this.viewConfig
				.specificConfig as KanbanSpecificConfig;
			if (kanbanConfig?.groupBy && kanbanConfig.groupBy !== "status") {
				new Setting(contentEl)
					.setName(t("Custom Columns"))
					.setDesc(
						t(
							"Configure custom columns for the selected grouping property",
						),
					)
					.setHeading();

				const columnsContainer = contentEl.createDiv({
					cls: "kanban-columns-container",
				});

				const refreshColumnsList = () => {
					columnsContainer.empty();

					// Ensure customColumns exists
					if (!kanbanConfig.customColumns) {
						kanbanConfig.customColumns = [];
					}

					const columns = kanbanConfig.customColumns;

					if (columns.length === 0) {
						columnsContainer.createEl("p", {
							text: t(
								"No custom columns defined. Add columns below.",
							),
							cls: "setting-item-description",
						});
					}

					columns.forEach((column, index) => {
						const columnSetting = new Setting(columnsContainer)
							.setClass("kanban-column-row")
							.addText((text) => {
								text.setValue(column.title)
									.setPlaceholder(t("Column Title"))
									.onChange((value) => {
										if (kanbanConfig.customColumns) {
											kanbanConfig.customColumns[
												index
											].title = value;
											this.checkForChanges();
										}
									});
							})
							.addText((text) => {
								text.setValue(column.value?.toString() || "")
									.setPlaceholder(t("Value"))
									.onChange((value) => {
										if (kanbanConfig.customColumns) {
											// Handle different value types based on groupBy
											let parsedValue:
												| string
												| number
												| null = value;
											if (
												kanbanConfig.groupBy ===
													"priority" &&
												value
											) {
												const numValue =
													parseInt(value);
												parsedValue = isNaN(numValue)
													? value
													: numValue;
											}
											kanbanConfig.customColumns[
												index
											].value = parsedValue;
											this.checkForChanges();
										}
									});
							});

						// Controls for reordering and deleting
						columnSetting.addExtraButton((button) => {
							button
								.setIcon("arrow-up")
								.setTooltip(t("Move Up"))
								.setDisabled(index === 0)
								.onClick(() => {
									if (
										index > 0 &&
										kanbanConfig.customColumns
									) {
										const item =
											kanbanConfig.customColumns.splice(
												index,
												1,
											)[0];
										kanbanConfig.customColumns.splice(
											index - 1,
											0,
											item,
										);
										// Update order values
										kanbanConfig.customColumns.forEach(
											(col, i) => {
												col.order = i;
											},
										);
										this.checkForChanges();
										refreshColumnsList();
									}
								});
						});
						columnSetting.addExtraButton((button) => {
							button
								.setIcon("arrow-down")
								.setTooltip(t("Move Down"))
								.setDisabled(index === columns.length - 1)
								.onClick(() => {
									if (
										index < columns.length - 1 &&
										kanbanConfig.customColumns
									) {
										const item =
											kanbanConfig.customColumns.splice(
												index,
												1,
											)[0];
										kanbanConfig.customColumns.splice(
											index + 1,
											0,
											item,
										);
										// Update order values
										kanbanConfig.customColumns.forEach(
											(col, i) => {
												col.order = i;
											},
										);
										this.checkForChanges();
										refreshColumnsList();
									}
								});
						});
						columnSetting.addExtraButton((button) => {
							button
								.setIcon("trash")
								.setTooltip(t("Remove Column"))
								.onClick(() => {
									if (kanbanConfig.customColumns) {
										kanbanConfig.customColumns.splice(
											index,
											1,
										);
										// Update order values
										kanbanConfig.customColumns.forEach(
											(col, i) => {
												col.order = i;
											},
										);
										this.checkForChanges();
										refreshColumnsList();
									}
								});
							button.extraSettingsEl.addClass("mod-warning");
						});
					});

					// Button to add a new column
					new Setting(columnsContainer)
						.addButton((button) => {
							button
								.setButtonText(t("Add Column"))
								.setCta()
								.onClick(() => {
									if (!kanbanConfig.customColumns) {
										kanbanConfig.customColumns = [];
									}
									const newColumn = {
										id: `column_${Date.now()}`,
										title: t("New Column"),
										value: "",
										order: kanbanConfig.customColumns
											.length,
									};
									kanbanConfig.customColumns.push(newColumn);
									this.checkForChanges();
									refreshColumnsList();
								});
						})
						.addButton((button) => {
							button
								.setButtonText(t("Reset Columns"))
								.onClick(() => {
									if (kanbanConfig.customColumns) {
										kanbanConfig.customColumns = [];
										this.checkForChanges();
										refreshColumnsList();
									}
								});
						});
				};

				refreshColumnsList();
			}
		} else if (isForecastView) {
			new Setting(contentEl)
				.setName(t("First day of week"))
				.setDesc(t("Overrides the locale default for forecast views."))
				.addDropdown((dropdown) => {
					days.forEach((day) => {
						dropdown.addOption(String(day.value), day.name);
					});

					let initialValue = -1; // Default to 'Locale Default'
					if (
						this.viewConfig.specificConfig?.viewType === "forecast"
					) {
						initialValue =
							(
								this.viewConfig
									.specificConfig as ForecastSpecificConfig
							).firstDayOfWeek ?? -1;
					}
					dropdown.setValue(String(initialValue));

					dropdown.onChange((value) => {
						const numValue = parseInt(value);
						const newFirstDayOfWeek =
							numValue === -1 ? undefined : numValue;

						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !==
								"forecast"
						) {
							this.viewConfig.specificConfig = {
								viewType: "forecast",
								firstDayOfWeek: newFirstDayOfWeek,
							};
						} else {
							(
								this.viewConfig
									.specificConfig as ForecastSpecificConfig
							).firstDayOfWeek = newFirstDayOfWeek;
						}
						this.checkForChanges();
					});
				});

			// Add weekend hiding toggle for forecast view
			new Setting(contentEl)
				.setName(t("Hide weekends"))
				.setDesc(
					t(
						"Hide weekend columns (Saturday and Sunday) in forecast calendar.",
					),
				)
				.addToggle((toggle) => {
					const currentValue =
						(
							this.viewConfig
								.specificConfig as ForecastSpecificConfig
						)?.hideWeekends ?? false;
					toggle.setValue(currentValue);
					toggle.onChange((value) => {
						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !==
								"forecast"
						) {
							this.viewConfig.specificConfig = {
								viewType: "forecast",
								firstDayOfWeek: undefined,
								hideWeekends: value,
							};
						} else {
							(
								this.viewConfig
									.specificConfig as ForecastSpecificConfig
							).hideWeekends = value;
						}
						this.checkForChanges();
					});
				});
		} else if (isQuadrantView) {
			new Setting(contentEl)
				.setName(t("Quadrant Classification Method"))
				.setDesc(t("Choose how to classify tasks into quadrants"))
				.addToggle((toggle) => {
					const currentValue =
						(
							this.viewConfig
								.specificConfig as QuadrantSpecificConfig
						)?.usePriorityForClassification ?? false;
					toggle.setValue(currentValue);
					toggle.onChange((value) => {
						if (
							!this.viewConfig.specificConfig ||
							this.viewConfig.specificConfig.viewType !==
								"quadrant"
						) {
							this.viewConfig.specificConfig = {
								viewType: "quadrant",
								hideEmptyQuadrants: false,
								autoUpdatePriority: true,
								autoUpdateTags: true,
								showTaskCount: true,
								defaultSortField: "priority",
								defaultSortOrder: "desc",
								urgentTag: "#urgent",
								importantTag: "#important",
								urgentThresholdDays: 3,
								usePriorityForClassification: value,
								urgentPriorityThreshold: 4,
								importantPriorityThreshold: 3,
								customQuadrantColors: false,
								quadrantColors: {
									urgentImportant: "#dc3545",
									notUrgentImportant: "#28a745",
									urgentNotImportant: "#ffc107",
									notUrgentNotImportant: "#6c757d",
								},
							};
						} else {
							(
								this.viewConfig
									.specificConfig as QuadrantSpecificConfig
							).usePriorityForClassification = value;
						}
						this.checkForChanges();
						// Refresh the modal to show/hide relevant settings
						this.display();
					});
				});

			const quadrantConfig = this.viewConfig
				.specificConfig as QuadrantSpecificConfig;
			const usePriorityClassification =
				quadrantConfig?.usePriorityForClassification ?? false;

			if (usePriorityClassification) {
				// Priority-based classification settings
				new Setting(contentEl)
					.setName(t("Urgent Priority Threshold"))
					.setDesc(
						t(
							"Tasks with priority >= this value are considered urgent (1-5)",
						),
					)
					.addSlider((slider) => {
						slider
							.setLimits(1, 5, 1)
							.setValue(
								quadrantConfig?.urgentPriorityThreshold ?? 4,
							)
							.setDynamicTooltip()
							.onChange((value) => {
								if (
									this.viewConfig.specificConfig?.viewType ===
									"quadrant"
								) {
									(
										this.viewConfig
											.specificConfig as QuadrantSpecificConfig
									).urgentPriorityThreshold = value;
									this.checkForChanges();
								}
							});
					});

				new Setting(contentEl)
					.setName(t("Important Priority Threshold"))
					.setDesc(
						t(
							"Tasks with priority >= this value are considered important (1-5)",
						),
					)
					.addSlider((slider) => {
						slider
							.setLimits(1, 5, 1)
							.setValue(
								quadrantConfig?.importantPriorityThreshold ?? 3,
							)
							.setDynamicTooltip()
							.onChange((value) => {
								if (
									this.viewConfig.specificConfig?.viewType ===
									"quadrant"
								) {
									(
										this.viewConfig
											.specificConfig as QuadrantSpecificConfig
									).importantPriorityThreshold = value;
									this.checkForChanges();
								}
							});
					});
			} else {
				// Tag-based classification settings
				new Setting(contentEl)
					.setName(t("Urgent Tag"))
					.setDesc(
						t(
							"Tag to identify urgent tasks (e.g., #urgent, #fire)",
						),
					)
					.addText((text) => {
						text.setValue(quadrantConfig?.urgentTag ?? "#urgent")
							.setPlaceholder("#urgent")
							.onChange((value) => {
								if (
									this.viewConfig.specificConfig?.viewType ===
									"quadrant"
								) {
									(
										this.viewConfig
											.specificConfig as QuadrantSpecificConfig
									).urgentTag = value;
									this.checkForChanges();
								}
							});
					});

				new Setting(contentEl)
					.setName(t("Important Tag"))
					.setDesc(
						t(
							"Tag to identify important tasks (e.g., #important, #key)",
						),
					)
					.addText((text) => {
						text.setValue(
							quadrantConfig?.importantTag ?? "#important",
						)
							.setPlaceholder("#important")
							.onChange((value) => {
								if (
									this.viewConfig.specificConfig?.viewType ===
									"quadrant"
								) {
									(
										this.viewConfig
											.specificConfig as QuadrantSpecificConfig
									).importantTag = value;
									this.checkForChanges();
								}
							});
					});

				new Setting(contentEl)
					.setName(t("Urgent Threshold Days"))
					.setDesc(
						t(
							"Tasks due within this many days are considered urgent",
						),
					)
					.addSlider((slider) => {
						slider
							.setLimits(1, 14, 1)
							.setValue(quadrantConfig?.urgentThresholdDays ?? 3)
							.setDynamicTooltip()
							.onChange((value) => {
								if (
									this.viewConfig.specificConfig?.viewType ===
									"quadrant"
								) {
									(
										this.viewConfig
											.specificConfig as QuadrantSpecificConfig
									).urgentThresholdDays = value;
									this.checkForChanges();
								}
							});
					});
			}

			// Common quadrant settings
			new Setting(contentEl)
				.setName(t("Auto Update Priority"))
				.setDesc(
					t(
						"Automatically update task priority when moved between quadrants",
					),
				)
				.addToggle((toggle) => {
					toggle
						.setValue(quadrantConfig?.autoUpdatePriority ?? true)
						.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"quadrant"
							) {
								(
									this.viewConfig
										.specificConfig as QuadrantSpecificConfig
								).autoUpdatePriority = value;
								this.checkForChanges();
							}
						});
				});

			new Setting(contentEl)
				.setName(t("Auto Update Tags"))
				.setDesc(
					t(
						"Automatically add/remove urgent/important tags when moved between quadrants",
					),
				)
				.addToggle((toggle) => {
					toggle
						.setValue(quadrantConfig?.autoUpdateTags ?? true)
						.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"quadrant"
							) {
								(
									this.viewConfig
										.specificConfig as QuadrantSpecificConfig
								).autoUpdateTags = value;
								this.checkForChanges();
							}
						});
				});

			new Setting(contentEl)
				.setName(t("Hide Empty Quadrants"))
				.setDesc(t("Hide quadrants that have no tasks"))
				.addToggle((toggle) => {
					toggle
						.setValue(quadrantConfig?.hideEmptyQuadrants ?? false)
						.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"quadrant"
							) {
								(
									this.viewConfig
										.specificConfig as QuadrantSpecificConfig
								).hideEmptyQuadrants = value;
								this.checkForChanges();
							}
						});
				});
		}

		// Two Column View specific config
		if (
			this.isCreate ||
			this.viewConfig.specificConfig?.viewType === "twocolumn" ||
			this.viewConfig.type === "custom" // 自定义视图总是可以切换布局
		) {
			// For custom views, allow changing view type even in edit mode
			// 对于自定义视图，编辑模式下也允许切换视图类型
			if (
				(this.isCreate && !this.isCopyMode) ||
				this.viewConfig.type === "custom"
			) {
				new Setting(contentEl)
					.setName(t("View type"))
					.setDesc(t("Select the type of view to create"))
					.addDropdown((dropdown) => {
						dropdown
							.addOption("standard", t("Standard view"))
							.addOption("twocolumn", t("Two column view"))
							.setValue(
								this.viewConfig.specificConfig?.viewType ===
									"twocolumn"
									? "twocolumn"
									: "standard",
							)
							.onChange((value) => {
								if (value === "twocolumn") {
									// Create a new TwoColumnSpecificConfig
									this.viewConfig.specificConfig = {
										viewType: "twocolumn",
										taskPropertyKey: "tags", // Default to tags
										leftColumnTitle: t("Items"),
										rightColumnDefaultTitle: t("Tasks"),
										multiSelectText: t("selected items"),
										emptyStateText: t("No items selected"),
									};
								} else {
									// Remove specificConfig if not needed
									delete this.viewConfig.specificConfig;
								}
								this.checkForChanges();

								// Refresh the modal to show/hide the two column specific settings
								this.display();
							});
					});
			}

			// Only show TwoColumn specific settings if the view type is twocolumn
			if (this.viewConfig.specificConfig?.viewType === "twocolumn") {
				new Setting(contentEl)
					.setName(t("Two column view settings"))
					.setHeading();

				// Task Property Key selector
				new Setting(contentEl)
					.setName(t("Group by task property"))
					.setDesc(
						t(
							"Select which task property to use for left column grouping",
						),
					)
					.addDropdown((dropdown) => {
						dropdown
							.addOption("tags", t("Tags"))
							.addOption("project", t("Project"))
							.addOption("priority", t("Priority"))
							.addOption("context", t("Context"))
							.addOption("status", t("Status"))
							.addOption("dueDate", t("Due Date"))
							.addOption("scheduledDate", t("Scheduled Date"))
							.addOption("startDate", t("Start Date"))
							.addOption("filePath", t("File Path"))
							.setValue(
								(
									this.viewConfig
										.specificConfig as TwoColumnSpecificConfig
								).taskPropertyKey || "tags",
							)
							.onChange((value) => {
								if (
									this.viewConfig.specificConfig?.viewType ===
									"twocolumn"
								) {
									(
										this.viewConfig
											.specificConfig as TwoColumnSpecificConfig
									).taskPropertyKey = value;

									// Set appropriate default titles based on the selected property
									if (!this.leftColumnTitleInput.getValue()) {
										let title = t("Items");
										switch (value) {
											case "tags":
												title = t("Tags");
												break;
											case "project":
												title = t("Projects");
												break;
											case "priority":
												title = t("Priorities");
												break;
											case "context":
												title = t("Contexts");
												break;
											case "status":
												title = t("Status");
												break;
											case "dueDate":
												title = t("Due Dates");
												break;
											case "scheduledDate":
												title = t("Scheduled Dates");
												break;
											case "startDate":
												title = t("Start Dates");
												break;
											case "filePath":
												title = t("Files");
												break;
										}
										this.leftColumnTitleInput.setValue(
											title,
										);
										(
											this.viewConfig
												.specificConfig as TwoColumnSpecificConfig
										).leftColumnTitle = title;
									}

									this.checkForChanges();
								}
							});
					});

				// Left Column Title
				new Setting(contentEl)
					.setName(t("Left column title"))
					.setDesc(t("Title for the left column (items list)"))
					.addText((text) => {
						this.leftColumnTitleInput = text;
						text.setValue(
							(
								this.viewConfig
									.specificConfig as TwoColumnSpecificConfig
							).leftColumnTitle || t("Items"),
						);
						text.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"twocolumn"
							) {
								(
									this.viewConfig
										.specificConfig as TwoColumnSpecificConfig
								).leftColumnTitle = value;
								this.checkForChanges();
							}
						});
					});

				// Right Column Title
				new Setting(contentEl)
					.setName(t("Right column title"))
					.setDesc(
						t("Default title for the right column (tasks list)"),
					)
					.addText((text) => {
						this.rightColumnTitleInput = text;
						text.setValue(
							(
								this.viewConfig
									.specificConfig as TwoColumnSpecificConfig
							).rightColumnDefaultTitle || t("Tasks"),
						);
						text.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"twocolumn"
							) {
								(
									this.viewConfig
										.specificConfig as TwoColumnSpecificConfig
								).rightColumnDefaultTitle = value;
								this.checkForChanges();
							}
						});
					});

				// Multi-select Text
				new Setting(contentEl)
					.setName(t("Multi-select Text"))
					.setDesc(t("Text to show when multiple items are selected"))
					.addText((text) => {
						this.multiSelectTextInput = text;
						text.setValue(
							(
								this.viewConfig
									.specificConfig as TwoColumnSpecificConfig
							).multiSelectText || t("selected items"),
						);
						text.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"twocolumn"
							) {
								(
									this.viewConfig
										.specificConfig as TwoColumnSpecificConfig
								).multiSelectText = value;
								this.checkForChanges();
							}
						});
					});

				// Empty State Text
				new Setting(contentEl)
					.setName(t("Empty state text"))
					.setDesc(t("Text to show when no items are selected"))
					.addText((text) => {
						this.emptyStateTextInput = text;
						text.setValue(
							(
								this.viewConfig
									.specificConfig as TwoColumnSpecificConfig
							).emptyStateText || t("No items selected"),
						);
						text.onChange((value) => {
							if (
								this.viewConfig.specificConfig?.viewType ===
								"twocolumn"
							) {
								(
									this.viewConfig
										.specificConfig as TwoColumnSpecificConfig
								).emptyStateText = value;
								this.checkForChanges();
							}
						});
					});
			}
		}

		// --- Filter Rules ---
		new Setting(contentEl).setName(t("Filter Rules")).setHeading();

		new Setting(contentEl)
			.setName(t("Hide completed and abandoned tasks"))
			.setDesc(t("Hide completed and abandoned tasks in this view."))
			.addToggle((toggle) => {
				toggle.setValue(this.viewConfig.hideCompletedAndAbandonedTasks);
				toggle.onChange((value) => {
					this.viewConfig.hideCompletedAndAbandonedTasks = value;
					this.checkForChanges();
				});
			});

		new Setting(contentEl)
			.setName(t("Filter blanks"))
			.setDesc(t("Filter out blank tasks in this view."))
			.addToggle((toggle) => {
				toggle.setValue(this.viewConfig.filterBlanks);
				toggle.onChange((value) => {
					this.viewConfig.filterBlanks = value;
					this.checkForChanges();
				});
			});

		// --- Advanced Filter Section ---
		new Setting(contentEl)
			.setName(t("Advanced Filtering"))
			.setDesc(
				t("Use advanced multi-group filtering with complex conditions"),
			)
			.addToggle((toggle) => {
				const hasAdvancedFilter = !!this.viewFilterRule.advancedFilter;
				console.log(
					"Initial advanced filter state:",
					hasAdvancedFilter,
					this.viewFilterRule.advancedFilter,
				);
				toggle.setValue(hasAdvancedFilter);
				toggle.onChange((value) => {
					console.log("Advanced filter toggle changed to:", value);
					if (value) {
						// Enable advanced filtering
						if (!this.viewFilterRule.advancedFilter) {
							this.viewFilterRule.advancedFilter = {
								rootCondition: "any",
								filterGroups: [],
							};
							console.log(
								"Created new advanced filter:",
								this.viewFilterRule.advancedFilter,
							);
						}
						this.setupAdvancedFilter();
					} else {
						// Disable advanced filtering
						console.log("Disabling advanced filter");
						delete this.viewFilterRule.advancedFilter;
						this.cleanupAdvancedFilter();
					}
					this.checkForChanges();
				});
			});

		// Container for advanced filter component
		this.advancedFilterContainer = contentEl.createDiv({
			cls: "advanced-filter-container",
		});

		// Initialize advanced filter if it exists
		if (this.viewFilterRule.advancedFilter) {
			this.setupAdvancedFilter();
		} else {
			// Hide the container initially if no advanced filter
			this.advancedFilterContainer.style.display = "none";
		}

		if (
			!["kanban", "gantt", "calendar"].includes(
				this.viewConfig.specificConfig?.viewType || "",
			)
		) {
			new Setting(contentEl)
				.setName(t("Sort Criteria"))
				.setDesc(
					t(
						"Define the order in which tasks should be sorted. Criteria are applied sequentially.",
					),
				)
				.setHeading();

			const criteriaContainer = contentEl.createDiv({
				cls: "sort-criteria-container",
			});

			const refreshCriteriaList = () => {
				criteriaContainer.empty();

				// Ensure viewConfig.sortCriteria exists
				if (!this.viewConfig.sortCriteria) {
					this.viewConfig.sortCriteria = [];
				}

				const criteria = this.viewConfig.sortCriteria;

				if (criteria.length === 0) {
					criteriaContainer.createEl("p", {
						text: t(
							"No sort criteria defined. Add criteria below.",
						),
						cls: "setting-item-description",
					});
				}

				criteria.forEach((criterion: SortCriterion, index: number) => {
					const criterionSetting = new Setting(criteriaContainer)
						.setClass("sort-criterion-row")
						.addDropdown((dropdown) => {
							dropdown
								.addOption("status", t("Status"))
								.addOption("priority", t("Priority"))
								.addOption("dueDate", t("Due Date"))
								.addOption("startDate", t("Start Date"))
								.addOption("scheduledDate", t("Scheduled Date"))
								.addOption("content", t("Content"))
								.setValue(criterion.field)
								.onChange((value: SortCriterion["field"]) => {
									if (this.viewConfig.sortCriteria) {
										this.viewConfig.sortCriteria[
											index
										].field = value;
										this.checkForChanges();
									}
								});
						})
						.addDropdown((dropdown) => {
							dropdown
								.addOption("asc", t("Ascending"))
								.addOption("desc", t("Descending"))
								.setValue(criterion.order)
								.onChange((value: SortCriterion["order"]) => {
									if (this.viewConfig.sortCriteria) {
										this.viewConfig.sortCriteria[
											index
										].order = value;
										this.checkForChanges();
									}
								});
							// Add tooltips explaining what asc/desc means for each field type if possible
							if (criterion.field === "priority") {
								dropdown.selectEl.title = t(
									"Ascending: High -> Low -> None. Descending: None -> Low -> High",
								);
							} else if (
								[
									"dueDate",
									"startDate",
									"scheduledDate",
								].includes(criterion.field)
							) {
								dropdown.selectEl.title = t(
									"Ascending: Earlier -> Later -> None. Descending: None -> Later -> Earlier",
								);
							} else if (criterion.field === "status") {
								dropdown.selectEl.title = t(
									"Ascending respects status order (Overdue first). Descending reverses it.",
								);
							} else {
								dropdown.selectEl.title = t(
									"Ascending: A-Z. Descending: Z-A",
								);
							}
						});

					// Controls for reordering and deleting
					criterionSetting.addExtraButton((button) => {
						button
							.setIcon("arrow-up")
							.setTooltip(t("Move Up"))
							.setDisabled(index === 0)
							.onClick(() => {
								if (index > 0 && this.viewConfig.sortCriteria) {
									const item =
										this.viewConfig.sortCriteria.splice(
											index,
											1,
										)[0];
									this.viewConfig.sortCriteria.splice(
										index - 1,
										0,
										item,
									);
									this.checkForChanges();
									refreshCriteriaList();
								}
							});
					});
					criterionSetting.addExtraButton((button) => {
						button
							.setIcon("arrow-down")
							.setTooltip(t("Move Down"))
							.setDisabled(index === criteria.length - 1)
							.onClick(() => {
								if (
									index < criteria.length - 1 &&
									this.viewConfig.sortCriteria
								) {
									const item =
										this.viewConfig.sortCriteria.splice(
											index,
											1,
										)[0];
									this.viewConfig.sortCriteria.splice(
										index + 1,
										0,
										item,
									);
									this.checkForChanges();
									refreshCriteriaList();
								}
							});
					});
					criterionSetting.addExtraButton((button) => {
						button
							.setIcon("trash")
							.setTooltip(t("Remove Criterion"))
							.onClick(() => {
								if (this.viewConfig.sortCriteria) {
									this.viewConfig.sortCriteria.splice(
										index,
										1,
									);
									this.checkForChanges();
									refreshCriteriaList();
								}
							});
						// Add class to the container element of the extra button
						button.extraSettingsEl.addClass("mod-warning");
					});
				});

				// Button to add a new criterion
				new Setting(criteriaContainer)
					.addButton((button) => {
						button
							.setButtonText(t("Add Sort Criterion"))
							.setCta()
							.onClick(() => {
								const newCriterion: SortCriterion = {
									field: "status",
									order: "asc",
								};
								if (!this.viewConfig.sortCriteria) {
									this.viewConfig.sortCriteria = [];
								}
								this.viewConfig.sortCriteria.push(newCriterion);
								this.checkForChanges();
								refreshCriteriaList();
							});
					})
					.addButton((button) => {
						// Button to reset to defaults
						button
							.setButtonText(t("Reset to Defaults"))
							.onClick(() => {
								// Optional: Add confirmation dialog here
								this.viewConfig.sortCriteria = []; // Use spread to copy
								this.checkForChanges();
								refreshCriteriaList();
							});
					});
			};

			refreshCriteriaList();
		}

		// --- First Day of Week ---

		// --- Action Buttons ---
		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText(t("Save"))
					.setCta()
					.onClick(() => {
						this.saveChanges();
					});
			})
			.addButton((button) => {
				button.setButtonText(t("Cancel")).onClick(() => {
					this.close();
				});
			});
	}

	private parseStringToArray(input: string): string[] {
		if (!input || input.trim() === "") return [];
		return input
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s !== "");
	}

	private checkForChanges() {
		const currentConfig = JSON.stringify(this.viewConfig);
		const currentFilterRule = JSON.stringify(this.getCurrentFilterRule());
		this.hasChanges =
			currentConfig !== this.originalViewConfig ||
			currentFilterRule !== this.originalViewFilterRule;
	}

	private getCurrentFilterRule(): ViewFilterRule {
		const rules: ViewFilterRule = {};

		// Get advanced filter state if available
		if (this.taskFilterComponent) {
			try {
				const currentFilterState =
					this.taskFilterComponent.getFilterState();
				if (
					currentFilterState &&
					currentFilterState.filterGroups.length > 0
				) {
					rules.advancedFilter = currentFilterState;
				}
			} catch (error) {
				console.warn("Error getting current filter state:", error);
			}
		} else if (this.viewFilterRule.advancedFilter) {
			// Preserve existing advanced filter if component is not loaded
			rules.advancedFilter = this.viewFilterRule.advancedFilter;
		}

		return rules;
	}

	private saveChanges() {
		// Update viewConfig
		this.viewConfig.name =
			this.nameInput.getValue().trim() || t("Unnamed View");
		this.viewConfig.icon = this.iconInput.getValue().trim() || "list";

		// Update viewFilterRule
		this.viewFilterRule = this.getCurrentFilterRule();

		// Reset change tracking state
		this.originalViewConfig = JSON.stringify(this.viewConfig);
		this.originalViewFilterRule = JSON.stringify(this.viewFilterRule);
		this.hasChanges = false;

		// Call the onSave callback
		this.onSave(this.viewConfig, this.viewFilterRule);
		this.close();
		new Notice(t("View configuration saved."));
	}

	close() {
		if (this.hasChanges) {
			new ConfirmModal(this.plugin, {
				title: t("Unsaved Changes"),
				message: t("You have unsaved changes. Save before closing?"),
				confirmText: t("Save"),
				cancelText: t("Cancel"),
				onConfirm: (confirmed: boolean) => {
					if (confirmed) {
						this.saveChanges();
						return;
					}
					super.close();
				},
			}).open();
		} else {
			super.close();
		}
	}

	onClose() {
		// Clean up the advanced filter component
		this.cleanupAdvancedFilter();

		const { contentEl } = this;
		contentEl.empty();
	}

	// 添加saveSettingsUpdate方法
	private saveSettingsUpdate() {
		this.checkForChanges();
	}

	private setupAdvancedFilter() {
		if (!this.advancedFilterContainer) return;

		console.log("Setting up advanced filter...");

		// Clean up existing component if any
		this.cleanupAdvancedFilter();

		// Create the TaskFilterComponent with view-config leafId to prevent affecting live filters
		this.taskFilterComponent = new TaskFilterComponent(
			this.advancedFilterContainer,
			this.app,
			`view-config-${this.viewConfig.id}`, // 使用 view-config- 前缀确保不影响实时筛选器
			this.plugin,
		);

		console.log("TaskFilterComponent created:", this.taskFilterComponent);

		// 保存现有的过滤器状态
		const existingFilterState = this.viewFilterRule.advancedFilter
			? JSON.parse(JSON.stringify(this.viewFilterRule.advancedFilter))
			: {
					rootCondition: "any" as const,
					filterGroups: [],
				};

		console.log("Filter state for view config:", existingFilterState);

		// 预先保存空的筛选器状态到localStorage，防止加载意外的状态
		this.app.saveLocalStorage(
			`task-genius-view-filter-view-config-${this.viewConfig.id}`,
			existingFilterState,
		);

		// 手动调用 onload
		this.taskFilterComponent.onload();

		console.log("TaskFilterComponent onload called");

		// 立即加载视图配置的过滤器状态
		console.log("Loading view config filter state:", existingFilterState);
		this.taskFilterComponent.loadFilterState(existingFilterState);

		// Set up event listener for filter changes
		this.filterChangeHandler = (
			filterState: RootFilterState,
			leafId?: string,
		) => {
			// 只处理来自当前ViewConfig筛选器的变化
			if (
				this.taskFilterComponent &&
				leafId === `view-config-${this.viewConfig.id}`
			) {
				console.log(
					"Filter changed in view config modal:",
					filterState,
				);
				this.viewFilterRule.advancedFilter = filterState;
				this.checkForChanges();
			}
		};

		this.app.workspace.on(
			"task-genius:filter-changed",
			this.filterChangeHandler,
		);

		// Show the container
		this.advancedFilterContainer.style.display = "block";
		console.log("Advanced filter container should now be visible");
	}

	private cleanupAdvancedFilter() {
		if (this.taskFilterComponent) {
			try {
				// Manually unload the component
				this.taskFilterComponent.onunload();
			} catch (error) {
				console.warn("Error unloading task filter component:", error);
			}
			this.taskFilterComponent = null;
		}

		if (this.advancedFilterContainer) {
			this.advancedFilterContainer.empty();
			this.advancedFilterContainer.style.display = "none";
		}

		if (this.filterChangeHandler) {
			this.app.workspace.off(
				"task-genius:filter-changed",
				this.filterChangeHandler,
			);
			this.filterChangeHandler = null;
		}
	}
}
