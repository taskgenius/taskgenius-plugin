import { Component, TFile, moment } from "obsidian";
import type TaskProgressBarPlugin from "@/index";

const completion = /\s*(?:✅\s*\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?|\[completion::\s*[^\]]+\])/g;
const taskLine = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([^\]])(\]\s*)(.*)$/;

/** Only real status transitions are stamped; importing or opening old tasks is read-only. */
export function stampStatusTransitions(before: string, after: string, completedMarks: string, format: "tasks" | "dataview", date: string): string {
	const completed = new Set(completedMarks.split("|"));
	const oldTasks = new Map<string, { mark: string; count: number }>();
	const visit = (text: string, action: (line: string, index: number) => string): string => {
		let fence = "", frontmatter = false;
		return text.split("\n").map((line, index) => {
			const trimmed = line.trim();
			if (index === 0 && trimmed === "---") { frontmatter = true; return line; }
			if (frontmatter) { if (trimmed === "---") frontmatter = false; return line; }
			const match = /^(`{3,}|~{3,})/.exec(trimmed);
			if (match) { if (!fence) fence = match[1][0]; else if (match[1][0] === fence) fence = ""; return line; }
			return fence ? line : action(line, index);
		}).join("\n");
	};
	const identity = (match: RegExpExecArray) => `${match[1]}${match[3]}${match[4].replace(completion, "").trim()}`;
	visit(before, line => { const match = taskLine.exec(line); if (match) { const key = identity(match), previous = oldTasks.get(key); oldTasks.set(key, { mark: match[2], count: (previous?.count || 0) + 1 }); } return line; });
	return visit(after, line => {
		const match = taskLine.exec(line); if (!match) return line;
		const previous = oldTasks.get(identity(match));
		if (!previous || previous.count !== 1 || completed.has(previous.mark) === completed.has(match[2])) return line;
		if (!completed.has(match[2])) return line.replace(completion, "");
		if (/(?:✅\s*\d{4}-\d{2}-\d{2}|\[completion::)/.test(line)) return line;
		return `${line.trimEnd()} ${format === "dataview" ? `[completion:: ${date}]` : `✅ ${date}`}`;
	});
}

/** Covers reading-view clicks and other vault writes as well as source edits. */
export class MarkdownStatusSync extends Component {
	private snapshots = new Map<string, string>();
	private queues = new Map<string, Promise<void>>();
	private disposed = false;
	constructor(private plugin: TaskProgressBarPlugin) { super(); }
	onload(): void {
		const { app } = this.plugin;
		const remember = async (file: TFile | null) => {
			if (file?.extension !== "md" || this.snapshots.has(file.path)) return;
			const text = await app.vault.read(file);
			if (!this.disposed && !this.snapshots.has(file.path)) this.snapshots.set(file.path, text);
		};
		this.registerEvent(app.workspace.on("file-open", file => { void remember(file).catch(console.error); }));
		this.registerEvent(app.vault.on("modify", file => {
			if (!(file instanceof TFile) || file.extension !== "md") return;
			const queue = (this.queues.get(file.path) || Promise.resolve()).then(() => this.sync(file)).catch(console.error);
			this.queues.set(file.path, queue);
			void queue.finally(() => { if (this.queues.get(file.path) === queue) this.queues.delete(file.path); });
		}));
		this.registerEvent(app.vault.on("delete", file => this.snapshots.delete(file.path)));
		this.registerEvent(app.vault.on("rename", (file, oldPath) => { const text = this.snapshots.get(oldPath); this.snapshots.delete(oldPath); if (text !== undefined) this.snapshots.set(file.path, text); }));
		app.workspace.onLayoutReady(() => {
			void remember(app.workspace.getActiveFile()).catch(console.error);
			// Seed only task-bearing notes; never rewrite the initial contents.
			const files = app.vault.getMarkdownFiles().filter(file => app.metadataCache.getFileCache(file)?.listItems?.some(item => item.task !== undefined));
			void (async () => { for (const file of files) { if (this.disposed) return; await remember(file); } })().catch(console.error);
		});
	}
	private async sync(file: TFile): Promise<void> {
		if (this.disposed) return;
		const before = this.snapshots.get(file.path), after = await this.plugin.app.vault.read(file);
		this.snapshots.set(file.path, after);
		if (before === undefined) return;
		const settings = this.plugin.settings;
		const next = stampStatusTransitions(before, after, settings.taskStatuses.completed || "x|X", settings.preferMetadataFormat, moment().format("YYYY-MM-DD"));
		if (next === after || this.disposed) return;
		await this.plugin.app.vault.process(file, current => {
			if (current !== after) return current;
			this.snapshots.set(file.path, next); return next;
		});
	}
	onunload(): void { this.disposed = true; this.snapshots.clear(); }
}
