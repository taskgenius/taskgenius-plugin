import { Component, App } from "obsidian";
import { TableSpecificConfig } from "@/common/setting-definition";
import { EditorCallbacks } from "./TableTypes";
import TaskProgressBarPlugin from "@/index";
import { t } from "@/translations/helper";
import { DatePickerPopover } from "@/components/ui/date-picker/DatePickerPopover";
import { ContextSuggest, ProjectSuggest, TagSuggest } from "@/components/ui/inputs/AutoComplete";

/**
 * Table editor component responsible for inline cell editing
 */
export class TableEditor extends Component {
	private currentEditCell: HTMLElement | null = null;
	private currentInput: HTMLInputElement | HTMLSelectElement | null = null;
	private currentRowId = "";
	private currentColumnId = "";
	private originalValue: any = null;

	constructor(
		private app: App,
		private plugin: TaskProgressBarPlugin,
		private config: TableSpecificConfig,
		private callbacks: EditorCallbacks
	) {
		super();
	}

	onload() {
		this.setupGlobalEventListeners();
	}

	onunload() {
		this.cancelEdit();
	}

	/**
	 * Start editing a cell
	 */
	public startEdit(rowId: string, columnId: string, cellEl: HTMLElement) {
		// Cancel any existing edit
		this.cancelEdit();

		this.currentEditCell = cellEl;
		this.currentRowId = rowId;
		this.currentColumnId = columnId;
		this.originalValue = this.extractCellValue(cellEl, columnId);

		// Create appropriate input element based on column type
		const input = this.createInputElement(columnId, this.originalValue);
		if (!input) return;

		this.currentInput = input;

		// Replace cell content with input
		cellEl.empty();
		cellEl.appendChild(input);
		cellEl.addClass("editing");

		// Focus and select input
		input.focus();
		if (input instanceof HTMLInputElement) {
			input.select();
		}

		// Setup input event listeners
		this.setupInputEventListeners(input);
	}

	/**
	 * Save the current edit
	 */
	public saveEdit() {
		if (!this.currentInput || !this.currentEditCell) return;

		const newValue = this.getInputValue(
			this.currentInput,
			this.currentColumnId
		);

		// Validate the new value
		if (!this.validateValue(newValue, this.currentColumnId)) {
			this.showValidationError();
			return;
		}

		// Notify parent component of the change
		this.callbacks.onCellEdit(
			this.currentRowId,
			this.currentColumnId,
			newValue
		);

		// Clean up
		this.finishEdit();
		this.callbacks.onEditComplete();
	}

	/**
	 * Cancel the current edit
	 */
	public cancelEdit() {
		if (!this.currentEditCell) return;

		// Restore original content
		this.restoreCellContent();
		this.finishEdit();
		this.callbacks.onEditCancel();
	}

	/**
	 * Create appropriate input element based on column type
	 */
	private createInputElement(
		columnId: string,
		currentValue: any
	): HTMLInputElement | HTMLSelectElement | null {
		switch (columnId) {
			case "status":
				return this.createStatusSelect(currentValue);
			case "priority":
				return this.createPrioritySelect(currentValue);
			case "dueDate":
			case "startDate":
			case "scheduledDate":
				return this.createDateInput(currentValue);
			case "tags":
				return this.createTagsInput(currentValue);
			case "content":
				return this.createTextInput(currentValue, true); // Multiline for content
			case "project":
				return this.createProjectInput(currentValue);
			case "context":
				return this.createContextInput(currentValue);
			default:
				return this.createTextInput(currentValue, false);
		}
	}

	/**
	 * Create status select dropdown
	 */
	private createStatusSelect(currentValue: string): HTMLSelectElement {
		const select = document.createElement("select");
		select.className = "task-table-status-select";

		const statusOptions = [
			{value: " ", label: t("Not Started")},
			{value: "/", label: t("In Progress")},
			{value: "x", label: t("Completed")},
			{value: "-", label: t("Abandoned")},
			{value: "?", label: t("Planned")},
		];

		statusOptions.forEach((option) => {
			const optionEl = document.createElement("option");
			optionEl.value = option.value;
			optionEl.textContent = option.label;
			optionEl.selected = option.value === currentValue;
			select.appendChild(optionEl);
		});

		return select;
	}

	/**
	 * Create priority select dropdown
	 */
	private createPrioritySelect(currentValue: number): HTMLSelectElement {
		const select = document.createElement("select");
		select.className = "task-table-priority-select";

		const priorityOptions = [
			{value: "", label: t("No Priority")},
			{value: "1", label: t("High Priority")},
			{value: "2", label: t("Medium Priority")},
			{value: "3", label: t("Low Priority")},
		];

		priorityOptions.forEach((option) => {
			const optionEl = document.createElement("option");
			optionEl.value = option.value;
			optionEl.textContent = option.label;
			optionEl.selected = option.value === String(currentValue || "");
			select.appendChild(optionEl);
		});

		return select;
	}

	/**
	 * Create date input
	 */
	private createDateInput(currentValue: number): HTMLInputElement {
		const input = createEl("input", {
			type: "text",
			cls: "task-table-date-input",
			placeholder: t("Click to select date"),
			attr: {
				readOnly: true,
			},
		});

		if (currentValue) {
			const date = new Date(currentValue);
			input.value = date.toLocaleDateString();
		}

		// Add click handler to open date picker
		this.registerDomEvent(input, "click", (e) => {
			e.stopPropagation();
			this.openDatePicker(input, currentValue);
		});

		return input;
	}

	/**
	 * Open date picker popover
	 */
	private openDatePicker(input: HTMLInputElement, currentValue?: number) {
		const initialDate = currentValue
			? new Date(currentValue).toISOString().split("T")[0]
			: undefined;

		const popover = new DatePickerPopover(
			this.app,
			this.plugin,
			initialDate
		);

		popover.onDateSelected = (dateStr: string | null) => {
			if (dateStr) {
				const date = new Date(dateStr);
				input.value = date.toLocaleDateString();
				input.dataset.timestamp = date.getTime().toString();
			} else {
				input.value = "";
				delete input.dataset.timestamp;
			}
			popover.close();
		};

		// Position the popover near the input
		const rect = input.getBoundingClientRect();
		popover.showAtPosition({
			x: rect.left,
			y: rect.bottom + 5,
		});
	}

	/**
	 * Create tags input
	 */
	private createTagsInput(currentValue: string[]): HTMLInputElement {
		const input = document.createElement("input");
		input.type = "text";
		input.className = "task-table-tags-input";
		input.placeholder = t("Enter tags separated by commas");

		if (currentValue && Array.isArray(currentValue)) {
			input.value = currentValue.join(", ");
		}

		// Add tags autocomplete
		new TagSuggest(this.app, input, this.plugin);

		return input;
	}

	/**
	 * Create text input
	 */
	private createTextInput(
		currentValue: string,
		multiline = false
	): HTMLInputElement {
		const input = document.createElement("input");
		input.type = "text";
		input.className = "task-table-text-input";
		input.value = currentValue || "";

		if (multiline) {
			input.className += " multiline";
		}

		return input;
	}

	/**
	 * Create project input with autocomplete
	 */
	private createProjectInput(currentValue: string): HTMLInputElement {
		const input = this.createTextInput(currentValue, false);
		input.className += " task-table-project-input";
		input.placeholder = t("Enter project name");

		// Add project autocomplete
		new ProjectSuggest(this.app, input, this.plugin);

		return input;
	}

	/**
	 * Create context input with autocomplete
	 */
	private createContextInput(currentValue: string): HTMLInputElement {
		const input = this.createTextInput(currentValue, false);
		input.className += " task-table-context-input";
		input.placeholder = t("Enter context");

		// Add context autocomplete
		new ContextSuggest(this.app, input, this.plugin);

		return input;
	}

	/**
	 * Get value from input element
	 */
	private getInputValue(
		input: HTMLInputElement | HTMLSelectElement,
		columnId: string
	): any {
		switch (columnId) {
			case "status":
				return input.value;
			case "priority":
				return input.value ? parseInt(input.value) : undefined;
			case "dueDate":
			case "startDate":
			case "scheduledDate":
				// For date inputs, check if we have a timestamp in dataset
				if (
					input instanceof HTMLInputElement &&
					input.dataset.timestamp
				) {
					return parseInt(input.dataset.timestamp);
				}
				// Fallback to parsing the display value
				return input.value
					? new Date(input.value).getTime()
					: undefined;
			case "tags":
				return input.value
					? input.value
						.split(",")
						.map((tag) => tag.trim())
						.filter((tag) => tag)
					: [];
			default:
				return input.value;
		}
	}

	/**
	 * Extract current value from cell element
	 */
	private extractCellValue(cellEl: HTMLElement, columnId: string): any {
		// This is a simplified extraction - in a real implementation,
		// you might want to store the original value in a data attribute
		const textContent = cellEl.textContent || "";

		switch (columnId) {
			case "status":
				// Extract status symbol from the cell
				const statusMap: Record<string, string> = {
					[t("Not Started")]: " ",
					[t("Completed")]: "x",
					[t("In Progress")]: "/",
					[t("Abandoned")]: "-",
					[t("Planned")]: "?",
				};
				return statusMap[textContent] || " ";
			case "priority":
				const priorityMap: Record<string, number> = {
					[t("High")]: 1,
					[t("Medium")]: 2,
					[t("Low")]: 3,
				};
				return priorityMap[textContent] || undefined;
			case "tags":
				// Extract tags from tag chips
				const tagChips = cellEl.querySelectorAll(
					".task-table-tag-chip"
				);
				return Array.from(tagChips).map(
					(chip) => chip.textContent || ""
				);
			default:
				return textContent;
		}
	}

	/**
	 * Validate input value
	 */
	private validateValue(value: any, columnId: string): boolean {
		switch (columnId) {
			case "priority":
				return (
					value === undefined ||
					(typeof value === "number" && value >= 1 && value <= 3)
				);
			case "dueDate":
			case "startDate":
			case "scheduledDate":
				return (
					value === undefined ||
					(typeof value === "number" && !isNaN(value))
				);
			case "content":
				return typeof value === "string" && value.trim().length > 0;
			default:
				return true;
		}
	}

	/**
	 * Show validation error
	 */
	private showValidationError() {
		if (!this.currentInput) return;

		this.currentInput.addClass("error");
		this.currentInput.title = t("Invalid value");

		// Remove error styling after a delay
		setTimeout(() => {
			if (this.currentInput) {
				this.currentInput.removeClass("error");
				this.currentInput.title = "";
			}
		}, 3000);
	}

	/**
	 * Setup input event listeners
	 */
	private setupInputEventListeners(
		input: HTMLInputElement | HTMLSelectElement
	) {
		// Save on Enter key
		this.registerDomEvent(input, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				this.saveEdit();
			} else if (e.key === "Escape") {
				e.preventDefault();
				this.cancelEdit();
			}
		});

		// Save on blur (focus lost)
		this.registerDomEvent(input, "blur", () => {
			// Small delay to allow for other events to process
			setTimeout(() => {
				if (this.currentInput === input) {
					this.saveEdit();
				}
			}, 100);
		});

		// Prevent event bubbling
		this.registerDomEvent(input, "click", (e) => {
			e.stopPropagation();
		});
	}

	/**
	 * Setup global event listeners
	 */
	private setupGlobalEventListeners() {
		// Cancel edit on outside click
		this.registerDomEvent(document, "click", (e) => {
			if (
				this.currentEditCell &&
				!this.currentEditCell.contains(e.target as Node)
			) {
				this.saveEdit();
			}
		});
	}

	/**
	 * Restore original cell content
	 */
	private restoreCellContent() {
		if (!this.currentEditCell) return;

		// This is a simplified restoration - in a real implementation,
		// you might want to re-render the cell with the original value
		this.currentEditCell.textContent = String(this.originalValue || "");
		this.currentEditCell.removeClass("editing");
	}

	/**
	 * Finish editing and clean up
	 */
	private finishEdit() {
		if (this.currentEditCell) {
			this.currentEditCell.removeClass("editing");
		}

		this.currentEditCell = null;
		this.currentInput = null;
		this.currentRowId = "";
		this.currentColumnId = "";
		this.originalValue = null;
	}
}
