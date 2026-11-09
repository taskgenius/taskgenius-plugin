import { App, FuzzySuggestModal, Notice, setIcon } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import type { Task } from "@/types/task";
import { t } from "@/translations/helper";

export function renderTaskDependencies(app: App, plugin: TaskProgressBarPlugin, root: HTMLElement, task: Task, onChange: (ids: string[]) => void): { getValue: () => string[] } {
	let selected = [...(task.metadata.dependsOn || [])], tasks = plugin.preloadedTasks || [];
	const chips = root.createDiv({ cls: "tg-dependency-chips" });
	const render = () => {
		chips.empty();
		for (const id of selected) {
			const target = tasks.find(item => item.metadata.id === id || item.id === id);
			const chip = chips.createDiv({ cls: "tg-dependency-chip" }); chip.createSpan({ text: target?.content || t("Task no longer available") });
			const remove = chip.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("Remove dependency") } }); setIcon(remove, "x");
			remove.addEventListener("click", () => { selected = selected.filter(value => value !== id); onChange([...selected]); render(); });
		}
	}; render();
	const add = root.createEl("button", { text: t("Search and select task") });
	add.addEventListener("click", async event => {
		event.preventDefault(); event.stopPropagation(); add.disabled = true;
		try {
			tasks = await plugin.dataflowOrchestrator?.getQueryAPI().getAllTasks() || tasks;
			if (!root.isConnected) return;
			new TaskDependencyPicker(app, plugin, { ...task, metadata: { ...task.metadata, dependsOn: selected } }, tasks, id => {
				selected = [...new Set([...selected, id])]; onChange([...selected]); render();
			}).open();
		} catch (error) { new Notice(String(error)); } finally { add.disabled = false; }
	});
	void plugin.dataflowOrchestrator?.getQueryAPI().getAllTasks().then(items => { if (root.isConnected) { tasks = items; render(); } }).catch(console.error);
	return { getValue: () => [...selected] };
}

export function isDependencyTask(task: Task): boolean {
	return !(task as any).isFileTask && !task.id.startsWith("file-source:") && task.metadata?.source !== "file-source" && task.metadata?.sourceType !== "file" && !task.metadata?.projectPlan && (task.metadata?.source as any)?.type !== "ics";
}

export function dependencyWouldCycle(tasks: Task[], source: Task, target: Task): boolean {
	const byId = new Map(tasks.flatMap(task => [[task.id, task] as const, ...(task.metadata.id ? [[task.metadata.id, task] as const] : [])]));
	const seen = new Set<string>();
	const visit = (task: Task): boolean => {
		if (task.id === source.id) return true;
		if (seen.has(task.id)) return false; seen.add(task.id);
		return (task.metadata.dependsOn || []).some(id => { const next = byId.get(id); return next ? visit(next) : false; });
	}; return visit(target);
}

export class TaskDependencyPicker extends FuzzySuggestModal<Task> {
	constructor(app: App, private plugin: TaskProgressBarPlugin, private source: Task, private tasks: Task[], private onSelected: (id: string) => void) {
		super(app); this.setPlaceholder(t("Search for a task to depend on"));
	}
	getItems(): Task[] { return this.tasks.filter(task => task.id !== this.source.id && isDependencyTask(task) && !(this.source.metadata.dependsOn || []).includes(task.metadata.id || task.id)); }
	getItemText(task: Task): string { return task.content; }
	async onChooseItem(task: Task): Promise<void> {
		if (dependencyWouldCycle(this.tasks, this.source, task)) { new Notice(t("These tasks would depend on each other.")); return; }
		try {
			let id = task.metadata.id;
			if (!id) {
				id = `tg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
				const result = await this.plugin.writeAPI?.updateTask({ taskId: task.id, updates: { metadata: { ...task.metadata, id } } });
				if (!result?.success) throw new Error(result?.error || t("Failed to update task"));
				task.metadata = { ...task.metadata, id };
			}
			this.onSelected(id);
		} catch (error) { new Notice(String(error)); }
	}
}
