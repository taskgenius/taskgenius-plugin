import { importLegacyHabits, planLegacyHabits } from "@/integrations/habits/legacy-import";
import { ConfirmModal } from "@/integrations/habits/ui/confirm-modal";
import { HabitsBlock } from "@/integrations/habits/ui/habits-block";
import { HabitModal } from "@/integrations/habits/ui/habit-modal";
import { t as ht } from "@/integrations/habits/i18n";
import { t as settingsText } from "@/translations/helper";
import {
	Component,
	App,
	Modal,
	Setting,
	Notice,
	ButtonComponent,
	ExtraButtonComponent,
} from "obsidian";
import {
	HabitProps,
	DailyHabitProps,
	CountHabitProps,
	ScheduledHabitProps,
	MappingHabitProps,
} from "@/types/habit-card"; // Assuming types are in src/types
import TaskProgressBarPlugin from "@/index";
import {
	DailyHabitCard,
	CountHabitCard,
	ScheduledHabitCard,
	MappingHabitCard,
} from "./habitcard/index"; // Import the habit card classes
import { t } from "@/translations/helper";
import "@/styles/habit.css";
import { HabitEditDialog } from "@/components/features/habit/components/HabitEditDialog";

export class Habit extends Component {
	containerEl: HTMLElement;
	private disposed = false;
	constructor(readonly plugin: TaskProgressBarPlugin, parentEl: HTMLElement) {
		super();
		this.containerEl = parentEl.createDiv({cls: "tg-habit-component-container tg-habits-surface"});
	}
	async onload(): Promise<void> {
		try {
			const integration = await this.plugin.ensureHabitsIntegration();
			if (this.disposed) return;
			const toolbar = this.containerEl.createDiv({cls: "tg-habits-toolbar"});
			toolbar.createEl("h2", {text: ht("Habits")});
			new ButtonComponent(toolbar).setButtonText(ht("Create habit")).setCta().onClick(() => {
				new HabitModal(this.plugin.app, integration.store, () => {}, null, integration.settings.experimental.noteHabits).open();
			});
			integration.showCompatibilityNotice(this.containerEl);
			const root = this.containerEl.createDiv();
			this.addChild(new HabitsBlock(this.plugin.app, integration.store, () => integration.settings, integration.events, "", root));
			if (this.plugin.settings.habit.habits?.length) {
				const legacy = this.containerEl.createEl("details", {cls: "tg-habits-legacy"});
				legacy.createEl("summary", {text: ht("Existing Task Genius habits")});
				legacy.createEl("p", {text: ht("Original daily-note records remain available below. Import creates habit notes with a complete source snapshot and never changes the original records.")});
				new ButtonComponent(legacy).setButtonText(ht("Import existing records")).onClick(async () => {
					const plans = planLegacyHabits(this.plugin.habitManager?.habits ?? []);
					if (!plans.length) { new Notice(ht("No records available to import.")); return; }
					const confirmed = await ConfirmModal.ask(this.plugin.app, ht("Import existing records"), ht("Create {n} habit notes in {folder}? Existing notes and daily records will be preserved.", {n: plans.length, folder: integration.settings.habitsFolder}));
					if (!confirmed) return;
					try {
						const result = await importLegacyHabits(this.plugin.app, integration.settings, plans);
						new Notice(ht("Imported {created} habits; skipped {skipped} existing imports.", result));
						integration.events.trigger("settings-changed");
					} catch (error) { console.error(error); new Notice(ht("Habit import failed. Existing files have been preserved.")); }
				});
				this.addChild(new LegacyHabit(this.plugin, legacy));
			}
		} catch (error) {
			if (!this.disposed) this.containerEl.createEl("p", {text: ht("Unable to load habits. Check the console for details.")});
			console.error("Task Genius habits", error);
		}
	}
	onunload(): void { this.disposed = true; this.containerEl.empty(); }
}

class LegacyHabit extends Component {
	plugin: TaskProgressBarPlugin;
	containerEl: HTMLElement; // The element where the view will be rendered

	constructor(plugin: TaskProgressBarPlugin, parentEl: HTMLElement) {
		super();
		this.plugin = plugin;
		this.containerEl = parentEl.createDiv("tg-habit-component-container");
	}

	async onload() {
		if (this.plugin) {
			// Cast to any to avoid TypeScript error about event name
			this.registerEvent(
				this.plugin.app.workspace.on(
					"task-genius:habit-index-updated",
					() => {
						this.redraw();
					}
				)
			);
		}
		this.redraw(); // Initial draw
	}

	onunload() {
		console.log("HabitView unloaded.");
		this.containerEl.empty(); // Clear the container on unload
	}

	// Redraw the entire habit view
	redraw = () => {
		const scrollState = this.containerEl.scrollTop;
		this.containerEl.empty(); // Clear previous content

		const habits = this.getHabitData(); // Method to fetch habit data

		if (!habits || habits.length === 0) {
			this.renderEmptyState();
		} else {
			this.renderHabitList(habits);
		}
		this.containerEl.scrollTop = scrollState; // Restore scroll position
	};

	getHabitData(): HabitProps[] {
		const habits = this.plugin.habitManager?.habits || [];
		return habits;
	}

	renderEmptyState() {
		const emptyDiv = this.containerEl.createDiv({
			cls: "habit-empty-state",
		});
		emptyDiv.createEl("h2", {text: t("No Habits Yet")});
		emptyDiv.createEl("p", {
			text: t("Click the open habit button to create a new habit."),
		}); // Adjust text based on UI
		emptyDiv.createEl("br");
		new ButtonComponent(emptyDiv)
			.setButtonText("Open Habit")
			.onClick(() => {
				this.plugin.app.setting.open();
				this.plugin.app.setting.openTabById(this.plugin.manifest.id);

				this.plugin.settingTab.openTab("habit");
			});
	}

	renderHabitList(habits: HabitProps[]) {
		console.log("renderHabitList", habits);
		const listContainer = this.containerEl.createDiv({
			cls: "habit-list-container",
		});

		habits.forEach((habit) => {
			const habitCardContainer = listContainer.createDiv({
				cls: "habit-card-wrapper",
			}); // Wrapper for context menu, etc.
			this.renderHabitCard(habitCardContainer, habit);
		});

		// Add create new habit button at the bottom left
		const buttonContainer = listContainer.createDiv({
			cls: "habit-create-button-container",
		});

		new ExtraButtonComponent(buttonContainer)
			.setIcon("plus")
			.setTooltip(t("Create new habit"))
			.onClick(() => {
				this.openCreateHabitDialog();
			});
	}

	openCreateHabitDialog() {
		new HabitEditDialog(
			this.plugin.app,
			this.plugin,
			null, // null for new habit
			async (habitData) => {
				// Save the new habit
				if (!this.plugin.settings.habit.habits) {
					this.plugin.settings.habit.habits = [];
				}
				this.plugin.settings.habit.habits.push(habitData);
				await this.plugin.saveSettings();

				// Reload habits
				if (this.plugin.habitManager) {
					await this.plugin.habitManager.initializeHabits();
				}

				new Notice(t("Habit created successfully"));
				this.redraw();
			}
		).open();
	}

	renderHabitCard(container: HTMLElement, habit: HabitProps) {
		// Ensure completions is an object
		habit.completions = habit.completions || {};

		switch (habit.type) {
			case "daily":
				const dailyCard = new DailyHabitCard(
					habit as DailyHabitProps,
					container,
					this.plugin
				);
				this.addChild(dailyCard);
				break;
			case "count":
				const countCard = new CountHabitCard(
					habit as CountHabitProps,
					container,
					this.plugin
				);
				this.addChild(countCard);
				break;
			case "scheduled":
				const scheduledCard = new ScheduledHabitCard(
					habit as ScheduledHabitProps,
					container,
					this.plugin
				);
				this.addChild(scheduledCard);
				break;
			case "mapping":
				const mappingCard = new MappingHabitCard(
					habit as MappingHabitProps,
					container,
					this.plugin
				);
				this.addChild(mappingCard);
				break;
			default:
				// Use a type assertion to handle potential future types or errors
				const unknownHabit = habit as any;
				console.warn(`Unsupported habit type: ${unknownHabit?.type}`);
				container.createDiv({
					text: `Unsupported habit: ${
						unknownHabit?.name || "Unknown"
					}`,
				});
		}
	}
}

// --- Modal for Scheduled Event Details ---
export class EventDetailModal extends Modal {
	eventName: string;
	onSubmit: (details: string) => void;
	details: string = "";

	constructor(
		app: App,
		eventName: string,
		onSubmit: (details: string) => void
	) {
		super(app);
		this.eventName = eventName;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.addClass("habit-event-modal");
		contentEl.createEl("h2", {
			text: settingsText("Record Details for {{value0}}", { interpolation: { value0: String(this.eventName) } }),
		});

		new Setting(contentEl).setName(settingsText("Details")).addText((text) =>
			text
				.setPlaceholder(settingsText("Enter details for {{value0}}...", { interpolation: { value0: String(this.eventName) } }))
				.onChange((value) => {
					this.details = value;
				})
		);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText(settingsText("Cancel"))
					.setWarning()
					.onClick(() => {
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText(settingsText("Submit"))
					.setCta()
					.onClick(() => {
						this.close();
						if (!this.details) {
							new Notice(t("Please enter details"));
							return;
						}
						this.onSubmit(this.details);
					})
			);
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}
