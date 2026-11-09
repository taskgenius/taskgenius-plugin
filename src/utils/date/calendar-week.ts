/** January 1 always belongs to week 1; weeks start on the configured weekday. */
export function calendarWeekNumber(date: Date, firstDay = 1): number {
	const year = date.getFullYear();
	const day = Math.floor((Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 1)) / 86400000);
	const offset = (new Date(year, 0, 1).getDay() - firstDay + 7) % 7;
	return Math.floor((day + offset) / 7) + 1;
}
