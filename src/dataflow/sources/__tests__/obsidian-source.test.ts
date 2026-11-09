import { App, TFile } from "obsidian";
import { ObsidianSource } from "../ObsidianSource";
import { Events } from "../../events/Events";

describe("Obsidian Tasks interoperability", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	test("ordinary Markdown task edits enter the Task Genius reindex pipeline", () => {
		const app = new App() as any;
		const file = Object.assign(new TFile(), { path: "Daily.md", extension: "md" });
		const vaultEvents: Record<string, Function> = {};
		const vault = {
			on: jest.fn((event: string, handler: Function) => { vaultEvents[event] = handler; return { unload: jest.fn() }; }),
		};
		const metadataCache = { on: jest.fn(() => ({ unload: jest.fn() })) };
		const events: Array<[string, any]> = [];
		app.workspace.on = jest.fn(() => ({ unload: jest.fn() }));
		app.workspace.trigger = (name: string, payload: any) => events.push([name, payload]);
		const source = new ObsidianSource(app, vault as any, metadataCache as any);
		source.initialize();

		vaultEvents.modify(file);
		jest.advanceTimersByTime(301);

		expect(events).toContainEqual([Events.FILE_UPDATED, expect.objectContaining({ path: "Daily.md", reason: "modify" })]);
		expect(vault.on).toHaveBeenCalledWith("modify", expect.any(Function));
	});
});
