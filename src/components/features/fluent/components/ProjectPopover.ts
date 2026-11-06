import { Component, Platform, Modal, App } from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import TaskProgressBarPlugin from "@/index";
import type { CustomProject } from "@/common/setting-definition";
import { t } from "@/translations/helper";

export class ProjectPopover extends Component {
	private popoverEl: HTMLElement | null = null;
	private plugin: TaskProgressBarPlugin;
	private onSave: (project: CustomProject) => void;
	private onClose: () => void;
	private nameInput: HTMLInputElement | null = null;
	private selectedColor = "#3498db";
	private popperInstance: PopperInstance | null = null;
	private referenceEl: HTMLElement;
	private clickHandler: ((e: MouseEvent) => void) | null = null;
	private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

	private readonly colors = [
		"#e74c3c",
		"#3498db",
		"#2ecc71",
		"#f39c12",
		"#9b59b6",
		"#1abc9c",
		"#34495e",
		"#e67e22",
		"#16a085",
		"#27ae60",
		"#2980b9",
		"#8e44ad",
		"#2c3e50",
		"#f1c40f",
		"#d35400",
	];

	constructor(
		plugin: TaskProgressBarPlugin,
		referenceEl: HTMLElement,
		onSave: (project: CustomProject) => void,
		onClose: () => void,
	) {
		super();
		this.plugin = plugin;
		this.referenceEl = referenceEl;
		this.onSave = onSave;
		this.onClose = onClose;
	}

	onload() {
		this.createPopover();
		this.setupPopper();
		this.setupEventHandlers();
	}

	onunload() {
		this.cleanup();
	}

	private createPopover() {
		this.popoverEl = createEl("div");
		this.popoverEl.addClass("fluent-project-popover-container");
		document.body.appendChild(this.popoverEl);

		const popover = this.popoverEl.createDiv({
			cls: "fluent-project-popover",
		});

		// Arrow
		const arrow = popover.createDiv({ cls: "fluent-popover-arrow" });
		arrow.setAttribute("data-popper-arrow", "");

		// Content
		const content = popover.createDiv({ cls: "fluent-popover-content" });

		// Title
		const header = content.createDiv({ cls: "fluent-popover-header" });
		header.createEl("h3", { text: t("New Project") });

		// Name input
		const nameSection = content.createDiv({
			cls: "fluent-popover-section",
		});
		nameSection.createEl("label", { text: t("Project Name") });
		this.nameInput = nameSection.createEl("input", {
			cls: "fluent-popover-input",
			attr: {
				type: "text",
				placeholder: t("Enter project name"),
			},
		});

		// Color picker
		const colorSection = content.createDiv({
			cls: "fluent-popover-section",
		});
		colorSection.createEl("label", { text: t("Choose Color") });

		const colorGrid = colorSection.createDiv({ cls: "fluent-color-grid" });
		this.colors.forEach((color) => {
			const colorButton = colorGrid.createDiv({
				cls: "fluent-color-button",
				attr: { "data-color": color },
			});
			colorButton.style.backgroundColor = color;

			if (color === this.selectedColor) {
				colorButton.addClass("is-selected");
			}

			this.registerDomEvent(colorButton, "click", () => {
				this.selectColor(color);
			});
		});

		// Action buttons
		const actions = content.createDiv({ cls: "fluent-popover-actions" });

		const cancelBtn = actions.createEl("button", {
			cls: "fluent-button fluent-button-secondary",
			text: t("Cancel"),
		});
		this.registerDomEvent(cancelBtn, "click", () => this.close());

		const saveBtn = actions.createEl("button", {
			cls: "fluent-button fluent-button-primary",
			text: t("Create"),
		});
		this.registerDomEvent(saveBtn, "click", () => this.save());

		// Handle Enter key on input
		this.registerDomEvent(this.nameInput, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && this.nameInput?.value.trim()) {
				this.save();
			}
		});

		// Focus input
		setTimeout(() => this.nameInput?.focus(), 50);
	}

	private setupPopper() {
		if (!this.popoverEl) return;

		const popover = this.popoverEl.querySelector(
			".fluent-project-popover",
		) as HTMLElement;
		if (!popover) return;

		this.popperInstance = createPopper(this.referenceEl, popover, {
			placement: "bottom-start",
			modifiers: [
				{
					name: "offset",
					options: {
						offset: [0, 8],
					},
				},
				{
					name: "arrow",
					options: {
						element: ".fluent-popover-arrow",
						padding: 8,
					},
				},
				{
					name: "preventOverflow",
					options: {
						boundary: "viewport",
						padding: 8,
					},
				},
				{
					name: "flip",
					options: {
						fallbackPlacements: ["top-start", "right", "left"],
					},
				},
			],
		});
	}

	private setupEventHandlers() {
		// Click outside to close
		this.clickHandler = (e: MouseEvent) => {
			if (
				this.popoverEl &&
				!this.popoverEl.contains(e.target as Node) &&
				!this.referenceEl.contains(e.target as Node)
			) {
				this.close();
			}
		};

		// Delay to avoid immediate close
		setTimeout(() => {
			if (this.clickHandler) {
				document.addEventListener("click", this.clickHandler);
			}
		}, 0);

		// Escape key to close
		this.escapeHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				this.close();
			}
		};
		document.addEventListener("keydown", this.escapeHandler);
	}

	private selectColor(color: string) {
		if (!this.popoverEl) return;

		this.selectedColor = color;

		// Update selected state
		this.popoverEl
			.querySelectorAll(".fluent-color-button")
			.forEach((btn) => {
				btn.removeClass("is-selected");
			});
		const selectedBtn = this.popoverEl.querySelector(
			`[data-color="${color}"]`,
		);
		selectedBtn?.addClass("is-selected");
	}

	private save() {
		if (!this.nameInput) return;

		const inputValue = this.nameInput.value.trim();
		if (!inputValue) {
			this.nameInput.focus();
			this.nameInput.addClass("is-error");
			setTimeout(() => this.nameInput?.removeClass("is-error"), 300);
			return;
		}

		// Convert spaces to dashes for internal name, keep original for display
		const internalName = inputValue.replace(/\s+/g, "-");
		const displayName = inputValue;

		const project: CustomProject = {
			id: `project-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`,
			name: internalName,
			displayName: displayName,
			color: this.selectedColor,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		this.onSave(project);
		this.close();
	}

	private close() {
		this.onClose();
		this.unload();
	}

	private cleanup() {
		// Clean up event listeners
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler);
			this.clickHandler = null;
		}
		if (this.escapeHandler) {
			document.removeEventListener("keydown", this.escapeHandler);
			this.escapeHandler = null;
		}

		// Clean up Popper instance
		if (this.popperInstance) {
			this.popperInstance.destroy();
			this.popperInstance = null;
		}

		// Remove DOM elements
		if (this.popoverEl) {
			this.popoverEl.remove();
			this.popoverEl = null;
		}
	}
}

export class EditProjectPopover extends Component {
	private popoverEl: HTMLElement | null = null;
	private plugin: TaskProgressBarPlugin;
	private project: CustomProject;
	private onSave: (project: CustomProject) => void;
	private onClose: () => void;
	private nameInput: HTMLInputElement | null = null;
	private displayNameInput: HTMLInputElement | null = null;
	private selectedColor: string;
	private popperInstance: PopperInstance | null = null;
	private referenceEl: HTMLElement;
	private clickHandler: ((e: MouseEvent) => void) | null = null;
	private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

	private readonly colors = [
		"#e74c3c",
		"#3498db",
		"#2ecc71",
		"#f39c12",
		"#9b59b6",
		"#1abc9c",
		"#34495e",
		"#e67e22",
		"#16a085",
		"#27ae60",
		"#2980b9",
		"#8e44ad",
		"#2c3e50",
		"#f1c40f",
		"#d35400",
	];

	constructor(
		plugin: TaskProgressBarPlugin,
		referenceEl: HTMLElement,
		project: CustomProject,
		onSave: (project: CustomProject) => void,
		onClose: () => void,
	) {
		super();
		this.plugin = plugin;
		this.referenceEl = referenceEl;
		this.project = { ...project }; // Clone the project to avoid direct mutation
		this.onSave = onSave;
		this.onClose = onClose;
		this.selectedColor = project.color || "#3498db";
	}

	onload() {
		this.createPopover();
		this.setupPopper();
		this.setupEventHandlers();
	}

	onunload() {
		this.cleanup();
	}

	private createPopover() {
		this.popoverEl = createEl("div");
		this.popoverEl.addClass("fluent-project-popover-container");
		document.body.appendChild(this.popoverEl);

		const popover = this.popoverEl.createDiv({
			cls: "fluent-project-popover",
		});

		// Arrow
		const arrow = popover.createDiv({ cls: "fluent-popover-arrow" });
		arrow.setAttribute("data-popper-arrow", "");

		// Content
		const content = popover.createDiv({ cls: "fluent-popover-content" });

		// Title
		const header = content.createDiv({ cls: "fluent-popover-header" });
		header.createEl("h3", { text: t("Edit Project") });

		// Display name input
		const displayNameSection = content.createDiv({
			cls: "fluent-popover-section",
		});
		displayNameSection.createEl("label", { text: t("Display Name") });
		this.displayNameInput = displayNameSection.createEl("input", {
			cls: "fluent-popover-input",
			attr: {
				type: "text",
				placeholder: t("Enter display name"),
				value: this.project.displayName || this.project.name,
			},
		});

		// Color picker
		const colorSection = content.createDiv({
			cls: "fluent-popover-section",
		});
		colorSection.createEl("label", { text: t("Choose Color") });

		const colorGrid = colorSection.createDiv({ cls: "fluent-color-grid" });
		this.colors.forEach((color) => {
			const colorButton = colorGrid.createDiv({
				cls: "fluent-color-button",
				attr: { "data-color": color },
			});
			colorButton.style.backgroundColor = color;

			if (color === this.selectedColor) {
				colorButton.addClass("is-selected");
			}

			this.registerDomEvent(colorButton, "click", () => {
				this.selectColor(color);
			});
		});

		// Action buttons
		const actions = content.createDiv({ cls: "fluent-popover-actions" });

		const cancelBtn = actions.createEl("button", {
			cls: "fluent-button fluent-button-secondary",
			text: t("Cancel"),
		});
		this.registerDomEvent(cancelBtn, "click", () => this.close());

		const saveBtn = actions.createEl("button", {
			cls: "fluent-button fluent-button-primary",
			text: t("Save"),
		});
		this.registerDomEvent(saveBtn, "click", () => this.save());

		// Handle Enter key on input
		this.registerDomEvent(
			this.displayNameInput,
			"keydown",
			(e: KeyboardEvent) => {
				if (e.key === "Enter") {
					this.save();
				}
			},
		);

		// Focus input
		setTimeout(() => this.displayNameInput?.focus(), 50);
	}

	private setupPopper() {
		if (!this.popoverEl) return;

		const popover = this.popoverEl.querySelector(
			".fluent-project-popover",
		) as HTMLElement;
		if (!popover) return;

		this.popperInstance = createPopper(this.referenceEl, popover, {
			placement: "bottom-start",
			modifiers: [
				{
					name: "offset",
					options: {
						offset: [0, 8],
					},
				},
				{
					name: "arrow",
					options: {
						element: ".fluent-popover-arrow",
						padding: 8,
					},
				},
				{
					name: "preventOverflow",
					options: {
						boundary: "viewport",
						padding: 8,
					},
				},
				{
					name: "flip",
					options: {
						fallbackPlacements: ["top-start", "right", "left"],
					},
				},
			],
		});
	}

	private setupEventHandlers() {
		// Click outside to close
		this.clickHandler = (e: MouseEvent) => {
			if (
				this.popoverEl &&
				!this.popoverEl.contains(e.target as Node) &&
				!this.referenceEl.contains(e.target as Node)
			) {
				this.close();
			}
		};

		// Delay to avoid immediate close
		setTimeout(() => {
			if (this.clickHandler) {
				document.addEventListener("click", this.clickHandler);
			}
		}, 0);

		// Escape key to close
		this.escapeHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				this.close();
			}
		};
		document.addEventListener("keydown", this.escapeHandler);
	}

	private selectColor(color: string) {
		if (!this.popoverEl) return;

		this.selectedColor = color;

		// Update selected state
		this.popoverEl
			.querySelectorAll(".fluent-color-button")
			.forEach((btn) => {
				btn.removeClass("is-selected");
			});
		const selectedBtn = this.popoverEl.querySelector(
			`[data-color="${color}"]`,
		);
		selectedBtn?.addClass("is-selected");
	}

	private save() {
		if (!this.displayNameInput) return;

		const displayNameValue = this.displayNameInput.value.trim();

		// Update the project object
		this.project.displayName = displayNameValue || this.project.name;
		this.project.color = this.selectedColor;
		this.project.updatedAt = Date.now();

		this.onSave(this.project);
		this.close();
	}

	private close() {
		this.onClose();
		this.unload();
	}

	private cleanup() {
		// Clean up event listeners
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler);
			this.clickHandler = null;
		}
		if (this.escapeHandler) {
			document.removeEventListener("keydown", this.escapeHandler);
			this.escapeHandler = null;
		}

		// Clean up Popper instance
		if (this.popperInstance) {
			this.popperInstance.destroy();
			this.popperInstance = null;
		}

		// Remove DOM elements
		if (this.popoverEl) {
			this.popoverEl.remove();
			this.popoverEl = null;
		}
	}
}

export class ProjectModal extends Modal {
	private plugin: TaskProgressBarPlugin;
	private onSave: (project: CustomProject) => void;
	private nameInput: HTMLInputElement | null = null;
	private selectedColor = "#3498db";
	private eventListeners: Array<{
		element: HTMLElement;
		event: string;
		handler: EventListener;
	}> = [];

	private readonly colors = [
		"#e74c3c",
		"#3498db",
		"#2ecc71",
		"#f39c12",
		"#9b59b6",
		"#1abc9c",
		"#34495e",
		"#e67e22",
		"#16a085",
		"#27ae60",
		"#2980b9",
		"#8e44ad",
		"#2c3e50",
		"#f1c40f",
		"#d35400",
	];

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		onSave: (project: CustomProject) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
	}

	private addEventListener(
		element: HTMLElement,
		event: string,
		handler: EventListener,
	) {
		element.addEventListener(event, handler);
		this.eventListeners.push({ element, event, handler });
	}

	onOpen() {
		const { contentEl } = this;

		// Add custom class for styling
		this.modalEl.addClass("fluent-project-modal");

		// Title
		contentEl.createEl("h2", { text: t("Create New Project") });

		// Name input section
		const nameSection = contentEl.createDiv({
			cls: "fluent-modal-section",
		});
		nameSection.createEl("label", { text: t("Project Name") });
		this.nameInput = nameSection.createEl("input", {
			cls: "fluent-modal-input",
			attr: {
				type: "text",
				placeholder: t("Enter project name"),
			},
		});

		// Color picker section
		const colorSection = contentEl.createDiv({
			cls: "fluent-modal-section",
		});
		colorSection.createEl("label", { text: t("Choose Color") });

		const colorGrid = colorSection.createDiv({
			cls: "fluent-modal-color-grid",
		});
		this.colors.forEach((color) => {
			const colorButton = colorGrid.createDiv({
				cls: "fluent-modal-color-button",
				attr: { "data-color": color },
			});
			colorButton.style.backgroundColor = color;

			if (color === this.selectedColor) {
				colorButton.addClass("is-selected");
			}

			this.addEventListener(colorButton, "click", () => {
				this.selectColor(color);
			});
		});

		// Preview section
		const previewSection = contentEl.createDiv({
			cls: "fluent-modal-section",
		});
		previewSection.createEl("label", { text: t("Preview") });
		const preview = previewSection.createDiv({
			cls: "fluent-modal-preview",
		});
		const previewItem = preview.createDiv({
			cls: "fluent-project-item-preview",
		});
		const previewColor = previewItem.createDiv({
			cls: "fluent-project-color",
		});
		previewColor.style.backgroundColor = this.selectedColor;
		const previewName = previewItem.createSpan({
			cls: "fluent-project-name",
		});

		// Update preview on name change
		this.addEventListener(this.nameInput, "input", () => {
			previewName.setText(this.nameInput?.value || t("Project Name"));
		});
		previewName.setText(t("Project Name"));

		// Footer with action buttons
		const footer = contentEl.createDiv({ cls: "fluent-modal-footer" });

		const cancelBtn = footer.createEl("button", {
			cls: "fluent-button fluent-button-secondary",
			text: t("Cancel"),
		});
		this.addEventListener(cancelBtn, "click", () => this.close());

		const createBtn = footer.createEl("button", {
			cls: "fluent-button fluent-button-primary",
			text: t("Create Project"),
		});
		this.addEventListener(createBtn, "click", () => this.save());

		// Handle Enter key
		this.addEventListener(this.nameInput, "keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && this.nameInput?.value.trim()) {
				this.save();
			}
		});

		// Focus input
		setTimeout(() => this.nameInput?.focus(), 100);
	}

	onClose() {
		// Clean up all event listeners
		this.eventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.eventListeners = [];

		// Clear content
		const { contentEl } = this;
		contentEl.empty();
	}

	private selectColor(color: string) {
		this.selectedColor = color;

		// Update selected state
		this.modalEl
			.querySelectorAll(".fluent-modal-color-button")
			.forEach((btn) => {
				btn.removeClass("is-selected");
			});
		const selectedBtn = this.modalEl.querySelector(
			`[data-color="${color}"]`,
		);
		selectedBtn?.addClass("is-selected");

		// Update preview
		const previewColor = this.modalEl.querySelector(
			".fluent-project-color",
		) as HTMLElement;
		if (previewColor) {
			previewColor.style.backgroundColor = color;
		}
	}

	private save() {
		if (!this.nameInput) return;

		const inputValue = this.nameInput.value.trim();
		if (!inputValue) {
			this.nameInput.focus();
			this.nameInput.addClass("is-error");
			setTimeout(() => this.nameInput?.removeClass("is-error"), 300);
			return;
		}

		// Convert spaces to dashes for internal name, keep original for display
		const internalName = inputValue.replace(/\s+/g, "-");
		const displayName = inputValue;

		const project: CustomProject = {
			id: `project-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`,
			name: internalName,
			displayName: displayName,
			color: this.selectedColor,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		this.onSave(project);
		this.close();
	}
}

export class EditProjectModal extends Modal {
	private plugin: TaskProgressBarPlugin;
	private project: CustomProject;
	private onSave: (project: CustomProject) => void;
	private nameInput: HTMLInputElement | null = null;
	private displayNameInput: HTMLInputElement | null = null;
	private selectedColor: string;
	private eventListeners: Array<{
		element: HTMLElement;
		event: string;
		handler: EventListener;
	}> = [];

	private readonly colors = [
		"#e74c3c",
		"#3498db",
		"#2ecc71",
		"#f39c12",
		"#9b59b6",
		"#1abc9c",
		"#34495e",
		"#e67e22",
		"#16a085",
		"#27ae60",
		"#2980b9",
		"#8e44ad",
		"#2c3e50",
		"#f1c40f",
		"#d35400",
	];

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		project: CustomProject,
		onSave: (project: CustomProject) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.project = { ...project }; // Clone to avoid direct mutation
		this.onSave = onSave;
		this.selectedColor = project.color || "#3498db";
	}

	private addEventListener(
		element: HTMLElement,
		event: string,
		handler: EventListener,
	) {
		element.addEventListener(event, handler);
		this.eventListeners.push({ element, event, handler });
	}

	onOpen() {
		const { contentEl } = this;

		// Add custom class for styling
		this.modalEl.addClass("fluent-project-modal");

		// Title
		contentEl.createEl("h2", { text: t("Edit Project") });

		// Display name input section
		const displayNameSection = contentEl.createDiv({
			cls: "fluent-modal-section",
		});
		displayNameSection.createEl("label", { text: t("Display Name") });
		this.displayNameInput = displayNameSection.createEl("input", {
			cls: "fluent-modal-input",
			attr: {
				type: "text",
				placeholder: t("Enter display name"),
				value: this.project.displayName || this.project.name,
			},
		});

		// Color picker section
		const colorSection = contentEl.createDiv({
			cls: "fluent-modal-section",
		});
		colorSection.createEl("label", { text: t("Choose Color") });

		const colorGrid = colorSection.createDiv({
			cls: "fluent-modal-color-grid",
		});
		this.colors.forEach((color) => {
			const colorButton = colorGrid.createDiv({
				cls: "fluent-modal-color-button",
				attr: { "data-color": color },
			});
			colorButton.style.backgroundColor = color;

			if (color === this.selectedColor) {
				colorButton.addClass("is-selected");
			}

			this.addEventListener(colorButton, "click", () => {
				this.selectColor(color);
			});
		});

		// Preview section
		const previewSection = contentEl.createDiv({
			cls: "fluent-modal-section",
		});
		previewSection.createEl("label", { text: t("Preview") });
		const preview = previewSection.createDiv({
			cls: "fluent-modal-preview",
		});
		const previewItem = preview.createDiv({
			cls: "fluent-project-item-preview",
		});
		const previewColor = previewItem.createDiv({
			cls: "fluent-project-color",
		});
		previewColor.style.backgroundColor = this.selectedColor;
		const previewName = previewItem.createSpan({
			cls: "fluent-project-name",
		});

		// Update preview on name change
		this.addEventListener(this.displayNameInput, "input", () => {
			previewName.setText(
				this.displayNameInput?.value || this.project.name,
			);
		});
		previewName.setText(this.project.displayName || this.project.name);

		// Footer with action buttons
		const footer = contentEl.createDiv({ cls: "fluent-modal-footer" });

		const cancelBtn = footer.createEl("button", {
			cls: "fluent-button fluent-button-secondary",
			text: t("Cancel"),
		});
		this.addEventListener(cancelBtn, "click", () => this.close());

		const saveBtn = footer.createEl("button", {
			cls: "fluent-button fluent-button-primary",
			text: t("Save Changes"),
		});
		this.addEventListener(saveBtn, "click", () => this.save());

		// Handle Enter key
		this.addEventListener(
			this.displayNameInput,
			"keydown",
			(e: KeyboardEvent) => {
				if (e.key === "Enter") {
					this.save();
				}
			},
		);

		// Focus input
		setTimeout(() => {
			this.displayNameInput?.focus();
			this.displayNameInput?.select();
		}, 100);
	}

	onClose() {
		// Clean up all event listeners
		this.eventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.eventListeners = [];

		// Clear content
		const { contentEl } = this;
		contentEl.empty();
	}

	private selectColor(color: string) {
		this.selectedColor = color;

		// Update selected state
		this.modalEl
			.querySelectorAll(".fluent-modal-color-button")
			.forEach((btn) => {
				btn.removeClass("is-selected");
			});
		const selectedBtn = this.modalEl.querySelector(
			`[data-color="${color}"]`,
		);
		selectedBtn?.addClass("is-selected");

		// Update preview
		const previewColor = this.modalEl.querySelector(
			".fluent-project-color",
		) as HTMLElement;
		if (previewColor) {
			previewColor.style.backgroundColor = color;
		}
	}

	private save() {
		if (!this.displayNameInput) return;

		const displayNameValue = this.displayNameInput.value.trim();

		// Update the project object
		this.project.displayName = displayNameValue || this.project.name;
		this.project.color = this.selectedColor;
		this.project.updatedAt = Date.now();

		this.onSave(this.project);
		this.close();
	}
}
