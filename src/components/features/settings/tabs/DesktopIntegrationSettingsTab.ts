import { t as settingsText } from "@/translations/helper";
import { Setting, Platform } from "obsidian";
import { t } from "@/translations/helper";
import { TaskProgressBarSettingTab } from "@/setting";
import { DEFAULT_SETTINGS } from "@/common/setting-definition";

export function renderDesktopIntegrationSettingsTab(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement
) {
	// Header
	new Setting(containerEl)
		.setName(t("Desktop Integration"))
		.setDesc(
			t("Configure system tray, notifications, and desktop features")
		)
		.setHeading();

	// Desktop only hint
	if (!Platform.isDesktopApp) {
		new Setting(containerEl)
			.setName(t("Desktop only"))
			.setDesc(
				t(
					"Desktop integration features are only available in the desktop app"
				)
			);
		return;
	}

	// Enable notifications (global)
	new Setting(containerEl)
		.setName(t("Enable notifications"))
		.setDesc(t("Use system notifications when possible"))
		.addToggle((toggle) => {
			toggle.setValue(
				!!settingTab.plugin.settings.notifications?.enabled
			);
			toggle.onChange((value) => {
				const s = settingTab.plugin.settings;
				s.notifications = {
					...s.notifications,
					enabled: value,
					dailySummary: {
						enabled: s.notifications?.dailySummary?.enabled ?? true,
						time: s.notifications?.dailySummary?.time ?? "09:00",
					},
					perTask: {
						enabled: s.notifications?.perTask?.enabled ?? false,
						leadMinutes:
							s.notifications?.perTask?.leadMinutes ?? 10,
					},
				};
				settingTab.applyNotificationsUpdateLight();

				setTimeout(() => {
					settingTab.display();
				}, 200);
			});
		});

	if (settingTab.plugin.settings.notifications?.enabled) {
		// Daily summary
		new Setting(containerEl)
			.setName(t("Daily summary"))
			.setDesc(
				t(
					"Send one notification for today's due tasks at a specific time (HH:mm)"
				)
			)
			.addToggle((toggle) => {
				const ns = settingTab.plugin.settings.notifications;
				toggle.setValue(!!ns?.dailySummary?.enabled);
				toggle.onChange((value) => {
					const s = settingTab.plugin.settings;
					s.notifications = {
						...s.notifications,
						dailySummary: {
							enabled: value,
							time:
								s.notifications?.dailySummary?.time ?? "09:00",
						},
					} as any;
					settingTab.applyNotificationsUpdateLight();
				});
			})
			.addText((text) => {
				const time =
					settingTab.plugin.settings.notifications?.dailySummary
						?.time || "09:00";
				text.setPlaceholder("09:00")
					.setValue(time)
					.onChange((val) => {
						const s = settingTab.plugin.settings;
						s.notifications = {
							...s.notifications,
							dailySummary: {
								enabled:
									s.notifications?.dailySummary?.enabled ??
									true,
								time: val || "09:00",
							},
						} as any;
						settingTab.applyNotificationsUpdateLight();
					});
				// Change input type to time picker
				text.inputEl.type = "time";
			})
			.addButton((btn) => {
				btn.setButtonText(t("Send now"));
				btn.onClick(async () => {
					await settingTab.plugin.notificationManager?.triggerDailySummary();
				});
			});

		// Per task reminders
		new Setting(containerEl)
			.setName(t("Per-task reminders"))
			.setDesc(t("Notify shortly before each task's due time"))
			.addToggle((toggle) => {
				const ns = settingTab.plugin.settings.notifications;
				toggle.setValue(!!ns?.perTask?.enabled);
				toggle.onChange((value) => {
					const s = settingTab.plugin.settings;
					s.notifications = {
						...s.notifications,
						perTask: {
							enabled: value,
							leadMinutes:
								s.notifications?.perTask?.leadMinutes ?? 10,
						},
					} as any;
					settingTab.applyNotificationsUpdateLight();
				});
			})
			.addText((text) => {
				const lead = String(
					settingTab.plugin.settings.notifications?.perTask
						?.leadMinutes ?? 10
				);
				text.setPlaceholder("10")
					.setValue(lead)
					.onChange((val) => {
						const minutes = Math.max(
							0,
							parseInt(val || "0", 10) || 0
						);
						const s = settingTab.plugin.settings;
						s.notifications = {
							...s.notifications,
							perTask: {
								enabled:
									s.notifications?.perTask?.enabled ?? false,
								leadMinutes: minutes,
							},
						} as any;
						settingTab.applyNotificationsUpdateLight();
					});
				// Change input type to number with constraints
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.max = "1440"; // Max 24 hours in minutes
				text.inputEl.step = "5"; // Step by 5 minutes
			})
			.addButton((btn) => {
				btn.setButtonText(t("Scan now"));
				btn.onClick(() =>
					settingTab.plugin.notificationManager?.triggerImminentScan()
				);
			});
	}

	// Tray / Quick access
	new Setting(containerEl)
		.setName(t("Tray indicator"))
		.setDesc(
			t("Show a bell with count in system tray, status bar, or both")
		)
		.addDropdown((dd) => {
			const s = settingTab.plugin.settings;
			s.desktopIntegration = s.desktopIntegration || {
				enableTray: false,
			};
			const mode = s.desktopIntegration.trayMode || "status";
			dd.addOptions({
				system: settingsText("System tray"),
				status: settingsText("Status bar"),
				both: settingsText("Both"),
			})
				.setValue(mode)
				.onChange((v) => {
					s.desktopIntegration = {
						...s.desktopIntegration,
						trayMode: v as any,
						enableTray: v !== "status",
					};
					settingTab.applyNotificationsUpdateLight();
				});
		})
		.addButton((btn) => {
			btn.setButtonText(t("Update now"));
			btn.onClick(async () => {
				await settingTab.plugin.notificationManager?.triggerDailySummary();
			});
		});
}
