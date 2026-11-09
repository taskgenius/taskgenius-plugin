import { isDue, isComplete, isRescheduleTargetOpen, isRescheduleEligible } from "./stats";
import { App, normalizePath, Notice, TFile, TFolder } from "obsidian";
import {
	DEFAULT_FRONTMATTER_KEYS,
	type FrontmatterKeys,
	type HabitsPluginSettings,
} from "./settings";
import type {
	GroupStyle,
	HabitDefinition,
	HabitFrequency,
	HabitPause,
	HabitReschedule,
	HabitType,
	NewHabitOptions,
	NoteChecklistRequirement,
	NoteCompletionMode,
} from "./types";
import {
	addDays,
	isFlexibleFrequency,
	roundValue,
	sanitizeFileName,
	toDateKey,
} from "./utils";
import { tagsInComments } from "./comment-text";
import { applyCommentLog, parseCommentLog } from "./comment-log";
import { t } from "./i18n";
import { DEFAULT_NOTE_FILENAME_FORMAT } from "./note-habit";

const HABIT_TYPES: readonly HabitType[] = [
	"binary",
	"repetition",
	"timed",
	"note",
];
const HABIT_FREQUENCIES: readonly HabitFrequency[] = [
	"daily",
	"weekly",
	"monthly",
	"interval",
	"flexibleWeekly",
	"flexibleMonthly",
];
const NOTE_COMPLETION_MODES: readonly NoteCompletionMode[] = [
	"chars",
	"checklist",
	"both",
];
const NOTE_CHECKLIST_REQUIREMENTS: readonly NoteChecklistRequirement[] = [
	"all",
	"count",
];

function isHabitType(value: unknown): value is HabitType {
	return (
		typeof value === "string" &&
		(HABIT_TYPES as readonly string[]).includes(value)
	);
}

function isNoteCompletionMode(value: unknown): value is NoteCompletionMode {
	return (
		typeof value === "string" &&
		(NOTE_COMPLETION_MODES as readonly string[]).includes(value)
	);
}

function isNoteChecklistRequirement(
	value: unknown,
): value is NoteChecklistRequirement {
	return (
		typeof value === "string" &&
		(NOTE_CHECKLIST_REQUIREMENTS as readonly string[]).includes(value)
	);
}

function isHabitFrequency(value: unknown): value is HabitFrequency {
	return (
		typeof value === "string" &&
		(HABIT_FREQUENCIES as readonly string[]).includes(value)
	);
}

/** Shallow equality for a day-keyed comment map. */
function sameComments(
	a: Record<string, string>,
	b: Record<string, string>,
): boolean {
	const keys = Object.keys(a);
	return (
		keys.length === Object.keys(b).length &&
		keys.every((key) => a[key] === b[key])
	);
}

/**
 * Reads and writes habit notes in the configured folder.
 *
 * Each habit is a single note whose frontmatter defines it and whose `records`
 * map stores the value logged for each day.
 */
export class HabitStore {
	/**
	 * Day comments read from each note's body, keyed by note path.
	 *
	 * The body can only be read asynchronously, but `getHabits` is
	 * synchronous and called on every render, so the text is cached here
	 * and refreshed whenever a habit note changes on disk.
	 */
	private commentCache = new Map<string, Record<string, string>>();

	constructor(
		private app: App,
		private getSettings: () => HabitsPluginSettings,
		private saveSettings: () => Promise<void>,
	) {}

	/** True when the path lives inside the configured habits folder. */
	isHabitFile(path: string): boolean {
		const folder = this.folderPath;
		return path === folder || path.startsWith(`${folder}/`);
	}

	/**
	 * Read every habit note's comment section into the cache. Returns true
	 * when anything changed, so the caller can refresh open views.
	 */
	async primeComments(): Promise<boolean> {
		let changed = false;
		for (const file of this.habitFiles()) {
			changed = (await this.refreshComments(file)) || changed;
		}
		return changed;
	}

	/** Re-read one note's comment section. Returns true when it changed. */
	async refreshComments(file: TFile): Promise<boolean> {
		const content = await this.app.vault.cachedRead(file);
		return this.putComments(file.path, parseCommentLog(content));
	}

	/** Drop a note from the cache, e.g. after a delete or rename. */
	forgetComments(path: string): void {
		this.commentCache.delete(path);
	}

	/** Store parsed comments, reporting whether they differ from the cache. */
	private putComments(
		path: string,
		comments: Record<string, string>,
	): boolean {
		const previous = this.commentCache.get(path);
		if (previous && sameComments(previous, comments)) {
			return false;
		}
		if (Object.keys(comments).length === 0) {
			this.commentCache.delete(path);
			return previous !== undefined;
		}
		this.commentCache.set(path, comments);
		return true;
	}

	private get folderPath(): string {
		return normalizePath(this.getSettings().habitsFolder);
	}

	/** The configured frontmatter property name for each stored field. */
	private keys(): FrontmatterKeys {
		return this.getSettings().frontmatterKeys;
	}

	/** Shared styling (colour, icon) for a group, if any is stored. */
	getGroupStyle(name: string): GroupStyle | undefined {
		return this.getSettings().groups[name.trim()];
	}

	/**
	 * Store or clear a group's shared styling. Passing a style with no
	 * colour and no icon (or `null`) removes the entry.
	 */
	async setGroupStyle(
		name: string,
		style: GroupStyle | null,
	): Promise<void> {
		const key = name.trim();
		if (!key) {
			return;
		}
		const groups = this.getSettings().groups;
		const existing = groups[key];
		if (style && (style.color || style.icon)) {
			if (
				existing &&
				existing.color === style.color &&
				existing.icon === style.icon
			) {
				return;
			}
			groups[key] = { color: style.color, icon: style.icon };
		} else {
			if (!existing) {
				return;
			}
			delete groups[key];
		}
		await this.saveSettings();
	}

	/** Create the habits folder if it does not already exist. */
	async ensureFolderExists(): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(this.folderPath);
		if (existing instanceof TFolder) {
			return;
		}
		await this.app.vault.createFolder(this.folderPath);
	}

	/** Return every habit defined in the folder, sorted by name. */
	getHabits(): HabitDefinition[] {
		const habits: HabitDefinition[] = [];
		for (const file of this.habitFiles()) {
			const habit = this.parseFile(file);
			if (habit) {
				habits.push(habit);
			}
		}

		habits.sort((a, b) => a.name.localeCompare(b.name));
		return habits;
	}

	private parseFile(file: TFile, currentFrontmatter?: Record<string, unknown>): HabitDefinition | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const fm = currentFrontmatter || cache?.frontmatter;
		const k = this.keys();
		if (!fm || !isHabitType(fm[k.type])) {
			return null;
		}

		const pauses = this.readPauses(fm[k.pauses]);
		return {
			path: file.path,
			name: file.basename,
			type: fm[k.type] as HabitType,
			goalDirection: fm[k.goalDirection] === "max" ? "max" : "min",
			frequency: isHabitFrequency(fm[k.frequency])
				? (fm[k.frequency] as HabitFrequency)
				: "daily",
			weekdays: this.readWeekdays(fm[`${k.weekday}s`], fm[k.weekday]),
			monthDay: this.clampInt(this.readNumber(fm[k.monthDay], 1), 1, 31),
			intervalDays: this.clampInt(
				this.readNumber(fm[k.intervalDays], 2),
				2,
				365,
			),
			intervalMode: fm[k.intervalMode] === "cycle" ? "cycle" : fm[k.intervalMode] === "completion" ? "completion" : "fixed",
			cycleActiveDays: this.clampInt(this.readNumber(fm.cycleActiveDays, 1), 1, this.readNumber(fm[k.intervalDays], 2)),
			cycleRestarts: this.readDateList(fm.cycleRestarts),
			dailyTarget: Math.max(0, this.readNumber(fm.dailyTarget, 0)),
			intervalWindowDays: this.clampInt(this.readNumber(fm[k.intervalWindowDays], 1), 1, this.readNumber(fm[k.intervalDays], 2)),
			times: this.readTimes(fm[`${k.time}s`], fm[k.time]),
			target: this.readNumber(fm[k.target], 1),
			unit: typeof fm[k.unit] === "string" ? (fm[k.unit] as string) : "",
			step: this.readStep(fm[k.step]),
			weeklyTarget: this.readNumber(fm[k.weeklyTarget], 0),
			monthlyTarget: this.readNumber(fm[k.monthlyTarget], 0),
			weeklyPerfect: fm[k.weeklyPerfect] === true,
			monthlyPerfect: fm[k.monthlyPerfect] === true,
			icon: typeof fm[k.icon] === "string" ? (fm[k.icon] as string) : "",
			color:
				typeof fm[k.color] === "string" ? (fm[k.color] as string) : "",
			group:
				typeof fm[k.group] === "string" ? (fm[k.group] as string) : "",
			useGroupColor: fm[k.useGroupColor] === true,
			tags: this.readTagProperty(fm.tags),
			startDate: this.readDateString(fm[k.startDate]),
			paused: pauses.some((pause) => pause.end === ""),
			pauses,
			reschedules: this.readReschedules(fm[k.reschedules]),
			failed: this.readDateList(fm[k.failed]),
			skipped: this.readDateList(fm[k.skipped]),
			ignoredMisses: this.readDateList(fm.ignoredMisses),
			stopped: fm[k.stopped] === true,
			stopDate: this.readDateString(fm[k.stopDate]),
			records: this.readRecords(fm[k.records]),
			// Notes written before comments moved into the body still keep
			// them in frontmatter; the body wins where both exist.
			comments: {
				...this.readComments(fm[k.comments]),
				...(this.commentCache.get(file.path) ?? {}),
			},
			noteFolder:
				typeof fm[k.noteFolder] === "string"
					? (fm[k.noteFolder] as string)
					: "",
			noteFilenameFormat:
				typeof fm[k.noteFilenameFormat] === "string"
					? (fm[k.noteFilenameFormat] as string)
					: "",
			templatePath:
				typeof fm[k.templatePath] === "string"
					? (fm[k.templatePath] as string)
					: "",
			noteCompletionMode: isNoteCompletionMode(fm[k.noteCompletionMode])
				? (fm[k.noteCompletionMode] as NoteCompletionMode)
				: "chars",
			noteChecklistRequirement: isNoteChecklistRequirement(
				fm[k.noteChecklistRequirement],
			)
				? (fm[k.noteChecklistRequirement] as NoteChecklistRequirement)
				: "all",
			noteChecklistMin: this.clampInt(
				this.readNumber(fm[k.noteChecklistMin], 1),
				1,
				999,
			),
			noteFailKeyword:
				typeof fm[k.noteFailKeyword] === "string"
					? (fm[k.noteFailKeyword] as string)
					: "",
		};
	}

	/**
	 * Read a `YYYY-MM-DD` scalar, tolerating a native `Date`.
	 *
	 * Obsidian's own frontmatter writer (used by `processFrontMatter`)
	 * re-serializes a note's *entire* frontmatter on every edit, and drops
	 * the quotes around a plain string that happens to look like a date.
	 * Once unquoted, that value reads back as a YAML timestamp rather than
	 * text, so Obsidian hands it to us as a `Date` object instead of a
	 * string on the next read — for any note that's ever been touched by
	 * `processFrontMatter`, not just ones written by this plugin. Recovered
	 * via UTC fields, since YAML resolves a bare date as UTC midnight
	 * regardless of the reader's own timezone.
	 */
	private readDateString(value: unknown): string {
		if (typeof value === "string") {
			return value.trim();
		}
		if (value instanceof Date && !Number.isNaN(value.getTime())) {
			const year = value.getUTCFullYear();
			const month = String(value.getUTCMonth() + 1).padStart(2, "0");
			const day = String(value.getUTCDate()).padStart(2, "0");
			return `${year}-${month}-${day}`;
		}
		return "";
	}

	/**
	 * Parse a frontmatter list of `YYYY-MM-DD` dates (the `failed` and
	 * `skipped` days), dropping anything that isn't a date. A single scalar
	 * date is accepted too, for hand-written notes.
	 */
	private readDateList(raw: unknown): string[] {
		const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
		const dates = new Set<string>();
		for (const value of values) {
			const key = this.readDateString(value);
			if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
				dates.add(key);
			}
		}
		return [...dates].sort();
	}

	private readNumber(value: unknown, fallback: number): number {
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === "string") {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
		return fallback;
	}

	/** A counted habit's +/− step size; anything missing or not above 0 is 1. */
	private readStep(value: unknown): number {
		const step = roundValue(this.readNumber(value, 1));
		return step > 0 ? step : 1;
	}

	/** Round to a whole number and constrain it to an inclusive range. */
	private clampInt(value: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, Math.round(value)));
	}

	/**
	 * Parse a weekly habit's due days: the `weekdays` list when present,
	 * otherwise the original scalar `weekday`. Values are clamped to `0`–`6`,
	 * deduplicated and sorted; with nothing usable the result falls back to
	 * `[1]` (Monday), matching the old scalar default.
	 */
	private readWeekdays(list: unknown, single: unknown): number[] {
		const raw = Array.isArray(list) ? list : [single];
		const days = new Set<number>();
		for (const value of raw) {
			const parsed = this.readNumber(value, NaN);
			if (Number.isFinite(parsed)) {
				days.add(this.clampInt(parsed, 0, 6));
			}
		}
		if (days.size === 0) {
			days.add(1);
		}
		return [...days].sort((a, b) => a - b);
	}

	/**
	 * Parse a single time of day. Anything that isn't a valid `H:mm` or
	 * `HH:mm` string is treated as "no time" rather than an error, and the
	 * hour is zero-padded so times sort and compare as plain strings.
	 */
	private readTime(value: unknown): string {
		if (typeof value !== "string") {
			return "";
		}
		const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
		if (!match) {
			return "";
		}
		return `${match[1].padStart(2, "0")}:${match[2]}`;
	}

	/**
	 * Parse a habit's planned times: the `times` list when present,
	 * otherwise the scalar `time`. Invalid entries are dropped, the rest
	 * deduplicated and sorted chronologically.
	 */
	private readTimes(list: unknown, single: unknown): string[] {
		const raw = Array.isArray(list) ? list : [single];
		const times = new Set<string>();
		for (const value of raw) {
			const parsed = this.readTime(value);
			if (parsed) {
				times.add(parsed);
			}
		}
		return [...times].sort();
	}

	/** Validate, deduplicate and sort a planned-times list. */
	private normalizeTimes(values: string[]): string[] {
		return this.readTimes(values, undefined);
	}

	/** Clamp, deduplicate and sort a weekday list, defaulting to Monday. */
	private normalizeWeekdays(values: number[]): number[] {
		const days = [
			...new Set(values.map((value) => this.clampInt(value, 0, 6))),
		].sort((a, b) => a - b);
		return days.length > 0 ? days : [1];
	}

	/**
	 * Parse the completion field in either of the two shapes it may be
	 * stored in: this plugin's own day → value map, or a bare list of
	 * done dates (the shape TaskNotes uses for `complete_instances`) —
	 * each listed date is read as a completed day with value `1`. Both
	 * shapes are always accepted on read, so a note already carrying
	 * either one (e.g. authored by another plugin) is picked up without
	 * configuration — see {@link setRecord} for which shape gets written.
	 */
	private readRecords(raw: unknown): Record<string, number> {
		const records: Record<string, number> = {};
		if (Array.isArray(raw)) {
			for (const value of raw) {
				const dateKey = this.readDateString(value);
				if (dateKey) {
					records[dateKey] = 1;
				}
			}
			return records;
		}
		if (raw && typeof raw === "object") {
			for (const [key, value] of Object.entries(
				raw as Record<string, unknown>,
			)) {
				if (typeof value === "number") {
					records[key] = value;
				} else if (typeof value === "boolean") {
					records[key] = value ? 1 : 0;
				} else if (typeof value === "string" && value.trim() !== "") {
					const parsed = Number(value);
					if (Number.isFinite(parsed)) {
						records[key] = parsed;
					}
				}
			}
		}
		return records;
	}

	/** Parse the frontmatter `comments` map, dropping empty entries. */
	private readComments(raw: unknown): Record<string, string> {
		const comments: Record<string, string> = {};
		if (raw && typeof raw === "object") {
			for (const [key, value] of Object.entries(
				raw as Record<string, unknown>,
			)) {
				if (typeof value === "string" && value.trim() !== "") {
					comments[key] = value;
				}
			}
		}
		return comments;
	}

	/** Parse the frontmatter `pauses` array, dropping malformed entries. */
	private readPauses(raw: unknown): HabitPause[] {
		if (!Array.isArray(raw)) {
			return [];
		}
		const pauses: HabitPause[] = [];
		for (const item of raw) {
			if (!item || typeof item !== "object") {
				continue;
			}
			const entry = item as Record<string, unknown>;
			const start = this.readDateString(entry.start);
			if (start === "") {
				continue;
			}
			pauses.push({ start, end: this.readDateString(entry.end) });
		}
		return pauses;
	}

	/** Close any open pause as of yesterday; drop it if it covered no days. */
	private closeOpenPause(pauses: HabitPause[]): HabitPause[] {
		const yesterday = toDateKey(addDays(new Date(), -1));
		const closed: HabitPause[] = [];
		for (const pause of pauses) {
			if (pause.end !== "") {
				closed.push(pause);
			} else if (pause.start <= yesterday) {
				closed.push({ start: pause.start, end: yesterday });
			}
			// An open pause that started today covered no full day; drop it.
		}
		return closed;
	}

	/** Frontmatter form of pauses: open pauses omit the `end` key. */
	private serializePauses(
		pauses: HabitPause[],
	): { start: string; end?: string }[] {
		return pauses.map((pause) =>
			pause.end === ""
				? { start: pause.start }
				: { start: pause.start, end: pause.end },
		);
	}

	/** Parse the frontmatter `reschedules` array, dropping malformed entries. */
	private readReschedules(raw: unknown): HabitReschedule[] {
		if (!Array.isArray(raw)) {
			return [];
		}
		const reschedules: HabitReschedule[] = [];
		for (const item of raw) {
			if (!item || typeof item !== "object") {
				continue;
			}
			const entry = item as Record<string, unknown>;
			const from = this.readDateString(entry.from);
			const to = this.readDateString(entry.to);
			if (from === "" || to === "") {
				continue;
			}
			reschedules.push({ from, to });
		}
		return reschedules;
	}

	private serializeReschedules(
		reschedules: HabitReschedule[],
	): { from: string; to: string }[] {
		return reschedules.map((r) => ({ from: r.from, to: r.to }));
	}

	/**
	 * Write the frequency fields to frontmatter, keeping it tidy: daily habits
	 * store nothing (it is the default), and only the fields relevant to the
	 * chosen frequency are kept so stale keys never linger after a change.
	 * A weekly habit due on a single day keeps the original scalar `weekday`
	 * form, so notes from before multi-day support are rewritten unchanged.
	 */
	private writeFrequency(
		fm: Record<string, unknown>,
		options: NewHabitOptions,
	): void {
		const k = this.keys();
		delete fm[k.weekday];
		delete fm[`${k.weekday}s`];
		delete fm[k.monthDay];
		delete fm[k.intervalDays];
		delete fm[k.intervalWindowDays];
		delete fm[k.intervalMode];
		delete fm.cycleActiveDays;
		delete fm.dailyTarget;
		if (options.frequency === "weekly") {
			fm[k.frequency] = "weekly";
			const days = this.normalizeWeekdays(options.weekdays);
			if (days.length === 1) {
				fm[k.weekday] = days[0];
			} else {
				fm[`${k.weekday}s`] = days;
			}
		} else if (options.frequency === "monthly") {
			fm[k.frequency] = "monthly";
			fm[k.monthDay] = this.clampInt(options.monthDay, 1, 31);
		} else if (options.frequency === "interval") {
			fm[k.frequency] = "interval";
			fm[k.intervalDays] = this.clampInt(options.intervalDays, 2, 365);
			if ((options.intervalWindowDays ?? 1) > 1) fm[k.intervalWindowDays] = this.clampInt(options.intervalWindowDays ?? 1, 1, options.intervalDays ?? 2);
			if (options.intervalMode === "completion") fm[k.intervalMode] = "completion";
			if (options.intervalMode === "cycle") {
				fm[k.intervalMode] = "cycle";
				fm.cycleActiveDays = this.clampInt(options.cycleActiveDays ?? 1, 1, options.intervalDays);
				delete fm[k.intervalWindowDays];
			}
		} else if (
			options.frequency === "flexibleWeekly" ||
			options.frequency === "flexibleMonthly"
		) {
			fm[k.frequency] = options.frequency;
			if ((options.dailyTarget ?? 0) > 0) fm.dailyTarget = options.dailyTarget;
		} else {
			delete fm[k.frequency];
		}
	}

	/**
	 * Write the planned times to frontmatter, mirroring the weekday
	 * convention: a single time keeps the scalar `time` form, several use
	 * the `times` list, and none removes both keys.
	 */
	private writeTimes(
		fm: Record<string, unknown>,
		options: NewHabitOptions,
	): void {
		const k = this.keys();
		delete fm[k.time];
		delete fm[`${k.time}s`];
		const times = this.normalizeTimes(options.times);
		if (times.length === 1) {
			fm[k.time] = times[0];
		} else if (times.length > 1) {
			fm[`${k.time}s`] = times;
		}
	}

	/**
	 * Write a `note` habit's folder/filename-format/template/completion-mode
	 * fields, keeping frontmatter tidy: values equal to the default are
	 * omitted, and every field is dropped for other habit types. A blank
	 * folder defaults to a dedicated subfolder of the habits folder, named
	 * after the habit, so every note habit gets a collision-free home
	 * without the user having to think about it.
	 */
	private writeNoteFields(
		fm: Record<string, unknown>,
		options: NewHabitOptions,
		cleanName: string,
	): void {
		const k = this.keys();
		delete fm[k.noteFolder];
		delete fm[k.noteFilenameFormat];
		delete fm[k.templatePath];
		delete fm[k.noteCompletionMode];
		delete fm[k.noteChecklistRequirement];
		delete fm[k.noteChecklistMin];
		delete fm[k.noteFailKeyword];
		if (options.type !== "note") {
			return;
		}
		fm[k.noteFolder] =
			options.noteFolder.trim() || `${this.folderPath}/${cleanName}`;
		const format = options.noteFilenameFormat.trim();
		if (format && format !== DEFAULT_NOTE_FILENAME_FORMAT) {
			fm[k.noteFilenameFormat] = format;
		}
		if (options.templatePath.trim()) {
			fm[k.templatePath] = options.templatePath.trim();
		}
		if (options.noteCompletionMode !== "chars") {
			fm[k.noteCompletionMode] = options.noteCompletionMode;
		}
		const usesChecklist =
			options.noteCompletionMode === "checklist" ||
			options.noteCompletionMode === "both";
		if (usesChecklist && options.noteChecklistRequirement === "count") {
			fm[k.noteChecklistRequirement] = "count";
			fm[k.noteChecklistMin] = this.clampInt(
				options.noteChecklistMin,
				1,
				999,
			);
		}
		if (options.noteFailKeyword.trim()) {
			fm[k.noteFailKeyword] = options.noteFailKeyword.trim();
		}
	}

	private fileForHabit(habit: HabitDefinition): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(habit.path);
		return file instanceof TFile ? file : null;
	}

	/**
	 * Record `value` for `habit` on the day identified by `dateKey`.
	 *
	 * A value of zero or less removes the entry to keep the frontmatter tidy.
	 *
	 * Writes as a plain day → value map, unless both of these hold: the
	 * habit is binary (its logged value is always exactly `1`, so a value
	 * map and a bare date carry the same information) and the completion
	 * key has been renamed away from its default `records` — the signal
	 * that this note is meant to interoperate with something else, such as
	 * TaskNotes' `complete_instances`. In that case it's written as a bare,
	 * sorted list of completed dates instead (dropping any non-positive
	 * entries). Repetition/timed habits always use the value map, since
	 * only it can hold their logged count or duration.
	 */
	async setRecord(
		habit: HabitDefinition,
		dateKey: string,
		value: number,
	): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}

		const k = this.keys();
		const useDateList =
			habit.type === "binary" &&
			k.records !== DEFAULT_FRONTMATTER_KEYS.records;
		// Repeated +0.1 presses would otherwise store 0.30000000000000004.
		value = roundValue(value);
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			const records = this.readRecords(fm[k.records]);
			if (value > 0) {
				records[dateKey] = value;
			} else {
				delete records[dateKey];
			}
			fm[k.records] = useDateList
				? Object.entries(records)
						.filter(([, recorded]) => recorded > 0)
						.map(([day]) => day)
						.sort()
				: records;
		});
	}

	/**
	 * Save (or clear) the comment for a habit on the given day.
	 *
	 * Comments are written to the note body so that Obsidian indexes the
	 * `#tags` and `[[links]]` inside them against the day they belong to.
	 * A note still holding comments in frontmatter is migrated on the same
	 * pass, so no separate upgrade step is needed.
	 */
	async setComment(
		habit: HabitDefinition,
		dateKey: string,
		text: string,
	): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}

		const legacy = this.legacyComments(file);
		let written: Record<string, string> = {};
		await this.app.vault.process(file, (content) => {
			const comments = { ...legacy, ...parseCommentLog(content) };
			if (text) {
				comments[dateKey] = text;
			} else {
				delete comments[dateKey];
			}
			written = comments;
			return applyCommentLog(content, comments);
		});
		this.putComments(file.path, written);

		if (Object.keys(legacy).length > 0) {
			await this.clearLegacyComments(file, legacy);
		}
	}

	/** Day comments still stored in a note's frontmatter, if any. */
	private legacyComments(file: TFile): Record<string, string> {
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return this.readComments(fm?.[this.keys().comments]);
	}

	/** True when any habit note still keeps its comments in frontmatter. */
	hasLegacyComments(): boolean {
		return this.habitFiles().some(
			(file) => Object.keys(this.legacyComments(file)).length > 0,
		);
	}

	/**
	 * Move every note's frontmatter comments into its body. Returns how
	 * many notes were changed.
	 */
	async migrateComments(): Promise<number> {
		let migrated = 0;
		for (const file of this.habitFiles()) {
			const legacy = this.legacyComments(file);
			if (Object.keys(legacy).length === 0) {
				continue;
			}
			let written: Record<string, string> = {};
			await this.app.vault.process(file, (content) => {
				written = { ...legacy, ...parseCommentLog(content) };
				return applyCommentLog(content, written);
			});
			this.putComments(file.path, written);
			await this.clearLegacyComments(file, legacy);
			migrated++;
		}
		return migrated;
	}

	/**
	 * Move each rename's value onto its new frontmatter key, across every
	 * habit note, one `processFrontMatter` pass per file (not one pass per
	 * key). A value is only ever moved, never overwritten: a rename is
	 * skipped for a given note if its new key is already in use there, so
	 * existing data can't be clobbered. Returns how many notes were changed.
	 */
	async renameFrontmatterKeys(
		renames: { old: string; new: string }[],
	): Promise<number> {
		let changed = 0;
		for (const file of this.habitFiles()) {
			let fileChanged = false;
			await this.app.fileManager.processFrontMatter(
				file,
				(frontmatter) => {
					const fm = frontmatter as Record<string, unknown>;
					for (const { old: oldKey, new: newKey } of renames) {
						if (
							oldKey !== newKey &&
							fm[oldKey] !== undefined &&
							fm[newKey] === undefined
						) {
							fm[newKey] = fm[oldKey];
							delete fm[oldKey];
							fileChanged = true;
						}
					}
				},
			);
			if (fileChanged) {
				changed++;
			}
		}
		return changed;
	}

	/**
	 * Drop the frontmatter `comments` key once its contents live in the
	 * body, along with any tags an earlier version mirrored into `tags` —
	 * the body now supplies those to Obsidian's index directly.
	 */
	private async clearLegacyComments(
		file: TFile,
		legacy: Record<string, string>,
	): Promise<void> {
		const mirrored = tagsInComments(legacy);
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			delete fm[k.comments];
			if (mirrored.size === 0 || !("tags" in fm)) {
				return;
			}
			const kept = this.readTagProperty(fm.tags).filter(
				(tag) => !mirrored.has(tag),
			);
			if (kept.length > 0) {
				fm.tags = kept;
			} else {
				delete fm.tags;
			}
		});
	}

	/** Read `tags` in any of the shapes Obsidian accepts, minus the `#`. */
	private readTagProperty(raw: unknown): string[] {
		const values = Array.isArray(raw)
			? raw
			: typeof raw === "string"
				? raw.split(/[,\s]+/)
				: [];
		const out: string[] = [];
		for (const value of values) {
			if (typeof value !== "string") {
				continue;
			}
			const tag = value.trim().replace(/^#/, "");
			if (tag !== "" && !out.includes(tag)) {
				out.push(tag);
			}
		}
		return out;
	}

	/** Every markdown file in the habits folder. */
	private habitFiles(): TFile[] {
		const folder = this.app.vault.getAbstractFileByPath(this.folderPath);
		if (!(folder instanceof TFolder)) {
			return [];
		}
		return folder.children.filter(
			(child): child is TFile =>
				child instanceof TFile && child.extension === "md",
		);
	}

	/** Pause a habit from today. Paused days are skipped by streaks/stats. */
	async pauseHabit(habit: HabitDefinition): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			const pauses = this.readPauses(fm[k.pauses]);
			if (pauses.some((pause) => pause.end === "")) {
				return;
			}
			pauses.push({ start: toDateKey(new Date()), end: "" });
			fm[k.pauses] = this.serializePauses(pauses);
		});
		new Notice(t('Paused "{name}".', { name: habit.name }));
	}

	/**
	 * Close a day as failed or skipped, or reopen it (`null`). A day holds at
	 * most one of the two, so setting one clears the other; empty lists are
	 * removed from the frontmatter rather than left as `[]`.
	 */
	async setDayStatus(
		habit: HabitDefinition,
		dateKey: string,
		status: "failed" | "skipped" | null,
	): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			for (const kind of ["failed", "skipped"] as const) {
				const key = k[kind];
				const dates = this.readDateList(fm[key]).filter(
					(date) => date !== dateKey,
				);
				if (kind === status) {
					dates.push(dateKey);
					dates.sort();
				}
				if (dates.length > 0) {
					fm[key] = dates;
				} else {
					delete fm[key];
				}
			}
		});
		// Mirror the write so a view repainting before the metadata cache
		// catches up already sees the change.
		habit.failed = habit.failed.filter((date) => date !== dateKey);
		habit.skipped = habit.skipped.filter((date) => date !== dateKey);
		if (status) {
			habit[status].push(dateKey);
		}
	}

	/** When the habit's snooze ends (epoch ms), or null if it isn't snoozed. */
	snoozedUntil(habit: HabitDefinition, now = Date.now()): number | null {
		const until = this.getSettings().snoozes[habit.path];
		return typeof until === "number" && until > now ? until : null;
	}

	/** Hide a habit from today's lists until `until` (epoch ms). */
	async snoozeHabit(habit: HabitDefinition, until: number): Promise<void> {
		await this.writeSnoozes((snoozes) => {
			snoozes[habit.path] = until;
		});
	}

	/** End a habit's snooze early. */
	async clearSnooze(habit: HabitDefinition): Promise<void> {
		await this.writeSnoozes((snoozes) => {
			delete snoozes[habit.path];
		});
	}

	/** Apply a change to the snoozes, pruning any that have already ended. */
	private async writeSnoozes(
		change: (snoozes: Record<string, number>) => void,
	): Promise<void> {
		const now = Date.now();
		const snoozes: Record<string, number> = {};
		for (const [path, until] of Object.entries(this.getSettings().snoozes)) {
			if (until > now) {
				snoozes[path] = until;
			}
		}
		change(snoozes);
		this.getSettings().snoozes = snoozes;
		await this.saveSettings();
	}

	/** Resume a paused habit; the pause period stays excluded from stats. */
	async resumeHabit(habit: HabitDefinition): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			const pauses = this.closeOpenPause(this.readPauses(fm[k.pauses]));
			if (pauses.length > 0) {
				fm[k.pauses] = this.serializePauses(pauses);
			} else {
				delete fm[k.pauses];
			}
		});
		new Notice(t('Resumed "{name}".', { name: habit.name }));
	}

	/**
	 * Move a missed due day onto a different one (experimental). Upserts by
	 * `from`, so calling this again for the same missed day replaces where
	 * it was previously moved to rather than adding a second entry. Callers
	 * are expected to have already checked {@link isRescheduleTargetOpen}
	 * for `to` — this only guards against the note going missing mid-edit.
	 */
	async rescheduleHabit(
		habit: HabitDefinition,
		from: string,
		to: string,
	): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			const latest = this.parseFile(file, fm);
			const current = { ...habit, ...latest, records: this.readRecords(fm[k.records]), reschedules: this.readReschedules(fm[k.reschedules]), ignoredMisses: this.readDateList(fm.ignoredMisses) };
			if (!isRescheduleEligible(current) || from >= toDateKey(new Date()) || !isDue(current, new Date(`${from}T00:00:00`)) || isComplete(current, from) || current.ignoredMisses?.includes(from) || !isRescheduleTargetOpen(current, to) || (current.records[to] || 0) > 0) throw new Error(t("That day is already due or has a record. Choose another day."));
			const reschedules = this.readReschedules(fm[k.reschedules]).filter(
				(r) => r.from !== from,
			);
			reschedules.push({ from, to });
			fm[k.reschedules] = this.serializeReschedules(reschedules);
		});
		new Notice(
			t('Rescheduled "{name}" to {date}.', { name: habit.name, date: to }),
		);
	}

	async ignoreMissedDay(habit: HabitDefinition, dateKey: string): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) throw new Error(t("Habit note not found."));
		await this.app.fileManager.processFrontMatter(file, fm => {
			fm.ignoredMisses = [...new Set([...this.readDateList(fm.ignoredMisses), dateKey])].sort();
		});
	}

	/** Undo a reschedule: the original day goes back to being due. */
	async cancelReschedule(habit: HabitDefinition, from: string): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			const reschedules = this.readReschedules(fm[k.reschedules]).filter(
				(r) => r.from !== from,
			);
			if (reschedules.length > 0) {
				fm[k.reschedules] = this.serializeReschedules(reschedules);
			} else {
				delete fm[k.reschedules];
			}
		});
	}

	/** Stop tracking a habit. The note and every record are kept. */
	async stopHabit(habit: HabitDefinition): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			fm[k.stopped] = true;
			fm[k.stopDate] = toDateKey(new Date());
			const pauses = this.closeOpenPause(this.readPauses(fm[k.pauses]));
			if (pauses.length > 0) {
				fm[k.pauses] = this.serializePauses(pauses);
			} else {
				delete fm[k.pauses];
			}
		});
		new Notice(
			t('Stopped tracking "{name}". Its history is kept in the note.', {
				name: habit.name,
			}),
		);
	}

	/** Resume tracking a previously stopped habit. */
	async restartHabit(habit: HabitDefinition): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			delete fm[k.stopped];
			delete fm[k.stopDate];
		});
		new Notice(t('Resumed tracking "{name}".', { name: habit.name }));
	}

	/** Create a new habit note and return the created file. */
	async createHabit(options: NewHabitOptions): Promise<TFile | null> {
		const cleanName = sanitizeFileName(options.name);
		if (!cleanName) {
			new Notice(t("Please enter a valid habit name."));
			return null;
		}

		await this.ensureFolderExists();
		const path = normalizePath(`${this.folderPath}/${cleanName}.md`);
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice(
				t('A habit called "{name}" already exists.', {
					name: cleanName,
				}),
			);
			return null;
		}

		const body = [
			`# ${cleanName}`,
			"",
			t("This note is managed by Task Genius."),
			"",
			"## Metrics",
			"",
			"```tg-habit-metrics",
			"```",
			"",
		].join("\n");
		const file = await this.app.vault.create(path, body);

		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			fm.habit = true;
			fm[k.type] = options.type;
			// Only limit habits store the field; its absence means "min", so
			// notes created before the field existed keep their meaning.
			if (options.goalDirection === "max") {
				fm[k.goalDirection] = "max";
			}
			this.writeFrequency(fm, options);
			this.writeTimes(fm, options);
			this.writeNoteFields(fm, options, cleanName);
			if (
				options.type !== "binary" ||
				isFlexibleFrequency(options.frequency)
			) {
				// A limit of 0 is meaningful ("none at all"), so max habits
				// always write the field even when it is zero. A note
				// habit's target is its character goal, or 100 for a
				// checklist habit's checked percentage. A flexible habit's
				// target is its "times per period" goal, which a binary
				// habit needs written too (unlike the normal binary case,
				// where it is meaningless and left out).
				fm[k.target] = options.target;
			}
			if (options.unit) {
				fm[k.unit] = options.unit;
			}
			// Only written when it differs from the default of 1.
			if (options.type === "repetition" && options.step !== 1) {
				fm[k.step] = options.step;
			}
			if (options.weeklyPerfect) {
				fm[k.weeklyPerfect] = true;
			} else if (options.weeklyTarget > 0) {
				fm[k.weeklyTarget] = options.weeklyTarget;
			}
			if (options.monthlyPerfect) {
				fm[k.monthlyPerfect] = true;
			} else if (options.monthlyTarget > 0) {
				fm[k.monthlyTarget] = options.monthlyTarget;
			}
			if (options.icon) {
				fm[k.icon] = options.icon;
			}
			if (options.color) {
				fm[k.color] = options.color;
			}
			if (options.group) {
				fm[k.group] = options.group;
			}
			if (options.useGroupColor) {
				fm[k.useGroupColor] = true;
			}
			if (options.tags.length > 0) {
				fm.tags = options.tags;
			}
			fm[k.startDate] = toDateKey(new Date());
			fm[k.records] = {};
		});

		new Notice(t('Created habit "{name}".', { name: cleanName }));
		return file;
	}

	/** Update an existing habit's definition, renaming its note if needed. */
	async updateHabit(
		habit: HabitDefinition,
		options: NewHabitOptions,
	): Promise<TFile | null> {
		let file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return null;
		}

		const cleanName = sanitizeFileName(options.name);
		if (!cleanName) {
			new Notice(t("Please enter a valid habit name."));
			return null;
		}

		if (cleanName !== habit.name) {
			const newPath = normalizePath(`${this.folderPath}/${cleanName}.md`);
			if (this.app.vault.getAbstractFileByPath(newPath)) {
				new Notice(
				t('A habit called "{name}" already exists.', {
					name: cleanName,
				}),
			);
				return null;
			}
			await this.app.fileManager.renameFile(file, newPath);
			const renamed = this.app.vault.getAbstractFileByPath(newPath);
			if (renamed instanceof TFile) {
				file = renamed;
			}
		}

		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			fm.habit = true;
			fm[k.type] = options.type;
			if (options.goalDirection === "max") {
				fm[k.goalDirection] = "max";
			} else {
				delete fm[k.goalDirection];
			}
			this.writeFrequency(fm, options);
			if (options.frequency === "interval" && (options.restartIntervalCycle || options.restartCycleDate)) {
				const day = options.restartCycleDate || toDateKey(new Date());
				if (/^\d{4}-\d{2}-\d{2}$/.test(day)) fm.cycleRestarts = [...new Set([...this.readDateList(fm.cycleRestarts), day])].sort();
			}
			this.writeTimes(fm, options);
			this.writeNoteFields(fm, options, cleanName);
			if (
				options.type === "binary" &&
				!isFlexibleFrequency(options.frequency)
			) {
				delete fm[k.target];
			} else {
				fm[k.target] = options.target;
			}
			if (options.unit) {
				fm[k.unit] = options.unit;
			} else {
				delete fm[k.unit];
			}
			if (options.type === "repetition" && options.step !== 1) {
				fm[k.step] = options.step;
			} else {
				delete fm[k.step];
			}
			if (options.weeklyPerfect) {
				fm[k.weeklyPerfect] = true;
				delete fm[k.weeklyTarget];
			} else {
				delete fm[k.weeklyPerfect];
				if (options.weeklyTarget > 0) {
					fm[k.weeklyTarget] = options.weeklyTarget;
				} else {
					delete fm[k.weeklyTarget];
				}
			}
			if (options.monthlyPerfect) {
				fm[k.monthlyPerfect] = true;
				delete fm[k.monthlyTarget];
			} else {
				delete fm[k.monthlyPerfect];
				if (options.monthlyTarget > 0) {
					fm[k.monthlyTarget] = options.monthlyTarget;
				} else {
					delete fm[k.monthlyTarget];
				}
			}
			if (options.icon) {
				fm[k.icon] = options.icon;
			} else {
				delete fm[k.icon];
			}
			if (options.color) {
				fm[k.color] = options.color;
			} else {
				delete fm[k.color];
			}
			if (options.group) {
				fm[k.group] = options.group;
			} else {
				delete fm[k.group];
			}
			if (options.useGroupColor) {
				fm[k.useGroupColor] = true;
			} else {
				delete fm[k.useGroupColor];
			}
			if (options.tags.length > 0) {
				fm.tags = options.tags;
			} else {
				delete fm.tags;
			}
		});

		new Notice(t('Updated "{name}".', { name: cleanName }));
		return file;
	}

	/**
	 * Reassign a habit to a group (or ungroup it with ""), writing the
	 * note's frontmatter. Leaving a group also clears the group-colour
	 * override, which would otherwise silently point at the old group.
	 */
	async setHabitGroup(
		habit: HabitDefinition,
		group: string,
	): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			return;
		}
		const cleaned = group.trim();
		const k = this.keys();
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const fm = frontmatter as Record<string, unknown>;
			if (cleaned) {
				fm[k.group] = cleaned;
			} else {
				delete fm[k.group];
				delete fm[k.useGroupColor];
			}
		});
		habit.group = cleaned;
		if (!cleaned) {
			habit.useGroupColor = false;
		}
	}

	/** Move a habit's note to the trash (respecting the user's settings). */
	async deleteHabit(habit: HabitDefinition): Promise<void> {
		const file = this.fileForHabit(habit);
		if (!file) {
			new Notice(
				t('Could not find the note for "{name}".', {
					name: habit.name,
				}),
			);
			return;
		}
		await this.app.fileManager.trashFile(file);
		new Notice(t('Removed "{name}".', { name: habit.name }));
	}
}
