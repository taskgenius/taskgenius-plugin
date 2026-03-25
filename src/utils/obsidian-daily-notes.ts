import type { TFile } from "obsidian";
import {
	appHasDailyNotesPluginLoaded as dailyNotesPluginLoadedUnsafe,
	createDailyNote as createDailyNoteUnsafe,
	getAllDailyNotes as getAllDailyNotesUnsafe,
	getDailyNote as getDailyNoteUnsafe,
	getDailyNoteSettings as getDailyNoteSettingsUnsafe,
	getDateFromFile as getDateFromFileUnsafe,
} from "obsidian-daily-notes-interface";

export interface DailyNoteSettings {
	folder?: string;
	format?: string;
	template?: string;
}

export interface DailyNoteEntry {
	file: TFile;
	date: unknown;
}

// The upstream package ships its own obsidian dependency, which produces a
// second TFile type. Centralize the boundary here so the rest of the codebase
// can stay on our local obsidian types.
export function appHasDailyNotesPluginLoaded(): boolean {
	return Boolean(dailyNotesPluginLoadedUnsafe());
}

export async function createDailyNote(date: unknown): Promise<TFile> {
	return (await createDailyNoteUnsafe(date as never)) as unknown as TFile;
}

export function getAllDailyNotes(): DailyNoteEntry[] {
	return getAllDailyNotesUnsafe() as unknown as DailyNoteEntry[];
}

export function getDailyNote(
	date: unknown,
	dailyNotes: DailyNoteEntry[],
): TFile | null {
	const file = getDailyNoteUnsafe(
		date as never,
		dailyNotes as never,
	) as unknown as TFile | null | undefined;
	return file ?? null;
}

export function getDailyNoteSettings(): DailyNoteSettings {
	return getDailyNoteSettingsUnsafe() as unknown as DailyNoteSettings;
}

export function getDateFromFile(file: TFile, granularity?: string): any {
	return getDateFromFileUnsafe(
		file as never,
		granularity as never,
	) as any;
}
