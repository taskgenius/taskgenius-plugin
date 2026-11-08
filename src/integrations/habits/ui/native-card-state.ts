import type { HabitDefinition } from "../types";
import { flexiblePeriodTotal, isDailyComplete, isFlexible, isPausedOn, isFailedOn, isSkippedOn, limitOf } from "../stats";
import { fromDateKey } from "../utils";

/** Presentation only: scoring and completion stay owned by Habits. */
export function nativeCardHeat(habit: HabitDefinition, key: string): { level: 0 | 1 | 2 | 3; overLimit: boolean } {
	const date = fromDateKey(key), value = habit.records[key] || 0;
	if (!date || isPausedOn(habit, key) || isSkippedOn(habit, key) || isFailedOn(habit, key)) return { level: 0, overLimit: false };
	if (habit.goalDirection === "max") {
		const actual = isFlexible(habit) ? flexiblePeriodTotal(habit, date) : value;
		return { level: isDailyComplete(habit, key) ? 2 : actual > 0 ? 1 : 0, overLimit: actual > limitOf(habit) };
	}
	if (value <= 0) return { level: 0, overLimit: false };
	const target = isFlexible(habit) && (habit.dailyTarget || 0) > 0 ? habit.dailyTarget! : habit.type === "binary" && !isFlexible(habit) ? 1 : habit.target;
	const total = isFlexible(habit) && !(habit.dailyTarget! > 0) ? flexiblePeriodTotal(habit, date) : value;
	return { level: target > 0 && total >= target * 2 ? 3 : isDailyComplete(habit, key) ? 2 : 1, overLimit: false };
}
