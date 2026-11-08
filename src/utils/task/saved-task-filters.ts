import type { PresetTaskFilter } from "@/common/setting-definition";
import { t } from "@/translations/helper";

export type FilterCondition = { field: string; operator: string; value: string };
export function savedTaskFilters(custom: PresetTaskFilter[] = []): PresetTaskFilter[] {
	const merged = new Map(defaultSavedFilters().map(filter => [filter.id, filter]));
	for (const filter of custom) merged.set(filter.id, filter);
	return [...merged.values()];
}
export function conditionsQuery(conditions: FilterCondition[], relation: "AND" | "OR"): string {
	return conditions.filter(row => row.value.trim()).map(row => {
		const value = row.value.trim();
		return `${row.field}:${row.operator === "contains" ? "" : row.operator}${/^[^\s"]+$/.test(value) ? value : JSON.stringify(value)}`;
	}).join(` ${relation} `);
}
export function defaultSavedFilters(): PresetTaskFilter[] {
	return [["todo", "To do", "status", "!=", "completed", "status", "!=", "abandoned"],
		["completed", "Completed", "status", "=", "completed"],
		["abandoned", "Abandoned", "status", "=", "abandoned"],
		["month", "This month's tasks", "date", "=", "this-month"]].map(([id, name, field, operator, value, field2, operator2, value2]) => {
		const conditions: FilterCondition[] = [{ field, operator, value }];
		if (field2) conditions.push({ field: field2, operator: operator2, value: value2 });
		return { id: `builtin-${id}`, name: t(name), options: { includeCompleted: true, includeInProgress: true, includeAbandoned: true, includeNotStarted: true, includePlanned: true,
			includeParentTasks: false, includeChildTasks: false, includeSiblingTasks: false,
			conditions, relation: "AND", advancedFilterQuery: conditionsQuery(conditions, "AND"), filterMode: "INCLUDE" } };
	});
}
