import type { App } from "obsidian";
import type { Task } from "@/types/task";

/** A project note is a Gantt row; the checkbox tasks inside it remain calendar tasks. */
export function isProjectCalendarEntry(app: App, task: Task): boolean {
	if (task.metadata?.projectPlan || task.id.startsWith("project-plan:")) return true;
	const fileTask = (task as any).isFileTask || task.id.startsWith("file-source:") || task.metadata?.source === "file-source" || task.metadata?.sourceType === "file";
	if (!fileTask) return false;
	const file = app.vault.getFileByPath(task.filePath);
	const project = file ? app.metadataCache.getFileCache(file)?.frontmatter?.project : undefined;
	return typeof project === "string" && !!project.trim();
}
