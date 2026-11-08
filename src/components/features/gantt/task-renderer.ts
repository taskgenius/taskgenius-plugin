import {
	App,
	Component,
	MarkdownRenderer as ObsidianMarkdownRenderer,
	TFile,
} from "obsidian";
import { GanttTaskItem, PlacedGanttTaskItem, Timescale } from './gantt'; // 添加PlacedGanttTaskItem导入
import { Task } from "@/types/task";
import { MarkdownRendererComponent } from "@/components/ui/renderers/MarkdownRenderer";
import { sanitizePriorityForClass } from "@/utils/task/priority-utils";
import type { ProjectDateEdge } from "@/managers/project-dates";

// Constants from GanttComponent (consider moving to a shared config/constants file)
const ROW_HEIGHT = 24;
const TASK_BAR_HEIGHT_RATIO = 0.6;
const MILESTONE_SIZE = 10;
const TASK_LABEL_PADDING = 5;

// Interface for parameters needed by the task renderer
interface TaskRendererParams {
	dayWidth?: number;
	onDateChange?: (task: Task, days: number, edge: ProjectDateEdge) => void;
	app: App;
	taskGroupEl: SVGGElement; // The <g> element to draw tasks into
	preparedTasks: PlacedGanttTaskItem[]; // 使用PlacedGanttTaskItem替代GanttTaskItem
	rowHeight?: number; // Optional overrides
	taskBarHeightRatio?: number;
	milestoneSize?: number;
	showTaskLabels: boolean;
	useMarkdownRenderer: boolean;
	handleTaskClick: (task: Task) => void; // Callback for task clicks
	handleTaskContextMenu: (event: MouseEvent, task: Task) => void; // Callback for task context menu
	// Pass the parent component for MarkdownRenderer context if needed
	// We might need a different approach if static rendering is used
	parentComponent: Component;
}

export class TaskRendererComponent extends Component {
	private app: App;
	private taskGroupEl: SVGGElement;
	private params: TaskRendererParams | null = null;
	private eventListeners: Array<{ element: Element; type: string; handler: EventListener }> = [];
	private cancelDrag?: () => void;
	private ignoreClickUntil = 0;

	constructor(app: App, taskGroupEl: SVGGElement) {
		super();
		this.app = app;
		this.taskGroupEl = taskGroupEl;
	}

	onload() {
		console.log("TaskRendererComponent loaded.");
	}

	onunload() {
		console.log("TaskRendererComponent unloaded.");
		
		// Clean up all event listeners
		this.cleanupEventListeners();
		
		// Clear the task group SVG elements
		this.taskGroupEl.empty();
		
		// Note: Child components added via addChild() are automatically
		// unloaded by Obsidian's Component system
	}

	private cleanupEventListeners() {
		this.cancelDrag?.();
		for (const { element, type, handler } of this.eventListeners) {
			element.removeEventListener(type, handler);
		}
		this.eventListeners = [];
	}

	private addEventListener(element: Element, type: string, handler: EventListener) {
		element.addEventListener(type, handler);
		this.eventListeners.push({ element, type, handler });
	}

	updateParams(newParams: TaskRendererParams) {
		this.params = newParams;
		this.render();
	}

	private render() {
		if (!this.params) {
			console.warn(
				"TaskRendererComponent: Cannot render, params not set."
			);
			return;
		}

		console.log(
			"TaskRenderer received tasks:",
			JSON.stringify(
				this.params.preparedTasks.map((t) => ({
					id: t.task.id,
					sx: t.startX,
					w: t.width,
				})),
				null,
				2
			)
		);

		// Clean up previous render's resources before re-rendering
		this.cleanupEventListeners();
		this.taskGroupEl.empty(); // Clear previous tasks and their components

		const { preparedTasks, parentComponent } = this.params;

		// TODO: Implement virtualization - only render tasks currently in viewport
		preparedTasks.forEach((pt) =>
			this.renderSingleTask(pt, parentComponent)
		);
	}

	private renderSingleTask(
		preparedTask: PlacedGanttTaskItem,
		_parentComponent: Component
	) {
		if (!this.params) return;

		const {
			handleTaskClick,
			handleTaskContextMenu,
			showTaskLabels,
			useMarkdownRenderer,
			rowHeight = ROW_HEIGHT,
			taskBarHeightRatio = TASK_BAR_HEIGHT_RATIO,
			milestoneSize = MILESTONE_SIZE,
		} = this.params;

		const task = preparedTask.task;
		const group = this.taskGroupEl.createSvg("g", {
			cls: "gantt-task-item",
		});
		group.setAttribute("data-task-id", task.id);
		// Add listener for clicking task (using our tracked addEventListener)
		const clickHandler = () => { if (Date.now() > this.ignoreClickUntil) handleTaskClick(task); };
		const contextMenuHandler = (event: Event) => handleTaskContextMenu(event as MouseEvent, task);
		this.addEventListener(group, "click", clickHandler);
		this.addEventListener(group, "contextmenu", contextMenuHandler);

		const barHeight = rowHeight * taskBarHeightRatio;
		const barY = preparedTask.y - barHeight / 2;

		let taskElement: SVGElement | null = null;

		if (preparedTask.isMilestone) {
			// Render milestone (circle and text)
			const x = preparedTask.startX;
			const y = preparedTask.y;
			const radius = milestoneSize / 2;

			// Draw circle
			taskElement = group.createSvg("circle", {
				attr: {
					cx: x,
					cy: y,
					r: radius,
					class: "gantt-task-milestone", // Base class
				},
			});
			// Add status and priority classes safely
			if (task.status && task.status.trim()) {
				taskElement.classList.add(`status-${task.status.trim()}`);
			}
			if (task.metadata.priority) {
				const sanitizedPriority = sanitizePriorityForClass(task.metadata.priority);
				if (sanitizedPriority) {
					taskElement.classList.add(`priority-${sanitizedPriority}`);
				}
			}

			// Add text label to the right
			if (showTaskLabels && task.content) {
				// Check if we should use markdown renderer
				if (useMarkdownRenderer) {
					// Create a foreign object to hold the markdown content
					const foreignObject = group.createSvg("foreignObject", {
						attr: {
							x: x + radius + TASK_LABEL_PADDING,
							y: y - 8, // Adjust y position to center the content
							width: 300, // Set a reasonable width
							height: 16, // Set a reasonable height
							class: "gantt-milestone-label-container",
						},
					});

					// Create a div inside the foreignObject for markdown rendering
					const labelContainer = document.createElementNS(
						"http://www.w3.org/1999/xhtml",
						"div"
					);
					labelContainer.style.pointerEvents = "none"; // Prevent capturing events
					foreignObject.appendChild(labelContainer);

					// Use markdown renderer to render the task content
					const markdownRenderer = new MarkdownRendererComponent(
						this.app,
						labelContainer,
						task.filePath
					);
					this.addChild(markdownRenderer);
					markdownRenderer.render(task.content);
				} else {
					// Use regular SVG text if markdown rendering is disabled
					const textLabel = group.createSvg("text", {
						attr: {
							x: x + radius + TASK_LABEL_PADDING,
							y: y,
							class: "gantt-milestone-label",
							// Vertically align middle of text with circle center
							"dominant-baseline": "middle",
						},
					});
					textLabel.textContent = task.content;
					// Prevent text from capturing pointer events meant for the group/circle
					textLabel.style.pointerEvents = "none";
				}
			}

			// Add tooltip for milestone
			group.setAttribute(
				"title",
				`${task.content}\nDue: ${
					task.metadata.dueDate
						? new Date(task.metadata.dueDate).toLocaleDateString()
						: "N/A"
				}`
			);
		} else if (preparedTask.width !== undefined && preparedTask.width > 0) {
			// Render task bar
			taskElement = group.createSvg("rect", {
				attr: {
					x: preparedTask.startX,
					y: barY,
					width: preparedTask.width,
					height: barHeight,
					rx: 3, // Rounded corners
					ry: 3,
					class: "gantt-task-bar", // Base class
				},
			});
			// Add status and priority classes safely
			if (task.status && task.status.trim()) {
				taskElement.classList.add(`status-${task.status.trim()}`);
			}
			if (task.metadata.priority) {
				const sanitizedPriority = sanitizePriorityForClass(task.metadata.priority);
				if (sanitizedPriority) {
					taskElement.classList.add(`priority-${sanitizedPriority}`);
				}
			}

			// Add tooltip for bar
			group.setAttribute(
				"title",
				`${task.content}\nStart: ${
					task.metadata.startDate
						? new Date(task.metadata.startDate).toLocaleDateString()
						: "N/A"
				}\nDue: ${
					task.metadata.dueDate
						? new Date(task.metadata.dueDate).toLocaleDateString()
						: "N/A"
				}`
			);

			// --- Render Task Label ---
			if (showTaskLabels && task.content) {
				const MIN_BAR_WIDTH_FOR_INTERNAL_LABEL = 30; // px, padding*2 + ~20px text

				if (preparedTask.width >= MIN_BAR_WIDTH_FOR_INTERNAL_LABEL) {
					// --- Render Label Internally (using foreignObject for Markdown) ---
					const foreignObject = group.createSvg("foreignObject", {
						attr: {
							x: preparedTask.startX + TASK_LABEL_PADDING,
							// Position Y carefully relative to the bar center
							y: preparedTask.y - barHeight / 2 - 2, // Adjust fine-tuning needed
							width: preparedTask.width - TASK_LABEL_PADDING * 2, // Width is sufficient
							height: barHeight + 4, // Allow slightly more height
							class: "gantt-task-label-fo",
						},
					});

					// Prevent foreignObject from capturing pointer events meant for the bar/group
					foreignObject.style.pointerEvents = "none";

					// Create the div container *inside* the foreignObject
					const labelDiv = foreignObject.createDiv({
						cls: "gantt-task-label-markdown",
					});

					if (useMarkdownRenderer) {
						const sourcePath = task.filePath || "";
						labelDiv.empty();

						console.log("sourcePath", sourcePath);

						const markdownRenderer = new MarkdownRendererComponent(
							this.app,
							labelDiv as HTMLElement,
							sourcePath,
							true
						);
						this.addChild(markdownRenderer);
						markdownRenderer.update(task.content);
					} else {
						// Fallback to simple text
						labelDiv.textContent = task.content;
						labelDiv.style.lineHeight = `${barHeight}px`;
						labelDiv.style.whiteSpace = "nowrap";
						labelDiv.style.overflow = "hidden";
						labelDiv.style.textOverflow = "ellipsis";
					}
				} else {
					// --- Render Label Externally (using simple SVG text) ---
					const textLabel = group.createSvg("text", {
						attr: {
							// Position text to the right of the narrow bar
							x:
								preparedTask.startX +
								preparedTask.width +
								TASK_LABEL_PADDING,
							y: preparedTask.y, // Vertically centered with the bar's logical center
							class: "gantt-task-label-external",
							// Vertically align middle of text with bar center
							"dominant-baseline": "middle",
							"text-anchor": "start",
						},
					});
					textLabel.textContent = task.content;
					// Prevent text from capturing pointer events meant for the group/bar
					textLabel.style.pointerEvents = "none";
				}
			}
		}

		// Apply status class to the group for potential styling overrides
		if (task.metadata.projectPlan && this.params.onDateChange) {
			for (const edge of ["start", "end"] as const) group.createSvg("rect", { attr: {
				x: preparedTask.startX + (edge === "end" ? (preparedTask.width || 0) - 5 : -1),
				y: barY - 3, width: 6, height: barHeight + 6, class: "gantt-resize-handle", "data-edge": edge,
			} });
			this.addEventListener(group, "pointerdown", ((event: PointerEvent) => {
				if (event.button !== 0) return;
				event.preventDefault(); event.stopPropagation();
				const edge = ((event.target as Element).getAttribute("data-edge") || "move") as ProjectDateEdge;
				const start = event.clientX, dayWidth = this.params?.dayWidth || 50;
				const doc = group.ownerDocument;
				let days = 0;
				const move = (next: PointerEvent) => {
					days = Math.round((next.clientX - start) / dayWidth);
					if (edge === "move") group.setAttribute("transform", `translate(${days * dayWidth},0)`);
					else {
						const rect = group.querySelector(".gantt-task-bar");
						const width = preparedTask.width || dayWidth;
						const delta = edge === "start" ? Math.min(days * dayWidth, width - dayWidth) : Math.max(days * dayWidth, dayWidth - width);
						rect?.setAttribute("x", String(preparedTask.startX + (edge === "start" ? delta : 0)));
						rect?.setAttribute("width", String(width + (edge === "start" ? -delta : delta)));
					}
				};
				const cleanup = () => { doc.removeEventListener("pointermove", move); doc.removeEventListener("pointerup", up); doc.removeEventListener("pointercancel", cancel); this.cancelDrag = undefined; };
				const cancel = () => { cleanup(); group.removeAttribute("transform"); this.render(); };
				const up = () => { cleanup(); group.removeAttribute("transform"); if (days) { this.ignoreClickUntil = Date.now() + 400; this.params?.onDateChange?.(task, days, edge); } };
				this.cancelDrag = cleanup;
				doc.addEventListener("pointermove", move); doc.addEventListener("pointerup", up); doc.addEventListener("pointercancel", cancel);
			}) as EventListener);
		}
		if (taskElement) {
			// group.classList.add(`status-${task.status}`); // Removed this redundant/potentially problematic class add
			// Status is already applied to the taskElement (bar or milestone) directly
		}
	}
}
