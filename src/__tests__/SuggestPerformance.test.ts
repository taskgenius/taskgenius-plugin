import { App, Editor, TFile } from "obsidian";
import { SuggestManager, UniversalEditorSuggest } from "../components/ui/suggest";
import TaskProgressBarPlugin from "../index";
import { getSuggestOptionsByTrigger } from "../components/ui/suggest/SpecialCharacterSuggests";

// Mock Obsidian modules
jest.mock("obsidian", () => ({
	App: jest.fn(),
	Editor: jest.fn(),
	TFile: jest.fn(),
	EditorSuggest: class {
		constructor() {}
		getSuggestions() { return []; }
		renderSuggestion() {}
		selectSuggestion() {}
		onTrigger() { return null; }
		close() {}
	},
	setIcon: jest.fn(),
}));

// Mock moment module
jest.mock("moment", () => {
	const moment = function(input?: any) {
		return {
			format: () => "2024-01-01",
			diff: () => 0,
			startOf: () => moment(input),
			endOf: () => moment(input),
			isSame: () => true,
			isSameOrBefore: () => true,
			isSameOrAfter: () => true,
			isBefore: () => false,
			isAfter: () => false,
			isBetween: () => true,
			clone: () => moment(input),
			add: () => moment(input),
			subtract: () => moment(input),
			valueOf: () => Date.now(),
			toDate: () => new Date(),
			weekday: () => 0,
			day: () => 1,
			date: () => 1,
		};
	};
	moment.locale = jest.fn(() => "en");
	moment.utc = () => ({ format: () => "00:00:00" });
	moment.duration = () => ({ asMilliseconds: () => 0 });
	moment.weekdaysShort = () => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	moment.weekdaysMin = () => ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
	return moment;
});

// Mock plugin with realistic data
const mockPlugin = {
	app: {
		workspace: {
			getLastOpenFiles: () => [
				"file1.md",
				"file2.md",
				"file3.md",
				"file4.md",
				"file5.md",
			],
		},
		metadataCache: {
			getTags: () => ({
				"#work": 10,
				"#personal": 8,
				"#urgent": 5,
				"#important": 7,
				"#project": 12,
				"#meeting": 3,
				"#todo": 15,
				"#review": 4,
			}),
		},
	},
	settings: {
		preferMetadataFormat: "tasks",
	},
} as any as TaskProgressBarPlugin;

describe("Suggest Performance Tests", () => {
	let app: App;
	let manager: SuggestManager;

	beforeEach(() => {
		app = new App();
		(app as any).workspace = {
			editorSuggest: {
				suggests: [],
			},
		};
		manager = new SuggestManager(app, mockPlugin);
	});

	afterEach(() => {
		manager.cleanup();
	});

	test("should handle rapid suggest creation and destruction", () => {
		const startTime = performance.now();
		
		manager.startManaging();
		
		// Create and destroy 100 suggests rapidly
		for (let i = 0; i < 100; i++) {
			const suggest = manager.createUniversalSuggest(`test-${i}`);
			suggest.enable();
			manager.removeManagedSuggest(`universal-test-${i}`);
		}
		
		manager.stopManaging();
		
		const endTime = performance.now();
		const duration = endTime - startTime;
		
		// Should complete within reasonable time (adjust threshold as needed)
		expect(duration).toBeLessThan(1000); // 1 second
		expect(manager.getActiveSuggests().size).toBe(0);
	});

	test("should efficiently generate suggestions for all trigger characters", () => {
		const triggerChars = ["!", "~", "*", "#"];
		const iterations = 1000;
		
		const startTime = performance.now();
		
		for (let i = 0; i < iterations; i++) {
			for (const trigger of triggerChars) {
				const suggestions = getSuggestOptionsByTrigger(trigger, mockPlugin);
				expect(suggestions.length).toBeGreaterThan(0);
			}
		}
		
		const endTime = performance.now();
		const duration = endTime - startTime;
		
		// Should generate suggestions efficiently
		// 500ms for 4000 operations; shared CI runners are slower and noisier
		expect(duration).toBeLessThan(process.env.CI ? 1000 : 500);
		
		console.log(`Generated ${iterations * triggerChars.length} suggestions in ${duration}ms`);
	});

	test("should handle large number of active suggests", () => {
		manager.startManaging();
		
		const startTime = performance.now();
		
		// Create 50 active suggests
		const suggests: UniversalEditorSuggest[] = [];
		for (let i = 0; i < 50; i++) {
			const suggest = manager.createUniversalSuggest(`bulk-test-${i}`);
			suggest.enable();
			suggests.push(suggest);
		}
		
		expect(manager.getActiveSuggests().size).toBe(50);
		
		// Cleanup all at once
		manager.removeAllManagedSuggests();
		
		const endTime = performance.now();
		const duration = endTime - startTime;
		
		expect(duration).toBeLessThan(100); // Should be very fast
		expect(manager.getActiveSuggests().size).toBe(0);
		
		console.log(`Managed 50 suggests in ${duration}ms`);
	});

	test("should efficiently handle context filtering", () => {
		const mockEditor = {} as Editor;
		const mockFile = {} as TFile;
		
		// Create context filters
		const filters = [];
		for (let i = 0; i < 100; i++) {
			const filter = (editor: Editor, file: TFile) => {
				// Simulate some filtering logic
				return editor === mockEditor && file === mockFile;
			};
			manager.addContextFilter(`filter-${i}`, filter);
			filters.push(filter);
		}
		
		const startTime = performance.now();
		
		// Test context filtering performance
		for (let i = 0; i < 1000; i++) {
			const suggest = manager.createUniversalSuggest(`context-test-${i % 10}`, {
				contextFilter: filters[i % filters.length],
			});
			// Simulate context check
			const config = suggest.getConfig();
			if (config.contextFilter) {
				config.contextFilter(mockEditor, mockFile);
			}
		}
		
		const endTime = performance.now();
		const duration = endTime - startTime;
		
		expect(duration).toBeLessThan(200); // Should be reasonably fast
		
		console.log(`Context filtering test completed in ${duration}ms`);
		
		// Cleanup
		for (let i = 0; i < 100; i++) {
			manager.removeContextFilter(`filter-${i}`);
		}
	});

	test("should handle memory efficiently during suggest lifecycle", () => {
		const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
		
		manager.startManaging();
		
		// Create and destroy suggests in cycles
		for (let cycle = 0; cycle < 10; cycle++) {
			// Create 20 suggests
			for (let i = 0; i < 20; i++) {
				const suggest = manager.createUniversalSuggest(`memory-test-${cycle}-${i}`);
				suggest.enable();
			}
			
			// Remove all suggests
			manager.removeAllManagedSuggests();
		}
		
		manager.stopManaging();
		
		// Force garbage collection if available
		if (global.gc) {
			global.gc();
		}
		
		const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
		const memoryDiff = finalMemory - initialMemory;
		
		// Memory usage should not grow significantly
		// This is a rough check - actual values depend on environment
		if (initialMemory > 0) {
			expect(memoryDiff).toBeLessThan(1024 * 1024); // Less than 1MB growth
			console.log(`Memory difference: ${memoryDiff} bytes`);
		}
	});

	test("should maintain performance with workspace suggest array manipulation", () => {
		const mockSuggests = Array.from({ length: 100 }, (_, i) => ({ id: `mock-${i}` }));
		(app as any).workspace.editorSuggest.suggests = [...mockSuggests];
		
		manager.startManaging();
		
		const startTime = performance.now();
		
		// Add suggests to beginning of array (high priority)
		for (let i = 0; i < 50; i++) {
			const suggest = manager.createUniversalSuggest(`priority-test-${i}`);
			suggest.enable();
		}
		
		// Verify they were added to the beginning
		const workspaceSuggests = (app as any).workspace.editorSuggest.suggests;
		expect(workspaceSuggests.length).toBe(150); // 100 original + 50 new
		
		// Remove all managed suggests
		manager.removeAllManagedSuggests();
		
		const endTime = performance.now();
		const duration = endTime - startTime;
		
		// Should handle array manipulation efficiently
		expect(duration).toBeLessThan(50);
		expect(workspaceSuggests.length).toBe(100); // Back to original
		
		console.log(`Array manipulation completed in ${duration}ms`);
	});
});
