export type ProjectDateEdge = "move" | "start" | "end";
export function projectDateChange(start: number, end: number, days: number, edge: ProjectDateEdge): { startDate: string; dueDate: string } {
	const from = new Date(start), to = new Date(end);
	from.setHours(0, 0, 0, 0); to.setHours(0, 0, 0, 0);
	if (edge !== "end") from.setDate(from.getDate() + days);
	if (edge !== "start") to.setDate(to.getDate() + days);
	if (from > to) { if (edge === "start") from.setTime(to.getTime()); else to.setTime(from.getTime()); }
	const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	return { startDate: key(from), dueDate: key(to) };
}
