import { App, Modal, Notice, Setting } from "obsidian";
import type TaskProgressBarPlugin from "@/index";
import type { PresetTaskFilter } from "@/common/setting-definition";
import { t } from "@/translations/helper";
import { parseAdvancedFilterQuery } from "@/utils/task/filter-compatibility";

export class SavedTaskFilterModal extends Modal {
	constructor(app: App, private plugin: TaskProgressBarPlugin, private query: string,
		private onSave: (id: string) => void, private existing?: PresetTaskFilter) { super(app); }
	onOpen(): void {
		this.setTitle(t(this.existing ? "Edit saved filter" : "New saved filter"));
		let name = this.existing?.name || "", query = this.existing?.options.advancedFilterQuery ?? this.query;
		const options: PresetTaskFilter["options"] = { includeCompleted: false, includeInProgress: true,
			includeAbandoned: false, includeNotStarted: true, includePlanned: true,
			includeParentTasks: false, includeChildTasks: false, includeSiblingTasks: false,
			advancedFilterQuery: query, filterMode: "INCLUDE", ...this.existing?.options };
		new Setting(this.contentEl).setName(t("Name")).addText(text => text.setValue(name).onChange(value => name = value));
		const conditions: Array<{ field: string; operator: string; value: string }> = [];
		let relation = "AND", queryInput: HTMLTextAreaElement;
		const updateQuery = () => {
			const parts = conditions.filter(condition => condition.value.trim()).map(condition => {
				const value = condition.value.trim();
				return `${condition.field}:${condition.operator === "contains" ? "" : condition.operator}${/^[^\s"]+$/.test(value) ? value : JSON.stringify(value)}`;
			});
			query = parts.join(` ${relation} `); if (queryInput) queryInput.value = query;
		};
		new Setting(this.contentEl).setName(t("Combine conditions")).addDropdown(dropdown => dropdown.addOption("AND", t("Match all conditions")).addOption("OR", t("Match any condition")).onChange(value => { relation = value; if (conditions.length) updateQuery(); }));
		const rows = this.contentEl.createDiv();
		const renderConditions = () => {
			rows.empty();
			conditions.forEach((condition, index) => {
				new Setting(rows).addDropdown(dropdown => {
					for (const [field, label] of [["text", "Text"], ["project", "Project"], ["tag", "Tag"], ["status", "Status"], ["priority", "Priority"], ["due", "Due date"], ["start", "Start date"], ["path", "File path"]]) dropdown.addOption(field, t(label));
					dropdown.setValue(condition.field).onChange(value => { condition.field = value; updateQuery(); });
				}).addDropdown(dropdown => {
					for (const [operator, label] of [["contains", "Contains"], ["=", "Equals"], ["!=", "Does not equal"], [">=", "At least / on or after"], ["<=", "At most / on or before"]]) dropdown.addOption(operator, t(label));
					dropdown.setValue(condition.operator).onChange(value => { condition.operator = value; updateQuery(); });
				}).addText(text => text.setPlaceholder(t("Value")).setValue(condition.value).onChange(value => { condition.value = value; updateQuery(); }))
					.addExtraButton(button => button.setIcon("trash").setTooltip(t("Remove condition")).onClick(() => { conditions.splice(index, 1); updateQuery(); renderConditions(); }));
			});
		};
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Add condition")).onClick(() => { conditions.push({ field: "project", operator: "contains", value: "" }); renderConditions(); }));
		new Setting(this.contentEl).setName(t("Filter query"))
			.setDesc(t('Combine fields with AND, OR, NOT and parentheses. Example: project:"Writing" AND priority:>=3'))
			.addTextArea(text => { text.setValue(query).onChange(value => query = value); text.inputEl.rows = 4; queryInput = text.inputEl; });
		for (const [key, label] of [["includeNotStarted", "Not started"], ["includePlanned", "Planned"], ["includeInProgress", "In progress"], ["includeCompleted", "Completed"], ["includeAbandoned", "Abandoned"]] as const) {
			new Setting(this.contentEl).setName(t(label)).addToggle(toggle => toggle.setValue(options[key]).onChange(value => options[key] = value));
		}
		new Setting(this.contentEl).setName(t("Filter mode")).addDropdown(dropdown => dropdown.addOption("INCLUDE", t("Include matches")).addOption("EXCLUDE", t("Exclude matches")).setValue(options.filterMode).onChange(value => options.filterMode = value as "INCLUDE" | "EXCLUDE"));
		new Setting(this.contentEl).addButton(button => button.setButtonText(t("Save")).setCta().onClick(async () => {
			if (!name.trim()) { new Notice(t("Enter a filter name.")); return; }
			button.setDisabled(true);
			try {
				parseAdvancedFilterQuery(query);
				const id = this.existing?.id || `filter-${Date.now()}`;
				const preset = { id, name: name.trim(), options: { ...options, advancedFilterQuery: query.trim() } };
				const filters = this.plugin.settings.taskFilter.presetTaskFilters;
				const index = filters.findIndex(item => item.id === id);
				if (index < 0) filters.push(preset); else filters[index] = preset;
				await this.plugin.saveSettings(); this.onSave(id); this.close();
			} catch (error) { new Notice(String(error)); button.setDisabled(false); }
		}));
	}
}
