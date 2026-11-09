import { normalizePath, parseYaml, stringifyYaml, type App } from "obsidian";
import type { HabitProps } from "@/types/habit-card";
import { DEFAULT_FRONTMATTER_KEYS, type HabitsPluginSettings } from "./settings";
import { sanitizeFileName } from "./utils";

export interface LegacyHabitPlan {
	identity: string;
	name: string;
	type: "binary" | "repetition";
	target: number;
	unit: string;
	records: Record<string, number>;
	source: HabitProps;
}

/** Pure conversion: retain the complete original record beside numeric statistics. */
export function planLegacyHabits(habits: HabitProps[]): LegacyHabitPlan[] {
	return habits.flatMap(habit => {
		const events = habit.type === "scheduled" ? habit.events.map(event => event.name) : [""];
		return events.map(event => {
			const records: Record<string, number> = {};
			for (const [date, value] of Object.entries(habit.completions ?? {})) {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
				if (habit.type === "scheduled") {
					// A scheduled event is completed by presence, even with an empty detail.
					if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, event)) records[date] = 1;
				} else if (habit.type === "daily") {
					if (value !== null && value !== false && value !== "" && value !== undefined && value !== 0) records[date] = 1;
				} else if (typeof value === "number" && Number.isFinite(value)) records[date] = value;
			}
			return {
				identity: JSON.stringify([habit.id, event]),
				name: event ? `${habit.name} — ${event}` : habit.name,
				type: habit.type === "count" || habit.type === "mapping" ? "repetition" as const : "binary" as const,
				target: habit.type === "count" ? Math.max(0, habit.min ?? 1) : 1,
				unit: habit.type === "count" ? habit.countUnit ?? "" : "",
				records,
				source: JSON.parse(JSON.stringify(habit)),
			};
		});
	});
}

function suffix(identity: string): string {
	let hash = 2166136261;
	for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
	return (hash >>> 0).toString(16);
}

/** Create-only import through Obsidian's vault API; never overwrite any existing file. */
export async function importLegacyHabits(app: App, settings: HabitsPluginSettings, plans: LegacyHabitPlan[]): Promise<{created: number; skipped: number}> {
	const folder = normalizePath(settings.habitsFolder.trim());
	if (!folder || folder === "." || folder.split("/").some(part => part === "..")) throw new Error("Invalid habits folder");
	let path = "";
	for (const part of folder.split("/")) {
		path = path ? `${path}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(path)) await app.vault.createFolder(path);
	}
	const k = {...DEFAULT_FRONTMATTER_KEYS, ...settings.frontmatterKeys};
	const imported = new Set<string>();
	// Read actual content so a renamed import remains idempotent, without relying
	// on a metadata event arriving before a second import starts.
	for (const file of app.vault.getMarkdownFiles()) {
		if (!file.path.startsWith(`${folder}/`)) continue;
		const text = await app.vault.read(file);
		const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
		if (!match) continue;
		try {
			const identity = parseYaml(match[1])?.taskGeniusLegacy?.identity;
			if (typeof identity === "string") imported.add(identity);
		} catch { /* Unrelated notes with malformed YAML are not modified. */ }
	}
	let created = 0, skipped = 0;
	for (const plan of plans) {
		if (imported.has(plan.identity)) { skipped++; continue; }
		const name = sanitizeFileName(plan.name).slice(0, 100) || "Habit";
		const filePath = normalizePath(`${folder}/${name} (TG-${suffix(plan.identity)}).md`);
		if (await app.vault.adapter.exists(filePath)) {
			const text = await app.vault.adapter.read(filePath);
			const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
			if (!match || parseYaml(match[1])?.taskGeniusLegacy?.identity !== plan.identity) throw new Error(`Import conflict: ${filePath}`);
			skipped++;
			continue;
		}
		const fm = {
			habit: true, [k.type]: plan.type, [k.frequency]: "daily", [k.target]: plan.target,
			[k.unit]: plan.unit, [k.icon]: plan.source.icon, [k.records]: plan.records,
			[k.startDate]: Object.keys(plan.records).sort()[0] ?? "",
			taskGeniusLegacy: {identity: plan.identity, importedAt: new Date().toISOString(), source: plan.source},
		};
		await app.vault.create(filePath, `---\n${stringifyYaml(fm)}---\n\n# ${plan.name.replace(/[\r\n]/g, " ")}\n\n\`\`\`tg-habit-metrics\n\`\`\`\n`);
		imported.add(plan.identity);
		created++;
	}
	return {created, skipped};
}
