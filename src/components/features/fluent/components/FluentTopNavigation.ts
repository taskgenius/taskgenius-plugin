import {
	setIcon,
	Menu,
	Notice,
	SearchComponent,
	Platform,
	Component,
	TFile,
	ExtraButtonComponent,
} from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { Task } from "@/types/task";
import { t } from "@/translations/helper";
import { Events, on } from "@/dataflow/events/Events";
import { SavedTaskFilterModal } from "./SavedTaskFilterModal";
import { savedTaskFilters } from "@/utils/task/saved-task-filters";

export type ViewMode = "list" | "kanban" | "tree" | "calendar";

export interface CustomNavButton {
	id: string;
	icon: string;
	tooltip: string;
	onClick: () => void;
}

export function isCompletedMark(
	plugin: TaskProgressBarPlugin,
	mark: string,
): boolean {
	if (!mark) return false;
	try {
		const lower = mark.toLowerCase();
		const completedCfg =
			String(plugin.settings.taskStatuses?.completed || "x") +
			"|" +
			(plugin.settings.taskStatuses?.abandoned || "-");
		return completedCfg.split("|").includes(lower);
	} catch (_) {
		return false;
	}
}

export class TopNavigation extends Component {
	private containerEl: HTMLElement;
	private plugin: TaskProgressBarPlugin;
	private searchInput: HTMLInputElement;
	private currentViewMode: ViewMode = "list";
	private notificationCount = 0;
	private contextViewId = "inbox";
	private searchQuery = "";
	private activePresetId: string | null = null;
	public updateContext(viewId: string): void {
		this.contextViewId = viewId;
		const label = this.containerEl.querySelector<HTMLElement>(".tg-active-filter-label");
		if (label) label.hidden = !label.textContent || ["points", "rewards", "habit"].includes(viewId);

		this.containerEl.show();
		const taskContext = !["points", "rewards", "habit"].includes(viewId);
		(this.containerEl.querySelector(".tg-quick-filter-button") as HTMLElement | null)?.toggle(taskContext);
		if (this.searchInput) this.searchInput.placeholder = t(viewId === "habit" ? "Search habits" : viewId === "rewards" ? "Search rewards" : viewId === "points" ? "Search bonuses, rewards and records" : "Search tasks, projects ...");
	}
	private availableModes: ViewMode[] = ["list", "kanban", "tree", "calendar"];
	private viewTabsContainer: HTMLElement | null = null;
	private customButtonsContainer: HTMLElement | null = null;
	private customButtons: Map<
		string,
		{ buttonEl: HTMLElement; config: CustomNavButton }
	> = new Map();
	private headerControls: HTMLElement | null = null;
	private cycleSelectorContainer: HTMLElement | null = null;
	private selectedCycleId: string | null = null;
	private onCycleChange: ((cycleId: string | null) => void) | null = null;

	constructor(
		containerEl: HTMLElement,
		plugin: TaskProgressBarPlugin,
		private onSearch: (query: string) => void,
		private onViewModeChange: (mode: ViewMode) => void,
		private onFilterClick: (presetId: string | null) => void,
		private onSortClick: () => void,
		private onSettingsClick: () => void,
		availableModes?: ViewMode[],
		private onToggleSidebar?: () => void,
	) {
		super();
		this.containerEl = containerEl;
		this.plugin = plugin;
		if (availableModes) {
			this.availableModes = availableModes;
			// Ensure current mode is valid
			if (!this.availableModes.includes(this.currentViewMode)) {
				this.currentViewMode = this.availableModes[0] || "list";
			}
		}

		// Render UI first (fast, synchronous)
		this.render();

		// Then update notification count asynchronously
		this.updateNotificationCount();

		// Listen for dataflow events to refresh notification count
		this.setupEventListeners();
	}

	private setupEventListeners() {
		// Listen for cache ready event (when dataflow initializes)
		this.registerEvent(
			on(this.plugin.app, Events.CACHE_READY, () => {
				this.updateNotificationCount();
			}),
		);

		// Listen for task cache updates
		this.registerEvent(
			on(this.plugin.app, Events.TASK_CACHE_UPDATED, () => {
				this.updateNotificationCount();
			}),
		);
	}

	/**
	 * Check if a task is overdue based on its dates
	 * @param task - The task to check
	 * @param today - Current date with time set to 00:00:00
	 * @returns true if the task is overdue, false otherwise
	 */
	private isOverdueTask(task: Task, today: Date): boolean {
		// Exclude completed tasks
		if (task.completed) return false;

		// Exclude abandoned/completed status tasks
		if (task.status && isCompletedMark(this.plugin, task.status))
			return false;

		// Only include tasks with dueDate or scheduledDate
		const dueDate = task.metadata?.dueDate;
		const scheduledDate = task.metadata?.scheduledDate;

		if (!dueDate && !scheduledDate) return false;

		// Check if either date is overdue
		if (dueDate) {
			const dueDateObj = new Date(dueDate);
			if (dueDateObj < today) return true;
		}

		if (scheduledDate) {
			const scheduledDateObj = new Date(scheduledDate);
			if (scheduledDateObj < today) return true;
		}

		return false;
	}

	private async updateNotificationCount() {
		try {
			let tasks: Task[] = [];

			// Wait for dataflow to be ready if it's still initializing
			if (this.plugin.dataflowOrchestrator) {
				const queryAPI = this.plugin.dataflowOrchestrator.getQueryAPI();
				tasks = await queryAPI.getAllTasks();
			} else if (this.plugin.preloadedTasks) {
				tasks = this.plugin.preloadedTasks;
			} else {
				// Dataflow not ready yet, will be called again when ready
				return;
			}

			const today = new Date();
			today.setHours(0, 0, 0, 0);

			this.notificationCount = tasks.filter((task: Task) =>
				this.isOverdueTask(task, today),
			).length;

			this.updateNotificationBadge();
		} catch (error) {
			console.warn(
				"[FluentTopNavigation] Failed to update notification count:",
				error,
			);
		}
	}

	onunload(): void { this.headerControls?.remove(); }

	private render() {
		this.headerControls?.remove();
		this.headerControls = null;
		this.containerEl.empty();
		this.containerEl.addClass("fluent-top-navigation");

		this.containerEl.toggleClass("other-view", this.availableModes.length === 0);

		// Show navigation when modes are available
		this.containerEl.show();

		// Left section - Hamburger menu (mobile) and Search
		const leftSection = this.containerEl.createDiv({
			cls: "fluent-nav-left",
		});

		const searchContainer = leftSection.createDiv({
			cls: "fluent-search-container",
		});

		new SearchComponent(searchContainer)
			.setPlaceholder(t("Search tasks, projects ..."))
			.setValue(this.searchQuery)
			.onChange((value) => {
				this.searchQuery = value;
				this.onSearch(value);
			});
		this.searchInput = searchContainer.querySelector("input")!;
		const filterButton = searchContainer.createEl("button", {
			cls: "fluent-nav-icon-button tg-quick-filter-button",
			attr: { "aria-label": t("Quick filters") },
		});
		setIcon(filterButton, "list-filter");
		searchContainer.createSpan({ cls: "tg-active-filter-label", attr: { hidden: "" } });
		filterButton.toggleClass("is-active", !!this.activePresetId);
		this.registerDomEvent(filterButton, "click", (event) => {
			const menu = new Menu();
			const presets = savedTaskFilters(this.plugin.settings.taskFilter?.presetTaskFilters);
			const apply = (id: string | null) => { this.activePresetId = id; filterButton.toggleClass("is-active", !!id); this.onFilterClick(id); };
			menu.addItem(item => item.setTitle(t("New saved filter")).setIcon("plus").onClick(() => new SavedTaskFilterModal(this.plugin.app, this.plugin, this.searchQuery, apply).open()));
			if (!presets.length) {
				menu.addItem(item => item.setTitle(t("No saved filters")).setDisabled(true));
			} else {
				menu.addItem(item => item.setTitle(t("Clear quick filter")).setIcon("x").onClick(() => apply(null)));
				menu.addSeparator();
				for (const preset of presets) {
					menu.addItem(item => item.setTitle(preset.name).setIcon("filter").setChecked(preset.id === this.activePresetId).onClick(() => apply(preset.id)));
				}
				const active = presets.find(preset => preset.id === this.activePresetId);
				if (active) {
					menu.addSeparator();
					menu.addItem(item => item.setTitle(t("Edit saved filter")).setIcon("pencil").onClick(() => new SavedTaskFilterModal(this.plugin.app, this.plugin, this.searchQuery, apply, active).open()));
					menu.addItem(item => item.setTitle(t("Delete saved filter")).setIcon("trash").onClick(async () => { this.plugin.settings.taskFilter.presetTaskFilters = presets.filter(preset => preset.id !== active.id); await this.plugin.saveSettings(); apply(null); }));
				}
			}
			menu.showAtMouseEvent(event);
		});

		// Center section - View mode tabs
		const centerSection = this.containerEl.createDiv({
			cls: "fluent-nav-center",
		});

		// Render view tabs (we know modes are available at this point)
		this.viewTabsContainer = centerSection.createDiv({
			cls: "fluent-view-tabs",
		});
		this.renderViewTabs();
		if (this.availableModes.length === 0) centerSection.hide();

		// Right section - Notifications and Settings
		const rightSection = this.containerEl.createDiv({
			cls: "fluent-nav-right",
		});

		// Custom buttons container (for dynamic buttons from views)
		this.customButtonsContainer = rightSection.createDiv({
			cls: "fluent-nav-custom-buttons",
		});
		for (const button of this.customButtons.values()) this.customButtonsContainer.append(button.buttonEl);

		// Cycle selector container (hidden by default)
		this.cycleSelectorContainer = rightSection.createDiv({
			cls: "fluent-nav-cycle-selector-wrapper",
		});
		this.cycleSelectorContainer.hide();

		// Notification button
		const notificationBtn = rightSection.createEl("button", {
			cls: "fluent-nav-icon-button",
			attr: { "aria-label": t("Notifications") },
		});
		setIcon(notificationBtn, "bell");
		const badge = notificationBtn.createDiv({
			cls: "fluent-notification-badge",
			text: String(this.notificationCount),
		});
		// Don't hide badge initially - let updateNotificationCount decide
		// This prevents badge from disappearing during async load
		if (this.notificationCount > 0) {
			badge.show();
		}
		this.registerDomEvent(notificationBtn, "click", (e) =>
			this.showNotifications(e),
		);

		// Settings button
		const settingsBtn = rightSection.createEl("button", {
			cls: "fluent-nav-icon-button",
			attr: { "aria-label": t("Settings") },
		});
		// Share the host action strip rather than creating two separated icon groups.
		const actions = this.containerEl.closest(".view-header")?.querySelector(".view-actions");
		if (actions) {
			actions.prepend(rightSection);
			this.headerControls = rightSection;
		}
		setIcon(settingsBtn, "settings");
		this.registerDomEvent(settingsBtn, "click", () =>
			this.onSettingsClick(),
		);
	}

	private createViewTab(
		container: HTMLElement,
		mode: ViewMode,
		icon: string,
		label: string,
	) {
		const tab = container.createEl("button", {
			cls: ["fluent-view-tab", "clickable-icon"],
			attr: { "data-mode": mode, "aria-label": label },
		});

		if (mode === this.currentViewMode) {
			tab.addClass("is-active");
		}

		setIcon(tab.createDiv({ cls: "fluent-view-tab-icon" }), icon);
		tab.createSpan({ text: label });

		this.registerDomEvent(tab, "click", () => {
			// Only trigger view change if switching to a different mode
			if (this.currentViewMode !== mode) {
				this.selectViewMode(mode);
			}
		});
	}

	public selectViewMode(mode: ViewMode): void {
		this.setViewMode(mode);
		this.onViewModeChange(mode);
	}

	public setViewMode(mode: ViewMode) {
		this.currentViewMode = mode;

		this.containerEl.querySelectorAll(".fluent-view-tab").forEach((tab) => {
			tab.removeClass("is-active");
		});

		const activeTab = this.containerEl.querySelector(
			`[data-mode="${mode}"]`,
		);
		if (activeTab) {
			activeTab.addClass("is-active");
		}
	}

	private async showNotifications(event: MouseEvent) {
		const menu = new Menu();

		let tasks: Task[] = [];
		if (this.plugin.dataflowOrchestrator) {
			const queryAPI = this.plugin.dataflowOrchestrator.getQueryAPI();
			tasks = await queryAPI.getAllTasks();
		} else {
			tasks = this.plugin.preloadedTasks || [];
		}
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const overdueTasks = tasks.filter((task: Task) =>
			this.isOverdueTask(task, today),
		);

		if (overdueTasks.length === 0) {
			menu.addItem((item) => {
				item.setTitle("No overdue tasks").setDisabled(true);
			});
		} else {
			menu.addItem((item) => {
				item.setTitle(
					`${overdueTasks.length} overdue tasks`,
				).setDisabled(true);
			});

			menu.addSeparator();

			overdueTasks.slice(0, 10).forEach((task) => {
				menu.addItem((item) => {
					item.setTitle(task.content || t("Untitled task"))
						.setIcon("alert-circle")
						.onClick(async () => {
							await this.navigateToTask(task);
						});
				});
			});
		}

		menu.showAtMouseEvent(event);
	}

	private async navigateToTask(task: Task): Promise<void> {
		const file = this.plugin.app.vault.getFileByPath(task.filePath);
		if (!(file instanceof TFile)) {
			new Notice(t("Task file not found"));
			return;
		}
		const leaf = this.plugin.app.workspace.getLeaf(false);
		await leaf.openFile(file, {
			eState: { line: task.line },
		});
	}

	private updateNotificationBadge() {
		const badge = (this.headerControls || this.containerEl).querySelector(
			".fluent-notification-badge",
		);
		if (badge instanceof HTMLElement) {
			badge.textContent = String(this.notificationCount);
			if (this.notificationCount === 0) {
				badge.hide();
			} else {
				badge.show();
			}
		}
	}

	public setActivePreset(id: string | null, advanced = false): void {
		this.activePresetId = id;
		const label = this.containerEl.querySelector<HTMLElement>(".tg-active-filter-label");
		if (label) { label.textContent = id ? savedTaskFilters(this.plugin.settings.taskFilter?.presetTaskFilters).find(preset => preset.id === id)?.name || "" : advanced ? t("View filter") : ""; label.hidden = !label.textContent || ["points", "rewards", "habit"].includes(this.contextViewId); label.title = label.textContent || ""; }
		this.containerEl.querySelector(".tg-quick-filter-button")?.classList.toggle("is-active", !!id);
	}
	public refresh() {
		this.updateNotificationCount();
	}

	public getSearchQuery(): string {
		return this.searchInput?.value || "";
	}

	public clearSearch() {
		if (this.searchInput) {
			this.searchInput.value = "";
			this.onSearch("");
		}
	}

	private renderViewTabs() {
		if (!this.viewTabsContainer) return;

		this.viewTabsContainer.empty();

		const modeConfig: Record<ViewMode, { icon: string; label: string }> = {
			list: { icon: "list", label: "List" },
			kanban: { icon: "layout-grid", label: "Kanban" },
			tree: { icon: "git-branch", label: "Tree" },
			calendar: { icon: "calendar", label: "Calendar" },
		};

		for (const mode of this.availableModes) {
			const config = modeConfig[mode];
			if (config) {
				this.createViewTab(
					this.viewTabsContainer,
					mode,
					config.icon,
				t(config.label),
				);
			}
		}
	}

	public updateAvailableModes(modes: ViewMode[]) {
		if (modes.length === this.availableModes.length && modes.every((mode, i) => mode === this.availableModes[i])) return;
		const wasEmpty = this.availableModes.length === 0;
		this.availableModes = modes;

		// Hide entire navigation if no modes available
		if (modes.length === 0) {
			this.containerEl.show();
			(this.containerEl.querySelector(".fluent-nav-center") as HTMLElement | null)?.hide();
			this.containerEl.toggleClass("other-view", true);
			return;
		}

		this.containerEl.toggleClass("other-view", false);

		// If transitioning from empty to non-empty, need to re-render entire UI
		if (wasEmpty && modes.length > 0) {
			this.render();
			return;
		}

		// Show navigation when modes are available
		this.containerEl.show();

		// If current mode is no longer available, switch to first available mode
		if (!modes.includes(this.currentViewMode)) {
			this.currentViewMode = modes[0];
			// The owner resolves the mode after updating the available tabs.
		}

		// Update center section visibility (this should always be visible now since we handle empty modes above)
		const centerSection = this.containerEl.querySelector(
			".fluent-nav-center",
		) as HTMLElement;
		if (centerSection) {
			centerSection.show();
			// Re-render the view tabs
			if (!this.viewTabsContainer) {
				this.viewTabsContainer = centerSection.createDiv({
					cls: "fluent-view-tabs",
				});
			}
			this.renderViewTabs();
		}
	}

	public getCurrentViewMode(): ViewMode {
		return this.currentViewMode;
	}

	/**
	 * Register a custom button in the top navigation
	 */
	public registerCustomButton(config: CustomNavButton): void {
		if (!this.customButtonsContainer) {
			console.warn(
				"[FluentTopNavigation] Custom buttons container not initialized",
			);
			return;
		}

		// Check if button already exists
		if (this.customButtons.has(config.id)) {
			console.warn(
				`[FluentTopNavigation] Button with id "${config.id}" already registered`,
			);
			return;
		}

		// Create button container
		const buttonContainer = this.customButtonsContainer.createDiv({
			cls: "fluent-nav-custom-button-wrapper",
		});

		// Create button using ExtraButtonComponent
		const button = new ExtraButtonComponent(buttonContainer)
			.setIcon(config.icon)
			.setTooltip(config.tooltip)
			.onClick(config.onClick);

		// Store reference
		this.customButtons.set(config.id, {
			buttonEl: buttonContainer,
			config: config,
		});

		console.log(
			`[FluentTopNavigation] Registered custom button: ${config.id}`,
		);
	}

	/**
	 * Unregister a custom button by ID
	 */
	public unregisterCustomButton(id: string): void {
		const button = this.customButtons.get(id);
		if (!button) {
			return;
		}

		// Remove DOM element
		button.buttonEl.remove();

		// Remove from map
		this.customButtons.delete(id);

		console.log(`[FluentTopNavigation] Unregistered custom button: ${id}`);
	}

	/**
	 * Clear all custom buttons
	 */
	public clearCustomButtons(): void {
		if (!this.customButtonsContainer) {
			return;
		}

		// Remove all button elements
		this.customButtons.forEach((button) => {
			button.buttonEl.remove();
		});

		// Clear map
		this.customButtons.clear();

		console.log("[FluentTopNavigation] Cleared all custom buttons");
	}

	/**
	 * Set the callback to be called when cycle selection changes
	 */
	public setCycleChangeCallback(
		callback: (cycleId: string | null) => void,
	): void {
		this.onCycleChange = callback;
	}

	/**
	 * Show the cycle selector in the navigation bar
	 * @param selectedCycleId - Currently selected cycle ID (null for "All Cycles")
	 */
	public showCycleSelector(selectedCycleId: string | null = null): void {
		if (!this.cycleSelectorContainer) {
			console.warn(
				"[FluentTopNavigation] Cycle selector container not initialized",
			);
			return;
		}

		this.selectedCycleId = selectedCycleId;
		const choices = (this.plugin.settings.statusCycles || []).filter(cycle => cycle.enabled && !/^default\s*cycle$|^默认周期$/i.test(cycle.name.trim()));
		if (!choices.length) { this.cycleSelectorContainer.hide(); return; }
		if (!choices.some(cycle => cycle.id === selectedCycleId)) this.selectedCycleId = null;
		this.renderCycleSelector(); this.cycleSelectorContainer.show();
	}

	/**
	 * Hide the cycle selector from the navigation bar
	 */
	public hideCycleSelector(): void {
		if (this.cycleSelectorContainer) {
			this.cycleSelectorContainer.hide();
			this.cycleSelectorContainer.empty();
		}
	}

	/**
	 * Update the selected cycle ID and refresh the UI
	 */
	public setSelectedCycleId(cycleId: string | null): void {
		this.selectedCycleId = cycleId;
		if (
			this.cycleSelectorContainer &&
			this.cycleSelectorContainer.isShown()
		) {
			this.renderCycleSelector();
		}
	}

	/**
	 * Get the currently selected cycle ID
	 */
	public getSelectedCycleId(): string | null {
		return this.selectedCycleId;
	}

	/**
	 * Render the cycle selector dropdown button
	 */
	private renderCycleSelector(): void {
		if (!this.cycleSelectorContainer) {
			return;
		}

		this.cycleSelectorContainer.empty();

		// Create cycle selector button
		const cycleButton = this.cycleSelectorContainer.createEl("button", {
			cls: "fluent-nav-cycle-button clickable-icon",
			attr: {
				"aria-label": t("kanban.cycleSelector"),
			},
		});

		// Add icon
		const iconDiv = cycleButton.createDiv({ cls: "fluent-nav-cycle-icon" });
		setIcon(iconDiv, "layers");

		// Add label
		const labelSpan = cycleButton.createSpan({
			cls: "fluent-nav-cycle-label",
		});

		// Set label based on selected cycle
		if (this.selectedCycleId) {
			const selectedCycle = (
				this.plugin.settings.statusCycles || []
			).find((c) => c.id === this.selectedCycleId);
			labelSpan.textContent =
				selectedCycle?.name || t("kanban.allCycles");
		} else {
			labelSpan.textContent = t("kanban.allCycles");
		}

		// Register click event to show menu
		this.registerDomEvent(cycleButton, "click", (event: MouseEvent) => {
			this.showCycleMenu(event);
		});
	}

	/**
	 * Show the cycle selection menu
	 */
	private showCycleMenu(event: MouseEvent): void {
		const menu = new Menu();

		// "All Cycles" option
		menu.addItem((item) => {
			item.setTitle(t("kanban.allCycles"))
				.setChecked(this.selectedCycleId === null)
				.onClick(() => {
					this.selectedCycleId = null;
					this.renderCycleSelector();
					if (this.onCycleChange) {
						this.onCycleChange(null);
					}
				});
		});

		menu.addSeparator();

		// Get enabled cycles, sorted by priority
		const enabledCycles = (this.plugin.settings.statusCycles || [])
			.filter((c) => c.enabled && !/^default\s*cycle$|^默认周期$/i.test(c.name.trim()))
			.sort((a, b) => a.priority - b.priority);

		if (enabledCycles.length === 0) {
			menu.addItem((item) => {
				item.setTitle(t("kanban.noCyclesAvailable")).setDisabled(true);
			});
		} else {
			for (const cycle of enabledCycles) {
				menu.addItem((item) => {
					item.setTitle(cycle.name)
						.setChecked(this.selectedCycleId === cycle.id)
						.onClick(() => {
							this.selectedCycleId = cycle.id;
							this.renderCycleSelector();
							if (this.onCycleChange) {
								this.onCycleChange(cycle.id);
							}
						});
				});
			}
		}

		menu.addSeparator();

		menu.addItem((i) => {
			i.setTitle(t("Open status cycle settings"));
			i.onClick(() => {
				this.plugin.app.setting.open();
				this.plugin.app.setting.openTabById(this.plugin.manifest.id);

				this.plugin.settingTab.openTab("task-status");
			});
		});

		menu.showAtMouseEvent(event);
	}
}
