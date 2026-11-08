import { App, Component, setIcon } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";
import { QuadrantDefinition } from './quadrant';
import { QuadrantCardComponent } from "./quadrant-card";
import { t } from "@/translations/helper";
import "@/styles/quadrant/quadrant.css";

export class QuadrantColumnComponent extends Component {
	plugin: TaskProgressBarPlugin;
	app: App;
	public containerEl: HTMLElement;
	private headerEl: HTMLElement;
	private titleEl: HTMLElement;
	private countEl: HTMLElement;
	private contentEl: HTMLElement;
	private scrollContainerEl: HTMLElement;
	private quadrant: QuadrantDefinition;
	private tasks: Task[] = [];
	private cardComponents: QuadrantCardComponent[] = [];
	private isContentLoaded: boolean = false;
	private intersectionObserver: IntersectionObserver | null = null;
	private scrollObserver: IntersectionObserver | null = null;
	private loadingEl: HTMLElement | null = null;
	private loadMoreEl: HTMLElement | null = null;

	// Pagination and virtual scrolling
	private currentPage: number = 0;
	private pageSize: number = 20;
	private isLoadingMore: boolean = false;
	private renderRevision = 0;
	private disposed = false;
	private hasMoreTasks: boolean = true;
	private renderedTasks: Task[] = [];

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

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		containerEl: HTMLElement,
		quadrant: QuadrantDefinition,
		params: {
			onTaskStatusUpdate?: (
				taskId: string,
				newStatusMark: string
			) => Promise<void>;
			onTaskSelected?: (task: Task) => void;
			onTaskCompleted?: (task: Task) => void;
			onTaskContextMenu?: (ev: MouseEvent, task: Task) => void;
			onTaskUpdated?: (task: Task) => Promise<void>;
		} = {}
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.containerEl = containerEl;
		this.quadrant = quadrant;
		this.params = params;
	}

	override onload() {
		super.onload();
		this.render();

		// Setup observers after render so scroll container exists
		setTimeout(() => {
			this.setupLazyLoading();
			this.setupScrollLoading();
			this.setupManualScrollListener();

			// Force initial content check
			this.checkInitialVisibility();
		}, 50);

		// Additional fallback - force load after a longer delay if still not loaded
		setTimeout(() => {
			if (!this.isContentLoaded && this.tasks.length > 0) {
				console.log(
					`Fallback loading for ${this.quadrant.id} - forcing content load`
				);
				this.loadContent();
			}
		}, 500);

		// Extra aggressive fallback for small task counts
		setTimeout(() => {
			if (
				!this.isContentLoaded &&
				this.tasks.length > 0 &&
				this.tasks.length <= this.pageSize
			) {
				console.log(
					`Extra aggressive fallback for small task count in ${this.quadrant.id}`
				);
				this.loadContent();
			}
		}, 1000);
	}

	override onunload() {
		this.disposed = true; this.renderRevision++;
		this.cleanup();
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect();
			this.intersectionObserver = null;
		}
		if (this.scrollObserver) {
			this.scrollObserver.disconnect();
			this.scrollObserver = null;
		}
		// Remove scroll listener
		if (this.scrollContainerEl) {
			this.scrollContainerEl.removeEventListener(
				"scroll",
				this.handleScroll
			);
		}
		super.onunload();
	}

	private cleanup() {
		// Clean up card components
		this.cardComponents.forEach((card) => {
			this.removeChild(card);
		});
		this.cardComponents = [];
	}

	private render() {
		this.containerEl.empty();
		this.containerEl.addClass("tg-quadrant-column");
		this.containerEl.addClass(this.quadrant.className);

		// Create header
		this.createHeader();

		// Create scrollable content area
		this.createScrollableContent();
	}

	private createHeader() {
		this.headerEl = this.containerEl.createDiv("tg-quadrant-header");

		// Title and priority indicator
		const titleContainerEl = this.headerEl.createDiv(
			"tg-quadrant-title-container"
		);

		// Priority emoji
		const priorityEl = titleContainerEl.createSpan("tg-quadrant-priority");
		priorityEl.textContent = this.quadrant.priorityEmoji;

		// Title
		this.titleEl = titleContainerEl.createDiv("tg-quadrant-title");
		this.titleEl.textContent = this.quadrant.title;

		// Task count
		this.countEl = this.headerEl.createDiv("tg-quadrant-count");
		this.updateCount();
	}

	private createScrollableContent() {
		// Create scroll container
		this.scrollContainerEl = this.containerEl.createDiv(
			"tg-quadrant-scroll-container"
		);

		// Add scroll event listener
		this.scrollContainerEl.addEventListener("scroll", this.handleScroll, {
			passive: true,
		});

		// Create content area inside scroll container
		this.contentEl = this.scrollContainerEl.createDiv(
			"tg-quadrant-column-content"
		);
		this.contentEl.setAttribute("data-quadrant-id", this.quadrant.id);

		// Create load more indicator
		this.createLoadMoreIndicator();
	}

	private createLoadMoreIndicator() {
		this.loadMoreEl = this.scrollContainerEl.createDiv(
			"tg-quadrant-load-more"
		);

		const spinnerEl = this.loadMoreEl.createDiv(
			"tg-quadrant-load-more-spinner"
		);
		setIcon(spinnerEl, "loader-2");

		const messageEl = this.loadMoreEl.createDiv(
			"tg-quadrant-load-more-message"
		);
		messageEl.textContent = t("Loading more tasks...");
	}

	private checkInitialVisibility() {
		// Force load content if the column is visible in viewport
		if (!this.isContentLoaded && this.isElementVisible()) {
			console.log(
				`Force loading content for quadrant: ${this.quadrant.id}`
			);
			this.loadContent();
		}
	}

	private isElementVisible(): boolean {
		if (!this.containerEl) return false;

		// For quadrant grid layout, check if the column container is visible in viewport
		const containerRect = this.containerEl.getBoundingClientRect();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		// Column is visible if any part of it is in the viewport
		const isInViewport =
			containerRect.top < viewportHeight &&
			containerRect.bottom > 0 &&
			containerRect.left < viewportWidth &&
			containerRect.right > 0;

		// For grid layout, also check if the column has reasonable dimensions
		const hasReasonableSize =
			containerRect.width > 50 && containerRect.height > 50;

		return isInViewport && hasReasonableSize;
	}

	private setupLazyLoading() {
		// For quadrant view, we need a different approach since columns are in a grid
		// and may not be properly detected by intersection observer

		// For small task counts, be more aggressive and load immediately
		if (this.tasks.length <= this.pageSize) {
			console.log(
				`Small task count detected (${this.tasks.length}), loading immediately for ${this.quadrant.id}`
			);
			this.loadContent();
			return;
		}

		// First, try immediate loading if element is visible
		if (this.isElementVisible()) {
			console.log(
				`Immediately loading content for visible quadrant: ${this.quadrant.id}`
			);
			this.loadContent();
			return;
		}

		// Create intersection observer for lazy loading with both viewport and container detection
		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !this.isContentLoaded) {
						console.log(
							`Intersection triggered for quadrant: ${this.quadrant.id}`
						);
						this.loadContent();
					}
				});
			},
			{
				root: null, // Use viewport as root for better grid detection
				rootMargin: "100px", // Larger margin to catch grid items
				threshold: 0.01, // Lower threshold to trigger more easily
			}
		);

		// Start observing the content element
		this.intersectionObserver.observe(this.contentEl);

		// Also observe the container element as backup
		if (this.containerEl) {
			this.intersectionObserver.observe(this.containerEl);
		}
	}

	private setupScrollLoading() {
		// Create intersection observer for scroll loading
		this.scrollObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (
						entry.isIntersecting &&
						this.hasMoreTasks &&
						!this.isLoadingMore &&
						this.isContentLoaded
					) {
						console.log(
							"Triggering loadMoreTasks - intersection detected"
						);
						this.loadMoreTasks();
					}
				});
			},
			{
				root: this.scrollContainerEl, // Use scroll container as root for proper detection
				rootMargin: "50px", // Smaller margin for scroll container
				threshold: 0.1,
			}
		);

		// Start observing the load more element when it's created
		this.observeLoadMoreElement();
	}

	private observeLoadMoreElement() {
		if (this.loadMoreEl && this.scrollObserver) {
			this.scrollObserver.observe(this.loadMoreEl);
		}
	}

	private async loadContent() {
		if (this.disposed || this.isContentLoaded) return;

		this.isContentLoaded = true;

		// Remove loading indicator if it exists
		if (this.loadingEl) {
			this.loadingEl.remove();
			this.loadingEl = null;
		}

		// Reset pagination
		this.currentPage = 0;
		this.renderedTasks = [];

		// Load first page of tasks
		await this.loadMoreTasks();

		// Setup scroll observer after initial load
		this.observeLoadMoreElement();
	}

	private async loadMoreTasks() {
		if (this.disposed || this.isLoadingMore) {
			return;
		}

		// For small task counts, ensure we still process them even if hasMoreTasks is false
		const shouldProcess =
			this.hasMoreTasks ||
			(this.renderedTasks.length === 0 && this.tasks.length > 0);

		if (!shouldProcess) {
			return;
		}

		const revision = this.renderRevision;
		this.isLoadingMore = true;
		this.showLoadMoreIndicator();

		try {
			// Calculate which tasks to load for this page
			const startIndex = this.currentPage * this.pageSize;
			const endIndex = startIndex + this.pageSize;
			const tasksToLoad = this.tasks.slice(startIndex, endIndex);

			if (tasksToLoad.length === 0) {
				this.hasMoreTasks = false;
				this.hideLoadMoreIndicator();
				return;
			}

			// Add tasks to rendered list
			this.renderedTasks.push(...tasksToLoad);

			// Render the new batch of tasks
			await this.renderTaskBatch(tasksToLoad, revision);
			if (this.disposed || revision !== this.renderRevision) return;

			// Update pagination
			this.currentPage++;

			// Check if there are more tasks to load
			if (endIndex >= this.tasks.length) {
				this.hasMoreTasks = false;
				this.hideLoadMoreIndicator();
			} else {
				// Show load more indicator if there are more tasks
				this.showLoadMoreIndicator();
			}
		} catch (error) {
			console.error("Error loading more tasks:", error);
		} finally {
			if (revision === this.renderRevision) this.isLoadingMore = false;
		}
	}

	private showLoadMoreIndicator() {
		if (this.loadMoreEl && this.hasMoreTasks) {
			this.loadMoreEl.addClass("tg-quadrant-load-more--visible");
		}
	}

	private hideLoadMoreIndicator() {
		if (this.loadMoreEl) {
			this.loadMoreEl.removeClass("tg-quadrant-load-more--visible");
		}
	}



	public setTasks(tasks: Task[], force = false) {
		if (this.disposed || (!force && this.areTasksEqual(this.tasks, tasks))) return;
		this.tasks = tasks.map(task => ({ ...task, metadata: { ...task.metadata, tags: [...(task.metadata.tags || [])], children: [...(task.metadata.children || [])] } }));
		this.updateCount(); this.isContentLoaded = true;
		this.loadingEl?.remove(); this.loadingEl = null;
		void this.renderTasks();
	}

	/**
	 * Check if two task arrays are equal (same tasks in same order)
	 */
	private areTasksEqual(currentTasks: Task[], newTasks: Task[]): boolean {
		if (currentTasks.length !== newTasks.length) {
			return false;
		}

		if (currentTasks.length === 0 && newTasks.length === 0) {
			return true;
		}

		// Quick ID-based comparison first
		for (let i = 0; i < currentTasks.length; i++) {
			if (currentTasks[i].id !== newTasks[i].id) {
				return false;
			}
		}

		// If IDs match, do a deeper comparison of content
		for (let i = 0; i < currentTasks.length; i++) {
			if (!this.areTasksContentEqual(currentTasks[i], newTasks[i])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check if two individual tasks have equal content
	 */
	private areTasksContentEqual(task1: Task, task2: Task): boolean {
		// Compare basic properties
		if (
			task1.content !== task2.content ||
			task1.status !== task2.status ||
			task1.completed !== task2.completed
		) {
			return false;
		}

		// Compare metadata if it exists
		if (task1.metadata && task2.metadata) {
			// Check important metadata fields
			if (
				task1.metadata.priority !== task2.metadata.priority ||
				task1.metadata.dueDate !== task2.metadata.dueDate ||
				task1.metadata.scheduledDate !== task2.metadata.scheduledDate ||
				task1.metadata.startDate !== task2.metadata.startDate
			) {
				return false;
			}

			// Check tags
			const tags1 = task1.metadata.tags || [];
			const tags2 = task2.metadata.tags || [];
			if (
				tags1.length !== tags2.length ||
				!tags1.every((tag) => tags2.includes(tag))
			) {
				return false;
			}
		} else if (task1.metadata !== task2.metadata) {
			// One has metadata, the other doesn't
			return false;
		}

		return true;
	}

	/**
	 * Force update tasks even if they appear to be the same
	 */
	public forceSetTasks(tasks: Task[]) { this.setTasks(tasks, true); }

	/**
	 * Update a single task in the column
	 */
	public updateTask(updatedTask: Task) {
		const taskIndex = this.tasks.findIndex(
			(task) => task.id === updatedTask.id
		);
		if (taskIndex === -1) {
			console.warn(
				`Task ${updatedTask.id} not found in quadrant ${this.quadrant.id}`
			);
			return;
		}

		// Check if the task actually changed
		if (this.areTasksContentEqual(this.tasks[taskIndex], updatedTask)) {
			console.log(`Task ${updatedTask.id} unchanged, skipping update`);
			return;
		}

		// Update the task
		this.tasks[taskIndex] = updatedTask;
		this.updateCount();

		// Update the rendered task if it's currently visible
		const renderedIndex = this.renderedTasks.findIndex(
			(task) => task.id === updatedTask.id
		);
		if (renderedIndex !== -1) {
			this.renderedTasks[renderedIndex] = updatedTask;

			// Find and update the card component
			const cardComponent = this.cardComponents.find((card) => {
				const cardEl = card.containerEl;
				return cardEl.getAttribute("data-task-id") === updatedTask.id;
			});

			if (cardComponent) {
				// Update the card component with new task data
				cardComponent.updateTask(updatedTask);
			}
		}

		console.log(
			`Updated task ${updatedTask.id} in quadrant ${this.quadrant.id}`
		);
	}

	/**
	 * Add a task to the column
	 */
	public addTask(task: Task) {
		// Check if task already exists
		if (this.tasks.some((t) => t.id === task.id)) {
			console.warn(
				`Task ${task.id} already exists in quadrant ${this.quadrant.id}`
			);
			return;
		}

		this.tasks.push(task);
		this.updateCount();

		// If content is loaded and we have space, render the new task
		if (
			this.isContentLoaded &&
			this.renderedTasks.length < this.tasks.length
		) {
			this.renderedTasks.push(task);
			this.renderSingleTask(task);
		}

		console.log(`Added task ${task.id} to quadrant ${this.quadrant.id}`);
	}

	/**
	 * Remove a task from the column
	 */
	public removeTask(taskId: string) {
		const taskIndex = this.tasks.findIndex((task) => task.id === taskId);
		if (taskIndex === -1) {
			console.warn(
				`Task ${taskId} not found in quadrant ${this.quadrant.id}`
			);
			return;
		}

		// Remove from tasks array
		this.tasks.splice(taskIndex, 1);
		this.updateCount();

		// Remove from rendered tasks
		const renderedIndex = this.renderedTasks.findIndex(
			(task) => task.id === taskId
		);
		if (renderedIndex !== -1) {
			this.renderedTasks.splice(renderedIndex, 1);
		}

		// Remove card component
		const cardIndex = this.cardComponents.findIndex((card) => {
			const cardEl = card.containerEl;
			return cardEl.getAttribute("data-task-id") === taskId;
		});

		if (cardIndex !== -1) {
			const card = this.cardComponents[cardIndex];
			this.removeChild(card);
			card.containerEl.remove();
			this.cardComponents.splice(cardIndex, 1);
		}

		// Show empty state if no tasks left
		if (this.tasks.length === 0 && this.isContentLoaded) {
			this.showEmptyState();
		}

		console.log(`Removed task ${taskId} from quadrant ${this.quadrant.id}`);
	}

	/**
	 * Render a single task (used for adding new tasks)
	 */
	private async renderSingleTask(task: Task) {
		const cardEl = document.createElement("div");
		cardEl.className = "tg-quadrant-card";
		cardEl.setAttribute("data-task-id", task.id);

		const card = new QuadrantCardComponent(
			this.app,
			this.plugin,
			cardEl,
			task,
			{
				onTaskStatusUpdate: this.params.onTaskStatusUpdate,
				onTaskSelected: this.params.onTaskSelected,
				onTaskCompleted: this.params.onTaskCompleted,
				onTaskContextMenu: this.params.onTaskContextMenu,
				onTaskUpdated: async (updatedTask: Task) => {
					this.params.onTaskUpdated?.(updatedTask);
				},
			}
		);

		this.addChild(card);
		this.cardComponents.push(card);
		this.contentEl.appendChild(cardEl);
	}

	private updateCount() {
		if (this.countEl) {
			this.countEl.textContent = `${this.tasks.length} ${
				this.tasks.length === 1 ? t("task") : t("tasks")
			}`;
		}
	}

	private async renderTasks() {
		if (this.disposed || !this.contentEl) return;
		const revision = ++this.renderRevision;
		this.isLoadingMore = false;

		// Clean up existing components
		this.cleanup();

		// Clear content
		this.contentEl.empty();

		// Reset pagination and render first page
		this.currentPage = 0;
		this.renderedTasks = [];
		this.hasMoreTasks = this.tasks.length > this.pageSize;
		this.hideLoadMoreIndicator();

		await this.loadMoreTasks();
		if (this.disposed || revision !== this.renderRevision) return;

		// Show empty state if no tasks
		if (this.tasks.length === 0) {
			this.showEmptyState();
		}
	}

	private async renderTaskBatch(tasks: Task[], revision = this.renderRevision) {
		if (!tasks.length || this.disposed || revision !== this.renderRevision) return;

		const fragment = document.createDocumentFragment();

		// Render tasks in smaller sub-batches to prevent UI blocking
		const subBatchSize = 5;
		for (let i = 0; i < tasks.length; i += subBatchSize) {
			if (this.disposed || revision !== this.renderRevision) return;
			const subBatch = tasks.slice(i, i + subBatchSize);

			subBatch.forEach((task) => {
				const cardEl = document.createElement("div");
				cardEl.className = "tg-quadrant-card";
				cardEl.setAttribute("data-task-id", task.id);

				const card = new QuadrantCardComponent(
					this.app,
					this.plugin,
					cardEl,
					task,
					{
						onTaskStatusUpdate: this.params.onTaskStatusUpdate,
						onTaskSelected: this.params.onTaskSelected,
						onTaskCompleted: this.params.onTaskCompleted,
						onTaskContextMenu: this.params.onTaskContextMenu,
						onTaskUpdated: async (updatedTask: Task) => {
							// Notify parent quadrant component that a task was updated
							// This will trigger a refresh to re-categorize tasks
							if (this.params.onTaskStatusUpdate) {
								await this.params.onTaskStatusUpdate(
									updatedTask.id,
									updatedTask.status
								);
							}
						},
					}
				);

				this.addChild(card);
				this.cardComponents.push(card);
				fragment.appendChild(cardEl);
			});

			// Small delay between sub-batches
			if (i + subBatchSize < tasks.length) {
				await new Promise((resolve) => setTimeout(resolve, 5));
			}
		}

		if (this.disposed || revision !== this.renderRevision) return;
		this.contentEl.appendChild(fragment);

		// Force a scroll check after rendering
		setTimeout(() => {
			this.checkScrollPosition();
		}, 100);
	}

	private checkScrollPosition() {
		if (!this.scrollContainerEl || !this.loadMoreEl) return;

		const container = this.scrollContainerEl;
		const loadMore = this.loadMoreEl;

		// Check if load more element is visible within the scroll container
		const containerRect = container.getBoundingClientRect();
		const loadMoreRect = loadMore.getBoundingClientRect();

		// More precise visibility check for nested scroll containers
		const isVisible =
			loadMoreRect.top < containerRect.bottom &&
			loadMoreRect.bottom > containerRect.top &&
			loadMoreRect.left < containerRect.right &&
			loadMoreRect.right > containerRect.left;

		// Also check scroll position as backup
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight;
		const clientHeight = container.clientHeight;
		const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

		if (
			(isVisible || isNearBottom) &&
			this.hasMoreTasks &&
			!this.isLoadingMore
		) {
			this.loadMoreTasks();
		}
	}

	private showEmptyState() {
		this.cleanup(); this.contentEl.empty();
		const emptyEl = this.contentEl.createDiv("tg-quadrant-empty-state");

		const iconEl = emptyEl.createDiv("tg-quadrant-empty-icon");
		setIcon(iconEl, "inbox");

		const messageEl = emptyEl.createDiv("tg-quadrant-empty-message");
		messageEl.textContent = this.getEmptyStateMessage();
	}

	private getEmptyStateMessage(): string {
		switch (this.quadrant.id) {
			case "urgent-important":
				return t("No crisis tasks - great job!");
			case "not-urgent-important":
				return t("No planning tasks - consider adding some goals");
			case "urgent-not-important":
				return t("No interruptions - focus time!");
			case "not-urgent-not-important":
				return t("No time wasters - excellent focus!");
			default:
				return t("No tasks in this quadrant");
		}
	}

	public setVisibility(visible: boolean) {
		if (visible) {
			this.containerEl.removeClass("tg-quadrant-column--hidden");
		} else {
			this.containerEl.addClass("tg-quadrant-column--hidden");
		}
	}

	public addDropIndicator() {
		this.contentEl.addClass("tg-quadrant-column-content--drop-active");
		this.containerEl.addClass("tg-quadrant-column--drag-target");
	}

	public removeDropIndicator() {
		this.contentEl.removeClass("tg-quadrant-column-content--drop-active");
		this.containerEl.removeClass("tg-quadrant-column--drag-target");
		// Also remove any other drag-related classes
		this.containerEl.removeClass("tg-quadrant-column--highlighted");

		// Force cleanup of any lingering styles with a small delay
		setTimeout(() => {
			// Double-check and clean up any remaining drag classes
			this.contentEl.removeClass(
				"tg-quadrant-column-content--drop-active"
			);
			this.containerEl.removeClass("tg-quadrant-column--drag-target");
			this.containerEl.removeClass("tg-quadrant-column--highlighted");
		}, 10);
	}

	public forceLoadContent() {
		console.log(`forceLoadContent called for ${this.quadrant.id}`);
		if (!this.isContentLoaded) {
			this.loadContent();
		}
	}

	public async loadAllTasks() {
		// Force load all remaining tasks (useful for drag operations)
		if (!this.hasMoreTasks) return;

		console.log("Loading all remaining tasks asynchronously");
		this.hasMoreTasks = false;
		this.hideLoadMoreIndicator();

		// Load all remaining tasks in batches to avoid UI blocking
		const remainingTasks = this.tasks.slice(this.renderedTasks.length);
		if (remainingTasks.length === 0) return;

		const batchSize = 10;
		for (let i = 0; i < remainingTasks.length; i += batchSize) {
			const batch = remainingTasks.slice(i, i + batchSize);
			await this.renderTaskBatch(batch);
			this.renderedTasks.push(...batch);

			// Small delay between batches to keep UI responsive
			if (i + batchSize < remainingTasks.length) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
		}

		console.log("Finished loading all tasks");
	}

	public getQuadrantId(): string {
		return this.quadrant.id;
	}

	public getQuadrant(): QuadrantDefinition {
		return this.quadrant;
	}

	public getTasks(): Task[] {
		return this.tasks;
	}

	public getRenderedTasks(): Task[] {
		return this.renderedTasks;
	}

	public getTaskCount(): number {
		return this.tasks.length;
	}

	public isEmpty(): boolean {
		return this.tasks.length === 0;
	}

	public isLoaded(): boolean {
		return this.isContentLoaded;
	}

	public hasMoreToLoad(): boolean {
		return this.hasMoreTasks;
	}

	// Method to get quadrant-specific styling or behavior
	public getQuadrantColor(): string {
		switch (this.quadrant.id) {
			case "urgent-important":
				return "var(--text-error)"; // Error color - Crisis
			case "not-urgent-important":
				return "var(--color-accent)"; // Accent color - Growth
			case "urgent-not-important":
				return "var(--text-warning)"; // Warning color - Caution
			case "not-urgent-not-important":
				return "var(--text-muted)"; // Muted color - Eliminate
			default:
				return "var(--color-accent)"; // Accent color - Default
		}
	}

	// Method to get quadrant recommendations
	public getQuadrantRecommendation(): string {
		switch (this.quadrant.id) {
			case "urgent-important":
				return t(
					"Handle immediately. These are critical tasks that need your attention now."
				);
			case "not-urgent-important":
				return t(
					"Schedule and plan. These tasks are key to your long-term success."
				);
			case "urgent-not-important":
				return t(
					"Delegate if possible. These tasks are urgent but don't require your specific skills."
				);
			case "not-urgent-not-important":
				return t(
					"Eliminate or minimize. These tasks may be time wasters."
				);
			default:
				return t("Review and categorize these tasks appropriately.");
		}
	}

	private setupManualScrollListener() {
		// Add manual scroll listener as backup
		this.handleScroll = this.handleScroll.bind(this);
	}

	private handleScroll = () => {
		if (
			!this.scrollContainerEl ||
			!this.hasMoreTasks ||
			this.isLoadingMore
		) {
			return;
		}

		const container = this.scrollContainerEl;
		const scrollTop = container.scrollTop;
		const scrollHeight = container.scrollHeight;
		const clientHeight = container.clientHeight;

		// Check if we're near the bottom (within 100px)
		const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

		if (isNearBottom) {
			this.loadMoreTasks();
		}
	};

	public prepareDragOperation() {
		// Lightweight preparation for drag operations
		// Only load a few more tasks if needed, not all
		if (
			this.hasMoreTasks &&
			this.renderedTasks.length < this.pageSize * 2
		) {
			this.loadMoreTasks();
		}
	}
}
