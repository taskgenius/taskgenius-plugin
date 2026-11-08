import { t as settingsText } from "@/translations/helper";
import {
	App,
	Component,
	Menu,
	setIcon,
	Keymap,
	Platform,
	Workspace,
} from "obsidian";
import { Task } from "@/types/task";
import { MarkdownRendererComponent } from "@/components/ui/renderers/MarkdownRenderer";

import "@/styles/task-status-indicator.css";
import { createTaskCheckbox } from "./details";
import { TaskTimerManager } from "@/managers/timer-manager";
import { getRelativeTimeString } from "@/utils/date/date-formatter";
import { t } from "@/translations/helper";
import TaskProgressBarPlugin from "@/index";
import { TaskProgressBarSettings } from "@/common/setting-definition";
import { InlineEditor, InlineEditorOptions } from "./InlineEditor";
import { InlineEditorManager } from "./InlineEditorManager";
import { sanitizePriorityForClass } from "@/utils/task/priority-utils";
import { TaskSelectionManager } from "@/components/features/task/selection/TaskSelectionManager";
import { showBulkOperationsMenu } from "./BulkOperationsMenu";
import { TaskStatusIndicator } from "./TaskStatusIndicator";

export class TaskListItemComponent extends Component {
	public element: HTMLElement;

	// Events
	public onTaskSelected: (task: Task) => void;
	public onTaskCompleted: (task: Task) => void;
	public onTaskUpdate: (task: Task, updatedTask: Task) => Promise<void>;

	public onTaskContextMenu: (event: MouseEvent, task: Task) => void;

	private markdownRenderer: MarkdownRendererComponent;
	private containerEl: HTMLElement;
	private contentEl: HTMLElement;
	private contentMetadataContainer: HTMLElement;

	private metadataEl: HTMLElement;

	private statusIndicator: TaskStatusIndicator | null = null;
	private checkboxInput: HTMLInputElement | null = null;

	private settings: TaskProgressBarSettings;

	// Timer update interval (managed by registerInterval, auto-cleaned on unload)
	private timerEl: HTMLElement | null = null;
	private hasActiveTimerInterval: boolean = false;

	// Use shared editor manager instead of individual editors
	private static editorManager: InlineEditorManager | null = null;

	private static readonly PRIORITY_CONFIG = [
		{ value: 5, key: "Highest", icon: "triangle", class: "highest" },
		{ value: 4, key: "High", icon: "alert-triangle", class: "high" },
		{ value: 3, key: "Medium", icon: "minus", class: "medium" },
		{ value: 2, key: "Low", icon: "chevron-down", class: "low" },
		{ value: 1, key: "Lowest", icon: "chevrons-down", class: "lowest" },
	] as const;

	// Selection management
	private selectionManager: TaskSelectionManager | null = null;
	private isTaskSelectedState = false;

	constructor(
		private task: Task,
		private viewMode: string,
		private app: App,
		private plugin: TaskProgressBarPlugin,
		selectionManager?: TaskSelectionManager
	) {
		super();

		// Store selection manager reference
		this.selectionManager = selectionManager || null;

		this.element = createEl("div", {
			cls: "task-item",
			attr: { "data-task-id": this.task.id },
		});

		this.settings = this.plugin.settings;

		// Initialize shared editor manager if not exists
		if (!TaskListItemComponent.editorManager) {
			TaskListItemComponent.editorManager = new InlineEditorManager(
				this.app,
				this.plugin
			);
		}
	}

	/**
	 * Get the inline editor from the shared manager when needed
	 */
	private getInlineEditor(): InlineEditor {
		const editorOptions: InlineEditorOptions = {
			onTaskUpdate: async (originalTask: Task, updatedTask: Task) => {
				if (this.onTaskUpdate) {
					console.log(originalTask.content, updatedTask.content);
					try {
						await this.onTaskUpdate(originalTask, updatedTask);
						console.log(
							"listItem onTaskUpdate completed successfully"
						);
						// Don't update task reference here - let onContentEditFinished handle it
					} catch (error) {
						console.error("Error in listItem onTaskUpdate:", error);
						throw error; // Re-throw to let the InlineEditor handle it
					}
				} else {
					console.warn("No onTaskUpdate callback available");
				}
			},
			onContentEditFinished: (
				targetEl: HTMLElement,
				updatedTask: Task
			) => {
				// Update the task reference with the saved task
				this.task = updatedTask;

				// Re-render the markdown content after editing is finished
				this.renderMarkdown();

				// Now it's safe to update the full display
				this.updateTaskDisplay();

				// Release the editor from the manager
				TaskListItemComponent.editorManager?.releaseEditor(
					this.task.id
				);
			},
			onMetadataEditFinished: (
				targetEl: HTMLElement,
				updatedTask: Task,
				fieldType: string
			) => {
				// Update the task reference with the saved task
				this.task = updatedTask;

				// Update the task display to reflect metadata changes
				this.updateTaskDisplay();

				// Release the editor from the manager
				TaskListItemComponent.editorManager?.releaseEditor(
					this.task.id
				);
			},
			useEmbeddedEditor: true, // Enable Obsidian's embedded editor
		};

		return TaskListItemComponent.editorManager!.getEditor(
			this.task,
			editorOptions
		);
	}

	/**
	 * Check if this task is currently being edited
	 */
	private isCurrentlyEditing(): boolean {
		return (
			TaskListItemComponent.editorManager?.hasActiveEditor(
				this.task.id
			) || false
		);
	}

	onload() {
		// Register selection change listener
		if (this.selectionManager) {
			this.registerEvent(
				(this.app.workspace as Workspace).on(
					"task-genius:selection-changed",
					() => {
						this.updateSelectionVisualState();
					}
				)
			);

			// Setup long press detection for mobile
			if (Platform.isMobile) {
				this.selectionManager.longPressDetector.startDetection(
					this.element,
					{
						onLongPress: () => {
							this.selectionManager?.enterSelectionMode();
							this.handleMultiSelect();
						},
					}
				);
			}
		}

		this.registerDomEvent(this.element, "contextmenu", (event) => {
			console.log("contextmenu", event, this.task);

			// Check if we have multiple selections
			if (
				this.selectionManager &&
				this.selectionManager.getSelectedCount() > 1
			) {
				// Show bulk operations menu
				event.preventDefault();
				event.stopPropagation();

				showBulkOperationsMenu(
					event,
					this.app,
					this.plugin,
					this.selectionManager,
					() => {
						// Refresh view after operation
						// The parent view should handle this via task updates
					}
				).catch((error) => {
					console.error(
						"Failed to show bulk operations menu:",
						error
					);
				});
				return;
			}

			if (this.onTaskContextMenu) {
				this.onTaskContextMenu(event, this.task);
			}
		});

		this.renderTaskItem();
		this.updateSelectionVisualState();
	}

	private renderTaskItem() {
		if (this.statusIndicator) {
			this.removeChild(this.statusIndicator);
			this.statusIndicator = null;
		}
		this.checkboxInput = null;

		this.element.empty();

		if (this.task.completed) {
			this.element.classList.add("task-completed");
		}

		// Task checkbox for completion status
		const checkboxEl = createEl(
			"div",
			{
				cls: "task-checkbox",
			},
			(el) => {
				// Create a checkbox input element
				const checkbox = createTaskCheckbox(
					this.task.status,
					this.task,
					el
				);
				this.checkboxInput = checkbox;

				this.registerDomEvent(checkbox, "click", (event) => {
					event.stopPropagation();

					// Check if we should merge indicator with checkbox
					if (
						!this.plugin.settings.enableIndicatorWithCheckbox &&
						this.statusIndicator
					) {
						// Cycle through statuses using the status indicator
						this.statusIndicator.cycle();
					} else {
						// Original behavior - just complete the task
						if (this.onTaskCompleted) {
							this.onTaskCompleted(this.task);
						}

						if (this.task.status === " ") {
							checkbox.checked = true;
							checkbox.dataset.task = "x";
						}
					}
				});
			}
		);

		this.element.appendChild(checkboxEl);

		// Always create the status indicator (for its logic), but only render it if not merged
		this.statusIndicator = new TaskStatusIndicator({
			task: this.task,
			plugin: this.plugin,
			canInteract: () => !this.isCurrentlyEditing(),
			onStatusChange: async (previousTask, updatedTask) => {
				if (this.onTaskUpdate) {
					await this.onTaskUpdate(previousTask, updatedTask);
				}

				this.updateTask(updatedTask);

				if (this.checkboxInput) {
					this.checkboxInput.dataset.task = updatedTask.status;
					this.checkboxInput.checked = updatedTask.completed;
				}

				this.statusIndicator?.updateTask(updatedTask);
			},
		});

		this.addChild(this.statusIndicator);
		this.statusIndicator.load();

		// Only render the status indicator in the DOM if not merged with checkbox
		if (this.plugin.settings.enableIndicatorWithCheckbox) {
			const statusWrapper = this.element.createDiv({
				cls: "task-status-indicator-wrapper",
			});
			this.statusIndicator.render(statusWrapper);
		}

		this.containerEl = this.element.createDiv({
			cls: "task-item-container",
		});

		// Create content-metadata container for dynamic layout
		this.contentMetadataContainer = this.containerEl.createDiv({
			cls: "task-content-metadata-container",
		});

		// Task content
		this.contentEl = this.contentMetadataContainer.createDiv({
			cls: "task-item-content",
		});

		// Make content clickable for editing
		this.registerContentClickHandler();

		this.renderMarkdown();

		this.metadataEl = this.contentMetadataContainer.createDiv({
			cls: "task-item-metadata",
		});

		this.renderMetadata();

		const priorityValue = this.task.metadata.priority;

		if (priorityValue) {
			let numericPriority: number;
			if (typeof priorityValue === "number") {
				numericPriority = priorityValue;
			} else {
				switch (priorityValue) {
					case "low":
						numericPriority = 2;
						break;
					case "medium":
						numericPriority = 3;
						break;
					case "high":
						numericPriority = 4;
						break;
					case "highest":
						numericPriority = 5;
						break;
					case "lowest":
						numericPriority = 1;
						break;
					default:
						numericPriority = parseInt(priorityValue, 10) || 1;
						break;
				}
			}

			const priorityConfig = TaskListItemComponent.PRIORITY_CONFIG.find(
				(config) => config.value === numericPriority
			);
			const classes = ["task-priority"];
			if (priorityConfig) {
				classes.push(`priority-${priorityConfig.class}`);
			}

			if (this.plugin.settings.enableInlineEditor) {
				classes.push("task-priority-clickable");
			}

			const priorityEl = createDiv({ cls: classes });
			const icon = "!".repeat(numericPriority);
			priorityEl.textContent = icon;

			if (this.plugin.settings.enableInlineEditor) {
				const priorityTooltip = t("Click to set priority");
				priorityEl.setAttribute("aria-label", priorityTooltip);
				// priorityEl.setAttribute("title", priorityTooltip);

				this.registerDomEvent(priorityEl, "click", (e) => {
					e.stopPropagation();
					if (!this.isCurrentlyEditing()) {
						this.showPriorityMenu(priorityEl);
					}
				});
			}

			this.element.appendChild(priorityEl);
		} else if (this.plugin.settings.enableInlineEditor) {
			const addPriorityBtn = this.element.createEl("div", {
				cls: "add-priority-btn",
				attr: {
					"aria-label": t("Click to set priority"),
					// title: t("Click to set priority"),
					role: "button",
				},
			});

			this.registerDomEvent(addPriorityBtn, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					this.showPriorityMenu(addPriorityBtn);
				}
			});
		}

		// Click handler to select task
		this.registerDomEvent(this.element, "click", (e) => {
			// Check for multi-select with Shift key
			if (this.selectionManager && e.shiftKey) {
				e.stopPropagation();
				this.handleMultiSelect();
				return;
			}

			// Check if in selection mode
			if (
				this.selectionManager &&
				this.selectionManager.isSelectionMode
			) {
				e.stopPropagation();
				this.handleMultiSelect();
				return;
			}

			// Normal single selection
			if (this.onTaskSelected) {
				this.onTaskSelected(this.task);
			}
		});
	}

	private renderMetadata() {
		// Clear timer element reference before re-rendering
		this.timerEl = null;

		this.metadataEl.empty();

		// Working-on timer display: show elapsed time if timer exists
		if (
			this.viewMode === "working-on" &&
			this.plugin.settings.taskTimer?.enabled
		) {
			this.renderTimerMetadata();
		}

		// For cancelled tasks, show cancelled date (independent of completion status)
		if (this.task.metadata.cancelledDate) {
			this.renderDateMetadata(
				"cancelled",
				this.task.metadata.cancelledDate
			);
		}

		// Display dates based on task completion status
		if (!this.task.completed) {
			// For incomplete tasks, show due, scheduled, and start dates

			// Due date if available
			if (this.task.metadata.dueDate) {
				this.renderDateMetadata("due", this.task.metadata.dueDate);
			}

			// Scheduled date if available
			if (this.task.metadata.scheduledDate) {
				this.renderDateMetadata(
					"scheduled",
					this.task.metadata.scheduledDate
				);
			}

			// Start date if available
			if (this.task.metadata.startDate) {
				this.renderDateMetadata("start", this.task.metadata.startDate);
			}

			// Recurrence if available
			if (this.task.metadata.recurrence) {
				this.renderRecurrenceMetadata();
			}
		} else {
			// For completed tasks, show completion date
			if (this.task.metadata.completedDate) {
				this.renderDateMetadata(
					"completed",
					this.task.metadata.completedDate
				);
			}

			// Created date if available
			if (this.task.metadata.createdDate) {
				this.renderDateMetadata(
					"created",
					this.task.metadata.createdDate
				);
			}
		}

		// Project badge if available and not in project view
		if (
			(this.task.metadata.project || this.task.metadata.tgProject) &&
			this.viewMode !== "projects"
		) {
			this.renderProjectMetadata();
		}

		// Tags if available
		if (this.task.metadata.tags && this.task.metadata.tags.length > 0) {
			this.renderTagsMetadata();
		}

		// OnCompletion if available
		if (this.task.metadata.onCompletion) {
			this.renderOnCompletionMetadata();
		}

		// DependsOn if available
		if (
			this.task.metadata.dependsOn &&
			this.task.metadata.dependsOn.length > 0
		) {
			this.renderDependsOnMetadata();
		}

		// ID if available
		if (this.task.metadata.id) {
			this.renderIdMetadata();
		}

		// Add metadata button for adding new metadata
		this.renderAddMetadataButton();
	}

	private renderTimerMetadata() {
		const blockId = this.task.metadata?.id;
		if (!blockId) {
			return;
		}

		try {
			const timerManager = new TaskTimerManager(
				this.plugin.settings.taskTimer
			);
			const timer = timerManager.getTimerByFileAndBlock(
				this.task.filePath,
				blockId
			);
			if (!timer) {
				return;
			}

			const duration = timerManager.getCurrentDuration(timer.taskId);
			const formatted = timerManager.formatDuration(duration);

			this.timerEl = this.metadataEl.createDiv({
				cls: "task-timer-meta",
			});
			this.timerEl.createSpan({
				cls: "task-timer-duration",
				text: "⏱ " + formatted,
			});
			this.timerEl.createSpan({
				cls: "task-timer-status",
				text: ` (${t(
					timer.status === "running" ? "Running" : "Paused"
				)})`,
			});

			// Start periodic updates if timer is running
			if (timer.status === "running") {
				this.startTimerUpdateInterval();
			}
		} catch (e) {
			console.warn("[TaskListItem] Failed to render timer metadata", e);
		}
	}

	/**
	 * Start periodic timer updates using registerInterval (auto-cleaned on unload)
	 */
	private startTimerUpdateInterval() {
		// Only register once - registerInterval handles cleanup automatically
		if (this.hasActiveTimerInterval) {
			return;
		}

		this.hasActiveTimerInterval = true;

		// Update every second - registerInterval auto-cleans on component unload
		this.registerInterval(
			window.setInterval(() => {
				this.updateTimerDisplay();
			}, 1000)
		);
	}

	/**
	 * Update the timer display without re-rendering the entire metadata
	 */
	private updateTimerDisplay() {
		const blockId = this.task.metadata?.id;
		if (!blockId || !this.timerEl) {
			return;
		}

		try {
			const timerManager = new TaskTimerManager(
				this.plugin.settings.taskTimer
			);
			const timer = timerManager.getTimerByFileAndBlock(
				this.task.filePath,
				blockId
			);

			if (!timer) {
				// Timer was stopped/completed - show "Stopped" status with last known duration
				const statusSpan =
					this.timerEl.querySelector(".task-timer-status");
				if (statusSpan) {
					statusSpan.textContent = ` (${t("Stopped")})`;
					statusSpan.addClass("task-timer-stopped");
				}
				// Keep the element visible with last duration shown
				return;
			}

			// Update duration display
			const duration = timerManager.getCurrentDuration(timer.taskId);
			const formatted = timerManager.formatDuration(duration);

			const durationSpan = this.timerEl.querySelector(
				".task-timer-duration"
			);
			if (durationSpan) {
				durationSpan.textContent = "⏱ " + formatted;
			}

			// Update status display
			const statusSpan = this.timerEl.querySelector(".task-timer-status");
			if (statusSpan) {
				statusSpan.textContent = ` (${t(
					timer.status === "running" ? "Running" : "Paused"
				)})`;
				statusSpan.removeClass("task-timer-stopped");
			}
		} catch (e) {
			console.warn("[TaskListItem] Failed to update timer display", e);
		}
	}

	private renderDateMetadata(
		type:
			| "due"
			| "scheduled"
			| "start"
			| "completed"
			| "cancelled"
			| "created",
		dateValue: number
	) {
		const dateEl = this.metadataEl.createEl("div", {
			cls: ["task-date", `task-${type}-date`],
		});

		const date = new Date(dateValue);
		const dateOnly = new Date(date);
		dateOnly.setHours(0, 0, 0, 0);
		let dateText = "";
		let cssClass = "";

		if (type === "due") {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);

			// Format date
			if (dateOnly.getTime() < today.getTime()) {
				dateText =
					t("Overdue") +
					(this.settings.useRelativeTimeForDate
						? " | " + getRelativeTimeString(date)
						: "");
				cssClass = "task-overdue";
			} else if (dateOnly.getTime() === today.getTime()) {
				dateText = this.settings.useRelativeTimeForDate
					? getRelativeTimeString(date) || "Today"
					: "Today";
				cssClass = "task-due-today";
			} else if (dateOnly.getTime() === tomorrow.getTime()) {
				dateText = this.settings.useRelativeTimeForDate
					? getRelativeTimeString(date) || "Tomorrow"
					: "Tomorrow";
				cssClass = "task-due-tomorrow";
			} else {
				dateText = date.toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				});
			}
		} else {
			dateText = this.settings.useRelativeTimeForDate
				? getRelativeTimeString(date)
				: date.toLocaleDateString("en-US", {
						year: "numeric",
						month: "long",
						day: "numeric",
				  });
		}

		if (cssClass) {
			dateEl.classList.add(cssClass);
		}

		dateEl.textContent = dateText;
		dateEl.setAttribute("aria-label", date.toLocaleDateString());

		// Make date clickable for editing only if inline editor is enabled
		if (this.plugin.settings.enableInlineEditor) {
			this.registerDomEvent(dateEl, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					const dateString = this.formatDateForInput(date);
					const fieldType =
						type === "due"
							? "dueDate"
							: type === "scheduled"
							? "scheduledDate"
							: type === "start"
							? "startDate"
							: type === "cancelled"
							? "cancelledDate"
							: type === "completed"
							? "completedDate"
							: null;

					if (fieldType) {
						this.getInlineEditor().showMetadataEditor(
							dateEl,
							fieldType,
							dateString
						);
					}
				}
			});
		}
	}

	private renderProjectMetadata() {
		// Determine which project to display: original project or tgProject
		let projectName: string | undefined;
		let isReadonly = false;

		if (this.task.metadata.project) {
			// Use original project if available
			projectName = this.task.metadata.project;
		} else if (this.task.metadata.tgProject) {
			// Use tgProject as fallback
			projectName = this.task.metadata.tgProject.name;
			isReadonly = this.task.metadata.tgProject.readonly || false;
		}

		if (!projectName) return;

		const projectEl = this.metadataEl.createEl("div", {
			cls: "task-project",
		});

		// Add a visual indicator for tgProject
		if (!this.task.metadata.project && this.task.metadata.tgProject) {
			projectEl.addClass("task-project-tg");
			projectEl.title = `Project from ${
				this.task.metadata.tgProject.type
			}: ${this.task.metadata.tgProject.source || ""}`;
		}

		projectEl.textContent = projectName.split("/").pop() || projectName;

		// Make project clickable for editing only if inline editor is enabled and not readonly
		if (this.plugin.settings.enableInlineEditor && !isReadonly) {
			this.registerDomEvent(projectEl, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					this.getInlineEditor().showMetadataEditor(
						projectEl,
						"project",
						this.task.metadata.project || ""
					);
				}
			});
		}
	}

	private renderTagsMetadata() {
		const tagsContainer = this.metadataEl.createEl("div", {
			cls: "task-tags-container",
		});

		this.task.metadata.tags
			.filter((tag) => !tag.startsWith("#project"))
			.forEach((tag) => {
				const tagEl = tagsContainer.createEl("span", {
					cls: "task-tag",
					text: tag.startsWith("#") ? tag : `#${tag}`,
				});

				// Make tag clickable for editing only if inline editor is enabled
				if (this.plugin.settings.enableInlineEditor) {
					this.registerDomEvent(tagEl, "click", (e) => {
						e.stopPropagation();
						if (!this.isCurrentlyEditing()) {
							const tagsString =
								this.task.metadata.tags?.join(", ") || "";
							this.getInlineEditor().showMetadataEditor(
								tagsContainer,
								"tags",
								tagsString
							);
						}
					});
				}
			});
	}

	private renderRecurrenceMetadata() {
		const recurrenceEl = this.metadataEl.createEl("div", {
			cls: "task-date task-recurrence",
		});
		recurrenceEl.textContent = this.task.metadata.recurrence || "";

		// Make recurrence clickable for editing only if inline editor is enabled
		if (this.plugin.settings.enableInlineEditor) {
			this.registerDomEvent(recurrenceEl, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					this.getInlineEditor().showMetadataEditor(
						recurrenceEl,
						"recurrence",
						this.task.metadata.recurrence || ""
					);
				}
			});
		}
	}

	private renderOnCompletionMetadata() {
		const onCompletionEl = this.metadataEl.createEl("div", {
			cls: "task-oncompletion",
		});
		onCompletionEl.textContent = `🏁 ${this.task.metadata.onCompletion}`;

		// Make onCompletion clickable for editing only if inline editor is enabled
		if (this.plugin.settings.enableInlineEditor) {
			this.registerDomEvent(onCompletionEl, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					this.getInlineEditor().showMetadataEditor(
						onCompletionEl,
						"onCompletion",
						this.task.metadata.onCompletion || ""
					);
				}
			});
		}
	}

	private renderDependsOnMetadata() {
		const dependsOnEl = this.metadataEl.createEl("div", {
			cls: "task-dependson",
		});
		dependsOnEl.textContent = `⛔ ${this.task.metadata.dependsOn?.join(
			", "
		)}`;

		// Make dependsOn clickable for editing only if inline editor is enabled
		if (this.plugin.settings.enableInlineEditor) {
			this.registerDomEvent(dependsOnEl, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					this.getInlineEditor().showMetadataEditor(
						dependsOnEl,
						"dependsOn",
						this.task.metadata.dependsOn?.join(", ") || ""
					);
				}
			});
		}
	}

	private renderIdMetadata() {
		const idEl = this.metadataEl.createEl("div", {
			cls: "task-id",
		});
		idEl.textContent = `🆔 ${this.task.metadata.id}`;

		// Make id clickable for editing only if inline editor is enabled
		if (this.plugin.settings.enableInlineEditor) {
			this.registerDomEvent(idEl, "click", (e) => {
				e.stopPropagation();
				if (!this.isCurrentlyEditing()) {
					this.getInlineEditor().showMetadataEditor(
						idEl,
						"id",
						this.task.metadata.id || ""
					);
				}
			});
		}
	}

	private renderAddMetadataButton() {
		// Only show add metadata button if inline editor is enabled
		if (!this.plugin.settings.enableInlineEditor) {
			return;
		}

		const addButtonContainer = this.metadataEl.createDiv({
			cls: "add-metadata-container",
		});

		// Create the add metadata button
		const addBtn = addButtonContainer.createEl("button", {
			cls: "add-metadata-btn",
			attr: { "aria-label": "Add metadata" },
		});
		setIcon(addBtn, "plus");

		this.registerDomEvent(addBtn, "click", (e) => {
			e.stopPropagation();
			// Show metadata menu directly instead of calling showAddMetadataButton
			this.showMetadataMenu(addBtn);
		});
	}

	private showMetadataMenu(buttonEl: HTMLElement): void {
		const editor = this.getInlineEditor();

		// Create a temporary menu container
		const menu = new Menu();

		const availableFields = [
			{ key: "project", label: settingsText("Project"), icon: "folder" },
			{ key: "tags", label: settingsText("Tags"), icon: "tag" },
			{ key: "context", label: settingsText("Context"), icon: "at-sign" },
			{ key: "dueDate", label: settingsText("Due Date"), icon: "calendar" },
			{ key: "startDate", label: settingsText("Start Date"), icon: "play" },
			{ key: "scheduledDate", label: settingsText("Scheduled Date"), icon: "clock" },
			{ key: "cancelledDate", label: "Cancelled Date", icon: "x" },
			{ key: "completedDate", label: "Completed Date", icon: "check" },
			{ key: "priority", label: settingsText("Priority"), icon: "alert-triangle" },
			{ key: "recurrence", label: settingsText("Recurrence"), icon: "repeat" },
			{ key: "onCompletion", label: settingsText("On Completion"), icon: "flag" },
			{ key: "dependsOn", label: "Depends On", icon: "link" },
			{ key: "id", label: "Task ID", icon: "hash" },
		];

		// Filter out fields that already have values
		const fieldsToShow = availableFields.filter((field) => {
			switch (field.key) {
				case "project":
					return !this.task.metadata.project;
				case "tags":
					return (
						!this.task.metadata.tags ||
						this.task.metadata.tags.length === 0
					);
				case "context":
					return !this.task.metadata.context;
				case "dueDate":
					return !this.task.metadata.dueDate;
				case "startDate":
					return !this.task.metadata.startDate;
				case "scheduledDate":
					return !this.task.metadata.scheduledDate;
				case "cancelledDate":
					return !this.task.metadata.cancelledDate;
				case "completedDate":
					return !this.task.metadata.completedDate;
				case "priority":
					return !this.task.metadata.priority;
				case "recurrence":
					return !this.task.metadata.recurrence;
				case "onCompletion":
					return !this.task.metadata.onCompletion;
				case "dependsOn":
					return (
						!this.task.metadata.dependsOn ||
						this.task.metadata.dependsOn.length === 0
					);
				case "id":
					return !this.task.metadata.id;
				default:
					return true;
			}
		});

		// If no fields are available to add, show a message
		if (fieldsToShow.length === 0) {
			menu.addItem((item) => {
				item.setTitle(
					"All metadata fields are already set"
				).setDisabled(true);
			});
		} else {
			fieldsToShow.forEach((field) => {
				menu.addItem((item: any) => {
					item.setTitle(field.label)
						.setIcon(field.icon)
						.onClick(() => {
							// Create a temporary container for the metadata editor
							const tempContainer =
								buttonEl.parentElement!.createDiv({
									cls: "temp-metadata-editor-container",
								});

							editor.showMetadataEditor(
								tempContainer,
								field.key as any
							);
						});
				});
			});
		}

		menu.showAtPosition({
			x: buttonEl.getBoundingClientRect().left,
			y: buttonEl.getBoundingClientRect().bottom,
		});
	}

	/**
	 * Show priority selection menu
	 */
	private showPriorityMenu(buttonEl: HTMLElement): void {
		const menu = new Menu();

		TaskListItemComponent.PRIORITY_CONFIG.forEach((config) => {
			menu.addItem((item) => {
				item.setTitle(t(config.key))
					.setIcon(config.icon)
					.onClick(async () => {
						await this.updateTaskPriority(config.value);
					});
			});
		});

		menu.addItem((item) => {
			item.setTitle(t("Clear priority"))
				.setIcon("minus")
				.onClick(async () => {
					await this.updateTaskPriority(null);
				});
		});

		const rect = buttonEl.getBoundingClientRect();

		menu.showAtPosition({
			x: rect.left,
			y: rect.bottom,
		});
	}

	/**
	 * Update task priority and refresh UI
	 */
	private async updateTaskPriority(priority: number | null): Promise<void> {
		const metadata = { ...this.task.metadata };
		if (priority === null) {
			delete metadata.priority;
		} else {
			metadata.priority = priority;
		}

		const updatedTask: Task = {
			...this.task,
			metadata,
		};

		try {
			if (this.onTaskUpdate) {
				await this.onTaskUpdate(this.task, updatedTask);
			}
			this.updateTask(updatedTask);
		} catch (error) {
			console.error("Failed to update task priority:", error);
		}
	}

	private formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private renderMarkdown() {
		// Clear existing content if needed
		if (this.markdownRenderer) {
			this.removeChild(this.markdownRenderer);
		}

		// Clear the content element
		this.contentEl.empty();

		// Create new renderer immediately (no need for async)
		this.markdownRenderer = new MarkdownRendererComponent(
			this.app,
			this.contentEl,
			this.task.filePath
		);
		this.addChild(this.markdownRenderer);

		// Render the markdown content
		this.markdownRenderer.render(this.task.originalMarkdown || "\u200b");

		// Re-register the click event for editing after rendering
		this.registerContentClickHandler();

		// Update layout mode synchronously - no waiting needed
		this.updateLayoutMode();
	}

	/**
	 * Detect content height and update layout mode
	 */
	private updateLayoutMode() {
		if (!this.contentEl || !this.contentMetadataContainer) {
			return;
		}

		// Check if dynamic metadata positioning is enabled
		if (!this.plugin.settings.enableDynamicMetadataPositioning) {
			// If disabled, always use multi-line (traditional) layout
			this.contentMetadataContainer.toggleClass(
				"multi-line-content",
				true
			);
			this.contentMetadataContainer.toggleClass(
				"single-line-content",
				false
			);
			return;
		}

		// Fast synchronous detection using text content analysis
		const isMultiLine = this.detectMultiLineContent();

		// Apply appropriate layout class using Obsidian's toggleClass method
		this.contentMetadataContainer.toggleClass(
			"multi-line-content",
			isMultiLine
		);
		this.contentMetadataContainer.toggleClass(
			"single-line-content",
			!isMultiLine
		);
	}

	/**
	 * Fast detection of multi-line content using text analysis
	 */
	private detectMultiLineContent(): boolean {
		if (!this.contentEl) return true;

		// Method 1: Check for line breaks in text content
		const textContent = this.contentEl.textContent || "";
		if (textContent.includes("\n") || textContent.includes("\r")) {
			return true;
		}

		// Method 2: Quick DOM measurement without layout thrashing
		const computedStyle = window.getComputedStyle(this.contentEl);
		const fontSize = parseFloat(computedStyle.fontSize) || 16;
		const lineHeight =
			parseFloat(computedStyle.lineHeight) || fontSize * 1.4;

		// Method 3: Check if scrollHeight is significantly larger than a single line
		// Use a smaller threshold to avoid false positives
		const contentHeight = this.contentEl.scrollHeight;
		const isMultiLine = contentHeight > lineHeight * 1.1;

		// Method 4: Check for elements that typically cause multi-line layout
		const hasBlockElements = this.contentEl.querySelector(
			"br, div, p, ul, ol, li, blockquote"
		);
		if (hasBlockElements) {
			return true;
		}

		return isMultiLine;
	}

	/**
	 * Register click handler for content editing
	 */
	private registerContentClickHandler() {
		// Make content clickable for editing or navigation
		this.registerDomEvent(this.contentEl, "click", async (e) => {
			if (Keymap.isModifier(e, "Shift")) {
				return;
			}
			// Check if modifier key is pressed (Cmd/Ctrl)
			if (Keymap.isModEvent(e)) {
				// Open task in file
				e.stopPropagation();
				await this.openTaskInFile();
			} else if (
				this.plugin.settings.enableInlineEditor &&
				!this.isCurrentlyEditing()
			) {
				// Only stop propagation if we're actually going to show the editor
				e.stopPropagation();
				// Show inline editor only if enabled
				this.getInlineEditor().showContentEditor(this.contentEl);
			}
			// If inline editor is disabled, let the click bubble up to select the task
		});
	}

	private updateTaskDisplay() {
		// Re-render the entire task item
		this.renderTaskItem();
	}

	public getTask(): Task {
		return this.task;
	}

	public updateTask(task: Task) {
		const oldTask = this.task;
		this.task = task;

		// Batch DOM updates to minimize reflows
		let needsContentUpdate = false;
		let needsMetadataUpdate = false;

		// Check what needs updating
		const contentChanged =
			oldTask.originalMarkdown !== task.originalMarkdown ||
			oldTask.content !== task.content;
		const metadataChanged =
			JSON.stringify(oldTask.metadata) !== JSON.stringify(task.metadata);
		const completedChanged = oldTask.completed !== task.completed;

		// Update checkbox state
		if (this.checkboxInput) {
			this.checkboxInput.dataset.task = task.status;
			this.checkboxInput.checked = !!task.completed;
		}

		// Update status indicator
		this.statusIndicator?.updateTask(task);

		// Update completion status
		if (completedChanged) {
			this.element.toggleClass("task-completed", task.completed);
		}

		// If content changed, update the markdown display
		if (contentChanged) {
			this.renderMarkdown();
		}

		// If metadata changed, update metadata display
		if (metadataChanged) {
			this.renderMetadata();
		}
	}

	private async openTaskInFile() {
		const file = this.app.vault.getFileByPath(this.task.filePath);
		if (file) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file, {
				eState: {
					line: this.task.line,
				},
			});
		}
	}

	public setSelected(selected: boolean) {
		if (selected) {
			this.element.classList.add("selected");
		} else {
			this.element.classList.remove("selected");
		}
	}

	/**
	 * Handle multi-select toggle
	 */
	private handleMultiSelect(): void {
		if (!this.selectionManager) return;

		this.selectionManager.toggleSelection(this.task.id);
		this.updateSelectionVisualState();
	}

	/**
	 * Update visual state based on selection
	 */
	private updateSelectionVisualState(): void {
		if (!this.selectionManager) return;

		const isSelected = this.selectionManager.isTaskSelected(this.task.id);
		this.isTaskSelectedState = isSelected;

		// Update visual state
		if (isSelected) {
			this.element.classList.add("task-item-selected");
		} else {
			this.element.classList.remove("task-item-selected");
		}
	}

	onunload() {
		// Timer interval is auto-cleaned by registerInterval
		this.timerEl = null;

		// Release editor from manager if this task was being edited
		if (
			TaskListItemComponent.editorManager?.hasActiveEditor(this.task.id)
		) {
			TaskListItemComponent.editorManager.releaseEditor(this.task.id);
		}

		if (this.statusIndicator) {
			this.removeChild(this.statusIndicator);
			this.statusIndicator = null;
		}
		this.checkboxInput = null;

		this.element.detach();
	}
}
