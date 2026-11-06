import { Component, setIcon } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";
import {
	CompletedTimerRecord,
	TaskTimerManager,
	TimerState,
} from "@/managers/timer-manager";
import { t } from "@/translations/helper";
import "@/styles/timer-statistics.scss";

interface TimerStatisticsOptions {
	onTaskClick?: (task: Task | null) => void;
	onTaskContextMenu?: (event: MouseEvent, task: Task | null) => void;
}

export class TimerStatisticsPanel extends Component {
	public containerEl: HTMLElement;
	private plugin: TaskProgressBarPlugin;
	private tasks: Task[];
	private timerManager: TaskTimerManager;
	private hasActiveTimerInterval = false;
	private activeTimerSignature = "";
	private lastCleanup = 0;
	private onTaskClick?: (task: Task | null) => void;
	private onTaskContextMenu?: (event: MouseEvent, task: Task | null) => void;

	constructor(
		private parentEl: HTMLElement,
		plugin: TaskProgressBarPlugin,
		tasks: Task[] = [],
		options: TimerStatisticsOptions = {}
	) {
		super();
		this.plugin = plugin;
		this.tasks = tasks;
		this.onTaskClick = options.onTaskClick;
		this.onTaskContextMenu = options.onTaskContextMenu;
		// Reuse the plugin's shared timer manager to keep settings and state consistent
		if (!this.plugin.taskTimerManager) {
			this.plugin.taskTimerManager = new TaskTimerManager(
				this.plugin.settings.taskTimer
			);
		} else {
			this.plugin.taskTimerManager.updateSettings(
				this.plugin.settings.taskTimer
			);
		}
		this.timerManager = this.plugin.taskTimerManager;
	}

	onload() {
		this.containerEl = this.parentEl.createDiv({
			cls: "timer-statistics-panel",
		});

		// Clean up old/orphaned timers before initial render
		this.timerManager.cleanup();
		this.lastCleanup = Date.now();

		this.render();
		this.startUpdateInterval();
	}

	/**
	 * Update the tasks list
	 */
	public setTasks(tasks: Task[]) {
		this.tasks = tasks;
		this.render();
	}

	/**
	 * Start periodic updates using registerInterval
	 */
	private startUpdateInterval() {
		if (this.hasActiveTimerInterval) {
			return;
		}

		this.hasActiveTimerInterval = true;

		// Update every second - registerInterval auto-cleans on component unload
		this.registerInterval(
			window.setInterval(() => {
				this.updateTimerDisplays();
			}, 1000)
		);
	}

	/**
	 * Update timer displays without full re-render
	 */
	private updateTimerDisplays() {
		if (!this.containerEl) return;

		// Update summary values
		const allTimers = this.timerManager.getAllActiveTimers();
		const signature = this.computeTimerSignature(allTimers);

		// If timer list or statuses changed, re-render to add/remove items
		if (signature !== this.activeTimerSignature) {
			this.activeTimerSignature = signature;
			this.render();
			return;
		}

		let totalDuration = 0;
		let runningCount = 0;
		let pausedCount = 0;

		allTimers.forEach((timer) => {
			totalDuration += this.timerManager.getCurrentDuration(timer.taskId);
			if (timer.status === "running") {
				runningCount++;
			} else if (timer.status === "paused") {
				pausedCount++;
			}
		});

		// Update summary card values
		const totalTimeEl = this.containerEl.querySelector(
			".timer-stats-card-total .timer-stats-card-value"
		);
		if (totalTimeEl) {
			totalTimeEl.textContent =
				this.timerManager.formatDuration(totalDuration);
		}

		const runningCountEl = this.containerEl.querySelector(
			".timer-stats-card-running .timer-stats-card-value"
		);
		if (runningCountEl) {
			runningCountEl.textContent = String(runningCount);
		}

		const pausedCountEl = this.containerEl.querySelector(
			".timer-stats-card-paused .timer-stats-card-value"
		);
		if (pausedCountEl) {
			pausedCountEl.textContent = String(pausedCount);
		}

		const totalTimersEl = this.containerEl.querySelector(
			".timer-stats-card-count .timer-stats-card-value"
		);
		if (totalTimersEl) {
			totalTimersEl.textContent = String(allTimers.length);
		}

		// Update individual timer durations
		this.containerEl
			.querySelectorAll(".timer-item[data-task-id]")
			.forEach((el) => {
				const taskId = el.getAttribute("data-task-id");
				if (taskId) {
					const duration =
						this.timerManager.getCurrentDuration(taskId);
					const durationEl = el.querySelector(".timer-item-duration");
					if (durationEl) {
						durationEl.textContent =
							this.timerManager.formatDuration(duration);
					}
				}
			});

		// Periodic cleanup while panel is open
		const now = Date.now();
		if (now - this.lastCleanup > 15 * 60 * 1000) {
			this.timerManager.cleanup();
			this.lastCleanup = now;
		}
	}

	private render() {
		this.containerEl.empty();

		// Get all active timers
		const allTimers = this.timerManager.getAllActiveTimers();
		this.activeTimerSignature = this.computeTimerSignature(allTimers);
		const completedTimers = this.timerManager.getRecentCompletedTimers(50);

		// Header
		const headerEl = this.containerEl.createDiv({
			cls: "timer-stats-header",
		});
		headerEl.createEl("h2", {
			cls: "timer-stats-title",
			text: t("Timer Statistics"),
		});

		// Summary section
		const summaryEl = this.containerEl.createDiv({
			cls: "timer-stats-summary",
		});
		this.renderSummary(summaryEl, allTimers);

		// Active timers section
		const activeSection = this.containerEl.createDiv({
			cls: "timer-stats-section",
		});

		activeSection.createEl("h3", { text: t("Active Timers") });

		if (allTimers.length === 0) {
			activeSection.createDiv({
				cls: "timer-stats-empty",
				text: t("No active timers"),
			});
		} else {
			const timerListEl = activeSection.createDiv({
				cls: "timer-stats-list",
			});

			// Group timers by status
			const runningTimers = allTimers.filter(
				(timer) => timer.status === "running"
			);
			const pausedTimers = allTimers.filter(
				(timer) => timer.status === "paused"
			);

			if (runningTimers.length > 0) {
				this.renderTimerGroup(
					timerListEl,
					t("Running"),
					runningTimers,
					"running"
				);
			}

			if (pausedTimers.length > 0) {
				this.renderTimerGroup(
					timerListEl,
					t("Paused"),
					pausedTimers,
					"paused"
				);
			}
		}

		// Completed timers section
		const completedSection = this.containerEl.createDiv({
			cls: "timer-stats-section",
		});
		completedSection.createEl("h3", { text: t("Completed Timers") });

		if (completedTimers.length === 0) {
			completedSection.createDiv({
				cls: "timer-stats-empty",
				text: t("No completed timers"),
			});
		} else {
			this.renderCompletedTimers(completedSection, completedTimers);
		}
	}

	private renderSummary(containerEl: HTMLElement, timers: TimerState[]) {
		// Calculate totals
		let totalDuration = 0;
		let runningCount = 0;
		let pausedCount = 0;

		timers.forEach((timer) => {
			totalDuration += this.timerManager.getCurrentDuration(timer.taskId);
			if (timer.status === "running") {
				runningCount++;
			} else if (timer.status === "paused") {
				pausedCount++;
			}
		});

		// Summary cards
		const cardsEl = containerEl.createDiv({ cls: "timer-stats-cards" });

		// Total time card
		const totalCard = cardsEl.createDiv({
			cls: "timer-stats-card timer-stats-card-total",
		});
		const totalIcon = totalCard.createDiv({ cls: "timer-stats-card-icon" });
		setIcon(totalIcon, "clock");
		totalCard.createDiv({
			cls: "timer-stats-card-value",
			text: this.timerManager.formatDuration(totalDuration),
		});
		totalCard.createDiv({
			cls: "timer-stats-card-label",
			text: t("Total Time"),
		});

		// Running count card
		const runningCard = cardsEl.createDiv({
			cls: "timer-stats-card running timer-stats-card-running",
		});
		const runningIcon = runningCard.createDiv({
			cls: "timer-stats-card-icon",
		});
		setIcon(runningIcon, "play");
		runningCard.createDiv({
			cls: "timer-stats-card-value",
			text: String(runningCount),
		});
		runningCard.createDiv({
			cls: "timer-stats-card-label",
			text: t("Running"),
		});

		// Paused count card
		const pausedCard = cardsEl.createDiv({
			cls: "timer-stats-card paused timer-stats-card-paused",
		});
		const pausedIcon = pausedCard.createDiv({
			cls: "timer-stats-card-icon",
		});
		setIcon(pausedIcon, "pause");
		pausedCard.createDiv({
			cls: "timer-stats-card-value",
			text: String(pausedCount),
		});
		pausedCard.createDiv({
			cls: "timer-stats-card-label",
			text: t("Paused"),
		});

		// Total timers card
		const totalTimersCard = cardsEl.createDiv({
			cls: "timer-stats-card timer-stats-card-count",
		});
		const totalTimersIcon = totalTimersCard.createDiv({
			cls: "timer-stats-card-icon",
		});
		setIcon(totalTimersIcon, "list");
		totalTimersCard.createDiv({
			cls: "timer-stats-card-value",
			text: String(timers.length),
		});
		totalTimersCard.createDiv({
			cls: "timer-stats-card-label",
			text: t("Total Timers"),
		});
	}

	private renderTimerGroup(
		containerEl: HTMLElement,
		title: string,
		timers: TimerState[],
		status: string
	) {
		const groupEl = containerEl.createDiv({
			cls: `timer-group timer-group-${status}`,
		});

		groupEl.createDiv({ cls: "timer-group-title", text: title });

		const listEl = groupEl.createDiv({ cls: "timer-group-list" });

		timers.forEach((timer) => {
			const timerEl = listEl.createDiv({
				cls: "timer-item",
				attr: { "data-task-id": timer.taskId },
			});

			// Find associated task
			const task = this.tasks.find((t) => {
				const blockId = t.metadata?.id;
				return (
					blockId &&
					t.filePath === timer.filePath &&
					blockId === timer.blockId
				);
			});

			// Click and context menu handlers to open details or menu
			if (this.onTaskClick) {
				this.registerDomEvent(timerEl, "click", () => {
					this.onTaskClick?.(task ?? null);
				});
			}
			if (this.onTaskContextMenu) {
				this.registerDomEvent(timerEl, "contextmenu", (event) => {
					console.log("contextmenu", event);
					event.preventDefault();
					event.stopPropagation();
					this.onTaskContextMenu?.(event, task ?? null);
				});
			}

			// Timer info
			const infoEl = timerEl.createDiv({ cls: "timer-item-info" });

			// Task name or file path
			const nameEl = infoEl.createDiv({ cls: "timer-item-name" });
			if (task) {
				nameEl.setText(
					task.content || task.originalMarkdown || t("Untitled")
				);
			} else {
				// Show file path if task not found
				const fileName =
					timer.filePath.split("/").pop() || timer.filePath;
				nameEl.setText(fileName);
			}

			// File path
			infoEl.createDiv({
				cls: "timer-item-path",
				text: timer.filePath,
			});

			// Duration
			const duration = this.timerManager.getCurrentDuration(timer.taskId);
			timerEl.createDiv({
				cls: "timer-item-duration",
				text: this.timerManager.formatDuration(duration),
			});

			// Status indicator
			const statusEl = timerEl.createDiv({
				cls: `timer-item-status timer-status-${timer.status}`,
			});
			setIcon(
				statusEl,
				timer.status === "running" ? "play-circle" : "pause-circle"
			);

			// Actions
			const actionsEl = timerEl.createDiv({ cls: "timer-item-actions" });

			if (timer.status === "running") {
				// Pause button
				const pauseBtn = actionsEl.createEl("button", {
					cls: "timer-action-btn",
					attr: { "aria-label": t("Pause") },
				});
				setIcon(pauseBtn, "pause");
				this.registerDomEvent(pauseBtn, "click", (evt) => {
					evt.stopPropagation();
					this.timerManager.pauseTimer(timer.taskId);
					this.render();
				});
			} else {
				// Resume button
				const resumeBtn = actionsEl.createEl("button", {
					cls: "timer-action-btn",
					attr: { "aria-label": t("Resume") },
				});
				setIcon(resumeBtn, "play");
				this.registerDomEvent(resumeBtn, "click", (evt) => {
					evt.stopPropagation();
					this.timerManager.resumeTimer(timer.taskId);
					this.render();
				});
			}

			// Stop button
			const stopBtn = actionsEl.createEl("button", {
				cls: "timer-action-btn timer-action-stop",
				attr: { "aria-label": t("Stop") },
			});
			setIcon(stopBtn, "square");
			this.registerDomEvent(stopBtn, "click", (evt) => {
				evt.stopPropagation();
				this.timerManager.completeTimer(timer.taskId);
				this.render();
			});
		});
	}

	private renderCompletedTimers(
		containerEl: HTMLElement,
		completedTimers: CompletedTimerRecord[]
	) {
		const listEl = containerEl.createDiv({
			cls: "timer-completed-list",
		});

		completedTimers.forEach((record) => {
			const itemEl = listEl.createDiv({ cls: "timer-completed-item" });

			// Try to resolve the task to show nicer title
			const task = this.tasks.find((t) => {
				const blockId = t.metadata?.id;
				return (
					blockId &&
					t.filePath === record.filePath &&
					blockId === record.blockId
				);
			});

			const infoEl = itemEl.createDiv({ cls: "timer-completed-info" });
			const nameEl = infoEl.createDiv({ cls: "timer-completed-name" });

			if (task) {
				nameEl.setText(
					task.content || task.originalMarkdown || t("Untitled")
				);
			} else {
				const fileName =
					record.filePath.split("/").pop() || record.filePath;
				nameEl.setText(fileName);
			}

			infoEl.createDiv({
				cls: "timer-completed-path",
				text: record.filePath,
			});

			const metaEl = itemEl.createDiv({ cls: "timer-completed-meta" });

			metaEl.createDiv({
				cls: "timer-completed-duration",
				text: this.timerManager.formatDuration(record.duration),
			});

			metaEl.createDiv({
				cls: "timer-completed-time",
				text: `${t("Completed at")}: ${new Date(
					record.completedAt
				).toLocaleString()}`,
			});
		});
	}

	private computeTimerSignature(timers: TimerState[]): string {
		return timers
			.map(
				(timer) =>
					`${timer.taskId}:${timer.status}:${timer.segments.length}`
			)
			.sort()
			.join("|");
	}

	onunload() {
		// Interval is auto-cleaned by registerInterval
		this.containerEl?.remove();
	}
}
