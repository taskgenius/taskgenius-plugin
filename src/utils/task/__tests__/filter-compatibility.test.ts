import { evaluateFilterNode, parseAdvancedFilterQuery } from "../filter-compatibility";

describe("advanced task filters", () => {
	const task = { content: "Write weekly report", status: " ", completed: false, metadata: { tags: ["#work"], project: "Alpha", priority: 4, dueDate: new Date("2026-11-20T00:00:00").getTime() } };
	const matches = (query: string) => evaluateFilterNode(parseAdvancedFilterQuery(query), task);

	test("supports field filters, boolean precedence, grouping, and negation", () => {
		expect(matches("PROJECT:Alpha AND #work")).toBe(true);
		expect(matches("PROJECT:Beta OR PRIORITY:>=#B")).toBe(true);
		expect(matches("PROJECT:Beta AND PRIORITY:>=#B")).toBe(false);
		expect(matches("NOT PROJECT:Beta")).toBe(true);
		expect(matches("(PROJECT:Beta OR #work) AND TEXT:report")).toBe(true);
	});

	test("supports priority and date comparisons", () => {
		expect(matches("PRIORITY:>=#B")).toBe(true);
		expect(matches("PRIORITY:<#B")).toBe(false);
		expect(matches("DATE:<2026-11-30")).toBe(true);
		expect(matches("DATE:>2026-11-30")).toBe(false);
		expect(matches("DUE:<2026-11-30")).toBe(true);
		expect(evaluateFilterNode(parseAdvancedFilterQuery("STATUS:in-progress"), { ...task, statusName: "in-progress" })).toBe(true);
	});
});
