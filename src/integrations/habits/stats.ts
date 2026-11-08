import type { HabitDefinition } from "./types";
import {
	addDays,
	daysInMonth,
	fromDateKey,
	isFlexibleFrequency,
	toDateKey,
} from "./utils";

const MS_PER_DAY = 86_400_000;

export type StatsPeriod = "weekly" | "monthly" | "custom";
export type StatsRangeMode = "rolling" | "calendar";

/**
 * Longest span a custom range may cover. Keeps the per-habit heatmaps
 * renderable — a full year is 366 cells; an accidental decade would be
 * thousands.
 */
export const MAX_CUSTOM_DAYS = 366;

export interface DateRange {
	start: Date;
	end: Date;
}

/** Midnight of the given date, in local time. */
function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday of the week containing the given date. */
function startOfWeek(date: Date): Date {
	const base = startOfDay(date);
	const offset = (base.getDay() + 6) % 7; // Monday = 0
	return addDays(base, -offset);
}

/** True for the two "N times per period, any day" frequencies. */
export function isFlexible(habit: HabitDefinition): boolean {
	return isFlexibleFrequency(habit.frequency);
}

/**
 * Whether a habit's card should show and be interactive on `date`.
 *
 * For every other frequency this is exactly {@link isDue}. Flexible
 * habits are due (in the stats sense) only on their period's last day —
 * see {@link isDue} — but need to be actionable every day so the user can
 * log an occurrence whenever it actually happens.
 */
export function isActive(habit: HabitDefinition, date: Date): boolean {
	if (habit.frequency === "interval" && habit.intervalMode !== "cycle" && (habit.intervalWindowDays || 1) > 1) return !!intervalWindow(habit, date)?.active;
	return isDue(habit, date) || isFlexible(habit);
}

/** The Monday–Sunday week, or calendar month, containing `date`. */
export function flexiblePeriodRange(
	habit: HabitDefinition,
	date: Date,
): DateRange {
	if (habit.frequency === "flexibleWeekly") {
		const start = startOfWeek(date);
		return { start, end: addDays(start, 6) };
	}
	const base = startOfDay(date);
	return {
		start: new Date(base.getFullYear(), base.getMonth(), 1),
		end: new Date(base.getFullYear(), base.getMonth() + 1, 0),
	};
}

/** The period immediately before `range` (mirrors its week/month shape). */
function previousPeriodRange(
	habit: HabitDefinition,
	range: DateRange,
): DateRange {
	if (habit.frequency === "flexibleWeekly") {
		const start = addDays(range.start, -7);
		return { start, end: addDays(start, 6) };
	}
	const prevEnd = addDays(range.start, -1);
	return {
		start: new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1),
		end: prevEnd,
	};
}

/** The period immediately after `range` (mirrors its week/month shape). */
function nextPeriodRange(
	habit: HabitDefinition,
	range: DateRange,
): DateRange {
	if (habit.frequency === "flexibleWeekly") {
		const start = addDays(range.start, 7);
		return { start, end: addDays(start, 6) };
	}
	const nextStart = addDays(range.end, 1);
	return {
		start: nextStart,
		end: new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0),
	};
}

/** Every day in `range` is paused — a whole period to leave out of streaks. */
function periodFullyPaused(habit: HabitDefinition, range: DateRange): boolean {
	let cursor = new Date(range.start);
	while (cursor.getTime() <= range.end.getTime()) {
		if (!isPausedOn(habit, toDateKey(cursor))) {
			return false;
		}
		cursor = addDays(cursor, 1);
	}
	return true;
}

/** Sum of `records` within `range`, from its start through `throughDate`. */
function periodTotalThrough(
	habit: HabitDefinition,
	range: DateRange,
	throughDate: Date,
): number {
	const end =
		throughDate.getTime() < range.end.getTime() ? throughDate : range.end;
	let total = 0;
	let cursor = new Date(range.start);
	while (cursor.getTime() <= end.getTime()) {
		total += habit.records[toDateKey(cursor)] ?? 0;
		cursor = addDays(cursor, 1);
	}
	return total;
}

/**
 * A flexible habit's period-cumulative total, from the start of the period
 * containing `date` through `date` itself. On a non-canonical day this is a
 * live "have I hit quota yet this period" reading; on the period's last day
 * it is the authoritative full-period total.
 */
export function flexiblePeriodTotal(
	habit: HabitDefinition,
	date: Date,
): number {
	return periodTotalThrough(habit, flexiblePeriodRange(habit, date), date);
}

/** Whether a period total reaches a flexible habit's "times per period" goal. */
function meetsFlexibleTarget(habit: HabitDefinition, total: number): boolean {
	if (habit.goalDirection === "max") return total <= limitOf(habit);
	return habit.target > 0 ? total >= habit.target : total > 0;
}

/** Number of whole days from start to end, inclusive. */
export function rangeLength(range: DateRange): number {
	return (
		Math.round((range.start.getTime() - range.end.getTime()) / -MS_PER_DAY) +
		1
	);
}

/**
 * Bring a user-picked custom range into canonical form: reversed ends are
 * swapped, times are stripped, and the span is capped at
 * {@link MAX_CUSTOM_DAYS} (keeping the chosen end). Without a range, the
 * last 14 days are used as a sensible starting point.
 */
export function normalizeCustomRange(
	custom: DateRange | undefined,
	today: Date,
): DateRange {
	const base = startOfDay(today);
	if (!custom) {
		return { start: addDays(base, -13), end: base };
	}
	let start = startOfDay(custom.start);
	let end = startOfDay(custom.end);
	if (start.getTime() > end.getTime()) {
		[start, end] = [end, start];
	}
	if (rangeLength({ start, end }) > MAX_CUSTOM_DAYS) {
		start = addDays(end, -(MAX_CUSTOM_DAYS - 1));
	}
	return { start, end };
}

/**
 * Resolve the date range for a period and mode.
 *
 * - rolling: the last 7 or 30 days ending today.
 * - calendar: the current week (Monday–Sunday) or current month (dynamic).
 * - custom period: the user-picked range (normalized); `mode` is ignored.
 */
export function getStatsRange(
	today: Date,
	period: StatsPeriod,
	mode: StatsRangeMode,
	custom?: DateRange,
): DateRange {
	if (period === "custom") {
		return normalizeCustomRange(custom, today);
	}
	const base = startOfDay(today);
	if (mode === "rolling") {
		const length = period === "weekly" ? 7 : 30;
		return { start: addDays(base, -(length - 1)), end: base };
	}
	if (period === "weekly") {
		const start = startOfWeek(base);
		return { start, end: addDays(start, 6) };
	}
	const start = new Date(base.getFullYear(), base.getMonth(), 1);
	const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
	return { start, end };
}

/**
 * The day of the month a monthly habit falls due in the given month, clamped
 * to the month's length. A habit set to the 31st therefore lands on the last
 * day of shorter months (e.g. 28 or 29 in February) rather than being skipped.
 */
export function effectiveMonthDay(
	year: number,
	month: number,
	monthDay: number,
): number {
	const length = daysInMonth(year, month);
	return Math.min(Math.max(1, monthDay), length);
}

/**
 * The day an interval habit's every-N-days cycle counts from: its start
 * date, or the earliest record for hand-written notes without one. `null`
 * means no anchor exists yet (a brand-new note with no records).
 */
export function intervalAnchor(habit: HabitDefinition): Date | null {
	if (habit.startDate !== "") {
		return fromDateKey(habit.startDate);
	}
	const keys = Object.keys(habit.records);
	if (keys.length > 0) {
		return fromDateKey(keys.reduce((min, key) => (key < min ? key : min)));
	}
	return null;
}

function scheduleAnchor(habit: HabitDefinition, date: Date): Date | null {
	const latest = (habit.cycleRestarts || []).filter(day => day <= toDateKey(date)).sort().pop();
	return latest ? fromDateKey(latest) : intervalAnchor(habit);
}

function intervalWindow(habit: HabitDefinition, date: Date) {
	const anchor = scheduleAnchor(habit, date);
	if (!anchor) return null;
	const interval = Math.max(2, habit.intervalDays || 2);
	const window = Math.max(1, Math.min(interval, habit.intervalWindowDays || 1));
	const key = toDateKey(date);
	let base = anchor;
	if (habit.intervalMode === "completion" && habit.goalDirection !== "max") {
		for (let cycle = 0; cycle < 10000; cycle++) {
			const nextStart = addDays(base, interval);
			if (date < nextStart) break;
			const startKey = toDateKey(base);
			const endKey = toDateKey(addDays(base, window - 1));
			const completed = Object.keys(habit.records).filter(day => day >= startKey && day <= endKey).filter(day => {
				const value = habit.records[day] ?? 0;
				return value > 0 && !isFailedOn(habit, day) && !isSkippedOn(habit, day) && !isPausedOn(habit, day) && (habit.type === "binary" || value >= habit.target);
			}).sort().pop();
			base = completed ? addDays(fromDateKey(completed) || base, interval) : nextStart;
		}
	}
	const elapsed = Math.round((startOfDay(date).getTime() - startOfDay(base).getTime()) / MS_PER_DAY);
	if (elapsed < 0) return { active: false, due: false, start: base, end: addDays(base, window - 1) };
	const offset = elapsed % interval;
	const start = addDays(date, -offset);
	return { active: offset < window, due: offset === window - 1, start, end: addDays(start, window - 1) };
}

/**
 * True when the habit is due on the given date.
 *
 * - `daily` habits are due every day.
 * - `weekly` habits are due on their chosen weekdays.
 * - `monthly` habits are due on their chosen day of the month, clamped to the
 *   month's last day when the month is shorter.
 * - `interval` habits are due every N days counted from their anchor (see
 *   {@link intervalAnchor}); dates before the anchor are never due, and a
 *   habit with no anchor yet behaves as daily until one exists.
 * - `flexibleWeekly`/`flexibleMonthly` habits are due, in this stats sense,
 *   only on the last day of their period (Sunday, or the month's last day)
 *   — the one canonical day a whole period's outcome is scored on. Use
 *   {@link isActive} for "should this show up today" instead; it is true
 *   every day for these two frequencies.
 */
export function isDue(habit: HabitDefinition, date: Date): boolean {
	const key = toDateKey(date);
	if (rescheduleTarget(habit, key)) {
		// This day's instance moved elsewhere; it isn't due here any more.
		return false;
	}
	if (rescheduleSource(habit, key)) {
		// A moved instance lands here instead, whether or not this day
		// would otherwise be due on its own.
		return true;
	}
	if (habit.frequency === "flexibleWeekly") {
		return date.getDay() === 0; // Sunday: the last day of a Monday-start week
	}
	if (habit.frequency === "flexibleMonthly") {
		return (
			date.getDate() === daysInMonth(date.getFullYear(), date.getMonth())
		);
	}
	if (habit.frequency === "weekly") {
		return habit.weekdays.includes(date.getDay());
	}
	if (habit.frequency === "monthly") {
		return (
			date.getDate() ===
			effectiveMonthDay(
				date.getFullYear(),
				date.getMonth(),
				habit.monthDay,
			)
		);
	}
	if (habit.frequency === "interval") {
		if (habit.intervalMode === "cycle") {
			const anchor = scheduleAnchor(habit, date);
			if (!anchor) return true;
			const elapsed = Math.round((startOfDay(date).getTime() - anchor.getTime()) / MS_PER_DAY);
			const length = Math.max(2, habit.intervalDays || 2);
			return elapsed >= 0 && elapsed % length < Math.max(1, Math.min(length, habit.cycleActiveDays || 1));
		}
		if ((habit.intervalWindowDays || 1) > 1) return !!intervalWindow(habit, date)?.due;
		if (habit.intervalMode === "completion" && habit.goalDirection !== "max") {
			// Only earlier successful records can move this day's due date.
			// Future records and partial counts never rewrite its history.
			const completed = (day: string): boolean => {
				const value = habit.records[day] ?? 0;
				return !(habit.failed ?? []).includes(day) && !(habit.skipped ?? []).includes(day)
					&& !isPausedOn(habit, day) && value > 0
					&& (habit.type === "binary" || value >= habit.target);
			};
			if (completed(key)) return true;
			const restartAnchor = scheduleAnchor(habit, date);
			const previous = Object.keys(habit.records).filter(day => day < key && (!restartAnchor || day >= toDateKey(restartAnchor)) && completed(day)).sort().pop();
			const anchor = previous ? fromDateKey(previous) : restartAnchor;
			if (!anchor) return true;
			const days = Math.round((startOfDay(date).getTime() - anchor.getTime()) / MS_PER_DAY);
			// An overdue habit remains actionable until it is completed.
			return days >= (previous ? Math.max(2, habit.intervalDays) : 0);
		}
		const anchor = scheduleAnchor(habit, date);
		if (!anchor) {
			return true;
		}
		// Both dates are local midnights; rounding absorbs the odd hour a
		// DST transition adds or removes inside the span.
		const days = Math.round(
			(startOfDay(date).getTime() - anchor.getTime()) / MS_PER_DAY,
		);
		return days >= 0 && days % Math.max(1, habit.intervalDays) === 0;
	}
	return true;
}

/**
 * The limit a `max` habit must stay under. Binary limit habits are always
 * "none at all" (any logged value is a slip); counter and timed habits use
 * `target` as the limit, where `0` is a valid "zero allowed" limit.
 */
export function limitOf(habit: HabitDefinition): number {
	if (habit.type === "binary") {
		return 0;
	}
	return Math.max(0, habit.target);
}

/**
 * The first day a habit counts towards scoring.
 *
 * Days before a habit existed must not count at all: for `max` habits an
 * unlogged day scores as "within limit", so without a lower bound every day
 * since the beginning of time would count as a success — and for `min`
 * habits every pre-start day would count as a failure, deflating rates.
 * Habits normally carry a `startDate`; for hand-written notes without one,
 * the earliest record is used, and a habit with neither only starts scoring
 * today.
 */
export function trackingStartKey(
	habit: HabitDefinition,
	today: Date = new Date(),
): string {
	if (habit.startDate !== "") {
		return habit.startDate;
	}
	const keys = Object.keys(habit.records);
	if (keys.length > 0) {
		return keys.reduce((min, key) => (key < min ? key : min));
	}
	return toDateKey(today);
}

/**
 * True when a habit met its goal on the given day.
 *
 * For `flexibleWeekly`/`flexibleMonthly` habits: the running total for the
 * period containing `dateKey`, summed from the period's start through
 * `dateKey` itself, reaches `target`. Well-defined for any day, not just
 * the period's canonical last day — see {@link flexiblePeriodTotal}.
 * For `min` habits: the logged value reached the target.
 * For `max` habits: the logged value stayed at or under the limit — an
 * unlogged day counts as within limit, but only from the habit's start
 * day onward (see {@link limitStartKey}).
 */
export function isComplete(habit: HabitDefinition, dateKey: string): boolean {
	const target = rescheduleTarget(habit, dateKey);
	if (target) {
		// A rescheduled day's completion lives entirely on its new day —
		// reschedules can't chain, so this never recurses more than once.
		return isComplete(habit, target);
	}
	if (isFlexible(habit)) {
		if (habit.goalDirection === "max" && dateKey < trackingStartKey(habit)) return false;
		const date = fromDateKey(dateKey);
		return date ? meetsFlexibleTarget(habit, flexiblePeriodTotal(habit, date)) : false;
	}
	if (habit.frequency === "interval" && habit.intervalMode !== "cycle" && (habit.intervalWindowDays || 1) > 1) {
		const date = fromDateKey(dateKey);
		const window = date ? intervalWindow(habit, date) : null;
		if (!window?.due) return false;
		return Object.keys(habit.records).some(day => {
			if (day < toDateKey(window.start) || day > toDateKey(window.end)) return false;
			const value = habit.records[day] ?? 0;
			return value > 0 && !isFailedOn(habit, day) && !isSkippedOn(habit, day) && !isPausedOn(habit, day) && (habit.type === "binary" || value >= habit.target);
		});
	}
	// "Fail for today" is a deliberate miss: it wins over any logged value,
	// and over a limit habit's "silence is clean" default.
	if (isFailedOn(habit, dateKey)) {
		return false;
	}
	const value = habit.records[dateKey] ?? 0;
	if (habit.goalDirection === "max") {
		if (dateKey < trackingStartKey(habit)) {
			return false;
		}
		return value <= limitOf(habit);
	}
	if (habit.type === "binary") {
		return value >= 1;
	}
	return habit.target > 0 ? value >= habit.target : value > 0;
}

/** Daily card completion is independent of the weekly/monthly quota statistics. */
export function isDailyComplete(habit: HabitDefinition, dateKey: string): boolean {
	if (isFlexible(habit) && habit.goalDirection !== "max" && (habit.dailyTarget || 0) > 0) {
		if (isFailedOn(habit, dateKey) || isSkippedOn(habit, dateKey)) return false;
		return (habit.records[dateKey] || 0) >= habit.dailyTarget! || isComplete(habit, dateKey);
	}
	return isComplete(habit, dateKey);
}

/**
 * True when the habit was paused on the given day — including a day the
 * user skipped ("Skip for today"), which is a one-day pause: it's left out
 * of streaks and completion rates exactly like any other paused day.
 */
export function isPausedOn(habit: HabitDefinition, dateKey: string): boolean {
	if (isSkippedOn(habit, dateKey)) {
		return true;
	}
	return habit.pauses.some(
		(pause) =>
			dateKey >= pause.start &&
			(pause.end === "" || dateKey <= pause.end),
	);
}

/**
 * True when the user closed the given day as failed ("Fail for today").
 * Tolerates a habit object built without the list (e.g. a test fixture or
 * a habit from an older code path), treating it as empty.
 */
export function isFailedOn(habit: HabitDefinition, dateKey: string): boolean {
	return (habit.failed as string[] | undefined)?.includes(dateKey) ?? false;
}

/** True when the user skipped the given day ("Skip for today"). */
export function isSkippedOn(habit: HabitDefinition, dateKey: string): boolean {
	return (habit.skipped as string[] | undefined)?.includes(dateKey) ?? false;
}

/**
 * The date a due day's instance was moved to, if `dateKey` was rescheduled
 * away. `isDue`/`isComplete` use this to make a moved day stop counting and
 * its new day count in its place.
 */
export function rescheduleTarget(
	habit: HabitDefinition,
	dateKey: string,
): string | null {
	return habit.reschedules.find((r) => r.from === dateKey)?.to ?? null;
}

/**
 * The original due date `dateKey` covers, if it's a reschedule's
 * destination.
 */
export function rescheduleSource(
	habit: HabitDefinition,
	dateKey: string,
): string | null {
	return habit.reschedules.find((r) => r.to === dateKey)?.from ?? null;
}

/**
 * Whether a habit's missed days can be reviewed and rescheduled at all
 * (experimental): a fixed-schedule (non-flexible), reach-a-target
 * (non-`max`) habit whose value is logged by hand, not derived from a
 * note's own content — and, crucially, not due every single day. A daily
 * habit has no day that isn't already its own due day, so there would
 * never be anywhere open to move a miss onto; interval habits are always
 * at least every-other-day (`intervalDays` is clamped to 2+), so they
 * always have somewhere free.
 */
export function isRescheduleEligible(habit: HabitDefinition): boolean {
	return (
		!habit.stopped &&
		habit.type !== "note" &&
		habit.goalDirection !== "max" &&
		habit.frequency !== "daily" &&
		!isFlexible(habit)
	);
}

/**
 * Whether `dateKey` is open to become a reschedule's destination for
 * `habit`: on or after the habit's tracking start (a day before the habit
 * existed couldn't have been due there anyway), not already due on its own
 * (that would collide with its own obligation — the "no double entries"
 * rule), not paused, and not already claimed by another reschedule as
 * either its origin or its destination. Chaining a rescheduled day into a
 * second reschedule isn't supported.
 */
export function isRescheduleTargetOpen(
	habit: HabitDefinition,
	dateKey: string,
): boolean {
	const date = fromDateKey(dateKey);
	if (!date) {
		return false;
	}
	if (dateKey < trackingStartKey(habit)) {
		return false;
	}
	if (isDue(habit, date) || isPausedOn(habit, dateKey)) {
		return false;
	}
	return !habit.reschedules.some(
		(r) => r.from === dateKey || r.to === dateKey,
	);
}

/** One habit's missed due day, as surfaced by {@link missedInstances}. */
export interface MissedInstance {
	habit: HabitDefinition;
	dateKey: string;
}

/**
 * Every open (due, not paused, not complete) past due day across
 * `habits`, newest first, capped at `limit`. Feeds the "missed habits"
 * notification and its review modal (experimental) — only habits passing
 * {@link isRescheduleEligible} are scanned, and `isDue`/`isComplete`
 * already fold in reschedules, so a day already moved elsewhere is
 * correctly skipped and a rescheduled-to day that's since also gone
 * unlogged correctly turns up in its place.
 */
export function missedInstances(
	habits: HabitDefinition[],
	today: Date,
	limit = 30,
): MissedInstance[] {
	const results: MissedInstance[] = [];
	// Guard against a pathological scan on a very old, long-gapped habit.
	const maxScan = 366 * 2;
	for (const habit of habits) {
		if (!isRescheduleEligible(habit)) {
			continue;
		}
		const startKey = trackingStartKey(habit, today);
		let cursor = addDays(today, -1);
		let scanned = 0;
		while (scanned < maxScan) {
			const key = toDateKey(cursor);
			if (key < startKey) {
				break;
			}
			if (
				isDue(habit, cursor) &&
				!isPausedOn(habit, key) &&
				// A failed day was decided on purpose, not forgotten, so
				// it isn't offered for rescheduling.
				!isFailedOn(habit, key) &&
				!isComplete(habit, key)
			) {
				results.push({ habit, dateKey: key });
			}
			cursor = addDays(cursor, -1);
			scanned++;
		}
	}
	results.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
	return results.slice(0, limit);
}

/**
 * {@link currentStreak} for a flexible habit: walks period by period (weeks
 * or months) rather than day by day, since evaluating every day of an
 * in-progress, not-yet-satisfied period would falsely look like a string of
 * broken days. The current, still-open period counts if it is already
 * satisfied and otherwise doesn't break anything — there is still time left
 * in it, the same idea as the existing "today may still be blank" grace,
 * just at period granularity. Every fully elapsed period after that is a
 * plain pass/fail, so no grace is needed there.
 */
function flexibleCurrentStreak(habit: HabitDefinition, today: Date): number {
	const habitStart = fromDateKey(trackingStartKey(habit, today));
	let range = flexiblePeriodRange(habit, today);
	let streak = 0;

	if (toDateKey(range.end) !== toDateKey(startOfDay(today))) {
		// An exceeded limit has no grace while the current period is open.
		if (habit.goalDirection === "max" && habitStart && today >= habitStart &&
			!periodFullyPaused(habit, range) &&
			!meetsFlexibleTarget(habit, periodTotalThrough(habit, range, today))) return 0;
		if (
			habitStart &&
			range.end.getTime() >= habitStart.getTime() &&
			!periodFullyPaused(habit, range) &&
			meetsFlexibleTarget(habit, periodTotalThrough(habit, range, today))
		) {
			streak++;
		}
		range = previousPeriodRange(habit, range);
	}

	for (;;) {
		if (habitStart && range.end.getTime() < habitStart.getTime()) {
			break;
		}
		if (periodFullyPaused(habit, range)) {
			range = previousPeriodRange(habit, range);
			continue;
		}
		if (meetsFlexibleTarget(habit, periodTotalThrough(habit, range, range.end))) {
			streak++;
		} else {
			break;
		}
		range = previousPeriodRange(habit, range);
	}
	return streak;
}

/** {@link longestStreak} for a flexible habit; see {@link flexibleCurrentStreak}. */
function flexibleLongestStreak(habit: HabitDefinition, today: Date): number {
	const habitStart = fromDateKey(trackingStartKey(habit, today));
	if (!habitStart) {
		return 0;
	}
	const todayRange = flexiblePeriodRange(habit, today);
	let range = flexiblePeriodRange(habit, habitStart);
	let best = 0;
	let run = 0;
	while (range.start.getTime() <= todayRange.start.getTime()) {
		if (periodFullyPaused(habit, range)) {
			range = nextPeriodRange(habit, range);
			continue;
		}
		const isCurrent = range.start.getTime() === todayRange.start.getTime();
		const through = isCurrent ? today : range.end;
		if (meetsFlexibleTarget(habit, periodTotalThrough(habit, range, through))) {
			run++;
			best = Math.max(best, run);
		} else if (!isCurrent) {
			// An unmet but still-open current period doesn't reset the run —
			// mirrors flexibleCurrentStreak's grace for it.
			run = 0;
		}
		range = nextPeriodRange(habit, range);
	}
	return best;
}

/**
 * Consecutive complete due periods ending with the most recent one.
 *
 * For daily habits every day is a period. For weekly and monthly habits only
 * their due dates count, so the streak measures consecutive weeks or months
 * completed. Paused due dates are skipped entirely (they neither break nor
 * extend a streak), and the most recent due date may still be blank (e.g. a
 * due date that is today) without breaking the streak. Flexible habits
 * delegate to {@link flexibleCurrentStreak}, which walks whole periods
 * instead of days.
 */
export function currentStreak(habit: HabitDefinition, today: Date): number {
	if (isFlexible(habit)) {
		return flexibleCurrentStreak(habit, today);
	}
	let cursor = startOfDay(today);
	let streak = 0;
	let graceUsed = false;
	// An interval habit is never due before its anchor, so without a floor
	// the walk below would search backwards forever.
	const floor =
		habit.frequency === "interval" ? intervalAnchor(habit) : null;
	for (;;) {
		if (floor && cursor.getTime() < floor.getTime()) {
			break;
		}
		if (!isDue(habit, cursor)) {
			cursor = addDays(cursor, -1);
			continue;
		}
		const key = toDateKey(cursor);
		if (isPausedOn(habit, key)) {
			cursor = addDays(cursor, -1);
			continue;
		}
		if (isComplete(habit, key)) {
			streak++;
		} else if (
			streak === 0 &&
			!graceUsed &&
			habit.goalDirection !== "max"
		) {
			// The most recent due date may still be blank (e.g. today). Limit
			// habits get no grace: for them a blank day already counts as
			// within limit, so an incomplete day is a real slip (or a day
			// before the habit started) and the streak genuinely ends there.
			graceUsed = true;
		} else {
			break;
		}
		cursor = addDays(cursor, -1);
	}
	return streak;
}

/**
 * The longest run of consecutive complete due periods ever recorded. Days on
 * which the habit is not due are ignored, and paused due dates inside a run do
 * not break it.
 *
 * `min` habits anchor the scan on logged completions. `max` habits cannot
 * (silence is success, so there may be no logged "completions" at all);
 * they scan the whole tracked window, from the habit's start day to today.
 * Flexible habits delegate to {@link flexibleLongestStreak}.
 */
export function longestStreak(
	habit: HabitDefinition,
	today: Date = new Date(),
): number {
	if (isFlexible(habit)) {
		return flexibleLongestStreak(habit, today);
	}
	let first: Date | null;
	let last: Date | null;
	if (habit.goalDirection === "max") {
		first = fromDateKey(trackingStartKey(habit, today));
		last = startOfDay(today);
		if (!first || first.getTime() > last.getTime()) {
			return 0;
		}
	} else {
		const completedKeys = Object.keys(habit.records)
			.filter((key) => isComplete(habit, key))
			.sort();
		if (completedKeys.length === 0) {
			return 0;
		}
		first = fromDateKey(completedKeys[0]);
		last = fromDateKey(completedKeys[completedKeys.length - 1]);
	}
	if (!first || !last) {
		return 0;
	}

	let best = 0;
	let run = 0;
	let cursor = first;
	while (cursor.getTime() <= last.getTime()) {
		if (isDue(habit, cursor)) {
			const key = toDateKey(cursor);
			if (isComplete(habit, key)) {
				run++;
				best = Math.max(best, run);
			} else if (!isPausedOn(habit, key)) {
				run = 0;
			}
		}
		cursor = addDays(cursor, 1);
	}
	return best;
}

export interface HabitPeriodStats {
	days: number;
	completed: number;
	total: number;
	rate: number;
	current: number;
	best: number;
}

/** The last day of the range to count towards metrics (never in the future). */
function elapsedEnd(range: DateRange, today: Date): number {
	return Math.min(range.end.getTime(), startOfDay(today).getTime());
}

/**
 * Aggregate a single habit's stats over the elapsed days of a range.
 * Days before the habit's tracking start (see {@link trackingStartKey}) are
 * excluded entirely — the habit did not exist yet, so they count neither as
 * successes nor as failures.
 */
export function habitStats(
	habit: HabitDefinition,
	range: DateRange,
	today: Date,
): HabitPeriodStats {
	const end = elapsedEnd(range, today);
	const startKey = trackingStartKey(habit, today);
	let days = 0;
	let completed = 0;
	let total = 0;
	let cursor = new Date(range.start);
	while (cursor.getTime() <= end) {
		const key = toDateKey(cursor);
		if (
			key < startKey ||
			!isDue(habit, cursor) ||
			isPausedOn(habit, key)
		) {
			cursor = addDays(cursor, 1);
			continue;
		}
		days++;
		const value = habit.records[key] ?? 0;
		if (isFlexible(habit)) {
			// isDue only gates this loop through on the period's last day, so
			// `cursor` is the period end here and this total is the whole
			// period's, not just this one day's.
			total += flexiblePeriodTotal(habit, cursor);
			if (isComplete(habit, key)) {
				completed++;
			}
		} else if (habit.goalDirection === "max") {
			// For limit habits `total` is consumption (slips for binary),
			// and a completed day is one that stayed within the limit.
			total += value;
			if (isComplete(habit, key)) {
				completed++;
			}
		} else if (habit.type === "binary") {
			if (value >= 1) {
				completed++;
				total++;
			}
		} else {
			total += value;
			if (isComplete(habit, key)) {
				completed++;
			}
		}
		cursor = addDays(cursor, 1);
	}
	return {
		days,
		completed,
		total,
		rate: days > 0 ? completed / days : 0,
		current: currentStreak(habit, today),
		best: longestStreak(habit, today),
	};
}

/**
 * Count elapsed days in the range where every habit was complete.
 * Habits paused on a given day are ignored for that day, as are habits not
 * yet being tracked; a day with every habit paused or untracked cannot be
 * perfect.
 */
export function perfectDays(
	habits: HabitDefinition[],
	range: DateRange,
	today: Date,
): number {
	if (habits.length === 0) {
		return 0;
	}
	const end = elapsedEnd(range, today);
	const startKeys = habits.map((habit) => trackingStartKey(habit, today));
	let count = 0;
	let cursor = new Date(range.start);
	while (cursor.getTime() <= end) {
		const key = toDateKey(cursor);
		const date = cursor;
		const active = habits.filter(
			(habit, i) =>
				key >= startKeys[i] &&
				isDue(habit, date) &&
				!isPausedOn(habit, key),
		);
		if (
			active.length > 0 &&
			active.every((habit) => isComplete(habit, key))
		) {
			count++;
		}
		cursor = addDays(cursor, 1);
	}
	return count;
}
