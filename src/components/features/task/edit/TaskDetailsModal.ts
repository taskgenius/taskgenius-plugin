import { createEmbeddableMarkdownEditor, EmbeddableMarkdownEditor } from "@/editor-extensions/core/markdown-editor";
import "@/styles/quick-capture.css";
import { App, Modal, ButtonComponent, Notice } from "obsidian";
import type { Task } from "@/types/task";
import type TaskProgressBarPlugin from "@/index";
import { TaskMetadataEditor } from "./MetadataEditor";
import { t } from "@/translations/helper";

/** Shared editor for task cards and tasks in ordinary Markdown notes. */
export class TaskDetailsModal extends Modal {
	private task: Task;
	private markdownEditor?: EmbeddableMarkdownEditor;
	private metadataEditor?: TaskMetadataEditor;
	private closed = false;
	private saving = false;
	constructor(app: App, private plugin: TaskProgressBarPlugin, task: Task, private onTaskUpdated?: (task: Task) => Promise<void>) {
		super(app);
		this.task = { ...task, content: typeof task.content === "string" ? task.content : "", metadata: structuredClone(task.metadata || { tags: [], children: [] }) };
		this.modalEl.addClass("task-details-modal", "tg-task-editor-modal", "quick-capture-modal", "full"); this.setTitle(t("Edit Task"));
	}
	async onOpen(): Promise<void> {
		this.closed = false;
		const query = this.plugin.dataflowOrchestrator?.getQueryAPI();
		if (query) {
			let tasks: Task[];
			try { await this.plugin.dataflowOrchestrator?.refreshFile?.(this.task.filePath); tasks = await query.getAllTasks(true); }
			catch (error) { if (!this.closed) { new Notice(String(error)); this.close(); } return; }
			const latest = tasks.find(task => task.id === this.task.id) || tasks.filter(task => task.filePath === this.task.filePath && task.originalMarkdown === this.task.originalMarkdown).filter((_, index, matches) => matches.length === 1)[0];
			if (this.closed) return;
			if (!latest) { new Notice(t("This task no longer exists. Refresh the task list.")); this.close(); return; }
			this.task = { ...latest, content: latest.content || "", metadata: structuredClone(latest.metadata || { tags: [], children: [] }) };
		}
		const root = this.contentEl; root.empty();
		const layout = root.createDiv({ cls: "quick-capture-layout tg-task-editor-layout" });
		const fields = layout.createDiv({ cls: "quick-capture-config-panel tg-task-editor-fields" });
		fields.createDiv({ cls: "quick-capture-section-title", text: t("Task Properties") });
		const content = layout.createDiv({ cls: "quick-capture-editor-panel tg-task-editor-content" });
		content.createDiv({ cls: "quick-capture-section-title", text: t("Task Content") });
		const editor = content.createDiv({ cls: "quick-capture-modal-editor" });
		if ((this.app as any).embedRegistry) {
			this.markdownEditor = createEmbeddableMarkdownEditor(this.app, editor, {
				value: this.task.content,
				onChange: () => { if (this.markdownEditor) this.task.content = this.markdownEditor.value; },
				onEnter: (_editor, mod) => { if (mod) { void this.save(); return true; } return false; },
				onEscape: () => this.close(),
			});
		} else {
			const input = editor.createEl("textarea", { attr: { "aria-label": t("Task content") } }); input.value = this.task.content;
			input.addEventListener("input", () => { this.task.content = input.value; });
		}
		this.metadataEditor = new TaskMetadataEditor(fields.createDiv(), this.app, this.plugin, false);
		this.metadataEditor.load(); this.metadataEditor.showTask(this.task);
		this.metadataEditor.onMetadataChange = event => {
			if (["content","status","completed"].includes(event.field)) (this.task as any)[event.field] = event.value;
			else (this.task.metadata as any)[event.field] = event.value;
			if (event.field === "status") {
				this.task.completed = (this.plugin.settings.taskStatuses?.completed || "x").split("|").includes(event.value);
				this.task.metadata.completedDate = this.task.completed ? this.task.metadata.completedDate || Date.now() : undefined;
				this.task.metadata.cancelledDate = (this.plugin.settings.taskStatuses?.abandoned || "-").split("|").includes(event.value) ? this.task.metadata.cancelledDate || Date.now() : undefined;
			}
		};
		const footer = root.createDiv({ cls: "tg-task-editor-footer" });
		new ButtonComponent(footer).setButtonText(t("Cancel")).onClick(() => this.close());
		new ButtonComponent(footer).setButtonText(t("Save")).setCta().onClick(() => void this.save());
	}
	private async save(): Promise<void> {
		if (this.saving || !this.task.content.trim()) return;
		this.saving = true;
		try {
			if (this.contentEl.querySelector('[aria-invalid="true"]')) throw new Error(t("Enter a valid date, optionally followed by HH:mm."));
			if (this.onTaskUpdated) await this.onTaskUpdated(this.task);
			else {
				if (!this.plugin.writeAPI) throw new Error(t("Task writer is unavailable"));
				const result = await this.plugin.writeAPI.updateTask({ taskId: this.task.id, updates: this.task });
				if (!result.success) throw new Error(result.error || t("Failed to update task"));
			}
			this.close();
		} catch (error) { new Notice(String(error)); }
		finally { this.saving = false; }
	}
	onClose(): void { this.closed = true; this.markdownEditor?.unload(); this.markdownEditor = undefined; this.metadataEditor?.unload(); this.metadataEditor = undefined; this.contentEl.empty(); }
}
