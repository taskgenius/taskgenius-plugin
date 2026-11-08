import type { Task } from "@/types/task";

/** Empty Markdown placeholders must not become indexed tasks or orphan children. */
export function removeBlankTasks(tasks: Task[]): Task[] {
	const removed = new Map(tasks.filter(task => !String(task.content ?? "").replace(/\u200b/g, "").trim()).map(task => [task.id, task]));
	if (!removed.size) return tasks;
	const kept = tasks.filter(task => !removed.has(task.id)).map(task => {
		let parent = task.metadata.parent;
		const visited = new Set<string>();
		while (parent && removed.has(parent)) {
			if (visited.has(parent)) { parent = undefined; break; }
			visited.add(parent);
			parent = removed.get(parent)!.metadata.parent;
		}
		return { ...task, metadata: { ...task.metadata, parent, children: (task.metadata.children || []).filter(id => !removed.has(id)) } };
	});
	const byId = new Map(kept.map(task => [task.id, task]));
	for (const task of kept) {
		const parent = task.metadata.parent && byId.get(task.metadata.parent);
		if (parent && !parent.metadata.children.includes(task.id)) parent.metadata.children.push(task.id);
	}
	return kept;
}
