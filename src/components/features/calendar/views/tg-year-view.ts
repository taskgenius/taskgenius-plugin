import { t as settingsText } from "@/translations/helper";
/**
 * TGYearView - Year view extending @taskgenius/calendar BaseView
 *
 * This view displays a full year with 12 mini-month calendars.
 * Users can copy this view to create their own custom year-style views.
 */
import { App, debounce, moment } from "obsidian";
import {
	BaseView,
	type ViewMeta,
	type ViewRenderOptions,
	type CalendarEvent as TGCalendarEvent,
} from "@taskgenius/calendar";
import { CalendarEvent } from "@/components/features/calendar/index";
import {
	CalendarSpecificConfig,
	getViewSettingOrDefault,
} from "@/common/setting-definition";
import TaskProgressBarPlugin from "@/index";

/**
 * Options for YearView customization
 */
export interface YearViewOptions {
	/** First day of week (0=Sunday, 1=Monday, etc.) */
	firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
	/** Whether to hide weekends */
	hideWeekends?: boolean;
	/** Day click callback */
	onDayClick?: (
		ev: MouseEvent,
		timestamp: number,
		options: { behavior: "open-quick-capture" | "open-task-view" },
	) => void;
	/** Day hover callback */
	onDayHover?: (ev: MouseEvent, timestamp: number) => void;
	/** Month click callback */
	onMonthClick?: (ev: MouseEvent, timestamp: number) => void;
	/** Month hover callback */
	onMonthHover?: (ev: MouseEvent, timestamp: number) => void;
}

/**
 * YearView - Displays a full year with 12 mini-month calendars
 *
 * Extends BaseView from @taskgenius/calendar for integration with the calendar system.
 *
 * @example Creating a custom year view
 * ```typescript
 * class MyCustomYearView extends TGYearView {
 *   static override meta: ViewMeta = {
 *     type: 'my-year',
 *     label: 'My Year',
 *     shortLabel: 'MY',
 *     order: 60
 *   };
 *
 *   // Override to customize mini-month rendering
 *   protected override renderMiniMonth(container: HTMLElement, month: number, year: number) {
 *     // Custom rendering logic
 *   }
 * }
 * ```
 */
export class TGYearView<T = unknown> extends BaseView<T> {
	static meta: ViewMeta = {
		type: "year",
		label: settingsText("Year"),
		shortLabel: "Y",
		order: 50,
	};

	/** Plugin instance for accessing settings */
	protected plugin: TaskProgressBarPlugin | null = null;

	/** App instance for Obsidian integration */
	protected app: App | null = null;

	/** Custom options for this view */
	protected viewOptions: YearViewOptions = {};

	/** Override config from settings */
	protected overrideConfig?: Partial<CalendarSpecificConfig>;

	/** DOM event cleanup functions */
	private cleanupFns: (() => void)[] = [];

	/**
	 * Set plugin and app references (called after construction)
	 */
	setPluginContext(plugin: TaskProgressBarPlugin, app: App): void {
		this.plugin = plugin;
		this.app = app;
	}

	/**
	 * Set custom options for this view
	 */
	setOptions(options: YearViewOptions): void {
		this.viewOptions = options;
	}

	/**
	 * Set override config
	 */
	setOverrideConfig(config?: Partial<CalendarSpecificConfig>): void {
		this.overrideConfig = config;
	}

	/**
	 * Render the year view
	 */
	render(
		container: HTMLElement,
		events: TGCalendarEvent[],
		_options?: ViewRenderOptions,
	): void {
		// Cleanup previous event listeners
		this.cleanupEventListeners();

		const currentDate = this.context.adapter.create(
			this.context.currentDate as unknown as Date,
		);
		const year = moment(currentDate as unknown as Date).year();

		container.empty();
		container.addClass("view-year", "tg-year-view");

		// Convert events
		const calendarEvents = this.convertEvents(events);

		// Create year grid
		const yearGrid = container.createDiv("calendar-year-grid");

		// Filter events for this year
		const yearStart = moment({ year, month: 0, day: 1 });
		const yearEnd = moment({ year, month: 11, day: 31 });
		const yearEvents = this.filterEventsForYear(
			calendarEvents,
			yearStart,
			yearEnd,
		);

		// Get settings
		const { firstDayOfWeek, hideWeekends } = this.getEffectiveSettings();

		// Apply weekend hiding class
		if (hideWeekends) {
			container.addClass("hide-weekends");
		} else {
			container.removeClass("hide-weekends");
		}

		// Render 12 months
		for (let month = 0; month < 12; month++) {
			this.renderMiniMonth(
				yearGrid,
				year,
				month,
				yearEvents,
				firstDayOfWeek,
				hideWeekends,
			);
		}
	}

	/**
	 * Convert TGCalendarEvent to CalendarEvent
	 */
	protected convertEvents(events: TGCalendarEvent[]): CalendarEvent[] {
		return events.map((e) => ({
			...e,
			start: new Date(e.start),
			end: e.end ? new Date(e.end) : undefined,
			// Preserve original allDay value; default to true if not specified (most tasks are date-only)
			allDay: (e as unknown as CalendarEvent).allDay ?? true,
			metadata: e.metadata as CalendarEvent["metadata"],
		})) as unknown as CalendarEvent[];
	}

	/**
	 * Filter events for the year
	 */
	protected filterEventsForYear(
		events: CalendarEvent[],
		yearStart: moment.Moment,
		yearEnd: moment.Moment,
	): CalendarEvent[] {
		return events.filter((e) => {
			const start = moment(e.start);
			const end = e.end ? moment(e.end) : start;
			return (
				start.isSameOrBefore(yearEnd.endOf("day")) &&
				end.isSameOrAfter(yearStart.startOf("day"))
			);
		});
	}

	/**
	 * Get effective settings from plugin config and overrides
	 */
	protected getEffectiveSettings(): {
		firstDayOfWeek: number;
		hideWeekends: boolean;
	} {
		let firstDayOfWeek = 0;
		let hideWeekends = false;

		if (this.plugin) {
			const viewConfig = getViewSettingOrDefault(this.plugin, "calendar");
			const specificConfig =
				viewConfig.specificConfig as CalendarSpecificConfig;
			firstDayOfWeek =
				this.overrideConfig?.firstDayOfWeek ??
				this.viewOptions.firstDayOfWeek ??
				specificConfig.firstDayOfWeek ??
				0;
			hideWeekends =
				this.overrideConfig?.hideWeekends ??
				this.viewOptions.hideWeekends ??
				specificConfig?.hideWeekends ??
				false;
		} else {
			firstDayOfWeek = this.viewOptions.firstDayOfWeek ?? 0;
			hideWeekends = this.viewOptions.hideWeekends ?? false;
		}

		return { firstDayOfWeek, hideWeekends };
	}

	/**
	 * Render a single mini-month
	 */
	protected renderMiniMonth(
		container: HTMLElement,
		year: number,
		month: number,
		yearEvents: CalendarEvent[],
		firstDayOfWeek: number,
		hideWeekends: boolean,
	): void {
		const monthContainer = container.createDiv("calendar-mini-month");
		const monthMoment = moment({ year, month, day: 1 });

		// Month header
		const monthHeader = monthContainer.createDiv("mini-month-header");
		monthHeader.textContent = monthMoment.format("MMMM");
		monthHeader.style.cursor = "pointer";

		// Month header click
		const monthClickHandler = (ev: MouseEvent) => {
			if (this.viewOptions.onMonthClick) {
				this.viewOptions.onMonthClick(ev, monthMoment.valueOf());
			}
		};
		monthHeader.addEventListener("click", monthClickHandler);
		this.cleanupFns.push(() =>
			monthHeader.removeEventListener("click", monthClickHandler),
		);

		// Month header hover
		const monthHoverHandler = (ev: MouseEvent) => {
			if (this.viewOptions.onMonthHover) {
				this.viewOptions.onMonthHover(ev, monthMoment.valueOf());
			}
		};
		monthHeader.addEventListener("mouseenter", monthHoverHandler);
		this.cleanupFns.push(() =>
			monthHeader.removeEventListener("mouseenter", monthHoverHandler),
		);

		// Month body
		const monthBody = monthContainer.createDiv("mini-month-body");
		const daysWithEvents = this.calculateDaysWithEvents(
			monthMoment,
			yearEvents,
		);

		this.renderMiniMonthGrid(
			monthBody,
			monthMoment,
			daysWithEvents,
			firstDayOfWeek,
			hideWeekends,
		);
	}

	/**
	 * Calculate which days have events
	 */
	protected calculateDaysWithEvents(
		monthMoment: moment.Moment,
		events: CalendarEvent[],
	): Set<number> {
		const days = new Set<number>();
		const monthStart = monthMoment.clone().startOf("month");
		const monthEnd = monthMoment.clone().endOf("month");

		events.forEach((event) => {
			const datesToCheck = [
				event.start,
				event.metadata?.scheduledDate,
				event.metadata?.dueDate,
			];

			datesToCheck.forEach((dateInput) => {
				if (dateInput) {
					const dateMoment = moment(dateInput);
					if (
						dateMoment.isBetween(monthStart, monthEnd, "day", "[]")
					) {
						days.add(dateMoment.date());
					}
				}
			});
		});

		return days;
	}

	/**
	 * Render the mini-month grid
	 */
	protected renderMiniMonthGrid(
		container: HTMLElement,
		monthMoment: moment.Moment,
		daysWithEvents: Set<number>,
		firstDayOfWeek: number,
		hideWeekends: boolean,
	): void {
		container.empty();
		container.addClass("mini-month-grid");

		// Weekday headers
		this.renderWeekdayHeaders(container, firstDayOfWeek, hideWeekends);

		// Calculate grid boundaries
		const { gridStart, gridEnd } = this.calculateGridBoundaries(
			monthMoment,
			firstDayOfWeek,
			hideWeekends,
		);

		// Render day cells
		this.renderDayCells(
			container,
			monthMoment,
			gridStart,
			gridEnd,
			daysWithEvents,
			hideWeekends,
		);

		// Setup event listeners for the grid
		this.setupGridEventListeners(container);
	}

	/**
	 * Render weekday headers
	 */
	protected renderWeekdayHeaders(
		container: HTMLElement,
		firstDayOfWeek: number,
		hideWeekends: boolean,
	): void {
		const headerRow = container.createDiv("mini-weekday-header");
		const weekdays = moment.weekdaysMin(true);
		const rotatedWeekdays = [
			...weekdays.slice(firstDayOfWeek),
			...weekdays.slice(0, firstDayOfWeek),
		];

		const filteredWeekdays = hideWeekends
			? rotatedWeekdays.filter((_, index) => {
					const dayOfWeek = (firstDayOfWeek + index) % 7;
					return dayOfWeek !== 0 && dayOfWeek !== 6;
				})
			: rotatedWeekdays;

		filteredWeekdays.forEach((day) => {
			headerRow.createDiv("mini-weekday").textContent = day;
		});
	}

	/**
	 * Calculate grid start and end dates
	 */
	protected calculateGridBoundaries(
		monthMoment: moment.Moment,
		firstDayOfWeek: number,
		hideWeekends: boolean,
	): { gridStart: moment.Moment; gridEnd: moment.Moment } {
		const monthStart = monthMoment.clone().startOf("month");
		const monthEnd = monthMoment.clone().endOf("month");

		let gridStart: moment.Moment;
		let gridEnd: moment.Moment;

		if (hideWeekends) {
			gridStart = monthStart.clone();
			const daysToSubtractStart =
				(monthStart.weekday() - firstDayOfWeek + 7) % 7;
			gridStart.subtract(daysToSubtractStart, "days");

			while (gridStart.day() === 0 || gridStart.day() === 6) {
				gridStart.add(1, "day");
			}

			gridEnd = monthEnd.clone();
			const daysToAddEnd =
				(firstDayOfWeek + 4 - monthEnd.weekday() + 7) % 7;
			gridEnd.add(daysToAddEnd, "days");

			while (gridEnd.day() === 0 || gridEnd.day() === 6) {
				gridEnd.subtract(1, "day");
			}
		} else {
			const daysToSubtractStart =
				(monthStart.weekday() - firstDayOfWeek + 7) % 7;
			gridStart = monthStart
				.clone()
				.subtract(daysToSubtractStart, "days");

			const daysToAddEnd =
				(firstDayOfWeek + 6 - monthEnd.weekday() + 7) % 7;
			gridEnd = monthEnd.clone().add(daysToAddEnd, "days");
		}

		return { gridStart, gridEnd };
	}

	/**
	 * Render day cells
	 */
	protected renderDayCells(
		container: HTMLElement,
		monthMoment: moment.Moment,
		gridStart: moment.Moment,
		gridEnd: moment.Moment,
		daysWithEvents: Set<number>,
		hideWeekends: boolean,
	): void {
		const currentDayIter = gridStart.clone();

		while (currentDayIter.isSameOrBefore(gridEnd, "day")) {
			const isWeekend =
				currentDayIter.day() === 0 || currentDayIter.day() === 6;

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
			const isCurrentMonth = currentDayIter.isSame(monthMoment, "month");

			cell.textContent = String(dayNumber);

			if (!isCurrentMonth) {
				cell.addClass("is-other-month");
			}

			if (currentDayIter.isSame(moment(), "day")) {
				cell.addClass("is-today");
			}

			if (isCurrentMonth && daysWithEvents.has(dayNumber)) {
				cell.addClass("has-events");
			}

			cell.style.cursor = isCurrentMonth ? "pointer" : "default";

			currentDayIter.add(1, "day");
		}
	}

	/**
	 * Setup event listeners for the grid
	 */
	protected setupGridEventListeners(container: HTMLElement): void {
		// Click handler
		const clickHandler = (ev: MouseEvent) => {
			const target = ev.target as HTMLElement;
			const cell = target.closest(".mini-day-cell");
			if (cell) {
				const dateStr = cell.getAttribute("data-date");
				if (dateStr && this.viewOptions.onDayClick) {
					this.viewOptions.onDayClick(ev, moment(dateStr).valueOf(), {
						behavior: "open-task-view",
					});
				}
			}
		};
		container.addEventListener("click", clickHandler);
		this.cleanupFns.push(() =>
			container.removeEventListener("click", clickHandler),
		);

		// Hover handler (debounced)
		const hoverHandler = this.createDebouncedHoverHandler();
		container.addEventListener("mouseover", hoverHandler);
		this.cleanupFns.push(() =>
			container.removeEventListener("mouseover", hoverHandler),
		);
	}

	/**
	 * Create debounced hover handler
	 */
	protected createDebouncedHoverHandler(): (ev: MouseEvent) => void {
		return debounce((ev: MouseEvent) => {
			const target = ev.target as HTMLElement;
			const cell = target.closest(".mini-day-cell");
			if (cell) {
				const dateStr = cell.getAttribute("data-date");
				if (dateStr && this.viewOptions.onDayHover) {
					this.viewOptions.onDayHover(ev, moment(dateStr).valueOf());
				}
			}
		}, 200);
	}

	/**
	 * Cleanup event listeners
	 */
	protected cleanupEventListeners(): void {
		this.cleanupFns.forEach((fn) => fn());
		this.cleanupFns = [];
	}

	/**
	 * Navigation unit for prev/next buttons
	 */
	override getNavigationUnit(): "year" {
		return "year";
	}

	/**
	 * Header title for this view
	 */
	override getHeaderTitle(): string {
		const currentDate = this.context.adapter.create(
			this.context.currentDate as unknown as Date,
		);
		return moment(currentDate as unknown as Date).format("YYYY");
	}

	/**
	 * Cleanup when view is unmounted
	 */
	override onUnmount(): void {
		this.cleanupEventListeners();
		super.onUnmount();
	}
}
