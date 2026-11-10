import { debounce, type App, type Component } from "obsidian";
import type { HabitStore } from "../habit-store";

/** Repaint only when an update changes the data shown by the habit cards. */
export function watchHabitFiles(
	owner: Component,
	app: App,
	store: HabitStore,
	invalidate: (path: string) => void,
	render: () => void,
): void {
	const snapshot = () => new Map(store.getHabits().map(habit => [habit.path, JSON.stringify(habit)]));
	let previous = snapshot();
	const refresh = debounce(() => {
		const current = snapshot();
		const changedPaths = [...new Set([...previous.keys(), ...current.keys()])]
			.filter(path => current.get(path) !== previous.get(path));
		if (!changedPaths.length) return;
		previous = current;
		for (const path of changedPaths) invalidate(path);
		render();
	}, 250, true);
	const changed = (path: string) => {
		if (store.isHabitFile(path)) refresh();
	};
	owner.registerEvent(app.metadataCache.on("changed", file => changed(file.path)));
	owner.registerEvent(app.vault.on("create", file => changed(file.path)));
	owner.registerEvent(app.vault.on("delete", file => changed(file.path)));
	owner.registerEvent(app.vault.on("rename", (file, oldPath) => {
		changed(oldPath);
		changed(file.path);
	}));
	owner.register(() => refresh.cancel?.());
}
