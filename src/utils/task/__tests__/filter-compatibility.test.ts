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
	test("relative dates match the full local day and missing-date filters remain useful", () => {
		const now = new Date(), noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();
		const dated = { ...task, metadata: { ...task.metadata, dueDate: noon } };
		expect(evaluateFilterNode(parseAdvancedFilterQuery("due:today"), dated)).toBe(true);
		expect(evaluateFilterNode(parseAdvancedFilterQuery("due:>today"), dated)).toBe(false);
		expect(evaluateFilterNode(parseAdvancedFilterQuery("due:<=today"), dated)).toBe(true);
		expect(evaluateFilterNode(parseAdvancedFilterQuery("due:none"), { metadata: {} })).toBe(true);
		expect(evaluateFilterNode(parseAdvancedFilterQuery("status:completed"), { completed: true, metadata: {} })).toBe(true);
	});
	test("any-date emptiness means all date fields are empty", () => {
		const match = (query: string, metadata: any) => evaluateFilterNode(parseAdvancedFilterQuery(query), { metadata });
		expect(match("date:none", {})).toBe(true);
		expect(match("date:none", { dueDate: Date.now() })).toBe(false);
		expect(match("date:!=none", { startDate: Date.now() })).toBe(true);
	});
	test("tag equality checks membership and ignores the leading hash", () => {
		expect(matches("tag:=work")).toBe(true);
		expect(matches("tag:=#work")).toBe(true);
		expect(matches("tag:!=work")).toBe(false);
		expect(evaluateFilterNode(parseAdvancedFilterQuery("tag:=work"), { metadata: { tags: ["personal", "work"] } })).toBe(true);
	});
	test("dropdown-generated project queries support numeric names and escaped quotes", () => {
		for (const name of ["123", 'Writing "weekly" reports', "A (new) project"]) {
			expect(evaluateFilterNode(parseAdvancedFilterQuery(`project:=${JSON.stringify(name)}`), { metadata: { project: name } })).toBe(true);
		}
	});
});
