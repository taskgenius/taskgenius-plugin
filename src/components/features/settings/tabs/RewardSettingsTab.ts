import type { TaskProgressBarSettingTab } from "@/setting";
import { PointsDashboard } from "@/components/features/rewards/PointsDashboard";

/** Settings and the main page share the same data and reward actions. */
export function renderRewardSettingsTab(settingTab: TaskProgressBarSettingTab, containerEl: HTMLElement): PointsDashboard {
	const dashboard = new PointsDashboard(settingTab.app, settingTab.plugin, containerEl, true);
	dashboard.load();
	return dashboard;
}
