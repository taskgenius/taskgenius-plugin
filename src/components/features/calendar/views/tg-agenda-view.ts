import { t as settingsText } from "@/translations/helper";
/**
 * TGAgendaView - Agenda view extending @taskgenius/calendar BaseView
 *
 * This view displays upcoming events in a list format grouped by day.
 * Users can copy this view to create their own custom agenda-style views.
 */
import { App, moment } from "obsidian";
import {
	BaseView,
	type ViewMeta,
	type ViewRenderOptions,
	type CalendarEvent as TGCalendarEvent,
} from "@taskgenius/calendar";
import { CalendarEvent } from "@/components/features/calendar/index";
import { renderCalendarEvent } from "../rendering/event-renderer";
import TaskProgressBarPlugin from "@/index";

/**
 * Options for AgendaView customization
 */
export interface AgendaViewOptions {
	/** Number of days to show in the agenda (default: 7) */
	daysToShow?: number;
	/** Whether to show empty days (default: false) */
	showEmptyDays?: boolean;
	/** Date format for day headers (default: "dddd, MMMM D") */
	dayHeaderFormat?: string;
	/** Event click callback */
	onEventClick?: (ev: MouseEvent, event: CalendarEvent) => void;
	/** Event hover callback */
	onEventHover?: (ev: MouseEvent, event: CalendarEvent) => void;
	/** Event context menu callback */
	onEventContextMenu?: (ev: MouseEvent, event: CalendarEvent) => void;
	/** Event complete callback */
	onEventComplete?: (ev: MouseEvent, event: CalendarEvent) => void;
}

/**
 * AgendaView - Displays events in a list format grouped by day
 *
 * Extends BaseView from @taskgenius/calendar for integration with the calendar system.
 *
 * @example Creating a custom agenda view
 * ```typescript
 * class MyCustomAgendaView extends TGAgendaView {
 *   static override meta: ViewMeta = {
 *     type: 'my-agenda',
 *     label: 'My Agenda',
 *     shortLabel: 'MA',
 *     order: 50
 *   };
 *
 *   protected override daysToShow = 14; // Show 2 weeks
 * }
 * ```
 */
export class TGAgendaView<T = unknown> extends BaseView<T> {
	static meta: ViewMeta = {
		type: "agenda",
		label: settingsText("Agenda"),
		shortLabel: "A",
		order: 40,
	};

	/** Plugin instance for accessing settings and services */
	protected plugin: TaskProgressBarPlugin | null = null;

	/** App instance for Obsidian integration */
	protected app: App | null = null;

	/** Custom options for this view */
	protected viewOptions: AgendaViewOptions = {};

	/** Number of days to display (can be overridden by subclasses) */
	protected daysToShow = 7;

	/** Whether to show days with no events */
	protected showEmptyDays = false;

	/** Format string for day headers */
	protected dayHeaderFormat = "dddd, MMMM D";

	/** Child components for cleanup */
	private childComponents: { unload: () => void }[] = [];

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
	setOptions(options: AgendaViewOptions): void {
		this.viewOptions = options;
		if (options.daysToShow !== undefined) {
			this.daysToShow = options.daysToShow;
		}
		if (options.showEmptyDays !== undefined) {
			this.showEmptyDays = options.showEmptyDays;
		}
		if (options.dayHeaderFormat !== undefined) {
			this.dayHeaderFormat = options.dayHeaderFormat;
		}
	}

	/**
	 * Render the agenda view
	 */
	render(
		container: HTMLElement,
		events: TGCalendarEvent[],
		_options?: ViewRenderOptions,
	): void {
		// Cleanup previous child components
		this.cleanupChildren();

		container.empty();
		container.addClass("view-agenda", "tg-agenda-view");

		// Convert TGCalendarEvent[] to CalendarEvent[] for rendering
		const calendarEvents = this.convertEvents(events);

		// Calculate date range
		const currentDate = this.context.adapter.create(
			this.context.currentDate as unknown as Date,
		);
		const rangeStart = moment(currentDate as unknown as Date).startOf(
			"day",
		);
		const rangeEnd = rangeStart
			.clone()
			.add(this.daysToShow - 1, "days")
			.endOf("day");

		// Filter and sort events
		const agendaEvents = this.filterAndSortEvents(
			calendarEvents,
			rangeStart,
			rangeEnd,
		);

		// Group events by day
		const eventsByDay = this.groupEventsByDay(agendaEvents);

		// Render empty state if no events
		if (Object.keys(eventsByDay).length === 0 && !this.showEmptyDays) {
			this.renderEmptyState(container, rangeStart, rangeEnd);
			return;
		}

		// Render each day
		this.renderDays(container, eventsByDay, rangeStart, rangeEnd);
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
	 * Filter events within the date range and sort by start time
	 */
	protected filterAndSortEvents(
		events: CalendarEvent[],
		rangeStart: moment.Moment,
		rangeEnd: moment.Moment,
	): CalendarEvent[] {
		return events
			.filter((event) => {
				const eventStart = moment(event.start);
				return eventStart.isBetween(
					rangeStart,
					rangeEnd,
					undefined,
					"[]",
				);
			})
			.sort(
				(a, b) => moment(a.start).valueOf() - moment(b.start).valueOf(),
			);
	}

	/**
	 * Group events by their start day
	 */
	protected groupEventsByDay(
		events: CalendarEvent[],
	): Record<string, CalendarEvent[]> {
		const eventsByDay: Record<string, CalendarEvent[]> = {};

		events.forEach((event) => {
			const dateStr = moment(event.start).format("YYYY-MM-DD");
			if (!eventsByDay[dateStr]) {
				eventsByDay[dateStr] = [];
			}
			eventsByDay[dateStr].push(event);
		});

		return eventsByDay;
	}

	/**
	 * Render empty state when no events
	 */
	protected renderEmptyState(
		container: HTMLElement,
		rangeStart: moment.Moment,
		rangeEnd: moment.Moment,
	): void {
		const emptyEl = container.createDiv("agenda-empty-state");
		emptyEl.setText(
			`No upcoming events from ${rangeStart.format(
				"MMM D",
			)} to ${rangeEnd.format("MMM D, YYYY")}.`,
		);
	}

	/**
	 * Render all days in the range
	 */
	protected renderDays(
		container: HTMLElement,
		eventsByDay: Record<string, CalendarEvent[]>,
		rangeStart: moment.Moment,
		rangeEnd: moment.Moment,
	): void {
		const currentDayIter = rangeStart.clone();

		while (currentDayIter.isSameOrBefore(rangeEnd, "day")) {
			const dateStr = currentDayIter.format("YYYY-MM-DD");
			const dayEvents = eventsByDay[dateStr] || [];

			if (dayEvents.length > 0 || this.showEmptyDays) {
				this.renderDaySection(
					container,
					currentDayIter.clone(),
					dayEvents,
				);
			}

			currentDayIter.add(1, "day");
		}
	}

	/**
	 * Render a single day section
	 */
	protected renderDaySection(
		container: HTMLElement,
		date: moment.Moment,
		events: CalendarEvent[],
	): void {
		const daySection = container.createDiv("agenda-day-section");

		// Date column
		const dateColumn = daySection.createDiv("agenda-day-date-column");
		const dayHeader = dateColumn.createDiv("agenda-day-header");
		dayHeader.textContent = date.format(this.dayHeaderFormat);

		if (date.isSame(moment(), "day")) {
			dayHeader.addClass("is-today");
		}

		// Events column
		const eventsColumn = daySection.createDiv("agenda-day-events-column");

		if (events.length === 0) {
			const emptyDay = eventsColumn.createDiv("agenda-empty-day");
			emptyDay.setText("No events");
		} else {
			const eventsList = eventsColumn.createDiv("agenda-events-list");
			this.renderEvents(eventsList, events);
		}
	}

	/**
	 * Render events for a day
	 */
	protected renderEvents(
		container: HTMLElement,
		events: CalendarEvent[],
	): void {
		// Sort events by time
		const sortedEvents = [...events].sort((a, b) => {
			const timeA = a.start ? moment(a.start).valueOf() : 0;
			const timeB = b.start ? moment(b.start).valueOf() : 0;
			return timeA - timeB;
		});

		sortedEvents.forEach((event) => {
			const eventItem = container.createDiv("agenda-event-item");

			if (this.app) {
				const { eventEl, component } = renderCalendarEvent({
					event,
					viewType: "agenda",
					app: this.app,
					onEventClick: this.viewOptions.onEventClick,
					onEventHover: this.viewOptions.onEventHover,
					onEventContextMenu: this.viewOptions.onEventContextMenu,
					onEventComplete: this.viewOptions.onEventComplete,
				});

				// Load the component to trigger onload() which renders the content
				component.load();
				this.childComponents.push(component);
				eventItem.appendChild(eventEl);
			} else {
				// Fallback rendering without app context
				eventItem.textContent = event.title;
				if (event.color) {
					eventItem.style.borderLeftColor = event.color;
				}
			}
		});
	}

	/**
	 * Cleanup child components
	 */
	protected cleanupChildren(): void {
		this.childComponents.forEach((c) => c.unload());
		this.childComponents = [];
	}

	/**
	 * Navigation unit for prev/next buttons
	 */
	override getNavigationUnit(): "week" {
		return "week";
	}

	/**
	 * Header title for this view
	 */
	override getHeaderTitle(): string {
		const currentDate = this.context.adapter.create(
			this.context.currentDate as unknown as Date,
		);
		const start = moment(currentDate as unknown as Date);
		const end = start.clone().add(this.daysToShow - 1, "days");

		if (start.isSame(end, "month")) {
			return `${start.format("MMM D")} - ${end.format("D, YYYY")}`;
		}
		return `${start.format("MMM D")} - ${end.format("MMM D, YYYY")}`;
	}

	/**
	 * Cleanup when view is unmounted
	 */
	override onUnmount(): void {
		this.cleanupChildren();
		super.onUnmount();
	}
}
