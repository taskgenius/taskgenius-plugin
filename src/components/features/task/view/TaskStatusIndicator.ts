import { Component, Menu, setIcon } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";

interface TaskStatusConfig {
	cycle: string[];
	marks: Record<string, string>;
	excludeMarksFromCycle: string[];
}

const FALLBACK_STATUS_MARKS: Record<string, string> = {
	TODO: " ",
	DOING: "-",
	"IN-PROGRESS": ">",
	DONE: "x",
};

export interface TaskStatusIndicatorParams {
	task: Task;
	plugin: TaskProgressBarPlugin;
	onStatusChange?: (previous: Task, updated: Task) => Promise<void> | void;
	canInteract?: () => boolean;
}

interface StatusContext {
	config: TaskStatusConfig;
	currentMark: string;
	statusName?: string;
	displayName: string;
	nextStatus?: string;
	statusSlug: string;
	isCompleted: boolean;
	hasCycle: boolean;
}

export class TaskStatusIndicator extends Component {
	private element: HTMLElement | null = null;
	private statusTextEl: HTMLElement | null = null;
	private readonly plugin: TaskProgressBarPlugin;
	private readonly onStatusChange?: (
		previous: Task,
		updated: Task,
	) => Promise<void> | void;
	private readonly canInteract?: () => boolean;
	private isProcessing = false;
	private task: Task;

	constructor({
		task,
		plugin,
		onStatusChange,
		canInteract,
	}: TaskStatusIndicatorParams) {
		super();
		this.task = task;
		this.plugin = plugin;
		this.onStatusChange = onStatusChange;
		this.canInteract = canInteract;
	}

	public render(container: HTMLElement): void {
		if (this.element) {
			this.element.detach();
		}

		this.element = container.createEl("span", {
			cls: "task-status-indicator",
			attr: {
				role: "button",
				tabindex: "0",
			},
		});

		this.statusTextEl = this.element.createSpan({
			cls: "task-status-indicator__text",
		});

		this.registerDomEvent(this.element, "click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.handleCycleRequest();
		});

		this.registerDomEvent(this.element, "contextmenu", (event) => {
			event.preventDefault();
			event.stopPropagation();
			this.handleContextMenu(event);
		});

		this.registerDomEvent(this.element, "keydown", (event) => {
			if (!(event instanceof KeyboardEvent)) {
				return;
			}

			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				this.handleCycleRequest();
			}

			if (event.key === "ContextMenu") {
				event.preventDefault();
				this.handleContextMenu(event);
			}

			if (event.shiftKey && event.key === "F10") {
				event.preventDefault();
				this.handleContextMenu(event);
			}
		});

		this.refreshDisplay();
	}

	public updateTask(task: Task): void {
		this.task = task;
		this.refreshDisplay();
	}

	public cycle(): void {
		this.handleCycleRequest();
	}

	private handleCycleRequest(): void {
		if (this.isProcessing || !this.isInteractionAllowed()) {
			return;
		}

		const context = this.buildStatusContext();
		if (!context.hasCycle || !context.nextStatus) {
			return;
		}

		this.applyStatus(context.nextStatus).catch(() => {
			/* Errors are logged in applyStatus */
		});
	}

	private handleContextMenu(event: MouseEvent | KeyboardEvent): void {
		if (this.isProcessing) {
			return;
		}

		const context = this.buildStatusContext();
		if (context.config.cycle.length === 0) {
			return;
		}

		const menu = new Menu();
		const currentNormalized = context.statusName
			? this.normalizeStatus(context.statusName)
			: undefined;

		for (const status of context.config.cycle) {
			const normalized = this.normalizeStatus(status);
			menu.addItem((item) => {
				item.setTitle(status);
				if (currentNormalized && currentNormalized === normalized) {
					item.setChecked(true);
				}
				item.onClick(() => {
					this.applyStatus(status).catch(() => {
						/* Errors are logged in applyStatus */
					});
				});
			});
		}

		if (event instanceof MouseEvent) {
			menu.showAtMouseEvent(event);
		} else if (this.element) {
			const rect = this.element.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom });
		}
	}

	private async applyStatus(targetStatus: string): Promise<void> {
		if (this.isProcessing || !this.isInteractionAllowed()) {
			return;
		}

		const config = this.getStatusConfig();
		const mark = this.getMarkForStatus(targetStatus, config);

		if (mark === undefined) {
			console.warn(
				"[TaskStatusIndicator] Mark not found for status:",
				targetStatus,
			);
			return;
		}

		const previousTask = this.task;
		const optimisticTask = this.buildUpdatedTask(mark);

		this.task = optimisticTask;
		this.isProcessing = true;
		this.refreshDisplay();

		try {
			if (this.onStatusChange) {
				await this.onStatusChange(previousTask, optimisticTask);
			}
		} catch (error) {
			console.error(
				"[TaskStatusIndicator] Failed to change task status",
				error,
			);
			this.task = previousTask;
			this.refreshDisplay();
			throw error;
		} finally {
			this.isProcessing = false;
			this.refreshDisplay();
		}
	}

	private refreshDisplay(): void {
		if (!this.element || !this.statusTextEl) {
			return;
		}

		const context = this.buildStatusContext();
		const nextDescription = context.nextStatus
			? `, next: ${context.nextStatus}`
			: "";

		this.element.querySelector(".task-status-indicator__icon")?.remove();
		const paused = ["pause", "paused", "archived"].includes(this.normalizeStatus(context.displayName)) || (this.plugin.settings.taskStatuses?.archived || "").split("|").includes(context.currentMark);
		if (paused) { const icon = this.element.createSpan({ cls: "task-status-indicator__icon" }); setIcon(icon, "pause"); this.element.insertBefore(icon, this.statusTextEl); }
		this.statusTextEl.setText(context.displayName);
		this.element.setAttribute("data-status", context.statusSlug);
		this.element.setAttribute("data-status-mark", context.currentMark);
		this.element.setAttribute(
			"aria-label",
			`Status: ${context.displayName}${nextDescription}`,
		);
		const disabled =
			!context.hasCycle || !this.isInteractionAllowed() || this.isProcessing;
		this.element.setAttribute(
			"aria-disabled",
			String(disabled),
		);
		this.element.setAttribute(
			"aria-busy",
			this.isProcessing ? "true" : "false",
		);
		this.element.setAttribute(
			"data-processing",
			this.isProcessing ? "true" : "false",
		);
		this.element.setAttribute(
			"data-completed",
			context.isCompleted ? "true" : "false",
		);
		this.element.toggleClass("is-processing", this.isProcessing);
		this.element.toggleClass("is-disabled", disabled);
		this.element.toggleClass("is-completed", context.isCompleted);
	}

	private buildStatusContext(): StatusContext {
		const config = this.getStatusConfig();
		const currentMark = this.getCurrentMark(config);
		const statusName = this.findStatusNameForMark(currentMark, config);
		const displayName =
			statusName ??
			this.deriveStatusLabelFromMark(currentMark) ??
			(currentMark.trim().length > 0 ? currentMark : "Not Started");

		const activeCycle = this.getActiveCycle(config);
		const nextStatus = this.getNextStatus(
			statusName,
			activeCycle,
			config,
		);

		return {
			config,
			currentMark,
			statusName,
			displayName,
			nextStatus,
			statusSlug: this.slugifyStatus(displayName),
			isCompleted: this.isCompletedMark(currentMark),
			hasCycle: activeCycle.length > 0,
		};
	}

	private getStatusConfig(): TaskStatusConfig {
		const settings = this.plugin.settings;
		const hasCustomCycle =
			Array.isArray(settings.taskStatusCycle) &&
			settings.taskStatusCycle.length > 0;

		const marks =
			settings.taskStatusMarks &&
			Object.keys(settings.taskStatusMarks).length > 0
				? settings.taskStatusMarks
				: FALLBACK_STATUS_MARKS;

		return {
			cycle: hasCustomCycle
				? [...settings.taskStatusCycle]
				: Object.keys(marks),
			marks: { ...marks },
			excludeMarksFromCycle: Array.isArray(settings.excludeMarksFromCycle)
				? [...settings.excludeMarksFromCycle]
				: [],
		};
	}

	private getCurrentMark(config: TaskStatusConfig): string {
		const statusValue = this.task.status ?? "";
		const normalizedStatus = this.normalizeStatus(statusValue);

		for (const [, mark] of Object.entries(config.marks)) {
			if (!mark) continue;
			if (mark === statusValue) {
				return mark;
			}
			if (mark.toLowerCase() === statusValue.toLowerCase()) {
				return mark;
			}
		}

		for (const [status, mark] of Object.entries(config.marks)) {
			if (this.normalizeStatus(status) === normalizedStatus) {
				return mark;
			}
		}

		if (statusValue.length === 1) {
			return statusValue;
		}

		return statusValue;
	}

	private getMarkForStatus(
		status: string,
		config: TaskStatusConfig,
	): string | undefined {
		const normalized = this.normalizeStatus(status);
		for (const [name, mark] of Object.entries(config.marks)) {
			if (this.normalizeStatus(name) === normalized) {
				return mark;
			}
		}

		return undefined;
	}

	private findStatusNameForMark(
		mark: string,
		config: TaskStatusConfig,
	): string | undefined {
		const normalizedMark = mark.toLowerCase();
		for (const [status, value] of Object.entries(config.marks)) {
			if (
				value === mark ||
				value.toLowerCase() === normalizedMark ||
				this.normalizeStatus(status) === this.normalizeStatus(mark)
			) {
				return status;
			}
		}
		return undefined;
	}

	private deriveStatusLabelFromMark(mark: string): string | undefined {
		if (!mark) {
			return undefined;
		}

		const statusConfig = this.plugin.settings.taskStatuses;
		if (!statusConfig) {
			return undefined;
		}

		const normalizedMark = mark.toLowerCase();
		for (const [statusKey, rawMarks] of Object.entries(statusConfig)) {
			const variants = rawMarks
				.split("|")
				.map((value) => value.trim())
				.filter(Boolean);

			if (
				variants.some(
					(value) =>
						value === mark || value.toLowerCase() === normalizedMark,
				)
			) {
				return this.formatStatusKey(statusKey);
			}
		}

		return undefined;
	}

	private getActiveCycle(config: TaskStatusConfig): string[] {
		const excludes = config.excludeMarksFromCycle.map((status) =>
			this.normalizeStatus(status),
		);
		return config.cycle.filter(
			(status) => !excludes.includes(this.normalizeStatus(status)),
		);
	}

	private getNextStatus(
		currentStatus: string | undefined,
		activeCycle: string[],
		config: TaskStatusConfig,
	): string | undefined {
		if (activeCycle.length === 0) {
			return undefined;
		}

		const normalizedCurrent = currentStatus
			? this.normalizeStatus(currentStatus)
			: undefined;

		let currentIndex = -1;
		if (normalizedCurrent) {
			currentIndex = activeCycle.findIndex(
				(status) => this.normalizeStatus(status) === normalizedCurrent,
			);
		} else {
			const mark = this.task.status;
			if (mark) {
				for (let i = 0; i < activeCycle.length; i++) {
					const status = activeCycle[i];
					const mapped = this.getMarkForStatus(status, config);
					if (
						mapped === mark ||
						(mapped && mapped.toLowerCase() === mark.toLowerCase())
					) {
						currentIndex = i;
						break;
					}
				}
			}
		}

		const nextIndex = (currentIndex + 1) % activeCycle.length;
		return activeCycle[nextIndex];
	}

	private normalizeStatus(value: string): string {
		return value.trim().toLowerCase();
	}

	private slugifyStatus(value: string): string {
		return value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "unknown";
	}

	private formatStatusKey(key: string): string {
		if (["archived", "paused", "pause"].includes(key.toLowerCase())) return "Paused";
		return key
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.replace(/[-_]+/g, " ")
			.split(" ")
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	}

	private isCompletedMark(mark: string): boolean {
		if (!mark) {
			return false;
		}

		try {
			const lower = mark.toLowerCase();
			const completedCfg = String(
				this.plugin.settings.taskStatuses?.completed || "x",
			);
			const completedMarks = completedCfg
				.split("|")
				.map((value) => value.trim().toLowerCase())
				.filter(Boolean);

			if (completedMarks.includes(lower)) {
				return true;
			}

			const statusConfig = this.plugin.settings
				.taskStatuses as Record<string, string>;
			if (statusConfig) {
				for (const [statusKey, variants] of Object.entries(
					statusConfig,
				)) {
					const entries = variants
						.split("|")
						.map((value) => value.trim().toLowerCase())
						.filter(Boolean);
					if (entries.includes(lower)) {
						return statusKey.toLowerCase() === "completed";
					}
				}
			}
		} catch (error) {
			console.error(
				"[TaskStatusIndicator] Failed to evaluate completed mark",
				error,
			);
		}

		return false;
	}

	private buildUpdatedTask(mark: string): Task {
		const metadata = { ...this.task.metadata };
		const isCompleted = this.isCompletedMark(mark);

		if (isCompleted) {
			if (!metadata.completedDate) {
				metadata.completedDate = Date.now();
			}
		} else if (metadata.completedDate) {
			delete metadata.completedDate;
		}

		const updatedMarkdown =
			typeof this.task.originalMarkdown === "string"
				? this.task.originalMarkdown.replace(/\[(.)]/, `[${mark}]`)
				: this.task.originalMarkdown;

		return {
			...this.task,
			status: mark,
			completed: isCompleted,
			originalMarkdown: updatedMarkdown,
			metadata,
		};
	}

	private isInteractionAllowed(): boolean {
		if (this.canInteract && !this.canInteract()) {
			return false;
		}
		return true;
	}
}
