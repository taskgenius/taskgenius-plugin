/** Parser and inheritance settings that require rebuilding existing tasks. */
export const INDEX_SETTING_FIELDS = [
	"taskStatuses", "fileParsingConfig", "timeParsing", "preferMetadataFormat",
	"enableCustomDateFormats", "customDateFormats", "projectTagPrefix",
	"contextTagPrefix", "areaTagPrefix", "useDailyNotePathAsDate",
	"dailyNoteFormat", "useAsDateType", "dailyNotePath", "ignoreHeading", "focusHeading",
	"fileSource.recognitionStrategies", "fileSource.fileTaskProperties",
	"fileSource.relationships", "fileMetadataInheritance", "projectConfig",
] as const;

/** Capture values, rather than references, because settings are edited in place. */
export function snapshotIndexSettings(settings: unknown): string {
	return JSON.stringify(INDEX_SETTING_FIELDS.map(field => {
		let value = settings;
		for (const key of field.split(".")) {
			value = value && typeof value === "object"
				? (value as Record<string, unknown>)[key] : undefined;
		}
		return value;
	}));
}
