import { App } from "obsidian";
import { buildVisibleTaskTree, flattenTaskTree } from "@/utils/ui/tree-view-utils";
import { isProjectCalendarEntry } from "@/utils/task/project-calendar";
import { isDependencyTask, TaskDependencyPicker } from "@/components/features/task/edit/TaskDependencyPicker";
import { ConfigurableTaskParser } from "@/dataflow/core/ConfigurableTaskParser";
import { Augmentor } from "@/dataflow/augment/Augmentor";

const task = (id: string, metadata: any = {}) => ({ id, content: `Task ${id}`, originalMarkdown: `- [ ] Task ${id}`, filePath: "Projects/Alpha.md", line: 1, status: " ", completed: false, metadata } as any);

test("search matches remain roots when their parents are filtered out or children metadata is absent", () => {
	const child = task("child", { parent: "hidden-parent" });
	const tree = buildVisibleTaskTree([child]);
	expect(tree.roots.map(item => item.id)).toEqual(["child"]);
	expect(child.metadata).toEqual({ parent: "hidden-parent" });
	expect(tree.taskMap.get("child")?.metadata.children).toEqual([]);
});

test("cyclic and self-parented tasks cannot create an empty search result or infinite recursion", () => {
	const items = [task("a", { parent: "b" }), task("b", { parent: "a" }), task("self", { parent: "self" })];
	const tree = buildVisibleTaskTree(items);
	expect(tree.roots.length).toBeGreaterThan(0);
	expect(flattenTaskTree(tree.roots, tree.taskMap).map(item => item.id).sort()).toEqual(["a", "b", "self"]);
});

test("a matching parent does not pull nonmatching children back into the displayed tree", () => {
	const parent = task("parent", { children: ["hidden"] });
	const tree = buildVisibleTaskTree([parent]);
	expect(tree.roots[0].metadata.children).toEqual([]);
	expect(parent.metadata.children).toEqual(["hidden"]);
});

test("task dependencies offer existing tasks rather than whole-note tasks or project rows", () => {
	const checkbox = task("checkbox"), source = task("source"), file = task("file-source:Projects/Alpha.md", { source: "file-source" });
	expect(isDependencyTask(file)).toBe(false);
	expect(isDependencyTask({ ...task("old-file"), isFileTask: true })).toBe(false);
	expect(isDependencyTask(task("plan", { projectPlan: true }))).toBe(false);
	const picker = new TaskDependencyPicker(new App(), {} as any, source, [source, checkbox, file], () => {});
	expect(picker.getItems()).toEqual([checkbox]);
	expect(picker.getItemText(checkbox)).toBe("Task checkbox");
});

test("project notes are excluded from calendar events while their checkbox tasks remain", () => {
	const app = new App() as any;
	app.vault.getFileByPath = () => ({ path: "Projects/Alpha.md" });
	app.metadataCache.getFileCache = () => ({ frontmatter: { project: "Alpha" } });
	expect(isProjectCalendarEntry(app, task("file-source:Projects/Alpha.md", { source: "file-source" }))).toBe(true);
	expect(isProjectCalendarEntry(app, task("plan", { projectPlan: true }))).toBe(true);
	expect(isProjectCalendarEntry(app, task("checkbox", { project: "Alpha", dueDate: Date.now() }))).toBe(false);
});

test("project date changes do not become task deadlines during parsing or augmentation", async () => {
	const parser = new ConfigurableTaskParser({ fileMetadataInheritance: { enabled: true, inheritFromFrontmatter: true, inheritFromFrontmatterForSubtasks: true } } as any);
	const parse = (dueDate: string) => parser.parse("- [ ] Undated\n- [ ] Own deadline 📅 2026-12-10", "Projects/Alpha.md", { project: "Alpha", startDate: "2026-11-01", dueDate });
	const before = parse("2026-12-01"), after = parse("2027-01-15");
	expect(after[0].metadata.dueDate).toBeUndefined(); expect(after[0].metadata.startDate).toBeUndefined();
	expect(after[1].metadata.dueDate).toBe(before[1].metadata.dueDate); expect(after[1].metadata.dueDate).toBeDefined();
	const augmented = await new Augmentor().merge({ filePath: "Projects/Alpha.md", fileMeta: { project: "Alpha", dueDate: 123, startDate: 100 }, tasks: after as any });
	expect(augmented[0].metadata.dueDate).toBeUndefined();
	expect(augmented[1].metadata.dueDate).toBe(after[1].metadata.dueDate);
});
