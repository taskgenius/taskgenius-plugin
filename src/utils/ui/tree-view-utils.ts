import type { Task } from "../../types/task";

/** Filtered results form their own safe tree. Missing parents become roots. */
export function buildVisibleTaskTree(tasks: Task[]): { roots: Task[]; taskMap: Map<string, Task> } {
	const taskMap = new Map(tasks.map(task => [task.id, { ...task, metadata: { ...task.metadata, children: [] as string[] } }]));
	for (const task of taskMap.values()) {
		const parent = task.metadata.parent;
		if (!parent || parent === task.id || !taskMap.has(parent)) { task.metadata.parent = undefined; continue; }
		const seen = new Set([task.id]); let cursor: string | undefined = parent;
		while (cursor && taskMap.has(cursor)) {
			if (seen.has(cursor)) { task.metadata.parent = undefined; break; }
			seen.add(cursor); cursor = taskMap.get(cursor)?.metadata.parent;
		}
	}
	const roots: Task[] = [];
	for (const task of taskMap.values()) {
		const parent = task.metadata.parent ? taskMap.get(task.metadata.parent) : undefined;
		if (parent) parent.metadata.children!.push(task.id); else roots.push(task);
	}
	return { roots, taskMap };
}

export function tasksToTree(tasks: Task[]): Task[] { return buildVisibleTaskTree(tasks).roots; }

export function flattenTaskTree(roots: Task[], taskMap: Map<string, Task>): Task[] {
	const result: Task[] = [], seen = new Set<string>();
	const visit = (task: Task) => { if (seen.has(task.id)) return; seen.add(task.id); result.push(task); for (const id of task.metadata?.children || []) { const child = taskMap.get(id); if (child) visit(child); } };
	roots.forEach(visit); return result;
}
