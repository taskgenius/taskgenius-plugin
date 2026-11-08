import { localPointDate, pointDate } from "./daily-points";

export interface PointAwardTask {
	id?: string;
	filePath?: string;
	line?: number;
	content?: string;
	originalMarkdown?: string;
	metadata?: { points?: number | string; completedDate?: string | number };
}

export function resolveTaskPoints(task: PointAwardTask, defaultPoints: number): number {
	const explicit = task.metadata?.points;
	if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
		const value = Number(explicit);
		return Number.isFinite(value) ? Math.max(0, value) : 0;
	}
	const inline = String(task.originalMarkdown || task.content || "").match(/\[(?:points|积分)::\s*(-?\d+(?:\.\d+)?)\]/i);
	if (inline) return Math.max(0, Number(inline[1]));
	return Number.isFinite(defaultPoints) ? Math.max(0, defaultPoints) : 0;
}

export function taskCompletionTransactionId(task: PointAwardTask, now = new Date()): string {
	const id = String(task.id || `${task.filePath || ""}:${task.line ?? 0}`);
	const completed = task.metadata?.completedDate;
	const day = completed ? typeof completed === "number" ? localPointDate(new Date(completed)) : pointDate(completed) : localPointDate(now);
	return `task:${id}:${day}`;
}
