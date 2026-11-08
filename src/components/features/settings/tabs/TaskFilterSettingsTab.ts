import { Setting } from "obsidian";
import type { TaskProgressBarSettingTab } from "@/setting";
import { SavedTaskFilterModal } from "@/components/features/fluent/components/SavedTaskFilterModal";
import { savedTaskFilters } from "@/utils/task/saved-task-filters";
import { t } from "@/translations/helper";

export function renderTaskFilterSettingsTab(tab: TaskProgressBarSettingTab, root: HTMLElement): void {
	new Setting(root).setName(t("Saved filters")).setDesc(t("Choose a saved filter beside search. Edit its rules here using dropdowns.")).setHeading();
	const list = root.createDiv({ cls: "preset-filters-container" });
	const render = () => {
		list.empty();
		for (const preset of savedTaskFilters(tab.plugin.settings.taskFilter.presetTaskFilters)) {
			const row = new Setting(list).setName(preset.name);
			row.addExtraButton(button => button.setIcon("pencil").setTooltip(t("Edit saved filter")).onClick(() =>
				new SavedTaskFilterModal(tab.app, tab.plugin, "", () => { render(); tab.plugin.triggerViewUpdate(); }, preset).open()));
			const isBuiltin = preset.id.startsWith("builtin-");
			if (!isBuiltin || tab.plugin.settings.taskFilter.presetTaskFilters.some(item => item.id === preset.id)) row.addExtraButton(button => button.setIcon(isBuiltin ? "rotate-ccw" : "trash").setTooltip(t(isBuiltin ? "Reset filter preset" : "Delete saved filter")).onClick(async () => {
				tab.plugin.settings.taskFilter.presetTaskFilters = tab.plugin.settings.taskFilter.presetTaskFilters.filter(item => item.id !== preset.id);
				await tab.plugin.saveSettings(); render(); await tab.plugin.triggerViewUpdate();
			}));
		}
	}; render();
	new Setting(root).addButton(button => button.setButtonText(t("New saved filter")).setCta().onClick(() => new SavedTaskFilterModal(tab.app, tab.plugin, "", () => render()).open()));
}
