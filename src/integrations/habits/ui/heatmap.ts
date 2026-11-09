import "./chart-setup";
import { Chart, type ChartConfiguration } from "chart.js";
import type { MatrixDataPoint } from "chartjs-chart-matrix";
import { addDays, toDateKey } from "../utils";

export interface HeatmapCell {
	date: Date;
	key: string;
	/** False for calendar padding days outside the requested month. */
	inRange: boolean;
}

export interface HeatmapGrid {
	/** Column category labels. */
	xLabels: string[];
	/** Row category labels, oldest/top first (the chart reverses the y-axis). */
	yLabels: string[];
	/** `cells[row][col]`: row indexes {@link yLabels}, col indexes {@link xLabels}. */
	cells: HeatmapCell[][];
}

/**
 * Flatten a grid into matrix data points, pairing each cell with the x/y
 * category label its position implies. `cellData` supplies everything else
 * (at least `v`, plus whatever a caller's point type needs for colouring
 * and tooltips).
 */
export function pointsFromGrid<T extends { v: number }>(
	grid: HeatmapGrid,
	cellData: (cell: HeatmapCell) => T,
): (T & { x: string; y: string })[] {
	return grid.cells.flatMap((row, r) =>
		row.map((cell, c) => ({
			x: grid.xLabels[c],
			y: grid.yLabels[r],
			...cellData(cell),
		})),
	);
}

/**
 * Calendar-style grid for the whole month containing `month`: weekdays
 * across (Monday first), weeks down. Leading/trailing days from the
 * neighbouring months fill out the grid and are marked `inRange: false`.
 */
export function monthGrid(month: Date): HeatmapGrid {
	const base = new Date(
		month.getFullYear(),
		month.getMonth(),
		month.getDate(),
	);
	const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
	const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
	const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
	const gridEnd = addDays(monthEnd, 6 - ((monthEnd.getDay() + 6) % 7));
	const weeks =
		Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000 / 7) + 1;

	const xLabels: string[] = [];
	for (let day = 0; day < 7; day++) {
		xLabels.push(
			addDays(gridStart, day).toLocaleDateString(undefined, {
				weekday: "short",
			}),
		);
	}

	const yLabels: string[] = [];
	const cells: HeatmapCell[][] = [];
	for (let week = 0; week < weeks; week++) {
		yLabels.push(
			addDays(gridStart, week * 7).toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
			}),
		);
		const row: HeatmapCell[] = [];
		for (let day = 0; day < 7; day++) {
			const date = addDays(gridStart, week * 7 + day);
			row.push({
				date,
				key: toDateKey(date),
				inRange: date.getMonth() === base.getMonth(),
			});
		}
		cells.push(row);
	}
	return { xLabels, yLabels, cells };
}

/**
 * GitHub-style grid of `weeks` Monday-start weeks starting at `gridStart`:
 * weeks across (oldest to newest, left to right), weekdays down (Monday to
 * Sunday, top to bottom). `inRange` is only false where a caller marks it
 * (e.g. {@link yearGrid} using it for days outside the target year).
 */
function buildWeekGrid(
	gridStart: Date,
	weeks: number,
	inRange: (date: Date) => boolean = () => true,
): HeatmapGrid & { monthTicks: string[] } {
	const xLabels: string[] = [];
	const monthTicks: string[] = [];
	let lastMonth = -1;
	for (let week = 0; week < weeks; week++) {
		const weekStart = addDays(gridStart, 7 * week);
		// Unique per column; the visible tick text comes from monthTicks
		// instead, so this value never has to be human-readable.
		xLabels.push(toDateKey(weekStart));
		const month = weekStart.getMonth();
		monthTicks.push(
			month !== lastMonth
				? weekStart.toLocaleDateString(undefined, { month: "short" })
				: "",
		);
		lastMonth = month;
	}

	const yLabels: string[] = [];
	const cells: HeatmapCell[][] = [];
	for (let day = 0; day < 7; day++) {
		yLabels.push(
			addDays(gridStart, day).toLocaleDateString(undefined, {
				weekday: "short",
			}),
		);
		const row: HeatmapCell[] = [];
		for (let week = 0; week < weeks; week++) {
			const date = addDays(gridStart, week * 7 + day);
			row.push({ date, key: toDateKey(date), inRange: inRange(date) });
		}
		cells.push(row);
	}
	return { xLabels, yLabels, cells, monthTicks };
}

/**
 * Rolling GitHub-style grid of `weeks` Monday-start weeks ending with the
 * week containing `end`.
 */
export function weekGrid(
	end: Date,
	weeks: number,
): HeatmapGrid & { monthTicks: string[] } {
	const base = new Date(end.getFullYear(), end.getMonth(), end.getDate());
	const thisMonday = addDays(base, -((base.getDay() + 6) % 7));
	const gridStart = addDays(thisMonday, -7 * (weeks - 1));
	return buildWeekGrid(gridStart, weeks);
}

/**
 * GitHub-style grid spanning the whole calendar year `year` (1 January to
 * 31 December). Leading/trailing days from the neighbouring years fill out
 * the grid and are marked `inRange: false`.
 */
export function yearGrid(year: number): HeatmapGrid & { monthTicks: string[] } {
	const yearStart = new Date(year, 0, 1);
	const yearEnd = new Date(year, 11, 31);
	const gridStart = addDays(yearStart, -((yearStart.getDay() + 6) % 7));
	const gridEnd = addDays(yearEnd, 6 - ((yearEnd.getDay() + 6) % 7));
	const weeks =
		Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000 / 7) + 1;
	return buildWeekGrid(
		gridStart,
		weeks,
		(date) => date.getFullYear() === year,
	);
}

export interface HeatmapColors {
	background: string[];
	border: string[];
	borderWidth: number[];
}

/**
 * Mount a Chart.js matrix chart as a titled section inside `containerEl`,
 * shared by the per-habit and whole-vault heatmaps. `points` must line up
 * 1:1 with `colors.background`/`border`/`borderWidth`.
 */
export function mountHeatmapChart<P extends MatrixDataPoint>(
	containerEl: HTMLElement,
	charts: Chart[],
	title: string,
	points: P[],
	xLabels: string[],
	yLabels: string[],
	colors: HeatmapColors,
	tooltipLines: (point: P) => string[],
	textColor: string,
	/** Column tick text, e.g. only the weeks where the month changes. */
	xTickLabels?: string[],
): void {
	const config: ChartConfiguration<"matrix", P[], string> = {
		type: "matrix",
		data: {
			datasets: [
				{
					data: points,
					backgroundColor: colors.background,
					borderColor: colors.border,
					borderWidth: colors.borderWidth,
					borderRadius: 2,
					width: (ctx) => {
						const area = ctx.chart.chartArea;
						return area ? area.width / xLabels.length - 3 : 14;
					},
					height: (ctx) => {
						const area = ctx.chart.chartArea;
						return area ? area.height / yLabels.length - 3 : 14;
					},
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 300 },
			plugins: {
				legend: { display: false },
				tooltip: {
					displayColors: false,
					callbacks: {
						title: () => "",
						label: (ctx) => tooltipLines(ctx.dataset.data[ctx.dataIndex] as P),
					},
				},
			},
			scales: {
				x: {
					type: "category",
					labels: xLabels,
					offset: true,
					ticks: {
						color: textColor,
						maxRotation: 0,
						autoSkip: false,
						...(xTickLabels
							? {
									callback: (_value: unknown, index: number) =>
										xTickLabels[index] ?? "",
								}
							: {}),
					},
					grid: { display: false },
				},
				y: {
					type: "category",
					labels: yLabels,
					offset: true,
					reverse: true,
					ticks: { color: textColor, maxRotation: 0, autoSkip: false },
					grid: { display: false },
				},
			},
		},
	};

	const section = containerEl.createDiv({ cls: "habits-metrics-section" });
	section.createDiv({ cls: "habits-metrics-title", text: title });
	const wrap = section.createDiv({ cls: "habits-metrics-canvas" });
	const canvas = wrap.createEl("canvas");
	charts.push(new Chart(canvas, config));
}
