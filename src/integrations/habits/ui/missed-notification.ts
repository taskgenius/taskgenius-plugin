import { App, Component, setIcon } from "obsidian";
import { HabitStore } from "../habit-store";
import { missedInstances } from "../stats";
import { MissedHabitsModal } from "./missed-habits-modal";
import { t } from "../i18n";
export function renderMissedNotification(root: HTMLElement, owner: Component, app: App, store: HabitStore, refresh: () => void): void {
	const habits = store.getHabits(), count = missedInstances(habits, new Date()).length;
	if (!count) return;
	const button = root.createEl("button", { cls: "clickable-icon habits-missed-button", attr: { "aria-label": t("Missed habits"), title: t("Missed habits") } });
	setIcon(button, "bell"); button.createSpan({ text: String(count), cls: "habits-missed-badge" });
	owner.registerDomEvent(button, "click", () => new MissedHabitsModal(app, store, habits, refresh).open());
}
