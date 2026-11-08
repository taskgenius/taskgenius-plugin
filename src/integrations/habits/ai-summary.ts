import { moment, requestUrl } from "obsidian";
import type { AiSummarySettings } from "./settings";
import type { HabitDefinition } from "./types";
import {
	getStatsRange,
	habitStats,
	perfectDays,
	rangeLength,
	trackingStartKey,
	type DateRange,
	type StatsPeriod,
	type StatsRangeMode,
} from "./stats";
import { formatValue, toDateKey } from "./utils";

/**
 * Most habits ever included in a digest. Keeps the prompt (and its cost)
 * bounded for users tracking an unusually large number of habits.
 */
const MAX_HABITS = 40;

/** Most cached summaries kept in memory before the oldest are dropped. */
const CACHE_LIMIT = 20;

/**
 * Completed summaries keyed by everything that influenced them (model,
 * period, mode and the digest itself). Because the digest is built from the
 * logged records, any change to the underlying data produces a new key —
 * so a cached summary is never stale, and switching tabs back and forth
 * never repeats an API call.
 */
const cache = new Map<string, string>();

function cacheKey(
	settings: AiSummarySettings,
	period: StatsPeriod,
	mode: StatsRangeMode,
	digest: string,
): string {
	return `${settings.model}|${period}|${mode}|${digest}`;
}

/** A cached summary for this exact data, or null when none exists yet. */
export function getCachedSummary(
	settings: AiSummarySettings,
	period: StatsPeriod,
	mode: StatsRangeMode,
	digest: string,
): string | null {
	return cache.get(cacheKey(settings, period, mode, digest)) ?? null;
}

/**
 * Build a compact plain-text digest of the stats the user is looking at.
 * This is the only data ever sent to the AI service — habit names and
 * aggregate numbers, never per-day records or comments.
 */
export function buildStatsDigest(
	habits: HabitDefinition[],
	period: StatsPeriod,
	mode: StatsRangeMode,
	today: Date,
	/** The user-picked range; only used when `period` is `custom`. */
	customRange?: DateRange,
): string {
	const range = getStatsRange(today, period, mode, customRange);
	const length = rangeLength(range);
	const all = habits.map((habit) => habitStats(habit, range, today));

	const totalDays = all.reduce((sum, s) => sum + s.days, 0);
	const totalCompleted = all.reduce((sum, s) => sum + s.completed, 0);
	const overallRate =
		totalDays > 0 ? Math.round((totalCompleted / totalDays) * 100) : 0;
	const perfect = perfectDays(habits, range, today);

	const periodLine =
		period === "custom"
			? `Period: custom date range of ${length} days, ${toDateKey(range.start)} to ${toDateKey(range.end)}.`
			: `Period: ${period === "weekly" ? "week" : "month"} (${
					mode === "rolling"
						? `rolling last ${length} days`
						: "calendar"
				}), ${toDateKey(range.start)} to ${toDateKey(range.end)}.`;
	const lines: string[] = [
		periodLine,
		`Overall completion: ${overallRate}%. Perfect days (every habit done): ${perfect}.`,
		`Habits (${habits.length}):`,
	];

	habits.slice(0, MAX_HABITS).forEach((habit, i) => {
		const s = all[i];
		const parts: string[] = [];
		if (habit.goalDirection === "max") {
			parts.push(
				habit.type === "binary"
					? "avoiding entirely"
					: `limit of ${formatValue(habit.target)}${habit.unit ? ` ${habit.unit}` : ""} per day`,
			);
			parts.push(`${s.completed}/${s.days} days within limit`);
			if (habit.type !== "binary") {
				parts.push(
					`${formatValue(s.total)}${habit.unit ? ` ${habit.unit}` : ""} consumed in period`,
				);
			}
		} else {
			const period =
				habit.frequency === "flexibleWeekly"
					? "per week, any day"
					: habit.frequency === "flexibleMonthly"
						? "per month, any day"
						: "per day";
			if (habit.type === "repetition") {
				parts.push(
					`target ${formatValue(habit.target)}${habit.unit ? ` ${habit.unit}` : ""} ${period}`,
				);
			} else if (habit.type === "timed") {
				parts.push(`target ${habit.target} min ${period}`);
			} else if (habit.frequency === "flexibleWeekly") {
				parts.push(`target ${habit.target}x per week, any day`);
			} else if (habit.frequency === "flexibleMonthly") {
				parts.push(`target ${habit.target}x per month, any day`);
			}
			parts.push(`${s.completed}/${s.days} due days completed`);
			if (habit.type !== "binary") {
				parts.push(
					`${formatValue(s.total)}${habit.unit ? ` ${habit.unit}` : habit.type === "timed" ? " min" : ""} total`,
				);
			}
		}
		if (habit.frequency === "interval") {
			parts.push(`due every ${habit.intervalDays} days`);
		} else if (
			habit.frequency === "flexibleWeekly" ||
			habit.frequency === "flexibleMonthly"
		) {
			// Already covered by the target line above.
		} else if (habit.frequency !== "daily") {
			parts.push(`due ${habit.frequency}`);
		}
		if (habit.times.length > 0) {
			parts.push(`planned at ${habit.times.join(", ")}`);
		}
		parts.push(`${Math.round(s.rate * 100)}% rate`);
		parts.push(`current streak ${s.current}, best ${s.best}`);
		// Weekly/monthly goals don't apply to an arbitrary custom range.
		if (period !== "custom") {
			const goal =
				period === "weekly"
					? habit.weeklyTarget
					: habit.monthlyTarget;
			const isPerfect =
				period === "weekly"
					? habit.weeklyPerfect
					: habit.monthlyPerfect;
			if (isPerfect) {
				parts.push(`aiming for a perfect ${period.replace("ly", "")}`);
			} else if (goal > 0) {
				parts.push(`${period} goal ${s.completed}/${goal} days`);
			}
		}
		if (habit.paused) {
			parts.push("currently paused");
		}
		const startKey = trackingStartKey(habit, today);
		if (startKey > toDateKey(range.start)) {
			// Partially tracked period: stats above already exclude earlier
			// days, but the model should know the window is shorter.
			parts.push(`only tracked since ${startKey}`);
		}
		lines.push(`- ${habit.name}: ${parts.join(", ")}`);
	});
	if (habits.length > MAX_HABITS) {
		lines.push(`(and ${habits.length - MAX_HABITS} more habits omitted)`);
	}
	return lines.join("\n");
}

function systemPrompt(period: StatsPeriod): string {
	const periodLabel =
		period === "weekly"
			? "current week"
			: period === "monthly"
				? "current month"
				: "date range they selected";
	return [
		"You are a supportive, practical habit coach inside a habit-tracking app.",
		`You are given a user's habit statistics for the ${periodLabel}.`,
		"Write a short summary of 4 to 6 sentences in plain prose — no markdown, no headings, no bullet points.",
		"Briefly acknowledge what is going well, point out the habit or two that most needs attention, and give one or two specific, actionable suggestions for improvement.",
		"Habits marked as limits are ones the user wants to stay under, so low totals there are good.",
		"Be encouraging but honest; never invent numbers that are not in the data.",
		`Respond in the language with locale code "${moment.locale()}".`,
	].join(" ");
}

/**
 * Request a summary from the configured OpenAI-compatible endpoint.
 * Results are cached (see {@link getCachedSummary}); the API key is sent
 * only as an Authorization header and may be blank for local endpoints
 * such as Ollama or LM Studio.
 */
export async function generateSummary(
	settings: AiSummarySettings,
	period: StatsPeriod,
	mode: StatsRangeMode,
	digest: string,
	/** Skip the cache and request a fresh summary (the Regenerate button). */
	force = false,
): Promise<string> {
	const key = cacheKey(settings, period, mode, digest);
	const cached = cache.get(key);
	if (cached && !force) {
		return cached;
	}

	const base = settings.baseUrl.trim().replace(/\/+$/, "");
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (settings.apiKey.trim() !== "") {
		headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
	}
	const response = await requestUrl({
		url: `${base}/chat/completions`,
		method: "POST",
		headers,
		body: JSON.stringify({
			model: settings.model,
			messages: [
				{ role: "system", content: systemPrompt(period) },
				{ role: "user", content: digest },
			],
			// Generous cap: on reasoning models (e.g. Gemini 2.5) internal
			// "thinking" tokens count against this limit, so a tight cap
			// truncates the visible summary mid-sentence. The prompt already
			// keeps the actual reply short.
			max_tokens: 4000,
			temperature: 0.7,
		}),
		throw: false,
	});

	if (response.status >= 400) {
		let detail = `HTTP ${response.status}`;
		try {
			const err = (
				response.json as { error?: { message?: string } } | null
			)?.error?.message;
			if (err) {
				detail = err;
			}
		} catch {
			// Non-JSON error body; keep the status code.
		}
		throw new Error(detail);
	}

	const text = (
		response.json as {
			choices?: { message?: { content?: string } }[];
		} | null
	)?.choices?.[0]?.message?.content?.trim();
	if (!text) {
		throw new Error("The AI service returned an empty response.");
	}

	if (cache.size >= CACHE_LIMIT) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) {
			cache.delete(oldest);
		}
	}
	cache.set(key, text);
	return text;
}
