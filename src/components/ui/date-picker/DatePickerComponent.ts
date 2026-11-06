import {
	Component,
	ExtraButtonComponent,
	setIcon,
	DropdownComponent,
	ButtonComponent,
	App,
	moment,
	setTooltip,
} from "obsidian";
import { t } from "@/translations/helper";
import "@/styles/date-picker.scss";
import type TaskProgressBarPlugin from "@/index";

export interface DatePickerState {
	selectedDate: string | null;
	dateMark: string;
}

export class DatePickerComponent extends Component {
	private hostEl: HTMLElement;
	private app: App;
	private plugin?: TaskProgressBarPlugin;
	private state: DatePickerState;
	private onDateChange?: (date: string) => void;
	private currentViewDate: moment.Moment;

	constructor(
		hostEl: HTMLElement,
		app: App,
		plugin?: TaskProgressBarPlugin,
		initialDate?: string,
		dateMark = "📅"
	) {
		super();
		this.hostEl = hostEl;
		this.app = app;
		this.plugin = plugin;
		this.state = {
			selectedDate: initialDate || null,
			dateMark: dateMark,
		};
		this.currentViewDate = initialDate ? moment(initialDate) : moment();
	}

	onload(): void {
		this.render();
	}

	onunload(): void {
		this.hostEl.empty();
	}

	setOnDateChange(callback: (date: string) => void): void {
		this.onDateChange = callback;
	}

	getSelectedDate(): string | null {
		return this.state.selectedDate;
	}

	setSelectedDate(date: string | null): void {
		this.state.selectedDate = date;
		this.updateSelectedDateDisplay();
		if (this.onDateChange && date) {
			// Only pass the date string, let the caller handle formatting
			this.onDateChange(date);
		}
	}

	private render(): void {
		this.hostEl.empty();
		this.hostEl.addClass("date-picker-root-container");

		const mainPanel = this.hostEl.createDiv({
			cls: "date-picker-main-panel",
		});

		// Create two-column layout
		const leftPanel = mainPanel.createDiv({
			cls: "date-picker-left-panel",
		});

		const rightPanel = mainPanel.createDiv({
			cls: "date-picker-right-panel",
		});

		this.renderQuickOptions(leftPanel);
		this.renderCalendar(rightPanel);
	}

	private renderQuickOptions(container: HTMLElement): void {
		const quickOptionsContainer = container.createDiv({
			cls: "quick-options-container",
		});

		// Add quick date options
		const quickOptions = [
			{ amount: 0, unit: "days", label: t("Today") },
			{ amount: 1, unit: "days", label: t("Tomorrow") },
			{ amount: 2, unit: "days", label: t("In 2 days") },
			{ amount: 3, unit: "days", label: t("In 3 days") },
			{ amount: 5, unit: "days", label: t("In 5 days") },
			{ amount: 1, unit: "weeks", label: t("In 1 week") },
			{ amount: 10, unit: "days", label: t("In 10 days") },
			{ amount: 2, unit: "weeks", label: t("In 2 weeks") },
			{ amount: 1, unit: "months", label: t("In 1 month") },
			{ amount: 2, unit: "months", label: t("In 2 months") },
			{ amount: 3, unit: "months", label: t("In 3 months") },
			{ amount: 6, unit: "months", label: t("In 6 months") },
			{ amount: 1, unit: "years", label: t("In 1 year") },
		];

		quickOptions.forEach((option) => {
			const optionEl = quickOptionsContainer.createDiv({
				cls: "quick-option-item",
			});

			optionEl.createSpan({
				text: option.label,
				cls: "quick-option-label",
			});

			const date = moment().add(
				option.amount,
				option.unit as moment.unitOfTime.DurationConstructor
			);
			const formattedDate = date.format("YYYY-MM-DD");

			optionEl.createSpan({
				text: formattedDate,
				cls: "quick-option-date",
			});

			this.registerDomEvent(optionEl, "click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.setSelectedDate(formattedDate);
			});

			// Highlight if this is the selected date
			if (this.state.selectedDate === formattedDate) {
				optionEl.addClass("selected");
			}
		});

		// Add clear option
		const clearOption = container.createDiv({
			cls: "quick-option-item clear-option",
		});

		clearOption.createSpan({
			text: t("Clear Date"),
			cls: "quick-option-label",
		});

		this.registerDomEvent(clearOption, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.setSelectedDate(null);
		});
	}

	private renderCalendar(container: HTMLElement): void {
		const calendarContainer = container.createDiv({
			cls: "calendar-container",
		});

		this.renderCalendarHeader(calendarContainer, this.currentViewDate);
		this.renderCalendarGrid(calendarContainer, this.currentViewDate);
	}

	private renderCalendarHeader(
		container: HTMLElement,
		currentDate: moment.Moment
	): void {
		const header = container.createDiv({
			cls: "calendar-header",
		});

		// Previous month button
		const prevBtn = header.createDiv({
			cls: "calendar-nav-btn",
		});
		setIcon(prevBtn, "chevron-left");
		this.registerDomEvent(prevBtn, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.navigateMonth(-1);
		});

		// Month/Year display
		const monthYear = header.createDiv({
			cls: "calendar-month-year",
			text: currentDate.format("MMMM YYYY"),
		});

		// Next month button
		const nextBtn = header.createDiv({
			cls: "calendar-nav-btn",
		});
		setIcon(nextBtn, "chevron-right");
		this.registerDomEvent(nextBtn, "click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.navigateMonth(1);
		});
	}

	private renderCalendarGrid(
		container: HTMLElement,
		currentDate: moment.Moment
	): void {
		const grid = container.createDiv({
			cls: "calendar-grid",
		});

		// Day headers
		const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
		dayHeaders.forEach((day) => {
			grid.createDiv({
				cls: "calendar-day-header",
				text: day,
			});
		});

		// Get first day of month and number of days
		const firstDay = currentDate.clone().startOf("month");
		const lastDay = currentDate.clone().endOf("month");
		const startDate = firstDay.clone().startOf("week");
		const endDate = lastDay.clone().endOf("week");

		// Generate calendar days
		const current = startDate.clone();
		while (current.isSameOrBefore(endDate)) {
			const dayEl = grid.createDiv({
				cls: "calendar-day",
				text: current.format("D"),
			});

			const dateStr = current.format("YYYY-MM-DD");

			// Store the full date string for easy comparison later
			dayEl.setAttribute("data-date", dateStr);

			// Add classes for styling
			if (!current.isSame(firstDay, "month")) {
				dayEl.addClass("other-month");
			}

			if (current.isSame(moment(), "day")) {
				dayEl.addClass("today");
			}

			if (this.state.selectedDate === dateStr) {
				dayEl.addClass("selected");
			}

			// Add click handler
			this.registerDomEvent(dayEl, "click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.setSelectedDate(dateStr);
			});

			current.add(1, "day");
		}
	}

	private navigateMonth(direction: number): void {
		console.log(`Navigating month: ${direction}`);
		this.currentViewDate.add(direction, "month");
		this.render();
	}

	private updateSelectedDateDisplay(): void {
		// Update the visual state of selected items
		this.hostEl.querySelectorAll(".selected").forEach((el) => {
			el.removeClass("selected");
		});

		if (this.state.selectedDate) {
			// Highlight selected quick option
			this.hostEl.querySelectorAll(".quick-option-item").forEach((el) => {
				const dateSpan = el.querySelector(".quick-option-date");
				if (
					dateSpan &&
					dateSpan.textContent === this.state.selectedDate
				) {
					el.addClass("selected");
				}
			});

			// Highlight selected calendar day
			this.hostEl.querySelectorAll(".calendar-day").forEach((el) => {
				const storedDate = (el as HTMLElement).getAttribute(
					"data-date"
				);
				if (storedDate && this.state.selectedDate === storedDate) {
					el.addClass("selected");
				}
			});
		}
	}
}
