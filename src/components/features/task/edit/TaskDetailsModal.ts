import { App, Notice } from "obsidian";
import type { Task } from "@/types/task";
import type TaskProgressBarPlugin from "@/index";
import { QuickCaptureModal } from "@/components/features/quick-capture/modals/QuickCaptureModalWithSwitch";
import { taskDatePrecisions } from "@/utils/date/optional-date-time";
import { t } from "@/translations/helper";

/** Editing uses the actual capture form, editor, preview and footer. */
export class TaskDetailsModal extends QuickCaptureModal {
	private task: Task;
	private closed = false;
	private saving = false;
	constructor(app: App, plugin: TaskProgressBarPlugin, task: Task, private onTaskUpdated?: (task: Task) => Promise<void>) {
		super(app, plugin, {}, true);
		this.task = this.clone(task);
		this.rememberCaptureMode = false;
		this.currentMode = "checkbox"; this.inlineModeAvailable = true; this.fileModeAvailable = false;
		this.setTitle(t("Edit Task"));
	}
	private clone(task: Task): Task { return { ...task, content: typeof task.content === "string" ? task.content : "", metadata: structuredClone(task.metadata || { tags: [], children: [] }) }; }
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
			this.task = this.clone(latest);
		}
		this.sourceTask = this.task;
		const metadata = this.task.metadata;
		const date = (value: unknown) => value == null ? undefined : new Date(value as number);
		this.taskMetadata = { status: this.task.status, priority: metadata.priority, project: typeof metadata.project === "string" ? metadata.project : undefined, context: metadata.context, tags: [...(metadata.tags || [])], points: metadata.points, dependsOn: [...(metadata.dependsOn || [])], startDate: date(metadata.startDate), dueDate: date(metadata.dueDate), scheduledDate: date(metadata.scheduledDate), datePrecision: taskDatePrecisions(this.task), manuallySet: { startDate: true, dueDate: true, scheduledDate: true } };
		this.capturedContent = this.task.content;
		this.contentEl.empty(); super.onOpen();
	}
	protected createTargetFileSelector(root: HTMLElement): void {
		if (this.taskMetadata.project && this.taskMetadata.project !== this.task?.metadata.project) { super.createTargetFileSelector(root); return; }
		root.createDiv({ cls: "quick-capture-section-title", text: t("Capture to:") });
		root.createDiv({ cls: "quick-capture-target", text: this.task?.filePath || "" });
	}
	protected createFooter(): void {
		super.createFooter();
		this.footerContainer?.querySelector(".quick-capture-footer-left")?.empty();
		const button = this.footerContainer?.querySelector(".mod-cta"); if (button) button.textContent = t("Save");
	}
	protected async handleSubmit(): Promise<void> { await this.save(); }
	private async save(): Promise<void> {
		const content = this.markdownEditor?.value ?? this.capturedContent;
		if (this.saving || !content.trim()) return;
		this.saving = true;
		try {
			if (this.contentEl.querySelector('[aria-invalid="true"]')) throw new Error(t("Enter a valid date, optionally followed by HH:mm."));
			const form = this.taskMetadata, status = form.status ?? this.task.status;
			const metadata = { ...this.task.metadata, priority: form.priority, project: form.project, context: form.context, tags: [...(form.tags || [])], points: form.points, dependsOn: [...(form.dependsOn || [])], startDate: form.startDate?.getTime(), dueDate: form.dueDate?.getTime(), scheduledDate: form.scheduledDate?.getTime(), datePrecision: { ...this.task.metadata.datePrecision, ...form.datePrecision, startDate: form.datePrecision?.startDate, dueDate: form.datePrecision?.dueDate, scheduledDate: form.datePrecision?.scheduledDate } };
			let completed = this.task.completed;
			if (status !== this.task.status) {
				completed = (this.plugin.settings.taskStatuses?.completed || "x").split("|").includes(status);
				metadata.completedDate = completed ? metadata.completedDate || Date.now() : undefined;
				metadata.cancelledDate = (this.plugin.settings.taskStatuses?.abandoned || "-").split("|").includes(status) ? metadata.cancelledDate || Date.now() : undefined;
			}
			const updated = { ...this.task, content, status, completed, metadata };
			if (this.onTaskUpdated) await this.onTaskUpdated(updated);
			else {
				if (!this.plugin.writeAPI) throw new Error(t("Task writer is unavailable"));
				const result = await this.plugin.writeAPI.updateTask({ taskId: this.task.id, updates: updated });
				if (!result.success) throw new Error(result.error || t("Failed to update task"));
			}
			this.close();
		} catch (error) { new Notice(String(error)); }
		finally { this.saving = false; }
	}
	onClose(): void { this.closed = true; super.onClose(); }
}
