import { App, Modal } from "obsidian";
import { DatePickerComponent, DatePickerState } from "./DatePickerComponent";
import type TaskProgressBarPlugin from "@/index";

export class DatePickerModal extends Modal {
	public datePickerComponent: DatePickerComponent;
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
		super(app);
		this.plugin = plugin;
		this.initialDate = initialDate;
		this.dateMark = dateMark;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.datePickerComponent = new DatePickerComponent(
			this.contentEl,
			this.app,
			this.plugin,
			this.initialDate,
			this.dateMark
		);

		this.datePickerComponent.onload();

		// Set up date change callback
		this.datePickerComponent.setOnDateChange((date: string) => {
			if (this.onDateSelected) {
				this.onDateSelected(date);
			}
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;

		if (this.datePickerComponent) {
			this.datePickerComponent.onunload();
		}

		contentEl.empty();
	}
}
