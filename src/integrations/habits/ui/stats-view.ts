import { Notice, setIcon } from "obsidian";
import { t } from "../i18n";
import type { AiSummarySettings } from "../settings";
import type { GroupStyle, HabitDefinition } from "../types";
import { addDays, formatValue, habitAccent, toDateKey } from "../utils";
import { applyHabitIcon } from "./icon-suggest-modal";
import {
	buildStatsDigest,
	generateSummary,
	getCachedSummary,
} from "../ai-summary";
import {
	getStatsRange,
	habitStats,
	isActive,
	isComplete,
	isFlexible,
	isPausedOn,
	perfectDays,
	trackingStartKey,
	rangeLength,
	type DateRange,
	type StatsPeriod,
	type StatsRangeMode,
} from "../stats";

function formatShort(date: Date): string {
	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
	});
}

function tile(parent: HTMLElement, value: string, label: string): void {
	const el = parent.createDiv({ cls: "habits-stat-tile" });
	el.createDiv({ cls: "habits-stat-value", text: value });
	el.createDiv({ cls: "habits-stat-label", text: label });
}

/** Render the stats view (summary tiles + per-habit heatmaps) into a container. */
export function renderStatsView(
	container: HTMLElement,
	habits: HabitDefinition[],
	period: StatsPeriod,
	mode: StatsRangeMode,
	today: Date,
	/** The user-picked range; only used when `period` is `custom`. */
	customRange?: DateRange,
	/** When set, an AI summary section is offered (experimental feature). */
	aiSettings?: AiSummarySettings,
	/**
	 * When set (> 0), the per-habit rows are split into carousel pages of
	 * this many rows. Left unset, all rows render as one flat list.
	 */
	rowsPerPage?: number,
	/**
	 * When set, grouping is enabled: rows carry a group lip and use
	 * the group colour where the habit opted into it.
	 */
	groups?: Record<string, GroupStyle>,
	/**
	 * Vertical layout: cap the list's height and scroll it in place,
	 * saving space in the note.
	 */
	scrollable?: boolean,
): void {
	container.empty();
	container.addClass("habits-stats");

	const range = getStatsRange(today, period, mode, customRange);
	const length = rangeLength(range);

	const title =
		period === "custom"
			? t("Custom range")
			: mode === "rolling"
				? period === "weekly"
					? t("Last 7 days")
					: t("Last 30 days")
				: period === "weekly"
					? t("This week")
					: t("This month");
	const subtitle =
		period === "monthly" && mode === "calendar"
			? today.toLocaleDateString(undefined, {
					month: "long",
					year: "numeric",
				})
			: `${formatShort(range.start)} – ${formatShort(range.end)}`;

	container.createDiv({
		cls: "habits-stats-range",
		text: `${title} · ${subtitle}`,
	});

	if (habits.length === 0) {
		container.createDiv({
			cls: "habits-empty",
			text: t("No habits to show stats for yet."),
		});
		return;
	}

	const todayKey = toDateKey(today);
	const allStats = habits.map((habit) => habitStats(habit, range, today));
	const totalDays = allStats.reduce((sum, s) => sum + s.days, 0);
	const totalCompleted = allStats.reduce((sum, s) => sum + s.completed, 0);
	const overallRate =
		totalDays > 0 ? Math.round((totalCompleted / totalDays) * 100) : 0;
	const bestCurrent = allStats.reduce((max, s) => Math.max(max, s.current), 0);
	const perfect = perfectDays(habits, range, today);

	// Weekly and monthly goals don't map onto an arbitrary date range, so
	// the custom period shows no goal tiles or bars at all.
	const isPerfect = (habit: HabitDefinition): boolean =>
		period === "weekly"
			? habit.weeklyPerfect
			: period === "monthly"
				? habit.monthlyPerfect
				: false;
	const goalOf = (habit: HabitDefinition): number => {
		if (period === "custom") {
			return 0;
		}
		if (isPerfect(habit)) {
			return length;
		}
		return period === "weekly" ? habit.weeklyTarget : habit.monthlyTarget;
	};
	const progressOf = (i: number): number => allStats[i].completed;
	let goalsTotal = 0;
	let goalsMet = 0;
	habits.forEach((habit, i) => {
		if (goalOf(habit) > 0) {
			goalsTotal++;
			if (progressOf(i) >= goalOf(habit)) {
				goalsMet++;
			}
		}
	});

	const summary = container.createDiv({ cls: "habits-stats-summary" });
	tile(summary, `${overallRate}%`, t("Completion"));
	tile(summary, `${bestCurrent}`, t("Best streak"));
	tile(summary, `${perfect}`, t("Perfect days"));
	tile(summary, `${totalCompleted}`, t("Completions"));
	if (goalsTotal > 0) {
		tile(summary, `${goalsMet}/${goalsTotal}`, t("Goals met"));
	}

	if (aiSettings) {
		renderAiSummary(
			container,
			habits,
			period,
			mode,
			today,
			customRange,
			aiSettings,
		);
	}

	// Carousel mode splits the rows into sliding pages; it only engages
	// when there are more habits than fit a single page.
	const pageSize = rowsPerPage !== undefined && rowsPerPage > 0
		? rowsPerPage
		: 0;
	const paged = pageSize > 0 && habits.length > pageSize;
	const pages: HTMLElement[] = [];
	let track: HTMLElement | null = null;
	let list: HTMLElement | null = null;
	if (paged) {
		const viewport = container.createDiv({
			cls: "habits-stats-carousel-viewport",
		});
		track = viewport.createDiv({ cls: "habits-stats-carousel-track" });
		const pageCount = Math.ceil(habits.length / pageSize);
		for (let p = 0; p < pageCount; p++) {
			pages.push(
				track.createDiv({
					cls: "habits-stats-list habits-stats-page",
				}),
			);
		}
	} else {
		list = container.createDiv({ cls: "habits-stats-list" });
		if (scrollable) {
			list.addClass("is-scrollable");
		}
	}

	habits.forEach((habit, i) => {
		const stats = allStats[i];
		const parent = paged
			? pages[Math.floor(i / pageSize)]
			: (list as HTMLElement);
		const row = parent.createDiv({ cls: "habits-stats-row" });
		const accent = habitAccent(habit, groups ?? {});
		if (accent) {
			row.setCssProps({ "--habits-accent": accent });
		}

		// With grouping on, the row carries the same group lip as the
		// dashboard cards, flush along its top edge.
		const groupName = habit.group.trim();
		if (groups && groupName) {
			const lip = row.createDiv({
				cls: "habits-card-group-lip habits-stats-group-lip",
			});
			const style = groups[groupName];
			if (style?.color) {
				lip.setCssProps({
					"--habits-group-color": style.color,
				});
			}
			if (style?.icon) {
				const icon = lip.createSpan({
					cls: "habits-card-group-icon",
				});
				applyHabitIcon(icon, style.icon);
			}
			lip.createSpan({
				cls: "habits-card-group-name",
				text: groupName,
			});
		}

		const top = row.createDiv({ cls: "habits-stats-row-top" });
		const name = top.createDiv({ cls: "habits-stats-name" });
		if (habit.icon) {
			const icon = name.createSpan({ cls: "habits-card-icon" });
			applyHabitIcon(icon, habit.icon);
		}
		name.createSpan({ text: habit.name });
		const streak = top.createSpan({ cls: "habits-stats-streak" });
		const flame = streak.createSpan({ cls: "habits-stats-flame" });
		setIcon(flame, "flame");
		streak.createSpan({ text: `${stats.current}` });

		const heatmap = row.createDiv({ cls: "habits-stats-heatmap" });
		const startKey = trackingStartKey(habit, today);
		for (let d = 0; d < length; d++) {
			const date = addDays(range.start, d);
			const key = toDateKey(date);
			const value = habit.records[key] ?? 0;
			const cell = heatmap.createDiv({ cls: "habits-stats-cell" });
			if (key === startKey) {
				// A filled play icon marks the first tracked day — small
				// rings proved too subtle at this cell size.
				cell.addClass("is-start");
				setIcon(cell, "play");
			}
			if (key < startKey) {
				// The habit didn't exist yet: neither success nor failure.
				cell.addClass("is-prestart");
				cell.setAttr(
					"aria-label",
					`${key}: ${t("not tracked yet")}`,
				);
				continue;
			}
			if (!isActive(habit, date)) {
				cell.addClass("is-notdue");
			} else if (key > todayKey) {
				cell.addClass("is-future");
			} else if (isPausedOn(habit, key)) {
				cell.addClass("is-paused");
			} else if (isComplete(habit, key)) {
				cell.addClass("is-complete");
			} else if (habit.goalDirection === "max") {
				cell.addClass("is-over");
			} else if (value > 0) {
				cell.addClass("is-partial");
			}
			// Obsidian renders aria-label as the hover tooltip, so the start
			// note has to live in the same attribute (a separate setTooltip
			// call would just be overwritten).
			cell.setAttr(
				"aria-label",
				key === startKey
					? `${key}: ${value} · ${t("started tracking on {date}", {
							date: formatShort(date),
						})}`
					: `${key}: ${value}`,
			);
		}

		const unit = habit.unit || (habit.type === "timed" ? "min" : "");
		const totalText = isFlexible(habit)
			? habit.frequency === "flexibleWeekly"
				? t("{completed}/{days} weeks", {
						completed: stats.completed,
						days: stats.days,
					})
				: t("{completed}/{days} months", {
						completed: stats.completed,
						days: stats.days,
					})
			: habit.type === "binary"
				? t("{completed}/{days} days", {
						completed: stats.completed,
						days: stats.days,
					})
				: t("{total} total", {
						total: `${formatValue(stats.total)}${unit ? ` ${unit}` : ""}`,
					});
		const meta = row.createDiv({ cls: "habits-stats-meta" });
		meta.createSpan({
			text: `${Math.round(stats.rate * 100)}% · ${totalText} · ${t("best")} `,
		});
		const bestFlame = meta.createSpan({ cls: "habits-stats-flame" });
		setIcon(bestFlame, "flame");
		meta.createSpan({ text: `${stats.best}` });

		const goal = goalOf(habit);
		if (goal > 0) {
			const progress = progressOf(i);
			const pct = Math.min(100, Math.round((progress / goal) * 100));
			const bar = row.createDiv({ cls: "habits-goal-bar" });
			if (progress >= goal) {
				bar.addClass("is-complete");
			}
			bar
				.createDiv({ cls: "habits-goal-fill" })
				.setCssProps({ "--habits-progress": `${pct}%` });
			const goalName = isPerfect(habit)
				? period === "weekly"
					? t("perfect week")
					: t("perfect month")
				: period === "weekly"
					? t("weekly goal")
					: t("monthly goal");
			row.createDiv({
				cls: "habits-stats-goal-label",
				text: t("{progress}/{goal} days · {label} · {pct}%", {
					progress,
					goal,
					label: goalName,
					pct,
				}),
			});
		}
	});

	if (paged && track) {
		renderStatsCarouselControls(container, track, pages.length);
	}
}

/**
 * Prev/next arrows plus dots (or a counter beyond seven pages) for the
 * stats carousel, mirroring the dashboard carousel controls. Page flips
 * only translate the track — nothing is re-rendered.
 */
function renderStatsCarouselControls(
	container: HTMLElement,
	track: HTMLElement,
	pageCount: number,
): void {
	let index = 0;
	const controls = container.createDiv({
		cls: "habits-carousel-controls habits-stats-carousel-controls",
	});

	const prev = controls.createEl("button", {
		cls: "habits-icon-button habits-carousel-prev",
		attr: { type: "button", "aria-label": t("Previous") },
	});
	setIcon(prev, "chevron-left");

	const dots: HTMLElement[] = [];
	let counter: HTMLElement | null = null;
	if (pageCount <= 7) {
		const dotsEl = controls.createDiv({ cls: "habits-dots" });
		for (let i = 0; i < pageCount; i++) {
			const dot = dotsEl.createEl("button", {
				cls: "habits-dot",
				attr: {
					type: "button",
					"aria-label": t("Go to position {n}", { n: i + 1 }),
				},
			});
			dot.addEventListener("click", () => {
				index = i;
				apply();
			});
			dots.push(dot);
		}
	} else {
		counter = controls.createSpan({ cls: "habits-carousel-count" });
	}

	const next = controls.createEl("button", {
		cls: "habits-icon-button habits-carousel-next",
		attr: { type: "button", "aria-label": t("Next") },
	});
	setIcon(next, "chevron-right");

	const apply = (): void => {
		track.setCssProps({
			"--habits-stats-translate": `-${index * 100}%`,
		});
		prev.toggleClass("is-disabled", index <= 0);
		next.toggleClass("is-disabled", index >= pageCount - 1);
		dots.forEach((dot, i) => dot.toggleClass("is-active", i === index));
		counter?.setText(`${index + 1} / ${pageCount}`);
	};

	prev.addEventListener("click", () => {
		if (index > 0) {
			index--;
			apply();
		}
	});
	next.addEventListener("click", () => {
		if (index < pageCount - 1) {
			index++;
			apply();
		}
	});
	apply();
}

/**
 * The AI summary card: a header with a generate/regenerate button and a body
 * holding the summary text. Summaries are only ever requested when the button
 * is pressed; a summary already generated for this exact data (see the cache
 * in ai-summary.ts) is shown immediately instead.
 */
function renderAiSummary(
	container: HTMLElement,
	habits: HabitDefinition[],
	period: StatsPeriod,
	mode: StatsRangeMode,
	today: Date,
	customRange: DateRange | undefined,
	settings: AiSummarySettings,
): void {
	const section = container.createDiv({ cls: "habits-ai-summary" });
	const header = section.createDiv({ cls: "habits-ai-summary-header" });
	const title = header.createSpan({ cls: "habits-ai-summary-title" });
	const spark = title.createSpan({ cls: "habits-ai-summary-icon" });
	setIcon(spark, "sparkles");
	title.createSpan({ text: t("AI summary") });

	const button = header.createEl("button", {
		cls: "habits-ai-summary-button",
		attr: { type: "button" },
	});
	const body = section.createDiv({ cls: "habits-ai-summary-body" });

	const showText = (text: string): void => {
		body.empty();
		body.removeClass("is-muted");
		for (const paragraph of text.split(/\n{2,}/)) {
			body.createEl("p", { text: paragraph.trim() });
		}
	};
	const showHint = (text: string): void => {
		body.empty();
		body.addClass("is-muted");
		body.createEl("p", { text });
	};

	const digest = buildStatsDigest(habits, period, mode, today, customRange);
	const cached = getCachedSummary(settings, period, mode, digest);
	if (cached) {
		showText(cached);
		button.setText(t("Regenerate"));
	} else {
		showHint(
			t(
				"Get feedback and advice on your habits for this period. Your stats are sent to the AI service you configured only when you press the button.",
			),
		);
		button.setText(t("Generate summary"));
	}

	button.addEventListener("click", () => {
		void (async () => {
			button.disabled = true;
			section.addClass("is-loading");
			showHint(t("Thinking…"));
			try {
				// Force: the button only shows "Regenerate" when a cached
				// summary is already on screen, so a click always means the
				// user wants a fresh one.
				const text = await generateSummary(
					settings,
					period,
					mode,
					digest,
					true,
				);
				showText(text);
				button.setText(t("Regenerate"));
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				showHint(
					t("Could not generate a summary: {message}", { message }),
				);
				new Notice(
					t("Could not generate a summary: {message}", { message }),
				);
			} finally {
				button.disabled = false;
				section.removeClass("is-loading");
			}
		})();
	});
}
