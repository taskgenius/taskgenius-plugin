export type DatePrecision = "date" | "datetime";
export function parseOptionalDateTime(value: string): { timestamp: number; precision: DatePrecision } | null {
	const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
	if (!match) return null;
	const [,y,m,d,h,min] = match, date = new Date(+y,+m-1,+d,+(h||0),+(min||0));
	if (date.getFullYear()!==+y || date.getMonth()!==+m-1 || date.getDate()!==+d || date.getHours()!==+(h||0) || date.getMinutes()!==+(min||0)) return null;
	return { timestamp: date.getTime(), precision: h === undefined ? "date" : "datetime" };
}
export function formatOptionalDateTime(value: number | string | Date | undefined, precision?: DatePrecision): string {
	if (value == null || value === "") return "";
	const date = value instanceof Date ? value : typeof value === "string" && parseOptionalDateTime(value) ? new Date(parseOptionalDateTime(value)!.timestamp) : new Date(value);
	if (!Number.isFinite(date.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2,"0");
	const day = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
	return precision === "datetime" || precision !== "date" && (date.getHours()!==0 || date.getMinutes()!==0) ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

export function taskDatePrecisions(task: { originalMarkdown?: string; metadata?: { datePrecision?: Record<string, DatePrecision | undefined> } }): Record<string, DatePrecision | undefined> {
	const result = { ...task.metadata?.datePrecision };
	const raw = task.originalMarkdown || "";
	for (const [field, marker, key] of [["dueDate","📅","due"],["startDate","🛫|🚀","start"],["scheduledDate","⏳","scheduled"],["completedDate","✅","completion"],["cancelledDate","❌","cancelled"]]) {
		const match = raw.match(new RegExp(`(?:${marker}|\\[${key}::)\\s*(\\d{4}-\\d{2}-\\d{2}(?:[ T]\\d{1,2}:\\d{2})?)`));
		if (match) result[field] = /\d{1,2}:\d{2}/.test(match[1]) ? "datetime" : "date";
	}
	return result;
}
