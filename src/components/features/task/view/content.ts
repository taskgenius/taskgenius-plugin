import {
	App,
	Component,
	setIcon,
	debounce,
	ExtraButtonComponent,
	Menu,
} from "obsidian";
import { Task } from "@/types/task";
import { TaskListItemComponent } from "./listItem"; // Re-import needed components
import { ViewMode, getViewSettingOrDefault } from "@/common/setting-definition"; // 导入 SortCriterion
import {
	tasksToTree,
	isValidTreeParent,
} from "@/utils/ui/tree-view-utils"; // Re-import needed utils
import { TaskTreeItemComponent } from "./treeItem"; // Re-import needed components
import { t } from "@/translations/helper";
import TaskProgressBarPlugin from "@/index";
import { getInitialViewMode, saveViewMode } from "@/utils/ui/view-mode-utils";
import { TopNavigation } from "@/components/features/fluent/components/FluentTopNavigation";
import { TaskTimerManager } from "@/managers/timer-manager";
import { TimerStatisticsPanel } from "./TimerStatisticsPanel";

import "@/styles/task-list.scss";
import "@/styles/tree-view.scss";
import "@/styles/modern.scss";
import "@/styles/group-by.scss";

// @ts-ignore
import { filterTasks } from "@/utils/task/task-filter-utils";
import { sortTasks } from "@/commands/sortTaskCommands"; // 导入 sortTasks 函数
import { TaskSelectionManager } from "@/components/features/task/selection/TaskSelectionManager";
import { GroupByDimension, TaskGroup } from "@/types/groupBy";
import {
	groupTasksBy,
	groupTasksByFilePathNested,
} from "@/utils/grouping/taskGrouping";
import {
	getGroupByConfig,
	setGroupByConfig,
	getGroupExpandedState,
	setGroupExpandedState,
} from "@/utils/grouping/groupByStorage";
import { TaskListRendererComponent } from "./TaskList";

interface ContentComponentParams {
	onTaskSelected?: (task: Task | null) => void;
	onTaskCompleted?: (task: Task) => void;
	onTaskUpdate?: (originalTask: Task, updatedTask: Task) => Promise<void>;
	onTaskContextMenu?: (event: MouseEvent, task: Task) => void;
	selectionManager?: TaskSelectionManager;
}

export class ContentComponent extends Component {
	public containerEl: HTMLElement;
	private headerEl: HTMLElement;
	private taskListEl: HTMLElement; // Container for rendering
	private filterInput: HTMLInputElement;
	private titleEl: HTMLElement;
	private countEl: HTMLElement;

	// Task data
	private allTasks: Task[] = [];
	private notFilteredTasks: Task[] = [];
	private filteredTasks: Task[] = []; // Tasks after filters applied
	private selectedTask: Task | null = null;

	// Child Components (managed by InboxComponent for lazy loading)
	private taskComponents: TaskListItemComponent[] = [];
	private treeComponents: TaskTreeItemComponent[] = [];

	// Virtualization State
	private taskListObserver: IntersectionObserver;
	private taskPageSize = 50; // Number of tasks to load per batch
	private nextTaskIndex = 0; // Index for next list item batch
	private nextRootTaskIndex = 0; // Index for next tree root batch
	private rootTasks: Task[] = []; // Root tasks for tree view

	// Group By State
	private groupByDimension: GroupByDimension = "none";
	private taskGroups: TaskGroup[] = [];

	// Top Navigation reference (for registering custom buttons)
	private topNavigation: TopNavigation | null = null;
	private workingOnSummaryEl: HTMLElement | null = null;

	// Timer Statistics Panel
	private timerStatisticsPanel: TimerStatisticsPanel | null = null;
	private isShowingTimerStats: boolean = false;

	// State
	private currentViewId: ViewMode = "inbox"; // Renamed from currentViewMode
	private selectedProjectForView: string | null = null; // Keep track if a specific project is filtered (for project view)
	private focusFilter: string | null = null; // Keep focus filter if needed
	private isTreeView: boolean = false;
	private isRendering: boolean = false; // Guard against concurrent renders
	private pendingForceRefresh: boolean = false; // Track if a force refresh is pending
	private pendingVisibilityRetry: boolean = false; // Queue a retry when container becomes visible
	private visibilityRetryCount: number = 0; // Limit visibility retry loop
	private lastAllTasksSignature = "";
	private lastNotFilteredTasksSignature = "";
	constructor(
		private parentEl: HTMLElement,
		private app: App,
		private plugin: TaskProgressBarPlugin,
		private params: ContentComponentParams = {},
	) {
		super();
	}

	onload() {
		// Create main content container
		this.containerEl = this.parentEl.createDiv({ cls: "task-content" });

		// Create header
		this.createContentHeader();

		// Create task list container
		this.taskListEl = this.containerEl.createDiv({ cls: "task-list" });

		// Initialize view mode from saved state or global default
		this.initializeViewMode();

		// Initialize Group By from saved state
		this.initializeGroupBy();

		// Set up intersection observer for lazy loading
		this.initializeVirtualList();
	}

	private createContentHeader() {
		this.headerEl = this.containerEl.createDiv({ cls: "content-header" });

		// View title - will be updated in setViewMode
		this.titleEl = this.headerEl.createDiv({
			cls: "content-title",
			text: t("Inbox"), // Default title
		});

		// Task count
		this.countEl = this.headerEl.createDiv({
			cls: "task-count",
			text: t("0 tasks"),
		});

		// Filter controls container
		const filterControlsEl = this.headerEl.createDiv({
			cls: "content-filter-controls",
		});

		// Filter controls
		const filterEl = filterControlsEl.createDiv({ cls: "content-filter" });
		this.filterInput = filterEl.createEl("input", {
			cls: "filter-input",
			attr: { type: "text", placeholder: t("Filter tasks...") },
		});

		// View toggle button
		const viewToggleBtn = this.headerEl.createDiv({
			cls: "view-toggle-btn",
		});
		setIcon(viewToggleBtn, "list"); // Set initial icon
		viewToggleBtn.setAttribute("aria-label", t("Toggle list/tree view"));
		this.registerDomEvent(viewToggleBtn, "click", () => {
			this.toggleViewMode();
		});

		// Focus filter button (remains commented out)
		// ...

		// Event listeners
		let filterTimeout: number;
		this.registerDomEvent(this.filterInput, "input", () => {
			clearTimeout(filterTimeout);
			filterTimeout = window.setTimeout(() => {
				this.filterTasks(this.filterInput.value);
			}, 300); // 增加 300ms 防抖延迟
		});
	}

	private initializeVirtualList() {
		this.taskListObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (
						entry.isIntersecting &&
						entry.target.classList.contains("task-load-marker")
					) {
						// console.log(
						// 	"Load marker intersecting, calling loadMoreTasks..."
						// );
						// Target is the load marker, load more tasks
						this.loadMoreTasks();
					}
				});
			},
			{
				root: this.taskListEl, // Observe within the task list container
				threshold: 0.1, // Trigger when 10% of the marker is visible
			},
		);
	}

	/**
	 * Initialize view mode from saved state or global default
	 */
	private initializeViewMode() {
		this.isTreeView = getInitialViewMode(
			this.app,
			this.plugin,
			this.currentViewId,
		);
		// Update the toggle button icon to match the initial state
		const viewToggleBtn = this.headerEl?.querySelector(
			".view-toggle-btn",
		) as HTMLElement;
		if (viewToggleBtn) {
			setIcon(viewToggleBtn, this.isTreeView ? "git-branch" : "list");
		}
	}

	private toggleViewMode() {
		this.isTreeView = !this.isTreeView;
		const viewToggleBtn = this.headerEl.querySelector(
			".view-toggle-btn",
		) as HTMLElement;
		if (viewToggleBtn) {
			setIcon(viewToggleBtn, this.isTreeView ? "git-branch" : "list");
		}

		console.log("toggle view mode");
		// Save the new view mode state
		saveViewMode(this.app, this.currentViewId, this.isTreeView);
		this.debounceRefreshTaskList(); // Refresh list completely on view mode change
	}

	public setIsTreeView(isTree: boolean) {
		if (this.isTreeView !== isTree) {
			this.isTreeView = isTree;
			const viewToggleBtn = this.headerEl?.querySelector(
				".view-toggle-btn",
			) as HTMLElement;
			if (viewToggleBtn) {
				setIcon(viewToggleBtn, this.isTreeView ? "git-branch" : "list");
			}
			this.debounceRefreshTaskList();
		}
	}

	/**
	 * Initialize Group By from saved state
	 */
	private initializeGroupBy() {
		this.groupByDimension = getGroupByConfig(this.currentViewId);
	}

	/**
	 * Show the Group By menu using Obsidian's native Menu
	 */
	private showGroupByMenu(): void {
		const menu = new Menu();

		// Define grouping options
		const groupByOptions: Array<{
			value: GroupByDimension;
			label: string;
			icon: string;
		}> = [
			{ value: "none", label: t("None"), icon: "x" },
			{ value: "filePath", label: t("File Path"), icon: "folder" },
			{ value: "dueDate", label: t("Due Date"), icon: "calendar" },
			{ value: "priority", label: t("Priority"), icon: "signal" },
			{ value: "project", label: t("Project"), icon: "folder-tree" },
			{ value: "tags", label: t("Tags"), icon: "tag" },
			{ value: "status", label: t("Status"), icon: "check-circle" },
		];

		// Add menu items
		groupByOptions.forEach((option) => {
			menu.addItem((item) => {
				item.setTitle(option.label)
					.setIcon(option.icon)
					.setChecked(this.groupByDimension === option.value)
					.onClick(() => {
						if (option.value !== this.groupByDimension) {
							this.groupByDimension = option.value;
							setGroupByConfig(this.currentViewId, option.value);
							this.applyFilters(); // Re-apply filters and grouping
							this.debounceRefreshTaskList();
						}
					});
			});
		});

		// Show menu at button position
		const buttonEl = document.querySelector(
			'.fluent-nav-custom-buttons [aria-label="' + t("Group By") + '"]',
		) as HTMLElement;

		if (buttonEl) {
			menu.showAtMouseEvent(
				new MouseEvent("click", {
					clientX: buttonEl.getBoundingClientRect().left,
					clientY: buttonEl.getBoundingClientRect().bottom,
				}),
			);
		} else {
			// Fallback: show at current mouse position
			menu.showAtMouseEvent(new MouseEvent("click"));
		}
	}

	/**
	 * Apply grouping to filtered tasks
	 */
	private applyGrouping() {
		if (this.groupByDimension === "none") {
			this.taskGroups = [];
			return;
		}

		// Use nested grouping for filePath dimension
		if (this.groupByDimension === "filePath") {
			this.taskGroups = groupTasksByFilePathNested(this.filteredTasks);
		} else {
			this.taskGroups = groupTasksBy(
				this.filteredTasks,
				this.groupByDimension,
				this.plugin.settings,
			);
		}
	}

	/**
	 * Render grouped tasks in sections (similar to forecast view)
	 * Supports nested groups with lazy rendering (collapsed groups don't render tasks)
	 */
	private renderGroupedTasks() {
		// Cleanup any group renderers from previous render
		this.cleanupGroupRenderers();

		// Build task map for tree view
		const taskMap = new Map<string, Task>();
		this.notFilteredTasks.forEach((task) => taskMap.set(task.id, task));

		// Render each top-level group recursively
		this.taskGroups.forEach((group) => {
			this.renderGroupRecursive(group, this.taskListEl, taskMap, 0);
		});
	}

	/**
	 * Recursively render a group and its children
	 * @param group - The group to render
	 * @param containerEl - Parent container element
	 * @param taskMap - Map of all tasks for tree view
	 * @param level - Nesting level (0 = top level)
	 */
	private renderGroupRecursive(
		group: TaskGroup,
		containerEl: HTMLElement,
		taskMap: Map<string, Task>,
		level: number,
	): void {
		// Create section element with level-specific class
		const sectionEl = containerEl.createDiv({
			cls: `task-group-section level-${level}`,
		});
		sectionEl.setAttribute("data-group-key", group.key);
		sectionEl.setAttribute("data-level", level.toString());

		// Restore expanded state from localStorage
		group.isExpanded = getGroupExpandedState(this.currentViewId, group.key);

		// Section header
		const headerEl = sectionEl.createDiv({
			cls: `group-section-header ${
				group.children ? "folder-group" : "file-group"
			}`,
		});

		// Expand/collapse toggle
		const toggleEl = headerEl.createDiv({
			cls: "section-toggle",
		});
		setIcon(toggleEl, group.isExpanded ? "chevron-down" : "chevron-right");

		// Section title
		const titleEl = headerEl.createDiv({
			cls: "section-title",
		});
		titleEl.setText(group.title);

		// Task count badge
		const countEl = headerEl.createDiv({
			cls: "section-count",
		});
		countEl.setText(`${group.tasks.length}`);

		// Content container (for tasks or child groups)
		const contentEl = sectionEl.createDiv({
			cls: "group-section-content",
		});

		// Initially hide if collapsed
		if (!group.isExpanded) {
			contentEl.hide();
		}

		// Register toggle event
		this.registerDomEvent(headerEl, "click", () => {
			group.isExpanded = !group.isExpanded;

			// Persist state to localStorage
			setGroupExpandedState(
				this.currentViewId,
				group.key,
				group.isExpanded,
			);

			// Update icon
			setIcon(
				toggleEl,
				group.isExpanded ? "chevron-down" : "chevron-right",
			);

			// Show/hide and render/destroy content
			if (group.isExpanded) {
				contentEl.show();
				this.renderGroupContent(group, contentEl, taskMap, level);
			} else {
				this.destroyGroupContent(group, contentEl);
				contentEl.hide();
			}
		});

		// Render content if expanded
		if (group.isExpanded) {
			this.renderGroupContent(group, contentEl, taskMap, level);
		}
	}

	/**
	 * Render content of a group (either child groups or tasks)
	 * @param group - The group whose content to render
	 * @param containerEl - Container element for the content
	 * @param taskMap - Map of all tasks for tree view
	 * @param level - Current nesting level
	 */
	private renderGroupContent(
		group: TaskGroup,
		containerEl: HTMLElement,
		taskMap: Map<string, Task>,
		level: number,
	): void {
		// Clear existing content
		containerEl.empty();

		// If group has children, render them recursively
		if (group.children && group.children.length > 0) {
			group.children.forEach((childGroup) => {
				this.renderGroupRecursive(
					childGroup,
					containerEl,
					taskMap,
					level + 1,
				);
			});
		} else {
			// Leaf node: render tasks using TaskListRendererComponent
			group.renderer = new TaskListRendererComponent(
				this,
				containerEl,
				this.plugin,
				this.app,
				this.currentViewId,
			);

			// Set up callbacks
			if (this.params.onTaskSelected) {
				group.renderer.onTaskSelected = this.params.onTaskSelected;
			}
			if (this.params.onTaskCompleted) {
				group.renderer.onTaskCompleted = this.params.onTaskCompleted;
			}
			if (this.params.onTaskContextMenu) {
				group.renderer.onTaskContextMenu =
					this.params.onTaskContextMenu;
			}

			// Set up task update callback
			group.renderer.onTaskUpdate = async (
				originalTask: Task,
				updatedTask: Task,
			) => {
				if (this.params.onTaskUpdate) {
					await this.params.onTaskUpdate(originalTask, updatedTask);
				}
			};

			// Render tasks using the group's renderer
			group.renderer.renderTasks(
				group.tasks,
				this.isTreeView,
				taskMap,
				t("No tasks in this group."),
			);
		}
	}

	/**
	 * Destroy content of a group and its children (recursively)
	 * Improved version: no DOM queries, direct recursion on data structure
	 * @param group - The group whose content to destroy
	 * @param containerEl - Container element
	 */
	private destroyGroupContent(
		group: TaskGroup,
		containerEl: HTMLElement,
	): void {
		// Recursively destroy child groups (depth-first)
		if (group.children && group.children.length > 0) {
			group.children.forEach((childGroup) => {
				// Recursively destroy children first
				this.destroyGroupContent(childGroup, containerEl);
			});
		}

		// Destroy current group's renderer
		if (group.renderer) {
			this.removeChild(group.renderer);
			group.renderer = undefined;
		}

		// Clear DOM (done once at the end)
		containerEl.empty();
	}

	/**
	 * Cleanup group renderers
	 */
	private cleanupGroupRenderers() {
		this.taskGroups.forEach((group) => {
			if (group.renderer) {
				this.removeChild(group.renderer);
				group.renderer = undefined;
			}
		});
	}

	public setTasks(
		tasks: Task[],
		notFilteredTasks: Task[],
		forceRefresh: boolean = false,
	) {
		const updateSignatures = () => {
			this.lastAllTasksSignature = this.computeTaskSignature(tasks);
			this.lastNotFilteredTasksSignature =
				this.computeTaskSignature(notFilteredTasks);
		};

		// Allow forced refresh for cases where we know the data has changed
		if (forceRefresh) {
			console.log("ContentComponent: Forced refresh requested");
			// Cancel any ongoing rendering if force refresh is requested
			this.isRendering = false;
			this.pendingForceRefresh = true;
			this.allTasks = tasks;
			this.notFilteredTasks = notFilteredTasks;
			updateSignatures();
			this.applyFilters();
			// Update statistics panel if showing
			if (this.timerStatisticsPanel) {
				this.timerStatisticsPanel.setTasks(this.filteredTasks);
			}
			this.debounceRefreshTaskList();
			return;
		}

		// If a force refresh is pending, skip non-forced updates
		if (this.pendingForceRefresh) {
			console.log(
				"ContentComponent: Skipping non-forced update, force refresh is pending",
			);
			return;
		}

		const nextAllSignature = this.computeTaskSignature(tasks);
		const nextNotFilteredSignature =
			this.computeTaskSignature(notFilteredTasks);
		if (
			nextAllSignature === this.lastAllTasksSignature &&
			nextNotFilteredSignature === this.lastNotFilteredTasksSignature
		) {
			console.log(
				"ContentComponent: Task signatures unchanged, skipping refresh",
			);
			return;
		}

		this.allTasks = tasks;
		this.notFilteredTasks = notFilteredTasks;
		this.lastAllTasksSignature = nextAllSignature;
		this.lastNotFilteredTasksSignature = nextNotFilteredSignature;
		this.applyFilters();
		// Update statistics panel if showing
		if (this.timerStatisticsPanel) {
			this.timerStatisticsPanel.setTasks(this.filteredTasks);
		}
		this.debounceRefreshTaskList();
	}

	// Updated method signature
	public setViewMode(viewId: ViewMode, project?: string | null) {
		const previousViewId = this.currentViewId;
		this.currentViewId = viewId;
		this.selectedProjectForView = project === undefined ? null : project;

		// Update title based on the view config
		const viewConfig = getViewSettingOrDefault(this.plugin, viewId);
		let title = t(viewConfig.name);

		this.titleEl.setText(title);

		// Re-initialize view mode for the new view
		this.initializeViewMode();

		// Re-initialize Group By for the new view
		this.initializeGroupBy();

		// Handle working-on specific buttons
		if (previousViewId === "working-on" && viewId !== "working-on") {
			// Switching away from working-on
			this.unregisterWorkingOnButtons();
		} else if (previousViewId !== "working-on" && viewId === "working-on") {
			// Switching to working-on
			this.registerWorkingOnButtons();
		}

		this.applyFilters();
		this.debounceRefreshTaskList();
	}

	/**
	 * Set the TopNavigation reference and register buttons
	 */
	public setTopNavigation(nav: TopNavigation | null): void {
		// Unregister old buttons if exists
		if (this.topNavigation) {
			this.unregisterGroupByButton();
			this.unregisterWorkingOnButtons();
		}

		this.topNavigation = nav;

		// Register buttons if nav is provided
		if (nav) {
			this.registerGroupByButton();
			// Register working-on buttons if applicable
			this.registerWorkingOnButtons();
		}
	}

	/**
	 * Register Group By button in TopNavigation
	 */
	private registerGroupByButton(): void {
		if (!this.topNavigation) {
			return;
		}

		this.topNavigation.registerCustomButton({
			id: "content-group-by",
			icon: "folder-tree",
			tooltip: t("Group By"),
			onClick: () => {
				this.showGroupByMenu();
			},
		});

		console.log(
			"[ContentComponent] Registered Group By button in TopNavigation",
		);
	}

	/**
	 * Unregister Group By button from TopNavigation
	 */
	private unregisterGroupByButton(): void {
		if (!this.topNavigation) {
			return;
		}

		this.topNavigation.unregisterCustomButton("content-group-by");
		console.log(
			"[ContentComponent] Unregistered Group By button from TopNavigation",
		);
	}

	/**
	 * Register Working-On specific buttons (Timer Statistics)
	 */
	private registerWorkingOnButtons(): void {
		if (!this.topNavigation) {
			return;
		}

		// Only register if timer is enabled and we're in working-on view
		if (
			this.currentViewId !== "working-on" ||
			!this.plugin.settings.taskTimer?.enabled
		) {
			return;
		}

		this.topNavigation.registerCustomButton({
			id: "working-on-timer-stats",
			icon: "bar-chart-2",
			tooltip: t("Timer Statistics"),
			onClick: () => {
				this.toggleTimerStatisticsPanel();
			},
		});

		console.log(
			"[ContentComponent] Registered Timer Statistics button for working-on view",
		);
	}

	/**
	 * Unregister Working-On specific buttons
	 */
	private unregisterWorkingOnButtons(): void {
		// Hide the statistics panel if showing
		this.hideTimerStatisticsPanel();

		if (!this.topNavigation) {
			return;
		}

		this.topNavigation.unregisterCustomButton("working-on-timer-stats");
	}

	/**
	 * Toggle Timer Statistics Panel
	 */
	private toggleTimerStatisticsPanel(): void {
		if (this.isShowingTimerStats) {
			this.hideTimerStatisticsPanel();
		} else {
			this.showTimerStatisticsPanel();
		}
	}

	/**
	 * Show Timer Statistics Panel
	 */
	private showTimerStatisticsPanel(): void {
		if (this.timerStatisticsPanel) {
			return; // Already showing
		}

		this.isShowingTimerStats = true;

		// Hide the task list
		this.taskListEl.hide();

		// Create and show the statistics panel
		this.timerStatisticsPanel = new TimerStatisticsPanel(
			this.containerEl,
			this.plugin,
			this.filteredTasks,
			{
				onTaskClick: (task) => {
					if (task) {
						this.selectTask(task);
					}
				},
				onTaskContextMenu: (event, task) => {
					if (task && this.params.onTaskContextMenu) {
						this.params.onTaskContextMenu(event, task);
					}
				},
			},
		);
		this.addChild(this.timerStatisticsPanel);
		this.timerStatisticsPanel.load();

		// Update button state
		this.updateTimerStatsButtonState();
	}

	/**
	 * Hide Timer Statistics Panel
	 */
	private hideTimerStatisticsPanel(): void {
		if (!this.timerStatisticsPanel) {
			return; // Not showing
		}

		this.isShowingTimerStats = false;

		// Remove the statistics panel
		this.removeChild(this.timerStatisticsPanel);
		this.timerStatisticsPanel = null;

		// Show the task list
		this.taskListEl.show();

		// Update button state
		this.updateTimerStatsButtonState();
	}

	/**
	 * Update the timer stats button visual state
	 */
	private updateTimerStatsButtonState(): void {
		// The button state can be indicated by adding/removing a class
		// This is optional - could be used to highlight the button when panel is open
	}

	private applyFilters() {
		// Call the centralized filter utility
		this.filteredTasks = filterTasks(
			this.allTasks,
			this.currentViewId,
			this.plugin,
			{ textQuery: this.filterInput?.value }, // Pass text query from input
		);

		const sortCriteria = this.plugin.settings.viewConfiguration.find(
			(view) => view.id === this.currentViewId,
		)?.sortCriteria;
		if (sortCriteria && sortCriteria.length > 0) {
			this.filteredTasks = sortTasks(
				this.filteredTasks,
				sortCriteria,
				this.plugin.settings,
			);
		} else {
			// Default sorting: completed tasks last, then by priority, due date, content,
			// with lowest-priority tie-breakers: filePath -> line
			this.filteredTasks.sort((a, b) => {
				const completedA = a.completed;
				const completedB = b.completed;
				if (completedA !== completedB) return completedA ? 1 : -1;

				// Access priority from metadata
				const prioA = a.metadata.priority ?? 0;
				const prioB = b.metadata.priority ?? 0;
				if (prioA !== prioB) return prioB - prioA;

				// Access due date from metadata
				const dueA = a.metadata.dueDate ?? Infinity;
				const dueB = b.metadata.dueDate ?? Infinity;
				if (dueA !== dueB) return dueA - dueB;

				// Content compare (case-insensitive numeric aware)
				const collator = new Intl.Collator(undefined, {
					usage: "sort",
					sensitivity: "base",
					numeric: true,
				});
				const contentCmp = collator.compare(
					a.content ?? "",
					b.content ?? "",
				);
				if (contentCmp !== 0) return contentCmp;
				// Lowest-priority tie-breakers to ensure stability across files
				const fp = (a.filePath || "").localeCompare(b.filePath || "");
				if (fp !== 0) return fp;
				return (a.line ?? 0) - (b.line ?? 0);
			});
		}

		// Apply grouping after filtering and sorting
		this.applyGrouping();

		// Update the task count display
		this.countEl.setText(`${this.filteredTasks.length} ${t("tasks")}`);

		// Keep timer statistics panel in sync with current filters
		if (this.timerStatisticsPanel) {
			this.timerStatisticsPanel.setTasks(this.filteredTasks);
		}
	}

	private filterTasks(query: string) {
		this.applyFilters(); // Re-apply all filters including the new text query
		this.debounceRefreshTaskList();
	}

	private computeTaskSignature(tasks: Task[]): string {
		if (!tasks || tasks.length === 0) return "";
		return tasks
			.map((task) =>
				[
					task.id,
					task.completed ? "1" : "0",
					task.originalMarkdown ?? "",
					task.content ?? "",
					task.metadata ? JSON.stringify(task.metadata) : "",
				].join("|"),
			)
			.join(";");
	}

	private cleanupComponents() {
		this.disposeComponentList(this.taskComponents);
		this.disposeComponentList(this.treeComponents);
		this.cleanupGroupRenderers();
		this.taskComponents = [];
		this.treeComponents = [];
		this.taskListObserver?.disconnect();
		this.taskListEl.empty();
	}

	private disposeComponentList<T extends Component>(components: T[]) {
		const snapshot = [...components];
		for (const component of snapshot) {
			this.removeChild(component);
		}
	}

	private isContainerVisible(): boolean {
		if (!this.containerEl) return false;
		const inDom = document.body.contains(this.containerEl);
		if (!inDom) return false;
		if (!this.containerEl.isShown()) return false;
		const rect = this.containerEl.getBoundingClientRect();
		return rect.width > 0 && rect.height > 0;
	}

	private debounceRefreshTaskList = debounce(this.refreshTaskList, 150);

	private refreshTaskList() {
		console.log("refreshing");
		// Defer rendering if container is not visible yet (e.g., view hidden during init)
		if (!this.isContainerVisible()) {
			this.pendingForceRefresh = true;
			if (!this.pendingVisibilityRetry) {
				this.pendingVisibilityRetry = true;
				const tryAgain = () => {
					if (this.isContainerVisible()) {
						this.pendingVisibilityRetry = false;
						this.visibilityRetryCount = 0;
						if (this.pendingForceRefresh && !this.isRendering) {
							this.pendingForceRefresh = false;
							this.refreshTaskList();
						}
						return;
					}
					if (this.visibilityRetryCount < 30) {
						this.visibilityRetryCount++;
						setTimeout(tryAgain, 100);
					} else {
						this.pendingVisibilityRetry = false;
						this.visibilityRetryCount = 0;
					}
				};
				tryAgain();
			}
			return;
		}

		// If a render is already in progress, queue a refresh instead of skipping
		if (this.isRendering) {
			console.log(
				"ContentComponent: Already rendering, queueing a refresh",
			);
			this.pendingForceRefresh = true;
			return;
		}

		this.isRendering = true;

		// Capture scroll state to mitigate scrollbar jumping
		const prevScrollState = this.captureScrollState();

		try {
			const previousTaskComponents = [...this.taskComponents];
			const previousTreeComponents = [...this.treeComponents];

			this.taskComponents = [];
			this.treeComponents = [];
			this.taskListObserver?.disconnect();
			this.removeLoadMarker();

			// Reset indices for lazy loading
			this.nextTaskIndex = 0;
			this.nextRootTaskIndex = 0;
			this.rootTasks = [];

			// Update working-on summary (if applicable)
			this.renderWorkingOnSummary();

			if (this.filteredTasks.length === 0) {
				this.taskListEl.replaceChildren();
				this.disposeComponentList(previousTaskComponents);
				this.disposeComponentList(previousTreeComponents);
				this.addEmptyState(t("No tasks here."));
				return;
			}

			// Check if Group By is active
			if (
				this.groupByDimension !== "none" &&
				this.taskGroups.length > 0
			) {
				// Use section-based rendering for grouped tasks
				this.taskListEl.replaceChildren();
				this.disposeComponentList(previousTaskComponents);
				this.disposeComponentList(previousTreeComponents);
				this.renderGroupedTasks();
				this.restoreScrollState(prevScrollState);
				return;
			}

			const renderTarget = document.createDocumentFragment();

			if (this.isTreeView) {
				const taskMap = new Map<string, Task>();
				// Add all non-filtered tasks to the taskMap
				this.notFilteredTasks.forEach((task) =>
					taskMap.set(task.id, task),
				);
				this.rootTasks = tasksToTree(this.filteredTasks); // Calculate root tasks
				// Sort roots according to view's sort criteria (fallback to sensible defaults)
				const viewSortCriteria =
					this.plugin.settings.viewConfiguration.find(
						(view) => view.id === this.currentViewId,
					)?.sortCriteria;
				if (viewSortCriteria && viewSortCriteria.length > 0) {
					this.rootTasks = sortTasks(
						this.rootTasks,
						viewSortCriteria,
						this.plugin.settings,
					);
				} else {
					// Default sorting: completed tasks last, then by priority, due date, content,
					// with lowest-priority tie-breakers: filePath -> line
					this.rootTasks.sort((a, b) => {
						const completedA = a.completed;
						const completedB = b.completed;
						if (completedA !== completedB)
							return completedA ? 1 : -1;

						// Access priority from metadata
						const prioA = a.metadata.priority ?? 0;
						const prioB = b.metadata.priority ?? 0;
						if (prioA !== prioB) return prioB - prioA;

						// Access due date from metadata
						const dueA = a.metadata.dueDate ?? Infinity;
						const dueB = b.metadata.dueDate ?? Infinity;
						if (dueA !== dueB) return dueA - dueB;

						// Content compare (case-insensitive numeric aware)
						const collator = new Intl.Collator(undefined, {
							usage: "sort",
							sensitivity: "base",
							numeric: true,
						});
						const contentCmp = collator.compare(
							a.content ?? "",
							b.content ?? "",
						);
						if (contentCmp !== 0) return contentCmp;
						// Lowest-priority tie-breakers to ensure stability across files
						const fp = (a.filePath || "").localeCompare(
							b.filePath || "",
						);
						if (fp !== 0) return fp;
						return (a.line ?? 0) - (b.line ?? 0);
					});
				}
				this.loadRootTaskBatch(taskMap, renderTarget); // Load the first batch
			} else {
				this.loadTaskBatch(renderTarget); // Load the first batch
			}

			this.taskListEl.replaceChildren(renderTarget);
			this.disposeComponentList(previousTaskComponents);
			this.disposeComponentList(previousTreeComponents);

			// Add load marker if necessary
			this.checkAndAddLoadMarker();
			// Restore scroll state after render
			this.restoreScrollState(prevScrollState);
		} finally {
			// Reset rendering flag after completion
			setTimeout(() => {
				this.isRendering = false;
				// If a refresh was queued during rendering, process it now
				if (this.pendingForceRefresh) {
					this.pendingForceRefresh = false;
					this.refreshTaskList();
				}
			}, 50); // Small delay to prevent immediate re-entry
		}
	}

	// Capture current scroll state (anchor id + offset + scrollTop)
	private captureScrollState() {
		const container = this.taskListEl;
		if (!container)
			return {
				scrollTop: 0,
				anchorId: null as string | null,
				anchorOffset: 0,
			};
		const scrollTop = container.scrollTop;
		let anchorId: string | null = null;
		let anchorOffset = 0;
		const containerRect = container.getBoundingClientRect();
		// Find first visible task item
		const items = Array.from(
			container.querySelectorAll<HTMLElement>(".task-item"),
		);
		for (const el of items) {
			const rect = el.getBoundingClientRect();
			const offset = rect.top - containerRect.top;
			if (rect.bottom > containerRect.top) {
				anchorId = el.getAttribute("data-task-id");
				anchorOffset = Math.max(0, offset);
				break;
			}
		}
		return { scrollTop, anchorId, anchorOffset };
	}

	// Restore scroll state after re-render
	private restoreScrollState(state: {
		scrollTop: number;
		anchorId: string | null;
		anchorOffset: number;
	}) {
		const container = this.taskListEl;
		if (!container) return;
		// Try anchor-based restoration first
		if (state.anchorId) {
			const anchorEl = container.querySelector<HTMLElement>(
				`[data-task-id="${state.anchorId}"]`,
			);
			if (anchorEl) {
				const desiredOffset = state.anchorOffset;
				const currentOffset =
					anchorEl.getBoundingClientRect().top -
					container.getBoundingClientRect().top;
				const delta = currentOffset - desiredOffset;
				container.scrollTop += delta;
				return;
			}
		}
		// Fallback: restore raw scrollTop
		container.scrollTop = state.scrollTop;
	}

	private loadTaskBatch(
		target: DocumentFragment | HTMLElement = this.taskListEl,
	): number {
		const fragment = document.createDocumentFragment();
		const countToLoad = this.taskPageSize;
		const start = this.nextTaskIndex;
		const end = Math.min(start + countToLoad, this.filteredTasks.length);

		// console.log(`Loading list tasks from ${start} to ${end}`);

		for (let i = start; i < end; i++) {
			const task = this.filteredTasks[i];
			const taskComponent = new TaskListItemComponent(
				task,
				this.currentViewId, // Pass currentViewId
				this.app,
				this.plugin,
				this.params.selectionManager, // Pass selection manager
			);

			// Attach event handlers
			taskComponent.onTaskSelected = this.selectTask.bind(this);
			taskComponent.onTaskCompleted = (t) => {
				if (this.params.onTaskCompleted) this.params.onTaskCompleted(t);
			};
			taskComponent.onTaskUpdate = async (originalTask, updatedTask) => {
				if (this.params.onTaskUpdate) {
					await this.params.onTaskUpdate(originalTask, updatedTask);
				}
			};
			taskComponent.onTaskContextMenu = (e, t) => {
				if (this.params.onTaskContextMenu)
					this.params.onTaskContextMenu(e, t);
			};

			this.addChild(taskComponent); // Manage lifecycle
			taskComponent.load();
			fragment.appendChild(taskComponent.element);
			this.taskComponents.push(taskComponent); // Keep track of rendered components
		}

		target.appendChild(fragment);
		this.nextTaskIndex = end; // Update index for the next batch
		return end; // Return the new end index
	}

	private loadRootTaskBatch(
		taskMap: Map<string, Task>,
		target: DocumentFragment | HTMLElement = this.taskListEl,
	): number {
		const fragment = document.createDocumentFragment();
		const countToLoad = this.taskPageSize;
		const start = this.nextRootTaskIndex;
		const end = Math.min(start + countToLoad, this.rootTasks.length);

		// Make sure all non-filtered tasks are in the taskMap
		this.notFilteredTasks.forEach((task) => {
			if (!taskMap.has(task.id)) {
				taskMap.set(task.id, task);
			}
		});

		for (let i = start; i < end; i++) {
			const rootTask = this.rootTasks[i];
			const childTasks = this.notFilteredTasks.filter(
				(task) =>
					task.metadata.parent === rootTask.id &&
					isValidTreeParent(task, rootTask),
			);

			const treeComponent = new TaskTreeItemComponent(
				rootTask,
				this.currentViewId, // Pass currentViewId
				this.app,
				0,
				childTasks,
				taskMap,
				this.plugin,
				this.params.selectionManager, // Pass selection manager
			);

			// Attach event handlers
			treeComponent.onTaskSelected = this.selectTask.bind(this);
			treeComponent.onTaskCompleted = (t) => {
				if (this.params.onTaskCompleted) this.params.onTaskCompleted(t);
			};
			treeComponent.onTaskUpdate = async (originalTask, updatedTask) => {
				if (this.params.onTaskUpdate) {
					await this.params.onTaskUpdate(originalTask, updatedTask);
				}
			};
			treeComponent.onTaskContextMenu = (e, t) => {
				if (this.params.onTaskContextMenu)
					this.params.onTaskContextMenu(e, t);
			};

			this.addChild(treeComponent); // Manage lifecycle
			treeComponent.load();
			fragment.appendChild(treeComponent.element);
			this.treeComponents.push(treeComponent); // Keep track of rendered components
		}

		target.appendChild(fragment);
		this.nextRootTaskIndex = end; // Update index for the next batch
		return end; // Return the new end index
	}

	private checkAndAddLoadMarker() {
		this.removeLoadMarker(); // Remove existing marker first

		const moreTasksExist = this.isTreeView
			? this.nextRootTaskIndex < this.rootTasks.length
			: this.nextTaskIndex < this.filteredTasks.length;

		// console.log(
		// 	`Check load marker: moreTasksExist = ${moreTasksExist} (Tree: ${this.nextRootTaskIndex}/${this.rootTasks.length}, List: ${this.nextTaskIndex}/${this.filteredTasks.length})`
		// );

		if (moreTasksExist) {
			this.addLoadMarker();
		}
	}

	private addLoadMarker() {
		const loadMarker = this.taskListEl.createDiv({
			cls: "task-load-marker",
			attr: { "data-task-id": "load-marker" }, // Use data attribute for identification
		});
		loadMarker.setText(t("Loading more..."));
		// console.log("Adding load marker and observing.");
		this.taskListObserver.observe(loadMarker); // Observe the marker
	}

	private removeLoadMarker() {
		const oldMarker = this.taskListEl.querySelector(".task-load-marker");
		if (oldMarker) {
			this.taskListObserver.unobserve(oldMarker); // Stop observing before removing
			oldMarker.remove();
		}
	}

	private renderWorkingOnSummary(): void {
		// Only render for working-on view when timer is enabled
		if (this.currentViewId !== "working-on") {
			if (this.workingOnSummaryEl) {
				this.workingOnSummaryEl.remove();
				this.workingOnSummaryEl = null;
			}
			return;
		}

		if (!this.plugin.settings.taskTimer?.enabled) {
			return;
		}

		if (!this.workingOnSummaryEl) {
			this.workingOnSummaryEl = this.taskListEl.createDiv({
				cls: "working-on-summary",
			});
		}

		const timerManager = new TaskTimerManager(
			this.plugin.settings.taskTimer,
		);

		let activeDuration = 0;
		let completedDuration = 0;
		let activeCount = 0;

		const accumulate = (task: Task, includeInActive: boolean) => {
			const blockId = task.metadata?.id;
			if (!blockId) return;
			const timer = timerManager.getTimerByFileAndBlock(
				task.filePath,
				blockId,
			);
			if (!timer) return;
			const duration = timerManager.getCurrentDuration(timer.taskId);
			if (includeInActive) {
				activeDuration += duration;
				activeCount++;
			} else {
				completedDuration += duration;
			}
		};

		// Active timers from current filtered working-on tasks
		this.filteredTasks.forEach((task) => accumulate(task, true));
		// Completed timers (if any) from all tasks
		this.notFilteredTasks
			.filter((t) => t.completed)
			.forEach((task) => accumulate(task, false));

		const activeText = timerManager.formatDuration(activeDuration);
		const completedText = timerManager.formatDuration(completedDuration);

		this.workingOnSummaryEl.setText(
			`⏱ ${t("Active timers")}: ${activeCount} · ${t(
				"Total time",
			)}: ${activeText} · ${t("Completed time")}: ${completedText}`,
		);

		// Ensure the summary stays at the top
		if (this.workingOnSummaryEl.parentElement !== this.taskListEl) {
			this.taskListEl.prepend(this.workingOnSummaryEl);
		}
	}

	private loadMoreTasks() {
		// console.log("Load more tasks triggered...");
		this.removeLoadMarker(); // Remove the current marker

		if (this.isTreeView) {
			if (this.nextRootTaskIndex < this.rootTasks.length) {
				// console.log(
				// 	`Loading more TREE tasks from index ${this.nextRootTaskIndex}`
				// );
				const taskMap = new Map<string, Task>();
				this.filteredTasks.forEach((task) =>
					taskMap.set(task.id, task),
				);
				this.loadRootTaskBatch(taskMap);
			} else {
				// console.log("No more TREE tasks to load.");
			}
		} else {
			if (this.nextTaskIndex < this.filteredTasks.length) {
				// console.log(
				// 	`Loading more LIST tasks from index ${this.nextTaskIndex}`
				// );
				this.loadTaskBatch();
			} else {
				// console.log("No more LIST tasks to load.");
			}
		}

		// Add the marker back if there are still more tasks after loading the batch
		this.checkAndAddLoadMarker();
	}

	private addEmptyState(message: string) {
		const emptyEl = this.taskListEl.createDiv({ cls: "task-empty-state" });
		emptyEl.setText(message);
	}

	private selectTask(task: Task | null) {
		if (this.selectedTask?.id === task?.id && task !== null) {
			// If clicking the already selected task, deselect it (or toggle details - handled by TaskView)
			// this.selectedTask = null;
			// console.log("Task deselected (in ContentComponent):", task?.id);
			// // Update visual state of the item if needed (remove highlight)
			// const itemEl = this.taskListEl.querySelector(`[data-task-row-id="${task.id}"]`);
			// itemEl?.removeClass('is-selected'); // Example class
			// if(this.onTaskSelected) this.onTaskSelected(null); // Notify parent
			// return;
		}

		// Deselect previous task visually if needed
		if (this.selectedTask) {
			// const prevItemEl = this.taskListEl.querySelector(`[data-task-row-id="${this.selectedTask.id}"]`);
			// prevItemEl?.removeClass('is-selected');
		}

		this.selectedTask = task;
		// console.log("Task selected (in ContentComponent):", task?.id);

		// Select new task visually if needed
		if (task) {
			// const newItemEl = this.taskListEl.querySelector(`[data-task-row-id="${task.id}"]`);
			// newItemEl?.addClass('is-selected');
		}

		if (this.params.onTaskSelected) {
			this.params.onTaskSelected(task);
		}
	}

	public updateTask(updatedTask: Task) {
		// 1) Update sources
		const taskIndexAll = this.allTasks.findIndex(
			(t) => t.id === updatedTask.id,
		);
		if (taskIndexAll !== -1)
			this.allTasks[taskIndexAll] = { ...updatedTask };
		const taskIndexNotFiltered = this.notFilteredTasks.findIndex(
			(t) => t.id === updatedTask.id,
		);
		if (taskIndexNotFiltered !== -1)
			this.notFilteredTasks[taskIndexNotFiltered] = { ...updatedTask };
		if (this.selectedTask && this.selectedTask.id === updatedTask.id)
			this.selectedTask = { ...updatedTask };

		// 2) Re-apply filters and detect visibility change
		const prevLen = this.filteredTasks.length;
		this.applyFilters();
		const taskFromFiltered = this.filteredTasks.find(
			(t) => t.id === updatedTask.id,
		);
		const taskStillVisible = !!taskFromFiltered;

		// Helper: insert list item at correct position (list view)
		const insertListItem = (taskToInsert: Task) => {
			const compIds = new Set(
				this.taskComponents.map((c) => c.getTask().id),
			);
			const sortedIndex = this.filteredTasks.findIndex(
				(t) => t.id === taskToInsert.id,
			);
			// Find the next rendered neighbor after sortedIndex
			let nextComp: any = null;
			for (let i = sortedIndex + 1; i < this.filteredTasks.length; i++) {
				const id = this.filteredTasks[i].id;
				if (compIds.has(id)) {
					nextComp = this.taskComponents.find(
						(c) => c.getTask().id === id,
					);
					break;
				}
			}
			// Create component
			const taskComponent = new TaskListItemComponent(
				taskToInsert,
				this.currentViewId,
				this.app,
				this.plugin,
				this.params.selectionManager, // Pass selection manager
			);
			// Attach events
			taskComponent.onTaskSelected = this.selectTask.bind(this);
			taskComponent.onTaskCompleted = (t) => {
				this.params.onTaskCompleted?.(t);
			};
			taskComponent.onTaskUpdate = async (orig, upd) => {
				if (this.params.onTaskUpdate) {
					await this.params.onTaskUpdate(orig, upd);
				}
			};
			taskComponent.onTaskContextMenu = (e, t) => {
				this.params.onTaskContextMenu?.(e, t);
			};
			this.addChild(taskComponent);
			taskComponent.load();
			// Insert DOM
			if (nextComp) {
				this.taskListEl.insertBefore(
					taskComponent.element,
					nextComp.element,
				);
				const idx = this.taskComponents.indexOf(nextComp);
				this.taskComponents.splice(idx, 0, taskComponent);
			} else {
				this.taskListEl.appendChild(taskComponent.element);
				this.taskComponents.push(taskComponent);
			}
		};

		// Helper: remove list item
		const removeListItem = (taskId: string) => {
			const idx = this.taskComponents.findIndex(
				(c) => c.getTask().id === taskId,
			);
			if (idx >= 0) {
				const comp = this.taskComponents[idx];
				this.removeChild(comp);
				comp.element.remove();
				this.taskComponents.splice(idx, 1);
			}
		};

		// Helper: sort comparator for roots (filePath -> line)
		const rootComparator = (a: Task, b: Task) => {
			const fp = (a.filePath || "").localeCompare(b.filePath || "");
			if (fp !== 0) return fp;
			return (a.line ?? 0) - (b.line ?? 0);
		};

		if (taskStillVisible) {
			if (!this.isTreeView) {
				// List view: update in place or insert if new to view
				const comp = this.taskComponents.find(
					(c) => c.getTask().id === updatedTask.id,
				);
				if (comp) {
					comp.updateTask(taskFromFiltered!);
				} else {
					insertListItem(taskFromFiltered!);
				}
			} else {
				// Tree view: update existing subtree or insert to parent/root
				const comp = this.treeComponents.find(
					(c) => c.getTask().id === updatedTask.id,
				);
				if (comp) {
					comp.updateTask(taskFromFiltered!);
				} else {
					// Not a root comp; try update within children
					let updated = false;
					for (const rootComp of this.treeComponents) {
						if (rootComp.updateTaskRecursively(taskFromFiltered!)) {
							updated = true;
							break;
						}
					}
					if (!updated) {
						// Insert new visible task
						const parentId = taskFromFiltered!.metadata.parent;
						if (parentId) {
							// Find parent comp and rebuild its children list incrementally
							for (const rootComp of this.treeComponents) {
								const parentComp =
									rootComp.findComponentByTaskId(parentId);
								if (parentComp) {
									const newChildren =
										this.notFilteredTasks.filter(
											(t) =>
												t.metadata.parent === parentId,
										);
									parentComp.updateChildTasks(newChildren);
									updated = true;
									break;
								}
							}
						} else {
							// Root insertion
							const taskMap = new Map<string, Task>();
							this.notFilteredTasks.forEach((t) =>
								taskMap.set(t.id, t),
							);
							const childTasks = this.notFilteredTasks.filter(
								(t) =>
									t.metadata.parent === taskFromFiltered!.id,
							);
							const newRoot = new TaskTreeItemComponent(
								taskFromFiltered!,
								this.currentViewId,
								this.app,
								0,
								childTasks,
								taskMap,
								this.plugin,
								this.params.selectionManager, // Pass selection manager
							);
							newRoot.onTaskSelected = this.selectTask.bind(this);
							newRoot.onTaskCompleted = (t) => {
								this.params.onTaskCompleted?.(t);
							};
							newRoot.onTaskUpdate = async (orig, upd) => {
								if (this.params.onTaskUpdate)
									await this.params.onTaskUpdate(orig, upd);
							};
							newRoot.onTaskContextMenu = (e, t) => {
								this.params.onTaskContextMenu?.(e, t);
							};
							this.addChild(newRoot);
							newRoot.load();
							// Determine insert index among existing roots
							let insertAt = this.treeComponents.length;
							for (
								let i = 0;
								i < this.treeComponents.length;
								i++
							) {
								if (
									rootComparator(
										taskFromFiltered!,
										this.treeComponents[i].getTask(),
									) < 0
								) {
									insertAt = i;
									break;
								}
							}
							if (insertAt < this.treeComponents.length) {
								this.taskListEl.insertBefore(
									newRoot.element,
									this.treeComponents[insertAt].element,
								);
								this.treeComponents.splice(
									insertAt,
									0,
									newRoot,
								);
							} else {
								this.taskListEl.appendChild(newRoot.element);
								this.treeComponents.push(newRoot);
							}
						}
					}
				}
			}
		} else {
			// Task became not visible
			if (!this.isTreeView) {
				removeListItem(updatedTask.id);
				// Optional: backfill one more item if available
				if (this.nextTaskIndex < this.filteredTasks.length) {
					this.loadTaskBatch();
				}
			} else {
				// Tree view removal
				// If root component exists, remove it
				const idx = this.treeComponents.findIndex(
					(c) => c.getTask().id === updatedTask.id,
				);
				if (idx >= 0) {
					const comp = this.treeComponents[idx];
					this.removeChild(comp);
					comp.element.remove();
					this.treeComponents.splice(idx, 1);
				} else {
					// Otherwise remove from its parent's subtree
					for (const rootComp of this.treeComponents) {
						if (rootComp.removeChildByTaskId(updatedTask.id)) break;
					}
				}
			}
		}

		// 3) Update count display (no full refresh path)
		if (this.filteredTasks.length !== prevLen) {
			this.countEl.setText(`${this.filteredTasks.length} ${t("tasks")}`);
		}
	}

	public getSelectedTask(): Task | null {
		return this.selectedTask;
	}

	onunload() {
		// Unregister Group By button from TopNavigation
		this.unregisterGroupByButton();

		this.cleanupComponents(); // Use the cleanup method
		this.containerEl.empty(); // Extra safety
		this.containerEl.remove();
	}
}
