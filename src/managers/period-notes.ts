import { App, TFile, normalizePath, moment } from "obsidian";
export type NotePeriod = "daily" | "weekly" | "monthly" | "yearly";
const defaults = { daily: "YYYY-MM-DD", weekly: "GGGG-[W]WW", monthly: "YYYY-MM", yearly: "YYYY" };
const pending = new WeakMap<App, Map<string, Promise<TFile>>>();
async function readConfig(app: App, file: string): Promise<any> {
	try { return JSON.parse(await app.vault.adapter.read(`${app.vault.configDir}/${file}`)); } catch { return {}; }
}
/** Use the user's existing Periodic Notes / Calendar / Daily Notes folders and templates. */
export async function openPeriodNote(app: App, period: NotePeriod, date: Date): Promise<TFile> {
	const plugins = (app as any).plugins;
	const settings = plugins?.getPlugin?.("periodic-notes")?.settings || await readConfig(app, "plugins/periodic-notes/data.json");
	let config = settings[period];
	if (!config || config.enabled === false) {
		if (period === "daily") config = (app as any).internalPlugins?.getPluginById?.("daily-notes")?.instance?.options || await readConfig(app, "daily-notes.json");
		else if (period === "weekly") { const calendar = await readConfig(app, "plugins/calendar/data.json"); config = { format: calendar.weeklyNoteFormat, folder: calendar.weeklyNoteFolder, template: calendar.weeklyNoteTemplate }; }
	}
	config ||= {};
	const day = moment(date), title = day.format(config.format || defaults[period]);
	const path = normalizePath(`${config.folder ? config.folder + "/" : ""}${title}.md`);
	if (path.split("/").some(segment => segment === "..") || /^[A-Za-z]:/.test(path)) throw new Error("Invalid periodic note path");
	let operations = pending.get(app); if (!operations) { operations = new Map(); pending.set(app, operations); }
	let operation = operations.get(path);
	if (!operation) {
		operation = (async () => {
			const existing = app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFile) return existing;
			if (existing) throw new Error("The periodic note path is occupied by a folder");
			let content = "";
			if (config.template) {
				const templatePath = normalizePath(String(config.template).replace(/\.md$/i, "") + ".md");
				const template = app.vault.getAbstractFileByPath(templatePath);
				if (!(template instanceof TFile)) throw new Error(`Template not found: ${templatePath}`);
				content = await app.vault.read(template);
				content = content.replace(/\{\{date(?::([^}]+))?\}\}/gi, (_match, format) => day.format(format || "YYYY-MM-DD"))
					.replace(/\{\{time(?::([^}]+))?\}\}/gi, (_match, format) => moment().format(format || "HH:mm"))
					.replace(/\{\{title\}\}/gi, () => title.split("/").pop() || title);
			}
			const parts = path.split("/"); parts.pop();
			for (let index = 1; index <= parts.length; index++) {
				const folder = parts.slice(0, index).join("/");
				if (!app.vault.getAbstractFileByPath(folder)) { try { await app.vault.createFolder(folder); } catch (error) { if (!app.vault.getAbstractFileByPath(folder)) throw error; } }
			}
			const raced = app.vault.getAbstractFileByPath(path);
			return raced instanceof TFile ? raced : app.vault.create(path, content);
		})();
		operations.set(path, operation);
	}
	try { const file = await operation; await app.workspace.getLeaf(false).openFile(file); return file; }
	finally { operations.delete(path); }
}
