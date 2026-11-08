import { removeBlankTasks } from "@/utils/task/removeBlankTasks";
import type { Task } from "@/types/task";

const task = (id: string, content: string, parent?: string, children: string[] = []): Task => ({ id, content, status: " ", completed: false, filePath: "a.md", line: 0, originalMarkdown: "", metadata: { tags: [], children, parent } } as Task);

describe("empty task placeholders", () => {
	it("drops empty and whitespace placeholders without deleting real tasks", () => {
		const tasks = [task("empty", ""), task("spaces", " \t\u200b"), task("real", "Prepare report")];
		expect(removeBlankTasks(tasks).map(t => t.id)).toEqual(["real"]);
	});
	it("promotes children through blank containers and preserves the surrounding hierarchy", () => {
		const tasks = [task("root", "Project", undefined, ["blank"]), task("blank", "", "root", ["child"]), task("child", "Write draft", "blank")];
		const before = JSON.stringify(tasks);
		const result = removeBlankTasks(tasks);
		expect(result[0].metadata.children).toEqual(["child"]);
		expect(result[1].metadata.parent).toBe("root");
		expect(JSON.stringify(tasks)).toBe(before);
	});
	it("promotes a task below a blank root to a root task", () => {
		expect(removeBlankTasks([task("blank", ""), task("child", "Read", "blank")])[0].metadata.parent).toBeUndefined();
	});
	it("terminates malformed cycles in blank parents", () => {
		const result = removeBlankTasks([task("a", "", "b"), task("b", "", "a"), task("child", "Read", "a")]);
		expect(result[0].metadata.parent).toBeUndefined();
	});
	it("retains completed and custom-status tasks that have titles", () => {
		const tasks = [{ ...task("done", "Read"), status: "x", completed: true }, { ...task("pause", "Draft"), status: "=" }];
		expect(removeBlankTasks(tasks)).toBe(tasks);
	});
});
