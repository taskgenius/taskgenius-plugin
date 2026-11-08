import {
	App,
	debounce,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	setIcon,
	TFile,
} from "obsidian";
import "./chart-setup";
import { t } from "../i18n";
import {
	Chart,
	type ChartConfiguration,
	type ChartDataset,
} from "chart.js";
import type { MatrixDataPoint } from "chartjs-chart-matrix";
import { contrastColor, resolveColor, withAlpha } from "./color-utils";
import { monthGrid, mountHeatmapChart, pointsFromGrid, weekGrid } from "./heatmap";
import type { HabitStore } from "../habit-store";
import type { HabitDefinition, HabitFrequency } from "../types";
import {
	currentStreak,
	isActive,
	isComplete,
	isDue,
	isFlexible,
	isFailedOn,
	isPausedOn,
	isSkippedOn,
	limitOf,
	rescheduleSource,
	trackingStartKey,
	longestStreak,
} from "../stats";
import { addDays, formatValue, fromDateKey, toDateKey } from "../utils";

const DAILY_DAYS = 30;
const WEEKLY_WEEKS = 12;
/** Width, in weeks, of the multi-month history heatmap (~6 months). */
const HISTORY_WEEKS = 26;

/** Preset timeframes for the comparison view, as whole Monday-start weeks. */
const COMPARE_PRESETS = {
	"4w": { weeks: 4, label: "4 weeks" },
	"12w": { weeks: 12, label: "12 weeks" },
	"6m": { weeks: 26, label: "6 months" },
	"1y": { weeks: 52, label: "1 year" },
} as const;
type ComparePreset = keyof typeof COMPARE_PRESETS;
const DEFAULT_COMPARE_PRESET: ComparePreset = "12w";

/** The comparison view's timeframe: a preset, or custom inclusive dates. */
type CompareRange =
	| { preset: ComparePreset }
	| { preset: "custom"; start: string; end: string };

/** Longest timeframe whose day-by-day grid shows single days, not weeks. */
const COMPARE_MAX_DAILY_DAYS = 92;
/** Longest timeframe whose trend lines are weekly rather than monthly. */
const COMPARE_MAX_WEEKLY_DAYS = 366;
/** Theme colours handed out to compared habits that have no accent of their own. */
const COMPARE_PALETTE = [
	"--color-blue",
	"--color-orange",
	"--color-purple",
	"--color-green",
	"--color-red",
	"--color-cyan",
	"--color-pink",
	"--color-yellow",
];

/** A day's state on the activity heatmaps, driving both colour and tooltip. */
type HeatmapState =
	| "future"
	| "prestart"
	| "notdue"
	| "outside"
	| "paused"
	| "skipped"
	| "failed"
	| "complete"
	| "over"
	| "partial"
	| "empty";

interface HeatmapPoint extends MatrixDataPoint {
	key: string;
	value: number;
	state: HeatmapState;
	/** The original due date, if this cell is a reschedule's destination. */
	rescheduledFrom: string | null;
}

/** Which section of a habit's metrics block is on screen. */
type MetricsView = "charts" | "month" | "history";

/**
 * How many recent due dates to plot for weekly and monthly habits. Daily
 * habits keep their own 30-day and 12-week charts; the value is also used as
 * the sample size for each habit's recent completion rate.
 */
const RECENT_POINTS: Record<HabitFrequency, number> = {
	daily: 30,
	weekly: 16,
	monthly: 12,
	interval: 16,
	flexibleWeekly: 16,
	flexibleMonthly: 12,
};

/** Trailing window, in due periods, for the rolling completion-rate line. */
const ROLLING_WINDOW: Record<HabitFrequency, number> = {
	daily: 7,
	weekly: 4,
	monthly: 3,
	interval: 5,
	flexibleWeekly: 4,
	flexibleMonthly: 3,
};

/**
 * Renders the metrics view for a `habit-metrics` code block placed inside a
 * habit note: summary tiles, a 30-day activity chart and a 12-week
 * completion-rate trend, drawn with Chart.js in the theme's colours.
 */
export class HabitMetrics extends MarkdownRenderChild {
	private charts: Chart[] = [];
	/** Paths of the habit notes currently rendered, for live refresh. */
	private watchedPaths = new Set<string>();
	/**
	 * Which section is on screen. Set once from the block
	 * source on load, then mutated in place by the tab clicks so a refresh
	 * triggered by our own source rewrite (see {@link persistField}) doesn't
	 * stomp it back to whatever was last saved.
	 */
	private view: MetricsView = "charts";
	/** The comparison view's timeframe; read and kept the same way as {@link view}. */
	private range: CompareRange = { preset: DEFAULT_COMPARE_PRESET };

	constructor(
		private app: App,
		private store: HabitStore,
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
		this.range = this.requestedRange();
		// Refresh when a rendered habit's note changes, so blocks that live
		// outside the habit note (via `habits: <name>`) stay current.
		const requestRender = debounce(() => this.render(), 250, true);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.watchedPaths.has(file.path)) {
					requestRender();
				}
			}),
		);
		this.render();
	}

	/**
	 * A `key: value` line from the block source, or "" when it's absent or
	 * empty. Whitespace is matched within the line only, so an empty field
	 * never swallows the line below it.
	 */
	private field(key: string): string {
		const match = new RegExp(`^[ \\t]*${key}[ \\t]*:[ \\t]*(.*?)[ \\t]*$`, "im").exec(
			this.source,
		);
		return match?.[1] ?? "";
	}

	/**
	 * Habit names from `habits:` (a comma-separated list) and the older
	 * single-habit `habit:` field, in order and without duplicates. Quotes
	 * and `[[wikilink]]` brackets around a name are ignored.
	 */
	private requestedNames(): string[] {
		const names: string[] = [];
		const seen = new Set<string>();
		for (const raw of `${this.field("habit")},${this.field("habits")}`.split(",")) {
			const name = raw
				.trim()
				.replace(/^\[\[(.*)\]\]$/, "$1")
				.replace(/^["']|["']$/g, "")
				.trim();
			if (name && !seen.has(name.toLowerCase())) {
				seen.add(name.toLowerCase());
				names.push(name);
			}
		}
		return names;
	}

	/** The view named in the block source (`view: month`/`view: history`), if any. */
	private requestedView(): MetricsView {
		const value = this.field("view").toLowerCase();
		return value === "month" || value === "history" ? value : "charts";
	}

	/**
	 * The comparison timeframe from `range:` — a preset (`4w`, `12w`, `6m`,
	 * `1y`) or custom dates (`2026-01-01 to 2026-03-31`; the end defaults to
	 * today). Anything else falls back to the default preset.
	 */
	private requestedRange(): CompareRange {
		const value = this.field("range").toLowerCase();
		if (value in COMPARE_PRESETS) {
			return { preset: value as ComparePreset };
		}
		const custom =
			/^(\d{4}-\d{2}-\d{2})(?:\s+to\s+|\s*\.\.\s*|\s+[-–]\s+)?(\d{4}-\d{2}-\d{2})?$/.exec(
				value,
			);
		if (custom && fromDateKey(custom[1]) && (!custom[2] || fromDateKey(custom[2]))) {
			return {
				preset: "custom",
				start: custom[1],
				end: custom[2] ?? toDateKey(new Date()),
			};
		}
		return { preset: DEFAULT_COMPARE_PRESET };
	}

	/** The `range:` text for a timeframe, as written back onto the block. */
	private rangeField(range: CompareRange): string {
		return range.preset === "custom"
			? `${range.start} to ${range.end}`
			: range.preset;
	}

	/** Inclusive start and end dates of a timeframe, earliest first. */
	private rangeDates(range: CompareRange, today: Date): { start: Date; end: Date } {
		const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		if (range.preset === "custom") {
			const a = fromDateKey(range.start) ?? base;
			const b = fromDateKey(range.end) ?? base;
			return a.getTime() <= b.getTime() ? { start: a, end: b } : { start: b, end: a };
		}
		const thisMonday = addDays(base, -((base.getDay() + 6) % 7));
		return {
			start: addDays(thisMonday, -7 * (COMPARE_PRESETS[range.preset].weeks - 1)),
			end: base,
		};
	}

	private render(): void {
		this.destroyCharts();
		const root = this.containerEl;
		root.empty();
		this.watchedPaths.clear();

		const habits = this.store.getHabits();
		const names = this.requestedNames();
		if (names.length > 1) {
			const found: HabitDefinition[] = [];
			const missing: string[] = [];
			for (const name of names) {
				const match = habits.find(
					(entry) => entry.name.toLowerCase() === name.toLowerCase(),
				);
				if (match) {
					found.push(match);
					this.watchedPaths.add(match.path);
				} else {
					missing.push(name);
				}
			}
			this.renderComparison(found, missing);
			return;
		}

		const requested = names[0] ?? "";
		const habit = requested
			? habits.find(
					(entry) =>
						entry.name.toLowerCase() ===
						requested.toLowerCase(),
				)
			: habits.find((entry) => entry.path === this.sourcePath);
		// With no `habit: <name>` override, the block is inherently tied to
		// its own note, so it must keep watching that note even while it
		// isn't a recognised habit yet — otherwise adding `type: binary`
		// (turning a plain note into one) would go undetected, and the
		// block would keep showing its "not a habit note" message until
		// the note is reopened.
		const watched = requested ? habit?.path : this.sourcePath;
		if (watched) {
			this.watchedPaths.add(watched);
		}

		if (!habit) {
			root.createEl("p", {
				cls: "habits-metrics-empty",
				text: requested
					? t('No habit called "{name}" was found.', {
							name: requested,
						})
					: t(
							'Place this block inside a habit note, or point it at one with "habit: <name>".',
						),
			});
			return;
		}

		if (habit.stopped) {
			this.renderBanner(
				"circle-stop",
				habit.stopDate
					? t("No longer tracked since {date}. All history is kept.", {
							date: habit.stopDate,
						})
					: t("No longer tracked. All history is kept."),
				t("Resume tracking"),
				() => this.store.restartHabit(habit),
			);
		} else if (habit.paused) {
			const open = habit.pauses.find((pause) => pause.end === "");
			this.renderBanner(
				"pause",
				open
					? t(
							"Paused since {date}. Paused days don't count against streaks or stats.",
							{ date: open.start },
						)
					: t(
							"Paused. Paused days don't count against streaks or stats.",
						),
				t("Resume habit"),
				() => this.store.resumeHabit(habit),
			);
		}

		this.renderSummary(habit);
		this.renderViewTabs();
		if (this.view === "month") {
			this.renderMonthHeatmap(habit);
		} else if (this.view === "history") {
			this.renderHistoryHeatmap(habit);
		} else if (habit.frequency === "daily") {
			this.renderDailyChart(habit);
			this.renderWeeklyChart(habit);
		} else {
			this.renderDueActivityChart(habit);
			this.renderDueRateChart(habit);
		}
	}

	/** Charts/Month/History tab bar. */
	private renderViewTabs(): void {
		const tabs = this.containerEl.createDiv({ cls: "habits-metrics-tabs" });
		const makeTab = (view: MetricsView, label: string): void => {
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
				void this.persistField("view", view, view === "charts");
				this.render();
			});
		};
		makeTab("charts", t("Charts"));
		makeTab("month", t("Month"));
		makeTab("history", t("History"));
	}

	/**
	 * Save a choice (the tab, the comparison timeframe) onto the block's own
	 * `key: value` source line, so it reopens the same way next time. An
	 * existing line is updated in place, keeping it visible even at its
	 * default; a missing one is only added when the value isn't the default.
	 * Best-effort: if the section can't be located (e.g. the block is
	 * mid-edit), the in-memory choice still stands, it just won't survive a
	 * reload.
	 */
	private async persistField(
		key: string,
		value: string,
		isDefault: boolean,
	): Promise<void> {
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
			const pattern = new RegExp(`^\\s*${key}\\s*:`, "i");
			const existing = lines.slice(lineStart + 1, lineEnd);
			const first = existing.findIndex((line) => pattern.test(line));
			const inner = existing.filter(
				(line, i) => i === first || !pattern.test(line),
			);
			if (first !== -1) {
				inner[first] = `${key}: ${value}`;
			} else if (!isDefault) {
				inner.push(`${key}: ${value}`);
			}
			return [
				...lines.slice(0, lineStart + 1),
				...inner,
				...lines.slice(lineEnd),
			].join("\n");
		});
	}

	/**
	 * A day's colour/tooltip state on either heatmap. Days the habit isn't
	 * due (weekends for a weekday-only habit, most of the month for a
	 * monthly one) read as `notdue` ahead of every other state — including
	 * `future` and `paused` — so a day that was never going to happen never
	 * reads as a miss.
	 */
	private heatmapState(
		habit: HabitDefinition,
		key: string,
		date: Date,
		todayKey: string,
		startKey: string,
	): { state: HeatmapState; value: number } {
		const value = habit.records[key] ?? 0;
		if (key < startKey) {
			return { state: "prestart", value };
		}
		if (!isActive(habit, date)) {
			return { state: "notdue", value };
		}
		if (key > todayKey) {
			return { state: "future", value };
		}
		// A skipped day is a one-day pause, so check it first to name it.
		if (isSkippedOn(habit, key)) {
			return { state: "skipped", value };
		}
		if (isPausedOn(habit, key)) {
			return { state: "paused", value };
		}
		if (isFailedOn(habit, key)) {
			return { state: "failed", value };
		}
		if (isComplete(habit, key)) {
			return { state: "complete", value };
		}
		if (habit.goalDirection === "max" && value > limitOf(habit)) {
			return { state: "over", value };
		}
		return { state: value > 0 ? "partial" : "empty", value };
	}

	/** Cell fill for a heatmap state, coloured by the habit's own accent. */
	private heatmapFill(state: HeatmapState, accent: string, red: string, neutral: string): string {
		switch (state) {
			case "complete":
				return accent;
			case "partial":
				return withAlpha(accent, 0.45);
			case "over":
				return withAlpha(red, 0.8);
			case "paused":
			case "skipped":
			case "future":
				return "transparent";
			case "outside":
			case "prestart":
			case "notdue":
				return withAlpha(neutral, 0.25);
			default:
				return neutral;
		}
	}

	/**
	 * Cell border for a heatmap state; paused/future days get one, and a
	 * rescheduled-to day gets a ring computed to contrast against both
	 * that cell's own fill and the page behind the gaps between cells
	 * (see {@link contrastColor}) — a fixed ring colour reads clearly
	 * against some fills and disappears against others, so it has to be
	 * chosen per cell.
	 */
	private heatmapBorder(
		state: HeatmapState,
		rescheduled: boolean,
		fill: string,
		neutral: string,
		background: string,
	): { color: string; width: number } {
		if (state === "paused" || state === "skipped" || state === "future") {
			return { color: withAlpha(neutral, 0.8), width: 1 };
		}
		if (rescheduled) {
			return { color: contrastColor(fill, background), width: 4 };
		}
		return { color: "transparent", width: 0 };
	}

	/** Tooltip lines for a heatmap cell. */
	private heatmapTooltip(point: HeatmapPoint, habit: HabitDefinition): string[] {
		const date = fromDateKey(point.key);
		const dateLabel = date
			? date.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
					year: "numeric",
				})
			: point.key;
		const unit = habit.unit || (habit.type === "timed" ? "min" : "");
		const stateLabel: Record<HeatmapState, string> = {
			future: t("Upcoming"),
			prestart: t("Not tracked yet"),
			notdue: t("Not due"),
			outside: t("Outside this month"),
			paused: t("Paused"),
			skipped: t("Skipped"),
			failed: t("Failed"),
			complete: t("Complete"),
			over: t("Over limit"),
			partial: t("Logged"),
			empty: t("Not logged"),
		};
		const lines = [dateLabel, stateLabel[point.state]];
		const skipsValue: HeatmapState[] = ["future", "prestart", "notdue", "outside"];
		if (habit.type !== "binary" && !skipsValue.includes(point.state)) {
			lines.push(`${formatValue(point.value)}${unit ? ` ${unit}` : ""}`);
		}
		if (point.rescheduledFrom) {
			const fromDate = fromDateKey(point.rescheduledFrom);
			lines.push(
				t("Rescheduled from {date}", {
					date: fromDate
						? fromDate.toLocaleDateString(undefined, {
								day: "numeric",
								month: "short",
							})
						: point.rescheduledFrom,
				}),
			);
		}
		return lines;
	}

	/**
	 * Calendar-style heatmap of the current month: weekdays across, weeks
	 * down, matching a normal wall calendar. Leading/trailing days from the
	 * neighbouring months fill out the grid and are shown dimmed.
	 */
	private renderMonthHeatmap(habit: HabitDefinition): void {
		const today = new Date();
		const todayKey = toDateKey(today);
		const startKey = trackingStartKey(habit, today);
		const grid = monthGrid(today);

		const points = pointsFromGrid(grid, (cell) => {
			const info = cell.inRange
				? this.heatmapState(habit, cell.key, cell.date, todayKey, startKey)
				: { state: "outside" as HeatmapState, value: 0 };
			return {
				v: info.value,
				key: cell.key,
				value: info.value,
				state: info.state,
				rescheduledFrom: cell.inRange
					? rescheduleSource(habit, cell.key)
					: null,
			};
		});

		const title = t("{month} heatmap", {
			month: today.toLocaleDateString(undefined, {
				month: "long",
				year: "numeric",
			}),
		});
		this.renderHeatmapChart(habit, title, points, grid.xLabels, grid.yLabels);
	}

	/**
	 * GitHub-style activity heatmap: one column per week over the last
	 * {@link HISTORY_WEEKS} (~6 months), Monday to Sunday top to bottom.
	 */
	private renderHistoryHeatmap(habit: HabitDefinition): void {
		const today = new Date();
		const todayKey = toDateKey(today);
		const startKey = trackingStartKey(habit, today);
		const grid = weekGrid(today, HISTORY_WEEKS);

		const points = pointsFromGrid(grid, (cell) => {
			const info = this.heatmapState(habit, cell.key, cell.date, todayKey, startKey);
			return {
				v: info.value,
				key: cell.key,
				value: info.value,
				state: info.state,
				rescheduledFrom: rescheduleSource(habit, cell.key),
			};
		});

		this.renderHeatmapChart(
			habit,
			t("Last {n} weeks", { n: HISTORY_WEEKS }),
			points,
			grid.xLabels,
			grid.yLabels,
			grid.monthTicks,
		);
	}

	/** Shared matrix-chart builder for both heatmap views. */
	private renderHeatmapChart(
		habit: HabitDefinition,
		title: string,
		points: HeatmapPoint[],
		xLabels: string[],
		yLabels: string[],
		/** Column tick text, e.g. only the weeks where the month changes. */
		xTickLabels?: string[],
	): void {
		const accent = resolveColor(
			this.containerEl,
			habit.color,
			"var(--interactive-accent)",
		);
		const red = resolveColor(this.containerEl, "", "var(--color-red, #e05d5d)");
		const neutral = resolveColor(
			this.containerEl,
			"",
			"var(--background-modifier-border)",
		);
		const text = resolveColor(this.containerEl, "", "var(--text-muted)");
		const pageBg = resolveColor(
			this.containerEl,
			"",
			"var(--background-primary)",
		);

		const backgrounds = points.map((p) =>
			this.heatmapFill(p.state, accent, red, neutral),
		);
		const borders = points.map((p, i) =>
			this.heatmapBorder(
				p.state,
				!!p.rescheduledFrom,
				backgrounds[i],
				neutral,
				pageBg,
			),
		);

		mountHeatmapChart(
			this.containerEl,
			this.charts,
			title,
			points,
			xLabels,
			yLabels,
			{
				background: backgrounds,
				border: borders.map((b) => b.color),
				borderWidth: borders.map((b) => b.width),
			},
			(point) => this.heatmapTooltip(point, habit),
			text,
			xTickLabels,
		);
	}

	/** Status banner with a resume action for paused or stopped habits. */
	private renderBanner(
		icon: string,
		text: string,
		buttonText: string,
		onClick: () => Promise<void>,
	): void {
		const banner = this.containerEl.createDiv({
			cls: "habits-metrics-banner",
		});
		const iconEl = banner.createSpan({
			cls: "habits-metrics-banner-icon",
		});
		setIcon(iconEl, icon);
		banner.createSpan({ cls: "habits-metrics-banner-text", text });
		const button = banner.createEl("button", {
			text: buttonText,
			attr: { type: "button" },
		});
		this.registerDomEvent(button, "click", () => {
			void onClick();
		});
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

	/** Summary tiles: streaks, lifetime completions and the 30-day rate. */
	private renderSummary(habit: HabitDefinition): void {
		const today = new Date();
		let completedDays: number;
		if (habit.goalDirection === "max") {
			// Unlogged days count as within limit, so successes cannot be
			// counted from logged records alone; walk the tracked window.
			completedDays = 0;
			const start = fromDateKey(trackingStartKey(habit, today));
			if (start) {
				const end = toDateKey(today);
				for (
					let cursor = start;
					toDateKey(cursor) <= end;
					cursor = addDays(cursor, 1)
				) {
					if (isComplete(habit, toDateKey(cursor))) {
						completedDays++;
					}
				}
			}
		} else {
			completedDays = Object.keys(habit.records).filter((key) => {
				const date = fromDateKey(key);
				return (
					date !== null &&
					isDue(habit, date) &&
					isComplete(habit, key)
				);
			}).length;
		}

		const completedLabel =
			habit.goalDirection === "max"
				? t("Days within limit")
				: habit.frequency === "flexibleWeekly" ||
						(habit.frequency === "weekly" &&
							habit.weekdays.length === 1)
					? t("Weeks completed")
					: habit.frequency === "flexibleMonthly" ||
							habit.frequency === "monthly"
						? t("Months completed")
						: t("Days completed");
		const rateLabel =
			habit.frequency === "daily" ? t("30-day rate") : t("Recent rate");

		const tiles = [
			{
				value: String(currentStreak(habit, today)),
				label: t("Current streak"),
			},
			{
				value: String(longestStreak(habit, today)),
				label: t("Best streak"),
			},
			{ value: String(completedDays), label: completedLabel },
			{ value: this.formatRate(this.recentRate(habit, today)), label: rateLabel },
		];

		const wrap = this.containerEl.createDiv({
			cls: "habits-stats-summary",
		});
		for (const tile of tiles) {
			const el = wrap.createDiv({ cls: "habits-stat-tile" });
			el.createDiv({ cls: "habits-stat-value", text: tile.value });
			el.createDiv({ cls: "habits-stat-label", text: tile.label });
		}
	}

	/**
	 * Completion rate (0–100) over the habit's recent due dates, so a weekly
	 * or monthly habit isn't penalised for the days it isn't due; `null`
	 * when none of them count yet.
	 */
	private recentRate(habit: HabitDefinition, today: Date): number | null {
		const recentDates = this.recentDueDates(
			habit,
			RECENT_POINTS[habit.frequency],
			today,
		);
		// Habits only start scoring on their start day; including earlier
		// dates would count days before the habit existed as misses.
		const startKey = trackingStartKey(habit, today);
		let due = 0;
		let hits = 0;
		for (const date of recentDates) {
			const key = toDateKey(date);
			if (isPausedOn(habit, key) || key < startKey) {
				continue;
			}
			due++;
			if (isComplete(habit, key)) {
				hits++;
			}
		}
		return due > 0 ? Math.round((hits / due) * 100) : null;
	}

	private formatRate(rate: number | null): string {
		return rate === null ? "–" : `${rate}%`;
	}

	/**
	 * Completion rate (0–100) between two dates (inclusive), counting only
	 * the days that have elapsed by `today`; `null` when nothing in it
	 * counts (not due, paused, before the habit started, or still to come),
	 * so trend lines skip the gap instead of dropping to zero.
	 */
	private periodRate(
		habit: HabitDefinition,
		from: Date,
		to: Date,
		today: Date,
	): number | null {
		const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		const through = to.getTime() > base.getTime() ? base : to;
		const startKey = trackingStartKey(habit, today);
		let counted = 0;
		let completed = 0;
		for (
			let day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
			day.getTime() <= through.getTime();
			day = addDays(day, 1)
		) {
			const key = toDateKey(day);
			if (key < startKey) {
				continue;
			}
			if (isFlexible(habit)) {
				// A per-day ratio would inflate the rate for any period
				// satisfied early (isComplete stays true for the rest of it),
				// so each of the habit's own weeks or months counts once, as
				// of its last day inside this stretch.
				const periodEnd =
					habit.frequency === "flexibleWeekly"
						? day.getDay() === 0
						: addDays(day, 1).getDate() === 1;
				if (!periodEnd && day.getTime() !== through.getTime()) {
					continue;
				}
			} else if (isPausedOn(habit, key) || !isActive(habit, day)) {
				continue;
			}
			counted++;
			if (isComplete(habit, key)) {
				completed++;
			}
		}
		return counted > 0 ? Math.round((completed / counted) * 100) : null;
	}

	/**
	 * A timeframe split into Monday-start weeks or calendar months, with the
	 * first and last clipped to the timeframe itself.
	 */
	private rangeBuckets(
		start: Date,
		end: Date,
		unit: "week" | "month",
	): { start: Date; end: Date }[] {
		const buckets: { start: Date; end: Date }[] = [];
		let cursor = start;
		while (cursor.getTime() <= end.getTime()) {
			const next =
				unit === "week"
					? addDays(cursor, 7 - ((cursor.getDay() + 6) % 7))
					: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
			const last = addDays(next, -1);
			buckets.push({
				start: cursor,
				end: last.getTime() > end.getTime() ? end : last,
			});
			cursor = next;
		}
		return buckets;
	}

	/** Inclusive length of a timeframe in days. */
	private rangeDays(start: Date, end: Date): number {
		return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
	}

	private formatDate(date: Date, withYear = false): string {
		return date.toLocaleDateString(undefined, {
			day: "numeric",
			month: "short",
			...(withYear ? { year: "numeric" } : {}),
		});
	}

	/**
	 * Side-by-side view for a block listing several habits: a timeframe
	 * picker, a summary table, one completion-rate line per habit, and a
	 * grid with a row per habit, so it's easy to see how the habits move
	 * together over the chosen dates.
	 */
	private renderComparison(habits: HabitDefinition[], missing: string[]): void {
		const today = new Date();
		const { start, end } = this.rangeDates(this.range, today);
		this.renderRangePicker(start, end);
		for (const name of missing) {
			this.containerEl.createEl("p", {
				cls: "habits-metrics-empty",
				text: t('No habit called "{name}" was found.', { name }),
			});
		}
		if (habits.length === 0) {
			return;
		}
		const colors = this.comparisonColors(habits);
		this.renderComparisonTable(habits, colors, today, start, end);
		this.renderComparisonTrend(habits, colors, today, start, end);
		this.renderComparisonGrid(habits, colors, today, start, end);
	}

	/**
	 * Preset timeframe tabs plus a Custom tab with from/to date pickers. A
	 * choice is saved onto the block's `range:` line, like the view tabs.
	 */
	private renderRangePicker(start: Date, end: Date): void {
		const bar = this.containerEl.createDiv({ cls: "habits-metrics-range" });
		const tabs = bar.createDiv({ cls: "habits-metrics-tabs" });
		const choose = (range: CompareRange): void => {
			this.range = range;
			void this.persistField(
				"range",
				this.rangeField(range),
				range.preset === DEFAULT_COMPARE_PRESET,
			);
			this.render();
		};
		const makeTab = (
			active: boolean,
			label: string,
			onClick: () => void,
		): void => {
			const button = tabs.createEl("button", {
				cls: "habits-metrics-tab",
				text: label,
				attr: { type: "button", "aria-pressed": String(active) },
			});
			button.toggleClass("is-active", active);
			this.registerDomEvent(button, "click", () => {
				if (!active) {
					onClick();
				}
			});
		};
		for (const preset of Object.keys(COMPARE_PRESETS) as ComparePreset[]) {
			makeTab(this.range.preset === preset, t(COMPARE_PRESETS[preset].label), () =>
				choose({ preset }),
			);
		}
		// Custom starts from whatever dates are on screen, so switching to it
		// never jumps the charts somewhere unexpected.
		makeTab(this.range.preset === "custom", t("Custom"), () =>
			choose({ preset: "custom", start: toDateKey(start), end: toDateKey(end) }),
		);

		if (this.range.preset !== "custom") {
			bar.createSpan({
				cls: "habits-metrics-range-label",
				text: `${this.formatDate(start, true)} – ${this.formatDate(end, true)}`,
			});
			return;
		}
		const wrap = bar.createDiv({ cls: "habits-custom-range" });
		const makeInput = (
			value: Date,
			label: string,
			onPick: (key: string) => void,
		): void => {
			const input = wrap.createEl("input", {
				cls: "habits-custom-date",
				attr: { type: "date", "aria-label": label },
			});
			input.value = toDateKey(value);
			this.registerDomEvent(input, "change", () => {
				if (fromDateKey(input.value)) {
					onPick(input.value);
				}
			});
		};
		makeInput(start, t("Start date"), (key) =>
			choose({ preset: "custom", start: key, end: toDateKey(end) }),
		);
		wrap.createSpan({ cls: "habits-custom-range-sep", text: "–" });
		makeInput(end, t("End date"), (key) =>
			choose({ preset: "custom", start: toDateKey(start), end: key }),
		);
	}

	/**
	 * One distinct colour per habit: its own accent where set and not
	 * already taken, otherwise the next unused theme colour, so two habits
	 * never share a line.
	 */
	private comparisonColors(habits: HabitDefinition[]): string[] {
		const palette = COMPARE_PALETTE.map((name) =>
			resolveColor(this.containerEl, "", `var(${name})`),
		);
		const used = new Set<string>();
		return habits.map((habit) => {
			const own = habit.color
				? resolveColor(this.containerEl, habit.color, "")
				: "";
			const color =
				own && !used.has(own)
					? own
					: (palette.find((entry) => !used.has(entry)) ??
						palette[used.size % palette.length]);
			used.add(color);
			return color;
		});
	}

	/**
	 * Per-habit streaks (as of today) and the completion rate over the
	 * chosen timeframe, one row each.
	 */
	private renderComparisonTable(
		habits: HabitDefinition[],
		colors: string[],
		today: Date,
		start: Date,
		end: Date,
	): void {
		const table = this.containerEl
			.createDiv({ cls: "habits-metrics-compare" })
			.createEl("table", { cls: "habits-metrics-compare-table" });
		const head = table.createEl("thead").createEl("tr");
		for (const label of [
			t("Habit"),
			t("Current streak"),
			t("Best streak"),
			t("Completion rate"),
		]) {
			head.createEl("th", { text: label });
		}
		const body = table.createEl("tbody");
		habits.forEach((habit, i) => {
			const row = body.createEl("tr");
			const nameCell = row.createEl("td");
			const swatch = nameCell.createSpan({ cls: "habits-metrics-compare-swatch" });
			swatch.setCssProps({ "--habits-compare-color": colors[i] });
			const link = nameCell.createEl("a", {
				cls: "internal-link",
				text: habit.name,
				href: habit.path,
			});
			this.registerDomEvent(link, "click", (evt) => {
				evt.preventDefault();
				void this.app.workspace.openLinkText(habit.path, this.sourcePath, false);
			});
			if (habit.stopped || habit.paused) {
				nameCell.createSpan({
					cls: "habits-metrics-compare-badge",
					text: habit.stopped ? t("Stopped") : t("Paused"),
				});
			}
			row.createEl("td", { text: String(currentStreak(habit, today)) });
			row.createEl("td", { text: String(longestStreak(habit, today)) });
			row.createEl("td", {
				text: this.formatRate(this.periodRate(habit, start, end, today)),
			});
		});
	}

	/**
	 * One completion-rate line per habit across the timeframe: a point per
	 * week, or per month once the timeframe runs past a year.
	 */
	private renderComparisonTrend(
		habits: HabitDefinition[],
		colors: string[],
		today: Date,
		start: Date,
		end: Date,
	): void {
		const unit =
			this.rangeDays(start, end) <= COMPARE_MAX_WEEKLY_DAYS ? "week" : "month";
		const buckets = this.rangeBuckets(start, end, unit);
		const labels = buckets.map((bucket) =>
			unit === "week"
				? this.formatDate(bucket.start)
				: bucket.start.toLocaleDateString(undefined, {
						month: "short",
						year: "2-digit",
					}),
		);
		const datasets = habits.map((habit, i) => ({
			type: "line" as const,
			label: habit.name,
			data: buckets.map((bucket) =>
				this.periodRate(habit, bucket.start, bucket.end, today),
			),
			borderColor: colors[i],
			backgroundColor: colors[i],
			tension: 0.3,
			pointRadius: buckets.length > 30 ? 2 : 3,
			spanGaps: true,
		}));

		const options = this.baseOptions(100);
		const yTicks = options.scales?.y?.ticks;
		if (yTicks) {
			(yTicks as { callback?: (value: unknown) => string }).callback = (
				value: unknown,
			) => `${String(value)}%`;
		}
		const text = resolveColor(this.containerEl, "", "var(--text-muted)");
		(options.plugins as Record<string, unknown>).legend = {
			display: true,
			position: "bottom",
			labels: { color: text, boxWidth: 12, boxHeight: 12 },
		};
		(options.plugins as Record<string, unknown>).tooltip = {
			mode: "index",
			intersect: false,
			callbacks: {
				label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
					ctx.parsed.y === null
						? ""
						: `${ctx.dataset.label ?? ""}: ${ctx.parsed.y}%`,
			},
		};

		this.createChart(
			unit === "week" ? t("Weekly completion rate") : t("Monthly completion rate"),
			{
				type: "line",
				data: {
					labels,
					datasets: datasets as unknown as ChartDataset<"line", number[]>[],
				},
				options,
			},
		);
	}

	/**
	 * The timeframe as a grid with one row per habit, so days (or weeks)
	 * where habits were done or missed together line up in the same column.
	 * Short timeframes show single days, coloured like the single-habit
	 * heatmaps; longer ones show weeks, shaded by that week's rate.
	 */
	private renderComparisonGrid(
		habits: HabitDefinition[],
		colors: string[],
		today: Date,
		start: Date,
		end: Date,
	): void {
		const daily = this.rangeDays(start, end) <= COMPARE_MAX_DAILY_DAYS;
		const columns = daily
			? this.rangeBuckets(start, end, "week").flatMap((week) => {
					const days: { start: Date; end: Date }[] = [];
					for (
						let day = week.start;
						day.getTime() <= week.end.getTime();
						day = addDays(day, 1)
					) {
						days.push({ start: day, end: day });
					}
					return days;
				})
			: this.rangeBuckets(start, end, "week");
		const xLabels = columns.map((column) => toDateKey(column.start));
		// Daily grids label each Monday; weekly ones each change of month.
		let lastMonth = -1;
		const xTickLabels = columns.map((column, i) => {
			if (daily) {
				return column.start.getDay() === 1 || i === 0
					? this.formatDate(column.start)
					: "";
			}
			const month = column.start.getMonth();
			const tick =
				month !== lastMonth
					? column.start.toLocaleDateString(undefined, { month: "short" })
					: "";
			lastMonth = month;
			return tick;
		});
		// Category labels must be unique; names already are, as note names.
		const yLabels = habits.map((habit) => habit.name);

		const red = resolveColor(this.containerEl, "", "var(--color-red, #e05d5d)");
		const neutral = resolveColor(
			this.containerEl,
			"",
			"var(--background-modifier-border)",
		);
		const text = resolveColor(this.containerEl, "", "var(--text-muted)");
		const pageBg = resolveColor(this.containerEl, "", "var(--background-primary)");
		const todayKey = toDateKey(today);

		const points: { x: string; y: string; v: number; tip: string[] }[] = [];
		const background: string[] = [];
		const border: string[] = [];
		const borderWidth: number[] = [];
		habits.forEach((habit, h) => {
			const startKey = trackingStartKey(habit, today);
			columns.forEach((column, c) => {
				const key = xLabels[c];
				if (daily) {
					const info = this.heatmapState(habit, key, column.start, todayKey, startKey);
					const from = rescheduleSource(habit, key);
					const point: HeatmapPoint = {
						x: key,
						y: habit.name,
						v: info.value,
						key,
						value: info.value,
						state: info.state,
						rescheduledFrom: from,
					};
					points.push({
						x: key,
						y: habit.name,
						v: info.value,
						tip: [habit.name, ...this.heatmapTooltip(point, habit)],
					});
					const fill = this.heatmapFill(info.state, colors[h], red, neutral);
					background.push(fill);
					const ring = this.heatmapBorder(info.state, !!from, fill, neutral, pageBg);
					border.push(ring.color);
					borderWidth.push(ring.width);
					return;
				}
				const rate = this.periodRate(habit, column.start, column.end, today);
				points.push({
					x: key,
					y: habit.name,
					v: rate ?? 0,
					tip: [
						habit.name,
						t("Week of {date}", { date: this.formatDate(column.start, true) }),
						rate === null ? t("Not due") : `${rate}%`,
					],
				});
				background.push(
					rate === null
						? withAlpha(neutral, 0.25)
						: rate === 0
							? neutral
							: withAlpha(colors[h], 0.25 + 0.75 * (rate / 100)),
				);
				border.push("transparent");
				borderWidth.push(0);
			});
		});

		mountHeatmapChart(
			this.containerEl,
			this.charts,
			daily ? t("Daily activity") : t("Weekly activity"),
			points,
			xLabels,
			yLabels,
			{ background, border, borderWidth },
			(point) => point.tip,
			text,
			xTickLabels,
		);
		// Give each habit row a comfortable height rather than squeezing
		// them all into the default chart height.
		const canvas = this.containerEl.lastElementChild?.querySelector(
			".habits-metrics-canvas",
		);
		if (canvas instanceof HTMLElement) {
			canvas.setCssProps({
				"--habits-metrics-height": `${Math.max(120, habits.length * 34 + 40)}px`,
			});
		}
	}

	/** Bar chart of the last 30 days; complete days show in theme green. */
	private renderDailyChart(habit: HabitDefinition): void {
		const today = new Date();
		const accent = resolveColor(this.containerEl,
			habit.color,
			"var(--interactive-accent)",
		);
		const green = resolveColor(this.containerEl,
			"",
			"var(--color-green, var(--text-success))",
		);
		const red = resolveColor(this.containerEl,"", "var(--color-red, #e05d5d)");
		const pageBg = resolveColor(
			this.containerEl,
			"",
			"var(--background-primary)",
		);
		const isMax = habit.goalDirection === "max";

		const labels: string[] = [];
		const values: number[] = [];
		const colors: string[] = [];
		const borderColors: string[] = [];
		const borderWidths: number[] = [];
		const rescheduledFrom: (string | null)[] = [];
		for (let i = DAILY_DAYS - 1; i >= 0; i--) {
			const day = addDays(today, -i);
			const key = toDateKey(day);
			labels.push(
				day.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			);
			const value = habit.records[key] ?? 0;
			values.push(value);
			// Over-limit days show red; other incomplete days (including
			// days before a limit habit started) stay dim and neutral.
			const fill =
				isMax && value > limitOf(habit)
					? withAlpha(red, 0.8)
					: isComplete(habit, key)
						? green
						: withAlpha(accent, 0.45);
			colors.push(fill);
			// A rescheduled-to day gets a ring computed to contrast against
			// its own bar's fill, the same treatment as the heatmaps.
			const from = rescheduleSource(habit, key);
			rescheduledFrom.push(from);
			borderColors.push(from ? contrastColor(fill, pageBg) : "transparent");
			borderWidths.push(from ? 4 : 0);
		}

		const datasets: ChartDataset<"bar" | "line", number[]>[] = [
			{
				type: "bar",
				label: habit.unit || t("Logged"),
				data: values,
				backgroundColor: colors,
				borderColor: borderColors,
				borderWidth: borderWidths,
				borderRadius: 3,
			},
		];
		// A flexible habit's target is a per-period goal; drawn as a flat
		// daily line it would misleadingly read as a daily one.
		if (habit.type !== "binary" && habit.target > 0 && !isFlexible(habit)) {
			datasets.push({
				type: "line",
				label: isMax ? t("Limit") : t("Target"),
				data: new Array(DAILY_DAYS).fill(habit.target) as number[],
				borderColor: withAlpha(isMax ? red : green, 0.7),
				borderDash: [6, 4],
				borderWidth: 1.5,
				pointRadius: 0,
			});
		}

		const options = this.baseOptions(habit.type === "binary" ? 1 : undefined);
		this.applyRescheduleTooltip(options, rescheduledFrom);

		this.createChart(t("Last 30 days"), {
			type: "bar",
			data: { labels, datasets },
			options,
		});
	}

	/** Line chart of the completion rate per week for the last 12 weeks. */
	private renderWeeklyChart(habit: HabitDefinition): void {
		const today = new Date();
		const base = new Date(
			today.getFullYear(),
			today.getMonth(),
			today.getDate(),
		);
		const thisMonday = addDays(base, -((base.getDay() + 6) % 7));
		const accent = resolveColor(this.containerEl,
			habit.color,
			"var(--interactive-accent)",
		);

		const labels: string[] = [];
		const rates: number[] = [];
		for (let week = WEEKLY_WEEKS - 1; week >= 0; week--) {
			const start = addDays(thisMonday, -7 * week);
			labels.push(
				start.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			);
			if (isFlexible(habit)) {
				// A per-day ratio would inflate the rate for any week
				// satisfied early (isComplete stays true for the rest of
				// it), so this is a plain pass/fail for the week instead —
				// as of its last elapsed day.
				const weekEnd = addDays(start, 6);
				const through =
					weekEnd.getTime() > base.getTime() ? base : weekEnd;
				const throughKey = toDateKey(through);
				const trackable = throughKey >= trackingStartKey(habit, today);
				rates.push(
					trackable && isComplete(habit, throughKey) ? 100 : 0,
				);
				continue;
			}
			let elapsed = 0;
			let completed = 0;
			for (let i = 0; i < 7; i++) {
				const day = addDays(start, i);
				if (day.getTime() > base.getTime()) {
					break;
				}
				const key = toDateKey(day);
				if (isPausedOn(habit, key)) {
					continue;
				}
				// Days before the habit started don't count against it.
				if (key < trackingStartKey(habit, today)) {
					continue;
				}
				elapsed++;
				if (isComplete(habit, key)) {
					completed++;
				}
			}
			rates.push(
				elapsed > 0 ? Math.round((completed / elapsed) * 100) : 0,
			);
		}

		const options = this.baseOptions(100);
		const yTicks = options.scales?.y?.ticks;
		if (yTicks) {
			(yTicks as { callback?: (value: unknown) => string }).callback = (
				value: unknown,
			) => `${String(value)}%`;
		}

		this.createChart(t("Weekly completion rate"), {
			type: "line",
			data: {
				labels,
				datasets: [
					{
						type: "line",
						label: "Completion",
						data: rates,
						borderColor: accent,
						backgroundColor: withAlpha(accent, 0.18),
						fill: true,
						tension: 0.3,
						pointRadius: 3,
						pointBackgroundColor: accent,
					},
				],
			},
			options,
		});
	}

	/** The last `count` due dates on or before `end`, oldest first. */
	private recentDueDates(
		habit: HabitDefinition,
		count: number,
		end: Date,
	): Date[] {
		const dates: Date[] = [];
		let cursor = new Date(
			end.getFullYear(),
			end.getMonth(),
			end.getDate(),
		);
		// Guard against pathological loops on a brand-new habit.
		const maxScan = 366 * 10;
		let scanned = 0;
		while (dates.length < count && scanned < maxScan) {
			if (isDue(habit, cursor)) {
				dates.push(new Date(cursor));
			}
			cursor = addDays(cursor, -1);
			scanned++;
		}
		return dates.reverse();
	}

	/**
	 * Bar chart of the most recent due dates for a weekly or monthly habit,
	 * labelled with the actual date each one falls on. Complete periods show
	 * in theme green; a dashed line marks the target for counted/timed habits.
	 */
	private renderDueActivityChart(habit: HabitDefinition): void {
		const today = new Date();
		const dates = this.recentDueDates(
			habit,
			RECENT_POINTS[habit.frequency],
			today,
		);
		const accent = resolveColor(this.containerEl,
			habit.color,
			"var(--interactive-accent)",
		);
		const green = resolveColor(this.containerEl,
			"",
			"var(--color-green, var(--text-success))",
		);
		const pageBg = resolveColor(
			this.containerEl,
			"",
			"var(--background-primary)",
		);

		const labels: string[] = [];
		const values: number[] = [];
		const colors: string[] = [];
		const borderColors: string[] = [];
		const borderWidths: number[] = [];
		const rescheduledFrom: (string | null)[] = [];
		for (const date of dates) {
			const key = toDateKey(date);
			labels.push(
				date.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			);
			values.push(habit.records[key] ?? 0);
			const fill = isComplete(habit, key) ? green : withAlpha(accent, 0.45);
			colors.push(fill);
			const from = rescheduleSource(habit, key);
			rescheduledFrom.push(from);
			borderColors.push(from ? contrastColor(fill, pageBg) : "transparent");
			borderWidths.push(from ? 4 : 0);
		}

		const datasets: ChartDataset<"bar" | "line", number[]>[] = [
			{
				type: "bar",
				label: habit.unit || t("Logged"),
				data: values,
				backgroundColor: colors,
				borderColor: borderColors,
				borderWidth: borderWidths,
				borderRadius: 3,
			},
		];
		if (habit.type !== "binary" && habit.target > 0) {
			datasets.push({
				type: "line",
				label: t("Target"),
				data: new Array(dates.length).fill(habit.target) as number[],
				borderColor: withAlpha(green, 0.7),
				borderDash: [6, 4],
				borderWidth: 1.5,
				pointRadius: 0,
			});
		}

		const title =
			habit.frequency === "weekly"
				? t("Weekly activity")
				: habit.frequency === "interval"
					? t("Activity on due days")
					: t("Monthly activity");
		const options = this.baseOptions(habit.type === "binary" ? 1 : undefined);
		this.applyRescheduleTooltip(options, rescheduledFrom);
		this.createChart(title, {
			type: "bar",
			data: { labels, datasets },
			options,
		});
	}

	/**
	 * Line chart of a rolling completion rate over recent due periods, so a
	 * weekly or monthly habit shows a smooth trend rather than a 0/100 zig-zag.
	 */
	private renderDueRateChart(habit: HabitDefinition): void {
		const today = new Date();
		const window = ROLLING_WINDOW[habit.frequency];
		const dates = this.recentDueDates(
			habit,
			RECENT_POINTS[habit.frequency],
			today,
		);
		const accent = resolveColor(this.containerEl,
			habit.color,
			"var(--interactive-accent)",
		);

		const labels: string[] = [];
		const rates: number[] = [];
		for (let i = 0; i < dates.length; i++) {
			labels.push(
				dates[i].toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			);
			let considered = 0;
			let completed = 0;
			for (let j = Math.max(0, i - window + 1); j <= i; j++) {
				const key = toDateKey(dates[j]);
				if (isPausedOn(habit, key)) {
					continue;
				}
				considered++;
				if (isComplete(habit, key)) {
					completed++;
				}
			}
			rates.push(
				considered > 0
					? Math.round((completed / considered) * 100)
					: 0,
			);
		}

		const options = this.baseOptions(100);
		const yTicks = options.scales?.y?.ticks;
		if (yTicks) {
			(yTicks as { callback?: (value: unknown) => string }).callback = (
				value: unknown,
			) => `${String(value)}%`;
		}

		const title =
			habit.frequency === "weekly"
				? t("{n}-week completion rate", { n: window })
				: habit.frequency === "interval"
					? t("Completion rate over {n} due days", { n: window })
					: t("{n}-month completion rate", { n: window });
		this.createChart(title, {
			type: "line",
			data: {
				labels,
				datasets: [
					{
						type: "line",
						label: "Completion",
						data: rates,
						borderColor: accent,
						backgroundColor: withAlpha(accent, 0.18),
						fill: true,
						tension: 0.3,
						pointRadius: 3,
						pointBackgroundColor: accent,
					},
				],
			},
			options,
		});
	}

	/**
	 * Add a "Rescheduled from {date}" tooltip line to a bar chart's hovered
	 * bars, keyed by the same per-bar index as the dataset's own data —
	 * mutates the options object returned by {@link baseOptions}, the same
	 * "call baseOptions then adjust" pattern used elsewhere for the
	 * y-axis's percent-formatting tick callback.
	 */
	private applyRescheduleTooltip(
		options: ReturnType<HabitMetrics["baseOptions"]>,
		rescheduledFrom: (string | null)[],
	): void {
		(
			options.plugins as {
				tooltip?: {
					callbacks?: {
						afterLabel?: (ctx: { dataIndex: number }) => string;
					};
				};
			}
		).tooltip = {
			callbacks: {
				afterLabel: (ctx) => {
					const from = rescheduledFrom[ctx.dataIndex];
					if (!from) {
						return "";
					}
					const date = fromDateKey(from);
					return t("Rescheduled from {date}", {
						date: date
							? date.toLocaleDateString(undefined, {
									day: "numeric",
									month: "short",
								})
							: from,
					});
				},
			},
		};
	}

	/** Shared chart options wired to the theme's text and grid colours. */
	private baseOptions(suggestedMax?: number) {
		const text = resolveColor(this.containerEl,"", "var(--text-muted)");
		const grid = withAlpha(
			resolveColor(this.containerEl,"", "var(--background-modifier-border)"),
			0.6,
		);
		return {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 300 },
			plugins: { legend: { display: false } },
			scales: {
				x: {
					grid: { display: false },
					ticks: {
						color: text,
						maxRotation: 0,
						autoSkip: true,
						maxTicksLimit: 8,
					},
				},
				y: {
					beginAtZero: true,
					suggestedMax,
					grid: { color: grid },
					ticks: { color: text, precision: 0 } as {
						color: string;
						precision: number;
						callback?: (value: unknown) => string;
					},
				},
			},
		};
	}

	/** Titled section containing a responsive chart canvas. */
	private createChart(
		title: string,
		config: ChartConfiguration<"bar" | "line", number[], string>,
	): void {
		const section = this.containerEl.createDiv({
			cls: "habits-metrics-section",
		});
		section.createDiv({ cls: "habits-metrics-title", text: title });
		const wrap = section.createDiv({ cls: "habits-metrics-canvas" });
		const canvas = wrap.createEl("canvas");
		this.charts.push(new Chart(canvas, config));
	}
}
