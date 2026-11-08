import "./chart-setup";
import {
	App,
	debounce,
	Events,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	TFile,
} from "obsidian";
import { t } from "../i18n";
import { Chart } from "chart.js";
import type { MatrixDataPoint } from "chartjs-chart-matrix";
import { resolveColor, withAlpha } from "./color-utils";
import {
	monthGrid,
	mountHeatmapChart,
	pointsFromGrid,
	weekGrid,
	yearGrid,
	type HeatmapCell,
} from "./heatmap";
import type { HabitStore } from "../habit-store";
import type { HabitDefinition } from "../types";
import { isComplete, isDue, isPausedOn, trackingStartKey } from "../stats";
import { fromDateKey, toDateKey } from "../utils";

/** Width, in weeks, of the "past 6 months" tab. */
const HALF_YEAR_WEEKS = 26;

type AggregateView = "month" | "half-year" | "year";

/** A day's state on the whole-vault heatmap. */
type AggState = "future" | "outside" | "inactive" | "tracked";

interface AggPoint extends MatrixDataPoint {
	/** The day's completion rate, 0..1 (narrows the inherited optional `v`). */
	v: number;
	key: string;
	considered: number;
	completed: number;
	state: AggState;
}

/**
 * Renders a `habits-heatmap` code block: one heatmap of *every* habit's
 * combined completion, day by day — fully opaque on a perfect day, fading
 * out as fewer of that day's habits got done. Meant for a homepage or daily
 * note, not tied to any single habit note.
 */
export class HabitsHeatmap extends MarkdownRenderChild {
	private charts: Chart[] = [];
	/**
	 * Which tab is on screen. Set once from the block source on load, then
	 * mutated in place by tab clicks so a refresh triggered by our own
	 * source rewrite (see {@link persistView}) doesn't stomp it back.
	 */
	private view: AggregateView = "month";

	constructor(
		private app: App,
		private store: HabitStore,
		private pluginEvents: Events,
		private sourcePath: string,
		private source: string,
		root: HTMLElement,
		private ctx: MarkdownPostProcessorContext,
	) {
		super(root);
	}

	onload(): void {
		this.containerEl.addClass("habits-metrics");
		this.view = this.requestedView();
		// Same freshness contract as the dashboard and table: re-render
		// whenever any habit note changes on disk, from any pane.
		const requestRender = debounce(() => this.render(), 250, true);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.store.isHabitFile(file.path)) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (this.store.isHabitFile(file.path)) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.store.isHabitFile(file.path)) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (
					this.store.isHabitFile(file.path) ||
					this.store.isHabitFile(oldPath)
				) {
					requestRender();
				}
			}),
		);
		this.registerEvent(
			this.pluginEvents.on("settings-changed", () => {
				requestRender();
			}),
		);
		this.render();
	}

	onunload(): void {
		this.destroyCharts();
	}

	private destroyCharts(): void {
		for (const chart of this.charts) {
			chart.destroy();
		}
		this.charts = [];
	}

	/** The group named in the block source (`group: <name>`), if any. */
	private requestedGroup(): string {
		const match = /^\s*group\s*:\s*(.+?)\s*$/im.exec(this.source);
		if (!match) {
			return "";
		}
		return match[1].replace(/^["']|["']$/g, "");
	}

	/** The tab named in the block source (`view: half-year`/`view: year`), if any. */
	private requestedView(): AggregateView {
		const match = /^\s*view\s*:\s*(.+?)\s*$/im.exec(this.source);
		const value = match?.[1].toLowerCase();
		return value === "half-year" || value === "year" ? value : "month";
	}

	private render(): void {
		this.destroyCharts();
		const root = this.containerEl;
		root.empty();

		const tracked = this.store.getHabits().filter((habit) => !habit.stopped);
		const group = this.requestedGroup();
		const habits = group
			? tracked.filter(
					(habit) => habit.group.toLowerCase() === group.toLowerCase(),
				)
			: tracked;

		if (habits.length === 0) {
			root.createEl("p", {
				cls: "habits-metrics-empty",
				text: group
					? t('No habits in the "{group}" group.', { group })
					: t("Add a habit to see its heatmap here."),
			});
			return;
		}

		this.renderViewTabs();
		const today = new Date();
		if (this.view === "half-year") {
			this.renderWeekHeatmap(
				habits,
				weekGrid(today, HALF_YEAR_WEEKS),
				t("Last {n} weeks", { n: HALF_YEAR_WEEKS }),
				today,
			);
		} else if (this.view === "year") {
			const year = today.getFullYear();
			this.renderWeekHeatmap(
				habits,
				yearGrid(year),
				t("{year} heatmap", { year: String(year) }),
				today,
			);
		} else {
			this.renderMonthHeatmap(habits, today);
		}
	}

	/** Charts/Month/Half-year/Year tab bar. */
	private renderViewTabs(): void {
		const tabs = this.containerEl.createDiv({ cls: "habits-metrics-tabs" });
		const makeTab = (view: AggregateView, label: string): void => {
			const button = tabs.createEl("button", {
				cls: "habits-metrics-tab",
				text: label,
				attr: { type: "button" },
			});
			button.toggleClass("is-active", this.view === view);
			this.registerDomEvent(button, "click", () => {
				if (this.view === view) {
					return;
				}
				this.view = view;
				void this.persistView(view);
				this.render();
			});
		};
		makeTab("month", t("This month"));
		makeTab("half-year", t("Past 6 months"));
		makeTab("year", t("This year"));
	}

	/**
	 * Save the chosen tab onto the block's own `view:` source line, so it
	 * reopens on the same tab next time. Best-effort: if the section can't
	 * be located (e.g. the block is mid-edit), the in-memory tab selection
	 * still stands, it just won't survive a reload.
	 */
	private async persistView(view: AggregateView): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.sourcePath);
		if (!(file instanceof TFile)) {
			return;
		}
		const info = this.ctx.getSectionInfo(this.containerEl);
		if (!info) {
			return;
		}
		const { lineStart, lineEnd } = info;
		await this.app.vault.process(file, (content) => {
			const lines = content.split("\n");
			if (lines[lineStart] === undefined || lines[lineEnd] === undefined) {
				return content;
			}
			const inner = lines
				.slice(lineStart + 1, lineEnd)
				.filter((line) => !/^\s*view\s*:/i.test(line));
			if (view !== "month") {
				inner.push(`view: ${view}`);
			}
			return [
				...lines.slice(0, lineStart + 1),
				...inner,
				...lines.slice(lineEnd),
			].join("\n");
		});
	}

	/**
	 * How many of `habits` count toward `key`, and how many of those are
	 * complete — a habit that isn't due, hasn't started yet, or is paused
	 * on this day doesn't count either way. Mirrors stats.ts's `perfectDays`
	 * per-day filter, just fractional instead of all-or-nothing.
	 */
	private dayCompletion(
		habits: HabitDefinition[],
		startKeys: string[],
		date: Date,
		key: string,
	): { considered: number; completed: number } {
		let considered = 0;
		let completed = 0;
		habits.forEach((habit, i) => {
			if (key < startKeys[i] || !isDue(habit, date) || isPausedOn(habit, key)) {
				return;
			}
			considered++;
			if (isComplete(habit, key)) {
				completed++;
			}
		});
		return { considered, completed };
	}

	/**
	 * A grid cell's aggregate state, driving both fill and tooltip. Deliberately
	 * omits `x`/`y` — {@link pointsFromGrid} fills those in from the cell's grid
	 * position, and a spread here would clobber them.
	 */
	private cellState(
		cell: HeatmapCell,
		habits: HabitDefinition[],
		startKeys: string[],
		todayKey: string,
	): Omit<AggPoint, "x" | "y"> {
		if (!cell.inRange) {
			return {
				v: 0,
				key: cell.key,
				considered: 0,
				completed: 0,
				state: "outside",
			};
		}
		if (cell.key > todayKey) {
			return {
				v: 0,
				key: cell.key,
				considered: 0,
				completed: 0,
				state: "future",
			};
		}
		const { considered, completed } = this.dayCompletion(
			habits,
			startKeys,
			cell.date,
			cell.key,
		);
		return {
			v: considered > 0 ? completed / considered : 0,
			key: cell.key,
			considered,
			completed,
			state: considered > 0 ? "tracked" : "inactive",
		};
	}

	/** Calendar-style heatmap of the current month. */
	private renderMonthHeatmap(habits: HabitDefinition[], today: Date): void {
		const todayKey = toDateKey(today);
		const startKeys = habits.map((habit) => trackingStartKey(habit, today));
		const grid = monthGrid(today);
		const points = pointsFromGrid(grid, (cell) =>
			this.cellState(cell, habits, startKeys, todayKey),
		);
		const title = t("{month} heatmap", {
			month: today.toLocaleDateString(undefined, {
				month: "long",
				year: "numeric",
			}),
		});
		this.renderHeatmapChart(points, grid.xLabels, grid.yLabels, title);
	}

	/** GitHub-style week-grid heatmap shared by the half-year and year tabs. */
	private renderWeekHeatmap(
		habits: HabitDefinition[],
		grid: ReturnType<typeof weekGrid>,
		title: string,
		today: Date,
	): void {
		const todayKey = toDateKey(today);
		const startKeys = habits.map((habit) => trackingStartKey(habit, today));
		const points = pointsFromGrid(grid, (cell) =>
			this.cellState(cell, habits, startKeys, todayKey),
		);
		this.renderHeatmapChart(
			points,
			grid.xLabels,
			grid.yLabels,
			title,
			grid.monthTicks,
		);
	}

	/** Cell fill: transparent accent whose opacity is the day's completion rate. */
	private fill(state: AggState, rate: number, accent: string, neutral: string): string {
		switch (state) {
			case "tracked":
				// A floor keeps a 0%-but-tracked day visibly different from a
				// day nothing was due at all, while a perfect day (rate 1)
				// lands at full, unmixed accent opacity.
				return withAlpha(accent, Math.max(0.12, rate));
			case "future":
				return "transparent";
			// Days nothing was due and calendar padding outside the current
			// month both read as "nothing happened here" — fainter than even
			// a tracked-but-missed day, so a miss still stands out more.
			case "outside":
			case "inactive":
				return withAlpha(neutral, 0.2);
		}
	}

	private border(state: AggState, neutral: string): { color: string; width: number } {
		if (state === "future") {
			return { color: withAlpha(neutral, 0.8), width: 1 };
		}
		return { color: "transparent", width: 0 };
	}

	private tooltip(point: AggPoint): string[] {
		const date = fromDateKey(point.key);
		const dateLabel = date
			? date.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
					year: "numeric",
				})
			: point.key;
		switch (point.state) {
			case "future":
				return [dateLabel, t("Upcoming")];
			case "outside":
				return [dateLabel];
			case "inactive":
				return [dateLabel, t("No habits due")];
			default: {
				const pct = Math.round((point.completed / point.considered) * 100);
				const line = t("{completed}/{considered} habits · {pct}%", {
					completed: point.completed,
					considered: point.considered,
					pct,
				});
				return point.completed === point.considered
					? [dateLabel, line, t("Perfect day")]
					: [dateLabel, line];
			}
		}
	}

	private renderHeatmapChart(
		points: AggPoint[],
		xLabels: string[],
		yLabels: string[],
		title: string,
		xTickLabels?: string[],
	): void {
		const accent = resolveColor(
			this.containerEl,
			"",
			"var(--interactive-accent)",
		);
		const neutral = resolveColor(
			this.containerEl,
			"",
			"var(--background-modifier-border)",
		);
		const text = resolveColor(this.containerEl, "", "var(--text-muted)");

		mountHeatmapChart(
			this.containerEl,
			this.charts,
			title,
			points,
			xLabels,
			yLabels,
			{
				background: points.map((p) =>
					this.fill(p.state, p.v, accent, neutral),
				),
				border: points.map((p) => this.border(p.state, neutral).color),
				borderWidth: points.map((p) => this.border(p.state, neutral).width),
			},
			(point) => this.tooltip(point),
			text,
			xTickLabels,
		);
	}
}
