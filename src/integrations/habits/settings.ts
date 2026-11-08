import { App, Notice, PluginSettingTab, setIcon, Setting } from "obsidian";
import { t } from "./i18n";
import type HabitsPlugin from "./main";
import type { GroupStyle, HabitSortMode } from "./types";
import { habitAccent, sortHabits } from "./utils";
import { applyHabitIcon } from "./ui/icon-suggest-modal";
import { ConfirmModal } from "./ui/confirm-modal";
import { GroupsModal } from "./ui/groups-modal";
import { FolderSuggest } from "./ui/vault-suggest";

/**
 * Feature flags for functionality that is still being tested.
 *
 * Every flag defaults to off. A flag only ever gates *entry points* (for
 * example whether a creation option is offered) — never how existing data
 * is interpreted — so turning a flag off can never corrupt or reinterpret
 * anything the user created while it was on. Graduating a feature to
 * fully-fledged means deleting its flag here and removing the UI guards.
 */
export interface ExperimentalFlags {
	/** AI-generated summaries on the weekly and monthly stats tabs. */
	aiSummaries: boolean;
	/**
	 * Note habits: a card backed by a per-day note, completed by reaching a
	 * character count or checking off every task in it, optionally created
	 * from a Templater template.
	 */
	noteHabits: boolean;
	/**
	 * Reviewing and rescheduling missed habits onto a different day, from a
	 * notification button on the dashboard and sidebar panel.
	 */
	rescheduling: boolean;
}

export const DEFAULT_EXPERIMENTAL: ExperimentalFlags = {
	aiSummaries: false,
	noteHabits: false,
	rescheduling: false,
};

/**
 * The frontmatter property name used for every field a habit note stores.
 * Renaming one here only changes what the plugin reads and writes going
 * forward — see {@link HabitStore.renameFrontmatterKeys} for moving a
 * field's existing value onto its new key across a vault's habit notes.
 *
 * Defaults match the plugin's original, fixed key names, so an existing
 * vault is unaffected until a user changes one in Settings → Advanced. Kept
 * deliberately separate from `HabitDefinition`'s field names (in `types.ts`),
 * which never change: only the on-disk key is configurable, not the
 * in-memory shape the rest of the plugin works with.
 *
 * `weekday`/`time` each cover two on-disk encodings of the same concept — a
 * scalar for a single value, or a `<key>s` list for several — so only the
 * singular form is configurable; the plural is always derived from it.
 */
export interface FrontmatterKeys {
	type: string;
	records: string;
	frequency: string;
	weekday: string;
	monthDay: string;
	intervalDays: string;
	intervalWindowDays: string;
	intervalMode: string;
	time: string;
	goalDirection: string;
	target: string;
	unit: string;
	step: string;
	weeklyTarget: string;
	monthlyTarget: string;
	weeklyPerfect: string;
	monthlyPerfect: string;
	startDate: string;
	pauses: string;
	reschedules: string;
	failed: string;
	skipped: string;
	stopped: string;
	stopDate: string;
	icon: string;
	color: string;
	group: string;
	useGroupColor: string;
	noteFolder: string;
	noteFilenameFormat: string;
	templatePath: string;
	noteCompletionMode: string;
	noteChecklistRequirement: string;
	noteChecklistMin: string;
	noteFailKeyword: string;
	/** Legacy: day comments, before they moved into the note body. */
	comments: string;
}

export const DEFAULT_FRONTMATTER_KEYS: FrontmatterKeys = {
	type: "type",
	records: "records",
	frequency: "frequency",
	weekday: "weekday",
	monthDay: "monthDay",
	intervalDays: "intervalDays",
	intervalWindowDays: "intervalWindowDays",
	intervalMode: "intervalMode",
	time: "time",
	goalDirection: "goalDirection",
	target: "target",
	unit: "unit",
	step: "step",
	weeklyTarget: "weeklyTarget",
	monthlyTarget: "monthlyTarget",
	weeklyPerfect: "weeklyPerfect",
	monthlyPerfect: "monthlyPerfect",
	startDate: "startDate",
	pauses: "pauses",
	reschedules: "reschedules",
	failed: "failed",
	skipped: "skipped",
	stopped: "stopped",
	stopDate: "stopDate",
	icon: "icon",
	color: "color",
	group: "group",
	useGroupColor: "useGroupColor",
	noteFolder: "noteFolder",
	noteFilenameFormat: "noteFilenameFormat",
	templatePath: "templatePath",
	noteCompletionMode: "noteCompletionMode",
	noteChecklistRequirement: "noteChecklistRequirement",
	noteChecklistMin: "noteChecklistMin",
	noteFailKeyword: "noteFailKeyword",
	comments: "comments",
};

/**
 * Connection details for the AI summaries feature. Any OpenAI-compatible
 * chat-completions endpoint works, including local servers (Ollama,
 * LM Studio), in which case the API key may be left blank.
 */
export interface AiSummarySettings {
	/** Endpoint base URL, e.g. `https://api.openai.com/v1`. */
	baseUrl: string;
	/** Bearer token for the endpoint. May be blank for local servers. */
	apiKey: string;
	/** Model name to request, e.g. `gpt-4o-mini`. */
	model: string;
}

export const DEFAULT_AI_SUMMARY: AiSummarySettings = {
	baseUrl: "https://api.openai.com/v1",
	apiKey: "",
	model: "gpt-4o-mini",
};

/**
 * Where and whether the plugin writes reminder checklist lines for the
 * Reminder plugin to pick up. The lines live in a marked block, one per
 * planned time of each habit due that day.
 */
export interface ReminderSettings {
	/** Master switch; off by default. */
	enabled: boolean;
	/**
	 * `daily-note` writes the block into today's daily note (following the
	 * core Daily notes plugin's folder and format, once the note exists);
	 * `fixed-note` keeps it in one dedicated note, created on demand.
	 */
	target: "daily-note" | "fixed-note";
	/** Vault path of the dedicated note when `target` is `fixed-note`. */
	notePath: string;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
	enabled: false,
	target: "daily-note",
	notePath: "Habit reminders.md",
};

/** How the dashboard presents its habit cards. */
export type DashboardLayout = "cards" | "carousel" | "grid" | "vertical" | "compact";

/** User-configurable settings for the plugin. */
export interface HabitsPluginSettings {
	/** Folder that holds one note per habit. */
	habitsFolder: string;
	/**
	 * How the dashboard shows its cards: a paged carousel, a grid that
	 * wraps onto new rows, a fixed-height vertically scrolling grid,
	 * or a compact list with one row per habit.
	 */
	dashboardLayout: DashboardLayout;
	nativeLayout?: "cards" | "dashboard";
	layoutUnified?: boolean;
	/** How many cards are visible at once in the carousel on wide screens. */
	cardsPerView: number;
	/** The base order of habit cards. `name` is the original behaviour. */
	sortMode: HabitSortMode;
	/**
	 * Note paths in the order the user arranged them in settings. Only
	 * consulted when `sortMode` is `manual`; habits missing from the list
	 * (created since it was arranged) go to the end.
	 */
	manualOrder: string[];
	/**
	 * When true (the original behaviour), completed habits drift to the
	 * end of the queue and paused ones park behind them. When false every
	 * card keeps its sorted position.
	 */
	statusOrdering: boolean;
	/**
	 * Show habits in sections by their group, with a group lip on each
	 * card. Off by default.
	 */
	groupsEnabled: boolean;
	/**
	 * Group the rows of `habits-table` blocks by habit group, with a
	 * heading row per group. When false the table is one flat list,
	 * ordered by planned time. On by default.
	 */
	tableGrouping: boolean;
	/** Shared group styling (colour, icon), keyed by group name. */
	groups: Record<string, GroupStyle>;
	/**
	 * Group names in the order their sections should appear. Groups
	 * missing from the list append alphabetically.
	 */
	groupOrder: string[];
	/** How many cards are visible at once on phone-sized screens (1–2). */
	mobileCardsPerView: number;
	/**
	 * When a dashboard is embedded in a daily note (a note whose name
	 * contains a date), open it on that note's date instead of today.
	 */
	followDailyNoteDate: boolean;
	/**
	 * Moment.js format used to read the date from a daily note's name,
	 * e.g. `YYYY-MM-DD` or `YYYYMMDD`.
	 */
	dailyNoteDateFormat: string;
	/** Show the comment flap on dashboard cards. */
	enableComments: boolean;
	/**
	 * Play the completion celebrations: the check swoosh and card
	 * departure, the perfect-day confetti, and the panel row flash.
	 * When off, logging updates the view instantly and quietly.
	 */
	animations: boolean;
	/**
	 * How many habit rows each stats carousel page shows. Only applies
	 * while the layout is `carousel`; grid and vertical layouts show the
	 * stats as one flat list.
	 */
	statsRowsPerPage: number;
	/** Opt-in switches for features that are still being tested. */
	experimental: ExperimentalFlags;
	/** Connection details used when AI summaries are enabled. */
	aiSummary: AiSummarySettings;
	/** Reminder-line generation for the Reminder plugin. */
	reminders: ReminderSettings;
	/**
	 * Snoozed habits: habit note path → when the snooze ends (epoch ms).
	 * Kept here rather than in the habit note because a snooze is
	 * short-lived and never affects stats. Expired entries are pruned
	 * whenever a snooze is set or cleared.
	 */
	snoozes: Record<string, number>;
	/**
	 * Frontmatter property names, so a habit note's frontmatter can share a
	 * note with another plugin's own properties without colliding.
	 */
	frontmatterKeys: FrontmatterKeys;
}

export const DEFAULT_SETTINGS: HabitsPluginSettings = {
	habitsFolder: "Habits",
	dashboardLayout: "carousel",
	cardsPerView: 4,
	sortMode: "name",
	manualOrder: [],
	statusOrdering: true,
	groupsEnabled: false,
	tableGrouping: true,
	groups: {},
	groupOrder: [],
	mobileCardsPerView: 2,
	followDailyNoteDate: true,
	dailyNoteDateFormat: "YYYY-MM-DD",
	enableComments: true,
	animations: true,
	statsRowsPerPage: 4,
	experimental: { ...DEFAULT_EXPERIMENTAL },
	aiSummary: { ...DEFAULT_AI_SUMMARY },
	reminders: { ...DEFAULT_REMINDERS },
	snoozes: {},
	frontmatterKeys: { ...DEFAULT_FRONTMATTER_KEYS },
};

/** The three top-level tabs the settings UI is split into. */
type SettingsTabId = "general" | "experimental" | "advanced";

/** Settings tab shown under Settings → Community plugins → Habits. */
export class HabitsSettingTab extends PluginSettingTab {
	private plugin: HabitsPlugin;

	constructor(app: App, plugin: HabitsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * The drag-to-reorder editor shown when sorting is manual: one slim
	 * row per habit that can be dragged (mouse or touch) into place. The
	 * arranged order is stored as note paths in `manualOrder`.
	 */
	private renderManualOrderEditor(setting: Setting): void {
		setting.settingEl.addClass("habits-order-setting");
		const list = setting.settingEl.createDiv({
			cls: "habits-order-list",
		});
		this.buildOrderList(list);
	}

	private buildOrderList(list: HTMLElement): void {
		list.empty();
		const habits = sortHabits(
			this.plugin.store.getHabits().filter((habit) => !habit.stopped),
			"manual",
			this.plugin.settings.manualOrder,
			this.plugin.settings.groups,
			this.plugin.settings.groupOrder,
		);
		for (const habit of habits) {
			const row = list.createDiv({ cls: "habits-order-row" });
			row.dataset.path = habit.path;
			const accent = habitAccent(habit, this.plugin.settings.groups);
			if (accent) {
				row.setCssProps({ "--habits-accent": accent });
			}
			const grip = row.createSpan({ cls: "habits-order-grip" });
			setIcon(grip, "grip-vertical");
			if (habit.icon) {
				const icon = row.createSpan({ cls: "habits-order-icon" });
				applyHabitIcon(icon, habit.icon);
			}
			row.createSpan({ cls: "habits-order-name", text: habit.name });
			this.registerRowDrag(row, list, ".habits-order-row", () => {
				void this.persistOrder(list);
			});
		}
	}

	/**
	 * The drag-to-reorder editor for group sections, shown while groups
	 * are enabled. Stores the arranged names in `groupOrder`.
	 */
	private renderGroupOrderEditor(setting: Setting): void {
		setting.settingEl.addClass("habits-order-setting");
		const list = setting.settingEl.createDiv({
			cls: "habits-order-list",
		});
		this.buildGroupOrderList(list);
	}

	/** Every known group: in use by a habit, styled, or already ordered. */
	private knownGroups(): string[] {
		const names = new Set<string>();
		for (const habit of this.plugin.store.getHabits()) {
			const group = habit.group.trim();
			if (group && !habit.stopped) {
				names.add(group);
			}
		}
		for (const name of Object.keys(this.plugin.settings.groups)) {
			names.add(name);
		}
		const position = new Map(
			this.plugin.settings.groupOrder.map((name, index) => [
				name,
				index,
			]),
		);
		return Array.from(names).sort((a, b) => {
			const pa = position.get(a) ?? Number.MAX_SAFE_INTEGER;
			const pb = position.get(b) ?? Number.MAX_SAFE_INTEGER;
			return pa - pb || a.localeCompare(b);
		});
	}

	private buildGroupOrderList(list: HTMLElement): void {
		list.empty();
		for (const name of this.knownGroups()) {
			const row = list.createDiv({ cls: "habits-order-row" });
			row.dataset.group = name;
			const style = this.plugin.settings.groups[name];
			if (style?.color) {
				row.setCssProps({ "--habits-accent": style.color });
			}
			const grip = row.createSpan({ cls: "habits-order-grip" });
			setIcon(grip, "grip-vertical");
			if (style?.icon) {
				const icon = row.createSpan({ cls: "habits-order-icon" });
				applyHabitIcon(icon, style.icon);
			}
			row.createSpan({ cls: "habits-order-name", text: name });
			this.registerRowDrag(row, list, ".habits-order-row", () => {
				void this.persistGroupOrder(list);
			});
		}
	}

	/** Store the DOM order of the rows as the new group order. */
	private async persistGroupOrder(list: HTMLElement): Promise<void> {
		const names: string[] = [];
		for (const el of Array.from(
			list.querySelectorAll<HTMLElement>(".habits-order-row"),
		)) {
			if (el.dataset.group) {
				names.push(el.dataset.group);
			}
		}
		this.plugin.settings.groupOrder = names;
		await this.plugin.saveSettings();
	}

	/**
	 * Pointer-based dragging (rather than HTML5 drag events) so the rows
	 * can be rearranged by touch on mobile as well as by mouse. The move
	 * and release listeners sit on the window, not the row: reordering
	 * re-inserts the row into the list, which would clear any pointer
	 * capture on it and kill the drag mid-flight.
	 */
	private registerRowDrag(
		row: HTMLElement,
		list: HTMLElement,
		selector: string,
		onDrop: () => void,
	): void {
		row.addEventListener("pointerdown", (evt: PointerEvent) => {
			if (evt.button !== 0) {
				return;
			}
			evt.preventDefault();
			row.addClass("is-dragging");
			const win = row.win;

			const onMove = (e: PointerEvent): void => {
				const rows = Array.from(
					list.querySelectorAll<HTMLElement>(selector),
				).filter((el) => el !== row);
				const next = rows.find(
					(el) =>
						e.clientY <
						el.getBoundingClientRect().top + el.offsetHeight / 2,
				);
				if (next) {
					if (next !== row.nextElementSibling) {
						list.insertBefore(row, next);
					}
				} else if (list.lastElementChild !== row) {
					list.appendChild(row);
				}
			};
			const onUp = (): void => {
				row.removeClass("is-dragging");
				win.removeEventListener("pointermove", onMove);
				win.removeEventListener("pointerup", onUp);
				win.removeEventListener("pointercancel", onUp);
				onDrop();
			};
			win.addEventListener("pointermove", onMove);
			win.addEventListener("pointerup", onUp);
			win.addEventListener("pointercancel", onUp);
		});
	}

	/** Store the DOM order of the rows as the new manual order. */
	private async persistOrder(list: HTMLElement): Promise<void> {
		const paths: string[] = [];
		for (const el of Array.from(
			list.querySelectorAll<HTMLElement>(".habits-order-row"),
		)) {
			if (el.dataset.path) {
				paths.push(el.dataset.path);
			}
		}
		this.plugin.settings.manualOrder = paths;
		await this.plugin.saveSettings();
	}

	/** Which of the three tabs is currently shown. */
	private activeTab: SettingsTabId = "general";

	/**
	 * Renders the settings tab as three persistent top tabs (General,
	 * Experimental, Advanced) rather than one long scrolling page. Obsidian
	 * has no built-in tab-bar control, so this is hand-rolled; that also
	 * means the plugin's settings are no longer indexed by Obsidian's own
	 * settings search (that only worked through the declarative
	 * getSettingDefinitions() API this tab used to implement, which cannot
	 * coexist with custom chrome drawn around its content).
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const tabBar = containerEl.createDiv({ cls: "habits-settings-tabs" });
		const content = containerEl.createDiv({
			cls: "habits-settings-tab-content",
		});

		const tabs: {
			id: SettingsTabId;
			label: string;
			render: (el: HTMLElement) => void;
		}[] = [
			{
				id: "general",
				label: t("General"),
				render: (el) => this.displayGeneral(el),
			},
			{
				id: "experimental",
				label: t("Experimental"),
				render: (el) => this.displayExperimental(el),
			},
			{
				id: "advanced",
				label: t("Advanced"),
				render: (el) => this.displayAdvanced(el),
			},
		];

		const selectTab = (id: SettingsTabId): void => {
			this.activeTab = id;
			buttons.forEach((button, i) =>
				button.toggleClass("is-active", tabs[i].id === id),
			);
			content.empty();
			tabs.find((tab) => tab.id === id)?.render(content);
		};

		const buttons = tabs.map((tab) => {
			const button = tabBar.createEl("button", {
				cls: "habits-settings-tab",
				text: tab.label,
			});
			button.addEventListener("click", () => selectTab(tab.id));
			return button;
		});

		selectTab(this.activeTab);
	}

	/** General settings: everything that isn't Experimental or Advanced. */
	private displayGeneral(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t("Habits folder"))
			.setDesc(
				t(
					"Folder where each habit is stored as its own note. It is created automatically if it does not exist.",
				),
			)
			.addText((text) => {
				text
					.setPlaceholder("Habits")
					.setValue(this.plugin.settings.habitsFolder)
					.onChange(async (value) => {
						this.plugin.settings.habitsFolder =
							value.trim() || DEFAULT_SETTINGS.habitsFolder;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName(t("Follow daily note date"))
			.setDesc(
				t(
					"When a dashboard is embedded in a daily note (a note whose name contains a date like 2026-07-01), open it on that note's date instead of today.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.followDailyNoteDate)
					.onChange(async (value) => {
						this.plugin.settings.followDailyNoteDate = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("Daily note date format"))
			.setDesc(
				t(
					"Moment.js format used to read the date from a daily note's name, such as YYYY-MM-DD or YYYYMMDD.",
				),
			)
			.addText((text) =>
				text
					.setPlaceholder("YYYY-MM-DD")
					.setValue(this.plugin.settings.dailyNoteDateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dailyNoteDateFormat =
							value.trim() || DEFAULT_SETTINGS.dailyNoteDateFormat;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("Comments on cards"))
			.setDesc(
				t(
					"Show a comment flap on dashboard cards for jotting a note about any day.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableComments)
					.onChange(async (value) => {
						this.plugin.settings.enableComments = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("Completion animations"))
			.setDesc(
				t(
					"Play the check swoosh, card departure, and perfect-day confetti when habits are completed. Turn off for instant, quiet updates.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.animations)
					.onChange(async (value) => {
						this.plugin.settings.animations = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName(t("Layout")).setHeading();

		new Setting(containerEl).setName(t("Task Genius habit layout"))
			.setDesc(t("Choose the page layout. Habit goals, schedules and records stay the same."))
			.addDropdown(dropdown => dropdown
				.addOption("cards", t("Task Genius cards"))
				.addOption("compact", t("Compact list"))
				.addOption("grid", t("Grid"))
				.addOption("carousel", t("Carousel"))
				.addOption("vertical", t("Vertical scroll"))
				.setValue(this.plugin.settings.dashboardLayout).onChange(async value => {
					this.plugin.settings.dashboardLayout = value as DashboardLayout;
					delete this.plugin.settings.nativeLayout;
					await this.plugin.saveSettings();
					renderStatsOptions();
				}));

		new Setting(containerEl)
			.setName(t("Cards per view"))
			.setDesc(
				t(
					"How many habit cards fit side by side on wider screens.",
				),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("1", "1")
					.addOption("2", "2")
					.addOption("3", "3")
					.addOption("4", "4")
					.setValue(String(this.plugin.settings.cardsPerView))
					.onChange(async (value) => {
						this.plugin.settings.cardsPerView = Number(value);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("Cards per view on mobile"))
			.setDesc(
				t(
					"How many habit cards fit side by side on phone-sized screens.",
				),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("1", "1")
					.addOption("2", "2")
					.setValue(
						String(this.plugin.settings.mobileCardsPerView),
					)
					.onChange(async (value) => {
						this.plugin.settings.mobileCardsPerView =
							Number(value);
						await this.plugin.saveSettings();
					}),
			);

		// In its own container so changing the layout can redraw just
		// this block instead of the whole tab.
		const statsDetails = containerEl.createDiv();
		const renderStatsOptions = (): void => {
			statsDetails.empty();
			if (this.plugin.settings.dashboardLayout !== "carousel") {
				return;
			}
			new Setting(statsDetails)
				.setName(t("Stats rows per page"))
				.setDesc(t("How many habits each stats page shows."))
				.addDropdown((dropdown) => {
					for (let n = 1; n <= 8; n++) {
						dropdown.addOption(String(n), String(n));
					}
					dropdown
						.setValue(
							String(this.plugin.settings.statsRowsPerPage),
						)
						.onChange(async (value) => {
							this.plugin.settings.statsRowsPerPage =
								Number(value);
							await this.plugin.saveSettings();
						});
				});
		};
		renderStatsOptions();

		new Setting(containerEl).setName(t("Sorting")).setHeading();

		new Setting(containerEl)
			.setName(t("Sort habits by"))
			.setDesc(
				t(
					"The base order of habit cards in the dashboard and side panel.",
				),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("name", t("Name (A–Z)"))
					.addOption("color", t("Color"))
					.addOption("startDate", t("Start date"))
					.addOption("lastLogged", t("Last logged"))
					.addOption("time", t("Planned time"))
					.addOption("group", t("Group"))
					.addOption("manual", t("Manual"))
					.setValue(this.plugin.settings.sortMode)
					.onChange(async (value) => {
						this.plugin.settings.sortMode = [
							"name",
							"color",
							"startDate",
							"lastLogged",
							"time",
							"group",
							"manual",
						].includes(value)
							? (value as HabitSortMode)
							: "name";
						await this.plugin.saveSettings();
						manualOrderSetting.settingEl.toggle(
							this.plugin.settings.sortMode === "manual",
						);
						groupOrderSetting.settingEl.toggle(
							this.plugin.settings.sortMode === "group",
						);
					}),
			);

		// Always rendered, shown only while sorting is manual.
		const manualOrderSetting = new Setting(containerEl)
			.setName(t("Manual order"))
			.setDesc(
				t(
					"Drag the cards into the order you want. New habits join the end of the list.",
				),
			);
		this.renderManualOrderEditor(manualOrderSetting);
		manualOrderSetting.settingEl.toggle(
			this.plugin.settings.sortMode === "manual",
		);

		// Always rendered, shown only while sorting by group.
		const groupOrderSetting = new Setting(containerEl)
			.setName(t("Group order"))
			.setDesc(
				t(
					"Drag the groups into the order you want. Sections follow the same order.",
				),
			);
		this.renderGroupOrderEditor(groupOrderSetting);
		groupOrderSetting.settingEl.toggle(
			this.plugin.settings.sortMode === "group",
		);

		new Setting(containerEl)
			.setName(t("Move completed cards to the end"))
			.setDesc(
				t(
					"Completed habits drift to the end of the queue and paused ones park behind them. Turn this off to keep every card in its sorted position.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.statusOrdering)
					.onChange(async (value) => {
						this.plugin.settings.statusOrdering = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName(t("Groups")).setHeading();

		new Setting(containerEl)
			.setName(t("Enable groups"))
			.setDesc(
				t(
					"Show habits in sections by their group, with a group lip on each card.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.groupsEnabled)
					.onChange(async (value) => {
						this.plugin.settings.groupsEnabled = value;
						await this.plugin.saveSettings();
						groupDetails.toggle(value);
					}),
			);

		// The group tools only matter while groups are on.
		const groupDetails = containerEl.createDiv();
		new Setting(groupDetails)
			.setName(t("Manage groups"))
			.setDesc(
				t("See every habit by group and drag cards between groups."),
			)
			.addButton((button) =>
				button.setButtonText(t("Open")).onClick(() => {
					new GroupsModal(
						this.app,
						this.plugin.store,
						() => this.plugin.settings,
						() => this.plugin.saveSettings(),
					).open();
				}),
			);
		groupDetails.toggle(this.plugin.settings.groupsEnabled);

		this.displayReminders(containerEl);
	}

	/** Reminder-line generation for the Reminder plugin. */
	private displayReminders(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("Reminders")).setHeading();

		new Setting(containerEl)
			.setName(t("Write reminders for due habits"))
			.setDesc(
				t(
					"Each day, write one reminder checklist line per planned time of every habit due that day, in the format the Reminder plugin picks up. The lines live in a marked block and refresh as you log habits.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.reminders.enabled)
					.onChange(async (value) => {
						this.plugin.settings.reminders.enabled = value;
						await this.plugin.saveSettings();
						reminderDetails.toggle(value);
						notePathSetting.settingEl.toggle(
							value &&
								this.plugin.settings.reminders.target ===
									"fixed-note",
						);
					}),
			);

		const reminderDetails = containerEl.createDiv();
		new Setting(reminderDetails)
			.setName(t("Where to write reminders"))
			.setDesc(
				t(
					"The daily note follows the Daily notes core plugin's folder and date format; the block is added once the note exists. A fixed note is created automatically.",
				),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("daily-note", t("Today's daily note"))
					.addOption("fixed-note", t("A fixed note"))
					.setValue(this.plugin.settings.reminders.target)
					.onChange(async (value) => {
						this.plugin.settings.reminders.target =
							value === "fixed-note" ? "fixed-note" : "daily-note";
						await this.plugin.saveSettings();
						notePathSetting.settingEl.toggle(
							this.plugin.settings.reminders.target ===
								"fixed-note",
						);
					}),
			);

		const notePathSetting = new Setting(reminderDetails)
			.setName(t("Reminder note path"))
			.setDesc(
				t("Vault path of the note that holds the reminder block."),
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_REMINDERS.notePath)
					.setValue(this.plugin.settings.reminders.notePath)
					.onChange(async (value) => {
						this.plugin.settings.reminders.notePath =
							value.trim() || DEFAULT_REMINDERS.notePath;
						await this.plugin.saveSettings();
					}),
			);
		reminderDetails.toggle(this.plugin.settings.reminders.enabled);
		notePathSetting.settingEl.toggle(
			this.plugin.settings.reminders.enabled &&
				this.plugin.settings.reminders.target === "fixed-note",
		);
	}

	/**
	 * Opt-in toggles for features still being tested. Turning a flag off
	 * only hides the feature's entry points; anything already created with
	 * it keeps working and keeps its meaning.
	 */
	private displayExperimental(containerEl: HTMLElement): void {
		containerEl.createEl("p", {
			cls: "habits-experimental-note",
			text: t(
				"These features are still being tested and may change before they become permanent. Turning one off only hides it from menus — anything you created with it keeps working.",
			),
		});

		new Setting(containerEl)
			.setName(t("Note habits"))
			.setDesc(
				t(
					"Track a habit by writing in a per-day note instead of logging a value by hand. A day is complete once the note reaches a character count or every task in it is checked. Works with the Templater plugin to create each day's note from a template.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.experimental.noteHabits)
					.onChange(async (value) => {
						this.plugin.settings.experimental.noteHabits = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("Reschedule missed habits"))
			.setDesc(
				t(
					"Add a notification button to the dashboard and sidebar panel when a habit's been missed, opening a review of missed days you can move onto a different one (never a day that habit is already due, so nothing doubles up).",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.experimental.rescheduling)
					.onChange(async (value) => {
						this.plugin.settings.experimental.rescheduling = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("AI summaries"))
			.setDesc(
				t(
					"Show an AI-generated summary with feedback and advice on the stats page tabs. Uses an OpenAI-compatible service you configure below; your habit stats are sent to it only when you press the generate button.",
				),
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.experimental.aiSummaries)
					.onChange(async (value) => {
						this.plugin.settings.experimental.aiSummaries = value;
						await this.plugin.saveSettings();
						// Show or hide the connection fields with the toggle.
						renderAiFields();
					}),
			);

		// The connection fields live in their own container so toggling the
		// feature can redraw just this block instead of the whole tab.
		const aiDetails = containerEl.createDiv();
		const renderAiFields = (): void => {
			aiDetails.empty();
			if (this.plugin.settings.experimental.aiSummaries) {
				this.displayAiSummary(aiDetails);
			}
		};
		renderAiFields();
	}

	/** Connection fields for the AI summaries feature (shown only when on). */
	private displayAiSummary(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t("AI base URL"))
			.setDesc(
				t(
					"Base URL of an OpenAI-compatible API. Works with OpenAI, OpenRouter, or local servers like Ollama (http://localhost:11434/v1).",
				),
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_AI_SUMMARY.baseUrl)
					.setValue(this.plugin.settings.aiSummary.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.aiSummary.baseUrl =
							value.trim() || DEFAULT_AI_SUMMARY.baseUrl;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("AI API key"))
			.setDesc(
				t(
					"Stored locally in this vault's plugin data. Leave blank for local servers that need no key.",
				),
			)
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setValue(this.plugin.settings.aiSummary.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.aiSummary.apiKey = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(t("AI model"))
			.setDesc(t("Model name the service should use."))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_AI_SUMMARY.model)
					.setValue(this.plugin.settings.aiSummary.model)
					.onChange(async (value) => {
						this.plugin.settings.aiSummary.model =
							value.trim() || DEFAULT_AI_SUMMARY.model;
						await this.plugin.saveSettings();
					}),
			);
	}

	/** Content of the "Advanced" tab: frontmatter property-key remapping. */
	private displayAdvanced(containerEl: HTMLElement): void {
		new FrontmatterKeysEditor(this.app, this.plugin).render(containerEl);
	}
}

/**
 * Human-readable label for each configurable frontmatter key, grouped the
 * way they're presented in the Advanced page/section.
 */
const FRONTMATTER_KEY_GROUPS: {
	heading: () => string;
	fields: [keyof FrontmatterKeys, () => string][];
}[] = [
	{
		heading: () => t("Identity"),
		fields: [
			["type", () => t("Habit type key")],
			["records", () => t("Completion records key")],
		],
	},
	{
		heading: () => t("Schedule"),
		fields: [
			["frequency", () => t("Frequency key")],
			["weekday", () => t("Weekday key")],
			["monthDay", () => t("Month day key")],
			["intervalDays", () => t("Interval days key")],
			["intervalWindowDays", () => t("Interval window days key")],
			["intervalMode", () => t("Interval schedule key")],
			["time", () => t("Planned time key")],
		],
	},
	{
		heading: () => t("Goal"),
		fields: [
			["goalDirection", () => t("Goal direction key")],
			["target", () => t("Target key")],
			["unit", () => t("Unit key")],
			["step", () => t("Step size key")],
			["weeklyTarget", () => t("Weekly target key")],
			["monthlyTarget", () => t("Monthly target key")],
			["weeklyPerfect", () => t("Weekly perfect key")],
			["monthlyPerfect", () => t("Monthly perfect key")],
		],
	},
	{
		heading: () => t("Lifecycle"),
		fields: [
			["startDate", () => t("Start date key")],
			["pauses", () => t("Pauses key")],
			["reschedules", () => t("Reschedules key")],
			["failed", () => t("Failed days key")],
			["skipped", () => t("Skipped days key")],
			["stopped", () => t("Stopped key")],
			["stopDate", () => t("Stop date key")],
		],
	},
	{
		heading: () => t("Presentation"),
		fields: [
			["icon", () => t("Icon key")],
			["color", () => t("Color key")],
			["group", () => t("Group key")],
			["useGroupColor", () => t("Use group color key")],
		],
	},
	{
		heading: () => t("Note habit"),
		fields: [
			["noteFolder", () => t("Note folder key")],
			["noteFilenameFormat", () => t("Note filename format key")],
			["templatePath", () => t("Template path key")],
			["noteCompletionMode", () => t("Note completion mode key")],
			[
				"noteChecklistRequirement",
				() => t("Note checklist requirement key"),
			],
			["noteChecklistMin", () => t("Note checklist minimum key")],
			["noteFailKeyword", () => t("Note fail keyword key")],
		],
	},
	{
		heading: () => t("Legacy"),
		fields: [["comments", () => t("Legacy comments key")]],
	},
];

/**
 * Editor for the frontmatter-key remapping, rendered inline into the
 * "Advanced" tab's content by {@link HabitsSettingTab.displayAdvanced}.
 *
 * Edits are held locally until "Apply key changes" is pressed: applying
 * validates the whole set at once (no blanks, no two fields sharing a key),
 * confirms with the user via {@link ConfirmModal}, then moves each renamed
 * field's existing value onto its new key across every habit note before
 * saving the setting — see {@link HabitStore.renameFrontmatterKeys}.
 */
class FrontmatterKeysEditor {
	private pending: FrontmatterKeys;
	private applySetting?: Setting;

	constructor(
		private app: App,
		private plugin: HabitsPlugin,
	) {
		this.pending = { ...this.plugin.settings.frontmatterKeys };
	}

	render(containerEl: HTMLElement): void {
		containerEl.createEl("p", {
			cls: "habits-advanced-note",
			text: t(
				"Rename the frontmatter properties habit notes use. Useful for avoiding collisions with another plugin's own properties in the same note (for example TaskNotes).",
			),
		});

		for (const group of FRONTMATTER_KEY_GROUPS) {
			new Setting(containerEl).setName(group.heading()).setHeading();
			for (const [field, label] of group.fields) {
				const setting = new Setting(containerEl).setName(label());
				if (field === "records") {
					setting.setDesc(
						t(
							"Renaming this away from the default also changes how binary habits log a day: instead of {\"2026-08-25\": 1}, a completed day becomes a bare date, like [\"2026-08-25\"] — the shape TaskNotes uses for complete_instances. Repetition and timed habits are unaffected either way; they always need a value, never just a date.",
						),
					);
				}
				setting.addText((text) =>
					text.setValue(this.pending[field]).onChange((value) => {
						this.pending[field] = value;
						this.refreshApplyVisibility();
					}),
				);
			}
		}

		this.applySetting = new Setting(containerEl).addButton((button) =>
			button
				.setButtonText(t("Apply key changes"))
				.setCta()
				.onClick(() => {
					void this.apply();
				}),
		);
		this.refreshApplyVisibility();
	}

	private isDirty(): boolean {
		const saved = this.plugin.settings.frontmatterKeys;
		return (Object.keys(this.pending) as (keyof FrontmatterKeys)[]).some(
			(field) => this.pending[field].trim() !== saved[field],
		);
	}

	private refreshApplyVisibility(): void {
		this.applySetting?.settingEl.toggle(this.isDirty());
	}

	private async apply(): Promise<void> {
		const saved = this.plugin.settings.frontmatterKeys;
		const fields = Object.keys(this.pending) as (keyof FrontmatterKeys)[];

		const seen = new Map<string, keyof FrontmatterKeys>();
		for (const field of fields) {
			const value = this.pending[field].trim();
			if (!value) {
				new Notice(t("Property keys can't be empty."));
				return;
			}
			this.pending[field] = value;
			const clash = seen.get(value);
			if (clash) {
				new Notice(
					t(
						'"{a}" and "{b}" can\'t use the same property key ("{value}").',
						{ a: clash, b: field, value },
					),
				);
				return;
			}
			seen.set(value, field);
		}

		const renames = fields
			.filter((field) => this.pending[field] !== saved[field])
			.map((field) => ({ old: saved[field], new: this.pending[field] }));
		if (renames.length === 0) {
			return;
		}

		const summary = renames
			.map((r) => `"${r.old}" → "${r.new}"`)
			.join(", ");
		const count = this.plugin.store.getHabits().length;
		new ConfirmModal(this.app, {
			title: t("Apply key changes"),
			message: t(
				"This renames {summary} in every note in your habits folder ({count} habit(s) currently). Existing values are moved, not discarded. Continue?",
				{ summary, count },
			),
			confirmText: t("Apply"),
			onConfirm: async () => {
				// Settings are saved *before* the notes are rewritten: the
				// rewrite fires metadataCache "changed" events for each
				// file as it's touched, and anything reacting to those
				// (e.g. a habit-metrics block) must already see the new
				// key mapping — otherwise it re-reads a note whose data
				// just moved to the new key using the old one, finds
				// nothing, and stays empty until something else happens
				// to trigger a further refresh.
				this.plugin.settings.frontmatterKeys = { ...this.pending };
				await this.plugin.saveSettings();
				const changed =
					await this.plugin.store.renameFrontmatterKeys(renames);
				new Notice(
					t("Updated the frontmatter keys in {count} note(s).", {
						count: changed,
					}),
				);
				this.refreshApplyVisibility();
			},
		}).open();
	}
}
