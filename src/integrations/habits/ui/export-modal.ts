import {
	App,
	debounce,
	Modal,
	moment,
	Notice,
	setIcon,
	Setting,
	setTooltip,
} from "obsidian";
import { t, tEn } from "../i18n";
import {
	CategoryScale,
	Chart,
	Filler,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
} from "chart.js";
import { jsPDF } from "jspdf";
import type { HabitDefinition } from "../types";
import type { AiSummarySettings } from "../settings";
import {
	buildStatsDigest,
	generateSummary,
	getCachedSummary,
} from "../ai-summary";
import {
	getStatsRange,
	habitStats,
	isComplete,
	isFlexible,
	isPausedOn,
	perfectDays,
	rangeLength,
	type DateRange,
	type HabitPeriodStats,
} from "../stats";
import { addDays, formatValue, fromDateKey, toDateKey } from "../utils";

Chart.register(
	CategoryScale,
	Filler,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
);

/** Pixels per millimetre used by the on-screen preview. */
const PX = 2.2;
/** Page margin in millimetres. */
const MARGIN = 14;
/** Longest allowed custom range, in days. */
const MAX_CUSTOM_DAYS = 92;
/** Most comments listed per habit before "+n more". */
const MAX_EXPORT_COMMENTS = 12;

/**
 * Text drawn into the exported document (and its preview). jsPDF's
 * built-in fonts cannot render CJK glyphs, so document content stays in
 * English for Chinese locales while the surrounding UI is translated.
 */
function docT(
	text: string,
	vars?: Record<string, string | number>,
): string {
	return moment.locale().startsWith("zh") ? tEn(text, vars) : t(text, vars);
}

type ExportPeriod =
	| "this-week"
	| "last-7"
	| "this-month"
	| "last-30"
	| "custom";

interface ExportOptions {
	title: string;
	period: ExportPeriod;
	customStart: string;
	customEnd: string;
	includeSummary: boolean;
	includeAiSummary: boolean;
	includeTrend: boolean;
	includeGrid: boolean;
	includeGoals: boolean;
	includeComments: boolean;
	orientation: "portrait" | "landscape";
	density: "comfortable" | "compact";
	monochrome: boolean;
}

interface RGB {
	r: number;
	g: number;
	b: number;
}

type Block =
	| { kind: "title" }
	| { kind: "summary"; tiles: { value: string; label: string }[] }
	| { kind: "ai"; lines: string[] }
	| { kind: "chart" }
	| { kind: "habit"; habit: HabitDefinition; stats: HabitPeriodStats };

/**
 * Wrap plain text into lines of at most `maxChars` characters, breaking on
 * words. Both the preview and the PDF render these exact lines, so their
 * block heights (and page breaks) can never disagree — which is why this
 * uses a character estimate instead of each renderer's own text metrics.
 */
function wrapPlainText(text: string, maxChars: number): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split(/\n+/)) {
		let line = "";
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			const candidate = line === "" ? word : `${line} ${word}`;
			if (candidate.length > maxChars && line !== "") {
				lines.push(line);
				line = word;
			} else {
				line = candidate;
			}
		}
		if (line !== "") {
			lines.push(line);
		}
	}
	return lines;
}

/** Shared layout facts used by both the preview and the PDF renderer. */
interface RenderCtx {
	pageW: number;
	pageH: number;
	contentW: number;
	contentH: number;
	/** Density scale: 1 comfortable, 0.82 compact. */
	s: number;
	range: DateRange;
	days: number;
	todayKey: string;
}

const TEXT: RGB = { r: 34, g: 34, b: 34 };
const MUTED: RGB = { r: 110, g: 110, b: 110 };
const BORDER: RGB = { r: 205, g: 205, b: 205 };
const PAUSED_FILL: RGB = { r: 234, g: 234, b: 234 };

function css(color: RGB): string {
	return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function mixWithWhite(color: RGB, ratio: number): RGB {
	const mix = (v: number): number => Math.round(v + (255 - v) * ratio);
	return { r: mix(color.r), g: mix(color.g), b: mix(color.b) };
}

/**
 * Modal for exporting stats as a printable A4 PDF.
 *
 * The left column holds the options; the right column shows a live,
 * to-scale preview of every page. Preview and PDF share the same block
 * layout maths, so page breaks in the preview match the file exactly.
 */
export class ExportModal extends Modal {
	private options: ExportOptions = {
		title: t("Habits report"),
		period: "last-7",
		customStart: toDateKey(addDays(new Date(), -6)),
		customEnd: toDateKey(new Date()),
		includeSummary: true,
		includeAiSummary: false,
		includeTrend: true,
		includeGrid: true,
		includeGoals: true,
		includeComments: true,
		orientation: "portrait",
		density: "comfortable",
		monochrome: false,
	};

	private previewEl: HTMLElement | null = null;
	private customSettings: Setting[] = [];
	private trendImage: string | null = null;
	private trendKey = "";
	private requestRefresh = debounce(() => void this.refresh(), 150, true);

	/** The generated AI summary text, once available. */
	private aiText: string | null = null;
	/** Digest the current `aiText` (or in-flight request) belongs to. */
	private aiDigest = "";
	/** True while a summary request is in flight. */
	private aiPending = false;
	/** Message shown in the block when the last request failed. */
	private aiError: string | null = null;

	constructor(
		app: App,
		private habits: HabitDefinition[],
		/** Set only when the AI summaries experimental feature is enabled. */
		private aiSettings?: AiSummarySettings,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
	}

	onOpen(): void {
		this.modalEl.addClass("habits-export-modal");
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName(t("Export stats")).setHeading();

		const body = contentEl.createDiv({ cls: "habits-export-body" });
		const controls = body.createDiv({ cls: "habits-export-controls" });
		const previewWrap = body.createDiv({
			cls: "habits-export-preview",
		});
		this.previewEl = previewWrap.createDiv({
			cls: "habits-export-pages",
		});

		this.buildControls(controls);
		// Wait a frame so the preview pane has a measurable width, then
		// keep the fit-to-width scale fresh across window resizes.
		this.contentEl.win.requestAnimationFrame(() => {
			void this.refresh();
		});
		this.contentEl.win.addEventListener("resize", this.onWinResize);
	}

	onClose(): void {
		this.contentEl.win.removeEventListener("resize", this.onWinResize);
		this.contentEl.empty();
	}

	private onWinResize = (): void => {
		this.requestRefresh();
	};

	private buildControls(root: HTMLElement): void {
		new Setting(root)
			.setName(t("Title"))
			.addText((text) =>
				text.setValue(this.options.title).onChange((value) => {
					this.options.title = value || "Habits report";
					this.requestRefresh();
				}),
			);

		new Setting(root)
			.setName(t("Date range"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("this-week", t("This week"))
					.addOption("last-7", t("Last 7 days"))
					.addOption("this-month", t("This month"))
					.addOption("last-30", t("Last 30 days"))
					.addOption("custom", t("Custom range"))
					.setValue(this.options.period)
					.onChange((value) => {
						this.options.period = value as ExportPeriod;
						this.toggleCustomSettings();
						this.requestRefresh();
					}),
			);

		const from = new Setting(root).setName(t("From")).addText((text) => {
			text.inputEl.type = "date";
			text.setValue(this.options.customStart).onChange((value) => {
				this.options.customStart = value;
				this.requestRefresh();
			});
		});
		const to = new Setting(root)
			.setName(t("To"))
			.setDesc(t("Up to {n} days.", { n: MAX_CUSTOM_DAYS }))
			.addText((text) => {
				text.inputEl.type = "date";
				text.setValue(this.options.customEnd).onChange((value) => {
					this.options.customEnd = value;
					this.requestRefresh();
				});
			});
		this.customSettings = [from, to];
		this.toggleCustomSettings();

		new Setting(root).setName(t("Content")).setHeading();
		this.contentToggle(root, t("Summary tiles"), "includeSummary");
		if (this.aiSettings) {
			new Setting(root)
				.setName(t("AI summary"))
				.setDesc(
					t(
						"Adds an AI-generated overview with feedback and advice. Your habit stats are sent to your configured AI service.",
					),
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.options.includeAiSummary)
						.onChange((value) => {
							this.options.includeAiSummary = value;
							this.requestRefresh();
						}),
				);
		}
		this.contentToggle(root, t("Completion trend chart"), "includeTrend");
		this.contentToggle(root, t("Daily grids"), "includeGrid");
		this.contentToggle(root, t("Goal progress"), "includeGoals");
		this.contentToggle(root, t("Comments"), "includeComments");

		new Setting(root).setName(t("Layout")).setHeading();
		new Setting(root)
			.setName(t("Orientation"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("portrait", t("Portrait"))
					.addOption("landscape", t("Landscape"))
					.setValue(this.options.orientation)
					.onChange((value) => {
						this.options.orientation =
							value as ExportOptions["orientation"];
						this.requestRefresh();
					}),
			);
		new Setting(root)
			.setName(t("Density"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("comfortable", t("Comfortable"))
					.addOption("compact", t("Compact"))
					.setValue(this.options.density)
					.onChange((value) => {
						this.options.density =
							value as ExportOptions["density"];
						this.requestRefresh();
					}),
			);
		new Setting(root)
			.setName(t("Monochrome"))
			.setDesc(t("Ink-friendly greys instead of accent colours."))
			.addToggle((toggle) =>
				toggle
					.setValue(this.options.monochrome)
					.onChange((value) => {
						this.options.monochrome = value;
						this.trendKey = "";
						this.requestRefresh();
					}),
			);

		new Setting(root).addButton((button) =>
			button
				.setButtonText(t("Export PDF"))
				.setCta()
				.onClick(() => void this.exportPdf()),
		);
	}

	private contentToggle(
		root: HTMLElement,
		name: string,
		key:
			| "includeSummary"
			| "includeTrend"
			| "includeGrid"
			| "includeGoals"
			| "includeComments",
	): void {
		new Setting(root).setName(name).addToggle((toggle) =>
			toggle.setValue(this.options[key]).onChange((value) => {
				this.options[key] = value;
				this.requestRefresh();
			}),
		);
	}

	private toggleCustomSettings(): void {
		const visible = this.options.period === "custom";
		for (const setting of this.customSettings) {
			setting.settingEl.toggleClass("habits-export-hidden", !visible);
		}
	}

	// ------------------------------------------------------------------
	// Shared layout

	private computeRange(): DateRange {
		const today = new Date();
		switch (this.options.period) {
			case "this-week":
				return getStatsRange(today, "weekly", "calendar");
			case "this-month":
				return getStatsRange(today, "monthly", "calendar");
			case "last-30":
				return getStatsRange(today, "monthly", "rolling");
			case "custom": {
				const start = fromDateKey(this.options.customStart);
				const end = fromDateKey(this.options.customEnd);
				if (!start || !end || start.getTime() > end.getTime()) {
					return getStatsRange(today, "weekly", "rolling");
				}
				const capped = addDays(start, MAX_CUSTOM_DAYS - 1);
				return {
					start,
					end: end.getTime() > capped.getTime() ? capped : end,
				};
			}
			default:
				return getStatsRange(today, "weekly", "rolling");
		}
	}

	private renderCtx(range: DateRange): RenderCtx {
		const portrait = this.options.orientation === "portrait";
		const pageW = portrait ? 210 : 297;
		const pageH = portrait ? 297 : 210;
		return {
			pageW,
			pageH,
			contentW: pageW - MARGIN * 2,
			contentH: pageH - MARGIN * 2,
			s: this.options.density === "compact" ? 0.82 : 1,
			range,
			days: rangeLength(range),
			todayKey: toDateKey(new Date()),
		};
	}

	private rangeLabel(range: DateRange): string {
		const fmt = (date: Date): string =>
			date.toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
		return `${fmt(range.start)} – ${fmt(range.end)}`;
	}

	private accentOf(habit?: HabitDefinition): RGB {
		if (this.options.monochrome) {
			return { r: 70, g: 70, b: 70 };
		}
		const fallback = "var(--interactive-accent)";
		return this.resolveRGB(habit?.color || fallback, {
			r: 91,
			g: 116,
			b: 214,
		});
	}

	private greenOf(): RGB {
		if (this.options.monochrome) {
			return { r: 70, g: 70, b: 70 };
		}
		return this.resolveRGB("var(--color-green, var(--text-success))", {
			r: 76,
			g: 152,
			b: 89,
		});
	}

	private resolveRGB(value: string, fallback: RGB): RGB {
		const probe = this.contentEl.doc.body.createSpan();
		probe.style.color = value;
		const resolved = probe.win.getComputedStyle(probe).color;
		probe.remove();
		const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(resolved);
		if (!match) {
			return fallback;
		}
		return {
			r: Number(match[1]),
			g: Number(match[2]),
			b: Number(match[3]),
		};
	}

	/** Columns/rows for a habit's daily grid at the current width. */
	private gridShape(ctx: RenderCtx): { cols: number; rows: number } {
		const pitch = 4.6 * ctx.s;
		const cols = Math.max(1, Math.floor((ctx.contentW + 0.8) / pitch));
		return { cols, rows: Math.ceil(ctx.days / cols) };
	}

	/** The goal (in days) to show for a habit given the range length. */
	private goalOf(habit: HabitDefinition, ctx: RenderCtx): number {
		if (ctx.days <= 10) {
			return habit.weeklyPerfect ? ctx.days : habit.weeklyTarget;
		}
		if (ctx.days >= 28) {
			return habit.monthlyPerfect ? ctx.days : habit.monthlyTarget;
		}
		return 0;
	}

	// ------------------------------------------------------------------
	// AI summary (opt-in block, experimental feature)

	/**
	 * Keep `aiText` in sync with the currently selected range. Called on
	 * every preview refresh; a request is only sent when the block is
	 * enabled and no summary (cached or in flight) exists for the range's
	 * digest, so idle refreshes never touch the network.
	 */
	private ensureAiSummary(range: DateRange): void {
		if (!this.aiSettings || !this.options.includeAiSummary) {
			return;
		}
		const digest = buildStatsDigest(
			this.habits,
			"custom",
			"calendar",
			new Date(),
			range,
		);
		if (digest === this.aiDigest && (this.aiText !== null || this.aiPending)) {
			return;
		}
		this.aiDigest = digest;
		this.aiError = null;
		this.aiText = getCachedSummary(
			this.aiSettings,
			"custom",
			"calendar",
			digest,
		);
		if (this.aiText !== null) {
			return;
		}
		this.aiPending = true;
		generateSummary(this.aiSettings, "custom", "calendar", digest)
			.then((text) => {
				// A slower response for an older range must not clobber
				// the summary of the range the user has since picked.
				if (digest === this.aiDigest) {
					this.aiText = text;
				}
			})
			.catch((error: unknown) => {
				if (digest === this.aiDigest) {
					this.aiError =
						error instanceof Error
							? error.message
							: String(error);
				}
			})
			.finally(() => {
				this.aiPending = false;
				this.requestRefresh();
			});
	}

	/** Widest line (in characters) that fits the content width at 8pt. */
	private aiMaxChars(ctx: RenderCtx): number {
		const charW = 8 * 0.3528 * 0.52 * ctx.s;
		return Math.max(20, Math.floor((ctx.contentW - 2) / charW));
	}

	/** The AI block's lines for the current state (text, loading, error). */
	private aiLines(ctx: RenderCtx): string[] {
		const text =
			this.aiText ??
			(this.aiPending
				? t("Generating AI summary…")
				: (this.aiError ??
					t("The AI summary will be generated when you export.")));
		return wrapPlainText(text, this.aiMaxChars(ctx));
	}

	private blockHeight(block: Block, ctx: RenderCtx): number {
		const s = ctx.s;
		switch (block.kind) {
			case "title":
				return 18 * s;
			case "summary":
				return 22 * s;
			case "ai":
				return 5 * s + block.lines.length * 4.5 * s + 2;
			case "chart":
				return 8 * s + ctx.contentW * 0.3;
			case "habit": {
				let height = 13 * s + 4;
				if (this.options.includeGrid) {
					height += this.gridShape(ctx).rows * 4.6 * ctx.s + 2;
				}
				if (
					this.options.includeGoals &&
					this.goalOf(block.habit, ctx) > 0
				) {
					height += 6 * s;
				}
				if (this.options.includeComments) {
					const count = this.commentsInRange(
						block.habit,
						ctx,
					).length;
					const lines =
						Math.min(count, MAX_EXPORT_COMMENTS) +
						(count > MAX_EXPORT_COMMENTS ? 1 : 0);
					if (lines > 0) {
						height += lines * 4.5 * s + 1;
					}
				}
				return height;
			}
		}
	}

	private buildBlocks(ctx: RenderCtx, forPdf = false): Block[] {
		const today = new Date();
		const blocks: Block[] = [{ kind: "title" }];

		const allStats = this.habits.map((habit) =>
			habitStats(habit, ctx.range, today),
		);
		if (this.options.includeSummary) {
			const totalDays = allStats.reduce((sum, s) => sum + s.days, 0);
			const totalCompleted = allStats.reduce(
				(sum, s) => sum + s.completed,
				0,
			);
			const rate =
				totalDays > 0
					? Math.round((totalCompleted / totalDays) * 100)
					: 0;
			const best = allStats.reduce(
				(max, s) => Math.max(max, s.current),
				0,
			);
			blocks.push({
				kind: "summary",
				tiles: [
					{ value: `${rate}%`, label: docT("Completion") },
					{ value: `${totalCompleted}`, label: docT("Completions") },
					{
						value: `${perfectDays(this.habits, ctx.range, today)}`,
						label: docT("Perfect days"),
					},
					{ value: `${best}`, label: docT("Best streak") },
				],
			});
		}
		// The preview shows the block in every state (text, generating,
		// error) so the user sees what is happening; the PDF itself only
		// ever includes real text — a failed generation is dropped rather
		// than printed as an error message.
		if (
			this.options.includeAiSummary &&
			this.aiSettings &&
			(!forPdf || this.aiText !== null)
		) {
			blocks.push({ kind: "ai", lines: this.aiLines(ctx) });
		}
		if (this.options.includeTrend && this.trendImage) {
			blocks.push({ kind: "chart" });
		}
		this.habits.forEach((habit, i) => {
			blocks.push({ kind: "habit", habit, stats: allStats[i] });
		});
		return blocks;
	}

	private paginate(blocks: Block[], ctx: RenderCtx): Block[][] {
		const pages: Block[][] = [[]];
		let used = 0;
		for (const block of blocks) {
			const height = this.blockHeight(block, ctx) + 3 * ctx.s;
			if (
				used + height > ctx.contentH &&
				pages[pages.length - 1].length > 0
			) {
				pages.push([]);
				used = 0;
			}
			pages[pages.length - 1].push(block);
			used += height;
		}
		return pages;
	}

	// ------------------------------------------------------------------
	// Trend chart image (shared by preview and PDF)

	private async ensureTrendImage(ctx: RenderCtx): Promise<void> {
		if (!this.options.includeTrend || this.habits.length === 0) {
			this.trendImage = null;
			return;
		}
		const key = `${toDateKey(ctx.range.start)}|${toDateKey(ctx.range.end)}|${this.options.monochrome}`;
		if (key === this.trendKey && this.trendImage) {
			return;
		}
		this.trendKey = key;

		const labels: string[] = [];
		const data: (number | null)[] = [];
		let cursor = new Date(ctx.range.start);
		while (cursor.getTime() <= ctx.range.end.getTime()) {
			const dateKey = toDateKey(cursor);
			labels.push(
				cursor.toLocaleDateString(undefined, {
					day: "numeric",
					month: "short",
				}),
			);
			if (dateKey > ctx.todayKey) {
				data.push(null);
			} else {
				const active = this.habits.filter(
					(habit) => !isPausedOn(habit, dateKey),
				);
				data.push(
					active.length > 0
						? Math.round(
								(active.filter((habit) =>
									isComplete(habit, dateKey),
								).length /
									active.length) *
									100,
							)
						: null,
				);
			}
			cursor = addDays(cursor, 1);
		}

		const accent = css(this.accentOf());
		const fill = css(mixWithWhite(this.accentOf(), 0.82));
		const canvas = createEl("canvas");
		canvas.width = 1400;
		canvas.height = 420;
		const chart = new Chart(canvas, {
			type: "line",
			data: {
				labels,
				datasets: [
					{
						data,
						borderColor: accent,
						backgroundColor: fill,
						fill: true,
						tension: 0.3,
						pointRadius: 2,
						pointBackgroundColor: accent,
						spanGaps: false,
					},
				],
			},
			options: {
				responsive: false,
				animation: false,
				devicePixelRatio: 1,
				plugins: { legend: { display: false } },
				scales: {
					x: {
						grid: { display: false },
						ticks: {
							color: "#666666",
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 10,
						},
					},
					y: {
						beginAtZero: true,
						max: 100,
						grid: { color: "#e3e3e3" },
						ticks: {
							color: "#666666",
							callback: (value) => `${String(value)}%`,
						},
					},
				},
			},
		});
		this.trendImage = canvas.toDataURL("image/png");
		chart.destroy();
	}

	// ------------------------------------------------------------------
	// Preview rendering

	private async refresh(): Promise<void> {
		if (!this.previewEl) {
			return;
		}
		const range = this.computeRange();
		const ctx = this.renderCtx(range);
		this.ensureAiSummary(range);
		await this.ensureTrendImage(ctx);

		const root = this.previewEl;
		root.empty();

		if (this.habits.length === 0) {
			root.createDiv({
				cls: "habits-export-empty",
				text: t("No habits to export yet."),
			});
			return;
		}

		const pages = this.paginate(this.buildBlocks(ctx), ctx);

		// Fit each page to the preview pane's width, like a PDF viewer:
		// the page keeps its true A4 pixel size and is scaled via a CSS
		// transform, so the layout maths stay exact.
		const scroller = root.parentElement;
		let avail = scroller ? scroller.clientWidth - 28 : 0;
		if (avail < 100) {
			avail = 520;
		}
		const scale = Math.min(1.5, avail / (ctx.pageW * PX));
		this.renderPages(root, ctx, pages, scale, true);
	}

	/** Render every page into `root` at the given scale. */
	private renderPages(
		root: HTMLElement,
		ctx: RenderCtx,
		pages: Block[][],
		scale: number,
		zoomable: boolean,
	): void {
		pages.forEach((page, index) => {
			const outer = root.createDiv({
				cls: "habits-export-page-outer",
			});
			outer.setCssProps({
				"--hx-outer-w": `${ctx.pageW * PX * scale}px`,
				"--hx-outer-h": `${ctx.pageH * PX * scale}px`,
			});
			if (zoomable) {
				outer.addClass("is-zoomable");
				setTooltip(outer, "Click to view full size");
				const hint = outer.createDiv({
					cls: "habits-export-zoom-hint",
				});
				setIcon(hint, "zoom-in");
				outer.addEventListener("click", () => {
					this.openLightbox();
				});
			}
			const pageEl = outer.createDiv({ cls: "habits-export-page" });
			pageEl.setCssProps({
				"--hx-page-w": `${ctx.pageW * PX}px`,
				"--hx-page-h": `${ctx.pageH * PX}px`,
				"--hx-page-pad": `${MARGIN * PX}px`,
				"--hx-scale": String(scale),
			});
			for (const block of page) {
				this.renderBlockHtml(block, pageEl, ctx);
			}
			pageEl.createDiv({
				cls: "habits-export-page-number",
				text: `${index + 1} / ${pages.length}`,
			});
		});
	}

	/** Full-size page viewer overlaid on the whole window. */
	private openLightbox(): void {
		const range = this.computeRange();
		const ctx = this.renderCtx(range);
		const pages = this.paginate(this.buildBlocks(ctx), ctx);

		const overlay = this.containerEl.createDiv({
			cls: "habits-export-lightbox",
		});
		const win = overlay.win;
		const scale = Math.max(
			0.5,
			Math.min(
				(win.innerWidth * 0.85) / (ctx.pageW * PX),
				(win.innerHeight * 0.88) / (ctx.pageH * PX),
			),
		);

		const close = overlay.createEl("button", {
			cls: "habits-export-lightbox-close",
			attr: { type: "button", "aria-label": "Close full-size view" },
		});
		setIcon(close, "x");

		const pagesEl = overlay.createDiv({
			cls: "habits-export-lightbox-pages",
		});
		this.renderPages(pagesEl, ctx, pages, scale, false);

		overlay.addEventListener("click", () => {
			overlay.remove();
		});
	}

	private renderBlockHtml(
		block: Block,
		pageEl: HTMLElement,
		ctx: RenderCtx,
	): void {
		const s = ctx.s;
		const el = pageEl.createDiv({ cls: "habits-export-block" });
		el.setCssProps({
			"--hx-block-h": `${this.blockHeight(block, ctx) * PX}px`,
			"--hx-block-gap": `${3 * s * PX}px`,
		});
		const font = (target: HTMLElement, pt: number): void => {
			target.addClass("habits-export-text");
			target.setCssProps({
				"--hx-font": `${pt * 0.3528 * PX * s}px`,
			});
		};

		if (block.kind === "title") {
			font(
				el.createDiv({
					cls: "habits-export-title",
					text: this.options.title,
				}),
				16,
			);
			font(
				el.createDiv({
					cls: "habits-export-subtitle",
					text: docT("{range} · exported {date}", {
						range: this.rangeLabel(ctx.range),
						date: new Date().toLocaleDateString(),
					}),
				}),
				9,
			);
			return;
		}

		if (block.kind === "summary") {
			el.addClass("habits-export-summary");
			for (const tile of block.tiles) {
				const tileEl = el.createDiv({ cls: "habits-export-tile" });
				font(
					tileEl.createDiv({
						cls: "habits-export-tile-value",
						text: tile.value,
					}),
					13,
				);
				font(
					tileEl.createDiv({
						cls: "habits-export-tile-label",
						text: tile.label,
					}),
					7,
				);
			}
			return;
		}

		if (block.kind === "ai") {
			font(
				el.createDiv({
					cls: "habits-export-section",
					text: docT("AI summary"),
				}),
				9,
			);
			for (const lineText of block.lines) {
				const line = el.createDiv({ cls: "habits-export-comment" });
				line.setCssProps({
					"--hx-line-h": `${4.5 * ctx.s * PX}px`,
				});
				line.setText(lineText);
				font(line, 8);
			}
			return;
		}

		if (block.kind === "chart") {
			font(
				el.createDiv({
					cls: "habits-export-section",
					text: docT("Completion trend"),
				}),
				9,
			);
			if (this.trendImage) {
				el.createEl("img", {
					cls: "habits-export-chart",
					attr: { src: this.trendImage, alt: "Completion trend" },
				});
			}
			return;
		}

		const { habit, stats } = block;
		const accent = this.accentOf(habit);
		el.addClass("habits-export-habit");
		el.setCssProps({ "--hx-accent": css(accent) });

		font(
			el.createDiv({
				cls: "habits-export-habit-name",
				text: habit.name + (habit.paused ? ` ${docT("(paused)")}` : ""),
			}),
			11,
		);
		font(
			el.createDiv({
				cls: "habits-export-habit-meta",
				text: this.habitMetaLine(habit, stats),
			}),
			8,
		);

		if (this.options.includeGrid) {
			const grid = el.createDiv({ cls: "habits-export-grid" });
			grid.setCssProps({
				"--hx-cell": `${3.8 * s * PX}px`,
				"--hx-cell-gap": `${0.8 * s * PX}px`,
			});
			let cursor = new Date(ctx.range.start);
			while (cursor.getTime() <= ctx.range.end.getTime()) {
				const dateKey = toDateKey(cursor);
				const style = this.cellStyle(habit, dateKey, ctx, accent);
				grid.createDiv({ cls: "habits-export-cell" }).setCssProps({
					"--hx-fill": css(style.fill),
					"--hx-border": css(style.border),
				});
				cursor = addDays(cursor, 1);
			}
		}

		if (this.options.includeGoals) {
			const goal = this.goalOf(habit, ctx);
			if (goal > 0) {
				font(
					el.createDiv({
						cls: "habits-export-goal",
						text: docT("Goal: {completed}/{goal} days met", {
						completed: Math.min(stats.completed, goal),
						goal,
					}),
					}),
					8,
				);
			}
		}

		this.renderCommentsHtml(el, habit, ctx, font);
	}

	private habitMetaLine(
		habit: HabitDefinition,
		stats: HabitPeriodStats,
	): string {
		const unit = habit.unit || (habit.type === "timed" ? "min" : "");
		const total = isFlexible(habit)
			? docT(
					habit.frequency === "flexibleWeekly"
						? "{completed}/{days} weeks"
						: "{completed}/{days} months",
					{ completed: stats.completed, days: stats.days },
				)
			: habit.type === "binary"
				? docT("{completed}/{days} days", {
						completed: stats.completed,
						days: stats.days,
					})
				: docT("{total} total", {
						total: `${formatValue(stats.total)}${unit ? ` ${unit}` : ""}`,
					});
		return docT("{rate}% · {total} · streak {current} (best {best})", {
			rate: Math.round(stats.rate * 100),
			total,
			current: stats.current,
			best: stats.best,
		});
	}

	private cellStyle(
		habit: HabitDefinition,
		dateKey: string,
		ctx: RenderCtx,
		accent: RGB,
	): { fill: RGB; border: RGB } {
		const white: RGB = { r: 255, g: 255, b: 255 };
		if (dateKey > ctx.todayKey) {
			return { fill: white, border: mixWithWhite(BORDER, 0.5) };
		}
		if (isPausedOn(habit, dateKey)) {
			return { fill: PAUSED_FILL, border: PAUSED_FILL };
		}
		if (isComplete(habit, dateKey)) {
			return { fill: accent, border: accent };
		}
		if ((habit.records[dateKey] ?? 0) > 0) {
			const partial = mixWithWhite(accent, 0.65);
			return { fill: partial, border: partial };
		}
		return { fill: white, border: BORDER };
	}

	// ------------------------------------------------------------------
	// PDF rendering

	private async exportPdf(): Promise<void> {
		if (this.habits.length === 0) {
			new Notice(t("No habits to export yet."));
			return;
		}
		const range = this.computeRange();
		const ctx = this.renderCtx(range);

		// The AI summary must be in hand before the pages are laid out —
		// its block height depends on the text. Waiting here covers both a
		// request still in flight and one never started (e.g. the user
		// enabled the toggle and exported immediately).
		if (
			this.aiSettings &&
			this.options.includeAiSummary &&
			this.aiText === null
		) {
			new Notice(t("Generating AI summary…"));
			const digest = buildStatsDigest(
				this.habits,
				"custom",
				"calendar",
				new Date(),
				range,
			);
			this.aiDigest = digest;
			try {
				this.aiText = await generateSummary(
					this.aiSettings,
					"custom",
					"calendar",
					digest,
				);
				this.aiError = null;
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				new Notice(
					t("Could not generate a summary: {message}", { message }),
				);
				this.aiError = message;
			}
			this.requestRefresh();
		}

		await this.ensureTrendImage(ctx);
		const pages = this.paginate(this.buildBlocks(ctx, true), ctx);

		const doc = new jsPDF({
			orientation: this.options.orientation,
			unit: "mm",
			format: "a4",
		});
		doc.setFont("helvetica", "normal");

		pages.forEach((page, index) => {
			if (index > 0) {
				doc.addPage();
			}
			let y = MARGIN;
			for (const block of page) {
				this.drawBlockPdf(doc, block, y, ctx);
				y += this.blockHeight(block, ctx) + 3 * ctx.s;
			}
			doc.setFontSize(7 * ctx.s);
			doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
			doc.text(
				`${index + 1} / ${pages.length}`,
				ctx.pageW / 2,
				ctx.pageH - 6,
				{ align: "center" },
			);
		});

		const start = toDateKey(range.start);
		const end = toDateKey(range.end);
		let path = `Habits export ${start} to ${end}.pdf`;
		let counter = 1;
		while (this.app.vault.getAbstractFileByPath(path)) {
			path = `Habits export ${start} to ${end} (${counter++}).pdf`;
		}
		await this.app.vault.createBinary(
			path,
			doc.output("arraybuffer"),
		);
		new Notice(t('Exported to "{path}" in your vault.', { path }));
		this.close();
	}

	/** Comments recorded inside the range, oldest first. */
	private commentsInRange(
		habit: HabitDefinition,
		ctx: RenderCtx,
	): { date: string; text: string }[] {
		const startKey = toDateKey(ctx.range.start);
		const endKey = toDateKey(ctx.range.end);
		return Object.entries(habit.comments)
			.filter(([key]) => key >= startKey && key <= endKey)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, text]) => ({ date, text }));
	}

	/** One-line-per-comment list under a habit's block (preview). */
	private renderCommentsHtml(
		el: HTMLElement,
		habit: HabitDefinition,
		ctx: RenderCtx,
		font: (target: HTMLElement, pt: number) => void,
	): void {
		if (!this.options.includeComments) {
			return;
		}
		const comments = this.commentsInRange(habit, ctx);
		const shown = comments.slice(0, MAX_EXPORT_COMMENTS);
		for (const comment of shown) {
			const line = el.createDiv({ cls: "habits-export-comment" });
			line.setCssProps({
				"--hx-line-h": `${4.5 * ctx.s * PX}px`,
			});
			line.setText(`${comment.date} — ${comment.text}`);
			font(line, 8);
		}
		if (comments.length > shown.length) {
			const more = el.createDiv({ cls: "habits-export-comment" });
			more.setCssProps({
				"--hx-line-h": `${4.5 * ctx.s * PX}px`,
			});
			more.setText(
				docT("+{n} more", { n: comments.length - shown.length }),
			);
			font(more, 8);
		}
	}

	/** One-line-per-comment list under a habit's block (PDF). */
	private drawCommentsPdf(
		doc: jsPDF,
		habit: HabitDefinition,
		ctx: RenderCtx,
		x: number,
		startY: number,
	): void {
		if (!this.options.includeComments) {
			return;
		}
		const comments = this.commentsInRange(habit, ctx);
		if (comments.length === 0) {
			return;
		}
		const s = ctx.s;
		const shown = comments.slice(0, MAX_EXPORT_COMMENTS);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8 * s);
		doc.setTextColor(85, 85, 85);
		let y = startY;
		for (const comment of shown) {
			y += 4.5 * s;
			const lines = doc.splitTextToSize(
				`${comment.date} — ${comment.text}`,
				ctx.contentW - 6,
			) as string[];
			doc.text(lines[0] ?? "", x + 4, y);
		}
		if (comments.length > shown.length) {
			y += 4.5 * s;
			doc.text(
				docT("+{n} more", { n: comments.length - shown.length }),
				x + 4,
				y,
			);
		}
	}

	private drawBlockPdf(
		doc: jsPDF,
		block: Block,
		y: number,
		ctx: RenderCtx,
	): void {
		const s = ctx.s;
		const x = MARGIN;

		if (block.kind === "ai") {
			doc.setFont("helvetica", "bold");
			doc.setFontSize(9 * s);
			doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
			doc.text(docT("AI summary"), x, y + 4 * s);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(8 * s);
			doc.setTextColor(85, 85, 85);
			let ty = y + 4 * s;
			for (const line of block.lines) {
				ty += 4.5 * s;
				doc.text(line, x, ty);
			}
			return;
		}

		if (block.kind === "title") {
			doc.setFont("helvetica", "bold");
			doc.setFontSize(16 * s);
			doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
			doc.text(this.options.title, x, y + 7 * s);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(9 * s);
			doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
			doc.text(
				docT("{range} · exported {date}", {
					range: this.rangeLabel(ctx.range),
					date: new Date().toLocaleDateString(),
				}),
				x,
				y + 13 * s,
			);
			return;
		}

		if (block.kind === "summary") {
			const gap = 4;
			const tileW =
				(ctx.contentW - gap * (block.tiles.length - 1)) /
				block.tiles.length;
			const tileH = 18 * s;
			block.tiles.forEach((tile, i) => {
				const tx = x + i * (tileW + gap);
				doc.setFillColor(246, 246, 246);
				doc.setDrawColor(BORDER.r, BORDER.g, BORDER.b);
				doc.roundedRect(tx, y, tileW, tileH, 1.6, 1.6, "FD");
				doc.setFont("helvetica", "bold");
				doc.setFontSize(13 * s);
				doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
				doc.text(tile.value, tx + tileW / 2, y + 8 * s, {
					align: "center",
				});
				doc.setFont("helvetica", "normal");
				doc.setFontSize(7 * s);
				doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
				doc.text(tile.label, tx + tileW / 2, y + 14 * s, {
					align: "center",
				});
			});
			return;
		}

		if (block.kind === "chart") {
			doc.setFont("helvetica", "bold");
			doc.setFontSize(9 * s);
			doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
			doc.text(docT("Completion trend"), x, y + 4 * s);
			if (this.trendImage) {
				doc.addImage(
					this.trendImage,
					"PNG",
					x,
					y + 8 * s,
					ctx.contentW,
					ctx.contentW * 0.3,
				);
			}
			return;
		}

		const { habit, stats } = block;
		const accent = this.accentOf(habit);
		doc.setFillColor(accent.r, accent.g, accent.b);
		doc.rect(x, y, 1.4, 11 * s, "F");

		doc.setFont("helvetica", "bold");
		doc.setFontSize(11 * s);
		doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
		doc.text(
			habit.name + (habit.paused ? ` ${docT("(paused)")}` : ""),
			x + 4,
			y + 4.5 * s,
		);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8 * s);
		doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
		doc.text(this.habitMetaLine(habit, stats), x + 4, y + 10 * s);

		let cursorY = y + 13 * s + 2;
		if (this.options.includeGrid) {
			const { cols } = this.gridShape(ctx);
			const pitch = 4.6 * s;
			const size = 3.8 * s;
			let day = 0;
			let cursor = new Date(ctx.range.start);
			while (cursor.getTime() <= ctx.range.end.getTime()) {
				const dateKey = toDateKey(cursor);
				const col = day % cols;
				const row = Math.floor(day / cols);
				const cx = x + col * pitch;
				const cy = cursorY + row * pitch;
				const style = this.cellStyle(habit, dateKey, ctx, accent);
				doc.setFillColor(style.fill.r, style.fill.g, style.fill.b);
				doc.setDrawColor(
					style.border.r,
					style.border.g,
					style.border.b,
				);
				doc.roundedRect(cx, cy, size, size, 0.6, 0.6, "FD");
				day++;
				cursor = addDays(cursor, 1);
			}
			cursorY += this.gridShape(ctx).rows * pitch + 2;
		}

		if (this.options.includeGoals) {
			const goal = this.goalOf(habit, ctx);
			if (goal > 0) {
				doc.setFontSize(8 * s);
				doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
				doc.text(
					docT("Goal: {completed}/{goal} days met", {
						completed: Math.min(stats.completed, goal),
						goal,
					}),
					x + 4,
					cursorY + 4 * s,
				);
				cursorY += 6 * s;
			}
		}

		this.drawCommentsPdf(doc, habit, ctx, x, cursorY);
	}
}
