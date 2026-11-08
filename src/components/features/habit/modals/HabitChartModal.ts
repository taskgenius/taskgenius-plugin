import { t as settingsText } from "@/translations/helper";
import { App, Modal, Setting } from "obsidian";
import { DailyHabitProps } from "@/types/habit-card";
import {
	getLocalDateString,
	getTodayLocalDateString,
} from "@/utils/date/date-formatter";
import { HabitCard } from "@/components/features/habit/habitcard/habitcard";
import { t } from "@/translations/helper";
import "@/styles/habit.css";

export class HabitChartModal extends Modal {
	private habit: DailyHabitProps;
	private card: HabitCard;
	private heatmapHostEl!: HTMLElement;
	private earliestDateStr: string;
	private todayStr: string;

	constructor(app: App, card: HabitCard, habit: DailyHabitProps) {
		super(app);
		this.card = card;
		this.habit = habit;

		const dates = Object.keys(this.habit.completions || {});
		if (dates.length > 0) {
			const min = dates.reduce((min, d) => (d < min ? d : min));
			this.earliestDateStr = min;
		} else {
			this.earliestDateStr = getTodayLocalDateString();
		}
		this.todayStr = getTodayLocalDateString();
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.modalEl.toggleClass("habit-chart-modal", true);

		this.setTitle(settingsText("{{value0}} · Heatmap", { interpolation: { value0: String(this.habit.name) } }));

		// Controls (use Obsidian Setting + dropdowns)
		const controls = contentEl.createDiv({ cls: "habit-chart-controls" });
		const earliestYear = Number(this.earliestDateStr.slice(0, 4));
		const currentYear = new Date().getFullYear();
		let selectedRange: string = "all"; // all | 7d | 30d | 365d | year
		let selectedYear: string = String(currentYear);

		const rangeSetting = new Setting(controls)
			.setName(t("Range"))
			.addDropdown((dd) => {
				dd.addOptions({
					all: t("All history"),
					"7d": t("Last week"),
					"30d": t("Last month"),
					"365d": t("Last year"),
					year: t("Full year"),
				});
				dd.setValue(selectedRange);
				dd.onChange((value) => {
					selectedRange = value;
					yearSetting.settingEl.toggleClass(
						"is-disabled",
						value !== "year"
					);
					yearSelect.disabled = value !== "year";
					this.renderSelected(selectedRange, selectedYear);
				});
			});

		let yearSelect: HTMLSelectElement = null!;
		const yearSetting = new Setting(controls)
			.setName(t("Year"))
			.addDropdown((dd) => {
				yearSelect = dd.selectEl;
				for (let y = currentYear; y >= earliestYear; y--) {
					dd.addOption(String(y), String(y));
				}
				dd.setValue(selectedYear);
				dd.onChange((value) => {
					selectedYear = value;
					if (selectedRange === "year")
						this.renderSelected(selectedRange, selectedYear);
				});
			});
		yearSetting.settingEl.toggleClass(
			"is-disabled",
			selectedRange !== "year"
		);
		yearSelect.disabled = selectedRange !== "year";

		// Heatmap host
		this.heatmapHostEl = contentEl.createDiv({
			cls: "habit-chart-heatmap",
		});

		// Initial render
		this.renderSelected(selectedRange, selectedYear);
	}

	private renderSelected(range: string, year: string) {
		if (range === "all") {
			this.renderRange(this.earliestDateStr, this.todayStr);
			return;
		}
		if (range === "7d") {
			this.renderLastNDays(7);
			return;
		}
		if (range === "30d") {
			this.renderLastMonthCalendar();
			return;
		}
		if (range === "365d") {
			this.renderLastNDays(365);
			return;
		}
		if (range === "year") {
			const y = parseInt(year, 10);
			this.renderYearCalendar(y);
			return;
		}
		// Fallback
		this.renderRange(this.earliestDateStr, this.todayStr);
	}

	private createCalendarContainer(rows: number, cols: number) {
		const root = this.heatmapHostEl.createDiv({
			cls: `tg-heatmap-root heatmap-md`,
		});
		const grid = root.createDiv({ cls: "heatmap-container-calendar" });
		(grid as HTMLDivElement).style.display = "grid";
		(
			grid as HTMLDivElement
		).style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
		(
			grid as HTMLDivElement
		).style.gridTemplateRows = `repeat(${rows}, auto)`;
		(grid as HTMLDivElement).style.gap = "var(--size-2-2)";
		return grid;
	}

	private renderYearCalendar(year: number) {
		this.heatmapHostEl.empty();
		const start = new Date(year, 0, 1);
		const end = new Date(year, 11, 31);
		// Align to Monday and Sunday
		const startDow = (start.getDay() + 6) % 7; // 0=Mon
		const alignedStart = new Date(start);
		alignedStart.setDate(start.getDate() - startDow);
		const endDow = end.getDay(); // 0=Sun
		const add = (7 - endDow - 1 + 7) % 7; // days to reach Sunday (endDow=0 => 0)
		const alignedEnd = new Date(end);
		alignedEnd.setDate(end.getDate() + add);
		const totalDays =
			Math.floor(
				(alignedEnd.getTime() - alignedStart.getTime()) / 86400000
			) + 1;
		const weeks = Math.ceil(totalDays / 7);
		const grid = this.createCalendarContainer(7, weeks);

		const getVariant = (value: any) =>
			this.habit.completionText ? value === 1 : value === true;
		const comps = this.habit.completions || {};
		for (let w = 0; w < weeks; w++) {
			for (let d = 0; d < 7; d++) {
				const dateObj = new Date(
					alignedStart.getTime() + (w * 7 + d) * 86400000
				);
				const dateStr = getLocalDateString(dateObj);
				const cellValue = comps[dateStr];
				const isInYear = dateObj >= start && dateObj <= end;
				const isFilled = isInYear && getVariant(cellValue);
				const cell = grid.createDiv({
					cls: `heatmap-cell heatmap-cell-square`,
				});
				cell.dataset.date = dateStr;
				let tooltip =
					`${dateStr}: ` +
					(cellValue == null
						? t("Missed")
						: isFilled
						? t("Completed")
						: t("Missed"));
				cell.setAttribute("aria-label", tooltip);
				if (isInYear) {
					cell.addClass(isFilled ? "filled" : "default");
				} else {
					cell.addClass("default");
					(cell as HTMLDivElement).style.opacity = "0.25";
				}
			}
		}
	}

	private renderLastMonthCalendar() {
		this.heatmapHostEl.empty();
		const end = new Date();
		const start = new Date(end.getTime() - 29 * 86400000);
		// align start to Monday of its week
		const startDow = (start.getDay() + 6) % 7; // 0=Mon
		const alignedStart = new Date(start);
		alignedStart.setDate(start.getDate() - startDow);
		const rows = 5,
			cols = 7;
		const grid = this.createCalendarContainer(rows, cols);
		const getVariant = (value: any) =>
			this.habit.completionText ? value === 1 : value === true;
		const comps = this.habit.completions || {};
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const dayIndex = r * 7 + c;
				const dateObj = new Date(
					alignedStart.getTime() + dayIndex * 86400000
				);
				const dateStr = getLocalDateString(dateObj);
				const inRange = dateObj >= start && dateObj <= end;
				const cellValue = comps[dateStr];
				const isFilled = inRange && getVariant(cellValue);
				const cell = grid.createDiv({
					cls: `heatmap-cell heatmap-cell-square`,
				});
				cell.dataset.date = dateStr;
				let tooltip =
					`${dateStr}: ` +
					(cellValue == null
						? t("Missed")
						: isFilled
						? t("Completed")
						: t("Missed"));
				cell.setAttribute("aria-label", tooltip);
				cell.addClass(
					inRange ? (isFilled ? "filled" : "default") : "default"
				);
				if (!inRange) (cell as HTMLDivElement).style.opacity = "0.25";
			}
		}
	}

	private renderLastNDays(n: number) {
		const end = new Date();
		const start = new Date(end.getTime() - (n - 1) * 24 * 60 * 60 * 1000);
		this.renderRange(getLocalDateString(start), getLocalDateString(end));
	}

	private renderRange(startStr: string, endStr: string) {
		this.heatmapHostEl.empty();
		const getVariant = (value: any) => {
			if (this.habit.completionText) return value === 1;
			return value === true;
		};
		this.card.renderHeatmapRange(
			this.heatmapHostEl,
			this.habit.completions || {},
			startStr,
			endStr,
			"md",
			getVariant
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
