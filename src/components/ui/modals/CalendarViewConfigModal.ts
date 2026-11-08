import { t as settingsText } from "@/translations/helper";
import {
	App,
	Modal,
	Setting,
	ButtonComponent,
	DropdownComponent,
	TextComponent,
	ToggleComponent,
	SliderComponent,
	setIcon,
} from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import {
	CustomCalendarViewConfig,
	DayFilterConfig,
	TimeFilterConfig,
} from "@/common/setting-definition";
import { t } from "@/translations/helper";
import { attachIconMenu } from "@/components/ui/menus/IconMenu";

/**
 * Days of the week for custom day filter
 */
const WEEKDAYS = [
	{ value: 0, label: settingsText("Sunday"), short: "Sun" },
	{ value: 1, label: settingsText("Monday"), short: "Mon" },
	{ value: 2, label: settingsText("Tuesday"), short: "Tue" },
	{ value: 3, label: settingsText("Wednesday"), short: "Wed" },
	{ value: 4, label: settingsText("Thursday"), short: "Thu" },
	{ value: 5, label: settingsText("Friday"), short: "Fri" },
	{ value: 6, label: settingsText("Saturday"), short: "Sat" },
];

/**
 * Modal for creating/editing custom calendar views
 */
export class CalendarViewConfigModal extends Modal {
	private view: CustomCalendarViewConfig;
	private onSave: (view: CustomCalendarViewConfig) => void;
	private plugin: TaskProgressBarPlugin;
	private currentTab: "basic" | "date" | "time" | "display" = "basic";

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		view: CustomCalendarViewConfig,
		onSave: (view: CustomCalendarViewConfig) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.view = JSON.parse(JSON.stringify(view)); // Deep clone
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		this.modalEl.addClass("calendar-view-config-modal");

		// Header
		const headerEl = contentEl.createDiv({ cls: "modal-header" });
		headerEl.createEl("h2", {
			text:
				this.view.createdAt === this.view.updatedAt
					? t("Create Calendar View")
					: t("Edit Calendar View"),
		});

		// Tabs
		const tabsEl = contentEl.createDiv({ cls: "calendar-config-tabs" });
		this.renderTabs(tabsEl);

		// Content
		const contentContainer = contentEl.createDiv({
			cls: "calendar-config-content",
		});
		this.renderTabContent(contentContainer);

		// Footer
		const footerEl = contentEl.createDiv({ cls: "modal-button-container" });
		this.renderFooter(footerEl);
	}

	private renderTabs(container: HTMLElement) {
		const tabs = [
			{ id: "basic", label: t("Basic"), icon: "settings" },
			{ id: "date", label: t("Date Filter"), icon: "calendar" },
			{ id: "time", label: t("Time Filter"), icon: "clock" },
			{ id: "display", label: t("Display"), icon: "eye" },
		] as const;

		tabs.forEach((tab) => {
			const tabEl = container.createDiv({
				cls: `calendar-config-tab ${this.currentTab === tab.id ? "is-active" : ""}`,
			});

			const iconEl = tabEl.createSpan({
				cls: "calendar-config-tab-icon",
			});
			setIcon(iconEl, tab.icon);
			tabEl.createSpan({
				cls: "calendar-config-tab-label",
				text: tab.label,
			});

			// Disable time tab for month/agenda/year views
			const isTimeTabDisabled =
				tab.id === "time" &&
				(this.view.baseViewType === "month" ||
					this.view.baseViewType === "agenda" ||
					this.view.baseViewType === "year");

			if (isTimeTabDisabled) {
				tabEl.addClass("is-disabled");
				tabEl.setAttribute("aria-disabled", "true");
				tabEl.title = t(
					"Time filter is only available for Week and Day views",
				);
			} else {
				tabEl.onclick = () => {
					this.currentTab = tab.id;
					this.refreshContent();
				};
			}
		});
	}

	private renderTabContent(container: HTMLElement) {
		container.empty();

		switch (this.currentTab) {
			case "basic":
				this.renderBasicTab(container);
				break;
			case "date":
				this.renderDateTab(container);
				break;
			case "time":
				this.renderTimeTab(container);
				break;
			case "display":
				this.renderDisplayTab(container);
				break;
		}
	}

	private renderBasicTab(container: HTMLElement) {
		// View Name
		new Setting(container)
			.setName(t("View Name"))
			.setDesc(t("Display name for this calendar view"))
			.addText((text) => {
				text.setPlaceholder(t("My Custom View"))
					.setValue(this.view.name)
					.onChange((value) => {
						this.view.name = value;
					});
			});

		// Icon
		const iconSetting = new Setting(container)
			.setName(t("View Icon"))
			.setDesc(t("Choose an icon for this view"));

		const iconContainer = iconSetting.controlEl.createDiv({
			cls: "calendar-view-icon-selector",
		});

		const iconButton = new ButtonComponent(iconContainer);
		iconButton.setIcon(this.view.icon);

		attachIconMenu(iconButton, {
			containerEl: iconContainer,
			plugin: this.plugin,
			onIconSelected: (iconId: string) => {
				this.view.icon = iconId;
				iconButton.setIcon(iconId);
			},
		});

		// Base View Type
		new Setting(container)
			.setName(t("Base View Type"))
			.setDesc(t("The calendar layout this view is based on"))
			.addDropdown((dropdown) => {
				dropdown
					.addOption("month", t("Month View"))
					.addOption("week", t("Week View"))
					.addOption("day", t("Day View"))
					.addOption("agenda", t("Agenda View"))
					.addOption("year", t("Year View"))
					.setValue(this.view.baseViewType)
					.onChange(
						(
							value: "month" | "week" | "day" | "agenda" | "year",
						) => {
							this.view.baseViewType = value;
							// Reset time filter if switching to non-time views
							if (
								(value === "month" ||
									value === "agenda" ||
									value === "year") &&
								this.view.calendarConfig.timeFilter
							) {
								this.view.calendarConfig.timeFilter.enabled = false;
							}
							this.refreshContent();
						},
					);
			});

		// First Day of Week (not for agenda view)
		if (this.view.baseViewType !== "agenda") {
			new Setting(container)
				.setName(t("First Day of Week"))
				.setDesc(t("Which day should the week start on"))
				.addDropdown((dropdown) => {
					dropdown
						.addOption("", t("System Default"))
						.addOption("0", t("Sunday"))
						.addOption("1", t("Monday"))
						.addOption("2", t("Tuesday"))
						.addOption("3", t("Wednesday"))
						.addOption("4", t("Thursday"))
						.addOption("5", t("Friday"))
						.addOption("6", t("Saturday"))
						.setValue(
							this.view.calendarConfig.firstDayOfWeek?.toString() ??
								"",
						)
						.onChange((value) => {
							this.view.calendarConfig.firstDayOfWeek = value
								? (parseInt(value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
								: undefined;
						});
				});
		}

		// Agenda-specific options
		if (this.view.baseViewType === "agenda") {
			new Setting(container)
				.setName(t("Days to Show"))
				.setDesc(t("Number of days to display in the agenda"))
				.addSlider((slider) => {
					slider
						.setLimits(1, 30, 1)
						.setValue(
							(this.view.calendarConfig as any).daysToShow ?? 7,
						)
						.setDynamicTooltip()
						.onChange((value) => {
							(this.view.calendarConfig as any).daysToShow =
								value;
						});
				});

			new Setting(container)
				.setName(t("Show Empty Days"))
				.setDesc(t("Display days with no events"))
				.addToggle((toggle) => {
					toggle
						.setValue(
							(this.view.calendarConfig as any).showEmptyDays ??
								false,
						)
						.onChange((value) => {
							(this.view.calendarConfig as any).showEmptyDays =
								value;
						});
				});
		}
	}

	private renderDateTab(container: HTMLElement) {
		const dayFilter = this.view.calendarConfig.dayFilter || {
			type: "none",
		};

		// Day Filter Type
		new Setting(container)
			.setName(t("Day Filter"))
			.setDesc(t("Control which days are displayed in the calendar"))
			.addDropdown((dropdown) => {
				dropdown
					.addOption("none", t("Show All Days"))
					.addOption("hideWeekends", t("Hide Weekends"))
					.addOption("hideWeekdays", t("Weekends Only"))
					.addOption("customDays", t("Custom Selection"))
					.setValue(dayFilter.type)
					.onChange((value: DayFilterConfig["type"]) => {
						this.view.calendarConfig.dayFilter = {
							type: value,
							hiddenDays:
								value === "customDays"
									? dayFilter.hiddenDays || []
									: undefined,
						};
						this.refreshContent();
					});
			});

		// Custom Day Selection (only shown when customDays is selected)
		if (dayFilter.type === "customDays") {
			const customDaysSetting = new Setting(container)
				.setName(t("Hidden Days"))
				.setDesc(t("Select which days to hide from the calendar"));

			const daysContainer = customDaysSetting.controlEl.createDiv({
				cls: "calendar-days-selector",
			});

			const hiddenDays = dayFilter.hiddenDays || [];

			WEEKDAYS.forEach((day) => {
				const dayEl = daysContainer.createDiv({
					cls: `calendar-day-chip ${hiddenDays.includes(day.value) ? "is-hidden" : ""}`,
				});
				dayEl.createSpan({ text: t(day.short) });

				dayEl.onclick = () => {
					const currentHidden =
						this.view.calendarConfig.dayFilter?.hiddenDays || [];
					const index = currentHidden.indexOf(day.value);

					if (index === -1) {
						currentHidden.push(day.value);
					} else {
						currentHidden.splice(index, 1);
					}

					this.view.calendarConfig.dayFilter = {
						type: "customDays",
						hiddenDays: currentHidden,
					};

					dayEl.toggleClass(
						"is-hidden",
						currentHidden.includes(day.value),
					);
				};
			});
		}

		// Show Week Numbers (for month view)
		if (this.view.baseViewType === "month") {
			new Setting(container)
				.setName(t("Show Week Numbers"))
				.setDesc(t("Display week numbers in the month view"))
				.addToggle((toggle) => {
					toggle
						.setValue(
							this.view.calendarConfig.showWeekNumbers ?? false,
						)
						.onChange((value) => {
							this.view.calendarConfig.showWeekNumbers = value;
						});
				});
		}
	}

	private renderTimeTab(container: HTMLElement) {
		// Only for week/day views
		if (
			this.view.baseViewType === "month" ||
			this.view.baseViewType === "agenda" ||
			this.view.baseViewType === "year"
		) {
			container.createDiv({
				cls: "calendar-config-notice",
				text: t(
					"Time filter is only available for Week and Day views.",
				),
			});
			return;
		}

		const timeFilter = this.view.calendarConfig.timeFilter || {
			enabled: false,
			type: "workingHours",
			startHour: 9,
			endHour: 18,
		};

		// Enable Time Filter
		new Setting(container)
			.setName(t("Enable Time Filter"))
			.setDesc(t("Only show certain hours of the day"))
			.addToggle((toggle) => {
				toggle.setValue(timeFilter.enabled).onChange((value) => {
					this.view.calendarConfig.timeFilter = {
						...timeFilter,
						enabled: value,
					};
					this.refreshContent();
				});
			});

		if (timeFilter.enabled) {
			// Time Filter Type
			new Setting(container)
				.setName(t("Time Range Preset"))
				.setDesc(t("Choose a preset or customize the time range"))
				.addDropdown((dropdown) => {
					dropdown
						.addOption(
							"workingHours",
							t("Working Hours (9:00-18:00)"),
						)
						.addOption("custom", t("Custom Range"))
						.setValue(timeFilter.type)
						.onChange((value: TimeFilterConfig["type"]) => {
							if (value === "workingHours") {
								this.view.calendarConfig.timeFilter = {
									enabled: true,
									type: "workingHours",
									startHour: 9,
									endHour: 18,
								};
							} else {
								this.view.calendarConfig.timeFilter = {
									...timeFilter,
									type: "custom",
								};
							}
							this.refreshContent();
						});
				});

			// Custom Time Range
			if (timeFilter.type === "custom") {
				// Start Hour
				new Setting(container)
					.setName(t("Start Hour"))
					.setDesc(t("First hour to display (0-23)"))
					.addSlider((slider) => {
						slider
							.setLimits(0, 23, 1)
							.setValue(timeFilter.startHour)
							.setDynamicTooltip()
							.onChange((value) => {
								this.view.calendarConfig.timeFilter = {
									...this.view.calendarConfig.timeFilter!,
									startHour: value,
								};
								this.updateTimeRangeDisplay(container);
							});
					});

				// End Hour
				new Setting(container)
					.setName(t("End Hour"))
					.setDesc(t("Last hour to display (0-23)"))
					.addSlider((slider) => {
						slider
							.setLimits(1, 24, 1)
							.setValue(timeFilter.endHour)
							.setDynamicTooltip()
							.onChange((value) => {
								this.view.calendarConfig.timeFilter = {
									...this.view.calendarConfig.timeFilter!,
									endHour: value,
								};
								this.updateTimeRangeDisplay(container);
							});
					});

				// Time Range Display
				const rangeDisplay = container.createDiv({
					cls: "calendar-time-range-display",
				});
				this.updateTimeRangeDisplay(container, rangeDisplay);
			}
		}
	}

	private updateTimeRangeDisplay(
		container: HTMLElement,
		displayEl?: HTMLElement,
	) {
		const el =
			displayEl ||
			container.querySelector(".calendar-time-range-display");
		if (!el) return;

		const timeFilter = this.view.calendarConfig.timeFilter;
		if (!timeFilter) return;

		const formatHour = (h: number) => `${h.toString().padStart(2, "0")}:00`;
		(el as HTMLElement).textContent =
			`${formatHour(timeFilter.startHour)} - ${formatHour(timeFilter.endHour)}`;
	}

	private renderDisplayTab(container: HTMLElement) {
		// Show Event Counts (not for agenda view)
		if (this.view.baseViewType !== "agenda") {
			new Setting(container)
				.setName(t("Show Event Counts"))
				.setDesc(t("Display event count badges on date cells"))
				.addToggle((toggle) => {
					toggle
						.setValue(
							this.view.calendarConfig.showEventCounts ?? true,
						)
						.onChange((value) => {
							this.view.calendarConfig.showEventCounts = value;
						});
				});
		}

		// Max Events Per Row (for month view only)
		if (this.view.baseViewType === "month") {
			new Setting(container)
				.setName(t("Max Events Per Row"))
				.setDesc(
					t(
						"Maximum events to show per day cell before showing '+N more'",
					),
				)
				.addSlider((slider) => {
					slider
						.setLimits(1, 10, 1)
						.setValue(this.view.calendarConfig.maxEventsPerRow ?? 3)
						.setDynamicTooltip()
						.onChange((value) => {
							this.view.calendarConfig.maxEventsPerRow = value;
						});
				});
		}

		// Agenda-specific display options
		if (this.view.baseViewType === "agenda") {
			new Setting(container)
				.setName(t("Day Header Format"))
				.setDesc(t("Format for day headers (e.g., dddd, MMMM D)"))
				.addText((text) => {
					text.setPlaceholder("dddd, MMMM D")
						.setValue(
							(this.view.calendarConfig as any).dayHeaderFormat ??
								"",
						)
						.onChange((value) => {
							(this.view.calendarConfig as any).dayHeaderFormat =
								value || undefined;
						});
				});
		}

		// Year view note
		if (this.view.baseViewType === "year") {
			container.createDiv({
				cls: "calendar-config-notice",
				text: t(
					"Year view displays 12 mini-month calendars. Use the Date Filter tab to hide weekends if needed.",
				),
			});
		}

		// Date Formats Section
		new Setting(container)
			.setName(t("Custom Date Formats"))
			.setDesc(t("Customize how dates are displayed in headers"))
			.setHeading();

		// Month Header Format
		new Setting(container)
			.setName(t("Month Header Format"))
			.setDesc(t("Format for month view header (e.g., yyyy M)"))
			.addText((text) => {
				text.setPlaceholder("yyyy M")
					.setValue(
						this.view.calendarConfig.dateFormats?.monthHeader ?? "",
					)
					.onChange((value) => {
						if (!this.view.calendarConfig.dateFormats) {
							this.view.calendarConfig.dateFormats = {};
						}
						this.view.calendarConfig.dateFormats.monthHeader =
							value || undefined;
					});
			});

		// Day Header Format
		new Setting(container)
			.setName(t("Day Header Format"))
			.setDesc(t("Format for day view header (e.g., yyyy'年'M'月'd'日')"))
			.addText((text) => {
				text.setPlaceholder("yyyy'年'M'月'd'日'")
					.setValue(
						this.view.calendarConfig.dateFormats?.dayHeader ?? "",
					)
					.onChange((value) => {
						if (!this.view.calendarConfig.dateFormats) {
							this.view.calendarConfig.dateFormats = {};
						}
						this.view.calendarConfig.dateFormats.dayHeader =
							value || undefined;
					});
			});
	}

	private renderFooter(container: HTMLElement) {
		const cancelBtn = new ButtonComponent(container);
		cancelBtn.setButtonText(t("Cancel")).onClick(() => {
			this.close();
		});

		const saveBtn = new ButtonComponent(container);
		saveBtn
			.setButtonText(t("Save"))
			.setCta()
			.onClick(() => {
				if (!this.view.name.trim()) {
					this.view.name = t("Untitled View");
				}
				this.onSave(this.view);
				this.close();
			});
	}

	private refreshContent() {
		const { contentEl } = this;

		// Re-render tabs
		const tabsEl = contentEl.querySelector(".calendar-config-tabs");
		if (tabsEl) {
			tabsEl.empty();
			this.renderTabs(tabsEl as HTMLElement);
		}

		// Re-render content
		const contentContainer = contentEl.querySelector(
			".calendar-config-content",
		);
		if (contentContainer) {
			this.renderTabContent(contentContainer as HTMLElement);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
