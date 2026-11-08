import type { App } from "obsidian";
import type { Task } from "@/types/task";
import { getEffectiveProject } from "@/utils/task/task-operations";
import { ProjectFileManager } from "./project-file-manager";

/** One row per project note, rather than a row for every task. */
export function buildProjectPlan(app: App, tasks: Task[]): Task[] {
	return new ProjectFileManager(app).list().filter(project => !project.archived).map(project => {
		const members = tasks.filter(task => getEffectiveProject(task) === project.name);
		const fm = app.metadataCache.getFileCache(project.file)?.frontmatter || {};
		const date = (value: unknown) => { const parsed = value ? new Date(value as string).getTime() : NaN; return Number.isFinite(parsed) ? parsed : undefined; };
		const starts = members.map(task => task.metadata.startDate || task.metadata.scheduledDate).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
		const ends = members.map(task => task.metadata.dueDate).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
		const start = date(fm.startDate) ?? (starts.length ? Math.min(...starts) : project.file.stat?.ctime || Date.now());
		const end = date(fm.dueDate) ?? (ends.length ? Math.max(...ends) : start);
		const completed = fm.status === "completed" || fm.status === "done" || members.length > 0 && members.every(task => task.completed);
		return {
			id: `project-plan:${project.file.path}`, content: project.name, filePath: project.file.path, line: 0,
			originalMarkdown: project.name, completed, status: completed ? "x" : " ",
			metadata: { project: project.name, tags: [], children: [], startDate: start, dueDate: Math.max(start, end), projectPlan: true,
				progress: members.length ? members.filter(task => task.completed).length / members.length : 0 },
		};
	});
}
