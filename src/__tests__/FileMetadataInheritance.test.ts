/**
 * File Metadata Inheritance Tests
 * 
 * Tests for the independent file metadata inheritance functionality
 */

import { MarkdownTaskParser } from "../dataflow/core/ConfigurableTaskParser";
import { getConfig } from "../common/task-parser-config";
import { createMockPlugin } from "./mockUtils";
import { DEFAULT_SETTINGS } from "../common/setting-definition";

describe("File Metadata Inheritance", () => {
	let parser: MarkdownTaskParser;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = createMockPlugin({
			...DEFAULT_SETTINGS,
			fileMetadataInheritance: {
				enabled: true,
				inheritFromFrontmatter: true,
				inheritFromFrontmatterForSubtasks: false,
			},
			projectConfig: {
				enableEnhancedProject: false, // Project功能禁用，验证独立性
				pathMappings: [],
				metadataConfig: {
					metadataKey: "project",
					enabled: false,
				},
				configFile: {
					fileName: "project.md",
					searchRecursively: false,
					enabled: false,
				},
				metadataMappings: [],
				defaultProjectNaming: {
					strategy: "filename",
					stripExtension: false,
					enabled: false,
				},
			},
		});

		const config = getConfig("tasks", mockPlugin);
		parser = new MarkdownTaskParser(config);
	});

	describe("Basic Inheritance Functionality", () => {
		test("should inherit metadata when fileMetadataInheritance.enabled is true", () => {
			const content = "- [ ] Task without explicit metadata";
			const fileMetadata = {
				priority: "high",
				context: "office",
				area: "work",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBe(4); // "high" 被转换为数字 4
			expect(tasks[0].metadata.context).toBe("office");
			expect(tasks[0].metadata.area).toBe("work");
		});

		test("should not inherit metadata when fileMetadataInheritance.enabled is false", () => {
			// 禁用文件元数据继承
			mockPlugin.settings.fileMetadataInheritance.enabled = false;
			const config = getConfig("tasks", mockPlugin);
			parser = new MarkdownTaskParser(config);

			const content = "- [ ] Task without explicit metadata";
			const fileMetadata = {
				priority: "high",
				context: "office",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBeUndefined();
			expect(tasks[0].metadata.context).toBeUndefined();
		});

		test("should not inherit metadata when inheritFromFrontmatter is false", () => {
			// 启用继承功能但禁用frontmatter继承
			mockPlugin.settings.fileMetadataInheritance.inheritFromFrontmatter = false;
			const config = getConfig("tasks", mockPlugin);
			parser = new MarkdownTaskParser(config);

			const content = "- [ ] Task without explicit metadata";
			const fileMetadata = {
				priority: "high",
				context: "office",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBeUndefined();
			expect(tasks[0].metadata.context).toBeUndefined();
		});
	});

	describe("Independence from Project Features", () => {
		test("should work when enhanced project features are disabled", () => {
			// 确保项目功能完全禁用
			mockPlugin.settings.projectConfig.enableEnhancedProject = false;
			const config = getConfig("tasks", mockPlugin);
			parser = new MarkdownTaskParser(config);

			const content = "- [ ] Task should inherit metadata";
			const fileMetadata = {
				priority: "medium",
				context: "home",
				tags: ["personal"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBe(3); // "medium" 被转换为数字 3
			expect(tasks[0].metadata.context).toBe("home");
			// tags应该被继承，但不会覆盖非继承字段
		});

		test("should use filename when inherited frontmatter project is true", () => {
			const content = "- [ ] Task without explicit project";
			const fileMetadata = {
				project: true,
			};

			const tasks = parser.parseLegacy(
				content,
				"Projects/My Awesome Project.md",
				fileMetadata
			);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.project).toBe("My Awesome Project");
		});

		test("should work independently of project configuration", () => {
			// 项目配置为null，验证不会崩溃
			mockPlugin.settings.projectConfig = null;
			const config = getConfig("tasks", mockPlugin);
			parser = new MarkdownTaskParser(config);

			const content = "- [ ] Task with inheritance";
			const fileMetadata = {
				priority: "low",
				area: "work", // 使用已知的可继承字段
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBe(2); // "low" 被转换为数字 2
			expect(tasks[0].metadata.area).toBe("work");
		});
	});

	describe("Subtask Inheritance", () => {
		test("should not inherit to subtasks when inheritFromFrontmatterForSubtasks is false", () => {
			const content = `- [ ] Parent task
  - [ ] Child task`;
			const fileMetadata = {
				priority: "urgent",
				context: "meeting",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(2);
			
			// 父任务应该继承
			expect(tasks[0].metadata.priority).toBe(5); // "urgent" 被转换为数字 5
			expect(tasks[0].metadata.context).toBe("meeting");
			
			// 子任务不应该继承（默认配置）
			expect(tasks[1].metadata.priority).toBeUndefined();
			expect(tasks[1].metadata.context).toBeUndefined();
		});

		test("should inherit to subtasks when inheritFromFrontmatterForSubtasks is true", () => {
			// 启用子任务继承
			mockPlugin.settings.fileMetadataInheritance.inheritFromFrontmatterForSubtasks = true;
			const config = getConfig("tasks", mockPlugin);
			parser = new MarkdownTaskParser(config);

			const content = `- [ ] Parent task
  - [ ] Child task
    - [ ] Grandchild task`;
			const fileMetadata = {
				priority: "urgent",
				context: "meeting",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(3);
			
			// 所有任务都应该继承
			tasks.forEach(task => {
				expect(task.metadata.priority).toBe(5); // "urgent" 被转换为数字 5
				expect(task.metadata.context).toBe("meeting");
			});
		});
	});

	describe("Priority Override", () => {
		test("should prioritize explicit task metadata over inherited metadata", () => {
			const content = "- [ ] Task with explicit priority @home 🔼";
			const fileMetadata = {
				priority: "low",
				context: "office",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			// 任务的显式context应该覆盖文件中的context
			expect(tasks[0].metadata.context).toBe("home");
			// 任务的显式priority应该覆盖文件中的priority
			expect(tasks[0].metadata.priority).toBeDefined();
			// 但不应该是文件中的"low"
			expect(tasks[0].metadata.priority).not.toBe("low");
		});

		test("should inherit only fields not explicitly set on task", () => {
			const content = "- [ ] Task with partial metadata @home";
			const fileMetadata = {
				priority: "high",
				context: "office",
				area: "work",
				project: "myproject", // 使用已知的可继承字段
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			// 任务显式设置的context应该优先
			expect(tasks[0].metadata.context).toBe("home");
			// 其他字段应该被继承
			expect(tasks[0].metadata.priority).toBe(4); // "high" 被转换为数字 4
			expect(tasks[0].metadata.area).toBe("work");
			expect(tasks[0].metadata.project).toBe("myproject");
		});
	});

	describe("Non-inheritable Fields", () => {
		test("should not inherit task-specific fields", () => {
			const content = "- [ ] Test task";
			const fileMetadata = {
				id: "should-not-inherit",
				content: "should-not-inherit",
				status: "should-not-inherit",
				completed: true,
				line: 999,
				lineNumber: 999,
				filePath: "should-not-inherit",
				heading: "should-not-inherit",
				priority: "high", // 这个应该被继承
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			
			// 任务特定字段不应该被继承
			expect(tasks[0].metadata.id).not.toBe("should-not-inherit");
			expect(tasks[0].content).toBe("Test task");
			expect(tasks[0].completed).toBe(false);
			expect(tasks[0].filePath).toBe("test.md");
			
			// 可继承字段应该被继承
			expect(tasks[0].metadata.priority).toBe(4); // "high" 被转换为数字 4
		});
	});

	describe("Complex Scenarios", () => {
		test("should handle mixed inheritance with multiple tasks", () => {
			const content = `- [ ] Task 1 with context @work
- [ ] Task 2 without metadata
- [ ] Task 3 with priority 🔺`;
			const fileMetadata = {
				priority: "medium",
				context: "home",
				area: "personal",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(3);
			
			// Task 1: 显式context，继承priority和area
			expect(tasks[0].metadata.context).toBe("work");
			expect(tasks[0].metadata.priority).toBe(3); // "medium" 被转换为数字 3
			expect(tasks[0].metadata.area).toBe("personal");
			
			// Task 2: 全部继承
			expect(tasks[1].metadata.context).toBe("home");
			expect(tasks[1].metadata.priority).toBe(3); // "medium" 被转换为数字 3
			expect(tasks[1].metadata.area).toBe("personal");
			
			// Task 3: 显式priority，继承context和area
			expect(tasks[2].metadata.context).toBe("home");
			expect(tasks[2].metadata.area).toBe("personal");
			expect(tasks[2].metadata.priority).toBeDefined();
			expect(tasks[2].metadata.priority).not.toBe("medium");
		});

		test("should handle empty file metadata gracefully", () => {
			const content = "- [ ] Task with no file metadata";
			const fileMetadata = {};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].content).toBe("Task with no file metadata");
			// 没有元数据可继承，应该正常工作
		});

		test("should handle null file metadata gracefully", () => {
			const content = "- [ ] Task with null metadata";

			const tasks = parser.parseLegacy(content, "test.md", undefined);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].content).toBe("Task with null metadata");
			// 不应该崩溃
		});
	});

	describe("Priority Value Conversion", () => {
		test("should convert priority text values to appropriate format", () => {
			const content = "- [ ] Task with text priority";
			const fileMetadata = {
				priority: "high",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBeDefined();
			// 应该经过优先级转换处理
		});

		test("should handle numeric priority values", () => {
			const content = "- [ ] Task with numeric priority";
			const fileMetadata = {
				priority: 4,
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.priority).toBe(4); // 数字 4 保持为数字
		});
	});

	describe("Tags Inheritance", () => {
		test("should inherit tags from file metadata", () => {
			const content = "- [ ] Task without tags";
			const fileMetadata = {
				tags: ["#work", "#urgent", "#meeting"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.tags).toBeDefined();
			expect(tasks[0].metadata.tags).toEqual(["#work", "#urgent", "#meeting"]);
		});

		test("should merge task tags with inherited tags", () => {
			const content = "- [ ] Task with existing tags #personal";
			const fileMetadata = {
				tags: ["#work", "#urgent"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.tags).toBeDefined();
			expect(tasks[0].metadata.tags).toContain("#personal");
			expect(tasks[0].metadata.tags).toContain("#work");
			expect(tasks[0].metadata.tags).toContain("#urgent");
		});

		test("should not duplicate tags when merging", () => {
			const content = "- [ ] Task with duplicate tag #work";
			const fileMetadata = {
				tags: ["#work", "#urgent"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.tags).toBeDefined();
			// Should only have one instance of #work
			const workTags = tasks[0].metadata.tags.filter((tag: string) => tag === "#work");
			expect(workTags).toHaveLength(1);
			expect(tasks[0].metadata.tags).toContain("#urgent");
		});

		test("should parse special tag formats from file metadata", () => {
			const content = "- [ ] Task inheriting project tag";
			const fileMetadata = {
				tags: ["#project/myproject", "#area/work", "#@/office"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.project).toBe("myproject");
			expect(tasks[0].metadata.area).toBe("work");
			expect(tasks[0].metadata.context).toBe("office");
			expect(tasks[0].metadata.tags).toContain("#project/myproject");
			expect(tasks[0].metadata.tags).toContain("#area/work");
			expect(tasks[0].metadata.tags).toContain("#@/office");
		});

		test("should prioritize task metadata over tag-derived metadata", () => {
			const content = "- [ ] Task with explicit project [project::taskproject]";
			const fileMetadata = {
				tags: ["#project/fileproject"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			// Task's explicit project should take precedence
			expect(tasks[0].metadata.project).toBe("taskproject");
			expect(tasks[0].metadata.tags).toContain("#project/fileproject");
		});

		test("should handle mixed tag formats in file metadata", () => {
			const content = "- [ ] Task with mixed tag inheritance";
			const fileMetadata = {
				tags: ["#regular-tag", "#project/myproject", "#normalTag", "#area/work"],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.project).toBe("myproject");
			expect(tasks[0].metadata.area).toBe("work");
			expect(tasks[0].metadata.tags).toContain("#regular-tag");
			expect(tasks[0].metadata.tags).toContain("#normalTag");
			expect(tasks[0].metadata.tags).toContain("#project/myproject");
			expect(tasks[0].metadata.tags).toContain("#area/work");
		});

		test("should handle empty tags array in file metadata", () => {
			const content = "- [ ] Task with empty tags";
			const fileMetadata = {
				tags: [],
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].metadata.tags).toEqual([]);
		});

		test("should handle non-array tags in file metadata", () => {
			const content = "- [ ] Task with non-array tags";
			const fileMetadata = {
				tags: "single-tag",
			};

			const tasks = parser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(1);
			// Should inherit as a single tag with # prefix
			expect(tasks[0].metadata.tags).toContain("#single-tag");
		});
	});

	describe("Configuration Migration", () => {
		test("should work with migrated settings", () => {
			// 模拟迁移后的设置结构
			const migratedPlugin = createMockPlugin({
				...DEFAULT_SETTINGS,
				fileMetadataInheritance: {
					enabled: true,
					inheritFromFrontmatter: true,
					inheritFromFrontmatterForSubtasks: true,
				},
				// 旧的项目配置中没有继承设置
				projectConfig: {
					enableEnhancedProject: false,
					pathMappings: [],
					metadataConfig: {
						metadataKey: "project",
						enabled: false,
					},
					configFile: {
						fileName: "project.md",
						searchRecursively: false,
						enabled: false,
					},
					metadataMappings: [],
					defaultProjectNaming: {
						strategy: "filename",
						stripExtension: false,
						enabled: false,
					},
				},
			});

			const config = getConfig("tasks", migratedPlugin);
			const migratedParser = new MarkdownTaskParser(config);

			const content = `- [ ] Parent task
  - [ ] Child task`;
			const fileMetadata = {
				priority: "migrated",
				context: "test",
			};

			const tasks = migratedParser.parseLegacy(content, "test.md", fileMetadata);

			expect(tasks).toHaveLength(2);
			
			// 父任务和子任务都应该继承（因为迁移后启用了子任务继承）
			tasks.forEach(task => {
				expect(task.metadata.priority).toBe("migrated"); // 字符串值保持为字符串
				expect(task.metadata.context).toBe("test");
			});
		});
	});
});
