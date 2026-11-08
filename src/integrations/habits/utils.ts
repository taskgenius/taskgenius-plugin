import { moment, type Component } from "obsidian";
import { t } from "./i18n";
import type {
	GroupStyle,
	HabitDefinition,
	HabitFrequency,
	HabitSortMode,
} from "./types";

/**
 * Invoke `onTrigger` when the user holds a touch on `el` for half a second
 * without moving — the mobile stand-in for a right-click.
 */
export function registerLongPress(
	component: Component,
	el: HTMLElement,
	onTrigger: (x: number, y: number) => void,
): void {
	let timer: number | null = null;
	let startX = 0;
	let startY = 0;
	const clear = (): void => {
		if (timer !== null) {
			el.win.clearTimeout(timer);
			timer = null;
		}
	};
	component.registerDomEvent(el, "touchstart", (evt: TouchEvent) => {
		const touch = evt.touches[0];
		if (!touch) {
			return;
		}
		startX = touch.clientX;
		startY = touch.clientY;
		clear();
		timer = el.win.setTimeout(() => {
			timer = null;
			onTrigger(startX, startY);
		}, 500);
	});
	component.registerDomEvent(el, "touchmove", (evt: TouchEvent) => {
		const touch = evt.touches[0];
		if (!touch) {
			return;
		}
		if (
			Math.abs(touch.clientX - startX) > 10 ||
			Math.abs(touch.clientY - startY) > 10
		) {
			clear();
		}
	});
	component.registerDomEvent(el, "touchend", clear);
	component.registerDomEvent(el, "touchcancel", clear);
	component.register(clear);
}

/**
 * Locale-aware display form of a 24-hour `HH:mm` time of day (e.g. "9:00 PM"
 * or "21:00", following the system locale). Invalid input is returned as-is.
 */
export function formatTimeOfDay(time: string): string {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	if (!match) {
		return time;
	}
	return new Date(
		2024,
		0,
		1,
		Number(match[1]),
		Number(match[2]),
	).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Locale-aware weekday name for a `getDay` value (2024-01-07 = Sunday). */
export function weekdayName(value: number, style: "long" | "short"): string {
	return new Date(2024, 0, 7 + value).toLocaleDateString(undefined, {
		weekday: style,
	});
}

/**
 * A short "due" descriptor for non-daily habits ("Every Mon, Wed, Fri",
 * "Monthly · day 15", "Every other day"); empty for daily.
 */
export function habitScheduleLabel(habit: HabitDefinition): string {
	if (habit.frequency === "weekly") {
		if (habit.weekdays.length === 1) {
			return t("Every {day}", {
				day: weekdayName(habit.weekdays[0], "long"),
			});
		}
		// Monday-first reads as a week plan ("Mon, Wed, Fri") whatever
		// the underlying Sunday-based getDay values are.
		const days = [...habit.weekdays]
			.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
			.map((day) => weekdayName(day, "short"))
			.join(", ");
		return t("Every {day}", { day: days });
	}
	if (habit.frequency === "monthly") {
		return t("Monthly · day {day}", { day: habit.monthDay });
	}
	if (habit.frequency === "interval") {
		return habit.intervalDays === 2
			? t("Every other day")
			: t("Every {n} days", { n: habit.intervalDays });
	}
	if (habit.frequency === "flexibleWeekly") {
		if (habit.goalDirection === "max") return t("Weekly total limit · any day");
		return t("{n}× a week · any day", { n: Math.max(1, habit.target) });
	}
	if (habit.frequency === "flexibleMonthly") {
		if (habit.goalDirection === "max") return t("Monthly total limit · any day");
		return t("{n}× a month · any day", { n: Math.max(1, habit.target) });
	}
	return "";
}

/** True for the two "N times per period, any day" frequencies. */
/**
 * Whether a habit's logged values and target may be fractional (e.g. 1.5
 * litres). Only counted habits: timed habits are whole minutes, and binary
 * and note habits are never typed by hand.
 */
export function allowsDecimals(habit: Pick<HabitDefinition, "type">): boolean {
	return habit.type === "repetition";
}

/**
 * How much one +/− press changes a habit's value: a counted habit's own
 * step size (1 by default, or e.g. 0.25 for litres), otherwise 1.
 */
export function stepOf(habit: Pick<HabitDefinition, "type" | "step">): number {
	return allowsDecimals(habit) && habit.step > 0 ? habit.step : 1;
}

/**
 * Round away floating-point noise (0.1 + 0.2 = 0.30000000000000004) so
 * stored and displayed values stay tidy. Three decimal places is plenty for
 * anything a person logs by hand.
 */
export function roundValue(value: number): number {
	return Math.round(value * 1000) / 1000;
}

/** A logged value, total or target as display text, e.g. "1.5". */
export function formatValue(value: number): string {
	return String(roundValue(value));
}

/**
 * A value ready to store: never negative, and a whole number for every
 * habit type except counted habits, which keep their decimals.
 */
export function cleanValue(
	habit: Pick<HabitDefinition, "type">,
	value: number,
): number {
	const positive = Math.max(0, value);
	return allowsDecimals(habit) ? roundValue(positive) : Math.round(positive);
}

export function isFlexibleFrequency(frequency: HabitFrequency): boolean {
	return frequency === "flexibleWeekly" || frequency === "flexibleMonthly";
}

/** Format a date as a `YYYY-MM-DD` key using local time. */
export function toDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/** Return a new date offset from `date` by the given number of days. */
export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

/** True when two dates fall on the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
	return toDateKey(a) === toDateKey(b);
}

/**
 * Remove characters that are not allowed in vault file names so a habit name
 * can be safely used as a note title.
 */
export function sanitizeFileName(name: string): string {
	return name
		.replace(/[\\/:*?"<>|#^[\]]/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.trim();
}

/** Human-readable label for a date, e.g. "Today", "Yesterday" or a full date. */
export function friendlyDateLabel(date: Date, today: Date): string {
	if (isSameDay(date, today)) {
		return t("Today");
	}
	if (isSameDay(date, addDays(today, -1))) {
		return t("Yesterday");
	}
	if (isSameDay(date, addDays(today, 1))) {
		return t("Tomorrow");
	}
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

/** Number of days in the given month (`month` is 0-based, as in `Date`). */
export function daysInMonth(year: number, month: number): number {
	return new Date(year, month + 1, 0).getDate();
}

/** Parse a `YYYY-MM-DD` key into a local date, or null if malformed. */
export function fromDateKey(key: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (!match) {
		return null;
	}
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Moment.js format tokens the note-date extractor understands, longest
 * first so `MMMM` wins over `MM`. Each maps to a regex snippet and notes
 * whether it matches digits (used to add digit boundaries around the
 * pattern, so `YYYYMMDD` does not match inside a longer number).
 */
const FORMAT_TOKENS: [token: string, pattern: string, digits: boolean][] = [
	["YYYY", "\\d{4}", true],
	["YY", "\\d{2}", true],
	["MMMM", "\\p{L}+", false],
	["MMM", "\\p{L}+\\.?", false],
	["MM", "\\d{2}", true],
	["M", "\\d{1,2}", true],
	["DD", "\\d{2}", true],
	["Do", "\\d{1,2}\\p{L}*", true],
	["D", "\\d{1,2}", true],
	["dddd", "\\p{L}+", false],
	["ddd", "\\p{L}+\\.?", false],
	["dd", "\\p{L}+", false],
];

/**
 * Build a regex that finds text shaped like `format` inside a note name,
 * or null when the format uses tokens the extractor does not know.
 */
function noteDatePattern(format: string): RegExp | null {
	let source = "";
	let startsWithDigits = false;
	let endsWithDigits = false;
	let i = 0;
	outer: while (i < format.length) {
		// Moment treats [bracketed] text as literal characters.
		if (format[i] === "[") {
			const close = format.indexOf("]", i);
			const literal = format.slice(i + 1, close < 0 ? undefined : close);
			source += escapeRegExp(literal);
			if (literal.length > 0) {
				endsWithDigits = false;
			}
			i = close < 0 ? format.length : close + 1;
			continue;
		}
		for (const [token, pattern, digits] of FORMAT_TOKENS) {
			if (format.startsWith(token, i)) {
				source += pattern;
				if (source === pattern) {
					startsWithDigits = digits;
				}
				endsWithDigits = digits;
				i += token.length;
				continue outer;
			}
		}
		if (/[A-Za-z]/.test(format[i])) {
			// An unrecognised format token; let the caller fall back to
			// parsing the whole note name with Moment instead.
			return null;
		}
		source += escapeRegExp(format[i]);
		endsWithDigits = false;
		i++;
	}
	if (source.length === 0) {
		return null;
	}
	// Wrap the date in a capture group and require digit boundaries where
	// the pattern starts or ends with digits, so `YYYYMMDD` cannot match
	// inside a longer number. A lookbehind would be neater, but iOS
	// versions before 16.4 do not support them.
	source = "(" + source + ")";
	if (startsWithDigits) {
		source = "(?:^|\\D)" + source;
	}
	if (endsWithDigits) {
		source += "(?!\\d)";
	}
	return new RegExp(source, "u");
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The slice of a parsed Moment object that note-date parsing uses. */
interface ParsedMoment {
	isValid(): boolean;
	toDate(): Date;
}

/**
 * Obsidian's bundled Moment.js, typed by hand. Moment's own type
 * definitions are not always resolvable in stricter lint setups, which
 * would otherwise make every call through `moment` unsafely typed.
 */
const parseMoment = moment as unknown as (
	input: string,
	format: string,
	strict: boolean,
) => ParsedMoment;

/**
 * Extract a date from a note name using a Moment.js format such as
 * `YYYY-MM-DD` or `YYYYMMDD`. The date may sit anywhere in the name
 * ("20260701 Monday" matches with `YYYYMMDD`), and the matched text must
 * also parse strictly so ordinary numbers are not mistaken for dates.
 */
export function parseNoteDate(name: string, format: string): Date | null {
	const trimmed = format.trim();
	if (!trimmed) {
		return null;
	}
	const pattern = noteDatePattern(trimmed);
	if (pattern) {
		const match = pattern.exec(name);
		if (match) {
			const parsed = parseMoment(match[1], trimmed, true);
			if (parsed.isValid()) {
				return parsed.toDate();
			}
		}
		return null;
	}
	// Formats with tokens the extractor does not know still work when the
	// note name is exactly the date.
	const whole = parseMoment(name, trimmed, true);
	return whole.isValid() ? whole.toDate() : null;
}

/**
 * The theme palette the habit modal's swatches store, ordered by hue.
 * The theme accent gets `-1` so default-coloured habits lead, and greys
 * would land at 360; the actual rendered colour depends on the theme,
 * so the palette order is by the colours' conventional hues.
 */
const PALETTE_HUES: Record<string, number> = {
	"var(--interactive-accent)": -1,
	"var(--color-red)": 0,
	"var(--color-orange)": 30,
	"var(--color-yellow)": 60,
	"var(--color-green)": 120,
	"var(--color-cyan)": 180,
	"var(--color-blue)": 240,
	"var(--color-purple)": 280,
	"var(--color-pink)": 330,
};

/**
 * Hue (0–360) of a habit's accent colour, used to order colours so
 * similar ones sit together. Handles the theme-palette CSS variables the
 * habit modal's swatches store as well as hex colours from the custom
 * picker; anything else returns `null` and sorts after the coloured
 * habits.
 */
function colorHue(color: string): number | null {
	const palette = PALETTE_HUES[color.trim()];
	if (palette !== undefined) {
		return palette;
	}
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
	if (!match) {
		return null;
	}
	let hex = match[1];
	if (hex.length === 3) {
		hex = hex.replace(/./g, (c) => c + c);
	}
	const r = parseInt(hex.slice(0, 2), 16) / 255;
	const g = parseInt(hex.slice(2, 4), 16) / 255;
	const b = parseInt(hex.slice(4, 6), 16) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max === min) {
		// Greys have no hue; park them just after the coloured habits.
		return 360;
	}
	const d = max - min;
	let hue: number;
	if (max === r) {
		hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	} else if (max === g) {
		hue = ((b - r) / d + 2) * 60;
	} else {
		hue = ((r - g) / d + 4) * 60;
	}
	return hue;
}

/**
 * The colour a habit's card actually shows: the group colour when the
 * habit opted into it and its group has one, its own colour otherwise.
 */
export function habitAccent(
	habit: HabitDefinition,
	groups: Record<string, GroupStyle>,
): string {
	if (habit.useGroupColor) {
		const style = groups[habit.group.trim()];
		if (style?.color) {
			return style.color;
		}
	}
	return habit.color;
}

/** The most recent day a habit was logged, or "" when it never was. */
function lastLoggedDay(habit: HabitDefinition): string {
	let latest = "";
	for (const day of Object.keys(habit.records)) {
		if (day > latest) {
			latest = day;
		}
	}
	return latest;
}

/**
 * Order habits for display. `habits` arrives name-sorted from the store,
 * and every mode falls back to that name order for ties, so the result
 * is always stable. `manualOrder` holds note paths as arranged in
 * settings; habits missing from it (created since) go to the end.
 */
export function sortHabits(
	habits: HabitDefinition[],
	mode: HabitSortMode,
	manualOrder: readonly string[],
	groups: Record<string, GroupStyle> = {},
	groupOrder: readonly string[] = [],
): HabitDefinition[] {
	const sorted = [...habits];
	switch (mode) {
		case "color": {
			sorted.sort((a, b) => {
				const ca = habitAccent(a, groups);
				const cb = habitAccent(b, groups);
				const ha = ca ? colorHue(ca) : null;
				const hb = cb ? colorHue(cb) : null;
				if (ha === null && hb === null) {
					return a.name.localeCompare(b.name);
				}
				if (ha === null || hb === null) {
					return ha === null ? 1 : -1;
				}
				return ha - hb || a.name.localeCompare(b.name);
			});
			break;
		}
		case "startDate": {
			sorted.sort(
				(a, b) =>
					a.startDate.localeCompare(b.startDate) ||
					a.name.localeCompare(b.name),
			);
			break;
		}
		case "lastLogged": {
			sorted.sort(
				(a, b) =>
					lastLoggedDay(b).localeCompare(lastLoggedDay(a)) ||
					a.name.localeCompare(b.name),
			);
			break;
		}
		case "time": {
			// The day's timeline: habits with a planned time first,
			// earliest first (times are stored sorted, so the first entry
			// is the earliest), then untimed habits by name.
			const first = (habit: HabitDefinition) => habit.times[0] ?? "";
			sorted.sort(
				(a, b) =>
					Number(first(a) === "") - Number(first(b) === "") ||
					first(a).localeCompare(first(b)) ||
					a.name.localeCompare(b.name),
			);
			break;
		}
		case "group": {
			// Group-mates stay adjacent, ordered by the arranged group
			// order; ungrouped habits trail, matching the section order.
			// Within a group, the manual order (arranged by dragging in
			// the groups manager) wins, then names.
			const position = new Map(
				groupOrder.map((name, index) => [name, index]),
			);
			const cardPosition = new Map(
				manualOrder.map((path, index) => [path, index]),
			);
			sorted.sort((a, b) => {
				const ga = a.group.trim();
				const gb = b.group.trim();
				if (ga === gb) {
					const ca =
						cardPosition.get(a.path) ?? Number.MAX_SAFE_INTEGER;
					const cb =
						cardPosition.get(b.path) ?? Number.MAX_SAFE_INTEGER;
					return ca - cb || a.name.localeCompare(b.name);
				}
				if (!ga || !gb) {
					return !ga ? 1 : -1;
				}
				const pa = position.get(ga) ?? Number.MAX_SAFE_INTEGER;
				const pb = position.get(gb) ?? Number.MAX_SAFE_INTEGER;
				return pa - pb || ga.localeCompare(gb);
			});
			break;
		}
		case "manual": {
			const position = new Map(
				manualOrder.map((path, index) => [path, index]),
			);
			sorted.sort((a, b) => {
				const pa = position.get(a.path) ?? Number.MAX_SAFE_INTEGER;
				const pb = position.get(b.path) ?? Number.MAX_SAFE_INTEGER;
				return pa - pb || a.name.localeCompare(b.name);
			});
			break;
		}
		case "name":
			// Already the store's order; nothing to do.
			break;
	}
	return sorted;
}

/** One visual section of the dashboard when grouping is active. */
export interface HabitSection {
	/**
	 * Raw section key: the group name, the colour value, or "" for the
	 * catch-all section (ungrouped or colourless habits).
	 */
	key: string;
	habits: HabitDefinition[];
}

/**
 * Gather habits into sections by group name, preserving the incoming
 * (sorted) order within each section. Sections follow the user's
 * arranged `groupOrder`; groups missing from it append alphabetically,
 * and the catch-all "ungrouped" section always comes last. When
 * grouping is disabled, everything lands in one unnamed section.
 */
export function groupHabits(
	habits: HabitDefinition[],
	enabled: boolean,
	groupOrder: readonly string[] = [],
): HabitSection[] {
	if (!enabled) {
		return [{ key: "", habits }];
	}
	const sections = new Map<string, HabitDefinition[]>();
	for (const habit of habits) {
		const key = habit.group.trim();
		const bucket = sections.get(key);
		if (bucket) {
			bucket.push(habit);
		} else {
			sections.set(key, [habit]);
		}
	}
	const position = new Map(
		groupOrder.map((name, index) => [name, index]),
	);
	const keys = Array.from(sections.keys()).sort((a, b) => {
		// The catch-all section always trails.
		if (a === "" || b === "") {
			return a === "" ? 1 : -1;
		}
		const pa = position.get(a) ?? Number.MAX_SAFE_INTEGER;
		const pb = position.get(b) ?? Number.MAX_SAFE_INTEGER;
		return pa - pb || a.localeCompare(b);
	});
	return keys.map((key) => ({
		key,
		habits: sections.get(key) as HabitDefinition[],
	}));
}

/** Label for a section header; the catch-all gets a placeholder. */
export function sectionLabel(key: string): string {
	return key || t("Ungrouped");
}
