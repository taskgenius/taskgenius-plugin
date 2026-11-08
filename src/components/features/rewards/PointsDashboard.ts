import { App, Component, Modal, Notice, Setting } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { RewardItem } from "@/common/setting-definition";
import { t } from "@/translations/helper";

export class PointsDashboard extends Component {
	public containerEl: HTMLElement;
	private balanceEl: HTMLElement;
	constructor(private app: App, private plugin: TaskProgressBarPlugin, parent: HTMLElement) { super(); this.containerEl = parent.createDiv({ cls: "tg-points-page" }); }

	onload() {
		this.render();
		this.registerEvent(this.app.workspace.on("task-genius:points-updated", () => this.render()));
	}
	private render() {
		this.containerEl.empty();
		const rewards = this.plugin.settings.rewards;
		const ledger = rewards.pointsLedger || [];
		const balance = ledger.reduce((sum, entry) => sum + entry.delta, 0);
		const header = this.containerEl.createDiv({ cls: "tg-points-header" });
		header.createDiv({ cls: "tg-points-heading", text: t("Points and rewards") });
		header.createDiv({ cls: "tg-points-subtitle", text: t("Earn points from tasks, add points manually, and redeem rewards.") });
		const add = header.createEl("button", { cls: "mod-cta", text: t("Add points") });
		this.registerDomEvent(add, "click", () => this.addPoints());
		const cards = this.containerEl.createDiv({ cls: "tg-points-summary" });
		const balanceCard = cards.createDiv({ cls: "tg-points-card is-primary" });
		balanceCard.createDiv({ cls: "tg-points-label", text: t("Available points") });
		this.balanceEl = balanceCard.createDiv({ cls: "tg-points-balance", text: String(balance) });
		cards.createDiv({ cls: "tg-points-card" }).createDiv({ cls: "tg-points-label", text: `${ledger.length} ${t("ledger entries")}` });
		const rules = cards.createDiv({ cls: "tg-points-card" });
		rules.createDiv({ cls: "tg-points-label", text: t("Default task points") });
		const ruleButton = rules.createEl("button", { text: `${this.plugin.settings.rewards.pointsPerTask ?? 10} ${t("points per task")}` });
		this.registerDomEvent(ruleButton, "click", () => this.editPointRule());
		const columns = this.containerEl.createDiv({ cls: "tg-points-columns" });
		const history = columns.createDiv({ cls: "tg-points-panel" });
		history.createEl("h3", { text: t("Points history") });
		if (!ledger.length) history.createDiv({ cls: "tg-points-empty", text: t("Complete tasks to start earning points.") });
		ledger.slice().reverse().slice(0, 100).forEach(entry => {
			const row = history.createDiv({ cls: "tg-points-entry" });
			const detail = row.createDiv(); detail.createDiv({ text: entry.label }); detail.createDiv({ cls: "tg-points-date", text: new Date(entry.createdAt).toLocaleString() });
			row.createDiv({ cls: entry.delta < 0 ? "tg-points-delta is-negative" : "tg-points-delta", text: `${entry.delta > 0 ? "+" : ""}${entry.delta}` });
		});
		const shop = columns.createDiv({ cls: "tg-points-panel" });
		const shopHeader = shop.createDiv({ cls: "tg-points-shop-header" }); shopHeader.createEl("h3", { text: t("Reward shop") });
		const create = shopHeader.createEl("button", { text: t("Add reward") }); this.registerDomEvent(create, "click", () => this.addReward());
		if (!rewards.rewardItems.length) shop.createDiv({ cls: "tg-points-empty", text: t("Add rewards to redeem them with points.") });
		rewards.rewardItems.forEach((reward, index) => {
			const row = shop.createDiv({ cls: "tg-reward-card" });
			const info = row.createDiv(); info.createDiv({ cls: "tg-reward-name", text: reward.name }); info.createDiv({ cls: "tg-points-date", text: reward.pointCost ? `${reward.pointCost} ${t("points")}` : t("Set a point cost to enable redemption") });
			const actions = row.createDiv({ cls: "tg-reward-actions" });
			const redeem = actions.createEl("button", { text: t("Redeem") }); redeem.disabled = !reward.pointCost || balance < reward.pointCost;
			this.registerDomEvent(redeem, "click", () => void this.redeem(reward));
			const edit = actions.createEl("button", { text: t("Edit") }); this.registerDomEvent(edit, "click", () => this.editReward(reward));
			const remove = actions.createEl("button", { text: t("Delete") }); this.registerDomEvent(remove, "click", () => { rewards.rewardItems.splice(index, 1); void this.plugin.saveSettings().then(() => this.render()); });
		});
	}

	private async addPoints() { await this.adjustPoints(t("Manual points")); }
	private editPointRule() {
		new PointsEntryModal(this.app, async value => { this.plugin.settings.rewards.pointsPerTask = value; await this.plugin.saveSettings(); this.render(); }, this.plugin.settings.rewards.pointsPerTask ?? 10, t("Default task points"), false).open();
	}
	private async adjustPoints(label: string, amount?: number) {
		if (amount === undefined) {
			const modal = new PointsEntryModal(this.app, async (value, note) => { await this.record(value, note || label); }); modal.open(); return;
		}
		await this.record(amount, label);
	}
	private async record(delta: number, label: string) {
		const ledger = this.plugin.settings.rewards.pointsLedger || (this.plugin.settings.rewards.pointsLedger = []);
		ledger.push({ id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, delta, label, createdAt: Date.now(), source: "manual" });
		await this.plugin.saveSettings(); this.render(); this.app.workspace.trigger("task-genius:points-updated");
	}
	private async redeem(reward: RewardItem) {
		const cost = Number(reward.pointCost || 0); const balance = (this.plugin.settings.rewards.pointsLedger || []).reduce((s, e) => s + e.delta, 0);
		if (cost <= 0 || balance < cost) return;
		const ledger = this.plugin.settings.rewards.pointsLedger!;
		ledger.push({ id: `redeem-${Date.now()}-${reward.id}`, delta: -cost, label: `${t("Redeemed")}: ${reward.name}`, createdAt: Date.now(), source: "redemption" });
		if (reward.inventory > 0) reward.inventory--;
		await this.plugin.saveSettings(); new Notice(t("Reward redeemed")); this.render(); this.app.workspace.trigger("task-genius:points-updated");
	}
	private addReward() { this.editReward({ id: `reward-${Date.now()}`, name: "", occurrence: "common", inventory: -1, pointCost: 0 }); }
	private editReward(reward: RewardItem) {
		const isNew = !this.plugin.settings.rewards.rewardItems.some(item => item.id === reward.id);
		const modal = new RewardEditorModal(this.app, reward, async updated => {
			if (isNew) this.plugin.settings.rewards.rewardItems.push(updated);
			else Object.assign(reward, updated);
			await this.plugin.saveSettings(); this.render();
		}); modal.open();
	}
}

class PointsEntryModal extends Modal {
	constructor(app: App, private save: (amount: number, label?: string) => Promise<void>, private initial = 1, private title = t("Add points"), private allowNegative = true) { super(app); }
	onOpen() { this.setTitle(this.title); let amount = this.initial, label = ""; new Setting(this.contentEl).setName(t("Points")).addText(text => text.setValue(String(this.initial)).onChange(value => amount = Number(value))); if (this.title === t("Add points")) new Setting(this.contentEl).setName(t("Description")).addText(text => text.onChange(value => label = value)); new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(() => { if (!Number.isFinite(amount) || (!this.allowNegative && amount < 0) || (this.title === t("Add points") && amount === 0)) { new Notice(t("Enter a non-zero number")); return; } void this.save(amount, label || t("Manual points")).then(() => this.close()); })); }
}

class RewardEditorModal extends Modal {
	constructor(app: App, private reward: RewardItem, private save: (reward: RewardItem) => Promise<void>) { super(app); }
	onOpen() { this.setTitle(t("Reward")); let name = this.reward.name, cost = Number(this.reward.pointCost || 0), inventory = this.reward.inventory; new Setting(this.contentEl).setName(t("Name")).addText(text => text.setValue(name).onChange(value => name = value)); new Setting(this.contentEl).setName(t("Point cost")).addText(text => text.setValue(String(cost)).onChange(value => cost = Number(value))); new Setting(this.contentEl).setName(t("Inventory")).addText(text => text.setValue(String(inventory)).onChange(value => inventory = Number(value))); new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(() => { if (!name.trim() || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(inventory) || (inventory < 0 && inventory !== -1)) { new Notice(t("Check the reward details")); return; } void this.save({ ...this.reward, name: name.trim(), pointCost: cost, inventory }).then(() => this.close()); })); }
}
