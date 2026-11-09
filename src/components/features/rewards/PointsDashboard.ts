import { pointLedgerDate } from "@/managers/points-utils";
import { App, Component, Modal, Notice, SearchComponent, Setting } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import type { RewardItem } from "@/common/setting-definition";
import { HabitsBlock } from "@/integrations/habits/ui/habits-block";
import { localPointDate, roundPoints } from "@/managers/daily-points";
import { pointsService, PointsSnapshot } from "@/managers/points-service";
import { t } from "@/translations/helper";

type PointsTab = "daily" | "actions" | "history" | "rules";
const numberText = (value: number) => String(roundPoints(value));

/** One native page backed by the original Markdown ledger and habit notes. */
export class PointsDashboard extends Component {
	readonly containerEl: HTMLElement;
	private summaryEl!: HTMLElement;
	private bodyEl!: HTMLElement;
	private tabsEl!: HTMLElement;
	private activeTab: PointsTab;
	private query = "";
	setSearchQuery(query: string): void { this.query = query.trim().toLocaleLowerCase(); this.renderBody(); }
	private historyFilter = "all";
	private snapshot?: PointsSnapshot;
	private scope?: Component;
	private habits?: HabitsBlock;
	private request = 0;
	private disposed = false;
	private refreshTimer?: number;

	constructor(private app: App, private plugin: TaskProgressBarPlugin, parent: HTMLElement, private settingsMode = false, private page: "points" | "rewards" = "points") {
		super();
		this.activeTab = "actions";
		this.containerEl = parent.createDiv({ cls: "tg-points-page" });
	}
	onload(): void {
		this.disposed = false;
		const header = this.containerEl.createDiv({ cls: "tg-points-header" });
		const heading = header.createDiv();
		heading.createEl("h2", { text: t("Points and rewards") });
		heading.createDiv({ cls: "tg-points-subtitle", text: t("Earn points and redeem rewards in one place.") });
		this.button(header, t("Add points"), () => this.editRecord(), true);
		this.summaryEl = this.containerEl.createDiv({ cls: "tg-points-summary" });
		this.tabsEl = this.containerEl.createDiv({ cls: "tg-points-tabs", attr: { role: "tablist" } });
		const tools = this.containerEl.createDiv({ cls: "tg-points-tools" });
		if (this.settingsMode) new SearchComponent(tools).setPlaceholder(t("Search bonuses, rewards and records"))
			.onChange(value => { this.query = value.toLocaleLowerCase().trim(); this.renderBody(); });
		const filter = tools.createEl("select", { attr: { "aria-label": t("Filter") } });
		for (const [value, label] of [["all", "All"], ["today", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"], ["positive", "Points earned"], ["negative", "Points spent"]]) filter.createEl("option", { value, text: t(label) });
		this.registerDomEvent(filter, "change", () => { this.historyFilter = filter.value; this.renderBody(); });
		this.bodyEl = this.containerEl.createDiv({ cls: "tg-points-body" });
		this.renderTabs();
		for (const event of ["task-genius:points-updated", "task-genius:cache-ready", "task-genius:task-cache-updated"]) {
			this.registerEvent(this.app.workspace.on(event as "task-genius:points-updated", () => this.scheduleRefresh()));
		}
		for (const event of ["modify", "create", "delete", "rename"] as const) this.registerEvent(this.app.vault.on(event as "modify", file => {
			const folder = this.plugin.habitsIntegration?.settings.habitsFolder || this.plugin.settings.habitsIntegration?.habitsFolder || "Habits";
			if (file.path === pointsService(this.plugin).dataPath || file.path.startsWith(`${folder}/`)) this.scheduleRefresh();
		}));
		void this.refresh();
	}
	onunload(): void {
		this.disposed = true;
		this.request++;
		window.clearTimeout(this.refreshTimer);
		this.containerEl.empty();
	}
	private scheduleRefresh() {
		window.clearTimeout(this.refreshTimer);
		this.refreshTimer = window.setTimeout(() => void this.refresh(), 150);
	}
	private async refresh() {
		const request = ++this.request;
		try {
			const snapshot = await pointsService(this.plugin).snapshot();
			if (this.disposed || request !== this.request) return;
			this.snapshot = snapshot;
			this.summaryEl.empty();
			for (const [label, value, primary] of [
				[t("Available points"), numberText(snapshot.balance), true],
				[t("Today's points"), numberText(snapshot.todayPoints), false],
			] as const) {

				const card = this.summaryEl.createDiv({ cls: `tg-points-card${primary ? " is-primary" : ""}` });
				card.createDiv({ cls: "tg-points-label", text: label });
				card.createDiv({ cls: "tg-points-balance", text: value });
			}
			if (this.activeTab !== "daily" || !this.habits) this.renderBody();
		} catch (error) { if (!this.disposed) this.bodyEl.setText(String(error)); }
	}
	private renderTabs() {
		(this.containerEl.querySelector(".tg-points-tools select") as HTMLElement | null)?.toggle(this.activeTab === "history");
		this.tabsEl.empty();
		const tabs: Array<[PointsTab, string]> = [["actions", "Bonuses and rewards"], ["history", "Points history"], ["rules", "Points rules"]];
		for (const [id, label] of tabs) {
			const button = this.tabsEl.createEl("button", { text: t(label), attr: { role: "tab", "aria-selected": String(id === this.activeTab) } });
			button.toggleClass("is-active", id === this.activeTab);
			button.addEventListener("click", () => { this.activeTab = id; this.renderTabs(); this.clearBody(); this.renderBody(); });
		}
	}
	private clearBody() {
		if (this.scope) this.removeChild(this.scope);
		this.scope = this.addChild(new Component());
		this.habits = undefined;
		this.bodyEl.empty();
	}
	private matches(text: string) { return !this.query || text.toLocaleLowerCase().includes(this.query); }
	private renderBody() {
		if (!this.snapshot || this.disposed) return;
		this.bodyEl.toggleClass("is-actions", this.activeTab === "actions");
		this.bodyEl.toggleClass("is-history", this.activeTab === "history");
		if (this.activeTab === "daily" && this.habits) { this.habits.setSearchQuery(this.query); return; }
		this.clearBody();
		if (this.activeTab === "daily") void this.renderHabits();
		else if (this.activeTab === "actions") this.renderActions();
		else if (this.activeTab === "history") this.renderHistory();
		else this.renderRules();
	}
	private async renderHabits() {
		const scope = this.scope;
		try {
			const integration = await this.plugin.ensureHabitsIntegration();
			if (this.disposed || scope !== this.scope) return;
			const root = this.bodyEl.createDiv({ cls: "tg-habits-surface" });
			this.habits = scope!.addChild(new HabitsBlock(this.app, integration.store, () => integration.settings, integration.events, "", root));
			this.habits.setSearchQuery(this.query);
		} catch (error) { if (scope === this.scope) this.bodyEl.setText(String(error)); }
	}
	private panel(label: string) {
		const panel = this.bodyEl.createDiv({ cls: "tg-points-panel" });
		panel.createEl("h3", { text: label });
		return panel;
	}
	private renderActions() {
		const snapshot = this.snapshot!;
		const bonuses = this.panel(t("Bonus actions"));
		this.button(bonuses, t("Edit bonus actions"), () => this.editList("examplePropertyLeft"));
		for (const item of snapshot.bonuses.filter(item => this.matches(item.text))) {
			const row = bonuses.createDiv({ cls: "tg-reward-card" });
			row.createDiv({ text: item.text });
			this.button(row, t("Record points"), () => this.editRecord(item.text, item.amount ?? 1));
		}
		const shop = this.panel(t("Reward shop"));
		this.button(shop, t("Edit reward wishes"), () => this.editList("examplePropertyRight"));
		for (const item of snapshot.wishes.filter(item => this.matches(item.text))) {
			const row = shop.createDiv({ cls: "tg-reward-card" }); row.createDiv({ text: item.text });
			const cost = Math.abs(item.amount ?? 0);
			const button = this.button(row, cost ? `${t("Redeem")} · ${numberText(cost)}` : t("Set a point cost to enable redemption"), () => this.confirmRedemption(item.text, cost));
			button.disabled = cost <= 0 || snapshot.balance < cost;
		}
		for (const reward of this.plugin.settings.rewards.rewardItems.filter(item => item.pointCost !== undefined && this.matches(item.name))) {
			const row = shop.createDiv({ cls: "tg-reward-card" }); row.createDiv({ text: reward.name });
			const actions = row.createDiv({ cls: "tg-reward-actions" });
			const cost = reward.pointCost || 0;
			const redeem = this.button(actions, `${t("Redeem")} · ${numberText(cost)}`, () => this.confirmRedemption(reward.name, cost, reward.id));
			redeem.disabled = cost <= 0 || snapshot.balance < cost || reward.inventory === 0;
			this.button(actions, t("Edit"), () => this.editReward(reward));
			this.button(actions, t("Delete"), () => this.confirm(t("Delete this reward?"), async () => { this.plugin.settings.rewards.rewardItems = this.plugin.settings.rewards.rewardItems.filter(item => item.id !== reward.id); await this.plugin.saveSettings(); }));
		}
		this.button(shop, t("Add reward"), () => this.editReward());
	}
	private historyDateMatches(date: string): boolean {
		const today = localPointDate();
		if (this.historyFilter === "today") return date === today;
		if (!["week", "month"].includes(this.historyFilter)) return true;
		const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (this.historyFilter === "week" ? 6 : 29));
		return date >= localPointDate(cutoff) && date <= today;
	}
	private historyAmountMatches(amount: number): boolean { return (this.historyFilter !== "positive" || amount > 0) && (this.historyFilter !== "negative" || amount < 0); }
	private renderHistory() {
		const snapshot = this.snapshot!;
		const panel = this.panel(t("Points history"));
		const records = [

			...snapshot.manual.map(item => ({ id: item.id, date: item.date, label: item.text, amount: item.points, manual: true })),
			...snapshot.ledger.filter(item => item.source !== "task").map(item => ({ id: item.id, date: pointLedgerDate(item), label: item.label, amount: item.delta, manual: false })),
		].filter(item => this.matches(`${item.date} ${item.label}`) && this.historyDateMatches(item.date) && this.historyAmountMatches(item.amount)).sort((a, b) => b.date.localeCompare(a.date));
		for (const record of records) {
			const row = panel.createDiv({ cls: "tg-points-entry" });
			const detail = row.createDiv(); detail.createDiv({ text: record.label }); detail.createDiv({ cls: "tg-points-date", text: record.date });
			row.createDiv({ cls: record.amount < 0 ? "tg-points-delta is-negative" : "tg-points-delta", text: `${record.amount > 0 ? "+" : ""}${numberText(record.amount)}` });
			if (record.manual) this.button(detail, t("Delete"), () => this.confirm(t("Delete this points record?"), () => pointsService(this.plugin).deleteRecord(record.id)));
		}
		if (!records.length) panel.createDiv({ cls: "tg-points-empty", text: t("No matching records") });
		const habits = this.panel(t("Habit points"));
		const completionPoints = snapshot.automaticTasks.days.filter(day => this.historyDateMatches(day.date)).reduce((sum, day) => sum + day.supplement, 0) + snapshot.ledger.filter(item => item.source === "task" && this.historyDateMatches(pointLedgerDate(item))).reduce((sum, item) => sum + item.delta, 0);
		if (!snapshot.automaticTasks.habitPaths.length && completionPoints && this.historyAmountMatches(completionPoints) && this.matches(t("Completed tasks"))) {
			const row = habits.createDiv({ cls: "tg-points-entry" }); row.createDiv({ text: t("Completed tasks") }); row.createDiv({ text: numberText(completionPoints) });
		}
		for (const item of snapshot.summaries.filter(item => this.matches(item.name))) {
			const base = ["week", "month"].includes(this.historyFilter) ? Object.entries(item.dailyPoints || {}).filter(([date]) => this.historyDateMatches(date)).reduce((sum, [, points]) => sum + points, 0) : this.historyFilter === "today" ? item.todayPoints : item.points;
			const amount = roundPoints(base + (snapshot.automaticTasks.habitPaths[0] === item.path ? completionPoints : 0));
			if (!amount || !this.historyAmountMatches(amount)) continue;
			const row = habits.createDiv({ cls: "tg-points-entry" });
			const entries = ["today", "week", "month"].includes(this.historyFilter) ? Object.entries(item.dailyEntries || Object.fromEntries(Object.keys(item.dailyPoints || {}).map(day => [day, 1]))).filter(([day]) => this.historyDateMatches(day)).reduce((sum, [, count]) => sum + count, 0) : item.entries;
			row.createDiv({ text: `${item.name} · ${entries} ${t("check-ins")}` });
			row.createDiv({ text: numberText(amount) });
		}
	}
	private renderRules() {
		const snapshot = this.snapshot!;
		const panel = this.panel(t("Points rules"));
		new Setting(panel).setName(t("Points data file")).setDesc(snapshot.path)
			.addButton(button => button.setButtonText(t("Open")).onClick(() => void this.app.workspace.openLinkText(snapshot.path, "", false)))
			.addButton(button => button.setButtonText(t("Change")).onClick(() => new PointTextModal(this.app, t("Points data file"), snapshot.path, async value => {
				if (!value.trim().endsWith(".md") || /^(?:[a-zA-Z]:|[\\/])/.test(value) || value.split(/[\\/]/).includes("..")) throw new Error(t("Choose a Markdown file inside the vault."));
				this.plugin.settings.rewards.pointsDataFile = value.trim(); await this.plugin.saveSettings(); await this.refresh();
			}).open()));
		new Setting(panel).setName(t("Default habit points")).setDesc(t("Habit-specific points override the default. Negative values deduct points above the habit allowance."))
			.addToggle(toggle => toggle.setValue(snapshot.data.defaultPointRule?.enabled !== false).onChange(value => void pointsService(this.plugin).saveDefaultRate(Number(snapshot.data.defaultPointRule?.baseRate ?? 0.1), value)))
			.addButton(button => button.setButtonText(numberText(Number(snapshot.data.defaultPointRule?.baseRate ?? 0.1))).onClick(() => new PointAmountModal(this.app, t("Default habit points"), t("Default rule"), Number(snapshot.data.defaultPointRule?.baseRate ?? 0.1), async (_label, amount) => pointsService(this.plugin).saveDefaultRate(amount, true), true).open()));
		new Setting(panel).setName(t("Default task points")).setDesc(t("Completed checkbox tasks earn points by completion date. Existing daily task check-ins are deducted to prevent double counting."))
			.addButton(button => button.setButtonText(String(snapshot.automaticTasks.rate)).onClick(() => new PointAmountModal(this.app, t("Default task points"), t("Task"), snapshot.automaticTasks.rate, async (_label, amount) => {
			if (amount < 0) throw new Error(t("Enter a positive point cost."));
			this.plugin.settings.rewards.pointsPerTask = amount; await this.plugin.saveSettings(); await this.refresh();
		}, true).open()));
		for (const item of snapshot.summaries.filter(item => this.matches(item.name))) {
			new Setting(panel).setName(item.name).setDesc(`${t("Points per unit")}: ${numberText(item.rate)} · ${t("Total")}: ${numberText(item.points)}`)
				.addButton(button => button.setButtonText(t("Edit")).onClick(() => new PointAmountModal(this.app, t("Habit points"), item.name, item.rate, async (_label, rate) => pointsService(this.plugin).saveHabitRate(item.path, rate), true).open()))
				.addButton(button => button.setButtonText(t("Use default rule")).onClick(() => void pointsService(this.plugin).saveHabitRate(item.path, null)));
		}
	}
	private editRecord(label = "", amount = 1) { new PointAmountModal(this.app, t("Record points"), label, amount, (text, points, date) => pointsService(this.plugin).addRecord(text, points, date)).open(); }
	private editList(key: "examplePropertyLeft" | "examplePropertyRight") {
		new PointTextModal(this.app, key === "examplePropertyLeft" ? t("Bonus actions") : t("Reward wishes"), (this.snapshot!.data[key] || []).join("\n"), value => pointsService(this.plugin).saveList(key, value.split(/\r?\n/)), true).open();
	}
	private confirmRedemption(label: string, cost: number, id?: string) { this.confirm(`${t("Redeem")}: ${label} · ${numberText(cost)}`, () => pointsService(this.plugin).redeem(label, cost, id)); }
	private confirm(label: string, save: () => Promise<unknown>) { new PointConfirmModal(this.app, label, async () => { await save(); await this.refresh(); }).open(); }
	private editReward(reward?: RewardItem) {
		new PointRewardModal(this.app, reward, async (label, amount, inventory) => {
			if (reward) { reward.name = label; reward.pointCost = amount; reward.inventory = inventory; }
			else this.plugin.settings.rewards.rewardItems.push({ id: `reward-${Date.now()}`, name: label, pointCost: amount, inventory, occurrence: "common" });
			await this.plugin.saveSettings(); await this.refresh();
		}).open();
	}
	private button(parent: HTMLElement, text: string, action: () => void, primary = false) {
		const button = parent.createEl("button", { text, cls: primary ? "mod-cta" : "" }); button.addEventListener("click", action); return button;
	}
}

class PointAmountModal extends Modal {
	constructor(app: App, private title: string, private label: string, private amount: number,
		private save: (label: string, amount: number, date: string) => Promise<unknown>, private allowZero = false) { super(app); }
	onOpen() {
		this.setTitle(this.title);
		let label = this.label, amount = this.amount, date = localPointDate();
		new Setting(this.contentEl).setName(t("Description")).addText(text => text.setValue(label).onChange(value => label = value));
		new Setting(this.contentEl).setName(t("Points")).addText(text => text.setValue(String(amount)).onChange(value => amount = Number(value)));
		if (this.title === t("Record points")) new Setting(this.contentEl).setName(t("Date")).addText(text => { text.inputEl.type = "date"; text.setValue(date).onChange(value => date = value); });
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(async () => {
			if (!label.trim() || !Number.isFinite(amount) || !this.allowZero && amount === 0) { new Notice(t("Enter a description and a valid point amount.")); return; }
			button.setDisabled(true);
			try { await this.save(label, amount, date); this.close(); } catch (error) { new Notice(String(error)); button.setDisabled(false); }
		}));
	}
}
class PointTextModal extends Modal {
	constructor(app: App, private title: string, private value: string, private save: (value: string) => Promise<unknown>, private multiline = false) { super(app); }
	onOpen() {
		this.setTitle(this.title); let value = this.value;
		const setting = new Setting(this.contentEl).setName(this.multiline ? t("One item per line") : t("File path"));
		if (this.multiline) setting.addTextArea(text => { text.setValue(value).onChange(next => value = next); text.inputEl.rows = 10; });
		else setting.addText(text => text.setValue(value).onChange(next => value = next));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(async () => {
			button.setDisabled(true); try { await this.save(value); this.close(); } catch (error) { new Notice(String(error)); button.setDisabled(false); }
		}));
	}
}
class PointConfirmModal extends Modal {
	constructor(app: App, private title: string, private save: () => Promise<unknown>) { super(app); }
	onOpen() {
		this.setTitle(this.title);
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Cancel")).onClick(() => this.close()))
			.addButton(button => button.setButtonText(t("Confirm")).setCta().onClick(async () => {
				button.setDisabled(true); try { await this.save(); this.close(); } catch (error) { new Notice(String(error)); button.setDisabled(false); }
			}));
	}
}

class PointRewardModal extends Modal {
	constructor(app: App, private reward: RewardItem | undefined, private save: (label: string, amount: number, inventory: number) => Promise<unknown>) { super(app); }
	onOpen() {
		this.setTitle(t("Reward"));
		let label = this.reward?.name || "", amount = this.reward?.pointCost || 1, inventory = this.reward?.inventory ?? -1;
		new Setting(this.contentEl).setName(t("Name")).addText(text => text.setValue(label).onChange(value => label = value));
		new Setting(this.contentEl).setName(t("Point cost")).addText(text => text.setValue(String(amount)).onChange(value => amount = Number(value)));
		new Setting(this.contentEl).setName(t("Inventory (-1 for ∞)")).addText(text => text.setValue(String(inventory)).onChange(value => inventory = Number(value)));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(async () => {
			if (!label.trim() || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(inventory) || inventory < -1) { new Notice(t("Check the reward details")); return; }
			button.setDisabled(true);
			try { await this.save(label.trim(), amount, inventory); this.close(); } catch (error) { new Notice(String(error)); button.setDisabled(false); }
		}));
	}
}
