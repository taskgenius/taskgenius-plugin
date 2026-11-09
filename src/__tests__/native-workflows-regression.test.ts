import { App } from "obsidian";
import { stampStatusTransitions } from "@/services/markdown-status-sync";
import { projectDateChange } from "@/managers/project-dates";
import { dependencyWouldCycle, TaskDependencyPicker } from "@/components/features/task/edit/TaskDependencyPicker";
import { defaultSavedFilters, savedTaskFilters } from "@/utils/task/saved-task-filters";
import { FluentDataManager } from "@/components/features/fluent/managers/FluentDataManager";
import { Task } from "@/types/task";

const task = (id: string, status = " ", metadata: Record<string, unknown> = {}) => ({ id, content: id, status, completed: status === "x", filePath: "Inbox.md", line: 0, metadata } as Task);
describe("ordinary note status dates", () => {
	const stamp = (before: string, after: string, format: "tasks" | "dataview" = "tasks") => stampStatusTransitions(before, after, "x|X", format, "2026-11-08");
	test("stamps a checked task in Tasks syntax", () => expect(stamp("- [ ] Exercise", "- [x] Exercise")).toBe("- [x] Exercise ✅ 2026-11-08"));
	test("handles multiple changes and numbered tasks", () => expect(stamp("1. [ ] One\n- [/] Two", "1. [X] One\n- [x] Two")).toBe("1. [X] One ✅ 2026-11-08\n- [x] Two ✅ 2026-11-08"));
	test("supports inline properties without duplicate dates", () => {
		expect(stamp("- [ ] Exercise", "- [x] Exercise", "dataview")).toBe("- [x] Exercise [completion:: 2026-11-08]");
		expect(stamp("- [ ] Exercise", "- [x] Exercise ✅ 2025-01-01")).toBe("- [x] Exercise ✅ 2025-01-01");
	});
	test("reopening removes the completion date and preserves other dates", () => expect(stamp("- [x] Exercise 📅 2026-12-01 ✅ 2026-11-07", "- [ ] Exercise 📅 2026-12-01 ✅ 2026-11-07")).toBe("- [ ] Exercise 📅 2026-12-01"));
	test("does not stamp old tasks, imported checked tasks, or text-only changes", () => {
		expect(stamp("- [x] Old", "- [x] Old\n- [x] Imported")).toBe("- [x] Old\n- [x] Imported");
		expect(stamp("- [x] Old", "- [x] Edited")).toBe("- [x] Edited");
	});
	test("does not alter example checkboxes in fenced code or frontmatter", () => {
		const before = "---\nexample: - [ ] Example\n---\n```md\n- [ ] Example\n```\n- [ ] Real";
		const after = before.replace(/\[ \]/g, "[x]");
		expect(stamp(before, after)).toBe(after + " ✅ 2026-11-08");
	});
	test("does not guess which duplicate task changed", () => expect(stamp("- [ ] Same\n- [ ] Same", "- [x] Same\n- [ ] Same")).toBe("- [x] Same\n- [ ] Same"));
});

describe("project Gantt dates", () => {
	const start = new Date(2026, 10, 8).getTime(), end = new Date(2026, 10, 10).getTime();
	test("dragging preserves duration across a month boundary", () => expect(projectDateChange(start, end, 24, "move")).toEqual({ startDate: "2026-12-02", dueDate: "2026-12-04" }));
	test("start and end handles change only the selected edge", () => {
		expect(projectDateChange(start, end, -2, "start")).toEqual({ startDate: "2026-11-06", dueDate: "2026-11-10" });
		expect(projectDateChange(start, end, 3, "end")).toEqual({ startDate: "2026-11-08", dueDate: "2026-11-13" });
	});
	test("resizing cannot invert the date range", () => expect(projectDateChange(start, end, 10, "start")).toEqual({ startDate: "2026-11-10", dueDate: "2026-11-10" }));
});

describe("saved filters through the real task filtering pipeline", () => {
	const rows = [task("todo"), task("complete", "x"), task("abandoned", "-"), task("active", "/")];
	function apply(id: string, items = rows) {
		const app = new App() as any; app.vault.getMarkdownFiles = () => [];
		const plugin = { app, settings: { taskStatuses: { completed: "x|X", inProgress: "/", abandoned: "-", planned: "?", notStarted: " " },
			viewConfiguration: [{ id: "table", name: "Table", hideCompletedAndAbandonedTasks: true, filterRules: {} }], globalFilterRules: { advancedFilter: { rootCondition: "all", filterGroups: [{ id: "old-global", groupCondition: "all", filters: [{ id: "impossible", property: "content", condition: "contains", value: "never matches any task" }] }] } } } } as any;
		const preset = defaultSavedFilters().find(preset => preset.id === id)!;
		const manager = new FluentDataManager(plugin, () => "table", () => ({ activeTaskPreset: preset.options, liveFilterState: null, currentFilterState: null, viewStateFilters: {}, selectedProject: undefined, searchQuery: "", filterInputValue: "" }), () => false);
		return manager.applyFilters(items).map(task => task.id);
	}
	test("completed and abandoned presets override the view's hide-completed flag", () => {
		expect(apply("builtin-completed")).toEqual(["complete"]);
		expect(apply("builtin-abandoned")).toEqual(["abandoned"]);
		expect(apply("builtin-todo").sort()).toEqual(["active", "todo"]);
	});
	test("this month includes a start date even when there is a due date next month", () => {
		const now = new Date();
		expect(apply("builtin-month", [task("this-month", " ", { startDate: new Date(now.getFullYear(), now.getMonth(), 3).getTime(), dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 3).getTime() }), task("undated")])).toEqual(["this-month"]);
	});
	test("editing a built-in preset replaces its saved definition", () => { const replacement = { ...defaultSavedFilters()[0], name: "My queue" }; expect(savedTaskFilters([replacement]).filter(item => item.id === replacement.id)).toEqual([replacement]); });
});

test("dependency selection rejects self-dependencies and indirect cycles", () => {
	const a = task("a", " ", { id: "stable-a" }), b = task("b", " ", { id: "stable-b", dependsOn: ["stable-a"] }), c = task("c", " ", { dependsOn: ["stable-b"] });
	expect(dependencyWouldCycle([a, b, c], a, a)).toBe(true);
	expect(dependencyWouldCycle([a, b, c], a, c)).toBe(true);
	expect(dependencyWouldCycle([a, b, c], c, a)).toBe(false);
});

test("choosing a dependency creates a persistent task ID before saving the reference", async () => {
	const source = task("source"), target = task("target"), selected: string[] = [];
	const plugin = { writeAPI: { updateTask: jest.fn(async () => ({ success: true })) } } as any;
	const picker = new TaskDependencyPicker(new App(), plugin, source, [source, target], id => selected.push(id));
	await picker.onChooseItem(target);
	expect(selected[0]).toMatch(/^tg-/);
	expect(plugin.writeAPI.updateTask).toHaveBeenCalledWith({ taskId: "target", updates: { metadata: { id: selected[0] } } });
	expect(source.metadata.dependsOn).toBeUndefined();
	await picker.onChooseItem(target);
	expect(selected[1]).toBe(selected[0]);
	expect(plugin.writeAPI.updateTask).toHaveBeenCalledTimes(1);
});

test("a failed dependency ID write does not save a broken reference", async () => {
	const selected = jest.fn(), source = task("source"), target = task("target");
	const picker = new TaskDependencyPicker(new App(), { writeAPI: { updateTask: jest.fn(async () => ({ success: false, error: "Could not write" })) } } as any, source, [source, target], selected);
	await picker.onChooseItem(target); expect(selected).not.toHaveBeenCalled();
});
