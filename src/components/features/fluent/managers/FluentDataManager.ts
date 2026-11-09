import { isProjectCalendarEntry } from "@/utils/task/project-calendar";
import { Component, debounce } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";
import { filterTasks } from "@/utils/task/task-filter-utils";
import { RootFilterState } from "@/components/features/task/filter/ViewTaskFilter";
import { isDataflowEnabled } from "@/dataflow/createDataflow";
import { Events, on } from "@/dataflow/events/Events";
import { sortTasks } from "@/commands/sortTaskCommands";
import { TaskTimerManager } from "@/managers/timer-manager";
import { PresetTaskFilter } from "@/common/setting-definition";
import { evaluateFilterNode, parseAdvancedFilterQuery } from "@/utils/task/filter-compatibility";
import { buildProjectPlan } from "@/managers/project-plan";

/**
 * FluentDataManager - Stateless data loading, filtering, and sorting executor
 *
 * Responsibilities:
 * - Load tasks from dataflow or preloaded cache (returns via callback)
 * - Apply filters to tasks (pure function, returns filtered tasks)
 * - Apply sorting to tasks (global default first, then view-specific)
 * - Register dataflow event listeners for real-time updates
 * - Schedule and batch updates to prevent rapid re-renders
 *
 * NOTE: This manager is STATELESS - it does not hold tasks or filtered tasks.
 * All state is managed by TaskViewV2, this manager only executes operations.
 */
export class FluentDataManager extends Component {
	// Callbacks
	private onTasksLoaded?: (tasks: Task[], error: string | null) => void;
	private onLoadingStateChanged?: (isLoading: boolean) => void;
	private onUpdateNeeded?: (source: string) => void;

	// Batch operation state flag
	private isBatchOperating = false;
	private loadRequest = 0;
	private disposed = false;
	private listenersRegistered = false;
	private pendingDataRefresh = false;

	async finishInitialization(): Promise<void> {
		if (this.disposed || !this.pendingDataRefresh) return;
		this.pendingDataRefresh = false;
		await this.loadTasks(false);
	}

	onunload(): void { this.disposed = true; this.loadRequest++; }

	constructor(
		private plugin: TaskProgressBarPlugin,
		private getCurrentViewId: () => string,
		private getCurrentFilterState: () => {
			liveFilterState: RootFilterState | null;
			currentFilterState: RootFilterState | null;
			viewStateFilters: any;
			selectedProject: string | undefined;
			searchQuery: string;
			filterInputValue: string;
			activeTaskPreset: PresetTaskFilter["options"] | null;
		},
		private isInitializing: () => boolean,
	) {
		super();
	}

	/**
	 * Set callbacks for data operations
	 */
	setCallbacks(callbacks: {
		onTasksLoaded?: (tasks: Task[], error: string | null) => void;
		onLoadingStateChanged?: (isLoading: boolean) => void;
		onUpdateNeeded?: (source: string) => void;
	}) {
		this.onTasksLoaded = callbacks.onTasksLoaded;
		this.onLoadingStateChanged = callbacks.onLoadingStateChanged;
		this.onUpdateNeeded = callbacks.onUpdateNeeded;
	}

	/**
	 * Load tasks from dataflow or preloaded cache
	 * Returns loaded tasks via callback
	 */
	async loadTasks(showLoading = true): Promise<void> {
		if (this.disposed) return;
		const request = ++this.loadRequest;
		try {
			console.log(
				"[FluentData] loadTasks started, showLoading:",
				showLoading,
			);

			// Notify loading state
			if (showLoading && !this.isInitializing()) {
				console.log("[FluentData] Notifying loading state");
				this.onLoadingStateChanged?.(true);
			}

			let loadedTasks: Task[] = [];

			if (this.plugin.dataflowOrchestrator) {
				console.log(
					"[FluentData] Using dataflow orchestrator to load tasks",
				);
				const queryAPI = this.plugin.dataflowOrchestrator.getQueryAPI();
				console.log("[FluentData] Getting all tasks from queryAPI...");
				loadedTasks = await queryAPI.getAllTasks(true);
				console.log(
					`[FluentData] Loaded ${loadedTasks.length} tasks from dataflow`,
				);
			} else {
				console.log(
					"[FluentData] Dataflow not available, using preloaded tasks",
				);
				loadedTasks = this.plugin.preloadedTasks || [];
				console.log(
					`[FluentData] Loaded ${loadedTasks.length} preloaded tasks`,
				);
			}

			// Return loaded tasks via callback
			if (!this.disposed && request === this.loadRequest) this.onTasksLoaded?.(loadedTasks, null);
		} catch (error) {
			console.error("[FluentData] Failed to load tasks:", error);
			const errorMessage =
				(error as Error).message || "Failed to load tasks";
			// Return error via callback
			if (!this.disposed && request === this.loadRequest) this.onTasksLoaded?.([], errorMessage);
		} finally {
			// Always notify loading complete
			console.log("[FluentData] loadTasks complete");
			if (!this.disposed && request === this.loadRequest) this.onLoadingStateChanged?.(false);
		}
	}

	/**
	 * Apply filters to tasks (pure function - returns filtered tasks)
	 * @param tasks - All tasks to filter
	 * @returns Filtered tasks based on current filter state
	 */
	applyFilters(tasks: Task[]): Task[] {
		const viewId = this.getCurrentViewId();
		const filterState = this.getCurrentFilterState();
		if (viewId === "gantt") tasks = buildProjectPlan(this.plugin.app, tasks);
		if (viewId === "calendar" || this.plugin.settings.viewConfiguration.find(view => view.id === viewId)?.specificConfig?.viewType === "calendar") tasks = tasks.filter(task => !isProjectCalendarEntry(this.plugin.app, task));
		const query = filterState.filterInputValue || filterState.searchQuery || "";
		const structuredQuery = /\b(?:AND|OR|NOT)\b|\b[\w-]+\s*:/i.test(query);

		console.log(`[FluentData] applyFilters called for viewId: ${viewId}, total tasks: ${tasks.length}`);

		// Build filter options
		const filterOptions: any = {
			textQuery: structuredQuery ? "" : query,
			includeClosedTasks: !!filterState.activeTaskPreset,
		};

		// Always enable v2Filters for Working-on so the special filter runs
		if (viewId === "working-on") {
			filterOptions.v2Filters = filterOptions.v2Filters || {};
			console.log("[FluentData] Working-on view detected, will apply special filter");
		}

		// Apply advanced filters from the filter popover/modal
		if (
			filterState.currentFilterState &&
			filterState.currentFilterState.filterGroups &&
			filterState.currentFilterState.filterGroups.length > 0
		) {
			console.log("[FluentData] Applying advanced filters");
			filterOptions.advancedFilter = filterState.currentFilterState;
		}

		// If there are additional fluent-specific filters from the filter panel, pass them
		if (
			filterState.viewStateFilters &&
			Object.keys(filterState.viewStateFilters).length > 0
		) {
			filterOptions.v2Filters = filterState.viewStateFilters;
		}

		// Global project filter - Skip for Inbox view (Inbox tasks don't have projects by definition)
		if (filterState.selectedProject && viewId !== "inbox") {
			filterOptions.v2Filters = {
				...(filterOptions.v2Filters || {}),
				project: filterState.selectedProject,
			};
		}

		// Use the existing filterTasks utility which handles all view-specific logic
		let filteredTasks = filterTasks(
			tasks,
			viewId as any,
			this.plugin,
			filterOptions,
		);

		// Always apply working-on filter when in that view, regardless of v2Filters
		if (viewId === "working-on") {
			console.log(`[FluentData] Before applyWorkingOnFilter: ${filteredTasks.length} tasks`);
			filteredTasks = this.applyWorkingOnFilter(filteredTasks);
			console.log(`[FluentData] After applyWorkingOnFilter: ${filteredTasks.length} tasks`);
		}

		// Apply additional fluent-specific filters if needed (but skip working-on duplicate filter)
		if (filterOptions.v2Filters && viewId !== "working-on") {
			filteredTasks = this.applyV2Filters(
				filteredTasks,
				filterOptions.v2Filters,
			);
		}

		if (structuredQuery) {
			try {
				const tree = parseAdvancedFilterQuery(query);
				filteredTasks = filteredTasks.filter(task => evaluateFilterNode(tree, task));
			} catch { filteredTasks = []; }
		}
		const preset = filterState.activeTaskPreset;
		if (preset) {
			let presetTree: ReturnType<typeof parseAdvancedFilterQuery> | null = null;
			try { if (preset.advancedFilterQuery?.trim()) presetTree = parseAdvancedFilterQuery(preset.advancedFilterQuery); }
			catch { return []; }
			const marks = this.plugin.settings.taskStatuses;
			const split = (value?: string) => String(value || "").split("|").map(mark => mark.toLowerCase());
			const inProgress = split(marks?.inProgress);
			const completed = split(marks?.completed);
			const abandoned = split(marks?.abandoned);
			const planned = split(marks?.planned);
			const notStarted = split(marks?.notStarted || " ");
			const statusMatch = (task: Task) => {
				const mark = String(task.status ?? " ").toLowerCase();
				if (task.completed || completed.includes(mark)) return preset.includeCompleted;
				if (abandoned.includes(mark)) return preset.includeAbandoned;
				if (inProgress.includes(mark)) return preset.includeInProgress;
				if (planned.includes(mark)) return preset.includePlanned;
				if (notStarted.includes(mark)) return preset.includeNotStarted;
				return preset.includeNotStarted;
			};
			const queryMatch = (task: Task) => {
				const query = preset.advancedFilterQuery?.trim();
				if (!query) return true;
				const mark = String(task.status ?? " ").toLowerCase();
				const statusName = task.completed || completed.includes(mark) ? "completed"
					: abandoned.includes(mark) ? "abandoned"
					: inProgress.includes(mark) ? "in-progress"
					: planned.includes(mark) ? "planned"
					: ["~", "="].includes(mark) || (this.plugin.settings.statusCycles || []).some(cycle => Object.entries(cycle.marks).some(([name, symbol]) => symbol === task.status && /pause|暂停/i.test(name))) ? "paused"
					: "not-started";
				return evaluateFilterNode(presetTree, { ...task, statusName });
			};
			const directMatches = new Set<string>();
			for (const task of filteredTasks) {
				const matchesQuery = queryMatch(task);
				const matchesPreset = preset.filterMode === "EXCLUDE" ? !matchesQuery : matchesQuery;
				if (statusMatch(task) && matchesPreset) directMatches.add(task.id);
			}
			const included = new Set(directMatches);
			const allById = new Map(tasks.map(task => [task.id, task]));
			for (const id of directMatches) {
				const task = allById.get(id);
				if (!task) continue;
				const parentId = task.metadata?.parent;
				if (preset.includeParentTasks && parentId) included.add(parentId);
				if (preset.includeSiblingTasks && parentId) {
					for (const sibling of tasks) if (sibling.metadata?.parent === parentId) included.add(sibling.id);
				}
				if (preset.includeChildTasks) {
					const addChildren = (parent: Task) => {
						for (const childId of parent.metadata?.children || []) {
							if (included.has(childId)) continue;
							included.add(childId);
							const child = allById.get(childId);
							if (child) addChildren(child);
						}
					};
					addChildren(task);
				}
			}
			filteredTasks = tasks.filter(task => included.has(task.id));
		}

		console.log(
			`[FluentData] Final filtered result: ${filteredTasks.length} tasks from ${tasks.length} total for viewId: ${viewId}`,
		);

		// Apply sorting (global default first, then view-specific)
		filteredTasks = this.applySorting(filteredTasks, viewId);

		return filteredTasks;
	}

	/**
	 * Apply fluent-specific filters (pure function - returns filtered tasks)
	 * @param tasks - Tasks to filter
	 * @param filters - fluent filter configuration
	 * @returns Filtered tasks
	 */
	private applyV2Filters(tasks: Task[], filters: any): Task[] {
		const viewId = this.getCurrentViewId();
		let result = [...tasks]; // Copy array to avoid mutation

		const normalizeProjectId = (value?: string | null): string =>
			(value ?? "").trim().toLowerCase();

		// Working-on View Special Filter
		// Shows tasks that are: 1) In Progress status OR 2) Have an active timer
		if (viewId === "working-on") {
			result = this.applyWorkingOnFilter(result);
		}

		// Status filter
		if (filters.status && filters.status !== "all") {
			switch (filters.status) {
				case "active":
					result = result.filter((task) => !task.completed);
					break;
				case "completed":
					result = result.filter((task) => task.completed);
					break;
				case "overdue":
					result = result.filter((task) => {
						if (task.completed || !task.metadata?.dueDate)
							return false;
						return new Date(task.metadata.dueDate) < new Date();
					});
					break;
			}
		}

		// Priority filter
		if (filters.priority && filters.priority !== "all") {
			result = result.filter((task) => {
				const taskPriority = task.metadata?.priority || 0;
				const filterPriority =
					typeof filters.priority === "string"
						? parseInt(filters.priority)
						: filters.priority;
				return taskPriority === filterPriority;
			});
		}

		// Project filter - Skip for Inbox view
		if (filters.project && viewId !== "inbox") {
			const targetProject = normalizeProjectId(filters.project);
			result = result.filter((task) => {
				const directProject = normalizeProjectId(
					task.metadata?.project,
				);
				const tgProject = normalizeProjectId(
					task.metadata?.tgProject?.name,
				);
				return (
					targetProject.length > 0 &&
					(targetProject === directProject ||
						targetProject === tgProject)
				);
			});
		}

		// Tags filter
		if (filters.tags && filters.tags.length > 0) {
			result = result.filter((task) => {
				if (!task.metadata?.tags) return false;
				return filters.tags.some((tag: string) =>
					task.metadata.tags.includes(tag),
				);
			});
		}

		// Date range filter
		if (filters.dateRange) {
			if (filters.dateRange.start) {
				result = result.filter((task) => {
					if (!task.metadata?.dueDate) return false;
					return (
						new Date(task.metadata.dueDate) >=
						filters.dateRange.start
					);
				});
			}
			if (filters.dateRange.end) {
				result = result.filter((task) => {
					if (!task.metadata?.dueDate) return false;
					return (
						new Date(task.metadata.dueDate) <= filters.dateRange.end
					);
				});
			}
		}

		// Assignee filter
		if (filters.assignee) {
			result = result.filter(
				(task) => task.metadata?.assignee === filters.assignee,
			);
		}

		return result;
	}

	/**
	 * Apply Working-on view filter
	 * Shows tasks that are: 1) In Progress status OR 2) Have an active timer (running or paused)
	 * @param tasks - Tasks to filter
	 * @returns Filtered tasks for Working-on view
	 */
	private applyWorkingOnFilter(tasks: Task[]): Task[] {
		console.log(`[FluentData] applyWorkingOnFilter called with ${tasks.length} tasks`);
		
		// Get in-progress status marks from settings
		const inProgressMarks = (
			this.plugin.settings.taskStatuses.inProgress || ">|/"
		)
			.split("|")
			.map((m) => m.trim())
			.filter(Boolean);

		console.log(`[FluentData] In-progress marks: ${inProgressMarks.join(", ")}`);

		// Get timer manager instance if timer feature is enabled
		let timerManager: TaskTimerManager | null = null;
		let activeTimerBlockIds: Set<string> = new Set();

		if (this.plugin.settings.taskTimer?.enabled) {
			timerManager = new TaskTimerManager(this.plugin.settings.taskTimer);

			// Get all active timers and build a set of block IDs
			const activeTimers = timerManager.getAllActiveTimers();
			console.log(`[FluentData] Active timers count: ${activeTimers.length}`);
			for (const timer of activeTimers) {
				if (timer.status === "running" || timer.status === "paused") {
					activeTimerBlockIds.add(timer.blockId);
				}
			}
		}

		const result = tasks.filter((task) => {
			// Skip completed tasks
			if (task.completed) return false;

			// Condition 1: Task has In Progress status
			const taskStatus = task.status || " ";
			const isInProgress = inProgressMarks.includes(taskStatus);
			if (isInProgress) return true;

			// Condition 2: Task has an active timer
			const blockId = task.metadata?.id;
			if (blockId && activeTimerBlockIds.has(blockId)) {
				return true;
			}

			return false;
		});
		
		console.log(`[FluentData] applyWorkingOnFilter result: ${result.length} tasks after filter`);
		return result;
	}

	/**
	 * Apply sorting to tasks (pure function - returns sorted tasks)
	 * Applies global default sorting first, then view-specific sorting
	 * @param tasks - Tasks to sort
	 * @param viewId - Current view ID
	 * @returns Sorted tasks
	 */
	private applySorting(tasks: Task[], viewId: string): Task[] {
		let result = [...tasks]; // Copy array to avoid mutation

		// Get view configuration
		const viewConfig = this.plugin.settings.viewConfiguration.find(
			(view) => view.id === viewId,
		);

		// Collect sort criteria: global first, then view-specific
		const globalCriteria = this.plugin.settings.sortCriteria || [];
		const viewCriteria = viewConfig?.sortCriteria || [];

		// Merge criteria: global first, then view-specific (view-specific takes precedence)
		const mergedCriteria = [...globalCriteria, ...viewCriteria];

		// Apply sorting if criteria exist
		if (mergedCriteria.length > 0) {
			console.log(
				`[FluentData] Applying ${mergedCriteria.length} sort criteria to ${result.length} tasks`,
			);
			result = sortTasks(result, mergedCriteria, this.plugin.settings);
		}

		return result;
	}

	/**
	 * Register dataflow event listeners for real-time updates
	 * Notifies parent via onUpdateNeeded callback
	 */
	async registerDataflowListeners(): Promise<void> {
		if (this.listenersRegistered || this.disposed) return;
		this.listenersRegistered = true;
		// Add debounced view update to prevent rapid successive refreshes
		const debouncedViewUpdate = debounce(async () => {
			if (this.disposed) return;
			console.log("[FluentData] debouncedViewUpdate triggered");

			// Skip update during batch operation to prevent list flashing
			if (this.isBatchOperating) {
				console.log(
					"[FluentData] Skipping update during batch operation",
				);
				return;
			}

			if (!this.isInitializing()) {
				this.pendingDataRefresh = false;
				// Load tasks and notify parent
				await this.loadTasks(false);
				// Notify parent that data changed
				if (!this.disposed) this.onUpdateNeeded?.("dataflow");
			}
		}, 500);

		// Add debounced filter application
		const debouncedApplyFilter = debounce(() => {
			if (!this.disposed && !this.isInitializing()) {
				this.onUpdateNeeded?.("filter-changed");
			}
		}, 400);

		this.register(() => { (debouncedViewUpdate as any).cancel?.(); (debouncedApplyFilter as any).cancel?.(); });
		const requestDataRefresh = () => { this.pendingDataRefresh = true; debouncedViewUpdate(); };

		const scheduleFilterRefresh = () => {
			if (this.isInitializing()) {
				return;
			}

			// Re-use filter debounce so resorting happens once per burst
			debouncedApplyFilter();
		};

		// Listen for cache ready event
		this.registerEvent(
			on(this.plugin.app, Events.CACHE_READY, async () => {
				await this.loadTasks();
				this.onUpdateNeeded?.("cache-ready");
			}),
		);

		// Register dataflow event listeners
		if (isDataflowEnabled(this.plugin)) {
			// Listen for batch operation start
			this.registerEvent(
				on(this.plugin.app, Events.BATCH_OPERATION_START, (payload) => {
					console.log(
						`[FluentData] Batch operation started: ${payload.count} tasks`,
					);
					this.isBatchOperating = true;
				}),
			);

			// Listen for batch operation complete
			this.registerEvent(
				on(
					this.plugin.app,
					Events.BATCH_OPERATION_COMPLETE,
					async (payload) => {
						console.log(
							`[FluentData] Batch operation complete: ${payload.successCount} succeeded, ${payload.failCount} failed`,
						);
						this.isBatchOperating = false;

						// Immediately refresh view after batch operation (skip debounce)
						if (!this.isInitializing()) {
							await this.loadTasks(false);
							this.onUpdateNeeded?.("batch-operation-complete");
						}
					},
				),
			);


			// Listen for task cache updates
			this.registerEvent(
				on(
					this.plugin.app,
					Events.TASK_CACHE_UPDATED,
					requestDataRefresh,
				),
			);
		} else {
			// Legacy event support
			this.registerEvent(
				this.plugin.app.workspace.on(
					"task-genius:task-cache-updated",
					requestDataRefresh,
				),
			);
		}

		// Listen for filter change events
		this.registerEvent(
			this.plugin.app.workspace.on(
				"task-genius:filter-changed",
				(filterState: RootFilterState, leafId?: string) => {
					// Only update if it's from a live filter component
					if (
						!leafId ||
						(!leafId.startsWith("view-config-") &&
							leafId !== "global-filter")
					) {
						console.log(
							"[FluentData] Filter changed, notifying update needed",
						);
						debouncedApplyFilter();
					}
				},
			),
		);

		// Listen for view configuration changes (sort/filter updates saved from modals)
		this.registerEvent(
			this.plugin.app.workspace.on(
				"task-genius:view-config-changed",
				(payload: { reason: string; viewId?: string } | undefined) => {
					const currentViewId = this.getCurrentViewId();
					if (payload?.viewId && payload.viewId !== currentViewId) {
						return;
					}

					console.log(
						`[FluentData] View config changed (reason: ${payload?.reason ?? "unknown"})`,
					);
					scheduleFilterRefresh();
				},
			),
		);

		// Listen for global settings changes (e.g., default sort criteria updates)
		this.registerEvent(
			on(this.plugin.app, Events.SETTINGS_CHANGED, () => {
				console.log(
					"[FluentData] Settings changed event received, scheduling resort",
				);
				scheduleFilterRefresh();
			}),
		);
	}

	/**
	 * Get current filter count for badge display
	 */
	getActiveFilterCount(): number {
		const filterState = this.getCurrentFilterState();
		let count = 0;

		if (filterState.searchQuery || filterState.filterInputValue) count++;
		if (filterState.selectedProject) count++;
		if (filterState.currentFilterState?.filterGroups?.length) {
			count += filterState.currentFilterState.filterGroups.length;
		}

		return count;
	}
}
