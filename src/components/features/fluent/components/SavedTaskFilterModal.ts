import { App, Modal, Notice, Setting } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import type { PresetTaskFilter } from "@/common/setting-definition";
import { t } from "@/translations/helper";
import { parseAdvancedFilterQuery } from "@/utils/task/filter-compatibility";
import { conditionsQuery, FilterCondition } from "@/utils/task/saved-task-filters";

export class SavedTaskFilterModal extends Modal {
	constructor(app: App, private plugin: TaskProgressBarPlugin, private query: string,
		private onSave: (id: string) => void, private existing?: PresetTaskFilter) { super(app); }
	onOpen(): void {
		this.modalEl.addClass("tg-saved-filter-modal");
		this.setTitle(t(this.existing ? "Edit saved filter" : "New saved filter"));
		let name = this.existing?.name || "", relation = this.existing?.options.relation || "AND";
		let advanced = this.existing?.options.advancedFilterQuery || this.query;
		let useAdvanced = !!advanced && !this.existing?.options.conditions;
		const conditions: FilterCondition[] = this.existing?.options.conditions?.map(row => ({ ...row })) || [{ field: "status", operator: "=", value: "not-started" }];
		new Setting(this.contentEl).setName(t("Name")).addText(text => text.setValue(name).onChange(value => name = value));
		new Setting(this.contentEl).setName(t("Combine conditions")).addDropdown(dropdown => dropdown.addOption("AND", t("Match all conditions")).addOption("OR", t("Match any condition")).setValue(relation).onChange(value => relation = value as "AND" | "OR"));
		const rows = this.contentEl.createDiv();
		const render = () => {
			rows.empty();
			for (const [index, condition] of conditions.entries()) {
				const row = new Setting(rows);
				row.addDropdown(dropdown => {
					for (const [field, label] of [["status", "Status"], ["date", "Any task date"], ["due", "Due date"], ["start", "Start date"], ["scheduled", "Scheduled date"], ["priority", "Priority"], ["project", "Project"], ["tag", "Tag"], ["text", "Text"], ["path", "File path"]]) dropdown.addOption(field, t(label));
					dropdown.setValue(condition.field).onChange(value => { condition.field = value; condition.value = ""; condition.operator = "="; render(); });
				});
				const isDate = ["date", "due", "start", "scheduled"].includes(condition.field);
				row.addDropdown(dropdown => {
					for (const [operator, label] of [["=", "Equals"], ["!=", "Does not equal"], ...(["text", "path", "tag", "project"].includes(condition.field) ? [["contains", "Contains"]] : []), ...(isDate || condition.field === "priority" ? [[">=", "At least / on or after"], ["<=", "At most / on or before"]] : [])]) dropdown.addOption(operator, t(label));
					dropdown.setValue(condition.operator).onChange(value => condition.operator = value);
				});
				const choices = condition.field === "status" ? [["not-started", "Not started"], ["planned", "Planned"], ["in-progress", "In progress"], ["completed", "Completed"], ["abandoned", "Abandoned"], ["paused", "Paused"]]
					: condition.field === "priority" ? [["0", "None"], ["1", "Lowest"], ["2", "Low"], ["3", "Medium"], ["4", "High"], ["5", "Highest"]]
					: isDate ? [["today", "Today"], ["tomorrow", "Tomorrow"], ["this-week", "This week"], ["this-month", "This month"], ["next-7-days", "Next 7 days"], ["none", "No date"], ["custom", "Choose date"]]
					: condition.field === "project" ? [...new Set(this.app.vault.getMarkdownFiles().map(file => this.app.metadataCache.getFileCache(file)?.frontmatter?.project).filter(value => typeof value === "string"))].map(value => [value, value])
					: condition.field === "tag" ? [...new Set([...(this.plugin.preloadedTasks || []).flatMap(task => task.metadata.tags || []), ...this.app.vault.getMarkdownFiles().flatMap(file => (this.app.metadataCache.getFileCache(file)?.tags || []).map(tag => tag.tag))])].map(value => [value, value]) : null;
				if (choices) row.addDropdown(dropdown => {
					dropdown.addOption("", t("Select a value"));
					for (const [value, label] of choices) dropdown.addOption(value, ["project", "tag"].includes(condition.field) ? label : t(label));
					const customDate = isDate && /^\d{4}-\d{2}-\d{2}$/.test(condition.value);
					if (condition.value && !customDate && !choices.some(([value]) => value === condition.value)) dropdown.addOption(condition.value, condition.value);
					dropdown.setValue(customDate ? "custom" : condition.value).onChange(value => { condition.value = value; render(); });
				});
				if (!choices || (isDate && (condition.value === "custom" || /^\d{4}-\d{2}-\d{2}$/.test(condition.value)))) row.addText(text => {
					if (isDate) text.inputEl.type = "date";
					text.setPlaceholder(t("Value")).setValue(condition.value === "custom" ? "" : condition.value).onChange(value => condition.value = value);
				});
				row.addExtraButton(button => button.setIcon("trash").setTooltip(t("Remove condition")).onClick(() => { conditions.splice(index, 1); render(); }));
			}
		}; render();
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Add condition")).onClick(() => { conditions.push({ field: "status", operator: "=", value: "" }); render(); }));
		const details = this.contentEl.createEl("details"); details.createEl("summary", { text: t("Advanced query (optional)") });
		new Setting(details).setName(t("Use advanced query")).addToggle(toggle => toggle.setValue(useAdvanced).onChange(value => useAdvanced = value));
		new Setting(details).addTextArea(text => text.setValue(advanced).onChange(value => advanced = value));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(async () => {
			if (!name.trim()) { new Notice(t("Enter a filter name.")); return; }
			if (!useAdvanced && conditions.some(row => !row.value || row.value === "custom")) { new Notice(t("Choose a value for every condition.")); return; }
			button.setDisabled(true);
			try {
				const query = useAdvanced ? advanced : conditionsQuery(conditions, relation); parseAdvancedFilterQuery(query);
				const id = this.existing?.id || `filter-${Date.now()}`;
				const preset: PresetTaskFilter = { id, name: name.trim(), options: {
					includeCompleted: true, includeInProgress: true, includeAbandoned: true, includeNotStarted: true, includePlanned: true,
					includeParentTasks: false, includeChildTasks: false, includeSiblingTasks: false,
					conditions: useAdvanced ? undefined : conditions, relation, advancedFilterQuery: query.trim(), filterMode: "INCLUDE",
				} };
				const filters = this.plugin.settings.taskFilter.presetTaskFilters;
				const index = filters.findIndex(item => item.id === id);
				if (index < 0) filters.push(preset); else filters[index] = preset;
				await this.plugin.saveSettings(); this.onSave(id); this.close();
			} catch (error) { new Notice(String(error)); button.setDisabled(false); }
		}));
	}
}
