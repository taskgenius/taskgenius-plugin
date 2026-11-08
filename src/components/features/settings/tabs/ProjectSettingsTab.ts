import { Setting } from "obsidian";
import type { TaskProgressBarSettingTab } from "@/setting";
import { ProjectFileManager, ProjectCreateModal, ProjectArchiveModal } from "@/managers/project-file-manager";
import { t } from "@/translations/helper";

export function renderProjectSettingsTab(tab: TaskProgressBarSettingTab, container: HTMLElement) {
	const manager = new ProjectFileManager(tab.app);
	new Setting(container).setName(t("Project notes")).setHeading()
		.setDesc(t("Each project is a Markdown note. Its project property owns task membership, and assigned tasks are moved into that note."));
	new Setting(container).setName(t("New project folder")).setDesc(manager.folder)
		.addButton(button => button.setButtonText(t("New project")).onClick(() => new ProjectCreateModal(tab.app, manager, () => void tab.plugin.triggerViewUpdate()).open()));
	new Setting(container).setName(t("Archived projects")).setDesc(t("Archive finished projects and restore them when needed. Notes and task history stay available."))
		.addButton(button => button.setButtonText(t("Manage archives")).onClick(() => new ProjectArchiveModal(tab.app, manager, () => void tab.plugin.triggerViewUpdate()).open()));
}
