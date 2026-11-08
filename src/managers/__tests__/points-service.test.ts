jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	getFrontMatterInfo: (text: string) => ({ exists: true, frontmatter: text.split("---\n")[1] }),
	parseYaml: (text: string) => JSON.parse(text),
	normalizePath: (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, ""),
}));
import { TFile } from "obsidian";
import { PointsService } from "../points-service";

function harness() {
	const pointsPath = "99_System/01_Data/积分系统数据.md";
	const entries = new Map<string, { file: TFile; data: any }>();
	const add = (path: string, data: any) => entries.set(path, { file: Object.assign(new TFile(), { path, basename: path.split("/").pop()!.replace(/\.md$/, "") }), data });
	add(pointsPath, { manualPointRecords: [{ id: "old", date: "2026-11-01", text: "Original", points: 10 }], examplePropertyLeft: ["Book + 50"], examplePropertyRight: ["Trip - 5000"], custom: "keep" });
	add("Habits/Exercise.md", { habit: true, type: "binary", bravoPoints: 0.5, records: { "2026-11-01": 1 } });
	const app: any = { vault: {
		getAbstractFileByPath: (path: string) => entries.get(path)?.file,
		getMarkdownFiles: () => [...entries.values()].map(entry => entry.file),
		read: async (file: TFile) => `---\n${JSON.stringify(entries.get(file.path)!.data)}---\nBody`,
	}, fileManager: { processFrontMatter: jest.fn(async (file: TFile, update: (data: any) => void) => update(entries.get(file.path)!.data)) }, workspace: { trigger: jest.fn() } };
	const plugin: any = { app, settings: { rewards: { rewardItems: [], pointsLedger: [] } }, saveSettings: jest.fn(async () => {}) };
	return { app, plugin, service: new PointsService(app, plugin), entries, pointsPath };
}

test("the native page reads the original records and lists, including habit-derived points", async () => {
	const { service } = harness();
	const snapshot = await service.snapshot();
	expect(snapshot.balance).toBe(10.5);
	expect(snapshot.manual).toHaveLength(1);
	expect(snapshot.bonuses[0].text).toBe("Book + 50");
	expect(snapshot.wishes[0].text).toBe("Trip - 5000");
});

test("new manual records preserve the original records, lists and unrelated properties", async () => {
	const { service, entries, pointsPath } = harness();
	await service.addRecord("New", -2, "2026-11-02");
	const data = entries.get(pointsPath)!.data;
	expect(data.manualPointRecords[0].id).toBe("old");
	expect(data.manualPointRecords).toHaveLength(2);
	expect(data.custom).toBe("keep");
	expect(data.examplePropertyLeft).toEqual(["Book + 50"]);
	expect(data.examplePropertyRight).toEqual(["Trip - 5000"]);
});

test("concurrent redemptions recheck the balance and cannot spend it twice", async () => {
	const { service } = harness();
	const outcomes = await Promise.allSettled([service.redeem("Reward", 8), service.redeem("Reward", 8)]);
	expect(outcomes.map(item => item.status)).toEqual(["fulfilled", "rejected"]);
	expect((await service.snapshot()).balance).toBe(2.5);
});

test("editing a habit's point rule never overwrites its check-in history", async () => {
	const { service, entries } = harness();
	await service.saveHabitRate("Habits/Exercise.md", 2);
	expect(entries.get("Habits/Exercise.md")!.data.records).toEqual({ "2026-11-01": 1 });
	expect((await service.snapshot()).balance).toBe(12);
});

test("a failed inventory save cannot charge the Markdown ledger", async () => {
	const { service, plugin } = harness();
	plugin.settings.rewards.rewardItems = [{ id: "stock", inventory: 1, pointCost: 2 }];
	plugin.saveSettings.mockRejectedValueOnce(new Error("save failed"));
	await expect(service.redeem("Stock", 2, "stock")).rejects.toThrow("save failed");
	expect((await service.snapshot()).manual).toHaveLength(1);
	expect(plugin.settings.rewards.rewardItems[0].inventory).toBe(1);
});

test("a failed ledger write restores a finite reward's inventory", async () => {
	const { service, plugin, app } = harness();
	plugin.settings.rewards.rewardItems = [{ id: "stock", inventory: 1, pointCost: 2 }];
	app.fileManager.processFrontMatter.mockRejectedValueOnce(new Error("ledger failed"));
	await expect(service.redeem("Stock", 2, "stock")).rejects.toThrow("ledger failed");
	expect(plugin.settings.rewards.rewardItems[0].inventory).toBe(1);
	expect((await service.snapshot()).manual).toHaveLength(1);
});
