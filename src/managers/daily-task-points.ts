import type { Task } from "@/types/task";
import { calculateDailyHabitPoints, DailyHabitInput, localPointDate, pointDate, pointNumber, roundPoints } from "./daily-points";
import { resolveTaskPoints, pointLedgerDate } from "./points-utils";

export interface DailyTaskPoints { date: string; count: number; points: number; credited: number; supplement: number; }
interface LedgerEntry { id?: string; source: string; delta: number; createdAt: number; }

/** Supplement recorded daily task totals, without rewriting any original check-in. */
export function dailyTaskPoints(tasks: Task[], habits: DailyHabitInput[], data: Record<string, any>, ledger: LedgerEntry[], keys: Record<string, string> = {}, configuredRate = 0) {
	const metricHabits = habits.filter(habit => habit.frontmatter.bravoHabitMetricKey === "tasks");
	const metricRate = calculateDailyHabitPoints(metricHabits, data, localPointDate(), keys).find(summary => summary.rate > 0)?.rate;
	const rate = configuredRate > 0 ? configuredRate : metricRate ?? 1;
	const days = new Map<string, DailyTaskPoints>();
	const seen = new Set<string>();
	for (const task of tasks) {
		const metadata = task.metadata;
		if (!task.completed || !metadata?.completedDate || (task as any).isFileTask || metadata.projectPlan ||
			metadata.source === "file-source" || /^(file-source:|project-plan:|ics:)/.test(task.id) || !task.filePath?.toLowerCase().endsWith(".md")) continue;
		const rawDate = metadata.completedDate;
		const date = typeof rawDate === "number" ? localPointDate(new Date(rawDate)) : pointDate(rawDate);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(`${date}T00:00:00`).getTime()) || date > localPointDate()) continue;
		const identity = `${task.filePath}:${task.line}`;
		if (seen.has(identity)) continue;
		seen.add(identity);
		const points = resolveTaskPoints(task, rate);
		const day = days.get(date) || { date, count: 0, points: 0, credited: 0, supplement: 0 };
		day.count++; day.points = roundPoints(day.points + points); days.set(date, day);
	}
	for (const day of days.values()) {
		const recorded = calculateDailyHabitPoints(metricHabits, data, day.date, keys).reduce((sum, summary) => sum + Math.max(0, summary.todayPoints), 0);
		const transactions = ledger.filter(entry => entry.source === "task" && pointLedgerDate(entry) === day.date).reduce((sum, entry) => sum + pointNumber(entry.delta), 0);
		day.credited = roundPoints(recorded + transactions);
		day.supplement = roundPoints(Math.max(0, day.points - day.credited));
	}
	return { rate, days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)) };
}
