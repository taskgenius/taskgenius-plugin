import {
	App,
	debounce,
	Events,
	MarkdownRenderChild,
	Menu,
	type HoverParent,
	type HoverPopover,
	normalizePath,
	Notice,
	setIcon,
	setTooltip,
	TFile,
} from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { HabitDefinition } from "../types";
import { HabitModal } from "./habit-modal";
import { MissedHabitsModal } from "./missed-habits-modal";
import { createNoteHabitEntry, notePathForDate } from "../note-habit";
import { ConfirmModal } from "./confirm-modal";
import { ExportModal } from "./export-modal";
import {
	addDayStatusItems,
	dayStatus,
	renderClosedHabits,
	scheduleSnoozeRefresh,
	type ClosedHabit,
} from "./day-status";
import { t } from "../i18n";
import { renderStatsView } from "./stats-view";
import {
	flexiblePeriodTotal,
	isActive,
	isComplete as isCompleteOn,
	isFlexible,
	isPausedOn,
	limitOf,
	missedInstances,
	normalizeCustomRange,
	rescheduleSource,
	type DateRange,
	type StatsPeriod,
	type StatsRangeMode,
} from "../stats";
import { applyHabitIcon } from "./icon-suggest-modal";
import { CommentSuggest } from "./comment-suggest";
import { renderComment } from "../comment-text";
import {
	addDays,
	allowsDecimals,
	cleanValue,
	formatValue,
	formatTimeOfDay,
	friendlyDateLabel,
	fromDateKey,
	groupHabits,
	habitScheduleLabel,
	habitAccent,
	parseNoteDate,
	registerLongPress,
	roundValue,
	sectionLabel,
	sortHabits,
	stepOf,
	toDateKey,
	type HabitSection,
} from "../utils";

const MOBILE_BREAKPOINT = 768;

/**
 * Renders the interactive habits dashboard for a `habits` code block.
 *
 * The dashboard shows one card per habit in a carousel and lets the user log
 * progress for the currently selected day.
 */
export class HabitsDashboard
	extends MarkdownRenderChild
	implements HoverParent
{
	/** Set by Obsidian's page-preview plugin when a comment link is hovered. */
	hoverPopover: HoverPopover | null = null;
	private habits: HabitDefinition[] = [];
	private selectedDate: Date = new Date();
	private index = 0;
	private lastPerView = 1;
	private mode: "dashboard" | "stats" = "dashboard";
	private statsPeriod: StatsPeriod = "weekly";
	private statsRange: StatsRangeMode = "rolling";
	/** User-picked range for the custom stats tab (null until first use). */
	private customRange: DateRange | null = null;

	private root: HTMLElement;
	private trackEl: HTMLElement | null = null;
	/** Suppresses event-driven reloads while an animation sequence plays. */
	private suppressAutoReload = false;
	/** Whether the "hidden for today" list under the cards is expanded. */
	private closedOpen = false;
	/** Cancels the pending refresh for when a snooze ends. */
	private cancelSnoozeRefresh: () => void = () => {};
	/**
	 * Days whose current "perfect episode" has already been celebrated, so
	 * confirming a clean limit habit can't replay the celebration on every
	 * tap. An action that breaks the perfect day (a slip, un-doing a habit)
	 * removes the day again, re-arming the celebration for when the day
	 * becomes perfect once more.
	 */
	private celebratedDays = new Set<string>();
	/** Live comment autocompletes, one per rendered card. */
	private commentSuggests: CommentSuggest[] = [];

	constructor(
		private app: App,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
		private pluginEvents: Events,
		private sourcePath: string,
		root: HTMLElement,
	) {
		super(root);
		this.root = root;
	}

	/**
	 * When embedded in a daily note (a note whose name contains a date),
	 * the dashboard opens on that note's date instead of today.
	 */
	private dailyNoteDate(): Date | null {
		const settings = this.getSettings();
		if (!settings.followDailyNoteDate) {
			return null;
		}
		const base = (this.sourcePath.split("/").pop() ?? "").replace(
			/\.md$/,
			"",
		);
		const format = settings.dailyNoteDateFormat?.trim() || "YYYY-MM-DD";
		return parseNoteDate(base, format);
	}

	onload(): void {
		this.root.addClass("habits-dashboard");
		const noteDate = this.dailyNoteDate();
		if (noteDate) {
			this.selectedDate = noteDate;
		}
		this.registerDomEvent(window, "resize", () => this.handleResize());

		// Keep the dashboard fresh: reload whenever habit notes change on
		// disk (from any pane, sync, or manual edits) or settings change.
		const requestReload = debounce(() => this.autoReload(), 250, true);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (this.isHabitFile(file.path)) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (this.isHabitFile(file.path)) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (this.isHabitFile(file.path)) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (
					this.isHabitFile(file.path) ||
					this.isHabitFile(oldPath)
				) {
					requestReload();
				}
			}),
		);
		this.registerEvent(
			this.pluginEvents.on("settings-changed", () => {
				requestReload();
			}),
		);
		// Comments are read from note bodies asynchronously, so they can
		// land after the first paint.
		this.registerEvent(
			this.pluginEvents.on("comments-changed", () => {
				requestReload();
			}),
		);

		this.reload();
	}

	/** True when the path lives inside the configured habits folder. */
	private isHabitFile(path: string): boolean {
		const folder = normalizePath(this.getSettings().habitsFolder);
		return path === folder || path.startsWith(`${folder}/`);
	}

	/**
	 * Event-driven reload. Skipped while an animation is playing (the
	 * animation flow reloads when it finishes) or while the user is typing
	 * in a value input.
	 */
	private autoReload(): void {
		if (this.suppressAutoReload) {
			return;
		}
		const active = this.root.doc.activeElement;
		if (
			(active instanceof HTMLInputElement ||
				active instanceof HTMLTextAreaElement) &&
			this.root.contains(active)
		) {
			return;
		}
		this.reload();
	}

	/** Reload habits from disk and rebuild the whole dashboard. */
	private reload(): void {
		const settings = this.getSettings();
		this.habits = sortHabits(
			this.store.getHabits().filter((habit) => !habit.stopped),
			settings.sortMode,
			settings.manualOrder,
			settings.groups,
			settings.groupOrder,
		);
		this.index = Math.min(this.index, Math.max(0, this.habits.length - 1));
		this.render();
	}

	private render(): void {
		this.disposeCommentSuggests();
		this.root.empty();

		if (this.mode === "stats") {
			this.renderStatsHeader();
			this.renderRangeToggle();
			const body = this.root.createDiv();
			const settings = this.getSettings();
			renderStatsView(
				body,
				this.habits,
				this.statsPeriod,
				this.statsRange,
				new Date(),
				this.statsPeriod === "custom"
					? this.normalizedCustomRange()
					: undefined,
				settings.experimental.aiSummaries
					? settings.aiSummary
					: undefined,
				settings.dashboardLayout === "carousel"
					? settings.statsRowsPerPage
					: undefined,
				settings.groupsEnabled ? settings.groups : undefined,
				settings.dashboardLayout === "vertical",
			);
			return;
		}

		this.renderHeader();
		this.renderMissedButton();

		if (this.habits.length === 0) {
			this.renderEmptyState();
			return;
		}

		this.cancelSnoozeRefresh();
		this.cancelSnoozeRefresh = scheduleSnoozeRefresh(
			this.root.win,
			this.store,
			this.habits,
			() => this.reload(),
		);

		if (this.orderedHabits().length === 0) {
			this.renderNothingDueState();
		} else if (this.getSettings().dashboardLayout === "carousel") {
			this.renderCarousel();
		} else {
			this.renderGrid();
		}
		renderClosedHabits(
			this.root,
			this,
			this.store,
			this.closedHabits(),
			toDateKey(this.selectedDate),
			this.closedOpen,
			(open) => {
				this.closedOpen = open;
				this.render();
			},
			() => this.render(),
		);
	}

	/**
	 * Floating notification button (experimental): appears bottom-right of
	 * the dashboard only when at least one habit has a missed, still-open
	 * due day, and opens a review of them to reschedule.
	 */
	private renderMissedButton(): void {
		if (!this.getSettings().experimental.rescheduling) {
			return;
		}
		const count = missedInstances(this.habits, new Date()).length;
		if (count === 0) {
			return;
		}
		const button = this.root.createEl("button", {
			cls: "habits-icon-button habits-missed-button",
			attr: { type: "button", "aria-label": t("Missed habits") },
		});
		setIcon(button, "bell");
		const badge = button.createSpan({ cls: "habits-missed-badge" });
		badge.setText(String(count));
		setTooltip(
			button,
			count === 1
				? t("1 missed habit")
				: t("{count} missed habits", { count }),
		);
		this.registerDomEvent(button, "click", () => {
			new MissedHabitsModal(this.app, this.store, this.habits, () =>
				this.reload(),
			).open();
		});
	}

	/** Header shown on the stats view: home, period tabs, export. */
	private renderStatsHeader(): void {
		const header = this.root.createDiv({ cls: "habits-header" });

		const home = header.createEl("button", {
			cls: "habits-icon-button habits-header-left",
			attr: { type: "button", "aria-label": t("Back to habits") },
		});
		setIcon(home, "home");
		this.registerDomEvent(home, "click", () => {
			this.mode = "dashboard";
			this.render();
		});

		const tabs = header.createDiv({ cls: "habits-stats-tabs" });
		const periods: { id: StatsPeriod; label: string }[] = [
			{ id: "weekly", label: t("Weekly") },
			{ id: "monthly", label: t("Monthly") },
			{ id: "custom", label: t("Custom") },
		];
		for (const entry of periods) {
			const tab = tabs.createEl("button", {
				cls: "habits-stats-tab",
				text: entry.label,
				attr: { type: "button" },
			});
			tab.toggleClass("is-active", this.statsPeriod === entry.id);
			this.registerDomEvent(tab, "click", () => {
				this.statsPeriod = entry.id;
				this.render();
			});
		}

		const download = header.createEl("button", {
			cls: "habits-icon-button habits-header-right",
			attr: { type: "button", "aria-label": t("Export stats") },
		});
		setIcon(download, "download");
		this.registerDomEvent(download, "click", () => {
			const settings = this.getSettings();
			new ExportModal(
				this.app,
				this.habits,
				settings.experimental.aiSummaries
					? settings.aiSummary
					: undefined,
			).open();
		});
	}

	/**
	 * The custom range, normalized (swapped ends, span capped) and written
	 * back so the pickers always show what is actually rendered.
	 */
	private normalizedCustomRange(): DateRange {
		const range = normalizeCustomRange(
			this.customRange ?? undefined,
			new Date(),
		);
		this.customRange = range;
		return range;
	}

	/** From/to date pickers shown in place of the rolling/calendar toggle. */
	private renderCustomRangePicker(): void {
		const wrap = this.root.createDiv({
			cls: "habits-range-toggle habits-custom-range",
		});
		const range = this.normalizedCustomRange();

		const makeInput = (
			value: string,
			label: string,
			onPick: (date: Date) => void,
		): void => {
			const input = wrap.createEl("input", {
				cls: "habits-custom-date",
				attr: { type: "date", "aria-label": label },
			});
			input.value = value;
			this.registerDomEvent(input, "change", () => {
				const parsed = fromDateKey(input.value);
				if (parsed) {
					onPick(parsed);
					this.render();
				}
			});
		};

		makeInput(toDateKey(range.start), t("Start date"), (date) => {
			this.customRange = { start: date, end: range.end };
		});
		wrap.createSpan({ cls: "habits-custom-range-sep", text: "–" });
		makeInput(toDateKey(range.end), t("End date"), (date) => {
			this.customRange = { start: range.start, end: date };
		});
	}

	/** Segmented toggle between rolling and calendar date ranges. */
	private renderRangeToggle(): void {
		if (this.statsPeriod === "custom") {
			this.renderCustomRangePicker();
			return;
		}
		const wrap = this.root.createDiv({ cls: "habits-range-toggle" });
		const weekly = this.statsPeriod === "weekly";
		const options: { id: StatsRangeMode; label: string }[] = [
			{ id: "rolling", label: weekly ? t("Last 7 days") : t("Last 30 days") },
			{ id: "calendar", label: weekly ? t("This week") : t("This month") },
		];
		for (const option of options) {
			const btn = wrap.createEl("button", {
				cls: "habits-range-btn",
				text: option.label,
				attr: { type: "button" },
			});
			btn.toggleClass("is-active", this.statsRange === option.id);
			this.registerDomEvent(btn, "click", () => {
				this.statsRange = option.id;
				this.render();
			});
		}
	}

	private renderHeader(): void {
		const header = this.root.createDiv({ cls: "habits-header" });

		const statsBtn = header.createEl("button", {
			cls: "habits-icon-button habits-header-left",
			attr: { type: "button", "aria-label": t("View stats") },
		});
		setIcon(statsBtn, "chart-column-increasing");
		this.registerDomEvent(statsBtn, "click", () => {
			this.mode = "stats";
			this.render();
		});

		const nav = header.createDiv({ cls: "habits-date-nav" });

		const prev = nav.createEl("button", {
			cls: "habits-icon-button",
			attr: { type: "button", "aria-label": t("Previous day") },
		});
		setIcon(prev, "chevron-left");
		this.registerDomEvent(prev, "click", () => {
			this.selectedDate = addDays(this.selectedDate, -1);
			this.render();
		});

		const dateDisplay = nav.createSpan({
			cls: "habits-date-display",
		});
		const dateButton = dateDisplay.createEl("button", {
			cls: "habits-date-label",
			text: friendlyDateLabel(this.selectedDate, new Date()),
			attr: { type: "button", "aria-label": t("Choose a date") },
		});
		const dateInput = dateDisplay.createEl("input", {
			cls: "habits-date-input",
			attr: { type: "date", tabindex: "-1", "aria-hidden": "true" },
		});
		dateInput.value = toDateKey(this.selectedDate);
		this.registerDomEvent(dateInput, "change", () => {
			const parsed = fromDateKey(dateInput.value);
			if (parsed) {
				this.selectedDate = parsed;
				this.render();
			}
		});
		this.registerDomEvent(dateButton, "click", () => {
			dateInput.value = toDateKey(this.selectedDate);
			if (typeof dateInput.showPicker === "function") {
				dateInput.showPicker();
			} else {
				dateInput.click();
			}
		});

		const next = nav.createEl("button", {
			cls: "habits-icon-button",
			attr: { type: "button", "aria-label": t("Next day") },
		});
		setIcon(next, "chevron-right");
		this.registerDomEvent(next, "click", () => {
			this.selectedDate = addDays(this.selectedDate, 1);
			this.render();
		});

		const add = header.createEl("button", {
			cls: "habits-icon-button habits-header-right",
			attr: { type: "button", "aria-label": t("Add habit") },
		});
		setIcon(add, "plus");
		this.registerDomEvent(add, "click", () => this.openCreateModal());
	}

	private renderEmptyState(): void {
		const empty = this.root.createDiv({ cls: "habits-empty" });
		empty.createEl("p", {
			text: t("No habits yet. Create your first habit to get started."),
		});
		const button = empty.createEl("button", {
			cls: "mod-cta",
			text: t("Create habit"),
			attr: { type: "button" },
		});
		this.registerDomEvent(button, "click", () => this.openCreateModal());
	}

	/** Shown when habits exist but none of them fall due on the selected day. */
	private renderNothingDueState(): void {
		const empty = this.root.createDiv({ cls: "habits-empty" });
		empty.createEl("p", {
			// Habits failed, skipped or snoozed are still due, just hidden.
			text:
				this.closedHabits().length > 0
					? t("Nothing left on this day's list.")
					: t("No habits are due on this day."),
		});
	}

	private renderCarousel(): void {
		const viewport = this.root.createDiv({
			cls: "habits-carousel-viewport",
		});
		const track = viewport.createDiv({ cls: "habits-carousel-track" });
		this.trackEl = track;

		for (const habit of this.orderedHabits()) {
			this.renderCard(track, habit);
		}

		if (this.habits.length > 1) {
			this.renderControls();
		}

		this.applyLayout();
	}

	/**
	 * Grid and vertical-scroll layouts: every due habit is rendered at
	 * once into rows of `perView()` cards. The grid grows down the note
	 * and scrolls with it; the vertical variant instead caps its height
	 * so the cards scroll inside the widget (mouse wheel on desktop,
	 * thumb-drag on touch — both native, no JS scrolling involved).
	 */
	private renderGrid(): void {
		const settings = this.getSettings();
		const vertical = settings.dashboardLayout === "vertical";
		const wrap = this.root.createDiv({ cls: "habits-grid-wrap" });
		wrap.toggleClass("is-vertical", vertical);
		this.trackEl = null;

		const perRow = this.perView();
		this.lastPerView = perRow;
		wrap.setCssProps({ "--habits-per-row": String(perRow) });

		const showHeaders = this.sectioned();
		for (const section of this.sections()) {
			if (showHeaders) {
				this.renderSectionHeader(wrap, section.key);
			}
			const grid = wrap.createDiv({ cls: "habits-grid" });
			for (const habit of section.habits) {
				this.renderCard(grid, habit);
			}
		}

		if (vertical) {
			this.capVerticalHeight(wrap);
		}
	}

	/** Section header: the group's icon or colour swatch, plus a label. */
	private renderSectionHeader(container: HTMLElement, key: string): void {
		const style = this.getSettings().groups[key];
		const header = container.createDiv({ cls: "habits-group-header" });
		if (style?.icon) {
			const icon = header.createSpan({ cls: "habits-group-icon" });
			applyHabitIcon(icon, style.icon);
			if (style.color) {
				icon.setCssProps({ "--habits-accent": style.color });
			}
		} else if (style?.color) {
			const swatch = header.createSpan({
				cls: "habits-group-swatch",
			});
			swatch.setCssProps({ "--habits-accent": style.color });
		}
		header.createSpan({
			cls: "habits-group-label",
			text: sectionLabel(key),
		});
	}

	/**
	 * Cap the vertical-scroll grid at about a row and a half, so a partial
	 * row peeks out below the fold as the "there is more" cue. Measured
	 * from the first card after layout, so the cap follows the theme's
	 * actual card height.
	 *
	 * The dashboard often re-renders while it is not laid out (Obsidian
	 * hides embeds during note navigation, and habit edits reload at any
	 * time), in which case the card measures 0 and the cap cannot be
	 * computed. A ResizeObserver retries once layout returns; until
	 * then, a CSS fallback cap keeps the widget scrollable rather than
	 * letting it silently sprawl into a full grid.
	 */
	private capVerticalHeight(grid: HTMLElement): void {
		const apply = (): boolean => {
			const card = grid.querySelector<HTMLElement>(".habits-card");
			if (!card || card.offsetHeight === 0) {
				// Not laid out yet (hidden or detached).
				return false;
			}
			grid.setCssProps({
				"--habits-vertical-max": `${Math.round(
					card.offsetHeight * 1.55,
				)}px`,
			});
			return true;
		};
		window.requestAnimationFrame(() => {
			if (apply()) {
				return;
			}
			const observer = new ResizeObserver(() => {
				if (apply()) {
					observer.disconnect();
				}
			});
			observer.observe(grid);
			this.register(() => observer.disconnect());
		});
	}

	/** Number of distinct positions the carousel can rest at. */
	private pageCount(): number {
		return Math.max(1, this.habits.length - this.perView() + 1);
	}

	private renderControls(): void {
		const pages = this.pageCount();
		if (pages <= 1) {
			return;
		}

		const controls = this.root.createDiv({
			cls: "habits-carousel-controls",
		});

		const prev = controls.createEl("button", {
			cls: "habits-icon-button habits-carousel-prev",
			attr: { type: "button", "aria-label": t("Previous") },
		});
		setIcon(prev, "chevron-left");
		this.registerDomEvent(prev, "click", () => this.move(-1));

		if (pages <= 7) {
			const dots = controls.createDiv({ cls: "habits-dots" });
			for (let i = 0; i < pages; i++) {
				const dot = dots.createEl("button", {
					cls: "habits-dot",
					attr: {
						type: "button",
						"aria-label": t("Go to position {n}", { n: i + 1 }),
					},
				});
				this.registerDomEvent(dot, "click", () => {
					this.index = i;
					this.applyLayout();
				});
			}
		} else {
			controls.createSpan({ cls: "habits-carousel-count" });
		}

		const next = controls.createEl("button", {
			cls: "habits-icon-button habits-carousel-next",
			attr: { type: "button", "aria-label": t("Next") },
		});
		setIcon(next, "chevron-right");
		this.registerDomEvent(next, "click", () => this.move(1));

		this.updateControls();
	}

	/** Update dot/arrow/counter state to match the current position. */
	private updateControls(): void {
		const maxIndex = Math.max(0, this.habits.length - this.perView());

		const prevBtn = this.root.querySelector<HTMLElement>(
			".habits-carousel-prev",
		);
		prevBtn?.toggleClass("is-disabled", this.index <= 0);

		const nextBtn = this.root.querySelector<HTMLElement>(
			".habits-carousel-next",
		);
		nextBtn?.toggleClass("is-disabled", this.index >= maxIndex);

		const dots = this.root.querySelectorAll(".habits-dot");
		dots.forEach((dot, i) => {
			dot.toggleClass("is-active", i === this.index);
		});

		const count = this.root.querySelector<HTMLElement>(
			".habits-carousel-count",
		);
		count?.setText(`${this.index + 1} / ${maxIndex + 1}`);
	}

	/** Re-render on breakpoint changes, otherwise just re-position. */
	private handleResize(): void {
		if (this.perView() !== this.lastPerView) {
			this.render();
		} else {
			this.applyLayout();
		}
	}

	private move(delta: number): void {
		const maxIndex = Math.max(0, this.habits.length - this.perView());
		this.index = Math.min(maxIndex, Math.max(0, this.index + delta));
		this.applyLayout();
	}

	private perView(): number {
		if (window.innerWidth <= MOBILE_BREAKPOINT) {
			return Math.min(
				this.getSettings().mobileCardsPerView,
				this.habits.length,
			);
		}
		return Math.min(this.getSettings().cardsPerView, this.habits.length);
	}

	/** Recompute card widths, carousel offset and control states. */
	private applyLayout(): void {
		if (!this.trackEl) {
			return;
		}
		const perView = this.perView();
		this.lastPerView = perView;
		const maxIndex = Math.max(0, this.habits.length - perView);
		this.index = Math.min(this.index, maxIndex);

		this.trackEl.setCssProps({
			"--habits-per-view": String(perView),
			"--habits-translate": `-${this.index * (100 / perView)}%`,
		});

		this.updateControls();
	}

	private renderCard(track: HTMLElement, habit: HabitDefinition): void {
		const settings = this.getSettings();
		const card = track.createDiv({ cls: "habits-card" });
		const accent = habitAccent(habit, settings.groups);
		if (accent) {
			card.setCssProps({ "--habits-accent": accent });
		}
		// A lip along the top edge names the habit's group. Shown while
		// grouping by group — it is what carries the group context in the
		// carousel, which has no section headers.
		const groupName = habit.group.trim();
		if (settings.groupsEnabled && groupName) {
			const lip = card.createDiv({ cls: "habits-card-group-lip" });
			const style = settings.groups[groupName];
			if (style?.color) {
				lip.setCssProps({ "--habits-group-color": style.color });
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
		setTooltip(card, t("Right-click or long-press for more options"));
		this.registerDomEvent(card, "contextmenu", (evt: MouseEvent) => {
			if (evt.target instanceof HTMLTextAreaElement) {
				return;
			}
			evt.preventDefault();
			this.showCardMenu(habit, card, evt.clientX, evt.clientY);
		});
		registerLongPress(this, card, (x, y) => {
			this.showCardMenu(habit, card, x, y);
		});

		const inner = card.createDiv({ cls: "habits-card-inner" });
		const front = inner.createDiv({ cls: "habits-card-front" });

		const title = front.createDiv({ cls: "habits-card-title" });
		if (habit.icon) {
			const iconEl = title.createSpan({ cls: "habits-card-icon" });
			applyHabitIcon(iconEl, habit.icon);
		}
		const name = title.createEl("button", {
			cls: "habits-card-name",
			attr: {
				type: "button",
				"aria-label": t("Open the note for {name}", { name: habit.name }),
			},
		});
		name.createSpan({
			cls: "habits-card-name-text",
			text: habit.name,
		});
		setTooltip(name, `${habit.name} — ${t("Open habit note")}`);
		this.registerDomEvent(name, "click", () => {
			void this.app.workspace.openLinkText(habit.path, "", false);
		});

		const frequencyLabel = this.frequencyLabel(habit);
		if (frequencyLabel) {
			front.createDiv({
				cls: "habits-card-frequency",
				text: frequencyLabel,
			});
		}

		if (this.getSettings().experimental.rescheduling) {
			const movedFrom = rescheduleSource(habit, toDateKey(this.selectedDate));
			if (movedFrom) {
				const badge = front.createDiv({ cls: "habits-card-rescheduled" });
				setIcon(
					badge.createSpan({ cls: "habits-card-rescheduled-icon" }),
					"calendar",
				);
				const movedFromDate = fromDateKey(movedFrom);
				badge.createSpan({
					text: t("Rescheduled from {date}", {
						date: movedFromDate
							? friendlyDateLabel(movedFromDate, new Date())
							: movedFrom,
					}),
				});
			}
		}

		if (this.isPausedOnSelected(habit)) {
			card.addClass("is-paused");
			this.renderPausedBody(front, habit);
		} else {
			const body = front.createDiv({ cls: "habits-card-body" });
			if (isFlexible(habit)) {
				this.renderFlexibleControl(body, habit, card);
			} else if (habit.goalDirection === "max" && habit.type === "binary") {
				this.renderLimitBinaryControl(body, habit, card);
			} else if (habit.type === "binary") {
				this.renderBinaryControl(body, habit, card);
			} else if (habit.type === "note") {
				this.renderNoteControl(body, habit);
			} else {
				this.renderCounterControl(body, habit, card);
			}
		}

		if (this.getSettings().enableComments) {
			this.renderCommentBack(card, inner, habit);
		}
	}

	/**
	 * Back face of the card plus the comment "lip" along the bottom edge.
	 * Clicking the lip flips the card over to a per-day comment editor;
	 * comments are stored per selected date in the habit's frontmatter.
	 *
	 * The back has two faces of its own: a read view that renders `#tags`
	 * and `[[links]]` as clickable elements, and the textarea that appears
	 * once the user starts editing. Typing `#` or `[[` opens a suggester.
	 */
	private renderCommentBack(
		card: HTMLElement,
		inner: HTMLElement,
		habit: HabitDefinition,
	): void {
		const dateKey = toDateKey(this.selectedDate);

		const back = inner.createDiv({ cls: "habits-card-back" });
		back.createDiv({
			cls: "habits-card-back-title",
			text: friendlyDateLabel(this.selectedDate, new Date()),
		});
		const stage = back.createDiv({ cls: "habits-comment-stage" });
		const reader = stage.createDiv({
			cls: "habits-comment-read",
			attr: { tabindex: "0", role: "button" },
		});
		const input = stage.createEl("textarea", {
			cls: "habits-comment-input",
			attr: {
				placeholder: t("Add a comment for this day…"),
				"aria-label": t("Add comment"),
			},
		});
		input.value = habit.comments[dateKey] ?? "";

		const suggest = new CommentSuggest(this.app, input);
		suggest.load();
		this.commentSuggests.push(suggest);

		/** Repaint the read view from the current textarea contents. */
		const paint = (): void => {
			const text = input.value.trim();
			if (text === "") {
				reader.empty();
				reader.addClass("is-empty");
				reader.setText(t("Add a comment for this day…"));
				reader.setAttr("aria-label", t("Add comment"));
				return;
			}
			reader.removeClass("is-empty");
			renderComment(this.app, reader, text, {
				sourcePath: habit.path,
				component: this,
			});
			reader.setAttr("aria-label", t("Edit comment"));
		};

		const edit = (): void => {
			stage.addClass("is-editing");
			input.focus();
		};

		/** Leave edit mode, showing the rendered view again. */
		const review = (): void => {
			stage.removeClass("is-editing");
			paint();
		};

		paint();

		const lip = card.createEl("button", {
			cls: "habits-card-lip",
			attr: { type: "button", "aria-label": t("Add comment") },
		});
		const lipIcon = lip.createSpan({ cls: "habits-card-lip-icon" });
		setIcon(lipIcon, "message-square");
		lip.toggleClass("has-comment", input.value.trim() !== "");

		const save = async (): Promise<void> => {
			const text = input.value.trim();
			if (text === (habit.comments[dateKey] ?? "")) {
				return;
			}
			if (text) {
				habit.comments[dateKey] = text;
			} else {
				delete habit.comments[dateKey];
			}
			lip.toggleClass("has-comment", text !== "");
			await this.store.setComment(habit, dateKey, text);
		};

		this.registerDomEvent(lip, "click", () => {
			if (card.hasClass("is-flipped")) {
				card.removeClass("is-flipped");
				setIcon(lipIcon, "message-square");
				lip.setAttr("aria-label", t("Add comment"));
				review();
				void save();
			} else {
				card.addClass("is-flipped");
				setIcon(lipIcon, "rotate-ccw");
				lip.setAttr("aria-label", t("Flip back"));
				// An empty comment goes straight to the editor; an existing
				// one shows its links first so they stay clickable.
				if (input.value.trim() === "") {
					edit();
				}
			}
		});

		// Clicking anywhere in the read view that is not a tag or link
		// starts editing at the end of the text.
		this.registerDomEvent(reader, "click", (event) => {
			if ((event.target as HTMLElement).closest("a")) {
				return;
			}
			edit();
			input.setSelectionRange(input.value.length, input.value.length);
		});
		this.registerDomEvent(reader, "keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				edit();
			}
		});

		this.registerDomEvent(input, "blur", () => {
			// The suggester steals focus briefly while a row is clicked.
			window.setTimeout(() => {
				if (suggest.isOpen || document.activeElement === input) {
					return;
				}
				review();
				void save();
			}, 140);
		});
		this.registerDomEvent(input, "keydown", (event) => {
			if (event.key === "Escape" && !suggest.isOpen) {
				event.stopPropagation();
				review();
				void save();
			}
		});
	}

	onunload(): void {
		this.disposeCommentSuggests();
		this.cancelSnoozeRefresh();
	}

	/** Tear down comment suggesters before the cards they belong to go. */
	private disposeCommentSuggests(): void {
		for (const suggest of this.commentSuggests) {
			suggest.unload();
		}
		this.commentSuggests = [];
	}

	/** Body shown instead of controls when the habit is paused. */
	private renderPausedBody(
		container: HTMLElement,
		habit: HabitDefinition,
	): void {
		const body = container.createDiv({ cls: "habits-card-body" });
		const badge = body.createDiv({ cls: "habits-paused-badge" });
		const icon = badge.createSpan({ cls: "habits-paused-icon" });
		setIcon(icon, "pause");
		badge.createSpan({ text: t("Paused") });

		const openPause = habit.pauses.find((pause) => pause.end === "");
		const started = openPause ? fromDateKey(openPause.start) : null;
		body.createDiv({
			cls: "habits-paused-note",
			text: started
				? t("Since {date} · right-click to resume", {
						date: started.toLocaleDateString(undefined, {
							day: "numeric",
							month: "short",
						}),
					})
				: t("Paused on this day"),
		});
	}

	/**
	 * The card's schedule line: the due descriptor for non-daily habits,
	 * the planned time when one is set, or both joined with a dot. Empty
	 * for a daily habit with no time, which keeps the original layout.
	 */
	private frequencyLabel(habit: HabitDefinition): string {
		const schedule = habitScheduleLabel(habit);
		const time = habit.times.map(formatTimeOfDay).join(", ");
		if (schedule && time) {
			return `${schedule} · ${time}`;
		}
		return schedule || time;
	}

	private currentValue(habit: HabitDefinition): number {
		return habit.records[toDateKey(this.selectedDate)] ?? 0;
	}

	/**
	 * Whether the habit's goal is met for the selected day. Delegates to the
	 * shared completion logic so cards, streaks, stats and the perfect-day
	 * check can never disagree about what "complete" means.
	 */
	private isComplete(habit: HabitDefinition): boolean {
		return isCompleteOn(habit, toDateKey(this.selectedDate));
	}

	/**
	 * Whether the habit was taken off the selected day's cards — failed,
	 * skipped or snoozed (see {@link dayStatus}).
	 */
	private isClosedOnSelected(habit: HabitDefinition): boolean {
		return dayStatus(habit, toDateKey(this.selectedDate), this.store) !== null;
	}

	/** Habits due on the selected day but taken off its cards, in order. */
	private closedHabits(): ClosedHabit[] {
		const dateKey = toDateKey(this.selectedDate);
		const closed: ClosedHabit[] = [];
		for (const habit of this.habits) {
			const status = this.isActiveOnSelected(habit)
				? dayStatus(habit, dateKey, this.store)
				: null;
			if (status) {
				closed.push({ habit, status });
			}
		}
		return closed;
	}

	/** Whether the habit is paused on the currently selected day. */
	private isPausedOnSelected(habit: HabitDefinition): boolean {
		return isPausedOn(habit, toDateKey(this.selectedDate));
	}

	/**
	 * Whether the habit should show/be interactive on the currently
	 * selected day — its normal due date, or every day for a flexible
	 * habit (see {@link isActive}).
	 */
	private isActiveOnSelected(habit: HabitDefinition): boolean {
		return isActive(habit, this.selectedDate);
	}

	/**
	 * Carousel order for the selected day: incomplete habits first (in store
	 * order), then completed habits, with paused habits parked at the end.
	 * Weekly and monthly habits appear only on the days they are due.
	 */
	/**
	 * Flat order for the carousel (and for the "anything due?" check).
	 * Groups stay adjacent, but the status partition applies across the
	 * whole queue: the carousel has no visible sections, so a completed
	 * card slides to the very end of the line, not just of its group.
	 */
	private orderedHabits(): HabitDefinition[] {
		const flat: HabitDefinition[] = [];
		for (const section of this.rawSections()) {
			flat.push(...section.habits);
		}
		return this.applyStatusOrder(flat);
	}

	/**
	 * Whether the dashboard partitions into group sections. Sections
	 * only make sense while sorting by group — any other sort (manual
	 * especially) must be honoured exactly, so grouping then stays
	 * visual-only via the card lips.
	 */
	private sectioned(): boolean {
		const settings = this.getSettings();
		return settings.groupsEnabled && settings.sortMode === "group";
	}

	/** Grouped sections before any status ordering. */
	private rawSections(): HabitSection[] {
		const due = this.habits.filter(
			(habit) =>
				this.isActiveOnSelected(habit) && !this.isClosedOnSelected(habit),
		);
		return groupHabits(
			due,
			this.sectioned(),
			this.getSettings().groupOrder,
		).filter((section) => section.habits.length > 0);
	}

	/**
	 * Visual sections for the grid layouts. Status ordering applies
	 * within each section, so completed habits sink to the end of their
	 * own section rather than escaping it.
	 */
	private sections(): HabitSection[] {
		return this.rawSections().map((section) => ({
			key: section.key,
			habits: this.applyStatusOrder(section.habits),
		}));
	}

	/** Status partition applied to an already-sorted run of due habits. */
	private applyStatusOrder(due: HabitDefinition[]): HabitDefinition[] {
		// With status ordering off, every card keeps its sorted position —
		// nothing moves as habits are completed or paused.
		if (!this.getSettings().statusOrdering) {
			return due;
		}
		const active = due.filter((habit) => !this.isPausedOnSelected(habit));
		return [
			...active.filter((habit) => !this.isComplete(habit)),
			...active.filter((habit) => this.isComplete(habit)),
			...due.filter((habit) => this.isPausedOnSelected(habit)),
		];
	}

	/**
	 * Re-render after a value change. If the habit just transitioned to
	 * complete, play the completion animation first; the re-render then moves
	 * the card to the end of the queue.
	 */
	private async finishChange(
		card: HTMLElement,
		habit: HabitDefinition,
		wasComplete: boolean,
	): Promise<void> {
		if (!wasComplete && this.isComplete(habit)) {
			// With animations off the completion still books its perfect
			// day (so re-enabling never replays a stale celebration), the
			// view just updates without the ceremony.
			if (!this.getSettings().animations) {
				if (this.isPerfectDay()) {
					this.celebratedDays.add(toDateKey(this.selectedDate));
				}
				this.reload();
				return;
			}
			this.suppressAutoReload = true;
			try {
				const overlay = await this.playCompletionAnimation(card);
				await this.playCardDeparture(card, overlay);
				const perfect = this.isPerfectDay();
				this.reload();
				if (perfect) {
					this.celebratedDays.add(toDateKey(this.selectedDate));
					await this.playPerfectAnimation();
				}
			} finally {
				this.suppressAutoReload = false;
			}
			return;
		}
		// The change didn't complete the habit; if it broke the perfect
		// day (e.g. un-doing a habit), re-arm the celebration.
		if (!this.isPerfectDay()) {
			this.celebratedDays.delete(toDateKey(this.selectedDate));
		}
		this.reload();
	}

	/**
	 * Re-render after a limit-habit change. Limit habits get no per-card
	 * completion celebration — staying within a limit is quiet success —
	 * but an action that completes a perfect day (confirming Clean, or
	 * correcting an over-limit value back under) celebrates it, at most
	 * once per perfect episode.
	 */
	private async finishLimitChange(mayCelebrate: boolean): Promise<void> {
		const dateKey = toDateKey(this.selectedDate);
		const perfectNow = this.isPerfectDay();
		if (!perfectNow) {
			// A slip (or going over a limit) ends the perfect episode, so
			// recovering to perfect later celebrates again.
			this.celebratedDays.delete(dateKey);
		}
		const celebrate =
			mayCelebrate &&
			perfectNow &&
			!this.celebratedDays.has(dateKey) &&
			this.getSettings().animations;
		// Book the perfect day even when the celebration is switched off,
		// so re-enabling animations never replays a stale one.
		if (perfectNow && !this.getSettings().animations) {
			this.celebratedDays.add(dateKey);
		}
		// Repaint from local state rather than reloading: the metadata
		// cache may not have absorbed the write yet, and a stale reload
		// would briefly revert the control the user just pressed. The
		// cache-change event settles the view afterwards.
		this.render();
		if (celebrate) {
			this.celebratedDays.add(dateKey);
			this.suppressAutoReload = true;
			try {
				await this.playPerfectAnimation();
			} finally {
				this.suppressAutoReload = false;
			}
			// The cache event likely fired inside the suppression window;
			// reload once now that the cache has caught up.
			this.reload();
		}
	}

	/** True when every due, non-paused habit is complete for the selected day. */
	private isPerfectDay(): boolean {
		const active = this.habits.filter(
			(habit) =>
				this.isActiveOnSelected(habit) &&
				!this.isPausedOnSelected(habit),
		);
		return (
			active.length > 0 &&
			active.every((habit) => this.isComplete(habit))
		);
	}

	/**
	 * Celebration that spans the whole dashboard when the day hits 100%:
	 * a soft glow, theme-coloured confetti, and "Perfect!" springing in.
	 * Pointer-transparent, so it never blocks interaction.
	 */
	private async playPerfectAnimation(): Promise<void> {
		const overlay = this.root.createDiv({
			cls: "habits-perfect-overlay",
		});
		overlay.createDiv({ cls: "habits-perfect-glow" });

		const confetti = overlay.createDiv({
			cls: "habits-perfect-confetti",
		});
		const colors = [
			"var(--color-green, var(--text-success))",
			"var(--color-yellow, #e5b567)",
			"var(--color-red, #e05d5d)",
			"var(--color-blue, var(--interactive-accent))",
			"var(--color-purple, #8a6fd6)",
		];
		for (let i = 0; i < 22; i++) {
			const piece = confetti.createDiv({
				cls: "habits-perfect-piece",
			});
			piece.setCssProps({
				"--hc-color": colors[i % colors.length],
				"--hc-x": `${Math.round((Math.random() - 0.5) * 320)}px`,
				"--hc-my": `${Math.round(-30 - Math.random() * 70)}px`,
				"--hc-y": `${Math.round(70 + Math.random() * 120)}px`,
				"--hc-r": `${Math.round((Math.random() - 0.5) * 540)}deg`,
				"--hc-delay": `${Math.round(Math.random() * 180)}ms`,
			});
		}

		overlay.createDiv({ cls: "habits-perfect-text", text: t("Perfect!") });

		await sleep(1600);
		overlay.addClass("is-leaving");
		await sleep(250);
		overlay.remove();
	}

	/**
	 * Celebrate a completed habit: after a short beat, a green circle-check
	 * swooshes in with a springy spin while a ring pulses outward behind it.
	 * Colour comes from the theme palette (`--color-green`).
	 */
	private async playCompletionAnimation(
		card: HTMLElement,
	): Promise<HTMLElement> {
		// Brief pause so the user sees their input land before the reward.
		await sleep(350);
		const overlay = card.createDiv({ cls: "habits-complete-overlay" });
		overlay.createDiv({ cls: "habits-complete-ring" });
		const icon = overlay.createSpan({ cls: "habits-complete-icon" });
		setIcon(icon, "circle-check");
		// Swoosh-in plus a short hold at full size.
		await sleep(950);
		return overlay;
	}

	/**
	 * Quieter cousin of the completion animation for pausing: a muted
	 * circle-pause swooshes in before the card departs for the end of the
	 * queue.
	 */
	private async playPauseAnimation(
		card: HTMLElement,
	): Promise<HTMLElement> {
		const overlay = card.createDiv({ cls: "habits-complete-overlay" });
		const icon = overlay.createSpan({
			cls: "habits-paused-overlay-icon",
		});
		setIcon(icon, "circle-pause");
		await sleep(600);
		return overlay;
	}

	/**
	 * Send the completed card (still showing its green check) swooshing off
	 * to the right while its slot collapses, so the queue visibly closes the
	 * gap and the next card slides in. Skipped when the card is already at
	 * the end of the queue — then the overlay simply fades out in place.
	 */
	private async playCardDeparture(
		card: HTMLElement,
		overlay: HTMLElement,
	): Promise<void> {
		const track = card.parentElement;
		// Grid layouts have no queue to slide along, and with status
		// ordering off the card is not going anywhere: the overlay simply
		// fades out in place.
		if (
			!track ||
			track.hasClass("habits-grid") ||
			!this.getSettings().statusOrdering ||
			track.lastElementChild === card
		) {
			overlay.addClass("is-leaving");
			await sleep(200);
			return;
		}
		card.addClass("is-departing");
		await sleep(600);
	}

	private async commit(habit: HabitDefinition, value: number): Promise<void> {
		const clamped = roundValue(Math.max(0, value));
		const dateKey = toDateKey(this.selectedDate);
		if (clamped > 0) {
			habit.records[dateKey] = clamped;
		} else {
			delete habit.records[dateKey];
		}
		await this.store.setRecord(habit, dateKey, clamped);
	}

	/** Swap the value display for an input so the user can type a value. */
	private editValue(
		habit: HabitDefinition,
		readout: HTMLElement,
		targetText: string,
		card: HTMLElement,
	): void {
		readout.empty();
		const input = readout.createEl("input", {
			cls: "habits-value-input",
			attr: {
				type: "number",
				min: "0",
				step: allowsDecimals(habit) ? "any" : "1",
				inputmode: allowsDecimals(habit) ? "decimal" : "numeric",
				"aria-label": t("Value"),
			},
		});
		input.value = formatValue(this.currentValue(habit));
		readout.createSpan({ cls: "habits-target", text: targetText });
		input.focus();
		input.select();

		let done = false;
		const finish = async (save: boolean): Promise<void> => {
			if (done) {
				return;
			}
			done = true;
			const wasComplete = this.isComplete(habit);
			const wasPerfect = this.isPerfectDay();
			if (save) {
				const parsed = Number(input.value);
				if (Number.isFinite(parsed)) {
					await this.commit(habit, cleanValue(habit, parsed));
				}
			}
			if (habit.goalDirection === "max") {
				await this.finishLimitChange(!wasPerfect);
			} else {
				await this.finishChange(card, habit, wasComplete);
			}
		};

		this.registerDomEvent(input, "keydown", (evt: KeyboardEvent) => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				void finish(true);
			} else if (evt.key === "Escape") {
				evt.preventDefault();
				void finish(false);
			}
		});
		this.registerDomEvent(input, "blur", () => {
			void finish(true);
		});
	}

	private renderBinaryControl(
		body: HTMLElement,
		habit: HabitDefinition,
		card: HTMLElement,
	): void {
		const done = this.currentValue(habit) >= 1;
		const button = body.createEl("button", {
			cls: "habits-binary-toggle",
			attr: {
				type: "button",
				"aria-label": done ? t("Mark as not done") : t("Mark as done"),
				"aria-pressed": String(done),
			},
		});
		button.toggleClass("is-done", done);
		setIcon(button, done ? "check" : "circle");
		button.createSpan({
			cls: "habits-binary-label",
			text: done ? t("Done") : t("Not done"),
		});

		this.registerDomEvent(button, "click", async () => {
			await this.commit(habit, done ? 0 : 1);
			await this.finishChange(card, habit, done);
		});
	}

	/**
	 * Two-box control for binary limit habits: Clean and Slipped. An
	 * unlogged day already counts as clean, so Clean is highlighted by
	 * default and stores nothing; tapping it clears a slip (and, as an
	 * explicit confirmation, may trigger the perfect-day celebration).
	 * Tapping Slipped records the slip. The boxes act like radio buttons.
	 */
	private renderLimitBinaryControl(
		body: HTMLElement,
		habit: HabitDefinition,
		card: HTMLElement,
	): void {
		const slipped = this.currentValue(habit) >= 1;
		const boxes = body.createDiv({ cls: "habits-limit-boxes" });

		const makeBox = (
			cls: string,
			icon: string,
			label: string,
			active: boolean,
		): HTMLButtonElement => {
			const box = boxes.createEl("button", {
				cls: `habits-limit-box ${cls}`,
				attr: {
					type: "button",
					"aria-label": label,
					"aria-pressed": String(active),
				},
			});
			box.toggleClass("is-active", active);
			const glyph = box.createSpan({ cls: "habits-limit-box-icon" });
			setIcon(glyph, icon);
			box.createSpan({ cls: "habits-limit-box-label", text: label });
			return box;
		};

		const cleanBox = makeBox(
			"habits-limit-clean",
			"check",
			t("Clean"),
			!slipped,
		);
		const slippedBox = makeBox(
			"habits-limit-slipped",
			"x",
			t("Slipped"),
			slipped,
		);

		this.registerDomEvent(cleanBox, "click", async () => {
			await this.commit(habit, 0);
			await this.finishLimitChange(true);
		});
		this.registerDomEvent(slippedBox, "click", async () => {
			await this.commit(habit, 1);
			await this.finishLimitChange(false);
		});
		// The card element is unused here on purpose: limit habits play no
		// per-card completion animation.
		void card;
	}

	private renderCounterControl(
		body: HTMLElement,
		habit: HabitDefinition,
		card: HTMLElement,
	): void {
		const value = this.currentValue(habit);
		const timed = habit.type === "timed";
		const step = stepOf(habit);
		const unit = habit.unit || (timed ? "min" : "");
		const isMax = habit.goalDirection === "max";
		const goalValue = isMax ? limitOf(habit) : habit.target;

		const targetText = unit
			? `/ ${formatValue(goalValue)} ${unit}`
			: `/ ${formatValue(goalValue)}`;

		const readout = body.createDiv({ cls: "habits-readout" });
		const valueEl = readout.createEl("button", {
			cls: "habits-value",
			text: formatValue(value),
			attr: {
				type: "button",
				"aria-label": t("Edit value"),
			},
		});
		readout.createSpan({ cls: "habits-target", text: targetText });
		this.registerDomEvent(valueEl, "click", () =>
			this.editValue(habit, readout, targetText, card),
		);

		const progress = body.createDiv({ cls: "habits-progress" });
		const fill = progress.createDiv({ cls: "habits-progress-fill" });
		if (isMax) {
			// The bar fills towards the limit and turns red once over it.
			// A limit of 0 has no "towards": the bar is empty while clean
			// and jumps straight to full-and-over on any logged value.
			const pct =
				goalValue > 0
					? Math.min(100, Math.round((value / goalValue) * 100))
					: value > 0
						? 100
						: 0;
			fill.setCssProps({ "--habits-progress": `${pct}%` });
			if (value > goalValue) {
				progress.addClass("is-over");
			}
		} else {
			const pct =
				habit.target > 0
					? Math.min(100, Math.round((value / habit.target) * 100))
					: 0;
			fill.setCssProps({ "--habits-progress": `${pct}%` });
			if (value >= habit.target && habit.target > 0) {
				progress.addClass("is-complete");
			}
		}

		const buttons = body.createDiv({ cls: "habits-counter-buttons" });
		buttons.toggleClass("is-compact", timed);

		const minus = buttons.createEl("button", {
			cls: "habits-icon-button",
			attr: {
				type: "button",
				"aria-label": t("Decrease by {n}", { n: formatValue(step) }),
			},
		});
		setIcon(minus, "minus");
		this.registerDomEvent(minus, "click", async () => {
			if (isMax) {
				// Correcting a value back under the limit may complete a
				// perfect day; celebrate the transition.
				const wasPerfect = this.isPerfectDay();
				await this.commit(habit, value - step);
				await this.finishLimitChange(!wasPerfect);
			} else {
				await this.commit(habit, value - step);
				this.render();
			}
		});

		const addValue = async (amount: number): Promise<void> => {
			const wasComplete = this.isComplete(habit);
			if (isMax) {
				const wasPerfect = this.isPerfectDay();
				await this.commit(habit, value + amount);
				await this.finishLimitChange(!wasPerfect);
			} else {
				await this.commit(habit, value + amount);
				await this.finishChange(card, habit, wasComplete);
			}
		};

		if (timed) {
			// Time gets logged in chunks, so offer 1, 5 and 10 minutes.
			for (const step of [1, 5, 10]) {
				const btn = buttons.createEl("button", {
					cls: "habits-icon-button habits-step-button",
					text: `+${step}`,
					attr: {
						type: "button",
						"aria-label": t("Increase by {n}", { n: step }),
					},
				});
				this.registerDomEvent(btn, "click", () => {
					void addValue(step);
				});
			}
		} else {
			const plus = buttons.createEl("button", {
				cls: "habits-icon-button",
				attr: {
					type: "button",
					"aria-label": t("Increase by {n}", { n: formatValue(step) }),
				},
			});
			setIcon(plus, "plus");
			this.registerDomEvent(plus, "click", () => {
				void addValue(step);
			});
		}
	}

	/**
	 * Flexible weekly/monthly habits: logging still writes one number per
	 * calendar day, exactly like the plain counter control, but the
	 * readout and progress bar show the running total for the whole
	 * period (see {@link flexiblePeriodTotal}) rather than just today's
	 * value — so the card reads "1 / 2 this week" and keeps showing done
	 * for the rest of the period once the quota is met, however it was
	 * split across days. The readout is read-only: editing a cumulative
	 * number that isn't itself the thing being stored would be confusing.
	 */
	private renderFlexibleControl(
		body: HTMLElement,
		habit: HabitDefinition,
		card: HTMLElement,
	): void {
		const value = this.currentValue(habit);
		const timed = habit.type === "timed";
		const step = stepOf(habit);
		const unit = habit.unit || (timed ? "min" : "");
		const isMax = habit.goalDirection === "max";
		const goalValue = isMax ? limitOf(habit) : habit.target > 0 ? habit.target : 1;
		const periodTotal = flexiblePeriodTotal(habit, this.selectedDate);
		const periodWord =
			habit.frequency === "flexibleWeekly" ? t("this week") : t("this month");

		const readout = body.createDiv({ cls: "habits-readout" });
		readout.createSpan({
			cls: "habits-readout-value",
			text: formatValue(periodTotal),
		});
		readout.createSpan({
			cls: "habits-target",
			text: unit
				? `/ ${formatValue(goalValue)} ${unit} ${periodWord}`
				: `/ ${formatValue(goalValue)} ${periodWord}`,
		});

		const progress = body.createDiv({ cls: "habits-progress" });
		const fill = progress.createDiv({ cls: "habits-progress-fill" });
		const pct = goalValue > 0 ? Math.min(100, Math.round((periodTotal / goalValue) * 100)) : periodTotal > 0 ? 100 : 0;
		fill.setCssProps({ "--habits-progress": `${pct}%` });
		if (isMax) {
			progress.toggleClass("is-over", periodTotal > goalValue);
		} else if (periodTotal >= goalValue) {
			progress.addClass("is-complete");
		}

		const buttons = body.createDiv({ cls: "habits-counter-buttons" });
		buttons.toggleClass("is-compact", timed);

		const minus = buttons.createEl("button", {
			cls: "habits-icon-button",
			attr: {
				type: "button",
				"aria-label": t("Decrease by {n}", { n: formatValue(step) }),
			},
		});
		setIcon(minus, "minus");
		this.registerDomEvent(minus, "click", async () => {
			await this.commit(habit, value - step);
			this.render();
		});

		const addValue = async (amount: number): Promise<void> => {
			const wasComplete = this.isComplete(habit);
			const wasPerfect = this.isPerfectDay();
			await this.commit(habit, value + amount);
			if (isMax) await this.finishLimitChange(!wasPerfect);
			else await this.finishChange(card, habit, wasComplete);
		};

		if (timed) {
			for (const step of [1, 5, 10]) {
				const btn = buttons.createEl("button", {
					cls: "habits-icon-button habits-step-button",
					text: `+${step}`,
					attr: {
						type: "button",
						"aria-label": t("Increase by {n}", { n: step }),
					},
				});
				this.registerDomEvent(btn, "click", () => {
					void addValue(step);
				});
			}
		} else {
			const plus = buttons.createEl("button", {
				cls: "habits-icon-button",
				attr: {
					type: "button",
					"aria-label": t("Increase by {n}", { n: formatValue(step) }),
				},
			});
			setIcon(plus, "plus");
			this.registerDomEvent(plus, "click", () => {
				void addValue(step);
			});
		}
	}

	/**
	 * Note habits are completed by writing, not by tapping a control: the
	 * card shows the machine-derived progress (char count or percentage of
	 * tasks checked) as read-only, plus a single Write/Open action for the
	 * selected day's note. Its value updates on its own, in the background,
	 * once {@link NoteHabitSync} sees the note change.
	 */
	private renderNoteControl(body: HTMLElement, habit: HabitDefinition): void {
		const value = this.currentValue(habit);
		const goalValue = habit.target;
		const unit = habit.unit || "chars";

		const readout = body.createDiv({ cls: "habits-readout" });
		readout.createSpan({ cls: "habits-readout-value", text: String(value) });
		readout.createSpan({
			cls: "habits-target",
			text: `/ ${goalValue} ${unit}`,
		});

		const progress = body.createDiv({ cls: "habits-progress" });
		const fill = progress.createDiv({ cls: "habits-progress-fill" });
		const pct =
			goalValue > 0 ? Math.min(100, Math.round((value / goalValue) * 100)) : 0;
		fill.setCssProps({ "--habits-progress": `${pct}%` });
		if (goalValue > 0 && value >= goalValue) {
			progress.addClass("is-complete");
		}

		const dateKey = toDateKey(this.selectedDate);
		const notePath = notePathForDate(habit, dateKey);
		const exists =
			this.app.vault.getAbstractFileByPath(notePath) instanceof TFile;

		const action = body.createEl("button", {
			cls: "habits-note-action",
			attr: { type: "button" },
		});
		if (exists) {
			setIcon(action, "file-text");
			action.createSpan({ text: t("Open") });
			setTooltip(action, t("Open this day's note"));
			this.registerDomEvent(action, "click", () => {
				void this.app.workspace.openLinkText(notePath, "", false);
			});
		} else {
			setIcon(action, "square-pen");
			action.createSpan({ text: t("Write") });
			setTooltip(action, t("Write this day's note"));
			this.registerDomEvent(action, "click", async () => {
				const file = await createNoteHabitEntry(
					this.app,
					habit,
					dateKey,
				);
				if (file) {
					void this.app.workspace.openLinkText(file.path, "", false);
					this.reload();
				}
			});
		}
	}

	/** Last time a card menu opened; guards double-fire on long-press. */
	private lastMenuAt = 0;

	private showCardMenu(
		habit: HabitDefinition,
		card: HTMLElement,
		x: number,
		y: number,
	): void {
		const now = Date.now();
		if (now - this.lastMenuAt < 500) {
			return;
		}
		this.lastMenuAt = now;
		const menu = new Menu();
		addDayStatusItems(
			menu,
			this.app,
			this.store,
			habit,
			toDateKey(this.selectedDate),
			() => this.render(),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Edit habit"))
				.setIcon("pencil")
				.onClick(() => {
					new HabitModal(
						this.app,
						this.store,
						() => this.reload(),
						habit,
						this.getSettings().experimental.noteHabits,
					).open();
				}),
		);
		if (habit.paused) {
			menu.addItem((item) =>
				item
					.setTitle(t("Resume habit"))
					.setIcon("play")
					.onClick(async () => {
						await this.store.resumeHabit(habit);
						this.reload();
					}),
			);
		} else {
			menu.addItem((item) =>
				item
					.setTitle(t("Pause habit"))
					.setIcon("pause")
					.onClick(async () => {
						this.suppressAutoReload = true;
						try {
							await this.store.pauseHabit(habit);
							if (this.getSettings().animations) {
								const overlay =
									await this.playPauseAnimation(card);
								await this.playCardDeparture(card, overlay);
							}
						} finally {
							this.suppressAutoReload = false;
						}
						this.reload();
					}),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle(t("Stop tracking"))
				.setIcon("circle-stop")
				.onClick(() => this.confirmStop(habit)),
		);
		menu.addItem((item) =>
			item
				.setTitle(t("Remove habit"))
				.setIcon("trash")
				.onClick(() => this.confirmRemove(habit)),
		);
		menu.showAtPosition({ x, y });
	}

	private confirmStop(habit: HabitDefinition): void {
		new ConfirmModal(this.app, {
			title: t("Stop tracking"),
			message: t(
				'Stop tracking "{name}"? It leaves the dashboard and stats, but its note and full history are kept. You can resume tracking any time from the note\'s metrics view.',
				{ name: habit.name },
			),
			confirmText: t("Stop tracking"),
			onConfirm: async () => {
				await this.store.stopHabit(habit);
				this.reload();
			},
		}).open();
	}

	private confirmRemove(habit: HabitDefinition): void {
		new ConfirmModal(this.app, {
			title: t("Remove habit"),
			message: t('Remove "{name}"? Its note will be moved to the trash.', {
				name: habit.name,
			}),
			confirmText: t("Remove"),
			danger: true,
			onConfirm: async () => {
				await this.store.deleteHabit(habit);
				this.reload();
			},
		}).open();
	}

	/** Open the modal for creating a brand-new habit. */
	private openCreateModal(): void {
		new HabitModal(
			this.app,
			this.store,
			() => {
				new Notice(t("Habit added to the dashboard."));
				this.reload();
			},
			null,
			this.getSettings().experimental.noteHabits,
		).open();
	}
}
