import { Component, App } from "obsidian";
import { Task } from "@/types/task";
import { TableView, TableViewCallbacks } from "./TableView";
import { TableSpecificConfig } from "../../../common/setting-definition";
import TaskProgressBarPlugin from "@/index";

/**
 * Table view adapter to make TableView compatible with ViewComponentManager
 */
export class TableViewAdapter extends Component {
	public containerEl: HTMLElement;
	private tableView: TableView;

	constructor(
		private app: App,
		private plugin: TaskProgressBarPlugin,
		private parentEl: HTMLElement,
		private config: TableSpecificConfig,
		private callbacks: TableViewCallbacks
	) {
		super();

		// Create container
		this.containerEl = this.parentEl.createDiv("table-view-adapter");

		// Create table view with all callbacks
		this.tableView = new TableView(
			this.app,
			this.plugin,
			this.containerEl,
			this.config,
			{
				onTaskSelected: this.callbacks.onTaskSelected,
				onTaskCompleted: this.callbacks.onTaskCompleted,
				onTaskContextMenu: this.callbacks.onTaskContextMenu,
				onTaskUpdated: this.callbacks.onTaskUpdated,
			}
		);
	}

	onload() {
		this.addChild(this.tableView);
		this.tableView.load();
	}

	onunload() {
		this.tableView.unload();
		this.removeChild(this.tableView);
	}

	/**
	 * Update tasks in the table view
	 */
	public onShown(): void { this.tableView.onShown(); }

	public updateTasks(tasks: Task[]) {
		this.tableView.updateTasks(tasks);
	}

	/**
	 * Set tasks (alias for updateTasks for compatibility)
	 */
	public setTasks(tasks: Task[], allTasks?: Task[]) {
		this.updateTasks(tasks);
	}

	/**
	 * Toggle tree view mode
	 */
	public toggleTreeView() {
		this.tableView.toggleTreeView();
	}

	/**
	 * Get selected tasks
	 */
	public getSelectedTasks(): Task[] {
		return this.tableView.getSelectedTasks();
	}

	/**
	 * Clear selection
	 */
	public clearSelection() {
		this.tableView.clearSelection();
	}

	/**
	 * Export table data
	 */
	public exportData(): any[] {
		return this.tableView.exportData();
	}
}
