import { ConfigurableTaskParser } from "../ConfigurableTaskParser";

describe("project-note task membership", () => {
	test("frontmatter project membership reaches subtasks without enabling general inheritance", () => {
		const parser = new ConfigurableTaskParser({
			fileMetadataInheritance: {
				enabled: true,
				inheritFromFrontmatter: true,
				inheritFromFrontmatterForSubtasks: false,
			},
		} as any);
		const tasks = parser.parse(
			"- [ ] Parent\n    - [ ] Child",
			"Projects/Research.md",
			{ project: "Research" },
		);
		expect(tasks).toHaveLength(2);
		expect(tasks[0].metadata.project).toBe("Research");
		expect(tasks[1].metadata.project).toBe("Research");
	});
});
