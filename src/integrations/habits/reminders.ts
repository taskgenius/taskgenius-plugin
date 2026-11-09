import { App, TFile, moment, normalizePath } from "obsidian";
import type { HabitStore } from "./habit-store";
import type { HabitsPluginSettings } from "./settings";
import type { HabitDefinition } from "./types";
import { isDue, isFailedOn, isPausedOn } from "./stats";
import { toDateKey } from "./utils";

/**
 * Obsidian's bundled Moment.js, typed by hand — its own type definitions
 * are not always resolvable in stricter lint setups, which would otherwise
 * make every call through `moment` unsafely typed (mirrors the same cast
 * in utils.ts and note-habit.ts).
 */
const formatDate = moment as unknown as (
	input: Date,
) => { format(format: string): string };

/**
 * Markers around the plugin-managed reminder block. Obsidian `%%` comments,
 * so they stay invisible in reading view while the checklist lines between
 * them render (and get scanned by the Reminder plugin) normally.
 */
export const REMINDERS_START = "%% habits-reminders start %%";
export const REMINDERS_END = "%% habits-reminders end %%";

/** One reminder checklist line in the Reminder plugin's default format. */
export function reminderLine(
	name: string,
	dateKey: string,
	time: string,
	checked: boolean,
): string {
	return `- [${checked ? "x" : " "}] ${name} (@${dateKey} ${time})`;
}

/** The managed block inside `content`, or null when the markers are absent. */
function findBlock(
	content: string,
): { start: number; end: number; body: string } | null {
	const start = content.indexOf(REMINDERS_START);
	if (start < 0) {
		return null;
	}
	const bodyStart = start + REMINDERS_START.length;
	const end = content.indexOf(REMINDERS_END, bodyStart);
	if (end < 0) {
		return null;
	}
	return {
		start,
		end: end + REMINDERS_END.length,
		body: content.slice(bodyStart, end),
	};
}

/** One parsed checklist line of the managed block. */
export interface ReminderBlockLine {
	checked: boolean;
	name: string;
	date: string;
	time: string;
}

/** Parse every reminder line inside the managed block. */
export function parseReminderLines(content: string): ReminderBlockLine[] {
	const block = findBlock(content);
	if (!block) {
		return [];
	}
	const line =
		/^- \[([ xX])\] (.+) \(@(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\)$/gm;
	return [...block.body.matchAll(line)].map((match) => ({
		checked: match[1] !== " ",
		name: match[2],
		date: match[3],
		time: match[4],
	}));
}

/**
 * The `name|time` keys of lines ticked off inside the managed block.
 * Regeneration keeps these checked even when the habit's record does not
 * account for them — a partially ticked binary habit (one of two times
 * done) would otherwise lose its tick on every refresh, since a binary
 * record has no way to express half a day.
 */
export function checkedKeys(content: string): Set<string> {
	const keys = new Set<string>();
	for (const line of parseReminderLines(content)) {
		if (line.checked) {
			keys.add(`${line.name}|${line.time}`);
		}
	}
	return keys;
}

/**
 * The day's goal for a counted or timed habit — the target, floored at 1
 * so a habit saved without one still logs something when ticked.
 */
function goalOf(habit: HabitDefinition): number {
	return Math.max(habit.target, 1);
}

/**
 * True when the habit's record can express a partly ticked day.
 *
 * That needs every planned time to own at least one whole unit of the
 * goal. A binary record never can — 0 or 1 has no way to say "one session
 * of two" — and neither can a goal smaller than its number of times, such
 * as a single tablet reminded for twice. Those habits are all-or-nothing,
 * and their partial ticks are kept visually instead.
 */
function splitsEvenly(habit: HabitDefinition): boolean {
	return habit.type !== "binary" && goalOf(habit) >= habit.times.length;
}

/** The value that marks a whole day done. */
function doneValue(habit: HabitDefinition): number {
	return habit.type === "binary" ? 1 : goalOf(habit);
}

/**
 * The record value today's tick state calls for. Ticking is logging.
 *
 * A binary habit is done once *all* its lines are ticked, and un-done
 * when one is unticked again. Counted and timed habits log the share of
 * the day's goal that the ticked lines represent, so a single tick on a
 * habit with one planned time records the whole target: ticking off
 * "Meditate" writes its 15 minutes, not a bare 1. With several times the
 * goal is split across them — two of four ticks on a 30-minute habit
 * records 15.
 *
 * A larger value logged in the dashboard survives while every line stays
 * ticked, so reading for 40 minutes against a 20-minute target is not
 * quietly rounded back down by a regeneration.
 */
export function desiredRecord(
	habit: HabitDefinition,
	checked: number,
	total: number,
	current: number,
): number {
	const goal = goalOf(habit);
	if (checked === total && current >= goal && habit.type !== "binary") {
		return current;
	}
	if (!splitsEvenly(habit)) {
		return checked === total ? doneValue(habit) : 0;
	}
	// Rounded *up*, because this has to be the exact inverse of the floor
	// in coveredTimes: the smallest value that still reads back as this
	// many covered lines. Rounding to nearest instead would let a middle
	// tick write a value that regenerates as one tick fewer, and the block
	// would undo the tick the user had just made.
	return total > 0 ? Math.ceil((goal * checked) / total) : 0;
}

/** Snapshot key for one line's tick state. */
function tickKey(line: ReminderBlockLine): string {
	return `${line.date}|${line.name}|${line.time}`;
}

/**
 * The habits whose tick state differs from the snapshot taken after our
 * last regeneration — the actual user edits. Only these may write records:
 * a line can be stale the *other* way round (the record just changed in
 * the dashboard and the block has not been regenerated yet), and mirroring
 * such a line back would silently revert the fresh record. A line the
 * snapshot has never seen counts as an edit only when it is ticked, so
 * ticks made while the plugin was not watching are still honoured.
 */
export function changedHabitNames(
	lines: ReminderBlockLine[],
	snapshot: ReadonlyMap<string, boolean> | null,
): Set<string> {
	const changed = new Set<string>();
	for (const line of lines) {
		const before = snapshot?.get(tickKey(line));
		if (before === undefined ? line.checked : before !== line.checked) {
			changed.add(line.name);
		}
	}
	return changed;
}

/**
 * How many of the habit's planned times today's record already covers.
 *
 * This is the exact inverse of {@link desiredRecord}: a counted or timed
 * habit covers a line for each whole share of the goal its value reaches,
 * so writing the value a tick asks for and reading it back produces the
 * same ticks. The two must agree, or every regeneration would disturb the
 * ticks it had just written. Binary values stay all-or-nothing.
 */
function coveredTimes(habit: HabitDefinition, value: number): number {
	const total = habit.times.length;
	if (!splitsEvenly(habit)) {
		return value >= doneValue(habit) ? total : 0;
	}
	const covered = Math.floor((value * total) / goalOf(habit));
	return Math.max(0, Math.min(total, covered));
}

/**
 * Today's reminder lines: one per planned time of every habit that is due
 * today, in time order. Lines start checked when today's record already
 * covers that time or when the user ticked them off in the previous block.
 * Habits with no planned times, paused habits, and limit habits (reminding
 * to *not* do something is unhelpful) produce no lines.
 */
export function reminderLines(
	habits: HabitDefinition[],
	today: Date,
	previouslyChecked: Set<string>,
): string[] {
	const dateKey = toDateKey(today);
	const entries: { time: string; line: string }[] = [];
	for (const habit of habits) {
		if (
			habit.stopped ||
			habit.goalDirection === "max" ||
			habit.times.length === 0 ||
			isPausedOn(habit, dateKey) ||
			isFailedOn(habit, dateKey) ||
			!isDue(habit, today)
		) {
			continue;
		}
		const covered = coveredTimes(habit, habit.records[dateKey] ?? 0);
		habit.times.forEach((time, index) => {
			// Habits whose record can express a partial day mirror it
			// exactly — ticking is logging, so the record is the whole
			// truth. The all-or-nothing ones need their ticks remembered
			// instead, or a partial tick would be lost on every refresh.
			const checked =
				index < covered ||
				(!splitsEvenly(habit) &&
					previouslyChecked.has(`${habit.name}|${time}`));
			entries.push({
				time,
				line: reminderLine(habit.name, dateKey, time, checked),
			});
		});
	}
	entries.sort((a, b) => a.time.localeCompare(b.time));
	return entries.map((entry) => entry.line);
}

/**
 * Return `content` with the managed block replaced by `lines`. With lines
 * to write, a missing block is appended at the end of the note; with none,
 * an existing block is emptied but its markers stay — they may have been
 * planted by a daily-note template to pick the block's position, and
 * keeping them means the next refill lands in that same spot. A note
 * without markers is left untouched on an empty day.
 */
export function applyReminderLines(
	content: string,
	lines: string[],
): string {
	const existing = findBlock(content);
	if (lines.length === 0 && !existing) {
		return content;
	}
	const body = lines.length > 0 ? `${lines.join("\n")}\n` : "";
	const block = `${REMINDERS_START}\n${body}${REMINDERS_END}`;
	if (existing) {
		return (
			content.slice(0, existing.start) +
			block +
			content.slice(existing.end)
		);
	}
	const separator = content.endsWith("\n\n")
		? ""
		: content.endsWith("\n")
			? "\n"
			: "\n\n";
	return content + separator + block + "\n";
}

/** The subset of the core Daily notes plugin's options we read. */
interface DailyNotesOptions {
	folder?: string;
	format?: string;
}

/** Folder and name format configured in the core Daily notes plugin. */
function dailyNoteOptions(app: App): DailyNotesOptions {
	const withInternals = app as unknown as {
		internalPlugins?: {
			getPluginById?: (id: string) => {
				instance?: { options?: DailyNotesOptions };
			} | null;
		};
	};
	return (
		withInternals.internalPlugins?.getPluginById?.("daily-notes")?.instance
			?.options ?? {}
	);
}

/**
 * Keeps a managed block of reminder lines in sync with today's due habits,
 * in the checklist format the Reminder plugin scans — the bridge that turns
 * habit schedules into actual notifications. Writing markdown is the whole
 * integration: the Reminder plugin has no API, its input surface is notes.
 */
export class ReminderSync {
	/**
	 * Tick state of the block as of our last regeneration (or first read),
	 * keyed per line. Diffing against it separates user edits from lines
	 * that are merely stale because a record changed elsewhere first.
	 */
	private lastTicks: Map<string, boolean> | null = null;

	constructor(
		private app: App,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
	) {}

	/** Refresh the tick snapshot from the note content just written/read. */
	private rememberTicks(content: string): void {
		this.lastTicks = new Map(
			parseReminderLines(content).map((line) => [
				tickKey(line),
				line.checked,
			]),
		);
	}

	/** Vault path the block should live in today, or null when unknown. */
	targetPath(today: Date): string | null {
		const settings = this.getSettings().reminders;
		if (settings.target === "fixed-note") {
			const path = settings.notePath.trim();
			return path ? normalizePath(path) : null;
		}
		const options = dailyNoteOptions(this.app);
		const name = formatDate(today).format(options.format || "YYYY-MM-DD");
		const folder = options.folder?.trim() ?? "";
		return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
	}

	/**
	 * Regenerate the block for `today`. The daily note is never created by
	 * the plugin — the block is added once the note exists (the caller
	 * re-runs on file creation); a fixed note is created on demand. The
	 * file is only written when the block actually changed.
	 */
	async update(today = new Date()): Promise<void> {
		const settings = this.getSettings().reminders;
		if (!settings.enabled) {
			return;
		}
		const path = this.targetPath(today);
		if (!path) {
			return;
		}
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			if (file || settings.target !== "fixed-note") {
				return;
			}
			const lines = reminderLines(
				this.store.getHabits(),
				today,
				new Set(),
			);
			if (lines.length > 0) {
				await this.ensureParentFolder(path);
				const created = applyReminderLines("", lines);
				await this.app.vault.create(path, created);
				this.rememberTicks(created);
			}
			return;
		}
		const content = await this.app.vault.cachedRead(file);
		await this.syncRecords(content, today);
		const next = applyReminderLines(
			content,
			reminderLines(
				this.store.getHabits(),
				today,
				checkedKeys(content),
			),
		);
		if (next === content) {
			this.rememberTicks(content);
			return;
		}
		let written = next;
		await this.app.vault.process(file, (current) => {
			written = applyReminderLines(
				current,
				reminderLines(
					this.store.getHabits(),
					today,
					checkedKeys(current),
				),
			);
			return written;
		});
		this.rememberTicks(written);
	}

	/**
	 * Ticking is logging: carry the block's *edited* tick state into the
	 * habit records (per {@link desiredRecord}) before the block is
	 * regenerated from those records. Only habits whose ticks changed
	 * since our last regeneration count as edited — a record logged in
	 * the dashboard a moment ago leaves the block momentarily stale, and
	 * mirroring those untouched lines back would revert the fresh record.
	 * Changed records are mirrored into the in-memory habit immediately,
	 * so the regeneration that follows sees them before the note write
	 * round-trips through the cache.
	 */
	private async syncRecords(content: string, today: Date): Promise<void> {
		const dateKey = toDateKey(today);
		const todayLines = parseReminderLines(content).filter(
			(line) => line.date === dateKey,
		);
		const edited = changedHabitNames(todayLines, this.lastTicks);
		if (edited.size === 0) {
			return;
		}
		const ticks = new Map<string, { checked: number; total: number }>();
		for (const line of todayLines) {
			const tally = ticks.get(line.name) ?? { checked: 0, total: 0 };
			tally.total += 1;
			tally.checked += line.checked ? 1 : 0;
			ticks.set(line.name, tally);
		}
		for (const habit of this.store.getHabits()) {
			const tally = ticks.get(habit.name);
			if (
				!tally ||
				!edited.has(habit.name) ||
				habit.stopped ||
				habit.goalDirection === "max" ||
				isPausedOn(habit, dateKey) ||
				isFailedOn(habit, dateKey) ||
				!isDue(habit, today)
			) {
				continue;
			}
			const current = habit.records[dateKey] ?? 0;
			const desired = desiredRecord(
				habit,
				tally.checked,
				tally.total,
				current,
			);
			if (desired === current) {
				continue;
			}
			if (desired > 0) {
				habit.records[dateKey] = desired;
			} else {
				delete habit.records[dateKey];
			}
			await this.store.setRecord(habit, dateKey, desired);
		}
	}

	/** Create the folders leading up to `path` when they are missing. */
	private async ensureParentFolder(path: string): Promise<void> {
		const parent = path.split("/").slice(0, -1).join("/");
		if (parent && !this.app.vault.getAbstractFileByPath(parent)) {
			await this.app.vault.createFolder(parent);
		}
	}
}
