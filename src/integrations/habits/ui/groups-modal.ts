import { App, Modal, Setting, setIcon } from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitsPluginSettings } from "../settings";
import type { GroupStyle, HabitDefinition } from "../types";
import { t } from "../i18n";
import { habitAccent, sectionLabel, sortHabits } from "../utils";
import {
	applyHabitIcon,
	IconSuggestModal,
	iconLabel,
	isLucideIcon,
} from "./icon-suggest-modal";
import { EmojiSuggestModal } from "./emoji-suggest-modal";
import { ConfirmModal } from "./confirm-modal";
import { THEME_COLORS } from "./habit-modal";

/**
 * Overview of every habit by group, opened from the plugin settings.
 * Each group renders as a labelled container of habit chips; dragging a
 * chip into another container reassigns the habit's group (written to
 * its note's frontmatter). An "Ungrouped" container at the end doubles
 * as the way to remove a habit from its group.
 */
export class GroupsModal extends Modal {
	/** Habits held locally so reassignments show without waiting on the
	 * metadata cache to catch up. */
	private habits: HabitDefinition[] = [];
	/** Groups created in this session that have no members yet. */
	private newGroups: string[] = [];
	/** Group whose inline style editor is open, if any. */
	private editingGroup: string | null = null;

	constructor(
		app: App,
		private store: HabitStore,
		private getSettings: () => HabitsPluginSettings,
		private saveSettings: () => Promise<void>,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
	}

	onOpen(): void {
		this.modalEl.addClass("habits-groups-modal");
		const settings = this.getSettings();
		// Always the group-sorted view: partitioned by group with the
		// manual order inside each — exactly what dragging edits.
		this.habits = sortHabits(
			this.store.getHabits().filter((habit) => !habit.stopped),
			"group",
			settings.manualOrder,
			settings.groups,
			settings.groupOrder,
		);
		this.build();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	/** Every group name to render: members, styled groups, session-new. */
	private groupNames(): string[] {
		const names = new Set<string>();
		for (const habit of this.habits) {
			const group = habit.group.trim();
			if (group) {
				names.add(group);
			}
		}
		for (const name of Object.keys(this.getSettings().groups)) {
			names.add(name);
		}
		for (const name of this.newGroups) {
			names.add(name);
		}
		const order = this.getSettings().groupOrder;
		const position = new Map(order.map((name, index) => [name, index]));
		return Array.from(names).sort((a, b) => {
			const pa = position.get(a) ?? Number.MAX_SAFE_INTEGER;
			const pb = position.get(b) ?? Number.MAX_SAFE_INTEGER;
			return pa - pb || a.localeCompare(b);
		});
	}

	private build(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName(t("Groups")).setHeading();
		contentEl.createEl("p", {
			cls: "habits-groups-hint",
			text: t(
				"Drag habits between groups to reassign them, or within a group to reorder them.",
			),
		});

		let pending = "";
		new Setting(contentEl).setName(t("New group")).addText((text) =>
			text.setPlaceholder(t("e.g. Health")).onChange((value) => {
				pending = value;
			}),
		).addButton((button) =>
			button
				.setButtonText(t("Add"))
				.setCta()
				.onClick(() => {
					const cleaned = pending.trim();
					if (cleaned && !this.groupNames().includes(cleaned)) {
						this.newGroups.push(cleaned);
						// Open the new group's style editor right away so
						// its colour and icon are part of creating it.
						this.editingGroup = cleaned;
					}
					this.build();
					this.contentEl
						.querySelector<HTMLElement>(
							`.habits-groups-section[data-group="${CSS.escape(
								cleaned,
							)}"]`,
						)
						?.scrollIntoView({ block: "nearest" });
				}),
		);

		const board = contentEl.createDiv({ cls: "habits-groups-board" });
		for (const name of this.groupNames()) {
			this.renderSection(board, name);
		}
		// The catch-all container: dropping here ungroups a habit.
		this.renderSection(board, "");
	}

	private renderSection(board: HTMLElement, group: string): void {
		const settings = this.getSettings();
		const section = board.createDiv({ cls: "habits-groups-section" });
		section.dataset.group = group;

		const header = section.createDiv({ cls: "habits-group-header" });
		const style = settings.groups[group];
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
			text: sectionLabel(group),
		});

		// Style editing and deletion apply to real groups only, not the
		// ungrouped catch-all.
		if (group) {
			const actions = header.createDiv({
				cls: "habits-groups-actions",
			});
			const edit = actions.createEl("button", {
				cls: "habits-icon-button",
				attr: {
					type: "button",
					"aria-label": t("Edit group style"),
				},
			});
			setIcon(edit, "pencil");
			edit.toggleClass("is-active", this.editingGroup === group);
			edit.addEventListener("click", () => {
				this.editingGroup =
					this.editingGroup === group ? null : group;
				this.build();
			});
			const remove = actions.createEl("button", {
				cls: "habits-icon-button",
				attr: {
					type: "button",
					"aria-label": t("Delete group"),
				},
			});
			setIcon(remove, "trash");
			remove.addEventListener("click", () => {
				this.confirmDelete(group);
			});
		}

		if (group && this.editingGroup === group) {
			this.renderStyleEditor(section, group);
		}

		const chips = section.createDiv({ cls: "habits-groups-chips" });
		const members = this.habits.filter(
			(habit) => habit.group.trim() === group,
		);
		if (members.length === 0) {
			chips.createSpan({
				cls: "habits-groups-empty",
				text: t("No habits"),
			});
			return;
		}
		for (const habit of members) {
			const chip = chips.createDiv({ cls: "habits-groups-chip" });
			chip.dataset.path = habit.path;
			const accent = habitAccent(habit, settings.groups);
			if (accent) {
				chip.setCssProps({ "--habits-accent": accent });
			}
			if (habit.icon) {
				const icon = chip.createSpan({
					cls: "habits-groups-chip-icon",
				});
				applyHabitIcon(icon, habit.icon);
			}
			chip.createSpan({
				cls: "habits-groups-chip-name",
				text: habit.name,
			});
			this.registerChipDrag(chip, habit);
		}
	}

	/** The group's stored style, or an empty one. */
	private styleOf(group: string): GroupStyle {
		return this.getSettings().groups[group] ?? { color: "", icon: "" };
	}

	/** Persist a style change and repaint (headers, chips, editor). */
	private async setStyle(group: string, style: GroupStyle): Promise<void> {
		await this.store.setGroupStyle(group, style);
		this.build();
	}

	/**
	 * Inline editor for a group's shared colour and icon — the same
	 * palette and pickers as the habit editor, saving on every change.
	 */
	private renderStyleEditor(section: HTMLElement, group: string): void {
		const wrap = section.createDiv({ cls: "habits-groups-style" });

		const colorSetting = new Setting(wrap).setName(t("Group color"));
		const swatches = colorSetting.controlEl.createDiv({
			cls: "habits-swatches",
		});
		for (const swatch of THEME_COLORS) {
			const el = swatches.createEl("button", {
				cls: "habits-swatch",
				attr: { type: "button", "aria-label": t(swatch.label) },
			});
			el.setCssProps({ "--habits-swatch": swatch.value });
			el.toggleClass(
				"is-selected",
				this.styleOf(group).color === swatch.value,
			);
			el.addEventListener("click", () => {
				const style = this.styleOf(group);
				// Clicking the selected swatch clears the colour.
				void this.setStyle(group, {
					color:
						style.color === swatch.value ? "" : swatch.value,
					icon: style.icon,
				});
			});
		}
		colorSetting.addColorPicker((picker) => {
			const current = this.styleOf(group).color;
			if (current.startsWith("#")) {
				picker.setValue(current);
			}
			picker.onChange((value) => {
				void this.setStyle(group, {
					color: value,
					icon: this.styleOf(group).icon,
				});
			});
		});

		new Setting(wrap)
			.setName(t("Group icon"))
			.addButton((button) => {
				const icon = this.styleOf(group).icon;
				button.buttonEl.empty();
				const glyph = button.buttonEl.createSpan({
					cls: "habits-button-icon",
				});
				if (icon) {
					applyHabitIcon(glyph, icon);
					button.buttonEl.createSpan({
						text: isLucideIcon(icon)
							? iconLabel(icon)
							: t("Emoji"),
					});
				} else {
					setIcon(glyph, "image-plus");
					button.buttonEl.createSpan({ text: t("Choose icon") });
				}
				button.onClick(() => {
					new IconSuggestModal(this.app, (picked) => {
						void this.setStyle(group, {
							color: this.styleOf(group).color,
							icon: picked,
						});
					}).open();
				});
			})
			.addButton((button) =>
				button
					.setButtonText(t("Emoji"))
					.setTooltip(t("Choose an emoji"))
					.onClick(() => {
						new EmojiSuggestModal(this.app, (emoji) => {
							void this.setStyle(group, {
								color: this.styleOf(group).color,
								icon: emoji,
							});
						}).open();
					}),
			)
			.addExtraButton((extra) =>
				extra
					.setIcon("x")
					.setTooltip(t("Clear icon"))
					.onClick(() => {
						void this.setStyle(group, {
							color: this.styleOf(group).color,
							icon: "",
						});
					}),
			);
	}

	/**
	 * Delete a group after confirmation: member habits are kept and
	 * become ungrouped; the stored style and order entry are removed.
	 */
	private confirmDelete(group: string): void {
		new ConfirmModal(this.app, {
			title: t("Delete group"),
			message: t(
				'Delete "{name}"? Its habits are kept and become ungrouped.',
				{ name: group },
			),
			confirmText: t("Delete"),
			danger: true,
			onConfirm: async () => {
				for (const habit of this.habits) {
					if (habit.group.trim() === group) {
						await this.store.setHabitGroup(habit, "");
					}
				}
				await this.store.setGroupStyle(group, null);
				const settings = this.getSettings();
				if (settings.groupOrder.includes(group)) {
					settings.groupOrder = settings.groupOrder.filter(
						(name) => name !== group,
					);
					await this.saveSettings();
				}
				this.newGroups = this.newGroups.filter(
					(name) => name !== group,
				);
				if (this.editingGroup === group) {
					this.editingGroup = null;
				}
				this.build();
			},
		}).open();
	}

	/**
	 * Pointer-based dragging, both between containers (reassign) and
	 * within one (reorder). The chip moves live in the DOM as a preview:
	 * inside the container under the pointer it slots between chips by
	 * position, so dropping simply keeps what is shown. Listeners sit on
	 * the window so the drag survives the DOM churn, mirroring the
	 * settings tab's order editors.
	 */
	private registerChipDrag(
		chip: HTMLElement,
		habit: HabitDefinition,
	): void {
		chip.addEventListener("pointerdown", (evt: PointerEvent) => {
			if (evt.button !== 0) {
				return;
			}
			evt.preventDefault();
			chip.addClass("is-dragging");
			const win = chip.win;
			const containers = Array.from(
				this.contentEl.querySelectorAll<HTMLElement>(
					".habits-groups-section",
				),
			);

			const onMove = (e: PointerEvent): void => {
				const target =
					containers.find((el) => {
						const rect = el.getBoundingClientRect();
						return (
							e.clientY >= rect.top &&
							e.clientY <= rect.bottom &&
							e.clientX >= rect.left &&
							e.clientX <= rect.right
						);
					}) ?? null;
				for (const el of containers) {
					el.toggleClass("is-drop-target", el === target);
				}
				if (!target) {
					return;
				}
				const chipsEl = target.querySelector<HTMLElement>(
					".habits-groups-chips",
				);
				if (!chipsEl) {
					return;
				}
				// Slot the chip before the first sibling that sits after
				// the pointer in the wrapped flow (further down, or on
				// the same line past its midpoint).
				const siblings = Array.from(
					chipsEl.querySelectorAll<HTMLElement>(
						".habits-groups-chip",
					),
				).filter((el) => el !== chip);
				const next = siblings.find((el) => {
					const rect = el.getBoundingClientRect();
					return (
						e.clientY < rect.top ||
						(e.clientY <= rect.bottom &&
							e.clientX < rect.left + rect.width / 2)
					);
				});
				if (next) {
					if (next !== chip.nextElementSibling) {
						chipsEl.insertBefore(chip, next);
					}
				} else if (chipsEl.lastElementChild !== chip) {
					chipsEl.appendChild(chip);
				}
			};
			const onUp = (): void => {
				chip.removeClass("is-dragging");
				win.removeEventListener("pointermove", onMove);
				win.removeEventListener("pointerup", onUp);
				win.removeEventListener("pointercancel", onUp);
				for (const el of containers) {
					el.removeClass("is-drop-target");
				}
				void this.commitDrag(chip, habit);
			};
			win.addEventListener("pointermove", onMove);
			win.addEventListener("pointerup", onUp);
			win.addEventListener("pointercancel", onUp);
		});
	}

	/**
	 * Persist whatever the drag preview shows: the chip's container is
	 * its (possibly new) group, and the chips' DOM order across all
	 * containers becomes the manual order — which group-sorted views use
	 * within each section.
	 */
	private async commitDrag(
		chip: HTMLElement,
		habit: HabitDefinition,
	): Promise<void> {
		const section = chip.closest<HTMLElement>(".habits-groups-section");
		const group = section?.dataset.group;
		if (group !== undefined && group !== habit.group.trim()) {
			await this.store.setHabitGroup(habit, group);
		}
		const paths: string[] = [];
		for (const el of Array.from(
			this.contentEl.querySelectorAll<HTMLElement>(
				".habits-groups-chip",
			),
		)) {
			if (el.dataset.path) {
				paths.push(el.dataset.path);
			}
		}
		const settings = this.getSettings();
		settings.manualOrder = paths;
		await this.saveSettings();
		// Re-sort the cached list so the rebuild shows the new order.
		this.habits = sortHabits(
			this.habits,
			"group",
			settings.manualOrder,
			settings.groups,
			settings.groupOrder,
		);
		this.build();
	}
}
