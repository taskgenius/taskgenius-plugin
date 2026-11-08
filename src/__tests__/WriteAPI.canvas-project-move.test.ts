import { App, MetadataCache, TFile, TFolder } from "obsidian";
import { WriteAPI } from "@/dataflow/api/WriteAPI";
import type { Task } from "@/types/task";

describe("Canvas task project assignment", () => {
	function setup(deleteSucceeds: boolean) {
		const files = new Map<string, { file: TFile; text: string; fm: Record<string, unknown> }>();
		const folder = Object.assign(new TFolder(), { path: "Projects" });
		const app: any = new App();
		const vault: any = {
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
		const metadataCache = new MetadataCache() as any;
		metadataCache.getFileCache = (file: TFile) => ({ frontmatter: files.get(file.path)?.fm });
		app.vault = vault;
		app.metadataCache = metadataCache;
		app.workspace = { trigger: jest.fn(), on: jest.fn(() => ({ unload: jest.fn() })) };
		const task = {
			id: "canvas-task-1", content: "Plan whiteboard", filePath: "Board.canvas", line: 1,
			completed: false, status: " ", originalMarkdown: "- [ ] Plan whiteboard #project/OldProject",
			metadata: { sourceType: "canvas", canvasNodeId: "node-1", project: "OldProject", tags: ["#project/OldProject"], children: [] },
		} as Task;
		const plugin: any = { settings: { projectTagPrefix: { tasks: "project", dataview: "project" } } };
		const api = new WriteAPI(app, vault, metadataCache, plugin, async () => task);
		api.canvasTaskUpdater.deleteCanvasTask = jest.fn(async () => ({ success: deleteSucceeds }));
		return { api, task, files };
	}

	test("converts a Canvas checkbox to a project Markdown task and removes its old project tag", async () => {
		const { api, task, files } = setup(true);
		const result = await api.updateTask({ taskId: task.id, updates: { metadata: { ...task.metadata, project: "New Project" } as any } });
		expect(result.success).toBe(true);
		expect(files.get("Projects/New-Project.md")?.text).toContain("- [ ] Plan whiteboard");
		expect(files.get("Projects/New-Project.md")?.text).not.toContain("#project/");
		expect(api.canvasTaskUpdater.deleteCanvasTask).toHaveBeenCalledWith(task, false);
	});

	test("rolls back the project note if removing the Canvas task fails", async () => {
		const { api, task, files } = setup(false);
		const result = await api.updateTask({ taskId: task.id, updates: { metadata: { ...task.metadata, project: "New Project" } as any } });
		expect(result.success).toBe(false);
		expect(files.get("Projects/New-Project.md")?.text).not.toContain("Plan whiteboard");
	});
});
