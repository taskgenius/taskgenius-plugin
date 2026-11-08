/** Calculation shared by the native check-in page and its settings page. */
export interface DailyHabitInput {
	name: string;
	path: string;
	frontmatter: Record<string, any>;
}
export interface HabitPointSummary {
	name: string;
	path: string;
	rate: number;
	units: number;
	points: number;
	todayPoints: number;
	entries: number;
	source: "habit" | "rule" | "default";
}
export const pointNumber = (value: unknown, fallback = 0): number => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};
export const roundPoints = (value: number): number => Math.round((value + Number.EPSILON) * 10000) / 10000;
export function pointDate(value: unknown): string {
	if (value instanceof Date) return localPointDate(value);
	const text = String(value ?? "").trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
	const parsed = new Date(text);
	return Number.isNaN(parsed.getTime()) ? text : localPointDate(parsed);
}
export function localPointDate(date = new Date()): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function periodKey(day: string, frequency: string): string {
	if (/Monthly$|^monthly$/.test(frequency)) return day.slice(0, 7);
	if (/Weekly$|^weekly$/.test(frequency)) {
		const [y, m, d] = day.split("-").map(Number);
		const date = new Date(Date.UTC(y, m - 1, d));
		date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
		return date.toISOString().slice(0, 10);
	}
	return day;
}
export function calculateDailyHabitPoints(
	habits: DailyHabitInput[], data: Record<string, any>, today = localPointDate(),
	keys: Record<string, string> = {},
): HabitPointSummary[] {
	const defaults = data.defaultPointRule ?? {};
	const rules = Array.isArray(data.pointRules) ? data.pointRules : [];
	return habits.flatMap(habit => {
		const fm = habit.frontmatter;
		const rule = rules.find((entry: any) => (entry.habit ?? entry.name) === habit.name);
		const hasOverride = Object.prototype.hasOwnProperty.call(fm, "bravoPoints");
		if (!hasOverride && !rule && defaults.enabled === false) return [];
		const rate = pointNumber(hasOverride ? fm.bravoPoints : rule ? rule.baseRate ?? rule.pointsPerUnit : defaults.baseRate ?? defaults.pointsPerUnit, hasOverride || rule ? 0 : 0.1);
		const records = Object.entries(fm[keys.records || "records"] || {}).map(([day, value]) => ({ day: pointDate(day), value: pointNumber(value) })).filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.day) && entry.value !== 0);
		const type = fm[keys.type || "type"];
		const count = type === "binary" || type !== "repetition" && !records.some(entry => Math.abs(entry.value) !== 1);
		const allowance = rate < 0 ? Math.max(0, pointNumber(fm[keys.target || "target"])) : 0;
		const frequency = String(fm[keys.frequency || "frequency"] || "daily");
		const total = (entries: typeof records) => {
			const periods = new Map<string, number>();
			for (const entry of entries) {
				const key = periodKey(entry.day, frequency);
				periods.set(key, (periods.get(key) || 0) + (count ? 1 : Math.max(0, entry.value)));
			}
			return roundPoints([...periods.values()].reduce((sum, units) => sum + Math.max(0, units - allowance) * rate, 0));
		};
		const points = total(records);
		return [{ name: habit.name, path: habit.path, rate, entries: records.length,
			units: roundPoints(records.reduce((sum, entry) => sum + (count ? 1 : entry.value), 0)),
			points, todayPoints: roundPoints(points - total(records.filter(entry => entry.day !== today))),
			source: hasOverride ? "habit" as const : rule ? "rule" as const : "default" as const }];
	});
}
export interface PointListItem { text: string; amount: number | null; index: number; }
/** Keep the original wording; the final signed number is only an action hint. */
export function pointListItems(values: unknown): PointListItem[] {
	return (Array.isArray(values) ? values : []).map((value, index) => {
		const text = String(value);
		const match = text.match(/([+\-−])\s*(\d+(?:\.\d+)?)\s*$/);
		return { text, index, amount: match ? (match[1] === "+" ? 1 : -1) * Number(match[2]) : null };
	});
}
