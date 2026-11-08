import { App, Component } from "obsidian";
import { Task } from "@/types/task";
import TaskProgressBarPlugin from "@/index";
import type { TableSpecificConfig } from "@/common/setting-definition";
import {
	ViewMode,
	getViewSettingOrDefault,
} from "@/common/setting-definition";
import { KanbanComponent } from "@/components/features/kanban/kanban";
import { CalendarComponent, CalendarEvent } from "@/components/features/calendar";
import { GanttComponent } from "@/components/features/gantt/gantt";
import { TaskPropertyTwoColumnView } from "@/components/features/task/view/TaskPropertyTwoColumnView";
import { ForecastComponent } from "@/components/features/task/view/forecast";
import { TableViewAdapter } from "@/components/features/table/TableViewAdapter";
import { QuadrantComponent } from "@/components/features/quadrant/quadrant";

// 定义视图组件的通用接口
interface ViewComponentInterface {
	containerEl: HTMLElement;
	setTasks?: (tasks: Task[], allTasks?: Task[]) => void;
	updateTasks?: (tasks: Task[]) => void;
	setViewMode?: (viewId: ViewMode, project?: string | null) => void;
	onShown?: () => void;
	load?: () => void;
	unload?: () => void;
}

// 定义事件处理器接口
interface ViewEventHandlers {
	onTaskSelected?: (task: Task | null) => void;
	onTaskCompleted?: (task: Task) => void;
	onTaskContextMenu?: (event: MouseEvent, task: Task) => void;
	onTaskStatusUpdate?: (
		taskId: string,
		newStatusMark: string,
	) => Promise<void>;
	onEventContextMenu?: (ev: MouseEvent, event: CalendarEvent) => void;
	onTaskUpdate?: (originalTask: Task, updatedTask: Task) => Promise<void>;
}

// 视图组件工厂
class ViewComponentFactory {
	static createComponent(
		viewType: string,
		viewId: string,
		app: App,
		plugin: TaskProgressBarPlugin,
		parentEl: HTMLElement,
		handlers: ViewEventHandlers,
	): ViewComponentInterface | null {
		const viewConfig = getViewSettingOrDefault(plugin, viewId);

		switch (viewType) {
			case "kanban":
				return new KanbanComponent(
					app,
					plugin,
					parentEl,
					[],
					{
						onTaskStatusUpdate: handlers.onTaskStatusUpdate,
						onTaskSelected: handlers.onTaskSelected,
						onTaskCompleted: handlers.onTaskCompleted,
						onTaskContextMenu: handlers.onTaskContextMenu,
					},
					viewId,
				);

			case "calendar":
				return new CalendarComponent(
					app,
					plugin,
					parentEl,
					[],
					{
						onTaskSelected: handlers.onTaskSelected,
						onTaskCompleted: handlers.onTaskCompleted,
						onEventContextMenu: handlers.onEventContextMenu,
					},
					viewId,
				);

			case "gantt":
				return new GanttComponent(
					plugin,
					parentEl,
					{
						onTaskSelected: handlers.onTaskSelected,
						onTaskCompleted: handlers.onTaskCompleted,
						onTaskContextMenu: handlers.onTaskContextMenu,
					},
					viewId,
				);

			case "twocolumn":
				if (viewConfig.specificConfig?.viewType === "twocolumn") {
					return new TaskPropertyTwoColumnView(
						parentEl,
						app,
						plugin,
						viewConfig.specificConfig,
						viewId,
					);
				}
				return null;

			case "forecast":
				return new ForecastComponent(parentEl, app, plugin, {
					onTaskSelected: handlers.onTaskSelected,
					onTaskCompleted: handlers.onTaskCompleted,
					onTaskContextMenu: handlers.onTaskContextMenu,
					onTaskUpdate: handlers.onTaskUpdate,
				});

			case "table":
				{
					return new TableViewAdapter(
						app,
						plugin,
						parentEl,
						viewConfig.specificConfig as TableSpecificConfig,
						{
							onTaskSelected: handlers.onTaskSelected,
							onTaskCompleted: handlers.onTaskCompleted,
							onTaskContextMenu: handlers.onTaskContextMenu,
							onTaskUpdated: async (task: Task) => {
								// Handle task updates through WriteAPI
								if (plugin.writeAPI) {
									const result =
										await plugin.writeAPI.updateTask({
											taskId: task.id,
											updates: task,
										});
									if (!result.success) {
										console.error(
											"Failed to update task:",
											result.error,
										);
									}
								} else {
									console.error("WriteAPI not available");
								}
							},
						},
						viewId
					);
				}
				return null;

			case "quadrant":
				return new QuadrantComponent(
					app,
					plugin,
					parentEl,
					[],
					{
						onTaskStatusUpdate: handlers.onTaskStatusUpdate,
						onTaskSelected: handlers.onTaskSelected,
						onTaskCompleted: handlers.onTaskCompleted,
						onTaskContextMenu: handlers.onTaskContextMenu,
						onTaskUpdated: async (task: Task) => {
							// Handle task updates through WriteAPI
							if (plugin.writeAPI) {
								const result = await plugin.writeAPI.updateTask(
									{
										taskId: task.id,
										updates: task,
									},
								);
								if (!result.success) {
									console.error(
										"Failed to update task:",
										result.error,
									);
								}
							} else {
								console.error("WriteAPI not available");
							}
						},
					},
					viewId,
				);

			default:
				return null;
		}
	}
}

// 统一的视图组件管理器
export class ViewComponentManager extends Component {
	private configurationSignatures = new Map<string, string>();
	private components: Map<string, ViewComponentInterface> = new Map();
	private parentComponent: Component;
	private app: App;
	private plugin: TaskProgressBarPlugin;
	private parentEl: HTMLElement;
	private handlers: ViewEventHandlers;

	constructor(
		parentComponent: Component,
		app: App,
		plugin: TaskProgressBarPlugin,
		parentEl: HTMLElement,
		handlers: ViewEventHandlers,
	) {
		super();
		this.parentComponent = parentComponent;
		this.app = app;
		this.plugin = plugin;
		this.parentEl = parentEl;
		this.handlers = handlers;
	}

	/**
	 * 获取或创建指定视图的组件
	 */
	getOrCreateComponent(viewId: string): ViewComponentInterface | null {
		const viewConfig = getViewSettingOrDefault(this.plugin, viewId);
		const signature = JSON.stringify(viewConfig.specificConfig ?? null);
		const existing = this.components.get(viewId);
		if (existing && this.configurationSignatures.get(viewId) === signature) return existing;
		if (existing && typeof (existing as any).refreshConfiguration === "function" &&
			JSON.parse(this.configurationSignatures.get(viewId) || "null")?.viewType === viewConfig.specificConfig?.viewType) {
			(existing as any).refreshConfiguration();
			this.configurationSignatures.set(viewId, signature);
			return existing;
		}
		if (existing) {
			if (existing instanceof Component) this.parentComponent.removeChild(existing);
			else existing.unload?.();
			existing.containerEl.remove();
			this.components.delete(viewId);
		}
		const specificViewType = viewConfig.specificConfig?.viewType;

		// 确定视图类型
		let viewType: string | null = null;
		if (specificViewType) {
			viewType = specificViewType;
		} else if (
			[
				"calendar",
				"kanban",
				"gantt",
				"forecast",
				"table",
				"quadrant",
			].includes(viewId)
		) {
			viewType = viewId;
		}

		if (!viewType) {
			return null; // 不是特殊视图类型
		}

		// 创建新组件
		const component = ViewComponentFactory.createComponent(
			viewType,
			viewId,
			this.app,
			this.plugin,
			this.parentEl,
			this.handlers,
		);

		if (component) {
			// 添加到父组件管理
			if (component instanceof Component) {
				this.parentComponent.addChild(component);
			}

			// 初始化组件
			if (component.load) {
				component.load();
			}

			// 默认隐藏
			component.containerEl.hide();

			// 缓存组件
			this.components.set(viewId, component);
			this.configurationSignatures.set(viewId, signature);
		}

		return component;
	}

	/**
	 * 隐藏所有组件
	 */
	hideAllComponents(): void {
		this.components.forEach((component) => {
			component.containerEl.hide();
		});
	}

	/**
	 * 显示指定视图的组件
	 */
	showComponent(viewId: string): ViewComponentInterface | null {
		const component = this.getOrCreateComponent(viewId);
		if (component) {
			component.containerEl.show();
			requestAnimationFrame(() => { if (this.components.get(viewId) === component && component.containerEl.isShown()) component.onShown?.(); });
		}
		return component;
	}

	/**
	 * 检查是否为特殊视图
	 */
	isSpecialView(viewId: string): boolean {
		const viewConfig = getViewSettingOrDefault(this.plugin, viewId);
		const specificViewType = viewConfig.specificConfig?.viewType;

		console.log(
			"isSpecialView",
			viewId,
			specificViewType,
			["calendar", "kanban", "gantt", "forecast", "table", "quadrant"].includes(
				viewId,
			),
		);

		return !!(
			specificViewType ||
			["calendar", "kanban", "gantt", "forecast", "table", "quadrant"].includes(
				viewId,
			)
		);
	}

	/**
	 * 清理所有组件
	 */
	cleanup(): void {
		this.components.forEach((component) => {
			if (component instanceof Component) {
				this.parentComponent.removeChild(component);
			}
			else if (component.unload) {
				component.unload();
			}
		});
		this.components.clear();
		this.configurationSignatures.clear();
	}

	/**
	 * 获取所有组件的迭代器（用于批量操作）
	 */
	getAllComponents(): IterableIterator<[string, ViewComponentInterface]> {
		return this.components.entries();
	}

	onunload(): void {
		this.cleanup();
	}
}
