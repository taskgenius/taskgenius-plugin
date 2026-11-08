import { App, TFile, TFolder } from "obsidian";
import { ProjectFileManager } from "../project-file-manager";

function createVaultHarness() {
	const app = new App() as any;
	const files = new Map<string, { file: TFile; text: string; fm?: Record<string, unknown> }>();
	const folder = Object.assign(new TFolder(), { path: "Projects" });
	app.vault.getAbstractFileByPath = (path: string) => path === "Projects" ? folder : files.get(path)?.file || null;
	app.vault.getMarkdownFiles = () => [...files.values()].map(value => value.file);
	app.vault.createFolder = jest.fn(async () => folder);
	app.vault.create = jest.fn(async (path: string, text: string) => {
		const file = Object.assign(new TFile(), { path, name: path.split("/").pop() || path });
		files.set(path, { file, text, fm: { project: path.split("/").pop()?.replace(/\.md$/, "") } });
		return file;
	});
	app.vault.read = jest.fn(async (file: TFile) => files.get(file.path)!.text);
	app.vault.modify = jest.fn(async (file: TFile, text: string) => { files.get(file.path)!.text = text; });
	app.vault.process = jest.fn(async (file: TFile, update: (text: string) => string) => {
		const entry = files.get(file.path)!;
		entry.text = update(entry.text);
	});
	app.metadataCache.getFileCache = (file: TFile) => ({ frontmatter: files.get(file.path)?.fm });
	app.fileManager.processFrontMatter = jest.fn(async (file: TFile, update: (fm: Record<string, unknown>) => void) => {
		const entry = files.get(file.path)!;
		entry.fm ||= {};
		update(entry.fm);
	});
	const addFile = (path: string, text: string, fm: Record<string, unknown> = {}) => {
		const file = Object.assign(new TFile(), { path, name: path.split("/").pop() || path });
		files.set(path, { file, text, fm });
		return file;
	};
	return { app, files, addFile };
}

describe("project Markdown files", () => {
	test("creates project notes with canonical properties and archives them", async () => {
		const { app, files } = createVaultHarness();
		const manager = new ProjectFileManager(app);
		const project = await manager.create("Research Plan", "A short description");
		expect(project?.file.path).toBe("Projects/Research-Plan.md");
		expect(files.get("Projects/Research-Plan.md")?.text).toContain('project: "Research Plan"');
		await manager.setArchived("Research Plan", true);
		expect(manager.find("Research Plan")?.archived).toBe(true);
	});

	test("moves a parent and its subtasks together", async () => {
		const { app, files, addFile } = createVaultHarness();
		const source = addFile("Notes.md", "# Notes\n- [ ] Parent task\n    - [ ] Child task\n- [ ] Keep this task\n");
		const manager = new ProjectFileManager(app);
		await manager.create("Writing");
		const moved = await manager.moveTask({ id: "task-1", filePath: source.path, line: 1, originalMarkdown: "- [ ] Parent task" } as any, "Writing");
		expect(moved).toBe(true);
		expect(files.get("Notes.md")?.text).toContain("Keep this task");
		expect(files.get("Notes.md")?.text).not.toContain("Parent task");
		expect(files.get("Projects/Writing.md")?.text).toContain("- [ ] Parent task\n    - [ ] Child task");
	});

	test("removes legacy project properties and tags from the moved task block", async () => {
		const { app, files, addFile } = createVaultHarness();
		const source = addFile("Notes.md", "- [ ] Parent #project/Writing [project:: Writing]\n    - [ ] Child #project/Writing\n");
		const manager = new ProjectFileManager(app);
		await manager.create("Writing");
		await manager.moveTask({ id: "task-1", filePath: source.path, line: 0, originalMarkdown: "- [ ] Parent #project/Writing [project:: Writing]" } as any, "Writing");
		const destination = files.get("Projects/Writing.md")?.text || "";
		expect(destination).toContain("- [ ] Parent");
		expect(destination).not.toContain("#project/Writing");
		expect(destination).not.toContain("[project::");
	});

	test("refuses to treat Canvas JSON files as Markdown task sources", async () => {
		const { app } = createVaultHarness();
		const manager = new ProjectFileManager(app);
		await expect(manager.moveTasks([{
			id: "canvas-task",
			filePath: "Board.canvas",
			metadata: { sourceType: "canvas" },
		} as any], "Writing")).rejects.toThrow("Canvas tasks must be moved through Task Genius.");
	});	test("restores the source note if appending to the project fails", async () => {
		const { app, files, addFile } = createVaultHarness();
		const original = "- [ ] Parent task\n    - [ ] Child task\n- [ ] Keep task\n";
		const source = addFile("Notes.md", original);
		const manager = new ProjectFileManager(app);
		const project = await manager.create("Writing");
		app.vault.modify.mockImplementation(async (file: TFile, text: string) => {
			if (file.path === project?.file.path) throw new Error("disk write failed");
			files.get(file.path)!.text = text;
		});
		await expect(manager.moveTask({ id: "task-1", filePath: source.path, line: 0, originalMarkdown: "- [ ] Parent task" } as any, "Writing")).rejects.toThrow("disk write failed");
		expect(files.get("Notes.md")?.text).toBe(original);
	});
});
