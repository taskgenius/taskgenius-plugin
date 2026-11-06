import { App, Component, CloseableComponent } from "obsidian";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { DatePickerComponent, DatePickerState } from "./DatePickerComponent";
import type TaskProgressBarPlugin from "@/index";

export class DatePickerPopover extends Component implements CloseableComponent {
	private app: App;
	public popoverRef: HTMLDivElement | null = null;
	public datePickerComponent: DatePickerComponent;
	private win: Window;
	private scrollParent: HTMLElement | Window;
	private popperInstance: PopperInstance | null = null;
	public onDateSelected: ((date: string | null) => void) | null = null;
	private plugin?: TaskProgressBarPlugin;
	private initialDate?: string;
	private dateMark: string;

	constructor(
		app: App,
		plugin?: TaskProgressBarPlugin,
		initialDate?: string,
		dateMark = "📅"
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.initialDate = initialDate;
		this.dateMark = dateMark;
		this.win = app.workspace.containerEl.win || window;
		this.scrollParent = this.win;
	}

	/**
	 * Shows the date picker popover at the given position.
	 */
	showAtPosition(position: { x: number; y: number }) {
		if (this.popoverRef) {
			this.close();
		}

		// Create content container
		const contentEl = createDiv({ cls: "date-picker-popover-content" });

		// Prevent clicks inside the popover from bubbling up
		this.registerDomEvent(contentEl, "click", (e) => {
			e.stopPropagation();
		});

		// Create date picker component
		this.datePickerComponent = new DatePickerComponent(
			contentEl,
			this.app,
			this.plugin,
			this.initialDate,
			this.dateMark
		);

		// Initialize component
		this.datePickerComponent.onload();

		// Set up date change callback
		this.datePickerComponent.setOnDateChange((date: string) => {
			if (this.onDateSelected) {
				this.onDateSelected(date);
			}
			this.close();
		});

		// Create the popover
		this.popoverRef = this.app.workspace.containerEl.createDiv({
			cls: "date-picker-popover tg-menu bm-menu",
		});
		this.popoverRef.appendChild(contentEl);

		document.body.appendChild(this.popoverRef);

		// Create a virtual element for Popper.js
		const virtualElement = {
			getBoundingClientRect: () => ({
				width: 0,
				height: 0,
				top: position.y,
				right: position.x,
				bottom: position.y,
				left: position.x,
				x: position.x,
				y: position.y,
				toJSON: function () {
					return this;
				},
			}),
		};

		if (this.popoverRef) {
			this.popperInstance = createPopper(
				virtualElement,
				this.popoverRef,
				{
					placement: "bottom-start",
					modifiers: [
						{
							name: "offset",
							options: {
								offset: [0, 8], // Offset the popover slightly from the reference
							},
						},
						{
							name: "preventOverflow",
							options: {
								padding: 10, // Padding from viewport edges
							},
						},
						{
							name: "flip",
							options: {
								fallbackPlacements: [
									"top-start",
									"right-start",
									"left-start",
								],
								padding: 10,
							},
						},
					],
				}
			);
		}

		// Use timeout to ensure popover is rendered before adding listeners
		this.win.setTimeout(() => {
			this.win.addEventListener("click", this.clickOutside);
			this.scrollParent.addEventListener(
				"scroll",
				this.scrollHandler,
				true
			); // Use capture for scroll
		}, 10);
	}

	private clickOutside = (e: MouseEvent) => {
		if (this.popoverRef && !this.popoverRef.contains(e.target as Node)) {
			this.close();
		}
	};

	private scrollHandler = (e: Event) => {
		if (this.popoverRef) {
			if (
				e.target instanceof Node &&
				this.popoverRef.contains(e.target)
			) {
				const targetElement = e.target as HTMLElement;
				if (
					targetElement.scrollHeight > targetElement.clientHeight ||
					targetElement.scrollWidth > targetElement.clientWidth
				) {
					return;
				}
			}
			this.close();
		}
	};

	/**
	 * Closes the popover.
	 */
	close() {
		if (this.popperInstance) {
			this.popperInstance.destroy();
			this.popperInstance = null;
		}

		if (this.popoverRef) {
			this.popoverRef.remove();
			this.popoverRef = null;
		}

		this.win.removeEventListener("click", this.clickOutside);
		this.scrollParent.removeEventListener(
			"scroll",
			this.scrollHandler,
			true
		);

		if (this.datePickerComponent) {
			this.datePickerComponent.onunload();
		}
	}
}
