import { App, Component, setIcon, Platform, DropdownComponent, Notice } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";
import { QuadrantColumnComponent } from "./quadrant-column";
import Sortable from "sortablejs";
import "@/styles/quadrant/quadrant.css";
import { t } from "@/translations/helper";
import { FilterComponent } from "@/components/features/task/filter/in-view/filter";
import { ActiveFilter } from "@/components/features/task/filter/in-view/filter-type";
import { QuadrantSpecificConfig } from "@/common/setting-definition";

export interface QuadrantSortOption {
	field:
		| "priority"
		| "dueDate"
		| "scheduledDate"
		| "startDate"
		| "createdDate";
	order: "asc" | "desc";
	label: string;
}

// 四象限定义
export interface QuadrantDefinition {
	id: string;
	title: string;
	description: string;
	priorityEmoji: string;
	urgentTag?: string; // 紧急任务标签
	importantTag?: string; // 重要任务标签
	className: string;
}

export const QUADRANT_DEFINITIONS: QuadrantDefinition[] = [
	{
		id: "urgent-important",
		title: t("Urgent & Important"),
		description: t("Do First - Crisis & emergencies"),
		priorityEmoji: "🔺", // Highest priority
		urgentTag: "#urgent",
		importantTag: "#important",
		className: "quadrant-urgent-important",
	},
	{
		id: "not-urgent-important",
		title: t("Not Urgent & Important"),
		description: t("Schedule - Planning & development"),
		priorityEmoji: "⏫", // High priority
		importantTag: "#important",
		className: "quadrant-not-urgent-important",
	},
	{
		id: "urgent-not-important",
		title: t("Urgent & Not Important"),
		description: t("Delegate - Interruptions & distractions"),
		priorityEmoji: "🔼", // Medium priority
		urgentTag: "#urgent",
		className: "quadrant-urgent-not-important",
	},
	{
		id: "not-urgent-not-important",
		title: t("Not Urgent & Not Important"),
		description: t("Eliminate - Time wasters"),
		priorityEmoji: "🔽", // Low priority
		className: "quadrant-not-urgent-not-important",
	},
];

export class QuadrantComponent extends Component {
	plugin: TaskProgressBarPlugin;
	app: App;
	public containerEl: HTMLElement;
	private columns: QuadrantColumnComponent[] = [];
	private columnContainerEl: HTMLElement;
	private sortableInstances: Sortable[] = [];
	private tasks: Task[] = [];
	private allTasks: Task[] = [];
	private currentViewId: string = "quadrant";
	private params: {
		onTaskStatusUpdate?: (
			taskId: string,
			newStatusMark: string
		) => Promise<void>;
		onTaskSelected?: (task: Task) => void;
		onTaskCompleted?: (task: Task) => void;
		onTaskContextMenu?: (ev: MouseEvent, task: Task) => void;
		onTaskUpdated?: (task: Task) => Promise<void>;
	};
	private filterComponent: FilterComponent | null = null;
	private activeFilters: ActiveFilter[] = [];
	private filterContainerEl: HTMLElement;
	private sortOption: QuadrantSortOption = {
		field: "priority",
		order: "desc",
		label: "Priority (High to Low)",
	};
	private hideEmptyColumns: boolean = false;

		// Per-view override from Bases
		private configOverride: Partial<QuadrantSpecificConfig> | null = null;


	// Quadrant-specific configuration
	private get quadrantConfig() {
		const view = this.plugin.settings.viewConfiguration.find(
			(v) => v.id === this.currentViewId
		);
		if (
			view &&
			view.specificConfig &&
			view.specificConfig.viewType === "quadrant"
		) {
			return { ...(view.specificConfig as any), ...(this.configOverride ?? {}) };
		}
		// Fallback to default quadrant config
		const defaultView = this.plugin.settings.viewConfiguration.find(
			(v) => v.id === "quadrant"
		);
		const base = (defaultView?.specificConfig as any) || {
			urgentTag: "#urgent",
			importantTag: "#important",
			urgentThresholdDays: 3,
		};
		return { ...base, ...(this.configOverride ?? {}) };
	}

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		parentEl: HTMLElement,
		initialTasks: Task[] = [],
		params: {
			onTaskStatusUpdate?: (
				taskId: string,
				newStatusMark: string
			) => Promise<void>;
			onTaskSelected?: (task: Task) => void;
			onTaskCompleted?: (task: Task) => void;
			onTaskContextMenu?: (ev: MouseEvent, task: Task) => void;
			onTaskUpdated?: (task: Task) => Promise<void>;
		} = {},
		viewId: string = "quadrant"
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.currentViewId = viewId;
		this.containerEl = parentEl.createDiv(
			"tg-quadrant-component-container"
		);


		this.tasks = initialTasks;
		this.params = params;
	}

	override onload() {
		super.onload();
		this.render();
	}


		public setConfigOverride(override: Partial<QuadrantSpecificConfig> | null): void {
			this.configOverride = override ?? null;
			// Re-render to apply new config safely
			this.cleanup();
			this.render();
		}

	override onunload() {
		this.cleanup();
		super.onunload();
	}

	private cleanup() {
		// Clean up sortable instances
		this.sortableInstances.forEach((sortable) => {
			sortable.destroy();
		});
		this.sortableInstances = [];

		// Clean up columns
		this.columns.forEach((column) => {
			column.onunload();
		});
		this.columns = [];

		// Clean up filter component
		if (this.filterComponent) {
			this.filterComponent.onunload();
			this.filterComponent = null;
		}
	}

	private render() {
		this.containerEl.empty();

		// Create header with controls
		this.createHeader();

		// Create filter section
		this.createFilterSection();

		// Create main quadrant grid
		this.createQuadrantGrid();

		// Initialize the view
		this.refresh();
	}

	private createHeader() {
		const headerEl = this.containerEl.createDiv("tg-quadrant-header");

		const titleEl = headerEl.createDiv("tg-quadrant-title");
		titleEl.textContent = t("Matrix");

		const controlsEl = headerEl.createDiv("tg-quadrant-controls");

		// Sort dropdown
		const sortEl = controlsEl.createDiv("tg-quadrant-sort");

		const sortOptions: QuadrantSortOption[] = [
			{
				field: "priority",
				order: "desc",
				label: t("Priority (High to Low)"),
			},
			{
				field: "priority",
				order: "asc",
				label: t("Priority (Low to High)"),
			},
			{
				field: "dueDate",
				order: "asc",
				label: t("Due Date (Earliest First)"),
			},
			{
				field: "dueDate",
				order: "desc",
				label: t("Due Date (Latest First)"),
			},
			{
				field: "createdDate",
				order: "desc",
				label: t("Created Date (Newest First)"),
			},
			{
				field: "createdDate",
				order: "asc",
				label: t("Created Date (Oldest First)"),
			},
		];

		// 创建 DropdownComponent 并添加到 sortEl
		const sortDropdown = new DropdownComponent(sortEl);

		// 填充下拉选项
		sortOptions.forEach((option) => {
			const value = `${option.field}-${option.order}`;
			sortDropdown.addOption(value, option.label);
		});

		// 设置当前选中项（如果有）
		const currentValue = `${this.sortOption.field}-${this.sortOption.order}`;
		sortDropdown.setValue(currentValue);

		// 监听下拉选择变化
		sortDropdown.onChange((value: string) => {
			const [field, order] = value.split("-");
			const newSortOption =
				sortOptions.find(
					(opt) => opt.field === field && opt.order === order
				) || this.sortOption;

			// Only update if the sort option actually changed
			if (
				newSortOption.field !== this.sortOption.field ||
				newSortOption.order !== this.sortOption.order
			) {
				console.log(
					`Sort option changed from ${this.sortOption.field}-${this.sortOption.order} to ${newSortOption.field}-${newSortOption.order}`
				);
				this.sortOption = newSortOption;
				// Force refresh all columns since sorting affects all quadrants
				this.forceRefreshAll();
			}
		});
	}

	private createFilterSection() {
		this.filterContainerEl = this.containerEl.createDiv(
			"tg-quadrant-filter-container"
		);
	}

	private createQuadrantGrid() {
		this.columnContainerEl = this.containerEl.createDiv("tg-quadrant-grid");

		// Create four quadrant columns
		QUADRANT_DEFINITIONS.forEach((quadrant) => {
			const columnEl = this.columnContainerEl.createDiv(
				`tg-quadrant-column ${quadrant.className}`
			);

			const column = new QuadrantColumnComponent(
				this.app,
				this.plugin,
				columnEl,
				quadrant,
				{
					onTaskStatusUpdate: async (
						taskId: string,
						newStatus: string
					) => {
						// Call the original callback if provided
						if (this.params.onTaskStatusUpdate) {
							await this.params.onTaskStatusUpdate(
								taskId,
								newStatus
							);
						}
						// Trigger a refresh to re-categorize tasks after any task update
						setTimeout(() => {
							this.refreshSelectively();
						}, 100);
					},
					onTaskSelected: this.params.onTaskSelected,
					onTaskCompleted: this.params.onTaskCompleted,
					onTaskContextMenu: this.params.onTaskContextMenu,
					onTaskUpdated: this.params.onTaskUpdated,
				}
			);

			this.addChild(column);
			this.columns.push(column);

			// Setup drag and drop for this column
			this.setupDragAndDrop(columnEl, quadrant);
		});
	}

	private setupDragAndDrop(
		columnEl: HTMLElement,
		quadrant: QuadrantDefinition
	) {
		const contentEl = columnEl.querySelector(
			".tg-quadrant-column-content"
		) as HTMLElement;
		if (!contentEl) return;

		// Detect if we're on a mobile device for optimized settings
		const isMobile = Platform.isMobile;

		const sortable = new Sortable(contentEl, {
			group: "quadrant-tasks",
			draggable: ".tg-quadrant-card",
			filter: "button, input, select, textarea, a",
			preventOnFilter: false,
			emptyInsertThreshold: 20,
			delayOnTouchOnly: true,
			animation: 150,
			ghostClass: "tg-quadrant-card--ghost",
			dragClass: "tg-quadrant-card--dragging",
			// Mobile-specific optimizations - following kanban pattern
			delay: isMobile ? 150 : 0, // Longer delay on mobile to distinguish from scroll
			touchStartThreshold: isMobile ? 5 : 3, // More threshold on mobile
			forceFallback: false, // Use native HTML5 drag when possible
			fallbackOnBody: true, // Append ghost to body for better mobile performance
			// Scroll settings for mobile
			scroll: true, // Enable auto-scrolling
			scrollSensitivity: isMobile ? 50 : 30, // Higher sensitivity on mobile
			scrollSpeed: isMobile ? 15 : 10, // Faster scroll on mobile
			bubbleScroll: true, // Enable bubble scrolling for nested containers

			onEnd: (event) => {
				this.handleSortEnd(event, quadrant);
			},
		});

		this.sortableInstances.push(sortable);
	}

	private handleTaskReorder(evt: any, quadrant: QuadrantDefinition) {
		const taskEl = evt.item;
		const taskId = taskEl.getAttribute("data-task-id");

		if (!taskId || evt.oldIndex === evt.newIndex) return;

		// Update task order within the same quadrant
		const task = this.tasks.find((t) => t.id === taskId);
		if (!task) return;

		// You could implement custom ordering logic here
		// For example, updating a custom order field in task metadata
		console.log(
			`Reordered task ${taskId} from position ${evt.oldIndex} to ${evt.newIndex} in quadrant ${quadrant.id}`
		);
	}

	private async handleSortEnd(
		event: Sortable.SortableEvent,
		sourceQuadrant: QuadrantDefinition
	) {
		console.log("Quadrant sort end:", event.oldIndex, event.newIndex);
		const taskId = event.item.dataset.taskId;
		const dropTargetColumnContent = event.to;
		const sourceColumnContent = event.from;

		if (taskId && dropTargetColumnContent && sourceColumnContent) {
			// Get target quadrant information
			const targetQuadrantId =
				dropTargetColumnContent.getAttribute("data-quadrant-id");
			const targetQuadrant = QUADRANT_DEFINITIONS.find(
				(q) => q.id === targetQuadrantId
			);

			// Get source quadrant information
			const sourceQuadrantId =
				sourceColumnContent.getAttribute("data-quadrant-id");
			const actualSourceQuadrant = QUADRANT_DEFINITIONS.find(
				(q) => q.id === sourceQuadrantId
			);

			if (targetQuadrant && actualSourceQuadrant) {
				// Handle cross-quadrant moves
				if (targetQuadrantId !== sourceQuadrantId) {
					console.log(
						`Moving task ${taskId} from ${sourceQuadrantId} to ${targetQuadrantId}`
					);
					await this.updateTaskQuadrant(
						taskId,
						targetQuadrant,
						actualSourceQuadrant
					);
				} else if (event.oldIndex !== event.newIndex) {
					// Handle reordering within the same quadrant
					console.log(
						`Reordering task ${taskId} within ${targetQuadrantId}`
					);
					this.handleTaskReorder(event, targetQuadrant);
				}
			}
		}
	}

	private async updateTaskQuadrant(
		taskId: string,
		quadrant: QuadrantDefinition,
		sourceQuadrant?: QuadrantDefinition
	) {
		const task = this.tasks.find((t) => t.id === taskId);
		if (!task) return;

		try {
			const urgent = this.quadrantConfig.urgentTag || "#urgent";
			const important = this.quadrantConfig.importantTag || "#important";
			const normalize = (tag: string) => tag.replace(/^#/, "").toLowerCase();
			const tags = (task.metadata?.tags || []).filter(tag => ![normalize(urgent), normalize(important)].includes(normalize(tag)) && !normalize(tag).startsWith("quadrant/"));
			if (quadrant.id.startsWith("urgent-")) tags.push(urgent);
			if (quadrant.id.endsWith("-important") && !quadrant.id.endsWith("-not-important")) tags.push(important);
			// An explicit matrix placement must survive a near due date or keyword inference.
			tags.push(`#quadrant/${quadrant.id}`);
			const updatedTask: Task = { ...task, metadata: { ...task.metadata, tags } };
			if (this.quadrantConfig.usePriorityForClassification) {
				updatedTask.metadata.priority = { "urgent-important": 5, "not-urgent-important": 3, "urgent-not-important": 4, "not-urgent-not-important": 2 }[quadrant.id];
			}
			if (!this.plugin.writeAPI) throw new Error("Task writer is unavailable");
			const result = await this.plugin.writeAPI.updateTask({ taskId, updates: { metadata: updatedTask.metadata } });
			if (!result.success) throw new Error(result.error || "Task update failed");
			this.allTasks = this.allTasks.map(item => item.id === taskId ? updatedTask : item);
			this.tasks = this.tasks.map(item => item.id === taskId ? updatedTask : item);
			this.showUpdateFeedback(updatedTask, quadrant);
		} catch (error) {
			console.error("Failed to update task quadrant:", error);
			this.showErrorFeedback(task, error);
		} finally { this.refresh(); }
	}

	private showUpdateFeedback(_task: Task, quadrant: QuadrantDefinition) {
		// Use Obsidian's native Notice API for feedback
		const message = `${quadrant.priorityEmoji} ${t("Task moved to")} ${quadrant.title}`;
		new Notice(message, 2000);
	}

	private showErrorFeedback(_task: Task, error: any) {
		console.error("Task update error:", error);

		// Use Obsidian's native Notice API for error feedback
		const message = `⚠️ ${t("Failed to update task")}`;
		new Notice(message, 3000);
	}

	private categorizeTasksByQuadrant(tasks: Task[]): Map<string, Task[]> {
		const quadrantTasks = new Map<string, Task[]>();

		// Initialize all quadrants
		QUADRANT_DEFINITIONS.forEach((quadrant) => {
			quadrantTasks.set(quadrant.id, []);
		});

		tasks.forEach((task) => {
			const quadrantId = this.determineTaskQuadrant(task);
			const quadrantTaskList = quadrantTasks.get(quadrantId) || [];
			quadrantTaskList.push(task);
			quadrantTasks.set(quadrantId, quadrantTaskList);
		});

		return quadrantTasks;
	}

	private determineTaskQuadrant(task: Task): string {
		const explicit = (task.metadata?.tags || []).map(tag => tag.replace(/^#/, "")).find(tag => tag.startsWith("quadrant/"))?.slice(9);
		if (explicit && QUADRANT_DEFINITIONS.some(quadrant => quadrant.id === explicit)) return explicit;
		let isUrgent = false;
		let isImportant = false;

		if (this.quadrantConfig.usePriorityForClassification) {
			// Use priority-based classification
			const priority = task.metadata?.priority || 0;
			const urgentThreshold =
				this.quadrantConfig.urgentPriorityThreshold || 4;
			const importantThreshold =
				this.quadrantConfig.importantPriorityThreshold || 3;

			isUrgent = priority >= urgentThreshold;
			isImportant = priority >= importantThreshold;
		} else {
			// Use tag-based classification
			const content = task.content.toLowerCase();
			const tags = task.metadata?.tags || [];

			// Check urgency: explicit tags, priority level (4-5), or due date
			const urgentTag = (
				this.quadrantConfig.urgentTag || "#urgent"
			).toLowerCase();
			const isUrgentByTag =
				content.includes(urgentTag) || tags.includes(urgentTag);
			const isUrgentByOtherCriteria = this.isTaskUrgent(task);
			isUrgent = isUrgentByTag || isUrgentByOtherCriteria;

			// Check importance: explicit tags, priority level (3-5), or important keywords
			const importantTag = (
				this.quadrantConfig.importantTag || "#important"
			).toLowerCase();
			const isImportantByTag =
				content.includes(importantTag) || tags.includes(importantTag);
			const isImportantByOtherCriteria = this.isTaskImportant(task);
			isImportant = isImportantByTag || isImportantByOtherCriteria;
		}

		if (isUrgent && isImportant) {
			return "urgent-important";
		} else if (!isUrgent && isImportant) {
			return "not-urgent-important";
		} else if (isUrgent && !isImportant) {
			return "urgent-not-important";
		} else {
			return "not-urgent-not-important";
		}
	}

	private isTaskUrgent(task: Task): boolean {
		// Check if task has high priority emojis or due date is soon
		const hasHighPriority = /[🔺⏫]/.test(task.content);

		// Check numeric priority - higher values (4-5) indicate urgent tasks
		const hasHighNumericPriority =
			task.metadata?.priority && task.metadata.priority >= 4;

		// Use configured threshold for urgent due dates
		const urgentThresholdMs =
			(this.quadrantConfig.urgentThresholdDays || 3) *
			24 *
			60 *
			60 *
			1000;
		const hasSoonDueDate =
			task.metadata?.dueDate &&
			task.metadata.dueDate <= Date.now() + urgentThresholdMs;

		return hasHighPriority || hasHighNumericPriority || !!hasSoonDueDate;
	}

	private isTaskImportant(task: Task): boolean {
		// Check if task has medium-high priority or is part of important projects
		const hasMediumHighPriority = /[🔺⏫🔼]/.test(task.content);

		// Check numeric priority - higher values (3-5) indicate important tasks
		const hasImportantNumericPriority =
			task.metadata?.priority && task.metadata.priority >= 3;

		// Could also check for important project tags or keywords
		const hasImportantKeywords =
			/\b(goal|project|milestone|strategic)\b/i.test(task.content);

		return (
			hasMediumHighPriority ||
			hasImportantNumericPriority ||
			hasImportantKeywords
		);
	}

	public setTasks(tasks: Task[]) {
		this.allTasks = tasks.map(task => ({ ...task, metadata: { ...task.metadata, tags: [...(task.metadata.tags || [])] } }));
		this.applyFilters();
	}

	private applyFilters() {
		// Apply active filters to tasks
		let filteredTasks = [...this.allTasks];

		// TODO: Apply active filters here if needed
		// for (const filter of this.activeFilters) {
		//     filteredTasks = this.applyFilter(filteredTasks, filter);
		// }

		this.tasks = filteredTasks;
		this.refreshSelectively();
	}

	public refresh() {
		this.refreshSelectively();
	}

	/**
	 * Selective refresh - only update columns that have changed tasks
	 */
	private refreshSelectively() {
		if (!this.columns.length) return;

		// Categorize tasks by quadrant
		const newQuadrantTasks = this.categorizeTasksByQuadrant(this.tasks);

		// Compare with previous state and only update changed columns
		this.columns.forEach((column) => {
			const quadrantId = column.getQuadrantId();
			const newTasks = newQuadrantTasks.get(quadrantId) || [];
			const currentTasks = column.getTasks();

			// Check if tasks have actually changed for this column
			if (this.hasTasksChanged(currentTasks, newTasks)) {
				console.log(
					`Tasks changed for quadrant ${quadrantId}, updating...`
				);

				// Sort tasks within each quadrant
				const sortedTasks = this.sortTasks(newTasks);

				// Set tasks for the column
				column.setTasks(sortedTasks);

				// Update visibility
				if (this.hideEmptyColumns && column.isEmpty()) {
					column.setVisibility(false);
				} else {
					column.setVisibility(true);
				}

				// Force load content only for this specific column if needed
				if (!column.isEmpty() && !column.isLoaded()) {
					setTimeout(() => {
						column.forceLoadContent();
					}, 50);
				}
			} else {
				console.log(
					`No changes for quadrant ${quadrantId}, skipping update`
				);
			}
		});
	}

	/**
	 * Check if tasks have changed between current and new task lists
	 */
	private hasTasksChanged(currentTasks: Task[], newTasks: Task[]): boolean {
		// Quick length check
		if (currentTasks.length !== newTasks.length) {
			return true;
		}

		// If both are empty, no change
		if (currentTasks.length === 0 && newTasks.length === 0) {
			return false;
		}

		// Create sets of task IDs for comparison
		const currentIds = new Set(currentTasks.map((task) => task.id));
		const newIds = new Set(newTasks.map((task) => task.id));

		// Check if task IDs are different
		if (currentIds.size !== newIds.size) {
			return true;
		}

		// Check if any task ID is different
		for (const id of currentIds) {
			if (!newIds.has(id)) {
				return true;
			}
		}

		// Check if task order has changed (important for sorting)
		for (let i = 0; i < currentTasks.length; i++) {
			if (currentTasks[i].id !== newTasks[i].id) {
				return true; // Order changed
			}
		}

		// Check if task content has changed (more detailed comparison)
		const currentTaskMap = new Map(
			currentTasks.map((task) => [task.id, task])
		);
		const newTaskMap = new Map(newTasks.map((task) => [task.id, task]));

		for (const [id, newTask] of newTaskMap) {
			const currentTask = currentTaskMap.get(id);
			if (!currentTask) {
				return true; // New task
			}

			// Check if task content or metadata has changed
			if (this.hasTaskContentChanged(currentTask, newTask)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if individual task content has changed
	 */
	private hasTaskContentChanged(currentTask: Task, newTask: Task): boolean {
		// Compare basic properties
		if (currentTask.content !== newTask.content) {
			return true;
		}

		if (currentTask.status !== newTask.status) {
			return true;
		}

		// Compare metadata if it exists
		if (currentTask.metadata && newTask.metadata) {
			// Check priority
			if (currentTask.metadata.priority !== newTask.metadata.priority) {
				return true;
			}

			// Check dates
			if (currentTask.metadata.dueDate !== newTask.metadata.dueDate) {
				return true;
			}

			if (
				currentTask.metadata.scheduledDate !==
				newTask.metadata.scheduledDate
			) {
				return true;
			}

			if (currentTask.metadata.startDate !== newTask.metadata.startDate) {
				return true;
			}

			// Check tags
			const currentTags = currentTask.metadata.tags || [];
			const newTags = newTask.metadata.tags || [];
			if (
				currentTags.length !== newTags.length ||
				!currentTags.every((tag) => newTags.includes(tag))
			) {
				return true;
			}
		} else if (currentTask.metadata !== newTask.metadata) {
			// One has metadata, the other doesn't
			return true;
		}

		return false;
	}

	/**
	 * Force refresh all columns (fallback for when selective refresh isn't sufficient)
	 */
	public forceRefreshAll() {
		console.log("Force refreshing all columns");
		if (!this.columns.length) return;

		// Categorize tasks by quadrant
		const quadrantTasks = this.categorizeTasksByQuadrant(this.tasks);

		// Update each column
		this.columns.forEach((column) => {
			const quadrantId = column.getQuadrantId();
			const tasks = quadrantTasks.get(quadrantId) || [];

			// Sort tasks within each quadrant
			const sortedTasks = this.sortTasks(tasks);

			// Set tasks for the column
			column.setTasks(sortedTasks);

			// Hide empty columns if needed
			if (this.hideEmptyColumns && column.isEmpty()) {
				column.setVisibility(false);
			} else {
				column.setVisibility(true);
			}
		});

		// Force load content for all visible columns after a short delay
		setTimeout(() => {
			this.forceLoadAllColumns();
		}, 200);
	}

	private forceLoadAllColumns() {
		console.log("Force loading all columns");
		this.columns.forEach((column) => {
			if (!column.isEmpty()) {
				column.forceLoadContent();
			}
		});
	}

	/**
	 * Update a specific quadrant column
	 */
	public updateQuadrant(quadrantId: string, tasks?: Task[]) {
		const column = this.columns.find(
			(col) => col.getQuadrantId() === quadrantId
		);
		if (!column) {
			console.warn(`Quadrant column not found: ${quadrantId}`);
			return;
		}

		let tasksToUpdate: Task[];
		if (tasks) {
			// Use provided tasks
			tasksToUpdate = tasks;
		} else {
			// Recalculate tasks for this quadrant only
			const quadrantTasks = this.categorizeTasksByQuadrant(this.tasks);
			tasksToUpdate = quadrantTasks.get(quadrantId) || [];
		}

		// Sort tasks
		const sortedTasks = this.sortTasks(tasksToUpdate);

		// Update only this column
		column.setTasks(sortedTasks);

		// Update visibility
		if (this.hideEmptyColumns && column.isEmpty()) {
			column.setVisibility(false);
		} else {
			column.setVisibility(true);
		}

		console.log(
			`Updated quadrant ${quadrantId} with ${sortedTasks.length} tasks`
		);
	}

	/**
	 * Batch update multiple quadrants
	 */
	public updateQuadrants(updates: { quadrantId: string; tasks?: Task[] }[]) {
		updates.forEach(({ quadrantId, tasks }) => {
			this.updateQuadrant(quadrantId, tasks);
		});
	}

	private sortTasks(tasks: Task[]): Task[] {
		const sortedTasks = [...tasks];

		console.log(
			`Sorting ${tasks.length} tasks by ${this.sortOption.field} (${this.sortOption.order})`
		);

		sortedTasks.sort((a, b) => {
			let aValue: any, bValue: any;

			switch (this.sortOption.field) {
				case "priority":
					aValue = this.getTaskPriorityValue(a);
					bValue = this.getTaskPriorityValue(b);
					break;
				case "dueDate":
					aValue = a.metadata?.dueDate || 0;
					bValue = b.metadata?.dueDate || 0;
					break;
				case "scheduledDate":
					aValue = a.metadata?.scheduledDate || 0;
					bValue = b.metadata?.scheduledDate || 0;
					break;
				case "startDate":
					aValue = a.metadata?.startDate || 0;
					bValue = b.metadata?.startDate || 0;
					break;
				case "createdDate":
					aValue = a.metadata?.createdDate || 0;
					bValue = b.metadata?.createdDate || 0;
					break;
				default:
					return 0;
			}

			if (this.sortOption.order === "asc") {
				return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
			} else {
				return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
			}
		});

		// Log first few tasks for debugging
		if (sortedTasks.length > 0) {
			console.log(
				`First 3 sorted tasks:`,
				sortedTasks.slice(0, 3).map((t) => ({
					id: t.id,
					content: t.content.substring(0, 50),
					priority: this.getTaskPriorityValue(t),
					dueDate: t.metadata?.dueDate,
					scheduledDate: t.metadata?.scheduledDate,
				}))
			);
		}

		return sortedTasks;
	}

	private getTaskPriorityValue(task: Task): number {
		// First check if task has numeric priority in metadata
		if (
			task.metadata?.priority &&
			typeof task.metadata.priority === "number"
		) {
			return task.metadata.priority;
		}

		// Fallback to emoji-based priority detection
		if (task.content.includes("🔺")) return 5; // Highest
		if (task.content.includes("⏫")) return 4; // High
		if (task.content.includes("🔼")) return 3; // Medium
		if (task.content.includes("🔽")) return 2; // Low
		if (task.content.includes("⏬")) return 1; // Lowest
		return 0; // No priority
	}

	public getQuadrantStats(): { [key: string]: number } {
		const quadrantTasks = this.categorizeTasksByQuadrant(this.tasks);
		const stats: { [key: string]: number } = {};

		QUADRANT_DEFINITIONS.forEach((quadrant) => {
			stats[quadrant.id] = quadrantTasks.get(quadrant.id)?.length || 0;
		});

		return stats;
	}
}
