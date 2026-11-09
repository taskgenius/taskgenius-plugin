import { pointLedgerDate } from "./points-utils";
import { dailyTaskPoints } from "./daily-task-points";
import { App, getFrontMatterInfo, normalizePath, parseYaml, TFile } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import { calculateDailyHabitPoints, localPointDate, pointDate, pointListItems, pointNumber, roundPoints } from "./daily-points";
import { t } from "@/translations/helper";

export interface ManualPointRecord {
	id: string; date: string; text: string; points: number; source: string; createdAt: string;
	[key: string]: unknown;
}
const services = new WeakMap<TaskProgressBarPlugin, PointsService>();
export function pointsService(plugin: TaskProgressBarPlugin): PointsService {
	let service = services.get(plugin);
	if (!service) { service = new PointsService(plugin.app, plugin); services.set(plugin, service); }
	return service;
}

export class PointsService {
	private writes: Promise<unknown> = Promise.resolve();
	constructor(private app: App, private plugin: TaskProgressBarPlugin) {}
	get dataPath(): string {
		const configured = this.plugin.settings.rewards.pointsDataFile?.trim();
		if (configured) {
			if (/^(?:[a-zA-Z]:|[\\/])/.test(configured) || configured.split(/[\\/]/).includes("..")) throw new Error(t("Choose a Markdown file inside the vault."));
			return normalizePath(configured);
		}
		const legacy = "99_System/01_Data/积分系统数据.md";
		return this.app.vault.getAbstractFileByPath(legacy) ? legacy : "Task Genius/Points.md";
	}
	private async read(file: TFile): Promise<Record<string, any>> {
		const text = await this.app.vault.read(file);
		const info = getFrontMatterInfo(text);
		const data = info.exists ? parseYaml(info.frontmatter) : {};
		return data && typeof data === "object" ? data : {};
	}
	async snapshot() {
		const file = this.app.vault.getAbstractFileByPath(this.dataPath);
		const data = file instanceof TFile ? await this.read(file) : {};
		const config = this.plugin.habitsIntegration?.settings || this.plugin.settings.habitsIntegration;
		const folder = normalizePath(config?.habitsFolder || "Habits");
		const keys = { type: "type", records: "records", target: "target", frequency: "frequency", ...config?.frontmatterKeys };
		const habits = await Promise.all(this.app.vault.getMarkdownFiles().filter(note => note.path.startsWith(`${folder}/`)).map(async note => ({ name: note.basename, path: note.path, frontmatter: await this.read(note) })));
		const defined = habits.filter(habit => habit.frontmatter.habit || ["binary", "repetition", "timed", "note"].includes(habit.frontmatter[keys.type]));
		const today = localPointDate();
		const summaries = calculateDailyHabitPoints(defined, data, today, keys);
		const manual: ManualPointRecord[] = (Array.isArray(data.manualPointRecords) ? data.manualPointRecords : []).map((record: any, index: number) => ({ ...record, id: String(record.id ?? `legacy-${index}`), date: pointDate(record.date), text: String(record.text ?? ""), points: pointNumber(record.points), source: String(record.source || "manual"), createdAt: String(record.createdAt || "") }));
		const ledger = this.plugin.settings.rewards.pointsLedger || [];
		const tasks = this.plugin.dataflowOrchestrator ? await this.plugin.dataflowOrchestrator.getQueryAPI().getAllTasks() : [];
		const automaticTasks = dailyTaskPoints(tasks, defined, data, ledger, keys, Number(this.plugin.settings.rewards.pointsPerTask ?? 0));
		const extra = automaticTasks.days.reduce((sum, item) => sum + item.supplement, 0);
		const todayExtra = automaticTasks.days.find(item => item.date === today)?.supplement || 0;
		const balance = roundPoints(extra + summaries.reduce((sum, item) => sum + item.points, 0) + manual.reduce((sum, item) => sum + item.points, 0) + ledger.reduce((sum, entry) => sum + entry.delta, 0));
		const todayPoints = roundPoints(todayExtra + summaries.reduce((sum, item) => sum + item.todayPoints, 0) + manual.filter(item => item.date === today).reduce((sum, item) => sum + item.points, 0) + ledger.filter(entry => pointLedgerDate(entry) === today).reduce((sum, entry) => sum + entry.delta, 0));
		return { automaticTasks, data, file, path: this.dataPath, summaries, manual, ledger, balance, todayPoints,
			bonuses: pointListItems(data.examplePropertyLeft), wishes: pointListItems(data.examplePropertyRight),
			habitCount: defined.length, recordCount: defined.reduce((sum, item) => sum + Object.keys(item.frontmatter[keys.records] || {}).length, 0) };
	}
	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const next = this.writes.catch(() => undefined).then(operation);
		this.writes = next;
		return next;
	}
	private async ensureFile(): Promise<TFile> {
		const path = this.dataPath;
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;
		if (existing) throw new Error(t("The points data path is occupied by a folder."));
		const parts = path.split("/"); parts.pop();
		for (let index = 1; index <= parts.length; index++) {
			const folder = parts.slice(0, index).join("/");
			if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
		}
		return this.app.vault.create(path, "---\nmanualPointRecords: []\nexamplePropertyLeft: []\nexamplePropertyRight: []\n---\n");
	}
	private async update(change: (data: Record<string, any>) => void) {
		const file = await this.ensureFile();
		await this.app.fileManager.processFrontMatter(file, change);
		this.app.workspace.trigger("task-genius:points-updated");
	}
	addRecord(text: string, points: number, date = localPointDate(), source = "manual") {
		return this.enqueue(async () => {
			if (!text.trim() || !Number.isFinite(points) || points === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(t("Enter a description, a valid date, and a non-zero amount."));
			await this.update(data => {
				if (!Array.isArray(data.manualPointRecords)) data.manualPointRecords = [];
				data.manualPointRecords.push({ id: `points-${Date.now()}-${Math.random().toString(36).slice(2)}`, date, text: text.trim(), points: roundPoints(points), source, createdAt: new Date().toISOString() });
			});
		});
	}
	deleteRecord(id: string) {
		return this.enqueue(() => this.update(data => { data.manualPointRecords = (data.manualPointRecords || []).filter((record: any) => String(record.id) !== id); }));
	}
	saveList(key: "examplePropertyLeft" | "examplePropertyRight", values: string[]) {
		return this.enqueue(() => this.update(data => { data[key] = values.filter(value => value.trim()); }));
	}
	saveDefaultRate(rate: number, enabled: boolean) {
		return this.enqueue(() => this.update(data => { data.defaultPointRule = { ...data.defaultPointRule, baseRate: rate, enabled }; }));
	}
	async saveHabitRate(path: string, rate: number | null) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(t("Habit note not found."));
		await this.app.fileManager.processFrontMatter(file, data => { if (rate === null) delete data.bravoPoints; else data.bravoPoints = rate; });
		this.app.workspace.trigger("task-genius:points-updated");
	}
	redeem(label: string, cost: number, rewardId?: string) {
		return this.enqueue(async () => {
			const snapshot = await this.snapshot();
			if (!Number.isFinite(cost) || cost <= 0 || snapshot.balance < cost) throw new Error(t("Not enough points."));
			const reward = rewardId ? this.plugin.settings.rewards.rewardItems.find(item => item.id === rewardId) : undefined;
			if (rewardId && (!reward || reward.inventory === 0)) throw new Error(t("This reward is out of stock."));
			const inventory = reward?.inventory;
			if (reward && reward.inventory > 0) {
				reward.inventory--;
				try { await this.plugin.saveSettings(); } catch (error) { reward.inventory = inventory!; throw error; }
			}
			try { await this.update(data => {
				if (!Array.isArray(data.manualPointRecords)) data.manualPointRecords = [];
				data.manualPointRecords.push({ id: `redeem-${Date.now()}-${Math.random().toString(36).slice(2)}`, date: localPointDate(), text: label, points: -cost, source: "redemption", createdAt: new Date().toISOString() });
			}); } catch (error) {
				if (reward && inventory !== undefined && inventory > 0) { reward.inventory = inventory; await this.plugin.saveSettings(); }
				throw error;
			}
		});
	}
}
export type PointsSnapshot = Awaited<ReturnType<PointsService["snapshot"]>>;
