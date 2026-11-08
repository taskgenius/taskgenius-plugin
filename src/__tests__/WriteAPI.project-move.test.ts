import { App, MetadataCache, TFile, TFolder } from "obsidian";
import { WriteAPI } from "@/dataflow/api/WriteAPI";
import type { Task } from "@/types/task";

describe("WriteAPI project assignment", () => {
	test("moves the task into a project note instead of writing a project tag", async () => {
		const files = new Map<string, { file: TFile; text: string; fm: Record<string, unknown> }>();
		const folder = Object.assign(new TFolder(), { path: "Projects" });
		const app = new App() as any;
		const fakeVault: any = {
			getAbstractFileByPath: (path: string) => path === "Projects" ? folder : files.get(path)?.file || null,
			getMarkdownFiles: () => [...files.values()].map(value => value.file),
			createFolder: jest.fn(async () => folder),
			create: jest.fn(async (path: string, text: string) => {
				const file = Object.assign(new TFile(), { path, name: path.split("/").pop() || path });
				files.set(path, { file, text, fm: { project: "New Project" } });
				return file;
			}),
			read: jest.fn(async (file: TFile) => files.get(file.path)!.text),
			modify: jest.fn(async (file: TFile, text: string) => { files.get(file.path)!.text = text; }),
		};
		const source = Object.assign(new TFile(), { path: "Notes.md", name: "Notes.md" });
		files.set(source.path, { file: source, text: "- [ ] Write report #project/OldProject\n", fm: {} });
		app.vault = fakeVault;
		app.workspace = { trigger: jest.fn(), on: jest.fn(() => ({ unload: jest.fn() })) };
		const metadataCache = new MetadataCache() as any;
		metadataCache.getFileCache = (file: TFile) => ({ frontmatter: files.get(file.path)?.fm });
		const task = {
			id: "task-1", content: "Write report", filePath: source.path, line: 0,
			completed: false, status: " ", originalMarkdown: "- [ ] Write report #project/OldProject",
			metadata: { tags: ["#project/OldProject"], project: "OldProject", children: [] },
		} as Task;
		const plugin: any = { settings: {
			preferMetadataFormat: "tasks", projectTagPrefix: { tasks: "project", dataview: "project" },
			contextTagPrefix: { tasks: "@", dataview: "context" }, taskStatuses: { completed: "x" },
			autoDateManager: { manageStartDate: false, manageCancelledDate: false },
		} };
		const api = new WriteAPI(app, fakeVault, metadataCache, plugin, async () => task);

		const result = await api.updateTask({ taskId: task.id, updates: { metadata: { ...task.metadata, project: "New Project" } as any } });

		expect(result.success).toBe(true);
		expect(files.get("Notes.md")?.text).not.toContain("Write report");
		expect(files.get("Projects/New-Project.md")?.text).toContain("- [ ] Write report");
		expect(files.get("Projects/New-Project.md")?.text).not.toContain("#project/");
	});
});
