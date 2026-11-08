import { t as ht } from "@/integrations/habits/i18n";
import { Setting } from "obsidian";
import { TaskProgressBarSettingTab } from "@/setting";
import { t } from "@/translations/helper";
import { HabitList } from "@/components/features/habit/components/HabitSettingList";

export function renderHabitSettingsTab(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement
) {
	new Setting(containerEl)
		.setName(t("Habit"))
		.setDesc(
			t(
				"Configure habit settings, including adding new habits, editing existing habits, and managing habit completion."
			)
		)
		.setHeading();

	new Setting(containerEl).setName(t("Enable habits")).addToggle((toggle) => {
		toggle
			.setValue(settingTab.plugin.settings.habit.enableHabits)
			.onChange(async (value) => {
				settingTab.plugin.settings.habit.enableHabits = value;
				settingTab.applySettingsUpdate();
				if (value) {
					const integration = await settingTab.plugin.ensureHabitsIntegration();
					integration.events.trigger("settings-changed");
				}
			});
	});

	const habitContainer = containerEl.createDiv({
		cls: "habit-settings-container",
	});

	// Keep the settings navigation and layout owned by Task Genius.
	void settingTab.plugin.ensureHabitsIntegration().then(integration => {
		if (!habitContainer.isConnected) return;
		integration.showCompatibilityNotice(habitContainer);
		integration.renderSettings(habitContainer.createDiv());
		if (settingTab.plugin.settings.habit.habits?.length) {
			const legacy = habitContainer.createEl("details", {cls: "tg-habits-legacy"});
			legacy.createEl("summary", {text: ht("Existing Task Genius habits")});
			displayHabitList(settingTab, legacy);
		}
	}).catch(error => {
		habitContainer.createEl("p", {text: ht("Unable to load habits. Check the console for details.")});
		console.error("Task Genius habit settings", error);
	});
}

function displayHabitList(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement
): void {
	// 创建习惯列表组件
	new HabitList(settingTab.plugin, containerEl);
}
