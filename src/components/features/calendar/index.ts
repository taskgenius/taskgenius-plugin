/**
 * CalendarComponent - Enhanced calendar view using @taskgenius/calendar
 *
 * This component integrates @taskgenius/calendar for month/week/day views
 * while preserving the original year/agenda views for compatibility.
 *
 * Features:
 * - Month/Week/Day views powered by @taskgenius/calendar
 * - Agenda/Year views using original implementation
 * - Multi-day spanning tasks
 * - Drag-and-drop date adjustment
 * - ICS integration with badge events
 * - Obsidian theme integration
 */

import {
	App,
	ButtonComponent,
	Component,
	DropdownComponent,
	moment,
	Notice,
	setIcon,
} from "obsidian";
import {
	Calendar,
	type DateAdapter,
	DateFnsAdapter,
	hideWeekends,
	workingHours,
	onlyDays,
	hideDays,
	ViewRegistry,
} from "@taskgenius/calendar";
import type {
	CalendarConfig,
	CalendarEvent as TGCalendarEvent,
	DayFilterContext,
	TimeSlotConfig,
	ViewClass,
	ExtendedCalendarConfig,
	EventRenderContext,
} from "@taskgenius/calendar";
import * as dateFns from "date-fns";
import { addDays, startOfDay, differenceInDays, isBefore } from "date-fns";
import { Task } from "@/types/task";
import { IcsTask } from "@/types/ics";
import {
	tasksToCalendarEvents,
	getTaskFromEvent,
	hasDateInformation,
	type CalendarEvent as AdapterCalendarEvent,
} from "@/utils/adapters/TaskCalendarAdapter";
import "@taskgenius/calendar/styles.css";
import "@/styles/taskgenius-calendar.scss";
import "@/styles/calendar/view.scss";
import "@/styles/calendar/event.scss";
import "@/styles/calendar/badge.scss";
import { t } from "@/translations/helper";

// Import new TG-based view implementations
import { TGAgendaView } from "./views/tg-agenda-view";
import { TGYearView } from "./views/tg-year-view";
import TaskProgressBarPlugin from "@/index";
import { QuickCaptureModal } from "@/components/features/quick-capture/modals/QuickCaptureModalWithSwitch";
import {
	CalendarSpecificConfig,
	CustomCalendarViewConfig,
} from "@/common/setting-definition";
import { createTaskCheckbox } from "@/components/features/task/view/details";

// View modes - now includes custom view IDs
type BuiltinCalendarViewMode = "year" | "month" | "week" | "day" | "agenda";
type CalendarViewMode = BuiltinCalendarViewMode | string;

// Legacy CalendarEvent interface (extends Task)
export interface CalendarEvent extends Task {
	title: string;
	start: Date;
	end?: Date;
	allDay: boolean;
	color?: string;
	badge?: boolean;
}

/**
 * Main CalendarComponent class
 */
export class CalendarComponent extends Component {
	public containerEl: HTMLElement;
	private tasks: Task[] = [];
	private events: CalendarEvent[] = [];
	private externalTextEvents: AdapterCalendarEvent[] = [];
	private currentViewMode: CalendarViewMode = "month";
	private currentDate: moment.Moment = moment();

	private headerEl: HTMLElement;
	private viewContainerEl: HTMLElement;

	private app: App;
	private plugin: TaskProgressBarPlugin;

	// @taskgenius/calendar instance (for all views including agenda/year)
	private tgCalendar: Calendar | null = null;

	// View registry for custom views (agenda, year, and user-defined)
	private viewRegistry: ViewRegistry = new ViewRegistry();

	// Badge events cache
	private badgeEventsCache: Map<string, CalendarEvent[]> = new Map();

	// Config override from Bases
	private configOverride: Partial<CalendarSpecificConfig> | null = null;

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		parentEl: HTMLElement,
		initialTasks: Task[] = [],
		private params: {
			onTaskSelected?: (task: Task | null) => void;
			onTaskCompleted?: (task: Task) => void;
			onEventContextMenu?: (ev: MouseEvent, event: CalendarEvent) => void;
			onViewModeChange?: (viewMode: CalendarViewMode) => void;
			persistViewMode?: boolean;
			viewModeStorageKey?: string;
		} = {},
		private viewId: string = "calendar",
	) {
		super();
		this.app = app;
		this.plugin = plugin;
		this.containerEl = parentEl.createDiv("full-calendar-container");
		this.tasks = initialTasks;

		this.headerEl = this.containerEl.createDiv("calendar-header");
		this.viewContainerEl = this.containerEl.createDiv(
			"calendar-view-container",
		);

		this.loadSavedViewMode();

		// Initialize view registry with custom views (agenda, year)
		this.initializeViewRegistry();
	}

	private shouldPersistViewMode(): boolean {
		return this.params.persistViewMode ?? true;
	}

	private getViewModeStorageKey(): string {
		return (
			this.params.viewModeStorageKey ??
			`task-genius:calendar-view:${this.viewId}`
		);
	}

	private loadSavedViewMode(): void {
		if (!this.shouldPersistViewMode()) {
			return;
		}

		const storageKey = this.getViewModeStorageKey();
		const savedView =
			this.app.loadLocalStorage(storageKey) ??
			(this.viewId === "calendar"
				? this.app.loadLocalStorage("task-genius:calendar-view")
				: null);

		if (savedView) {
			this.currentViewMode = savedView as CalendarViewMode;

			if (
				this.viewId === "calendar" &&
				storageKey !== "task-genius:calendar-view"
			) {
				this.app.saveLocalStorage(storageKey, savedView);
			}
		}
	}

	/**
	 * Initialize the view registry with custom views (Agenda, Year)
	 * These views extend @taskgenius/calendar's BaseView for integration
	 */
	private initializeViewRegistry(): void {
		// Register TGAgendaView
		this.viewRegistry.register(TGAgendaView as unknown as ViewClass);

		// Register TGYearView
		this.viewRegistry.register(TGYearView as unknown as ViewClass);
	}

	override onload() {
		super.onload();
		this.processTasks();
		this.render();
		this.registerExternalTextDropHandlers();
		this.registerTimeSlotQuickCaptureHandler();

		// Listen for calendar views configuration changes
		this.registerEvent(
			this.app.workspace.on(
				// @ts-ignore - custom event
				"task-genius:calendar-views-changed",
				() => {
					this.handleCalendarViewsChanged();
				},
			),
		);
	}

	/**
	 * Handle calendar views configuration changes (add/remove/edit/reorder)
	 */
	private handleCalendarViewsChanged() {
		// If currently viewing a custom view that's no longer valid, switch to month
		if (this.isCustomView(this.currentViewMode)) {
			const customConfig = this.getCustomViewConfig(this.currentViewMode);
			const hiddenCalendarViews =
				this.plugin.workspaceManager?.getActiveWorkspace()?.settings
					?.hiddenModules?.calendarViews || [];

			if (
				!customConfig ||
				!customConfig.enabled ||
				hiddenCalendarViews.includes(this.currentViewMode)
			) {
				this.currentViewMode = "month";
				this.saveCurrentViewMode();
			}
		}

		// Re-render to update the view switcher and current view
		this.render();
	}

	override onunload() {
		super.onunload();

		// Clean up @taskgenius/calendar
		if (this.tgCalendar) {
			this.tgCalendar.destroy();
			this.tgCalendar = null;
		}

		this.containerEl.empty();
	}

	// ============================================
	//  Public API
	// ============================================

	public updateTasks(newTasks: Task[]) {
		this.tasks = newTasks;
		this.badgeEventsCache.clear();
		this.processTasks();
		if (this.tgCalendar) {
			this.tgCalendar.setEvents(this.convertTasksToTGEvents());
			return;
		}
		this.renderCurrentView();
	}

	public setView(viewMode: CalendarViewMode) {
		if (this.currentViewMode !== viewMode) {
			this.currentViewMode = viewMode;
			this.saveCurrentViewMode();
			this.render();
		}
	}

	/**
	 * Save the current view mode to localStorage
	 */
	private saveCurrentViewMode() {
		this.params.onViewModeChange?.(this.currentViewMode);
		if (!this.shouldPersistViewMode()) {
			return;
		}

		const storageKey = this.getViewModeStorageKey();
		this.app.saveLocalStorage(storageKey, this.currentViewMode);

		if (
			this.viewId === "calendar" &&
			storageKey !== "task-genius:calendar-view"
		) {
			this.app.saveLocalStorage(
				"task-genius:calendar-view",
				this.currentViewMode,
			);
		}
	}

	public navigate(direction: "prev" | "next") {
		const unit = this.getViewUnit();
		if (direction === "prev") {
			this.currentDate.subtract(1, unit);
		} else {
			this.currentDate.add(1, unit);
		}

		// Update @taskgenius/calendar or re-render original views
		if (this.tgCalendar) {
			if (direction === "prev") {
				this.tgCalendar.prev();
			} else {
				this.tgCalendar.next();
			}
		} else {
			this.render();
		}
	}

	public goToToday() {
		this.currentDate = moment();

		if (this.tgCalendar) {
			this.tgCalendar.today();
		} else {
			this.render();
		}
	}

	public setTasks(tasks: Task[]) {
		this.updateTasks(tasks);
	}

	public setConfigOverride(override: Partial<CalendarSpecificConfig> | null) {
		this.configOverride = override ?? null;
		this.render();
	}

	public getBadgeEventsForDate(date: Date): CalendarEvent[] {
		const dateKey = this.formatDateKey(date);

		if (this.badgeEventsCache.has(dateKey)) {
			return this.badgeEventsCache.get(dateKey) || [];
		}

		const badgeEvents: CalendarEvent[] = [];
		this.tasks.forEach((task) => {
			const isIcsTask = (task as any).source?.type === "ics";
			const icsTask = isIcsTask ? (task as IcsTask) : null;
			const showAsBadge = icsTask?.icsEvent?.source?.showType === "badge";

			if (isIcsTask && showAsBadge && icsTask?.icsEvent) {
				const eventDate = new Date(icsTask.icsEvent.dtstart);
				if (this.isSameDay(eventDate, date)) {
					badgeEvents.push({
						...task,
						title: task.content,
						start: icsTask.icsEvent.dtstart,
						end: icsTask.icsEvent.dtend,
						allDay: icsTask.icsEvent.allDay,
						color: icsTask.icsEvent.source.color,
						badge: true,
					});
				}
			}
		});

		this.badgeEventsCache.set(dateKey, badgeEvents);
		return badgeEvents;
	}

	// ============================================
	//  Rendering
	// ============================================

	private render() {
		this.renderHeader();
		this.renderCurrentView();
	}

	private renderHeader() {
		this.headerEl.empty();

		// Navigation
		const navGroup = this.headerEl.createDiv("calendar-nav");

		const prevBtn = new ButtonComponent(navGroup.createDiv());
		prevBtn.buttonEl.addClass("calendar-nav-button", "prev-button");
		prevBtn.setIcon("chevron-left");
		prevBtn.onClick(() => this.navigate("prev"));

		const todayBtn = new ButtonComponent(navGroup.createDiv());
		todayBtn.buttonEl.addClass("calendar-nav-button", "today-button");
		todayBtn.setButtonText(t("Today"));
		todayBtn.onClick(() => this.goToToday());

		const nextBtn = new ButtonComponent(navGroup.createDiv());
		nextBtn.buttonEl.addClass("calendar-nav-button", "next-button");
		nextBtn.setIcon("chevron-right");
		nextBtn.onClick(() => this.navigate("next"));

		// Date display
		const dateDisplay = this.headerEl.createSpan("calendar-current-date");
		dateDisplay.textContent = this.getCurrentDateDisplay();

		// View switcher - segmented control style
		const viewGroup = this.headerEl.createDiv("calendar-view-switcher");

		// Built-in modes with short labels (first letter or abbreviated)
		const builtinModes: {
			id: BuiltinCalendarViewMode;
			label: string;
			shortLabel: string;
			title: string;
		}[] = [
			{ id: "year", label: t("Year"), shortLabel: "Y", title: t("Year") },
			{
				id: "month",
				label: t("Month"),
				shortLabel: "M",
				title: t("Month"),
			},
			{ id: "week", label: t("Week"), shortLabel: "W", title: t("Week") },
			{ id: "day", label: t("Day"), shortLabel: "D", title: t("Day") },
			{
				id: "agenda",
				label: t("Agenda"),
				shortLabel: "A",
				title: t("Agenda"),
			},
		];

		// Get enabled custom views
		const customViews = this.getEnabledCustomViews();

		// Segmented control container (for wide screens)
		const segmentedControl = viewGroup.createDiv(
			"calendar-segmented-control",
		);

		// Track the active button for initial indicator positioning
		let activeButton: HTMLElement | null = null;

		// Render built-in view buttons
		builtinModes.forEach((mode, index) => {
			const btn = segmentedControl.createEl("button", {
				cls: "calendar-segment-btn",
				attr: { "aria-label": mode.title, "data-view": mode.id },
			});

			// Short label (single letter)
			btn.createSpan({
				cls: "calendar-segment-short",
				text: mode.shortLabel,
			});

			// Full label (for hover/wider screens)
			btn.createSpan({
				cls: "calendar-segment-full",
				text: mode.label,
			});

			if (mode.id === this.currentViewMode) {
				btn.addClass("is-active");
				activeButton = btn;
			}

			btn.onclick = () => {
				this.setView(mode.id);
			};
		});

		// Render custom view buttons (if any)
		if (customViews.length > 0) {
			segmentedControl.createDiv("calendar-segment-separator");

			customViews.forEach((customView) => {
				const btn = segmentedControl.createEl("button", {
					cls: "calendar-segment-btn calendar-segment-custom",
					attr: {
						"data-view": customView.id,
						"aria-label": customView.name,
					},
				});

				// Icon for custom view
				const iconEl = btn.createSpan({
					cls: "calendar-segment-icon",
				});
				setIcon(iconEl, customView.icon);

				// Short label (first letter of name)
				btn.createSpan({
					cls: "calendar-segment-short",
					text: customView.name.charAt(0).toUpperCase(),
				});

				if (customView.id === this.currentViewMode) {
					btn.addClass("is-active");
					activeButton = btn;
				}

				btn.onclick = () => {
					this.setView(customView.id);
				};
			});
		}

		// Dropdown selector (for narrow screens)
		viewGroup.createEl(
			"div",
			{ cls: "calendar-view-switcher-selector" },
			(el) => {
				const dropdown = new DropdownComponent(el);

				// Add built-in options
				builtinModes.forEach((mode) => {
					dropdown.addOption(mode.id, mode.label);
				});

				// Add custom view options
				if (customViews.length > 0) {
					customViews.forEach((customView) => {
						dropdown.addOption(
							customView.id,
							`⬧ ${customView.name}`,
						);
					});
				}

				dropdown
					.onChange((value) =>
						this.setView(value as CalendarViewMode),
					)
					.setValue(this.currentViewMode);
			},
		);
	}

	/**
	 * Update the position of the active indicator in the segmented control
	 */
	private updateActiveIndicator(
		container: HTMLElement,
		indicator: HTMLElement,
		activeBtn: HTMLElement,
	) {
		const containerRect = container.getBoundingClientRect();
		const btnRect = activeBtn.getBoundingClientRect();

		indicator.style.width = `${btnRect.width}px`;
		indicator.style.transform = `translateX(${btnRect.left - containerRect.left}px)`;
	}

	/**
	 * Get all enabled custom calendar views (respecting workspace visibility)
	 */
	private getEnabledCustomViews(): CustomCalendarViewConfig[] {
		const customViews = this.plugin.settings.customCalendarViews || [];

		// Get hidden calendar views from active workspace
		const hiddenCalendarViews =
			this.plugin.workspaceManager?.getActiveWorkspace()?.settings
				?.hiddenModules?.calendarViews || [];

		return customViews
			.filter((v) => v.enabled && !hiddenCalendarViews.includes(v.id))
			.sort((a, b) => a.order - b.order);
	}

	/**
	 * Get a custom view configuration by ID
	 */
	private getCustomViewConfig(
		viewId: string,
	): CustomCalendarViewConfig | null {
		const customViews = this.plugin.settings.customCalendarViews || [];
		return customViews.find((v) => v.id === viewId) || null;
	}

	/**
	 * Check if a view mode is a custom view
	 */
	private isCustomView(viewMode: CalendarViewMode): boolean {
		return !["year", "month", "week", "day", "agenda"].includes(viewMode);
	}

	private isTimeGridView(viewMode: CalendarViewMode = this.currentViewMode): boolean {
		if (viewMode === "week" || viewMode === "day") {
			return true;
		}
		if (!this.isCustomView(viewMode)) {
			return false;
		}
		const customConfig = this.getCustomViewConfig(viewMode);
		return (
			customConfig?.baseViewType === "week" ||
			customConfig?.baseViewType === "day"
		);
	}

	private captureTimeGridScroll():
		| {
				scrollTop: number;
				scrollLeft: number;
		  }
		| null {
		if (!this.isTimeGridView()) return null;
		const container = this.viewContainerEl.querySelector<HTMLElement>(
			".tg-time-grid-container",
		);
		if (!container) return null;
		return {
			scrollTop: container.scrollTop,
			scrollLeft: container.scrollLeft,
		};
	}

	private restoreTimeGridScroll(
		scrollState:
			| {
					scrollTop: number;
					scrollLeft: number;
			  }
			| null,
	): void {
		if (!scrollState || !this.isTimeGridView()) return;

		const restore = () => {
			const container = this.viewContainerEl.querySelector<HTMLElement>(
				".tg-time-grid-container",
			);
			if (!container) return;
			container.scrollTop = scrollState.scrollTop;
			container.scrollLeft = scrollState.scrollLeft;
		};

		// The calendar library may adjust scroll asynchronously after mount,
		// so retry a few times to keep the user's position stable.
		setTimeout(restore, 0);
		setTimeout(restore, 16);
		setTimeout(restore, 80);
		setTimeout(restore, 180);
	}

	private getActiveTimeRangeForCurrentView():
		| {
				startHour: number;
				endHour: number;
		  }
		| null {
		if (!this.isTimeGridView()) return null;

		if (this.isCustomView(this.currentViewMode)) {
			const customConfig = this.getCustomViewConfig(this.currentViewMode);
			const timeFilter = customConfig?.calendarConfig?.timeFilter;
			if (
				timeFilter?.enabled &&
				(customConfig?.baseViewType === "week" ||
					customConfig?.baseViewType === "day")
			) {
				const startHour =
					timeFilter.type === "workingHours"
						? 9
						: timeFilter.startHour;
				const endHour =
					timeFilter.type === "workingHours"
						? 18
						: timeFilter.endHour;
				if (endHour > startHour) {
					return { startHour, endHour };
				}
			}
			return null;
		}

		const config = this.getEffectiveCalendarConfig();
		if (config.showWorkingHoursOnly) {
			const startHour = config.workingHoursStart ?? 9;
			const endHour = config.workingHoursEnd ?? 18;
			if (endHour > startHour) {
				return { startHour, endHour };
			}
		}

		return null;
	}

	private resolveDateTimeFromDayColumnPosition(
		dayColumn: HTMLElement,
		clientY: number,
	): Date | null {
		const dateIso = dayColumn.dataset.date;
		if (!dateIso) return null;

		const rect = dayColumn.getBoundingClientRect();
		const relY = clientY - rect.top;

		// Keep in sync with TGCalendar config (theme.cellHeight / draggable.snapMinutes)
		const cellHeightPx = 60;
		const snapMinutes = 15;
		const timeRange = this.getActiveTimeRangeForCurrentView();
		const startHour = timeRange?.startHour ?? 0;
		const endHour = timeRange?.endHour ?? 24;
		const visibleMinutes = Math.max(0, (endHour - startHour) * 60);
		if (visibleMinutes <= 0) return null;

		const rawMinutes = (relY / cellHeightPx) * 60;
		const maxSnappedMinutes = Math.max(0, visibleMinutes - snapMinutes);
		const snappedMinutes = Math.max(
			0,
			Math.min(
				maxSnappedMinutes,
				Math.round(rawMinutes / snapMinutes) * snapMinutes,
			),
		);
		const absoluteMinutes = startHour * 60 + snappedMinutes;

		const baseDate = dateFns.parseISO(dateIso);
		return dateFns.setMinutes(
			dateFns.setHours(baseDate, Math.floor(absoluteMinutes / 60)),
			absoluteMinutes % 60,
		);
	}

	private adjustTimedEventPositionForActiveTimeRange(
		event: AdapterCalendarEvent,
		el: HTMLElement,
	): void {
		const timeRange = this.getActiveTimeRangeForCurrentView();
		if (!timeRange) return;
		if (event.allDay) return;

		const startValue = event.start as unknown;
		const startDate =
			startValue instanceof Date
				? startValue
				: new Date(startValue as string | number);
		if (Number.isNaN(startDate.getTime())) return;

		const startMinutes =
			startDate.getHours() * 60 + startDate.getMinutes();
		const relativeMinutes = startMinutes - timeRange.startHour * 60;

		// Event starts outside visible range, let the library decide whether to show/hide.
		if (relativeMinutes < 0) return;

		const cellHeightPx = 60;
		const expectedTop = (relativeMinutes / 60) * cellHeightPx;
		const transform = el.style.transform || "";
		const translateMatch = transform.match(
			/translate\(\s*([-\d.]+)%\s*,\s*([-\d.]+)px\s*\)/,
		);
		const currentLeftPercent = translateMatch
			? parseFloat(translateMatch[1] ?? "0")
			: 0;
		const currentTop = translateMatch
			? parseFloat(translateMatch[2] ?? "NaN")
			: Number.NaN;

		if (
			!Number.isFinite(currentTop) ||
			Math.abs(currentTop - expectedTop) > 1
		) {
			el.style.transform = `translate(${currentLeftPercent}%, ${expectedTop}px)`;
		}
	}

	private refreshCalendarEventsPreservingView(): void {
		if (!this.tgCalendar) {
			this.renderCurrentView();
			return;
		}

		this.badgeEventsCache.clear();
		this.processTasks();
		this.tgCalendar.setEvents(this.convertTasksToTGEvents());
	}

	private updateLocalTaskState(
		taskId: string,
		updater: (task: Task) => Task,
	): void {
		const index = this.tasks.findIndex((t) => t.id === taskId);
		if (index === -1) return;
		const current = this.tasks[index];
		if (!current) return;
		this.tasks[index] = updater(current);
	}

	private renderCurrentView() {
		const timeGridScrollState = this.captureTimeGridScroll();
		this.viewContainerEl.empty();

		// Clean up previous views
		if (this.tgCalendar) {
			this.tgCalendar.destroy();
			this.tgCalendar = null;
		}

		// Update view class
		this.viewContainerEl.removeClass(
			"view-year",
			"view-month",
			"view-week",
			"view-day",
			"view-agenda",
		);
		this.viewContainerEl.addClass(`view-${this.currentViewMode}`);

		// Render view - all views now go through unified TGCalendar
		switch (this.currentViewMode) {
			case "month":
			case "week":
			case "day":
			case "agenda":
			case "year":
				this.renderTGCalendarView();
				break;
			default:
				// Check if it's a custom view
				if (this.isCustomView(this.currentViewMode)) {
					this.renderCustomCalendarView(this.currentViewMode);
				}
				break;
		}

		this.restoreTimeGridScroll(timeGridScrollState);
	}

	/**
	 * Render a custom calendar view based on its configuration
	 */
	private renderCustomCalendarView(viewId: string) {
		const customConfig = this.getCustomViewConfig(viewId);
		if (!customConfig) {
			// Fallback to month view if custom view not found
			this.currentViewMode = "month";
			this.saveCurrentViewMode();
			this.renderTGCalendarView();
			return;
		}

		// Check if the view is enabled and not hidden in workspace
		if (!customConfig.enabled) {
			// View is disabled, fallback to month view
			this.currentViewMode = "month";
			this.saveCurrentViewMode();
			this.renderTGCalendarView();
			return;
		}

		// Check workspace hidden modules
		const hiddenCalendarViews =
			this.plugin.workspaceManager?.getActiveWorkspace()?.settings
				?.hiddenModules?.calendarViews || [];
		if (hiddenCalendarViews.includes(viewId)) {
			// View is hidden in this workspace, fallback to month view
			this.currentViewMode = "month";
			this.saveCurrentViewMode();
			this.renderTGCalendarView();
			return;
		}

		// Check if it's based on agenda or year view
		const isAgendaOrYearBased =
			customConfig.baseViewType === "agenda" ||
			customConfig.baseViewType === "year";

		// Build the calendar config from custom view settings
		const calendarConfig = this.buildCustomViewCalendarConfig(customConfig);

		this.tgCalendar = new Calendar(this.viewContainerEl, calendarConfig);

		// For agenda/year based views, switch to that view after creation
		if (isAgendaOrYearBased) {
			this.tgCalendar.setView(customConfig.baseViewType);

			// Set plugin context and options on the active view
			const customView = this.tgCalendar.getActiveView();
			if (customView) {
				if ("setPluginContext" in customView) {
					(customView as any).setPluginContext(this.plugin, this.app);
				}
				if ("setOptions" in customView) {
					const cc = customConfig.calendarConfig;
					if (customConfig.baseViewType === "agenda") {
						(customView as any).setOptions({
							daysToShow: (cc as any).daysToShow ?? 7,
							showEmptyDays: (cc as any).showEmptyDays ?? false,
							onEventClick: this.onEventClick,
							onEventHover: this.onEventHover,
							onEventContextMenu: this.onEventContextMenu,
							onEventComplete: this.onEventComplete,
						});
					}
					if (customConfig.baseViewType === "year") {
						(customView as any).setOptions({
							firstDayOfWeek: cc.firstDayOfWeek,
							hideWeekends: cc.dayFilter?.type === "hideWeekends",
							onDayClick: this.onDayClick,
							onDayHover: this.onDayHover,
							onMonthClick: this.onMonthClick,
							onMonthHover: this.onMonthHover,
						});
					}
				}
			}

			// Trigger re-render to apply the options
			this.tgCalendar.refresh();
		}

		// Sync current date
		this.tgCalendar.goToDate(this.currentDate.toDate());
	}

	/**
	 * Build CalendarConfig from a CustomCalendarViewConfig
	 */
	private buildCustomViewCalendarConfig(
		customConfig: CustomCalendarViewConfig,
	): CalendarConfig {
		const cc = customConfig.calendarConfig;

		// Build dayFilter based on config
		// The filter functions return DayFilterResult which is accepted by the view config
		let dayFilter: ReturnType<typeof hideWeekends> | undefined;
		if (cc.dayFilter) {
			switch (cc.dayFilter.type) {
				case "hideWeekends":
					dayFilter = hideWeekends();
					break;
				case "hideWeekdays":
					// hideWeekdays = only show weekends (hide Mon-Fri)
					dayFilter = hideDays([1, 2, 3, 4, 5]);
					break;
				case "customDays":
					if (
						cc.dayFilter.hiddenDays &&
						cc.dayFilter.hiddenDays.length > 0
					) {
						dayFilter = hideDays(cc.dayFilter.hiddenDays);
					}
					break;
			}
		}

		// Build timeFilter based on config (only for week/day views)
		// The filter functions return TimeFilterResult which is accepted by the view config
		let timeFilter: ReturnType<typeof workingHours> | undefined;
		if (
			cc.timeFilter?.enabled &&
			(customConfig.baseViewType === "week" ||
				customConfig.baseViewType === "day")
		) {
			if (cc.timeFilter.type === "workingHours") {
				timeFilter = workingHours(9, 18);
			} else {
				timeFilter = workingHours(
					cc.timeFilter.startHour,
					cc.timeFilter.endHour,
				);
			}
		}

		// For agenda/year views, use month as the initial view type
		// (the actual view switch happens in renderCustomCalendarView)
		const isAgendaOrYear =
			customConfig.baseViewType === "agenda" ||
			customConfig.baseViewType === "year";
		const viewType = isAgendaOrYear
			? "month"
			: (customConfig.baseViewType as "month" | "week" | "day");

		const calendarConfig: ExtendedCalendarConfig = {
			view: {
				type: viewType,
				showWeekNumbers: cc.showWeekNumbers ?? false,
				showDateHeader: true,
				firstDayOfWeek: this.getEffectiveFirstDayOfWeek(customConfig),
				dayFilter,
				timeFilter,
			},
			// Use custom view registry for agenda/year views
			viewRegistry: isAgendaOrYear ? this.viewRegistry : undefined,
			dateAdapter: new DateFnsAdapter(dateFns),
			events: this.convertTasksToTGEvents(),
			showEventCounts: cc.showEventCounts ?? true,
			dateFormats: {
				date: "yyyy-MM-dd",
				dateTime: "yyyy-MM-dd HH:mm",
				time: "HH:mm",
				monthHeader: cc.dateFormats?.monthHeader ?? "yyyy M",
				dayHeader: cc.dateFormats?.dayHeader ?? "yyyy M d",
			},
			draggable: {
				enabled: true,
				snapMinutes: 15, // 15-minute snap for range selection support
				ghostOpacity: 0.5,
			},
			theme: {
				primaryColor: "var(--interactive-accent)",
				cellHeight: 60,
				fontSize: {
					header: "var(--font-ui-small)",
					event: "var(--font-ui-smaller)",
				},
			},
			// Event interactions
			onEventClick: (event: any) => this.handleTGEventClick(event),
			onEventContextMenu: (event: any, x: number, y: number) =>
				this.handleTGEventContextMenu(event, x, y),
			onEventDrop: (event: any, newStart: any, newEnd: any) =>
				this.handleTGEventDrop(event, newStart, newEnd),
			onEventResize: (event: any, newStart: any, newEnd: any) =>
				this.handleTGEventResize(event, newStart, newEnd),
			onDateClick: (date: Date) => this.handleDateClick(date),
			onDateDoubleClick: (date: Date) => this.handleDateDoubleClick(date),
			onDateContextMenu: (date: Date, x: number, y: number) =>
				this.handleDateContextMenu(date, x, y),
			onTimeSlotClick: (dateTime: Date) =>
				this.handleTimeSlotClick(dateTime),
			// Range selection (drag to select multiple cells)
			onDateRangeSelect: (startDate: Date, endDate: Date) =>
				this.handleDateRangeSelect(startDate, endDate),
			onTimeRangeSelect: (startDateTime: Date, endDateTime: Date) =>
				this.handleTimeRangeSelect(startDateTime, endDateTime),
			onRenderDateCell: (ctx: any) => this.handleTGRenderDateCell(ctx),
			// Custom event rendering - adds checkbox for task completion
			onRenderEvent: (ctx: EventRenderContext) =>
				this.handleTGRenderEvent(ctx),
		};

		// Add maxEventsPerRow for month view
		if (customConfig.baseViewType === "month" && cc.maxEventsPerRow) {
			(calendarConfig as any).maxEventsPerRow = cc.maxEventsPerRow;
		}

		return calendarConfig;
	}

	private renderTGCalendarView() {
		const config = this.getEffectiveCalendarConfig();

		// Determine view type - for agenda/year, use month as base but switch to custom view
		const isCustomTGView =
			this.currentViewMode === "agenda" ||
			this.currentViewMode === "year";
		const baseViewType = isCustomTGView
			? "month"
			: (this.currentViewMode as "month" | "week" | "day");

		const calendarConfig: ExtendedCalendarConfig = {
			view: {
				type: baseViewType,
				showWeekNumbers: false,
				showDateHeader: true,
				firstDayOfWeek: this.getEffectiveFirstDayOfWeek(),
				// Use new dayFilter API (v0.6.0+) - must be inside view config
				dayFilter: config.hideWeekends ? hideWeekends() : undefined,
				// Add timeFilter for working hours (week/day view only)
				timeFilter:
					config.showWorkingHoursOnly &&
					(this.currentViewMode === "week" ||
						this.currentViewMode === "day")
						? workingHours(
								config.workingHoursStart ?? 9,
								config.workingHoursEnd ?? 18,
							)
						: undefined,
			},
			dateAdapter: new DateFnsAdapter(dateFns),
			events: this.convertTasksToTGEvents(),
			showEventCounts: true,
			dateFormats: {
				date: "yyyy-MM-dd",
				dateTime: "yyyy-MM-dd HH:mm",
				time: "HH:mm",
				monthHeader: "yyyy M",
				dayHeader: "yyyy M d",
			},
			draggable: {
				enabled: true,
				snapMinutes: 15, // 15-minute snap for range selection support
				ghostOpacity: 0.5,
			},
			theme: {
				primaryColor: "var(--interactive-accent)",
				cellHeight: 60,
				fontSize: {
					header: "var(--font-ui-small)",
					event: "var(--font-ui-smaller)",
				},
			},
			// Use custom view registry for agenda/year views
			viewRegistry: this.viewRegistry,
			// Event interactions - use arrow functions for safe binding
			onEventClick: (event: any) => this.handleTGEventClick(event),
			onEventContextMenu: (event: any, x: number, y: number) =>
				this.handleTGEventContextMenu(event, x, y),
			onEventDrop: (event: any, newStart: any, newEnd: any) =>
				this.handleTGEventDrop(event, newStart, newEnd),
			onEventResize: (event: any, newStart: any, newEnd: any) =>
				this.handleTGEventResize(event, newStart, newEnd),
			// Date interactions (v0.6.0+) - match library's callback signatures
			onDateClick: (date: Date) => this.handleDateClick(date),
			onDateDoubleClick: (date: Date) => this.handleDateDoubleClick(date),
			onDateContextMenu: (date: Date, x: number, y: number) =>
				this.handleDateContextMenu(date, x, y),
			// Time slot interactions (week/day views, v0.6.0+)
			onTimeSlotClick: (dateTime: Date) =>
				this.handleTimeSlotClick(dateTime),
			// Range selection (drag to select multiple cells)
			onDateRangeSelect: (startDate: Date, endDate: Date) =>
				this.handleDateRangeSelect(startDate, endDate),
			onTimeRangeSelect: (startDateTime: Date, endDateTime: Date) =>
				this.handleTimeRangeSelect(startDateTime, endDateTime),
			// Custom cell rendering
			onRenderDateCell: (ctx: any) => this.handleTGRenderDateCell(ctx),
			// Custom event rendering - adds checkbox for task completion
			onRenderEvent: (ctx: EventRenderContext) =>
				this.handleTGRenderEvent(ctx),
		};

		this.tgCalendar = new Calendar(this.viewContainerEl, calendarConfig);

		// For custom TG views (agenda/year), switch to that view after creation
		if (isCustomTGView) {
			// Set plugin context for custom views
			const activeView = this.tgCalendar.getActiveView();
			if (activeView) {
				// The view will be switched, so we need to set context after switching
			}

			this.tgCalendar.setView(this.currentViewMode);

			// Now set plugin context on the active view
			const customView = this.tgCalendar.getActiveView();
			if (customView) {
				if ("setPluginContext" in customView) {
					(customView as any).setPluginContext(this.plugin, this.app);
				}
				if ("setOptions" in customView) {
					// Set options for agenda view
					if (this.currentViewMode === "agenda") {
						(customView as any).setOptions({
							onEventClick: this.onEventClick,
							onEventHover: this.onEventHover,
							onEventContextMenu: this.onEventContextMenu,
							onEventComplete: this.onEventComplete,
						});
					}
					// Set options for year view
					if (this.currentViewMode === "year") {
						(customView as any).setOptions({
							firstDayOfWeek: config.firstDayOfWeek,
							hideWeekends: config.hideWeekends,
							onDayClick: this.onDayClick,
							onDayHover: this.onDayHover,
							onMonthClick: this.onMonthClick,
							onMonthHover: this.onMonthHover,
						});
						if ("setOverrideConfig" in customView) {
							(customView as any).setOverrideConfig(config);
						}
					}
				}
			}

			// Trigger re-render to apply the options
			this.tgCalendar.refresh();
		}

		// Sync current date
		this.tgCalendar.goToDate(this.currentDate.toDate());
	}

	// ============================================
	//  Event Handlers
	// ============================================

	private handleTGEventClick(event: AdapterCalendarEvent) {
		let task = getTaskFromEvent(event as any);

		// Fallback: try to find task by ID if metadata is missing
		// This fixes issues where the event object is reconstructed/cloned by the library
		if (!task && event.id) {
			task = this.tasks.find((t) => t.id === event.id) || null;
		}

		if (task) {
			this.params?.onTaskSelected?.(task);
		}
	}

	/**
	 * Handle custom event rendering - adds checkbox for task completion
	 * Uses the onRenderEvent hook from @taskgenius/calendar v0.6.0+
	 * Based on CalendarEventComponent implementation in event-renderer.ts
	 */
	private handleTGRenderEvent(ctx: EventRenderContext) {
		// First render the default content
		ctx.defaultRender();

		const { event, el } = ctx;
		this.adjustTimedEventPositionForActiveTimeRange(event, el);

		// Backup click handler to ensure selection always works
		// This guards against cases where the library's click handler fails
		if (!el.hasAttribute("data-click-handler")) {
			el.setAttribute("data-click-handler", "true");
			this.registerDomEvent(el, "click", (ev) => {
				// Ignore clicks on the checkbox (it handles its own logic)
				if (
					(ev.target as HTMLElement).closest(
						".task-list-item-checkbox",
					)
				) {
					return;
				}
				this.handleTGEventClick(event);
			});
		}

		// Skip if checkbox already added
		if (el.querySelector(".task-list-item-checkbox")) {
			return;
		}

		// Find the corresponding task
		const task = getTaskFromEvent(event as any);
		if (!task) return;

		// Create checkbox using the shared utility function
		// This ensures consistent styling with other calendar views
		const checkbox = createTaskCheckbox(task.status || " ", task, el);

		// Move checkbox to the beginning of the event element
		if (el.firstChild && el.firstChild !== checkbox) {
			el.insertBefore(checkbox, el.firstChild);
		}

		// Handle checkbox click - same pattern as CalendarEventComponent
		this.registerDomEvent(checkbox, "click", async (ev) => {
			ev.stopPropagation();

			// Toggle task status
			const newStatus = task.completed ? " " : "x";

			if (this.plugin.writeAPI) {
				const result = await this.plugin.writeAPI.updateTaskStatus({
					taskId: task.id,
					status: newStatus,
					completed: !task.completed,
				});

				if (result.success) {
					// Update UI immediately
					checkbox.checked = !task.completed;
					checkbox.dataset.task = newStatus;
					this.updateLocalTaskState(task.id, (currentTask) => ({
						...currentTask,
						completed: !currentTask.completed,
						status: newStatus,
						metadata: {
							...currentTask.metadata,
							completedDate: !currentTask.completed
								? Date.now()
								: undefined,
						},
					}));
					this.refreshCalendarEventsPreservingView();
				}
			}
		});
	}

	/**
	 * Handle event context menu from @taskgenius/calendar InteractionController
	 * Bridges the library's (event, x, y) signature to our (MouseEvent, CalendarEvent) signature
	 */
	private handleTGEventContextMenu(
		event: AdapterCalendarEvent,
		x: number,
		y: number,
	) {
		// Extract original Task from event metadata to ensure filePath and line are available
		const task = getTaskFromEvent(event as any);
		if (!task) {
			console.warn(
				"Context menu: Could not find original task from event",
			);
			return;
		}

		// Create a synthetic MouseEvent-like object with the coordinates
		const syntheticEvent = {
			clientX: x,
			clientY: y,
			preventDefault: () => {},
			stopPropagation: () => {},
		} as MouseEvent;

		// Pass the original task (with filePath and line) as CalendarEvent
		this.onEventContextMenu(syntheticEvent, task as CalendarEvent);
	}

	private async handleTGEventDrop(
		event: AdapterCalendarEvent,
		newStart: Date | string,
		newEnd: Date | string,
	) {
		if (event.metadata?.externalDrop === true) {
			this.updateExternalTextEventTime(event, newStart, newEnd);
			return;
		}

		const task = getTaskFromEvent(event as any);
		if (!task) {
			new Notice(t("Failed to update task: Task not found"));
			return;
		}

		// Don't allow dragging read-only ICS tasks (URL-based external calendar events)
		// OAuth providers (Google, Outlook, Apple) support two-way sync and can be dragged
		const isIcsTask = (task as any).source?.type === "ics";
		const isReadOnly = (task as any).readonly === true;
		if (isIcsTask && isReadOnly) {
			new Notice(
				t(
					"Cannot move external calendar events. Please update them in the original calendar.",
				),
			);
			// Refresh to reset the visual position
			setTimeout(() => {
				this.processTasks();
				this.renderCurrentView();
			}, 100);
			return;
		}

		const newStartDate =
			newStart instanceof Date ? newStart : new Date(newStart);
		const newEndInput = newEnd ?? newStart;
		const newEndDate =
			newEndInput instanceof Date ? newEndInput : new Date(newEndInput);
		const oldStartDate = new Date(event.start);
		const oldEndDate = event.end ? new Date(event.end) : oldStartDate;

		if (
			Number.isNaN(newStartDate.getTime()) ||
			Number.isNaN(newEndDate.getTime()) ||
			Number.isNaN(oldStartDate.getTime()) ||
			Number.isNaN(oldEndDate.getTime())
		) {
			console.warn("Calendar: Invalid date detected during drag/drop", {
				event,
				newStart,
				newEnd,
			});
			return;
		}

		const isAllDayEvent = event.allDay === true;

		try {
			const updates: any = { metadata: {} };
			let updatedFields: string[] = [];

			if (isAllDayEvent) {
				const normalizedNewStart = startOfDay(newStartDate);
				const normalizedNewEnd = startOfDay(newEndDate);
				const normalizedOldStart = startOfDay(oldStartDate);
				const normalizedOldEnd = startOfDay(oldEndDate);

				const startDiff = differenceInDays(
					normalizedNewStart,
					normalizedOldStart,
				);
				const endDiff = differenceInDays(
					normalizedNewEnd,
					normalizedOldEnd,
				);

				if (startDiff === 0 && endDiff === 0) return;

				const isMove = startDiff === endDiff;
				const isResizeStart = startDiff !== 0 && startDiff !== endDiff;
				const isResizeEnd = endDiff !== 0 && startDiff !== endDiff;

				if (isMove) {
					if (task.metadata.dueDate) {
						updates.metadata.dueDate = addDays(
							startOfDay(new Date(task.metadata.dueDate)),
							startDiff,
						).getTime();
						updatedFields.push("due date");
					}

					if (task.metadata.scheduledDate) {
						updates.metadata.scheduledDate = addDays(
							startOfDay(new Date(task.metadata.scheduledDate)),
							startDiff,
						).getTime();
						updatedFields.push("scheduled date");
					}

					if (task.metadata.startDate) {
						updates.metadata.startDate = addDays(
							startOfDay(new Date(task.metadata.startDate)),
							startDiff,
						).getTime();
						updatedFields.push("start date");
					}

					if (updatedFields.length === 0) {
						updates.metadata.dueDate = normalizedNewStart.getTime();
						updatedFields.push("due date");
					}
				} else if (isResizeStart) {
					updates.metadata.startDate = normalizedNewStart.getTime();
					updatedFields.push("start date");

					if (
						!task.metadata.dueDate &&
						differenceInDays(newEndDate, newStartDate) > 0
					) {
						updates.metadata.dueDate = normalizedNewEnd.getTime();
						updatedFields.push("due date");
					}
				} else if (isResizeEnd) {
					updates.metadata.dueDate = normalizedNewEnd.getTime();
					updatedFields.push("due date");

					if (
						!task.metadata.startDate &&
						differenceInDays(newEndDate, newStartDate) > 0
					) {
						updates.metadata.startDate =
							normalizedNewStart.getTime();
						updatedFields.push("start date");
					}
				}
			} else {
				const startDiffMs =
					newStartDate.getTime() - oldStartDate.getTime();
				const endDiffMs = newEndDate.getTime() - oldEndDate.getTime();

				if (startDiffMs === 0 && endDiffMs === 0) return;

				const isMove = startDiffMs === endDiffMs;
				const isResizeStart =
					startDiffMs !== 0 && startDiffMs !== endDiffMs;
				const isResizeEnd =
					endDiffMs !== 0 && startDiffMs !== endDiffMs;

				if (isMove) {
					if (task.metadata.dueDate) {
						updates.metadata.dueDate =
							task.metadata.dueDate + startDiffMs;
						updatedFields.push("due date");
					}

					if (task.metadata.scheduledDate) {
						updates.metadata.scheduledDate =
							task.metadata.scheduledDate + startDiffMs;
						updatedFields.push("scheduled date");
					}

					if (task.metadata.startDate) {
						updates.metadata.startDate =
							task.metadata.startDate + startDiffMs;
						updatedFields.push("start date");
					}

					if (updatedFields.length === 0) {
						updates.metadata.dueDate = newStartDate.getTime();
						updatedFields.push("due date");
					}
				} else if (isResizeStart) {
					updates.metadata.startDate = newStartDate.getTime();
					updatedFields.push("start date");

					if (
						!task.metadata.dueDate &&
						newEndDate.getTime() !== newStartDate.getTime()
					) {
						updates.metadata.dueDate = newEndDate.getTime();
						updatedFields.push("due date");
					}
				} else if (isResizeEnd) {
					updates.metadata.dueDate = newEndDate.getTime();
					updatedFields.push("due date");

					if (
						!task.metadata.startDate &&
						newEndDate.getTime() !== newStartDate.getTime()
					) {
						updates.metadata.startDate = newStartDate.getTime();
						updatedFields.push("start date");
					}
				}
			}

			// Update task using WriteAPI
			if (!this.plugin.writeAPI) {
				new Notice(t("Task update system not available"));
				return;
			}

			// Apply optimistic update to local state immediately
			// This prevents the "snap back" effect during async update
			this.applyOptimisticEventUpdate(event.id, newStartDate, newEndDate);

			const result = await this.plugin.writeAPI.updateTask({
				taskId: task.id,
				updates,
			});

			if (result.success) {
				new Notice(t("Task date updated successfully"));
				// No immediate refresh needed - the optimistic update already shows the correct position
				// The dataflow system will eventually sync the task index
			} else {
				console.error(
					"Calendar: Failed to update task after drag:",
					result.error,
				);
				new Notice(t("Failed to update task"));
				// Rollback optimistic update on failure
				this.processTasks();
				this.renderCurrentView();
			}
		} catch (error) {
			console.error("Calendar: Error updating task after drag:", error);
			new Notice(t("Failed to update task"));
			// Rollback optimistic update on error
			this.processTasks();
			this.renderCurrentView();
		}
	}

	private async handleTGEventResize(
		event: AdapterCalendarEvent,
		newStart: Date | string,
		newEnd: Date | string,
	) {
		if (event.metadata?.externalDrop === true) {
			this.updateExternalTextEventTime(event, newStart, newEnd);
			return;
		}

		const task = getTaskFromEvent(event as any);
		if (!task) {
			new Notice(t("Failed to update task: Task not found"));
			return;
		}

		// Don't allow resizing read-only ICS tasks (URL-based external calendar events)
		// OAuth providers (Google, Outlook, Apple) support two-way sync and can be resized
		const isIcsTask = (task as any).source?.type === "ics";
		const isReadOnly = (task as any).readonly === true;
		if (isIcsTask && isReadOnly) {
			new Notice(
				t(
					"Cannot resize external calendar events. Please update them in the original calendar.",
				),
			);
			setTimeout(() => {
				this.processTasks();
				this.renderCurrentView();
			}, 100);
			return;
		}

		const newStartDate =
			newStart instanceof Date ? newStart : new Date(newStart);
		const newEndDate = newEnd instanceof Date ? newEnd : new Date(newEnd);
		const oldStartDate = new Date(event.start);
		const oldEndDate = event.end ? new Date(event.end) : oldStartDate;
		const isAllDayEvent = event.allDay === true;

		const normalizedNewStart = isAllDayEvent
			? startOfDay(newStartDate)
			: newStartDate;
		const normalizedNewEnd = isAllDayEvent
			? startOfDay(newEndDate)
			: newEndDate;
		const normalizedOldStart = isAllDayEvent
			? startOfDay(oldStartDate)
			: oldStartDate;
		const normalizedOldEnd = isAllDayEvent
			? startOfDay(oldEndDate)
			: oldEndDate;

		const startChanged =
			normalizedNewStart.getTime() !== normalizedOldStart.getTime();
		const endChanged =
			normalizedNewEnd.getTime() !== normalizedOldEnd.getTime();

		if (!startChanged && !endChanged) return;

		const updates: any = { metadata: {} };
		const updatedFields: string[] = [];
		const newStartMs = normalizedNewStart.getTime();
		const newEndMs = normalizedNewEnd.getTime();
		const setField = (
			key: "startDate" | "dueDate",
			value: number,
			label: string,
		) => {
			if (updates.metadata[key] === undefined) {
				updates.metadata[key] = value;
				updatedFields.push(label);
			}
		};

		if (startChanged) {
			setField("startDate", newStartMs, "start date");
		}

		if (endChanged) {
			setField("dueDate", newEndMs, "due date");
		}

		// If a task only had one date, ensure both ends are updated for the new range
		if (!task.metadata.startDate) {
			setField("startDate", newStartMs, "start date");
		}
		if (!task.metadata.dueDate) {
			setField("dueDate", newEndMs, "due date");
		}

		if (updatedFields.length === 0) return;

		if (!this.plugin.writeAPI) {
			new Notice(t("Task update system not available"));
			return;
		}

		// Apply optimistic update to local state immediately
		// This prevents the "snap back" effect during async update
		this.applyOptimisticEventUpdate(
			event.id,
			normalizedNewStart,
			normalizedNewEnd,
		);

		const result = await this.plugin.writeAPI.updateTask({
			taskId: task.id,
			updates,
		});

		if (result.success) {
			new Notice(t("Task time updated: ") + updatedFields.join(", "));
			// No immediate refresh needed - the optimistic update already shows the correct position
		} else {
			console.error("Calendar: Failed to resize task:", result.error);
			new Notice(t("Failed to update task"));
			// Rollback optimistic update on failure
			this.processTasks();
			this.renderCurrentView();
		}
	}

	/**
	 * Apply optimistic update to local events array and TGCalendar
	 * This prevents the "snap back" visual glitch during async task updates
	 */
	private applyOptimisticEventUpdate(
		eventId: string,
		newStart: Date,
		newEnd: Date,
	): void {
		// Update local events array
		const eventIndex = this.events.findIndex((e) => e.id === eventId);
		if (eventIndex !== -1) {
			this.events[eventIndex] = {
				...this.events[eventIndex],
				start: newStart,
				end: newEnd,
			};
		}

		// Update TGCalendar's internal event state if available
		if (this.tgCalendar) {
			this.tgCalendar.updateEvent(eventId, {
				start: newStart.toISOString(),
				end: newEnd.toISOString(),
			});
		}
	}

	private handleTGRenderDateCell(ctx: any) {
		const { date, cellEl } = ctx;
		const tasksOnDate = this.getTasksForDate(date);
		const badgeEvents = this.getBadgeEventsForDate(date);

		// Render individual badge events (ICS events with badge showType)
		// Note: Event counts are automatically handled by @taskgenius/calendar's showEventCounts feature
		if (badgeEvents.length > 0) {
			// Find the date header area to place badges
			const dateHeader = cellEl.querySelector(".tg-date-header");
			if (dateHeader) {
				const badgesContainer = dateHeader.createDiv(
					"calendar-badges-container",
				);
				badgeEvents.forEach((badgeEvent) => {
					const badgeEl = badgesContainer.createEl("div", {
						cls: "calendar-badge",
					});

					// Add color styling if available
					if (badgeEvent.color) {
						badgeEl.style.backgroundColor = badgeEvent.color;
					}

					// Add content text
					badgeEl.textContent = badgeEvent.content;
				});
			}
		}

		// Add checkboxes to TGCalendar events
		// TGCalendar library doesn't support custom event rendering,
		// so we need to add checkboxes after the events are rendered
		setTimeout(() => {
			const eventElements = cellEl.querySelectorAll(".tg-event");
			eventElements.forEach((eventEl: HTMLElement) => {
				// Skip if checkbox already added
				if (eventEl.querySelector(".task-checkbox-overlay")) {
					return;
				}

				// Get event ID from data attribute
				const eventId = eventEl.dataset.eventId;
				if (!eventId) return;

				// Find the corresponding task
				const task = tasksOnDate.find((t) => t.id === eventId);
				if (!task) return;

				// Create checkbox overlay
				const checkboxContainer = eventEl.createDiv({
					cls: "task-checkbox-overlay",
				});

				const checkbox = checkboxContainer.createEl("input", {
					cls: "task-list-item-checkbox",
					type: "checkbox",
					attr: {
						"data-task": task.status || " ",
					},
				});

				checkbox.checked = task.status !== " " && task.status !== "?";

				// Handle checkbox click
				this.registerDomEvent(checkbox, "click", async (ev) => {
					ev.stopPropagation();

					// Toggle task status
					const newStatus = task.completed ? " " : "x";

					if (this.plugin.writeAPI) {
						const result =
							await this.plugin.writeAPI.updateTaskStatus({
								taskId: task.id,
								status: newStatus,
								completed: !task.completed,
							});

						if (result.success) {
							// Update UI
							checkbox.checked = !task.completed;
							checkbox.dataset.task = newStatus;
							this.updateLocalTaskState(task.id, (currentTask) => ({
								...currentTask,
								completed: !currentTask.completed,
								status: newStatus,
								metadata: {
									...currentTask.metadata,
									completedDate: !currentTask.completed
										? Date.now()
										: undefined,
								},
							}));
							this.refreshCalendarEventsPreservingView();
						}
					}
				});
			});
		}, 50); // Small delay to ensure TGCalendar has rendered events

		// Mark past due dates
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (date < today && tasksOnDate.some((t) => !t.completed)) {
			const dateNum = cellEl.querySelector(".tg-date-number");
			if (dateNum) {
				dateNum.addClass("past-due");
			}
		}
	}

	private registerTimeSlotQuickCaptureHandler(): void {
		this.registerDomEvent(this.viewContainerEl, "dblclick", (e: MouseEvent) => {
			const targetEl = e.target instanceof HTMLElement ? e.target : null;
			if (!targetEl) return;

			// Ignore double-clicks on existing events
			if (targetEl.closest(".tg-event")) return;

			const dayColumn = targetEl.closest<HTMLElement>(
				".tg-day-column[data-date]",
			);
			if (!dayColumn) return;

			const dateTime = this.resolveDateTimeFromDayColumnPosition(
				dayColumn,
				e.clientY,
			);
			if (!dateTime) return;

			e.preventDefault();
			e.stopPropagation();
			this.handleTimeSlotDoubleClick(dateTime);
		});
	}

	private registerExternalTextDropHandlers(): void {
		const supportsTextDrop = (
			dt: DataTransfer | null,
		): dt is DataTransfer => {
			if (!dt) return false;
			const types = Array.from(dt.types ?? []).map((t) =>
				String(t).toLowerCase(),
			);
			const hasStringItem = Array.from(dt.items ?? []).some(
				(item) => item.kind === "string",
			);
			return (
				hasStringItem ||
				types.includes("text/plain") ||
				types.includes("text") ||
				types.includes("text/unicode") ||
				types.includes("text/html") ||
				types.includes("text/uri-list")
			);
		};

		const readDroppedText = (dt: DataTransfer): string => {
			const raw =
				dt.getData("text/plain") ||
				dt.getData("text") ||
				dt.getData("Text") ||
				dt.getData("text/unicode") ||
				dt.getData("text/uri-list") ||
				"";
			return raw.trim();
		};

		this.registerDomEvent(
			this.viewContainerEl,
			"dragover",
			(e: DragEvent) => {
				if (!supportsTextDrop(e.dataTransfer)) return;
				e.preventDefault();
				e.dataTransfer.dropEffect = "copy";
			},
		);

		this.registerDomEvent(this.viewContainerEl, "drop", (e: DragEvent) => {
			if (!supportsTextDrop(e.dataTransfer)) return;

			const text = readDroppedText(e.dataTransfer);
			if (!text) return;

			const target = this.resolveExternalDropTarget(e);
			if (!target) return;

			e.preventDefault();
			e.stopPropagation();

			this.addExternalTextEvent(text, target);
		});
	}

	private resolveExternalDropTarget(
		e: DragEvent,
	): { start: Date; end: Date; allDay: boolean } | null {
		const targetEl = e.target instanceof HTMLElement ? e.target : null;
		if (!targetEl) return null;

		// Week/Day view: drop into a time column -> snap start time to the slot
		const dayColumn = targetEl.closest<HTMLElement>(
			".tg-day-column[data-date]",
		);
		if (dayColumn?.dataset.date) {
			const start = this.resolveDateTimeFromDayColumnPosition(
				dayColumn,
				e.clientY,
			);
			if (!start) return null;
			const end = dateFns.addMinutes(start, 30);

			return { start, end, allDay: false };
		}

		// Month view: drop into a day cell -> place at that day (all-day)
		const monthCell = targetEl.closest<HTMLElement>(".tg-month-cell");
		const monthRow = monthCell?.closest<HTMLElement>(
			".tg-month-row[data-date]",
		);
		if (monthCell && monthRow?.dataset.date) {
			const cells = Array.from(
				monthRow.querySelectorAll<HTMLElement>(".tg-month-cell"),
			);
			const index = cells.indexOf(monthCell);
			if (index < 0) return null;

			const rowStart = dateFns.parseISO(monthRow.dataset.date);
			const date = addDays(rowStart, index);
			const start = startOfDay(date);

			return { start, end: start, allDay: true };
		}

		return null;
	}

	private addExternalTextEvent(
		text: string,
		target: { start: Date; end: Date; allDay: boolean },
	): void {
		const title =
			text
				.split(/\r?\n/)
				.map((l) => l.trim())
				.find((l) => l.length > 0) ?? t("New event");

		const id = `external-drop:${Date.now()}:${Math.random().toString(16).slice(2)}`;
		const toDateTime = (d: Date) => dateFns.format(d, "yyyy-MM-dd HH:mm");

		const normalizedStart = target.allDay
			? startOfDay(target.start)
			: target.start;
		const normalizedEnd = target.allDay
			? startOfDay(target.end)
			: target.end;

		const event: AdapterCalendarEvent = {
			id,
			title,
			start: toDateTime(normalizedStart),
			end: toDateTime(normalizedEnd),
			color: "var(--interactive-accent)",
			allDay: target.allDay,
			metadata: {
				externalDrop: true,
				rawText: text,
				createdAt: Date.now(),
			},
		};

		this.externalTextEvents.push(event);
		this.tgCalendar?.addEvent(event);
	}

	/**
	 * Update the time of an external text event when dragged
	 */
	private updateExternalTextEventTime(
		event: AdapterCalendarEvent,
		newStart: Date | string,
		newEnd: Date | string,
	): void {
		const index = this.externalTextEvents.findIndex(
			(e) => e.id === event.id,
		);
		if (index < 0) return;

		const startDate =
			newStart instanceof Date ? newStart : new Date(newStart);
		const endInput = newEnd ?? newStart;
		const endDate =
			endInput instanceof Date ? endInput : new Date(endInput);

		if (
			Number.isNaN(startDate.getTime()) ||
			Number.isNaN(endDate.getTime())
		) {
			return;
		}

		const isAllDayEvent = event.allDay === true;
		const normalizedStart = isAllDayEvent
			? startOfDay(startDate)
			: startDate;
		const normalizedEnd = isAllDayEvent ? startOfDay(endDate) : endDate;
		const toDateTime = (d: Date) => dateFns.format(d, "yyyy-MM-dd HH:mm");

		const current = this.externalTextEvents[index];
		if (!current) return;

		this.externalTextEvents[index] = {
			...current,
			start: toDateTime(normalizedStart),
			end: toDateTime(normalizedEnd),
			allDay: isAllDayEvent,
		};
	}

	// ============================================
	//  TGCalendar Interaction Handlers (v0.6.0+)
	// ============================================

	/**
	 * Handle single click on a date cell (month view)
	 */
	private handleDateClick(date: Date) {
		// Allow event bubbling for other interactions
		// This maintains compatibility with existing click behavior
	}

	/**
	 * Handle double click on a date cell - opens quick capture modal
	 */
	private handleDateDoubleClick(date: Date) {
		new QuickCaptureModal(
			this.app,
			this.plugin,
			{ dueDate: date },
			true,
		).open();
	}

	/**
	 * Handle context menu (right-click) on a date cell
	 */
	private handleDateContextMenu(date: Date, x?: number, y?: number) {
		// Can be extended to show custom context menu
		// For now, allow default browser context menu
	}

	/**
	 * Handle click on time slot (week/day view)
	 */
	private handleTimeSlotClick(dateTime: Date) {
		// Single click on time slot - could show tooltip or select
	}

	/**
	 * Handle double click on time slot - opens quick capture with time
	 */
	private handleTimeSlotDoubleClick(dateTime: Date) {
		// Create task with specific time
		new QuickCaptureModal(
			this.app,
			this.plugin,
			{ dueDate: dateTime },
			true,
		).open();
	}

	/**
	 * Handle date range selection in month view
	 * Opens quick capture modal with start and due dates pre-filled
	 */
	private handleDateRangeSelect(startDate: Date, endDate: Date) {
		new QuickCaptureModal(
			this.app,
			this.plugin,
			{
				startDate: startDate,
				dueDate: endDate,
			},
			true,
		).open();
	}

	/**
	 * Handle time range selection in week/day view
	 * Opens quick capture modal with start and due dates/times pre-filled
	 */
	private handleTimeRangeSelect(startDateTime: Date, endDateTime: Date) {
		new QuickCaptureModal(
			this.app,
			this.plugin,
			{
				startDate: startDateTime,
				dueDate: endDateTime,
			},
			true,
		).open();
	}

	// ============================================
	//  Original Event Handlers (for Agenda/Year views)
	// ============================================

	private onEventClick = (ev: MouseEvent, event: CalendarEvent) => {
		this.params?.onTaskSelected?.(event);
	};

	private onEventHover = (ev: MouseEvent, event: CalendarEvent) => {
		// Hover logic
	};

	private onDayClick = (
		ev: MouseEvent,
		day: number,
		options: { behavior: "open-quick-capture" | "open-task-view" },
	) => {
		const dayDate = new Date(day);
		if (this.currentViewMode === "year") {
			this.setView("day");
			this.currentDate = moment(dayDate);
			this.render();
		} else if (options.behavior === "open-quick-capture") {
			new QuickCaptureModal(
				this.app,
				this.plugin,
				{ dueDate: dayDate },
				true,
			).open();
		}
	};

	private onDayHover = (ev: MouseEvent, day: number) => {};

	private onMonthClick = (ev: MouseEvent, month: number) => {
		this.setView("month");
		this.currentDate = moment(new Date(month));
		this.render();
	};

	private onMonthHover = (ev: MouseEvent, month: number) => {};

	private onEventContextMenu = (ev: MouseEvent, event: CalendarEvent) => {
		this.params?.onEventContextMenu?.(ev, event);
	};

	private onEventComplete = (ev: MouseEvent, event: CalendarEvent) => {
		this.params?.onTaskCompleted?.(event);
	};

	// ============================================
	//  Task Processing
	// ============================================

	private async processTasks() {
		this.events = [];
		this.badgeEventsCache.clear();

		this.tasks.forEach((task) => {
			const isIcsTask = (task as any).source?.type === "ics";
			const icsTask = isIcsTask ? (task as IcsTask) : null;
			const showAsBadge = icsTask?.icsEvent?.source?.showType === "badge";

			if (isIcsTask && showAsBadge) {
				return; // Skip badge events
			}

			let eventDate: number | null = null;
			let isAllDay = true;

			if (isIcsTask && icsTask?.icsEvent) {
				eventDate = icsTask.icsEvent.dtstart.getTime();
				isAllDay = icsTask.icsEvent.allDay;
			} else {
				eventDate =
					task.metadata.dueDate ||
					task.metadata.scheduledDate ||
					task.metadata.startDate ||
					null;
			}

			if (eventDate) {
				const eventDateObj = new Date(eventDate);
				const start = isAllDay
					? startOfDay(eventDateObj)
					: eventDateObj;

				let end: Date | undefined = undefined;
				let effectiveStart = start;

				if (isIcsTask && icsTask?.icsEvent?.dtend) {
					end = icsTask.icsEvent.dtend;
				} else if (
					task.metadata.startDate &&
					task.metadata.dueDate &&
					task.metadata.startDate !== task.metadata.dueDate
				) {
					const taskStart = startOfDay(
						new Date(task.metadata.startDate),
					);
					const taskDue = startOfDay(new Date(task.metadata.dueDate));
					if (isBefore(taskStart, taskDue)) {
						end = addDays(taskDue, 1);
						effectiveStart = taskStart;
					}
				}

				let eventColor: string | undefined;
				if (isIcsTask && icsTask?.icsEvent?.source?.color) {
					eventColor = icsTask.icsEvent.source.color;
				} else {
					eventColor = task.completed ? "grey" : undefined;
				}

				this.events.push({
					...task,
					title: task.content,
					start: effectiveStart,
					end,
					allDay: isAllDay,
					color: eventColor,
				});
			}
		});

		this.events.sort((a, b) => a.start.getTime() - b.start.getTime());
	}

	private convertTasksToTGEvents(): AdapterCalendarEvent[] {
		const tasksWithDates = this.tasks.filter((task) =>
			hasDateInformation(task),
		);
		return [
			...tasksToCalendarEvents(tasksWithDates),
			...this.externalTextEvents,
		];
	}

	private getTasksForDate(date: Date): Task[] {
		const targetTime = this.normalizeDateToDay(date).getTime();

		return this.tasks.filter((task) => {
			if (task.metadata.dueDate) {
				const dueDate = this.normalizeDateToDay(
					new Date(task.metadata.dueDate),
				);
				if (dueDate.getTime() === targetTime) return true;
			}
			if (task.metadata.scheduledDate) {
				const scheduledDate = this.normalizeDateToDay(
					new Date(task.metadata.scheduledDate),
				);
				if (scheduledDate.getTime() === targetTime) return true;
			}
			if (task.metadata.startDate) {
				const startDate = this.normalizeDateToDay(
					new Date(task.metadata.startDate),
				);
				if (startDate.getTime() === targetTime) return true;
			}
			return false;
		});
	}

	// ============================================
	//  Utilities
	// ============================================

	private getViewUnit(): moment.unitOfTime.DurationConstructor {
		// Check for custom view first
		if (this.isCustomView(this.currentViewMode)) {
			const customConfig = this.getCustomViewConfig(this.currentViewMode);
			if (customConfig) {
				// Use the base view type's unit
				switch (customConfig.baseViewType) {
					case "month":
						return "month";
					case "week":
						return "week";
					case "day":
						return "day";
				}
			}
		}

		switch (this.currentViewMode) {
			case "year":
				return "year";
			case "month":
				return "month";
			case "week":
				return "week";
			case "day":
				return "day";
			case "agenda":
				return "week";
			default:
				return "month";
		}
	}

	/**
	 * Get the effective first day of week, respecting:
	 * 1. Custom view config (if specified)
	 * 2. Base calendar config (if specified)
	 * 3. System/locale default from moment
	 *
	 * @param customViewConfig Optional custom view config to check first
	 * @returns 0-6 (Sunday to Saturday)
	 */
	private getEffectiveFirstDayOfWeek(
		customViewConfig?: CustomCalendarViewConfig | null,
	): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
		// Check custom view config first
		if (customViewConfig?.calendarConfig?.firstDayOfWeek !== undefined) {
			return customViewConfig.calendarConfig.firstDayOfWeek;
		}

		// Check base calendar config
		const baseConfig = this.getEffectiveCalendarConfig();
		if (baseConfig.firstDayOfWeek !== undefined) {
			// Ensure it's a valid value (0-6)
			const baseFdow = baseConfig.firstDayOfWeek;
			if (baseFdow >= 0 && baseFdow <= 6) {
				return baseFdow as 0 | 1 | 2 | 3 | 4 | 5 | 6;
			}
		}

		// Fall back to system/locale default from moment
		const localeFirstDay = moment.localeData().firstDayOfWeek();
		// moment returns 0-6
		if (localeFirstDay >= 0 && localeFirstDay <= 6) {
			return localeFirstDay as 0 | 1 | 2 | 3 | 4 | 5 | 6;
		}
		// Fallback to Sunday if somehow invalid
		return 0;
	}

	/**
	 * Get the start of week for a given date, respecting the configured first day of week
	 */
	private getStartOfWeekWithConfig(
		date: moment.Moment,
		customViewConfig?: CustomCalendarViewConfig | null,
	): moment.Moment {
		const firstDayOfWeek =
			this.getEffectiveFirstDayOfWeek(customViewConfig);
		const cloned = date.clone();
		const currentDay = cloned.day();
		const diff = (currentDay - firstDayOfWeek + 7) % 7;
		return cloned.subtract(diff, "days").startOf("day");
	}

	/**
	 * Get the end of week for a given date, respecting the configured first day of week
	 */
	private getEndOfWeekWithConfig(
		date: moment.Moment,
		customViewConfig?: CustomCalendarViewConfig | null,
	): moment.Moment {
		const startOfWeek = this.getStartOfWeekWithConfig(
			date,
			customViewConfig,
		);
		return startOfWeek.clone().add(6, "days").endOf("day");
	}

	private getCurrentDateDisplay(): string {
		// Check for custom view first
		if (this.isCustomView(this.currentViewMode)) {
			const customConfig = this.getCustomViewConfig(this.currentViewMode);
			if (customConfig) {
				// Use the base view type's format, with custom view name prefix
				const prefix = ``;
				switch (customConfig.baseViewType) {
					case "month":
						return prefix + this.currentDate.format("MMMM/YYYY");
					case "week": {
						// Use config-aware week start/end
						const startOfWeek = this.getStartOfWeekWithConfig(
							this.currentDate,
							customConfig,
						);
						const endOfWeek = this.getEndOfWeekWithConfig(
							this.currentDate,
							customConfig,
						);
						if (startOfWeek.month() !== endOfWeek.month()) {
							return (
								prefix +
								`${startOfWeek.format("MMM D")} - ${endOfWeek.format("MMM D, YYYY")}`
							);
						}
						return (
							prefix +
							`${startOfWeek.format("MMM D")} - ${endOfWeek.format("D, YYYY")}`
						);
					}
					case "day":
						return (
							prefix +
							this.currentDate.format("dddd, MMMM D, YYYY")
						);
				}
			}
		}

		switch (this.currentViewMode) {
			case "year":
				return this.currentDate.format("YYYY");
			case "month":
				return this.currentDate.format("MMMM/YYYY");
			case "week": {
				// Use config-aware week start/end
				const startOfWeek = this.getStartOfWeekWithConfig(
					this.currentDate,
				);
				const endOfWeek = this.getEndOfWeekWithConfig(this.currentDate);
				if (startOfWeek.month() !== endOfWeek.month()) {
					if (startOfWeek.year() !== endOfWeek.year()) {
						return `${startOfWeek.format(
							"MMM D, YYYY",
						)} - ${endOfWeek.format("MMM D, YYYY")}`;
					}
					return `${startOfWeek.format("MMM D")} - ${endOfWeek.format(
						"MMM D, YYYY",
					)}`;
				}
				return `${startOfWeek.format("MMM D")} - ${endOfWeek.format(
					"D, YYYY",
				)}`;
			}
			case "day":
				return this.currentDate.format("dddd, MMMM D, YYYY");
			case "agenda": {
				const endOfAgenda = this.currentDate.clone().add(6, "days");
				return `${this.currentDate.format(
					"MMM D",
				)} - ${endOfAgenda.format("MMM D, YYYY")}`;
			}
			default:
				return this.currentDate.format("MMMM YYYY");
		}
	}

	private getEffectiveCalendarConfig(): Partial<CalendarSpecificConfig> {
		const baseCfg = this.plugin.settings.viewConfiguration.find(
			(v) => v.id === this.viewId,
		)?.specificConfig as Partial<CalendarSpecificConfig> | undefined;

		return { ...(baseCfg ?? {}), ...(this.configOverride ?? {}) };
	}

	private formatDateKey(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	private normalizeDateToDay(date: Date): Date {
		const normalized = new Date(date);
		normalized.setHours(0, 0, 0, 0);
		return normalized;
	}

	private isSameDay(date1: Date, date2: Date): boolean {
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	public precomputeBadgeEventsForCurrentView(): void {
		// Legacy compatibility - no-op
	}

	private invalidateBadgeEventsCache(): void {
		this.badgeEventsCache.clear();
	}
}
