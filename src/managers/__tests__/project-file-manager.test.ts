import { App, TFile, TFolder } from "obsidian";
import { ProjectFileManager } from "../project-file-manager";
import { buildProjectPlan } from "../project-plan";
import { saveCapture } from "@/utils/file/file-operations";
import { filterTasks } from "@/utils/task/task-filter-utils";

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
	test("archived project tasks are excluded by the common task filter", () => {
		const { app, addFile } = createVaultHarness();
		addFile("Tasks/Projects/Active.md", "", { project: "Active" });
		addFile("Tasks/Projects/Done.md", "", { project: "Done", archived: true });
		const tasks = ["Active", "Done"].map(name => ({ id: name, content: name, completed: false, status: " ", metadata: { project: name, tags: [], children: [] } } as any));
		const plugin = { app, settings: { viewConfiguration: [{ id: "projects", name: "Projects", type: "default", filterRules: {}, filterBlanks: false, hideCompletedAndAbandonedTasks: false }], taskStatuses: { completed: "x", abandoned: "-" } } } as any;
		expect(filterTasks(tasks, "projects", plugin, {}).map(task => task.id)).toEqual(["Active"]);
	});
	test("existing project notes outside Projects can be edited and archived, and project plans contain only projects", async () => {
		const { app, addFile } = createVaultHarness();
		addFile("Tasks/Projects/Research.md", "# Research", { project: "Research", startDate: "2026-11-01", dueDate: "2026-11-10" });
		addFile("Tasks/Archive/Done.md", "# Done", { project: "Done", archived: true });
		const manager = new ProjectFileManager(app);
		expect(manager.find("Research")?.file.path).toBe("Tasks/Projects/Research.md");
		const plans = buildProjectPlan(app, [{ id: "ordinary", content: "Unassigned task", metadata: {} } as any]);
		expect(plans.map(project => project.content)).toEqual(["Research"]);
		expect(plans[0].metadata.projectPlan).toBe(true);
		await manager.update("Research", { name: "New Research", description: "Updated" });
		expect(manager.find("New Research")?.description).toBe("Updated");
		await manager.setArchived("New Research", true);
		expect(buildProjectPlan(app, [])).toEqual([]);
	});

	test("quick capture saves a project task in its note and strips inline ownership markers", async () => {
		const { app, files, addFile } = createVaultHarness();
		addFile("Inbox.md", "Original inbox");
		await saveCapture(app, "- [ ] Draft #project/Old", { targetFile: "Inbox.md", project: "Writing", appendToFile: "append" } as any);
		expect(files.get("Inbox.md")?.text).toBe("Original inbox");
		expect(files.get("Projects/Writing.md")?.text).toContain("- [ ] Draft");
		expect(files.get("Projects/Writing.md")?.text).not.toContain("#project/");
	});
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

	test("moving a task retains its indented notes, blank lines, and subtasks", async () => {
		const { app, files, addFile } = createVaultHarness();
		const source = addFile("Notes.md", "- [ ] Parent #project/Old\n    Details mentioning #project/reference\n\n    - [ ] Child\n- [ ] Keep\n");
		const manager = new ProjectFileManager(app);
		await manager.moveTask({ id: "root", filePath: source.path, line: 0, originalMarkdown: "- [ ] Parent #project/Old" } as any, "Writing");
		expect(files.get("Projects/Writing.md")?.text).toContain("- [ ] Parent\n    Details mentioning #project/reference\n\n    - [ ] Child");
		expect(files.get("Notes.md")?.text).toBe("- [ ] Keep\n");
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
