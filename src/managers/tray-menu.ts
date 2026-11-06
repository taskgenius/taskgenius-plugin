import type TaskProgressBarPlugin from "@/index";
import type { Task } from "@/types/task";

export class TrayMenuBuilder {
	constructor(private plugin: TaskProgressBarPlugin) {}

	private getElectron(): any | null {
		try {
			const injected =
				(window as any).electron || (globalThis as any).electron;
			if (injected) return injected;
			const req = (window as any).require || (globalThis as any).require;
			return req ? req("electron") : null;
		} catch {
			return null;
		}
	}

	private isIcsBadge(task: Task): boolean {
		try {
			const srcType =
				(task as any)?.metadata?.source?.type ??
				(task as any)?.source?.type;
			const isIcs = srcType === "ics";
			const isBadge =
				(task as any)?.badge === true ||
				(task as any)?.icsEvent?.source?.showType === "badge";
			return !!(isIcs && isBadge);
		} catch {
			return false;
		}
	}

	private async buildDueTasks(limit = 5): Promise<Task[]> {
		const df = this.plugin.dataflowOrchestrator as any;
		const queryAPI = df?.getQueryAPI?.();
		if (!queryAPI) return [];

		// Get all tasks with due dates (including overdue), exclude ICS badge only
		const allTasks = (await queryAPI.getAllTasks()) as Task[];
		const today = new Date();
		today.setHours(23, 59, 59, 999); // End of today

		// Filter: due today or overdue, not completed, exclude ICS badge only
		const dueTasks = allTasks.filter((t) => {
			if (t.completed || !t.metadata?.dueDate) return false;
			if (this.isIcsBadge(t)) return false;
			return t.metadata.dueDate <= today.getTime();
		});

		// Sort by due date
		dueTasks.sort(
			(a, b) => (a.metadata?.dueDate || 0) - (b.metadata?.dueDate || 0)
		);

		return dueTasks.slice(0, limit);
	}

	async applyToTray(
		tray: any,
		actions: {
			openVault: () => void;
			openTaskView: () => void;
			openTask: (task: Task) => Promise<void>;
			completeTask: (id: string) => Promise<void>;
			postponeTask: (task: Task, offsetMs: number) => Promise<void>;
			setPriority: (task: Task, level: number) => Promise<void>;
			pickCustomDate: (task: Task) => Promise<void>;
			sendDaily: () => Promise<void>;
			quickCapture: () => Promise<void>;
		}
	): Promise<void> {
		const electron = this.getElectron();
		const Menu = electron?.Menu || electron?.remote?.Menu;
		if (!Menu || !tray) return;
		const tasks = await this.buildDueTasks(7);
		const template: any[] = [];
		template.push({
			label: `Vault: ${this.plugin.app.vault.getName()}`,
			enabled: false,
		});
		template.push({
			label: "Open Vault",
			click: () => actions.openVault(),
		});
		template.push({
			label: "Open Task Genius",
			click: () => actions.openTaskView(),
		});
		template.push({ type: "separator" });
		template.push({
			label: "Quick Capture...",
			accelerator: "CmdOrCtrl+Shift+Q",
			click: () => actions.quickCapture(),
		});
		template.push({ type: "separator" });

		for (const t of tasks) {
			const taskLabel =
				t.content.length > 50
					? t.content.slice(0, 50) + "…"
					: t.content;
			template.push({
				label: taskLabel,
				submenu: [
					{ label: "Open", click: () => actions.openTask(t) },
					{
						label: "Complete",
						click: () => actions.completeTask(t.id),
					},
					{ type: "separator" },
					{
						label: "Snooze 1d",
						click: () =>
							actions.postponeTask(t, 1 * 24 * 60 * 60_000),
					},
					{
						label: "Snooze 2d",
						click: () =>
							actions.postponeTask(t, 2 * 24 * 60 * 60_000),
					},
					{
						label: "Snooze 3d",
						click: () =>
							actions.postponeTask(t, 3 * 24 * 60 * 60_000),
					},
					{
						label: "Snooze 1w",
						click: () =>
							actions.postponeTask(t, 7 * 24 * 60 * 60_000),
					},
					{
						label: "Custom date…",
						click: () => actions.pickCustomDate(t),
					},
					{ type: "separator" },
					{
						label: "Priority",
						submenu: [
							{
								label: "Highest",
								click: () => actions.setPriority(t, 5),
							},
							{
								label: "High",
								click: () => actions.setPriority(t, 4),
							},
							{
								label: "Medium",
								click: () => actions.setPriority(t, 3),
							},
							{
								label: "Low",
								click: () => actions.setPriority(t, 2),
							},
							{
								label: "Lowest",
								click: () => actions.setPriority(t, 1),
							},
						],
					},
				],
			});
		}

		if (tasks.length === 0)
			template.push({ label: "No tasks due today", enabled: false });
		template.push({ type: "separator" });
		template.push({
			label: "Refresh",
			click: () => {
				/* handled by caller update */
			},
		});

		const menu = Menu.buildFromTemplate(template);
		try {
			tray.setContextMenu(menu);
		} catch {}
	}
}
