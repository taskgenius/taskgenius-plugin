/**
 * The four kinds of habit the plugin can track.
 *
 * - `binary`: done or not done on a given day.
 * - `repetition`: a count towards a target (e.g. 8 cups of water).
 * - `timed`: minutes spent towards a target (e.g. 30 minutes of exercise).
 * - `note`: writing in a per-day note, completed by reaching a character
 *   count, satisfying a checklist requirement, or both. See the `note*`
 *   fields below.
 */
export type HabitType = "binary" | "repetition" | "timed" | "note";

/**
 * How a `note` habit's day is marked complete.
 *
 * - `chars`: the note's character count (frontmatter stripped) reaches
 *   `target`.
 * - `checklist`: the checklist requirement in {@link NoteChecklistRequirement}
 *   is met.
 * - `both`: both of the above must be true. `records` stores the lower of
 *   the two fractions, scaled to `target` (the character goal), so the
 *   plugin's existing `value >= target` completion check only fires once
 *   neither condition is the bottleneck.
 *
 * Regardless of mode, a checked item matching `noteFailKeyword` (if set)
 * forces the day to `0` — an automatic fail that overrides everything else.
 */
export type NoteCompletionMode = "chars" | "checklist" | "both";

/**
 * How a `note` habit's checklist requirement is satisfied.
 *
 * - `all`: every task-list item must be checked. Stored as a 0–100
 *   percentage in `records` (against a fixed `target` of 100), since the
 *   number of tasks can differ from day to day.
 * - `count`: at least `noteChecklistMin` items must be checked — any of
 *   them, not a specific one. Stored as the raw checked count in `records`
 *   (against `target` = `noteChecklistMin`). Suits a checklist of
 *   alternatives (e.g. "cardio" / "weights" / "rest day") where doing any
 *   one of them counts.
 */
export type NoteChecklistRequirement = "all" | "count";

/**
 * How often a habit is due.
 *
 * - `daily`: due every day (the original behaviour).
 * - `weekly`: due on one or more chosen weekdays each week.
 * - `monthly`: due once a month, on a chosen day of the month.
 * - `interval`: due every N days, counted from the habit's start date
 *   (e.g. every 2 days for an alternate-day schedule).
 * - `flexibleWeekly`: due a set number of times each week, on any day the
 *   user chooses (e.g. kayaking once a week, whichever day is free).
 *   For `max` habits this is a cumulative weekly limit instead.
 * - `flexibleMonthly`: the same idea, scored over a calendar month.
 *   For `max` habits this is a cumulative monthly limit.
 *
 * `target` holds the "how many times" for the two flexible frequencies —
 * see {@link HabitDefinition.target}.
 */
export type HabitFrequency =
	| "daily"
	| "weekly"
	| "monthly"
	| "interval"
	| "flexibleWeekly"
	| "flexibleMonthly";

/**
 * Which way a habit's goal points.
 *
 * - `min`: reach a target — the classic habit (do at least this much).
 * - `max`: stay under a limit — for habits being reduced or avoided
 *   (e.g. at most 2 hours of gaming, or no smoking at all).
 *
 * Absent from frontmatter means `min`, so every note written before this
 * field existed keeps its original meaning untouched.
 */
export type GoalDirection = "min" | "max";

/**
 * The base order of habit cards in the dashboard and side panel.
 *
 * - `name`: alphabetical by note name (the original behaviour).
 * - `color`: by accent colour hue, so similar colours sit together.
 * - `startDate`: oldest habit first — the order habits were created in.
 * - `lastLogged`: most recently logged first.
 * - `time`: by first planned time — the day's timeline; untimed habits last.
 * - `group`: by group, following the arranged group order.
 * - `manual`: the order the user arranged in settings.
 */
export type HabitSortMode =
	| "name"
	| "color"
	| "startDate"
	| "lastLogged"
	| "time"
	| "group"
	| "manual";

/**
 * Shared styling for a group, stored once in the plugin settings (keyed
 * by group name) so every member card stays in step and renaming a
 * habit's group re-links it instead of duplicating style per note.
 */
export interface GroupStyle {
	/** Optional accent colour shared by the group ("" = none). */
	color: string;
	/** Optional Lucide icon id or emoji shown in group lips and headers. */
	icon: string;
}

/**
 * A period during which a habit was paused (inclusive of both ends).
 * An empty `end` means the pause is still ongoing.
 */
export interface HabitPause {
	start: string;
	end: string;
}

/**
 * A missed due day moved onto a different day (experimental). `from` stops
 * counting as due; `to` — which must not already be due on its own —
 * becomes due in its place and inherits its completion. Each date may
 * appear in at most one reschedule, on one side only: chaining a
 * rescheduled day into a second reschedule isn't supported.
 */
export interface HabitReschedule {
	/** The original due date, `YYYY-MM-DD`, this instance was moved from. */
	from: string;
	/** The date, `YYYY-MM-DD`, it was moved to. */
	to: string;
}

/**
 * A single habit, parsed from a note in the habits folder.
 *
 * The note's frontmatter holds the definition, and a `records` map holds the
 * value logged for each day (keyed by `YYYY-MM-DD`).
 */
export interface HabitDefinition {
	/** Path of the backing note. Used as a stable identifier. */
	path: string;
	/** Display name, taken from the note's basename. */
	name: string;
	/** The kind of habit. */
	type: HabitType;
	/**
	 * Whether the goal is a target to reach (`min`) or a limit to stay
	 * under (`max`). For `max` habits `target` is the limit — `0` means
	 * "none at all" — and a binary `max` habit's limit is always `0`
	 * (any logged value is a slip).
	 */
	goalDirection: GoalDirection;
	/** How often the habit is due. Defaults to `daily`. */
	frequency: HabitFrequency;
	/**
	 * Days of the week a weekly habit is due, as JavaScript `getDay` values
	 * (`0` = Sunday … `6` = Saturday), sorted and without duplicates. Only
	 * meaningful when `frequency` is `weekly`. Stored in frontmatter as a
	 * scalar `weekday` when there is one day (the original format) or as a
	 * `weekdays` list when there are several.
	 */
	weekdays: number[];
	/**
	 * Day of the month a monthly habit is due (`1`–`31`). Only meaningful when
	 * `frequency` is `monthly`. In months shorter than the chosen day it is
	 * clamped to the last day of that month (so `31` acts as "last day").
	 */
	monthDay: number;
	/**
	 * Number of days between due dates (`2`–`365`), counted from the habit's
	 * start date. Only meaningful when `frequency` is `interval`; `2` gives an
	 * alternate-day schedule.
	 */
	intervalDays: number;
	/** Number of consecutive days available to log one interval occurrence. */
	intervalWindowDays?: number;
	/** Fixed calendar cycle, or a new interval after actual completion. */
	intervalMode?: "fixed" | "completion";
	/**
	 * Optional times of day the habit is planned for, as 24-hour `HH:mm`
	 * strings, sorted and without duplicates — one entry for a once-a-day
	 * plan, several for e.g. twice-daily medication. Purely informational:
	 * they are shown alongside the schedule on the habit's card and never
	 * affect when the habit is due. Stored in frontmatter as a scalar
	 * `time` when there is one, or a `times` list when there are several.
	 * Empty means no planned time.
	 */
	times: string[];
	/**
	 * Daily target. For `repetition` this is a count; for `timed` it is a
	 * number of minutes. Ignored for `binary` — except when `frequency` is
	 * `flexibleWeekly`/`flexibleMonthly`, where `target` instead holds the
	 * number of times (for `binary`) or the cumulative amount (for
	 * `repetition`/`timed`) required somewhere within the period.
	 */
	target: number;
	/** Optional unit label shown next to the value (e.g. "cups"). */
	unit: string;
	/**
	 * How much one +/− press adds or removes for a `repetition` habit
	 * (e.g. 0.25 for litres). `1` by default; ignored for other types. See
	 * {@link stepOf}.
	 */
	step: number;
	/**
	 * Optional weekly goal: the number of days the daily goal should be met.
	 * `0` means no target. Ignored when `weeklyPerfect` is true.
	 */
	weeklyTarget: number;
	/** Optional monthly goal, interpreted like `weeklyTarget`. */
	monthlyTarget: number;
	/** When true, the weekly goal is every day of the week. */
	weeklyPerfect: boolean;
	/** When true, the monthly goal is every day of the month. */
	monthlyPerfect: boolean;
	/** Optional Lucide icon id shown on the card. */
	icon: string;
	/** Optional accent colour (any valid CSS colour). */
	color: string;
	/**
	 * Optional group name used to build dashboard sections (e.g. an area
	 * of responsibility). Empty means ungrouped.
	 */
	group: string;
	/**
	 * When true and the habit's group has a colour, the card is shown in
	 * the group colour instead of its own.
	 */
	useGroupColor: boolean;
	/**
	 * Obsidian tags on the note (no leading `#`), stored in the note's
	 * native `tags` property rather than through the configurable
	 * frontmatter keys — useful for making a habit recognisable to another
	 * plugin's own tag-based rules, e.g. TaskNotes' task tag.
	 */
	tags: string[];
	/** Date the habit started, as `YYYY-MM-DD`. */
	startDate: string;
	/** True while an open pause exists. Paused days are skipped by stats. */
	paused: boolean;
	/** Every pause period recorded for the habit, including any open one. */
	pauses: HabitPause[];
	/**
	 * Missed due days moved onto a different day (experimental —
	 * `experimental.rescheduling`). See {@link HabitReschedule}.
	 */
	reschedules: HabitReschedule[];
	/**
	 * Days the user closed as failed ("Fail for today"), as `YYYY-MM-DD`.
	 * A failed day is hidden from that day's lists and always counts as a
	 * miss, even for a limit habit or a value logged earlier. Flexible
	 * habits only hide the card: one day can't fail a weekly quota.
	 */
	failed: string[];
	/**
	 * Days the user skipped ("Skip for today"), as `YYYY-MM-DD`. A skipped
	 * day is hidden and treated exactly like a one-day pause, so it never
	 * counts for or against the habit.
	 */
	skipped: string[];
	/** True when the habit is no longer tracked but keeps its history. */
	stopped: boolean;
	/** Date tracking stopped, as `YYYY-MM-DD` (empty when tracking). */
	stopDate: string;
	/**
	 * Logged values keyed by day (`YYYY-MM-DD`).
	 *
	 * - `binary`: `1` for done, `0`/absent for not done.
	 * - `repetition`: the count logged that day.
	 * - `timed`: the number of minutes logged that day.
	 */
	records: Record<string, number>;
	/** Per-day comments keyed by `YYYY-MM-DD`. */
	comments: Record<string, string>;
	/**
	 * Folder that holds this habit's per-day notes. Only meaningful when
	 * `type` is `note`.
	 */
	noteFolder: string;
	/**
	 * Moment.js format used to name each day's note (e.g. `YYYY-MM-DD`).
	 * May contain `/` to file notes into date-based subfolders. Only
	 * meaningful when `type` is `note`.
	 */
	noteFilenameFormat: string;
	/**
	 * Optional vault path of a template note applied when a day's note is
	 * created. Expanded through Templater when that plugin is installed;
	 * otherwise copied verbatim. Only meaningful when `type` is `note`.
	 */
	templatePath: string;
	/** How a `note` habit's day is marked complete. */
	noteCompletionMode: NoteCompletionMode;
	/**
	 * How a `note` habit's checklist requirement is satisfied. Only
	 * meaningful when `noteCompletionMode` is `checklist` or `both`.
	 */
	noteChecklistRequirement: NoteChecklistRequirement;
	/**
	 * Minimum number of checklist items that must be checked when
	 * `noteChecklistRequirement` is `count`.
	 */
	noteChecklistMin: number;
	/**
	 * Case-insensitive text a checklist item's label must contain, when
	 * checked, to force the day to fail regardless of every other
	 * condition (e.g. a "Slipped" item). Empty disables the feature. Only
	 * meaningful when `type` is `note`.
	 */
	noteFailKeyword: string;
}

/** Options used when creating a new habit note. */
export interface NewHabitOptions {
	name: string;
	type: HabitType;
	goalDirection: GoalDirection;
	frequency: HabitFrequency;
	weekdays: number[];
	monthDay: number;
	intervalDays: number;
	intervalWindowDays?: number;
	/** Fixed calendar cycle, or a new interval after actual completion. */
	intervalMode?: "fixed" | "completion";
	restartIntervalCycle?: boolean;
	times: string[];
	target: number;
	unit: string;
	step: number;
	weeklyTarget: number;
	monthlyTarget: number;
	weeklyPerfect: boolean;
	monthlyPerfect: boolean;
	icon: string;
	color: string;
	group: string;
	useGroupColor: boolean;
	tags: string[];
	noteFolder: string;
	noteFilenameFormat: string;
	templatePath: string;
	noteCompletionMode: NoteCompletionMode;
	noteChecklistRequirement: NoteChecklistRequirement;
	noteChecklistMin: number;
	noteFailKeyword: string;
}
