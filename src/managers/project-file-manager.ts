import { App, Modal, Notice, Setting, TFile, TFolder, Menu } from "obsidian";
import { Task } from "@/types/task";
import { t } from "@/translations/helper";

export interface ProjectFileInfo { name: string; file: TFile; archived: boolean; description: string; dueDate?: string; startDate?: string; }

/** Markdown project notes are the canonical home for project tasks and settings. */
export class ProjectFileManager {
	static readonly folder = "Projects";
	constructor(private app: App, private tagPrefixes: string[] = ["project"]) {}
	get folder(): string { return this.app.vault.getAbstractFileByPath("Tasks/Projects") instanceof TFolder ? "Tasks/Projects" : ProjectFileManager.folder; }

	list(): ProjectFileInfo[] {
		return this.app.vault.getMarkdownFiles().filter(file => !/(^|\/)(templates?|模板)(\/|$)/i.test(file.path)).flatMap(file => {
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (typeof fm?.project !== "string" || !fm.project.trim() || /\{\{|<%/.test(fm.project)) return [];
			return [{ name: fm.project.trim(), file, archived: fm.archived === true || fm.status === "archived", description: String(fm.description || ""), dueDate: typeof fm.dueDate === "string" ? fm.dueDate : undefined }];
		});
	}

	find(name: string): ProjectFileInfo | undefined {
		const clean = name.trim();
		const cached = this.list().find(project => project.name.toLocaleLowerCase() === clean.toLocaleLowerCase());
		if (cached) return cached;
		// MetadataCache may not have indexed a just-created note yet. Resolve its
		// deterministic path directly so the first task can be moved immediately.
		const slug = clean.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
		const file = this.app.vault.getAbstractFileByPath(`${this.folder}/${slug}.md`);
		if (!(file instanceof TFile)) return undefined;
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return {
			name: typeof fm?.project === "string" ? fm.project : clean,
			file,
			archived: fm?.archived === true || fm?.status === "archived",
			description: String(fm?.description || ""),
			dueDate: typeof fm?.dueDate === "string" ? fm.dueDate : undefined,
		};
	}

	async create(name: string, description = ""): Promise<ProjectFileInfo | null> {
		const clean = name.trim();
		if (!clean) return null;
		const existing = this.find(clean);
		if (existing) return existing;
		await this.ensureFolder(this.folder);
		const slug = clean.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
		const path = `${this.folder}/${slug}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) { new Notice(t("A project file already exists at that path.")); return null; }
		const body = `---\nproject: ${JSON.stringify(clean)}\nstatus: active\narchived: false\ndescription: ${JSON.stringify(description)}\n---\n\n# ${clean}\n\n## ${t("Project plans")}\n\n## ${t("Tasks")}\n\n`;
		const file = await this.app.vault.create(path, body);
		return { name: clean, file, archived: false, description };
	}

	async setArchived(name: string, archived: boolean): Promise<boolean> {
		const project = this.find(name); if (!project) return false;
		if (!archived && /(^|\/)(archive|archives|归档)(\/|$)/i.test(project.file.path)) {
			await this.ensureFolder(this.folder);
			const destination = `${this.folder}/${project.file.name || project.file.path.split("/").pop()}`;
			const collision = this.app.vault.getAbstractFileByPath(destination);
			if (collision && collision !== project.file) throw new Error(t("A project file already exists at that path."));
			await this.app.fileManager.renameFile(project.file, destination);
		}
		await this.app.fileManager.processFrontMatter(project.file, fm => {
			fm.project = project.name; fm.archived = archived; fm.status = archived ? "archived" : "active";
		});
		return true;
	}

	async update(name: string, values: { name?: string; description?: string; dueDate?: string; startDate?: string }): Promise<boolean> {
		const project = this.find(name); if (!project) return false;
		const nextName = values.name?.trim() || project.name;
		const conflict = this.find(nextName);
		if (conflict && conflict.file.path !== project.file.path) throw new Error(t("A project with that name already exists."));
		await this.app.fileManager.processFrontMatter(project.file, fm => {
			fm.project = nextName;
			if (values.description !== undefined) fm.description = values.description;
			if (values.startDate !== undefined) { if (values.startDate) fm.startDate = values.startDate; else delete fm.startDate; }
			if (values.dueDate !== undefined) { if (values.dueDate) fm.dueDate = values.dueDate; else delete fm.dueDate; }
		});
		return true;
	}

	async addTask(name: string, content: string): Promise<boolean> {
		const project = this.find(name); if (!project || !content.trim()) return false;
		await this.app.vault.process(project.file, text => `${text.replace(/\s*$/, "")}\n- [ ] ${content.trim()}\n`);
		return true;
	}

	async moveTask(task: Task, name: string): Promise<boolean> {
		return (await this.moveTasks([task], name)) > 0;
	}

	/** Move a selection of tasks from legacy tagged files into one project note. */
	async moveTasks(tasks: Task[], name: string): Promise<number> {
		if (tasks.some(task => task.metadata?.sourceType === "canvas" || task.filePath.toLowerCase().endsWith(".canvas"))) {
			throw new Error(t("Canvas tasks must be moved through Task Genius."));
		}
		const project = this.find(name) || await this.create(name);
		if (!project || tasks.length === 0) return 0;
		const selectedIds = new Set(tasks.map(task => task.id));
		const roots = tasks.filter(task => !task.metadata?.parent || !selectedIds.has(task.metadata.parent));
		const byPath = new Map<string, Task[]>();
		for (const task of roots) {
			if (task.filePath === project.file.path) continue;
			const group = byPath.get(task.filePath) || [];
			group.push(task);
			byPath.set(task.filePath, group);
		}
		if (!byPath.size) return 0;

		const sourceSnapshots = new Map<TFile, { before: string; after: string }>();
		const movedBlocks: string[] = [];
		for (const [path, group] of byPath) {
			const source = this.app.vault.getAbstractFileByPath(path);
			if (!(source instanceof TFile)) throw new Error(t("The task file could not be found."));
			const before = await this.app.vault.read(source);
			const newline = before.includes("\r\n") ? "\r\n" : "\n";
			const lines = before.split(/\r?\n/);
			const ranges: Array<{ start: number; end: number }> = [];
			for (const task of group.slice().sort((a, b) => b.line - a.line)) {
				const expected = String(task.originalMarkdown || "").trim();
				let start = Math.max(0, task.line);
				if (lines[start]?.trim() !== expected) {
					const matches = lines.map((line, index) => line.trim() === expected ? index : -1).filter(index => index >= 0);
					start = matches.length === 1 ? matches[0] : -1;
				}
				if (start < 0 || !expected) throw new Error(t("The task changed before it could be moved."));
				if (ranges.some(range => start >= range.start && start < range.end)) continue;
				const baseIndent = (lines[start].match(/^\s*/) || [""])[0].replace(/\t/g, "    ").length;
				let end = start + 1;
				while (end < lines.length) {
					if (!lines[end].trim()) {
						let next = end + 1;
						while (next < lines.length && !lines[next].trim()) next++;
						if (next >= lines.length || (lines[next].match(/^\s*/) || [""])[0].replace(/\t/g, "    ").length <= baseIndent) break;
						end++; continue;
					}
					const childIndent = (lines[end].match(/^\s*/) || [""])[0].replace(/\t/g, "    ").length;
					if (childIndent <= baseIndent) break;
					end++;
				}
				ranges.push({ start, end });
				const block = lines.slice(start, end).map(line => {
					if (/^\s*[-*+]\s+\[[^\]]*\]/.test(line)) return this.stripProjectMarkers(line, name, baseIndent);
					const indent = (line.match(/^\s*/) || [""])[0].replace(/\t/g, "    ").length;
					return " ".repeat(Math.max(0, indent - baseIndent)) + line.trimStart();
				});
				movedBlocks.unshift(block.join(newline));
				lines.splice(start, end - start);
			}
			sourceSnapshots.set(source, { before, after: lines.join(newline) });
		}
		if (!movedBlocks.length) return 0;

		const oldDestination = await this.app.vault.read(project.file);
		const destination = `${oldDestination.replace(/\s*$/, "")}\n${movedBlocks.join("\n")}\n`;
		const changed: TFile[] = [];
		try {
			for (const [file, snapshot] of sourceSnapshots) {
				await this.app.vault.modify(file, snapshot.after);
				changed.push(file);
			}
			await this.app.vault.modify(project.file, destination);
		} catch (error) {
			for (const file of changed.reverse()) {
				const snapshot = sourceSnapshots.get(file);
				if (snapshot) await this.app.vault.modify(file, snapshot.before);
			}
			throw error;
		}
		return movedBlocks.length;
	}

	stripProjectMarkers(line: string, projectName: string, baseIndent = 0): string {
		let result = line;
		for (const prefix of new Set(this.tagPrefixes.filter(Boolean))) {
			const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			result = result.replace(new RegExp(`\\s+\\[${escaped}::\\s*[^\\]]+\\]`, "gi"), "");
			// Project ownership is stored in the project note. Strip any legacy
			// marker for this prefix so moving between projects cannot retain a
			// conflicting old assignment.
			result = result.replace(new RegExp(`\\s+#${escaped}/[^\\s#@+]+`, "gi"), "");
		}
		const leading = (result.match(/^\s*/) || [""])[0].replace(/\t/g, "    ").length;
		return `${" ".repeat(Math.max(0, leading - baseIndent))}${result.trimStart()}`.trimEnd();
	}

	async appendTaskBlock(name: string, lines: string[]): Promise<boolean> {
		const project = this.find(name);
		const cleaned = lines.map(line => /^\s*[-*+]\s+\[[^\]]*\]/.test(line) ? this.stripProjectMarkers(line, name) : line);
		if (!project || !cleaned.some(line => line.trim())) return false;
		const block = cleaned.join("\n");
		const before = await this.app.vault.read(project.file);
		await this.app.vault.modify(project.file, `${before.replace(/\s*$/, "")}\n${block}\n`);
		return true;
	}

	async removeTaskBlock(name: string, block: string): Promise<boolean> {
		const project = this.find(name);
		if (!project || !block) return false;
		const before = await this.app.vault.read(project.file);
		const index = before.lastIndexOf(block);
		if (index < 0) return false;
		const after = `${before.slice(0, index)}${before.slice(index + block.length)}`.replace(/\n{3,}/g, "\n\n");
		await this.app.vault.modify(project.file, after);
		return true;
	}
	private async ensureFolder(path: string) {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return;
		if (existing) throw new Error(t("The project folder path is occupied by a file."));
		await this.app.vault.createFolder(path);
	}
}

export class ProjectCreateModal extends Modal {
	constructor(app: App, private manager: ProjectFileManager, private onSave: () => void) { super(app); }
	onOpen() {
		this.setTitle(t("New project")); let name = "", description = "";
		new Setting(this.contentEl).setName(t("Project name")).addText(text => text.onChange(value => name = value));
		new Setting(this.contentEl).setName(t("Description")).addText(text => text.onChange(value => description = value));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Create project")).setCta().onClick(async () => {
			if (!name.trim()) { new Notice(t("Enter a project name.")); return; }
			button.setDisabled(true);
			try { if (await this.manager.create(name, description)) { this.onSave(); this.close(); } }
			catch (error) { new Notice(String(error)); }
			finally { button.setDisabled(false); }
		}));
	}
}

export class ProjectTaskModal extends Modal {
	constructor(app: App, private manager: ProjectFileManager, private project: string, private onSave: () => void) { super(app); }
	onOpen() {
		this.setTitle(t("Add task to project")); let content = "";
		new Setting(this.contentEl).setName(t("Task")).addText(text => text.onChange(value => content = value));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Add task")).setCta().onClick(async () => {
			if (!content.trim()) return;
			button.setDisabled(true);
			try { if (await this.manager.addTask(this.project, content)) { this.onSave(); this.close(); } }
			catch (error) { new Notice(String(error)); }
			finally { button.setDisabled(false); }
		}));
	}
}

export class ProjectEditModal extends Modal {
	constructor(app: App, private manager: ProjectFileManager, private project: ProjectFileInfo, private onSave: () => void) { super(app); }
	onOpen() {
		this.setTitle(t("Edit project details"));
		let description = this.project.description;
		let name = this.project.name;
		new Setting(this.contentEl).setName(t("Project name")).addText(text => text.setValue(name).onChange(value => name = value));
		let dueDate = this.project.dueDate || "";
		let startDate = String(this.app.metadataCache.getFileCache(this.project.file)?.frontmatter?.startDate || "");
		new Setting(this.contentEl).setName(t("Start date")).addText(text => { text.inputEl.type = "date"; text.setValue(startDate).onChange(value => startDate = value); });
		new Setting(this.contentEl).setName(t("Description")).addText(text => text.setValue(description).onChange(value => description = value));
		new Setting(this.contentEl).setName(t("Due date")).addText(text => text.setPlaceholder("YYYY-MM-DD").setValue(dueDate).onChange(value => dueDate = value));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(async () => {
			button.setDisabled(true);
			try { if (await this.manager.update(this.project.name, { name, description, dueDate, startDate })) { this.onSave(); this.close(); } }
			catch (error) { new Notice(String(error)); }
			finally { button.setDisabled(false); }
		}));
	}
}

export class ProjectArchiveModal extends Modal {
	constructor(app: App, private manager: ProjectFileManager, private onChange: () => void) { super(app); }
	onOpen() {
		this.setTitle(t("Archived projects")); this.contentEl.empty();
		const archived = this.manager.list().filter(project => project.archived);
		if (!archived.length) this.contentEl.createDiv({ text: t("No archived projects") });
		for (const project of archived) new Setting(this.contentEl).setName(project.name).setDesc(project.file.path)
			.addButton(button => button.setButtonText(t("Open")).onClick(() => void this.app.workspace.openLinkText(project.file.path, "", false)))
			.addButton(button => button.setButtonText(t("Restore project")).onClick(async () => { await this.manager.setArchived(project.name, false); this.onChange(); this.onOpen(); }));
	}
}
