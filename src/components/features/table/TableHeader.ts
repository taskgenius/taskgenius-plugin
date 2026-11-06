import { Component, setIcon } from "obsidian";
import { t } from "@/translations/helper";

export interface TableHeaderCallbacks {
	onTreeModeToggle?: (enabled: boolean) => void;
	onRefresh?: () => void;
	onColumnToggle?: (columnId: string, visible: boolean) => void;
}

/**
 * Table header component for displaying task count, controls, and column toggles
 */
export class TableHeader extends Component {
	private headerEl: HTMLElement;
	private taskCount = 0;
	private isTreeMode = false;
	private availableColumns: Array<{
		id: string;
		title: string;
		visible: boolean;
	}> = [];
	private callbacks: TableHeaderCallbacks;
	private treeModeBtn: HTMLElement;
	private refreshBtn: HTMLElement;
	private columnBtn: HTMLElement;

	constructor(
		private containerEl: HTMLElement,
		callbacks: TableHeaderCallbacks = {}
	) {
		super();
		this.callbacks = callbacks;
	}

	onload() {
		this.render();
	}

	onunload() {
		if (this.headerEl) {
			this.headerEl.remove();
		}
	}

	/**
	 * Update task count display
	 */
	public updateTaskCount(count: number) {
		this.taskCount = count;
		this.updateTaskCountDisplay();
	}

	/**
	 * Update tree mode state
	 */
	public updateTreeMode(enabled: boolean) {
		this.isTreeMode = enabled;
		this.updateTreeModeDisplay();
	}

	/**
	 * Update available columns
	 */
	public updateColumns(
		columns: Array<{ id: string; title: string; visible: boolean }>
	) {
		this.availableColumns = columns;
		this.updateColumnToggles();
	}

	/**
	 * Render the header component
	 */
	private render() {
		this.headerEl = this.containerEl.createDiv("task-table-header-bar");

		// Left section - Task count and info
		const leftSection = this.headerEl.createDiv("table-header-left");
		this.createTaskCountDisplay(leftSection);

		// Right section - Controls
		const rightSection = this.headerEl.createDiv("table-header-right");
		this.createControls(rightSection);
	}

	/**
	 * Create task count display
	 */
	private createTaskCountDisplay(container: HTMLElement) {
		const countContainer = container.createDiv("task-count-container");

		const countIcon = countContainer.createSpan("task-count-icon");
		setIcon(countIcon, "list-checks");

		const countText = countContainer.createSpan("task-count-text");
		countText.textContent = this.getTaskCountText();
		countText.dataset.countElement = "true";
	}

	/**
	 * Get formatted task count text
	 */
	private getTaskCountText(): string {
		if (this.taskCount === 0) {
			return t("No tasks");
		} else if (this.taskCount === 1) {
			return t("1 task");
		} else {
			return `${this.taskCount} ${t("tasks")}`;
		}
	}

	/**
	 * Update task count display
	 */
	private updateTaskCountDisplay() {
		const countElement = this.headerEl.querySelector(
			"[data-count-element]"
		);
		if (countElement) {
			countElement.textContent = this.getTaskCountText();
		}
	}

	/**
	 * Create control buttons
	 */
	private createControls(container: HTMLElement) {
		const controlsContainer = container.createDiv(
			"table-controls-container"
		);

		// Tree mode toggle
		this.treeModeBtn = controlsContainer.createEl(
			"button",
			"table-control-btn tree-mode-btn"
		);

		const treeModeIcon = this.treeModeBtn.createSpan("tree-mode-icon");

		this.updateTreeModeButton();

		this.registerDomEvent(this.treeModeBtn, "click", () => {
			this.toggleTreeMode();
		});

		// Column visibility dropdown
		const columnDropdown = controlsContainer.createDiv("column-dropdown");
		this.columnBtn = columnDropdown.createEl(
			"button",
			"table-control-btn column-btn"
		);

		const columnIcon = this.columnBtn.createSpan("column-icon");
		setIcon(columnIcon, "eye");

		const columnText = this.columnBtn.createSpan("column-text");
		columnText.textContent = t("Columns");

		const dropdownArrow = this.columnBtn.createSpan("dropdown-arrow");
		setIcon(dropdownArrow, "chevron-down");

		this.columnBtn.title = t("Toggle column visibility");

		const columnMenu = columnDropdown.createDiv("column-dropdown-menu");
		columnMenu.toggle(false);

		this.registerDomEvent(this.columnBtn, "click", (e) => {
			e.stopPropagation();
			const isVisible = !columnMenu.isShown();
			columnMenu.toggle(isVisible);
		});

		// Close dropdown when clicking outside
		this.registerDomEvent(document, "click", () => {
			columnMenu.toggle(false);
		});

		// Store column menu for later updates
		this.updateColumnDropdown(columnMenu);
	}

	/**
	 * Update tree mode button appearance
	 */
	private updateTreeModeButton() {
		if (!this.treeModeBtn) return;

		const icon = this.treeModeBtn.querySelector(".tree-mode-icon");

		if (icon) {
			icon.empty();
			setIcon(
				icon as HTMLElement,
				this.isTreeMode ? "git-branch" : "list"
			);

			this.treeModeBtn.title = this.isTreeMode
				? t("Switch to List Mode")
				: t("Switch to Tree Mode");

			this.treeModeBtn.toggleClass("active", this.isTreeMode);
		}
	}

	/**
	 * Update tree mode display
	 */
	private updateTreeModeDisplay() {
		this.updateTreeModeButton();
	}

	/**
	 * Toggle tree mode
	 */
	private toggleTreeMode() {
		this.isTreeMode = !this.isTreeMode;
		this.updateTreeModeDisplay();

		if (this.callbacks.onTreeModeToggle) {
			this.callbacks.onTreeModeToggle(this.isTreeMode);
		}
	}

	/**
	 * Update column toggles
	 */
	private updateColumnToggles() {
		const columnMenu = this.headerEl.querySelector(".column-dropdown-menu");
		if (columnMenu) {
			this.createColumnToggles(columnMenu as HTMLElement);
		}
	}

	/**
	 * Create column toggle checkboxes
	 */
	private createColumnToggles(container: HTMLElement) {
		container.empty();

		this.availableColumns.forEach((column) => {
			const toggleItem = container.createDiv("column-toggle-item");

			const checkbox = toggleItem.createEl(
				"input",
				"column-toggle-checkbox"
			);
			checkbox.type = "checkbox";
			checkbox.checked = column.visible;
			checkbox.id = `column-toggle-${column.id}`;

			const label = toggleItem.createEl("label", "column-toggle-label");
			label.htmlFor = checkbox.id;
			label.textContent = column.title;

			this.registerDomEvent(checkbox, "change", () => {
				if (this.callbacks.onColumnToggle) {
					this.callbacks.onColumnToggle(column.id, checkbox.checked);
				}
			});
		});
	}

	/**
	 * Update column dropdown
	 */
	private updateColumnDropdown(columnMenu: HTMLElement) {
		this.createColumnToggles(columnMenu);
	}
}
