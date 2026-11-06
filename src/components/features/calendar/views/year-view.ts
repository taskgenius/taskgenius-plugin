/**
 * @deprecated This file is deprecated. Use `tg-year-view.ts` instead.
 *
 * The new TGYearView extends @taskgenius/calendar's BaseView for better
 * integration with the calendar system. This legacy implementation is kept
 * for backward compatibility but should not be used for new development.
 *
 * @see {@link ./tg-year-view.ts} for the new implementation
 */
import { App, Component, debounce, moment } from "obsidian";
import { CalendarEvent } from "@/components/features/calendar/index";
import {
	CalendarSpecificConfig,
	getViewSettingOrDefault,
} from "@/common/setting-definition"; // Import helper
import TaskProgressBarPlugin from "@/index"; // Import plugin type for settings access
import { CalendarViewComponent, CalendarViewOptions } from "./base-view"; // Import base class

/**
 * @deprecated Use TGYearView from `tg-year-view.ts` instead.
 * This class extends the legacy CalendarViewComponent (Obsidian Component).
 * The new TGYearView extends @taskgenius/calendar's BaseView for unified view management.
 */
export class YearView extends CalendarViewComponent {
	// Extend base class
	// private containerEl: HTMLElement; // Inherited
	private currentDate: moment.Moment;
	// private events: CalendarEvent[]; // Inherited
	private app: App; // Keep app reference
	private plugin: TaskProgressBarPlugin; // Keep plugin reference
	// Removed specific click/hover properties, use this.options
	private overrideConfig?: Partial<CalendarSpecificConfig>;

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		containerEl: HTMLElement,
		currentDate: moment.Moment,
		events: CalendarEvent[],
		options: CalendarViewOptions, // Use base options type
		overrideConfig?: Partial<CalendarSpecificConfig>,
	) {
		super(plugin, app, containerEl, events, options); // Call base constructor
		this.app = app;
		this.plugin = plugin;
		this.currentDate = currentDate;
		this.overrideConfig = overrideConfig;
	}

	render(): void {
		const year = this.currentDate.year();
		this.containerEl.empty();
		this.containerEl.addClass("view-year");

		console.log(
			`YearView: Rendering year ${year}. Total events received: ${this.events.length}`,
		); // Log total events

		// Create a grid container for the 12 months (e.g., 4x3)
		const yearGrid = this.containerEl.createDiv("calendar-year-grid");

		// Filter events relevant to the current year
		const yearStart = moment({ year: year, month: 0, day: 1 });
		const yearEnd = moment({ year: year, month: 11, day: 31 });
		const startTimeFilter = performance.now();
		const yearEvents = this.events.filter((e) => {
			const start = moment(e.start);
			const end = e.end ? moment(e.end) : start;
			return (
				start.isSameOrBefore(yearEnd.endOf("day")) &&
				end.isSameOrAfter(yearStart.startOf("day"))
			);
		});
		const endTimeFilter = performance.now();
		console.log(
			`YearView: Filtered ${
				yearEvents.length
			} events for year ${year} in ${endTimeFilter - startTimeFilter}ms`,
		); // Log filtering time

		// Get view settings (prefer override when provided)
		const viewConfig = getViewSettingOrDefault(this.plugin, "calendar"); // Adjust if needed
		const firstDayOfWeekSetting =
			this.overrideConfig?.firstDayOfWeek ??
			(viewConfig.specificConfig as CalendarSpecificConfig)
				.firstDayOfWeek;
		const hideWeekends =
			this.overrideConfig?.hideWeekends ??
			(viewConfig.specificConfig as CalendarSpecificConfig)
				?.hideWeekends ??
			false;

		// Add hide-weekends class if weekend hiding is enabled
		if (hideWeekends) {
			this.containerEl.addClass("hide-weekends");
		} else {
			this.containerEl.removeClass("hide-weekends");
		}
		// Default to Sunday (0) if the setting is undefined, following 0=Sun, 1=Mon, ..., 6=Sat
		const effectiveFirstDay =
			firstDayOfWeekSetting === undefined ? 0 : firstDayOfWeekSetting;

		console.log("Effective first day:", effectiveFirstDay);

		const totalRenderStartTime = performance.now(); // Start total render time

		for (let month = 0; month < 12; month++) {
			const monthStartTime = performance.now(); // Start time for this month
			const monthContainer = yearGrid.createDiv("calendar-mini-month");
			const monthMoment = moment({ year: year, month: month, day: 1 });

			// Add month header
			const monthHeader = monthContainer.createDiv("mini-month-header");
			monthHeader.textContent = monthMoment.format("MMMM"); // Full month name

			// Add click listener to month header
			this.registerDomEvent(monthHeader, "click", (ev) => {
				// Trigger callback from options if it exists
				if (this.options.onMonthClick) {
					this.options.onMonthClick(ev, monthMoment.valueOf());
				}
			});
			this.registerDomEvent(monthHeader, "mouseenter", (ev) => {
				// Trigger hover callback from options if it exists
				if (this.options.onMonthHover) {
					this.options.onMonthHover(ev, monthMoment.valueOf());
				}
			});
			monthHeader.style.cursor = "pointer"; // Indicate clickable

			// Add body container for the mini-calendar grid
			const monthBody = monthContainer.createDiv("mini-month-body");
			const daysWithEvents = this.calculateDaysWithEvents(
				monthMoment,
				yearEvents, // Pass already filtered year events
			);

			this.renderMiniMonthGrid(
				monthBody,
				monthMoment,
				daysWithEvents,
				effectiveFirstDay,
				hideWeekends,
			);
		}

		const totalRenderEndTime = performance.now(); // End total render time
		console.log(
			`YearView: Finished rendering year ${year} in ${
				totalRenderEndTime - totalRenderStartTime
			}ms. (First day: ${effectiveFirstDay})`,
		);
	}

	// Helper function to calculate which days in a month have events
	private calculateDaysWithEvents(
		monthMoment: moment.Moment,
		relevantEvents: CalendarEvent[], // Use the pre-filtered events
	): Set<number> {
		const days = new Set<number>();
		const monthStart = monthMoment.clone().startOf("month");
		const monthEnd = monthMoment.clone().endOf("month");

		relevantEvents.forEach((event) => {
			// Check if event has a specific date (start, scheduled, or due) within the current month
			const datesToCheck: (
				| string
				| moment.Moment
				| Date
				| number
				| null
				| undefined
			)[] = [
				event.start,
				event.metadata.scheduledDate, // Assuming 'scheduled' exists on CalendarEvent
				event.metadata.dueDate, // Assuming 'due' exists on CalendarEvent
			];

			datesToCheck.forEach((dateInput) => {
				if (dateInput) {
					const dateMoment = moment(dateInput);
					// Check if the date falls within the current month
					if (
						dateMoment.isBetween(monthStart, monthEnd, "day", "[]")
					) {
						// '[]' includes start and end days
						days.add(dateMoment.date()); // Add the day number (1-31)
					}
				}
			});
		});

		return days;
	}

	// Helper function to render the mini-grid for a month
	private renderMiniMonthGrid(
		container: HTMLElement,
		monthMoment: moment.Moment,
		daysWithEvents: Set<number>,
		effectiveFirstDay: number, // Pass the effective first day
		hideWeekends: boolean, // Pass the weekend hiding setting
	) {
		container.empty(); // Clear placeholder
		container.addClass("mini-month-grid");

		// Add mini weekday headers (optional, but helpful), rotated
		const headerRow = container.createDiv("mini-weekday-header");
		const weekdays = moment.weekdaysMin(true); // Use minimal names like Mo, Tu
		const rotatedWeekdays = [
			...weekdays.slice(effectiveFirstDay),
			...weekdays.slice(0, effectiveFirstDay),
		];

		// Filter out weekends if hideWeekends is enabled
		const filteredWeekdays = hideWeekends
			? rotatedWeekdays.filter((_, index) => {
					// Calculate the actual day of week for this header position
					const dayOfWeek = (effectiveFirstDay + index) % 7;
					return dayOfWeek !== 0 && dayOfWeek !== 6; // Exclude Sunday (0) and Saturday (6)
				})
			: rotatedWeekdays;

		filteredWeekdays.forEach((day) => {
			headerRow.createDiv("mini-weekday").textContent = day;
		});

		// Calculate grid boundaries using effective first day
		const monthStart = monthMoment.clone().startOf("month");
		const monthEnd = monthMoment.clone().endOf("month");

		let gridStart: moment.Moment;
		let gridEnd: moment.Moment;

		if (hideWeekends) {
			// When weekends are hidden, adjust grid to start and end on work days
			// Find the first work day of the week containing the start of month
			gridStart = monthStart.clone();
			const daysToSubtractStart =
				(monthStart.weekday() - effectiveFirstDay + 7) % 7;
			gridStart.subtract(daysToSubtractStart, "days");

			// Ensure gridStart is not a weekend
			while (gridStart.day() === 0 || gridStart.day() === 6) {
				gridStart.add(1, "day");
			}

			// Find the last work day of the week containing the end of month
			gridEnd = monthEnd.clone();
			const daysToAddEnd =
				(effectiveFirstDay + 4 - monthEnd.weekday() + 7) % 7; // 4 = Friday in work week
			gridEnd.add(daysToAddEnd, "days");

			// Ensure gridEnd is not a weekend
			while (gridEnd.day() === 0 || gridEnd.day() === 6) {
				gridEnd.subtract(1, "day");
			}
		} else {
			// Original logic for when weekends are shown
			const daysToSubtractStart =
				(monthStart.weekday() - effectiveFirstDay + 7) % 7;
			gridStart = monthStart
				.clone()
				.subtract(daysToSubtractStart, "days");

			const daysToAddEnd =
				(effectiveFirstDay + 6 - monthEnd.weekday() + 7) % 7;
			gridEnd = monthEnd.clone().add(daysToAddEnd, "days");
		}

		const currentDayIter = gridStart.clone();
		while (currentDayIter.isSameOrBefore(gridEnd, "day")) {
			const isWeekend =
				currentDayIter.day() === 0 || currentDayIter.day() === 6; // Sunday or Saturday

			// Skip weekend days if hideWeekends is enabled
			if (hideWeekends && isWeekend) {
				currentDayIter.add(1, "day");
				continue;
			}

			const cell = container.createEl("div", {
				cls: "mini-day-cell",
				attr: {
					"data-date": currentDayIter.format("YYYY-MM-DD"),
				},
			});
			const dayNumber = currentDayIter.date();
			// Only show day number if it's in the current month
			if (currentDayIter.isSame(monthMoment, "month")) {
				cell.textContent = String(dayNumber);
			} else {
				cell.addClass("is-other-month");
				cell.textContent = String(dayNumber); // Still show number but dimmed
			}

			if (currentDayIter.isSame(moment(), "day")) {
				cell.addClass("is-today");
			}
			if (
				currentDayIter.isSame(monthMoment, "month") &&
				daysWithEvents.has(dayNumber)
			) {
				cell.addClass("has-events");
			}

			// Add click listener to day cell only for days in the current month
			if (currentDayIter.isSame(monthMoment, "month")) {
				cell.style.cursor = "pointer"; // Indicate clickable
			} else {
				// Optionally disable clicks or provide different behavior for other month days
				cell.style.cursor = "default";
			}

			currentDayIter.add(1, "day");
		}

		this.registerDomEvent(container, "click", (ev) => {
			const target = ev.target as HTMLElement;
			if (target.closest(".mini-day-cell")) {
				const dateStr = target
					.closest(".mini-day-cell")
					?.getAttribute("data-date");
				if (this.options.onDayClick) {
					this.options.onDayClick(ev, moment(dateStr).valueOf(), {
						behavior: "open-task-view",
					});
				}
			}
		});

		this.registerDomEvent(container, "mouseover", (ev) => {
			this.debounceHover(ev);
		});
	}

	// Update methods to allow changing data after initial render
	updateEvents(events: CalendarEvent[]): void {
		this.events = events;
		this.render(); // Re-render will pick up current settings
	}

	updateCurrentDate(date: moment.Moment): void {
		this.currentDate = date;
		this.render(); // Re-render will pick up current settings and date
	}

	private debounceHover = debounce((ev: MouseEvent) => {
		const target = ev.target as HTMLElement;
		if (target.closest(".mini-day-cell")) {
			const dateStr = target
				.closest(".mini-day-cell")
				?.getAttribute("data-date");
			if (this.options.onDayHover) {
				this.options.onDayHover(ev, moment(dateStr).valueOf());
			}
		}
	}, 200);
}
