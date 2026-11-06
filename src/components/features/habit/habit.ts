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
import "@/styles/habit.scss";
import { HabitEditDialog } from "@/components/features/habit/components/HabitEditDialog";

export class Habit extends Component {
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
	details = "";

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
			text: `Record Details for ${this.eventName}`,
		});

		new Setting(contentEl).setName("Details").addText((text) =>
			text
				.setPlaceholder(`Enter details for ${this.eventName}...`)
				.onChange((value) => {
					this.details = value;
				})
		);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Cancel")
					.setWarning()
					.onClick(() => {
						this.close();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Submit")
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
		const {contentEl} = this;
		contentEl.empty();
	}
}
