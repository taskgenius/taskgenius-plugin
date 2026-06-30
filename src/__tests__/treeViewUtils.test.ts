import { Task } from "../types/task";
import { isValidTreeParent, tasksToTree } from "../utils/ui/tree-view-utils";

function createTask(
	id: string,
	content: string,
	line: number,
	heading: string[] = [],
	parent?: string,
	filePath = "test.md",
): Task {
	return {
		id,
		content,
		filePath,
		line,
		completed: false,
		status: " ",
		originalMarkdown: `- [ ] ${content}`,
		metadata: {
			tags: [],
			children: [],
			heading,
			parent,
		},
	};
}

describe("tree view hierarchy guards", () => {
	it("rejects parent links that cross headings", () => {
		const parent = createTask("parent", "Parent", 4, ["Tasks"]);
		const child = createTask(
			"child",
			"Child",
			10,
			["New section"],
			parent.id,
		);

		expect(isValidTreeParent(child, parent)).toBe(false);
	});

	it("keeps valid parent links in the same heading", () => {
		const parent = createTask("parent", "Parent", 4, ["Tasks"]);
		const child = createTask("child", "Child", 5, ["Tasks"], parent.id);

		expect(isValidTreeParent(child, parent)).toBe(true);
	});

	it("treats invalid parent links as roots when building a tree", () => {
		const parent = createTask("parent", "This other task", 4, ["Tasks"]);
		const independent = createTask(
			"independent",
			'This task should be not chilren of "This other task"',
			10,
			["New section"],
			parent.id,
		);

		const roots = tasksToTree([parent, independent]);

		expect(roots.map((task) => task.id)).toEqual(["parent", "independent"]);
	});
});
