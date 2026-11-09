import { ExtraButtonComponent, Menu, setIcon } from "obsidian";
import { Component } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";
import {
	createTaskCheckbox,
	getStatusText,
} from "@/components/features/task/view/details";
import { t } from "@/translations/helper";
import { getAllStatusMarks } from "@/utils/status-cycle-resolver";

export class StatusComponent extends Component {
	constructor(
		private plugin: TaskProgressBarPlugin,
		private containerEl: HTMLElement,
		private task: Task,
		private params: {
			type?: "task-view" | "quick-capture";
			onTaskUpdate?: (task: Task, updatedTask: Task) => Promise<void>;
			onTaskStatusSelected?: (status: string) => void;
		},
	) {
		super();
	}

	onload(): void {
		this.containerEl.createDiv({ cls: "details-status-selector" }, (el) => {
			let containerEl = el;
			if (this.params.type === "quick-capture") {
				el.createEl("div", {
					cls: "quick-capture-status-selector-label",
					text: t("Status"),
				});

				containerEl = el.createDiv({
					cls: "quick-capture-status-selector",
				});
			}

			const allStatuses = Object.keys(
				this.plugin.settings.taskStatuses,
			).map((status) => {
				return {
					status: status,
					text: this.plugin.settings.taskStatuses[
						status as keyof typeof this.plugin.settings.taskStatuses
					].split("|")[0],
				}; // Get the first status from each group
			});

			// Create five side-by-side status elements
			allStatuses.forEach((status) => {
				const statusEl = containerEl.createEl("div", {
					cls:
						"status-option" +
						(status.text === this.task.status ? " current" : ""),
					attr: {
						"aria-label": getStatusText(
							status.status,
							this.plugin.settings,
						),
					},
				});

				// Create checkbox-like element or icon for the status
				let interactiveElement: HTMLElement = statusEl;
				if (this.plugin.settings.enableTaskGeniusIcons) {
					setIcon(interactiveElement, ["archived", "paused", "pause"].includes(status.status) ? "pause" : status.status);
				} else {
					// Create checkbox-like element for the status
					interactiveElement = createTaskCheckbox(
						status.text,
						{ ...this.task, status: status.text } as any,
						statusEl,
					);
				}

				this.registerDomEvent(interactiveElement, "click", (evt) => {
					evt.stopPropagation();
					evt.preventDefault();

					const completed = (this.plugin.settings.taskStatuses?.completed || "x").split("|").includes(status.text);
					const options = { ...this.task, status: status.text, completed, metadata: { ...(this.task.metadata || {}) } };
					options.metadata.completedDate = completed ? options.metadata.completedDate || Date.now() : undefined;
					options.metadata.cancelledDate = (this.plugin.settings.taskStatuses?.abandoned || "-").split("|").includes(status.text) ? options.metadata.cancelledDate || Date.now() : undefined;
					this.params.onTaskUpdate?.(this.task, options);
					this.params.onTaskStatusSelected?.(status.text);

					// Update the current task status to reflect the change
					this.task = options;

					// Update the visual state
					this.containerEl
						.querySelectorAll(".status-option")
						.forEach((el) => {
							el.removeClass("current");
						});
					statusEl.addClass("current");
				});
			});

			const moreStatus = el.createEl("div", {
				cls: "more-status",
			});
			const moreStatusBtn = new ExtraButtonComponent(moreStatus)
				.setIcon("ellipsis")
				.onClick(() => {
					const menu = new Menu();

					// Get unique statuses from configuration (mark -> status)
					const uniqueStatuses = getAllStatusMarks(
						this.plugin.settings,
					);

					// Create menu items from unique statuses (getAllStatusMarks returns mark -> status)
					for (const [mark, status] of uniqueStatuses) {
						menu.addItem((item) => {
							// Map marks to their corresponding icon names
							const markToIcon: Record<string, string> = {
								" ": "notStarted", // Empty/space for not started
								"/": "inProgress", // Forward slash for in progress
								x: "completed", // x for completed
								"-": "abandoned", // Dash for abandoned
								"?": "planned", // Question mark for planned
								">": "inProgress",
								X: "completed",
							};

							const iconName = markToIcon[mark];

							if (
								this.plugin.settings.enableTaskGeniusIcons &&
								iconName
							) {
								// Use icon in menu
								item.titleEl.createEl(
									"span",
									{
										cls: "status-option-icon",
									},
									(el) => {
										setIcon(el, iconName);
									},
								);
							} else {
								// Use checkbox in menu
								item.titleEl.createEl(
									"span",
									{
										cls: "status-option-checkbox",
									},
									(el) => {
										createTaskCheckbox(mark, this.task, el);
									},
								);
							}
							item.titleEl.createEl("span", {
								cls: "status-option",
								text: status,
							});
							item.onClick(() => {
								this.params.onTaskUpdate?.(this.task, {
									...this.task,
									status: mark,
								});
								this.params.onTaskStatusSelected?.(mark);
							});
						});
					}
					const rect =
						moreStatusBtn.extraSettingsEl?.getBoundingClientRect();
					if (rect) {
						menu.showAtPosition({
							x: rect.left,
							y: rect.bottom + 10,
						});
					}
				});
		});
	}

	private getTaskStatus() {
		return this.task.status || "";
	}
}
