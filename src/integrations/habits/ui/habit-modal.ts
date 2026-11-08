import {
	AbstractInputSuggest,
	App,
	ButtonComponent,
	ColorComponent,
	Modal,
	moment,
	Setting,
	setIcon,
} from "obsidian";
import type { HabitStore } from "../habit-store";
import type {
	GoalDirection,
	HabitDefinition,
	HabitFrequency,
	HabitType,
	NoteChecklistRequirement,
	NoteCompletionMode,
} from "../types";
import {
	applyHabitIcon,
	IconSuggestModal,
	iconLabel,
	isLucideIcon,
} from "./icon-suggest-modal";
import { EmojiSuggestModal } from "./emoji-suggest-modal";
import { FolderSuggest, MarkdownFileSuggest } from "./vault-suggest";
import { DEFAULT_NOTE_FILENAME_FORMAT } from "../note-habit";
import {
	allowsDecimals,
	cleanValue,
	isFlexibleFrequency,
	roundValue,
} from "../utils";
import { t } from "../i18n";

/**
 * Accent colours taken from the current theme's palette. Storing the CSS
 * variable (rather than a fixed hex) means a habit's colour follows the
 * user's theme and updates automatically if they switch themes.
 */
export const THEME_COLORS: readonly { label: string; value: string }[] = [
	{ label: "Accent", value: "var(--interactive-accent)" },
	{ label: "Red", value: "var(--color-red)" },
	{ label: "Orange", value: "var(--color-orange)" },
	{ label: "Yellow", value: "var(--color-yellow)" },
	{ label: "Green", value: "var(--color-green)" },
	{ label: "Cyan", value: "var(--color-cyan)" },
	{ label: "Blue", value: "var(--color-blue)" },
	{ label: "Purple", value: "var(--color-purple)" },
	{ label: "Pink", value: "var(--color-pink)" },
];

/**
 * Weekdays offered for weekly habits, ordered Monday-first for familiarity.
 * Values are JavaScript `getDay` numbers (`0` = Sunday) so they map directly
 * onto `Date.getDay()` when checking whether a habit is due.
 */
const WEEKDAYS: readonly { label: string; value: number }[] = [
	{ label: "Monday", value: 1 },
	{ label: "Tuesday", value: 2 },
	{ label: "Wednesday", value: 3 },
	{ label: "Thursday", value: 4 },
	{ label: "Friday", value: 5 },
	{ label: "Saturday", value: 6 },
	{ label: "Sunday", value: 0 },
];

/**
 * Locale-aware short weekday name (e.g. "Mon", "lun.", "月") for a `getDay`
 * value. 2024-01-07 was a Sunday, so day 7 + value lands on the right day.
 */
function weekdayShortLabel(value: number): string {
	return new Date(2024, 0, 7 + value).toLocaleDateString(undefined, {
		weekday: "short",
	});
}

/** Suggests existing group names while typing in the group field. */
class GroupSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private textInputEl: HTMLInputElement,
		private groups: () => string[],
	) {
		super(app, textInputEl);
	}

	getSuggestions(query: string): string[] {
		const needle = query.toLowerCase();
		return this.groups().filter((group) =>
			group.toLowerCase().includes(needle),
		);
	}

	renderSuggestion(group: string, el: HTMLElement): void {
		el.setText(group);
	}

	selectSuggestion(group: string): void {
		this.textInputEl.value = group;
		this.textInputEl.trigger("input");
		this.close();
	}
}

/** A placeholder example shown to hint at how a habit type is used. */
interface HabitExample {
	name: string;
	unit?: string;
	target?: number;
}

/**
 * Ten example habits per type. One is chosen at random each time the modal
 * opens so the placeholders vary and illustrate different use cases.
 */
const EXAMPLES: Record<HabitType, HabitExample[]> = {
	binary: [
		{ name: "Make the bed" },
		{ name: "Take vitamins" },
		{ name: "Floss teeth" },
		{ name: "No sugar today" },
		{ name: "Write a journal entry" },
		{ name: "Stretch" },
		{ name: "Read before bed" },
		{ name: "Tidy the workspace" },
		{ name: "Take a cold shower" },
		{ name: "Call a friend" },
	],
	repetition: [
		{ name: "Drink water", unit: "Cups", target: 8 },
		{ name: "Step count", unit: "Steps", target: 10000 },
		{ name: "Push-ups", unit: "Reps", target: 50 },
		{ name: "Read", unit: "Pages", target: 20 },
		{ name: "Eat vegetables", unit: "Servings", target: 5 },
		{ name: "Water the plants", unit: "Plants", target: 4 },
		{ name: "Learn vocabulary", unit: "Words", target: 10 },
		{ name: "Sit-ups", unit: "Reps", target: 30 },
		{ name: "Practise chords", unit: "Chords", target: 6 },
		{ name: "Drink milk", unit: "Glasses", target: 2 },
	],
	timed: [
		{ name: "Exercise", target: 30 },
		{ name: "Meditate", target: 10 },
		{ name: "Read", target: 20 },
		{ name: "Study", target: 45 },
		{ name: "Walk", target: 25 },
		{ name: "Practise piano", target: 30 },
		{ name: "Yoga", target: 20 },
		{ name: "Deep work", target: 60 },
		{ name: "Practise a language", target: 15 },
		{ name: "Stretch", target: 10 },
	],
	note: [
		{ name: "Journal" },
		{ name: "Morning pages" },
		{ name: "Gratitude log" },
		{ name: "Daily reflection" },
		{ name: "Dream journal" },
		{ name: "Reading notes" },
		{ name: "Work log" },
		{ name: "Meal log" },
		{ name: "Idea capture" },
		{ name: "Trip diary" },
	],
};

/** Example habits shown when the goal is a limit rather than a target. */
const LIMIT_EXAMPLES: Record<HabitType, HabitExample[]> = {
	binary: [
		{ name: "No smoking" },
		{ name: "No alcohol" },
		{ name: "No fast food" },
		{ name: "No online shopping" },
		{ name: "No snoozing the alarm" },
		{ name: "No nail biting" },
	],
	repetition: [
		{ name: "Cigarettes", unit: "Cigarettes", target: 2 },
		{ name: "Coffee", unit: "Cups", target: 2 },
		{ name: "Fizzy drinks", unit: "Cans", target: 1 },
		{ name: "Snacks", unit: "Snacks", target: 2 },
		{ name: "Impulse buys", unit: "Purchases", target: 0 },
	],
	timed: [
		{ name: "Gaming", target: 120 },
		{ name: "Social media", target: 30 },
		{ name: "TV", target: 60 },
		{ name: "Phone before bed", target: 0 },
	],
	// Note habits have no limit variant; unreachable in the UI (the Goal
	// picker is hidden for them), kept only so this record stays exhaustive.
	note: EXAMPLES.note,
};

/**
 * Constrain a text input to numbers within an optional range: whole numbers
 * by default, or any decimal when `decimals` is set.
 */
function applyNumeric(
	input: HTMLInputElement,
	min: number,
	max?: number,
	decimals = false,
): void {
	input.type = "number";
	input.inputMode = decimals ? "decimal" : "numeric";
	input.min = String(min);
	if (max !== undefined) {
		input.max = String(max);
	}
	input.step = decimals ? "any" : "1";
}

/** Modal that collects the details needed to create a new habit. */
export class HabitModal extends Modal {
	private habitName = "";
	private type: HabitType = "binary";
	private goalDirection: GoalDirection = "min";
	private frequency: HabitFrequency = "daily";
	private weekdays: number[] = [new Date().getDay()];
	private monthDay = new Date().getDate();
	private intervalDays = 2;
	private intervalMode: "fixed" | "completion" = "fixed";
	private times: string[] = [];
	private target = 1;
	private unit = "";
	private step = 1;
	private weeklyTarget = 0;
	private monthlyTarget = 0;
	private weeklyPerfect = false;
	private monthlyPerfect = false;
	private targetsOpen = false;
	private color = "var(--interactive-accent)";
	private icon = "";
	private group = "";
	private groupColor = "";
	private groupIcon = "";
	private useGroupColor = false;
	/** Raw text of the Tags field, comma/space-separated; split at submit. */
	private tagsInput = "";
	private noteFolder = "";
	private noteFilenameFormat = "";
	private templatePath = "";
	private noteCompletionMode: NoteCompletionMode = "chars";
	private noteChecklistRequirement: NoteChecklistRequirement = "all";
	private noteChecklistMin = 1;
	private noteFailKeyword = "";
	/** Group whose saved style is currently loaded, to avoid clobbering
	 * fresh picks with a reload on every keystroke. */
	private loadedGroupName: string | null = null;
	private exampleIndex = 0;
	private editing: HabitDefinition | null = null;

	private closeButton: HTMLElement | null = null;
	private closeFromHeader = (event: MouseEvent): void => {
		if (event.button !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		this.close();
	};
	private previewIconEl: HTMLElement | null = null;
	private previewNameEl: HTMLElement | null = null;
	private iconButton: ButtonComponent | null = null;
	private customPicker: ColorComponent | null = null;
	private colorSwatches: { value: string; el: HTMLElement }[] = [];
	private groupStyleEl: HTMLElement | null = null;
	private groupIconButton: ButtonComponent | null = null;
	private groupSwatches: { value: string; el: HTMLElement }[] = [];

	constructor(
		app: App,
		private store: HabitStore,
		private onCreated: () => void,
		editing: HabitDefinition | null = null,
		private allowNoteHabits = false,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
		this.editing = editing;
		if (editing) {
			this.habitName = editing.name;
			this.type = editing.type;
			this.goalDirection = editing.goalDirection;
			this.frequency = editing.frequency;
			if (editing.frequency === "weekly") {
				this.weekdays = [...editing.weekdays];
			} else if (editing.frequency === "monthly") {
				this.monthDay = editing.monthDay;
			} else if (editing.frequency === "interval") {
				this.intervalDays = editing.intervalDays;
				this.intervalMode = editing.intervalMode ?? "fixed";
			}
			this.times = [...editing.times];
			// A limit habit's target may legitimately be 0 ("none at all");
			// only build habits coerce a missing target to 1.
			this.target =
				editing.goalDirection === "max"
					? Math.max(0, editing.target)
					: editing.target || 1;
			this.unit = editing.unit;
			this.step = editing.step > 0 ? editing.step : 1;
			this.weeklyTarget = editing.weeklyTarget || 0;
			this.monthlyTarget = editing.monthlyTarget || 0;
			this.weeklyPerfect = editing.weeklyPerfect;
			this.monthlyPerfect = editing.monthlyPerfect;
			this.icon = editing.icon;
			this.color = editing.color || "var(--interactive-accent)";
			this.group = editing.group;
			this.useGroupColor = editing.useGroupColor;
			this.tagsInput = editing.tags.join(", ");
			this.noteFolder = editing.noteFolder;
			this.noteFilenameFormat = editing.noteFilenameFormat;
			this.templatePath = editing.templatePath;
			this.noteCompletionMode = editing.noteCompletionMode;
			this.noteChecklistRequirement = editing.noteChecklistRequirement;
			this.noteChecklistMin = editing.noteChecklistMin || 1;
			this.noteFailKeyword = editing.noteFailKeyword;
		}
	}

	onOpen(): void {
		this.modalEl.addClass("habits-modal");
		// Obsidian renamed the native header control in newer releases.
		// Handle release on this control before unrelated document click handlers.
		this.closeButton = this.modalEl.querySelector<HTMLElement>(".modal-header-button, .modal-close-button");
		this.closeButton?.addEventListener("pointerup", this.closeFromHeader);
		this.closeButton?.addEventListener("click", this.closeFromHeader, true);
		this.exampleIndex = Math.floor(
			Math.random() * this.exampleList().length,
		);
		this.build();
	}

	onClose(): void {
		this.closeButton?.removeEventListener("pointerup", this.closeFromHeader);
		this.closeButton?.removeEventListener("click", this.closeFromHeader, true);
		this.closeButton = null;
		this.contentEl.empty();
	}

	private build(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName(this.editing ? t("Edit habit") : t("New habit"))
			.setHeading();

		this.renderPreview(contentEl);

		new Setting(contentEl).setName(t("Name")).addText((text) =>
			text
				.setPlaceholder(this.currentExample().name)
				.setValue(this.habitName)
				.onChange((value) => {
					this.habitName = value;
					this.updatePreview();
				}),
		);

		// At least (reach a target) or at most (stay within a limit). Note
		// habits have no limit variant.
		if (this.type !== "note") {
			new Setting(contentEl)
				.setName(t("Goal"))
				.setDesc(
					t(
						"At least: reach a target for habits you are building, like drinking 1.5 litres of water. At most: stay within a limit for habits you are cutting down, like no more than 2 coffees.",
					),
				)
				.addDropdown((dropdown) =>
					dropdown
						.addOption("min", t("At least (reach a target)"))
						.addOption("max", t("At most (stay within a limit)"))
						.setValue(this.goalDirection)
						.onChange((value) => {
							this.goalDirection = value as GoalDirection;
							this.randomizeExample();
							this.build();
						}),
				);
		}

		const isMax = this.goalDirection === "max";
		const allowNote =
			this.allowNoteHabits || this.editing?.type === "note";
		new Setting(contentEl)
			.setName(t("Type"))
			.setDesc(
				isMax
					? t(
							"Binary means avoiding it entirely. Repetition counts against a limit. Timed tracks minutes against a limit. Frequency determines when the limit applies.",
						)
					: allowNote
						? t(
								"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes. Note is completed by writing in a per-day note.",
							)
						: t(
								"Binary is done or not done. Repetition counts towards a target. Timed tracks minutes.",
							),
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("binary", t("Binary"))
					.addOption("repetition", t("Repetition"))
					.addOption("timed", t("Timed"));
				if (allowNote) {
					dropdown.addOption("note", t("Note"));
				}
				dropdown.setValue(this.type).onChange((value) => {
					this.type = value as HabitType;
					if (this.type === "note") {
						// Note habits have no limit variant, and no
						// flexible-frequency variant either.
						this.goalDirection = "min";
						if (isFlexibleFrequency(this.frequency)) {
							this.frequency = "daily";
						}
					}
					this.randomizeExample();
					this.build();
				});
			});

		const isFlexible = isFlexibleFrequency(this.frequency);
		if ((this.type !== "binary" && this.type !== "note") || (isFlexible && !isMax)) {
			const targetName = isMax
				? isFlexible
					? this.frequency === "flexibleWeekly" ? t("Weekly limit") : t("Monthly limit")
					: this.frequency === "daily" ? t("Daily limit") : t("Limit per due day")
				: isFlexible
				? this.frequency === "flexibleWeekly"
					? t("Times per week")
					: t("Times per month")
				: this.type === "timed"
						? t("Daily target (minutes)")
						: t("Daily target");
			const setting = new Setting(contentEl).setName(targetName);
			if (isMax) {
				setting.setDesc(t("0 means none at all."));
				if (this.type === "timed") setting.setDesc(t("Limit in minutes. 0 means none at all."));
			} else if (isFlexible) {
				setting.setDesc(
					t(
						"How many times (or, for counted and timed habits, how much in total) this needs to happen somewhere in the period.",
					),
				);
			}
			// Counted habits take decimal amounts (1.5 litres); timed habits
			// are whole minutes, and binary "times per period" whole times.
			const decimals = allowsDecimals({ type: this.type });
			setting.addText((text) => {
				// A limit of 0 is meaningful ("none at all"); a target of 0
				// is not, so build habits keep their minimum of 1 — or, for
				// decimal amounts, anything above 0.
				applyNumeric(text.inputEl, isMax || decimals ? 0 : 1, undefined, decimals);
				text
					.setPlaceholder(
						String(
							this.currentExample().target ??
								(this.type === "timed" ? 30 : 8),
						),
					)
					.setValue(String(this.target))
					.onChange((value) => {
						const parsed = Number(value);
						const fallback = isMax ? 0 : 1;
						if (!Number.isFinite(parsed)) {
							this.target = fallback;
						} else if (decimals) {
							const amount = roundValue(parsed);
							this.target = isMax
								? Math.max(0, amount)
								: amount > 0
									? amount
									: fallback;
						} else {
							this.target = Math.max(fallback, Math.round(parsed));
						}
					});
			});

			if (this.type === "repetition") {
				new Setting(contentEl)
					.setName(t("Unit"))
					.setDesc(t("Optional label shown next to the count."))
					.addText((text) =>
						text
							.setPlaceholder(this.currentExample().unit ?? "Cups")
							.setValue(this.unit)
							.onChange((value) => {
								this.unit = value;
							}),
					);
				new Setting(contentEl)
					.setName(t("Step size"))
					.setDesc(
						t(
							"How much each + and − press adds or removes. Use a decimal such as 0.25 for amounts like litres.",
						),
					)
					.addText((text) => {
						applyNumeric(text.inputEl, 0, undefined, true);
						text
							.setPlaceholder("1")
							.setValue(String(this.step))
							.onChange((value) => {
								const parsed = roundValue(Number(value));
								this.step =
									Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
							});
					});
			}
		}

		this.renderFrequency(contentEl);

		// A planned time of day doesn't fit "sometime this week/month" —
		// skip it for flexible frequencies.
		if (!isFlexibleFrequency(this.frequency)) {
			this.renderTime(contentEl);
		}

		if (this.type === "note") {
			this.renderNoteSettings(contentEl);
		}

		// Weekly and monthly goals count days completed within a period, which
		// only makes sense for a daily habit; a weekly/monthly habit is due at
		// most once per period.
		if (this.frequency === "daily") {
			this.renderTargets(contentEl);
		}

		new Setting(contentEl)
			.setName(t("Icon"))
			.setDesc(t("Choose a Lucide icon or an emoji to represent this habit."))
			.addButton((button) => {
				this.iconButton = button;
				this.updateIconButton();
				button.onClick(() => {
					new IconSuggestModal(this.app, (icon) => {
						this.icon = icon;
						this.updateIconButton();
						this.updatePreview();
					}).open();
				});
			})
			.addButton((button) =>
				button
					.setButtonText(t("Emoji"))
					.setTooltip(t("Choose an emoji"))
					.onClick(() => {
						new EmojiSuggestModal(this.app, (emoji) => {
							this.icon = emoji;
							this.updateIconButton();
							this.updatePreview();
						}).open();
					}),
			)
			.addExtraButton((extra) =>
				extra
					.setIcon("x")
					.setTooltip(t("Clear icon"))
					.onClick(() => {
						this.icon = "";
						this.updateIconButton();
						this.updatePreview();
					}),
			);

		this.renderColorPicker(contentEl);

		new Setting(contentEl)
			.setName(t("Group"))
			.setDesc(
				t(
					"Optional group used to build dashboard sections — for example an area of responsibility.",
				),
			)
			.addText((text) => {
				text
					.setPlaceholder(t("e.g. Health"))
					.setValue(this.group)
					.onChange((value) => {
						this.group = value;
						this.loadGroupStyle();
						this.updateGroupStyleUi();
						this.updatePreview();
					});
				new GroupSuggest(this.app, text.inputEl, () =>
					this.existingGroups(),
				);
			});

		this.groupStyleEl = contentEl.createDiv({
			cls: "habits-group-style",
		});
		this.renderGroupStyle(this.groupStyleEl);
		this.loadGroupStyle();
		this.updateGroupStyleUi();

		new Setting(contentEl)
			.setName(t("Tags"))
			.setDesc(
				t(
					"Optional Obsidian tags for this note, separated by commas or spaces. Useful for making this habit recognisable to another plugin's own tag-based rules — for example TaskNotes' task tag.",
				),
			)
			.addText((text) =>
				text
					.setPlaceholder(t("e.g. task"))
					.setValue(this.tagsInput)
					.onChange((value) => {
						this.tagsInput = value;
					}),
			);

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText(t("Cancel")).onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(this.editing ? t("Save changes") : t("Create habit"))
					.setCta()
					.onClick(async () => {
						// A checklist-only habit's target/unit are fixed: a
						// 0–100 checked percentage under the "all" requirement,
						// or the required checked count under "count". A chars
						// (or "both") habit uses the character goal the user
						// typed — "both" stores its combined value in the same
						// units, see computeNoteValue in note-habit.ts.
						const isNote = this.type === "note";
						const isChecklistOnly =
							isNote && this.noteCompletionMode === "checklist";
						const isChecklistCount =
							isChecklistOnly &&
							this.noteChecklistRequirement === "count";
						const options = {
							name: this.habitName,
							type: this.type,
							goalDirection: this.goalDirection,
							frequency: this.frequency,
							weekdays: [...this.weekdays],
							monthDay: this.monthDay,
							intervalDays: this.intervalDays,
							intervalMode: this.intervalMode,
							// The time picker is hidden for flexible
							// frequencies, so a stale value from before the
							// frequency changed must not persist unseen.
							times: isFlexibleFrequency(this.frequency)
								? []
								: this.times.filter((value) => value !== ""),
							target: isChecklistOnly
								? isChecklistCount
									? this.noteChecklistMin
									: 100
								: isNote
									? this.target > 0
										? this.target
										: 500
									: // A decimal typed for a counted habit
										// can't stay if the type changed since.
										cleanValue({ type: this.type }, this.target),
							step: allowsDecimals({ type: this.type }) ? this.step : 1,
							unit: isNote
								? isChecklistOnly
									? isChecklistCount
										? "tasks"
										: "%"
									: "chars"
								: this.unit,
							weeklyTarget: this.weeklyTarget,
							monthlyTarget: this.monthlyTarget,
							weeklyPerfect: this.weeklyPerfect,
							monthlyPerfect: this.monthlyPerfect,
							icon: this.icon,
							color: this.color,
							group: this.group.trim(),
							useGroupColor:
								this.useGroupColor &&
								this.group.trim() !== "",
							tags: this.tagsInput
								.split(/[,\s]+/)
								.map((tag) => tag.trim().replace(/^#/, ""))
								.filter((tag) => tag !== ""),
							noteFolder: this.noteFolder.trim(),
							noteFilenameFormat: this.noteFilenameFormat.trim(),
							templatePath: this.templatePath.trim(),
							noteCompletionMode: this.noteCompletionMode,
							noteChecklistRequirement: this.noteChecklistRequirement,
							noteChecklistMin: this.noteChecklistMin,
							noteFailKeyword: this.noteFailKeyword.trim(),
						};
						const file = this.editing
							? await this.store.updateHabit(this.editing, options)
							: await this.store.createHabit(options);
						if (file) {
							if (options.group) {
								await this.store.setGroupStyle(options.group, {
									color: this.groupColor,
									icon: this.groupIcon,
								});
							}
							this.close();
							this.onCreated();
						}
					}),
			);
	}

	/**
	 * Group styling rows shown while a group name is present: a shared
	 * colour, a shared icon, and the per-habit override toggle. Colour
	 * and icon are stored once per group (in the plugin settings), so
	 * changing them here restyles every card in the group.
	 */
	private renderGroupStyle(container: HTMLElement): void {
		container.empty();

		const colorSetting = new Setting(container)
			.setName(t("Group color"))
			.setDesc(t("Optional color shared by every habit in this group."));
		const swatches = colorSetting.controlEl.createDiv({
			cls: "habits-swatches",
		});
		this.groupSwatches = [];
		for (const swatch of THEME_COLORS) {
			const el = swatches.createEl("button", {
				cls: "habits-swatch",
				attr: { type: "button", "aria-label": t(swatch.label) },
			});
			el.setCssProps({ "--habits-swatch": swatch.value });
			el.addEventListener("click", () => {
				// Clicking the selected swatch clears the group colour.
				this.groupColor =
					this.groupColor === swatch.value ? "" : swatch.value;
				this.updateGroupStyleUi();
				this.updatePreview();
			});
			this.groupSwatches.push({ value: swatch.value, el });
		}
		colorSetting.addColorPicker((picker) => {
			if (this.groupColor.startsWith("#")) {
				picker.setValue(this.groupColor);
			}
			picker.onChange((value) => {
				this.groupColor = value;
				this.updateGroupStyleUi();
				this.updatePreview();
			});
		});

		new Setting(container)
			.setName(t("Group icon"))
			.setDesc(
				t("Shown in the group lip on cards and in section headers."),
			)
			.addButton((button) => {
				this.groupIconButton = button;
				this.updateGroupIconButton();
				button.onClick(() => {
					new IconSuggestModal(this.app, (icon) => {
						this.groupIcon = icon;
						this.updateGroupIconButton();
					}).open();
				});
			})
			.addButton((button) =>
				button
					.setButtonText(t("Emoji"))
					.setTooltip(t("Choose an emoji"))
					.onClick(() => {
						new EmojiSuggestModal(this.app, (emoji) => {
							this.groupIcon = emoji;
							this.updateGroupIconButton();
						}).open();
					}),
			)
			.addExtraButton((extra) =>
				extra
					.setIcon("x")
					.setTooltip(t("Clear icon"))
					.onClick(() => {
						this.groupIcon = "";
						this.updateGroupIconButton();
					}),
			);

		new Setting(container)
			.setName(t("Use group color for this card"))
			.setDesc(t("Show this card in the group color instead of its own."))
			.addToggle((toggle) =>
				toggle.setValue(this.useGroupColor).onChange((value) => {
					this.useGroupColor = value;
					this.updatePreview();
				}),
			);
	}

	/**
	 * When the group name changes to one with a saved style, load it;
	 * otherwise keep whatever the user has picked so far.
	 */
	private loadGroupStyle(): void {
		const name = this.group.trim();
		if (name === this.loadedGroupName) {
			return;
		}
		this.loadedGroupName = name;
		const style = name ? this.store.getGroupStyle(name) : undefined;
		if (style) {
			this.groupColor = style.color;
			this.groupIcon = style.icon;
		}
	}

	private updateGroupStyleUi(): void {
		this.groupStyleEl?.toggle(this.group.trim() !== "");
		for (const swatch of this.groupSwatches) {
			swatch.el.toggleClass(
				"is-selected",
				swatch.value === this.groupColor,
			);
		}
		this.updateGroupIconButton();
	}

	private updateGroupIconButton(): void {
		const button = this.groupIconButton;
		if (!button) {
			return;
		}
		button.buttonEl.empty();
		const glyph = button.buttonEl.createSpan({
			cls: "habits-button-icon",
		});
		if (this.groupIcon) {
			applyHabitIcon(glyph, this.groupIcon);
			button.buttonEl.createSpan({
				text: isLucideIcon(this.groupIcon)
					? iconLabel(this.groupIcon)
					: t("Emoji"),
			});
		} else {
			setIcon(glyph, "image-plus");
			button.buttonEl.createSpan({ text: t("Choose icon") });
		}
	}

	/** The colour the card will actually show, honouring the override. */
	private effectiveColor(): string {
		if (this.useGroupColor && this.group.trim() && this.groupColor) {
			return this.groupColor;
		}
		return this.color;
	}

	/** Unique group names already in use, for the group suggestions. */
	private existingGroups(): string[] {
		const groups = new Set<string>();
		for (const habit of this.store.getHabits()) {
			const group = habit.group.trim();
			if (group) {
				groups.add(group);
			}
		}
		return Array.from(groups).sort((a, b) => a.localeCompare(b));
	}

	/** The example pool matching the current goal direction and type. */
	private exampleList(): HabitExample[] {
		const source =
			this.goalDirection === "max" ? LIMIT_EXAMPLES : EXAMPLES;
		return source[this.type];
	}

	/** Move to a different example so switching type always rotates. */
	private randomizeExample(): void {
		const count = this.exampleList().length;
		this.exampleIndex =
			(this.exampleIndex + 1 + Math.floor(Math.random() * (count - 1))) %
			count;
	}

	private currentExample(): HabitExample {
		const list = this.exampleList();
		return list[this.exampleIndex % list.length];
	}

	/**
	 * Frequency picker: daily, weekly (with one or more weekdays), monthly
	 * (with a day of the month), every N days, or a flexible weekly/monthly
	 * quota met on any day. Non-daily habits only surface on their due
	 * dates — flexible ones are the exception, showing every day until
	 * their period's quota is met. Not offered for note habits, whose
	 * completion is file-content-based rather than a period total.
	 */
	private renderFrequency(contentEl: HTMLElement): void {
		const allowFlexible = this.type !== "note";
		new Setting(contentEl)
			.setName(t("Frequency"))
			.setDesc(
				this.goalDirection === "max" ? t("Choose the days this limit applies, or a weekly/monthly total limit that can be logged on any day.") : t(
					"How often this habit is due. Weekly and monthly habits only appear on their due date; the \"any day\" options appear every day until their quota is met.",
				),
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("daily", t("Daily"))
					.addOption("weekly", t("Weekly"))
					.addOption("monthly", t("Monthly"))
					.addOption("interval", t("Every N days"));
				if (allowFlexible) {
					dropdown
						.addOption("flexibleWeekly", t("Weekly (any day)"))
						.addOption("flexibleMonthly", t("Monthly (any day)"));
				}
				dropdown.setValue(this.frequency).onChange((value) => {
					this.frequency = value as HabitFrequency;
					this.build();
				});
			});

		if (this.frequency === "weekly") {
			const setting = new Setting(contentEl)
				.setName(t("Days of week"))
				.setDesc(
					t(
						"The weekdays this habit is due on. Pick as many as you need.",
					),
				);
			const row = setting.controlEl.createDiv({
				cls: "habits-weekday-picker",
			});
			for (const day of WEEKDAYS) {
				const active = (): boolean =>
					this.weekdays.includes(day.value);
				const pill = row.createEl("button", {
					cls: "habits-weekday-pill",
					text: weekdayShortLabel(day.value),
					attr: {
						type: "button",
						"aria-label": t(day.label),
						"aria-pressed": String(active()),
					},
				});
				pill.toggleClass("is-active", active());
				pill.addEventListener("click", () => {
					if (active()) {
						// Keep at least one day selected: a weekly habit
						// due on no day at all would simply never appear.
						if (this.weekdays.length === 1) {
							return;
						}
						this.weekdays = this.weekdays.filter(
							(value) => value !== day.value,
						);
					} else {
						this.weekdays = [...this.weekdays, day.value].sort(
							(a, b) => a - b,
						);
					}
					pill.toggleClass("is-active", active());
					pill.setAttr("aria-pressed", String(active()));
				});
			}
		}

		if (this.frequency === "interval") {
			new Setting(contentEl)
				.setName(t("Interval schedule"))
				.setDesc(t("Fixed schedules follow the start date. Completion schedules stay due when missed and restart the interval after you complete the habit. Maximum limits keep a fixed schedule."))
				.addDropdown(dropdown => dropdown
					.addOption("fixed", t("From start date"))
					.addOption("completion", t("From actual completion"))
					.setValue(this.intervalMode)
					.onChange(value => { this.intervalMode = value === "completion" ? "completion" : "fixed"; }));
			new Setting(contentEl)
				.setName(t("Repeat every"))
				.setDesc(
					t(
						"Number of days between due dates, counted from the habit's start date. Use 2 for an alternate-day schedule.",
					),
				)
				.addText((text) => {
					applyNumeric(text.inputEl, 2, 365);
					text.setValue(String(this.intervalDays)).onChange(
						(value) => {
							const parsed = Math.round(Number(value));
							if (Number.isFinite(parsed)) {
								this.intervalDays = Math.min(
									365,
									Math.max(2, parsed),
								);
							}
						},
					);
				});
		}

		if (this.frequency === "monthly") {
			new Setting(contentEl)
				.setName(t("Day of month"))
				.setDesc(
					t(
						"The day of the month this habit is due. In shorter months it falls due on the last day, so 31 always lands on the final day of the month.",
					),
				)
				.addDropdown((dropdown) => {
					for (let day = 1; day <= 31; day++) {
						dropdown.addOption(String(day), String(day));
					}
					dropdown
						.setValue(String(this.monthDay))
						.onChange((value) => {
							this.monthDay = Number(value);
						});
				});
		}
	}

	/**
	 * Optional planned times of day — one row per time plus an add button,
	 * so twice-daily plans (e.g. medication at 13:30 and 21:30) are one
	 * habit. Informational only: shown on the habit's card next to the
	 * schedule, never affects due-ness.
	 */
	private renderTime(contentEl: HTMLElement): void {
		const setting = new Setting(contentEl)
			.setName(t("Time of day"))
			.setDesc(
				t(
					"Optional times this habit is planned for — once or several times a day. Shown on the habit's card.",
				),
			);
		const box = setting.controlEl.createDiv({
			cls: "habits-time-picker",
		});

		const renderRows = (): void => {
			box.empty();
			this.times.forEach((value, index) => {
				const row = box.createDiv({ cls: "habits-time-row" });
				const input = row.createEl("input", {
					cls: "habits-time-input",
					attr: { type: "time" },
				});
				input.value = value;
				input.addEventListener("change", () => {
					this.times[index] = input.value;
				});
				const remove = row.createEl("button", {
					cls: "habits-icon-button habits-time-remove",
					attr: {
						type: "button",
						"aria-label": t("Remove time"),
					},
				});
				setIcon(remove, "x");
				remove.addEventListener("click", () => {
					this.times.splice(index, 1);
					renderRows();
				});
			});
			const add = box.createEl("button", {
				cls: "habits-time-add",
				text: t("Add time"),
				attr: { type: "button" },
			});
			add.addEventListener("click", () => {
				this.times.push("");
				renderRows();
			});
		};
		renderRows();
	}

	/**
	 * Settings specific to note habits: where day-notes live, how they are
	 * named, an optional Templater template, and how a day counts as done.
	 */
	private renderNoteSettings(contentEl: HTMLElement): void {
		new Setting(contentEl)
			.setName(t("Notes folder"))
			.setDesc(
				t(
					"Folder each day's note is created in. Leave blank for a dedicated subfolder named after this habit.",
				),
			)
			.addText((text) => {
				text
					.setPlaceholder(t("e.g. Journal"))
					.setValue(this.noteFolder)
					.onChange((value) => {
						this.noteFolder = value;
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		const formatDesc = (): string => {
			const format =
				this.noteFilenameFormat.trim() || DEFAULT_NOTE_FILENAME_FORMAT;
			const example = (
				moment as unknown as (
					date: Date,
				) => { format(fmt: string): string }
			)(new Date()).format(format);
			return t(
				"Moment.js format used to name each day's note, e.g. {example}. May include / for date-based subfolders.",
				{ example },
			);
		};
		const formatSetting = new Setting(contentEl).setName(
			t("Filename format"),
		);
		formatSetting.setDesc(formatDesc());
		formatSetting.addText((text) =>
			text
				.setPlaceholder(DEFAULT_NOTE_FILENAME_FORMAT)
				.setValue(this.noteFilenameFormat)
				.onChange((value) => {
					this.noteFilenameFormat = value;
					formatSetting.setDesc(formatDesc());
				}),
		);

		new Setting(contentEl)
			.setName(t("Template"))
			.setDesc(
				t(
					"Optional template note used when a day's note is created. Expanded through the Templater plugin when it is installed, otherwise copied as plain text.",
				),
			)
			.addText((text) => {
				text
					.setPlaceholder(t("e.g. Templates/Journal.md"))
					.setValue(this.templatePath)
					.onChange((value) => {
						this.templatePath = value;
					});
				new MarkdownFileSuggest(this.app, text.inputEl);
			});

		new Setting(contentEl)
			.setName(t("Completed when"))
			.setDesc(
				t(
					"Reach a character count, meet a checklist requirement, or require both.",
				),
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("chars", t("Character count is reached"))
					.addOption("checklist", t("Checklist requirement is met"))
					.addOption("both", t("Both are true"))
					.setValue(this.noteCompletionMode)
					.onChange((value) => {
						this.noteCompletionMode = value as NoteCompletionMode;
						this.build();
					}),
			);

		const usesChars =
			this.noteCompletionMode === "chars" || this.noteCompletionMode === "both";
		const usesChecklist =
			this.noteCompletionMode === "checklist" ||
			this.noteCompletionMode === "both";

		if (usesChars) {
			new Setting(contentEl).setName(t("Character goal")).addText((text) => {
				applyNumeric(text.inputEl, 1);
				text
					.setPlaceholder("500")
					.setValue(String(this.target > 0 ? this.target : 500))
					.onChange((value) => {
						const parsed = Number(value);
						this.target =
							Number.isFinite(parsed) && parsed > 0
								? Math.round(parsed)
								: 500;
					});
			});
		}

		if (usesChecklist) {
			new Setting(contentEl)
				.setName(t("Checklist requirement"))
				.setDesc(
					t(
						"Require every task to be checked, or just some — useful for a list of alternatives where doing any one of them counts (e.g. \"Cardio\" / \"Weights\" / \"Rest day\").",
					),
				)
				.addDropdown((dropdown) =>
					dropdown
						.addOption("all", t("Every task is checked"))
						.addOption("count", t("At least this many are checked"))
						.setValue(this.noteChecklistRequirement)
						.onChange((value) => {
							this.noteChecklistRequirement =
								value as NoteChecklistRequirement;
							this.build();
						}),
				);

			if (this.noteChecklistRequirement === "count") {
				new Setting(contentEl)
					.setName(t("Tasks required"))
					.addText((text) => {
						applyNumeric(text.inputEl, 1);
						text
							.setPlaceholder("1")
							.setValue(String(this.noteChecklistMin))
							.onChange((value) => {
								const parsed = Number(value);
								this.noteChecklistMin =
									Number.isFinite(parsed) && parsed > 0
										? Math.round(parsed)
										: 1;
							});
					});
			}
		}

		new Setting(contentEl)
			.setName(t("Fail keyword"))
			.setDesc(
				t(
					'Optional. Checking a task whose text contains this word forces the day to fail, whatever else is checked — e.g. "Slipped" as one of several checklist options. Leave blank to turn this off.',
				),
			)
			.addText((text) =>
				text
					.setPlaceholder(t("e.g. Slipped"))
					.setValue(this.noteFailKeyword)
					.onChange((value) => {
						this.noteFailKeyword = value;
					}),
			);
	}

	/** Collapsible, optional weekly/monthly targets section. */
	private renderTargets(contentEl: HTMLElement): void {
		const details = contentEl.createEl("details", { cls: "habits-targets" });
		details.open = this.targetsOpen;
		details.addEventListener("toggle", () => {
			this.targetsOpen = details.open;
		});
		details.createEl("summary", {
			cls: "habits-targets-summary",
			text: t("Targets (optional)"),
		});
		details.createEl("p", {
			cls: "habits-targets-intro",
			text:
				this.goalDirection === "max"
					? t(
							"Set an optional weekly or monthly goal for how many days you stay within your limit. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.",
						)
					: t(
							"Set an optional weekly or monthly goal for how many days you complete this habit. For example, hitting your daily goal on all 7 days is a weekly target of 7. Turn on a perfect toggle to aim for every day of the period automatically, whatever its length.",
						),
		});

		new Setting(details)
			.setName(t("Perfect week"))
			.setDesc(t("Aim to complete this habit every day of the week."))
			.addToggle((toggle) =>
				toggle.setValue(this.weeklyPerfect).onChange((value) => {
					this.weeklyPerfect = value;
					this.build();
				}),
			);
		if (!this.weeklyPerfect) {
			new Setting(details)
				.setName(t("Weekly target"))
				.setDesc(t("Optional. Days to complete per week (max 7)."))
				.addText((text) => {
					applyNumeric(text.inputEl, 1, 7);
					text
						.setPlaceholder(t("None"))
						.setValue(
							this.weeklyTarget ? String(this.weeklyTarget) : "",
						)
						.onChange((value) => {
							const parsed = Number(value);
							this.weeklyTarget =
								Number.isFinite(parsed) && parsed > 0
									? Math.min(7, Math.round(parsed))
									: 0;
						});
				});
		}
		new Setting(details)
			.setName(t("Perfect month"))
			.setDesc(t("Aim to complete this habit every day of the month."))
			.addToggle((toggle) =>
				toggle.setValue(this.monthlyPerfect).onChange((value) => {
					this.monthlyPerfect = value;
					this.build();
				}),
			);
		if (!this.monthlyPerfect) {
			new Setting(details)
				.setName(t("Monthly target"))
				.setDesc(t("Optional. Days to complete per month."))
				.addText((text) => {
					applyNumeric(text.inputEl, 1, 31);
					text
						.setPlaceholder(t("None"))
						.setValue(
							this.monthlyTarget ? String(this.monthlyTarget) : "",
						)
						.onChange((value) => {
							const parsed = Number(value);
							this.monthlyTarget =
								Number.isFinite(parsed) && parsed > 0
									? Math.min(31, Math.round(parsed))
									: 0;
						});
				});
		}
	}

	private renderPreview(contentEl: HTMLElement): void {
		const preview = contentEl.createDiv({ cls: "habits-modal-preview" });
		this.previewIconEl = preview.createDiv({
			cls: "habits-modal-preview-icon",
		});
		this.previewNameEl = preview.createDiv({
			cls: "habits-modal-preview-name",
		});
		this.updatePreview();
	}

	private renderColorPicker(contentEl: HTMLElement): void {
		const setting = new Setting(contentEl)
			.setName(t("Colour"))
			.setDesc(t("Pick a colour from your theme, or choose a custom one."));

		const swatches = setting.controlEl.createDiv({
			cls: "habits-swatches",
		});
		this.colorSwatches = [];
		for (const swatch of THEME_COLORS) {
			const el = swatches.createEl("button", {
				cls: "habits-swatch",
				attr: { type: "button", "aria-label": t(swatch.label) },
			});
			el.setCssProps({ "--habits-swatch": swatch.value });
			el.addEventListener("click", () => {
				this.color = swatch.value;
				this.updateSwatchSelection();
				this.updatePreview();
			});
			this.colorSwatches.push({ value: swatch.value, el });
		}

		setting.addColorPicker((picker) => {
			this.customPicker = picker;
			if (this.color.startsWith("#")) {
				picker.setValue(this.color);
			}
			picker.onChange((value) => {
				this.color = value;
				this.updateSwatchSelection();
				this.updatePreview();
			});
		});

		this.updateSwatchSelection();
	}

	private updateSwatchSelection(): void {
		for (const swatch of this.colorSwatches) {
			swatch.el.toggleClass("is-selected", swatch.value === this.color);
		}
	}

	private updatePreview(): void {
		if (this.previewIconEl) {
			if (this.icon) {
				applyHabitIcon(this.previewIconEl, this.icon);
			} else {
				this.previewIconEl.empty();
				setIcon(this.previewIconEl, "circle-dashed");
			}
			this.previewIconEl.setCssProps({
				"--habits-accent":
					this.effectiveColor() || "var(--interactive-accent)",
			});
		}
		if (this.previewNameEl) {
			this.previewNameEl.setText(this.habitName || t("Your habit"));
		}
	}

	private updateIconButton(): void {
		const button = this.iconButton;
		if (!button) {
			return;
		}
		button.buttonEl.empty();
		const glyph = button.buttonEl.createSpan({ cls: "habits-button-icon" });
		if (this.icon) {
			applyHabitIcon(glyph, this.icon);
			button.buttonEl.createSpan({
				text: isLucideIcon(this.icon) ? iconLabel(this.icon) : t("Emoji"),
			});
		} else {
			setIcon(glyph, "image-plus");
			button.buttonEl.createSpan({ text: t("Choose icon") });
		}
	}
}
