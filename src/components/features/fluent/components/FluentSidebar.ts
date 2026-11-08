import {
	App,
	Component,
	setIcon,
	Menu,
	Notice,
	Modal,
	Platform,
} from "obsidian";
import { WorkspaceSelector } from "./WorkspaceSelector";
import {
	Project,
	ProjectList,
} from "@/components/features/fluent/components/ProjectList";
import { FluentTaskNavigationItem } from "@/types/fluent-types";
import { WorkspaceData } from "@/types/workspace";
import {
	onWorkspaceSwitched,
	onWorkspaceDeleted,
	onWorkspaceCreated,
} from "@/components/features/fluent/events/ui-event";
import TaskProgressBarPlugin from "@/index";
import { t } from "@/translations/helper";
import { ViewConfigModal } from "@/components/features/task/view/modals/ViewConfigModal";
import { TASK_SPECIFIC_VIEW_TYPE } from "@/pages/TaskSpecificView";
import { ViewConfig, ViewFilterRule } from "@/common/setting-definition";
import { Events, on } from "@/dataflow/events/Events";
import Sortable from "sortablejs";

export class FluentSidebar extends Component {
	private containerEl: HTMLElement;
	private plugin: TaskProgressBarPlugin;
	private workspaceSelector: WorkspaceSelector;
	public projectList?: ProjectList;
	private collapsed = false;
	private currentWorkspaceId: string;
	private isTreeView = false;
	private otherViewsSection: HTMLElement | null = null;
	private railEl: HTMLElement | null = null;
	private sortables: Sortable[] = [];

	// System views definition for migration and label/icon lookup
	private readonly SYSTEM_VIEWS: Record<
		string,
		{ icon: string; label: () => string }
	> = {
		inbox: { icon: "inbox", label: () => t("Inbox") },
		today: { icon: "calendar-days", label: () => t("Today") },
		upcoming: { icon: "calendar", label: () => t("Upcoming") },
		flagged: { icon: "flag", label: () => t("Flagged") },
	};

	private otherItems: FluentTaskNavigationItem[] = [];

	constructor(
		containerEl: HTMLElement,
		plugin: TaskProgressBarPlugin,
		private onNavigate: (viewId: string) => void,
		private onProjectSelect: (projectId: string) => void,
		collapsed = false,
	) {
		super();
		this.containerEl = containerEl;
		this.plugin = plugin;
		this.collapsed = collapsed;
		this.currentWorkspaceId =
			plugin.workspaceManager?.getActiveWorkspace().id || "";
	}

	private isViewVisible(viewId: string): boolean {
		const manager = this.plugin.workspaceManager;
		if (!manager) return true;
		const workspaceId =
			this.currentWorkspaceId || manager.getActiveWorkspace()?.id;
		return !manager.isViewHidden(viewId, workspaceId);
	}

	private destroySortables() {
		this.sortables.forEach((s) => s.destroy());
		this.sortables = [];
	}

	private ensureSystemViews() {
		const config = this.plugin.settings.viewConfiguration;
		const currentIds = new Set(config.map((v) => v.id));
		const systemViewIds = Object.keys(this.SYSTEM_VIEWS);
		let changed = false;

		// One-time migration: reset top region to only system views for version <= 9.12.3
		const lastVersion = this.plugin.settings.changelog?.lastVersion;
		const needsMigration =
			!lastVersion || this.compareVersions(lastVersion, "9.12.3") <= 0;

		if (needsMigration) {
			// Move all non-system views from top to bottom
			config.forEach((v) => {
				if (!systemViewIds.includes(v.id) && v.region === "top") {
					v.region = "bottom";
					changed = true;
				}
			});
		}

		// Ensure existing system views have region: "top"
		config.forEach((v) => {
			if (systemViewIds.includes(v.id) && v.region !== "top") {
				v.region = "top";
				changed = true;
			}
		});

		// Add system views at the beginning if they don't exist
		const systemViewsToAdd: ViewConfig[] = [];
		Object.entries(this.SYSTEM_VIEWS).forEach(([id, def]) => {
			if (!currentIds.has(id)) {
				systemViewsToAdd.push({
					id,
					name: def.label(),
					icon: def.icon,
					type: "default",
					visible: true,
					region: "top",
					hideCompletedAndAbandonedTasks: true,
					filterBlanks: false,
					filterRules: {},
				});
				changed = true;
			}
		});

		if (systemViewsToAdd.length > 0) {
			// Insert system views at the beginning
			this.plugin.settings.viewConfiguration = [
				...systemViewsToAdd,
				...config,
			];
		}

		if (changed) {
			this.plugin.saveSettings();
		}
	}

	private compareVersions(v1: string, v2: string): number {
		const parts1 = v1.split(".").map((n) => parseInt(n, 10) || 0);
		const parts2 = v2.split(".").map((n) => parseInt(n, 10) || 0);
		const len = Math.max(parts1.length, parts2.length);
		for (let i = 0; i < len; i++) {
			const a = parts1[i] || 0;
			const b = parts2[i] || 0;
			if (a < b) return -1;
			if (a > b) return 1;
		}
		return 0;
	}

	private getViewItems(region: "top" | "bottom"): FluentTaskNavigationItem[] {
		const config = this.plugin.settings.viewConfiguration;
		return config
			.filter((v) => {
				const r = v.region || "top";
				return (
					r === region &&
					v.visible !== false &&
					this.isViewVisible(v.id)
				);
			})
			.map((v) => {
				// Use translated label for system views
				let label = v.name;
				if (this.SYSTEM_VIEWS[v.id]) {
					label = this.SYSTEM_VIEWS[v.id].label();
				}
				return {
					id: v.id,
					label: label,
					icon: v.icon || "list",
					type: region === "top" ? "primary" : "other",
				};
			});
	}

	public render() {
		if (this.projectList) { this.removeChild(this.projectList); this.projectList = undefined; }
		this.containerEl.empty();
		this.destroySortables();
		this.containerEl.addClass("fluent-sidebar");
		this.containerEl.toggleClass("is-collapsed", this.collapsed);

		// Desktop: show rail mode when collapsed
		// Mobile: always render full sidebar (CSS handles visibility)
		if (this.collapsed && !Platform.isPhone) {
			this.railEl = this.containerEl.createDiv({
				cls: "fluent-sidebar-rail",
			});
			this.renderRailMode();
			return;
		}

		// Header with workspace selector and new task button
		const header = this.containerEl.createDiv({
			cls: "fluent-sidebar-header",
		});

		const workspaceSelectorEl = header.createDiv();
		if (this.plugin.workspaceManager) {
			this.workspaceSelector = new WorkspaceSelector(
				workspaceSelectorEl,
				this.plugin,
				(workspaceId: string) =>
					this.handleWorkspaceChange(workspaceId),
			);
		}

		// New Task Button
		const newTaskBtn = header.createEl("button", {
			cls: "fluent-new-task-btn",
		});
		setIcon(newTaskBtn.createDiv({ cls: "fluent-new-task-icon" }), "plus");
		newTaskBtn.createDiv({
			cls: "fluent-new-task-text",
			text: t("New Task"),
		});
		this.registerDomEvent(newTaskBtn, "click", () =>
			this.onNavigate("new-task"),
		);

		// Main navigation area
		const content = this.containerEl.createDiv({
			cls: "fluent-sidebar-content",
		});

		// Top navigation section (system views like Inbox, Today, etc.)
		const topItems = this.getViewItems("top");
		if (topItems.length > 0) {
			const topSection = content.createDiv({
				cls: "fluent-sidebar-section primary",
				attr: { "data-region": "top" },
			});
			this.renderSortableSection(topSection, topItems, "top");
		}

		// Projects section
		const isProjectsHidden =
			this.plugin.workspaceManager?.isSidebarComponentHidden(
				"projects-list",
			);

		if (!isProjectsHidden) {
			const projectsSection = content.createDiv({
				cls: "fluent-sidebar-section projects",
			});
			const projectHeader = projectsSection.createDiv({
				cls: "fluent-section-header",
			});

			projectHeader.createSpan({ text: t("Projects") });

			// Button container for tree toggle and sort
			const buttonContainer = projectHeader.createDiv({
				cls: "fluent-project-header-buttons",
			});

			// Tree/List toggle button
			const treeToggleBtn = buttonContainer.createDiv({
				cls: "fluent-tree-toggle-btn",
				attr: { "aria-label": t("Toggle tree/list view") },
			});
			// Load saved view mode preference
			this.isTreeView =
				this.plugin.app.loadLocalStorage(
					"task-genius-project-view-mode",
				) === "tree";
			setIcon(treeToggleBtn, this.isTreeView ? "git-branch" : "list");

			this.registerDomEvent(treeToggleBtn, "click", () => {
				this.isTreeView = !this.isTreeView;
				setIcon(treeToggleBtn, this.isTreeView ? "git-branch" : "list");
				// Save preference
				this.plugin.app.saveLocalStorage(
					"task-genius-project-view-mode",
					this.isTreeView ? "tree" : "list",
				);
				// Update project list view mode
				if (this.projectList) {
					(this.projectList as ProjectList).setViewMode?.(
						this.isTreeView,
					);
				}
			});

			// Sort button
			const sortProjectBtn = buttonContainer.createDiv({
				cls: "fluent-sort-project-btn",
				attr: { "aria-label": t("Sort projects") },
			});
			setIcon(sortProjectBtn, "arrow-up-down");

			// Pass sort button to project list for menu handling
			this.registerDomEvent(sortProjectBtn, "click", () => {
				(this.projectList as ProjectList).showSortMenu?.(
					sortProjectBtn,
				);
			});

			const projectListEl = projectsSection.createDiv();
			this.projectList = new ProjectList(
				projectListEl,
				this.plugin,
				this.onProjectSelect,
				this.isTreeView,
			);
			// Add ProjectList as a child component
			this.addChild(this.projectList);
		}

		// Bottom views section (Other Views / Custom Views)
		const isOtherViewsHidden =
			this.plugin.workspaceManager?.isSidebarComponentHidden(
				"other-views",
			);

		if (!isOtherViewsHidden) {
			const allBottomItems = this.getViewItems("bottom");
			const visibleCount =
				this.plugin?.settings?.fluentView?.fluentConfig
					?.maxOtherViewsBeforeOverflow ?? 5;
			const displayedItems = allBottomItems.slice(0, visibleCount);
			const overflowItems = allBottomItems.slice(visibleCount);

			const bottomSection = content.createDiv({
				cls: "fluent-sidebar-section other-views",
				attr: { "data-region": "bottom" },
			});

			// Header for "Other Views" with overflow menu
			const otherHeader = bottomSection.createDiv({
				cls: "fluent-section-header",
			});
			otherHeader.createSpan({ text: t("Other Views") });

			if (overflowItems.length > 0) {
				const moreBtn = otherHeader.createDiv({
					cls: "fluent-section-action",
					attr: { "aria-label": t("More views") },
				});
				setIcon(moreBtn, "more-horizontal");
				this.registerDomEvent(moreBtn, "click", (e) =>
					this.showOtherViewsMenu(e as MouseEvent, overflowItems),
				);
			}

			this.renderSortableSection(bottomSection, displayedItems, "bottom");
		}
	}

	private renderRailMode() {
		if (!this.railEl) {
			return;
		}

		// Clear existing content
		this.railEl.empty();

		// Workspace menu button
		const wsBtn = this.railEl.createDiv({
			cls: "fluent-rail-btn",
			attr: { "aria-label": t("Workspace") },
		});
		setIcon(wsBtn, "layers");
		this.registerDomEvent(wsBtn, "click", (e) =>
			this.showWorkspaceMenuWithManager(e as MouseEvent),
		);

		// Top region view icons
		this.getViewItems("top").forEach((item) => {
			this.renderRailButton(item);
		});

		// Bottom region view icons with overflow menu
		if (
			!this.plugin.workspaceManager?.isSidebarComponentHidden(
				"other-views",
			)
		) {
			const bottomItems = this.getViewItems("bottom");
			const visibleCount =
				this.plugin?.settings?.fluentView?.fluentConfig
					?.maxOtherViewsBeforeOverflow ?? 5;
			const displayedBottom = bottomItems.slice(0, visibleCount);
			const overflowBottom = bottomItems.slice(visibleCount);

			displayedBottom.forEach((item) => {
				this.renderRailButton(item);
			});

			if (overflowBottom.length > 0) {
				const moreBtn = this.railEl.createDiv({
					cls: "fluent-rail-btn",
					attr: { "aria-label": t("More views") },
				});
				setIcon(moreBtn, "more-horizontal");
				this.registerDomEvent(moreBtn, "click", (e) =>
					this.showOtherViewsMenu(e as MouseEvent, overflowBottom),
				);
			}
		}

		// Projects menu button
		if (
			!this.plugin.workspaceManager?.isSidebarComponentHidden(
				"projects-list",
			)
		) {
			const projBtn = this.railEl.createDiv({
				cls: "fluent-rail-btn",
				attr: { "aria-label": t("Projects") },
			});
			setIcon(projBtn, "folder");
			this.registerDomEvent(projBtn, "click", (e) =>
				this.showProjectMenu(e as MouseEvent),
			);
		}

		// Add (New Task) button
		const addBtn = this.railEl.createDiv({
			cls: "fluent-rail-btn",
			attr: { "aria-label": t("New Task") },
		});
		setIcon(addBtn, "plus");
		this.registerDomEvent(addBtn, "click", () =>
			this.onNavigate("new-task"),
		);
	}

	private renderRailButton(item: FluentTaskNavigationItem) {
		if (!this.railEl) return;
		const btn = this.railEl.createDiv({
			cls: "fluent-rail-btn",
			attr: { "aria-label": item.label, "data-view-id": item.id },
		});
		setIcon(btn, item.icon);
		this.registerDomEvent(btn, "click", () => {
			this.setActiveItem(item.id);
			this.onNavigate(item.id);
		});
		this.registerDomEvent(btn, "contextmenu", (e) => {
			this.showViewContextMenu(e as MouseEvent, item.id);
		});
	}

	private renderSortableSection(
		container: HTMLElement,
		items: FluentTaskNavigationItem[],
		region: "top" | "bottom",
	) {
		const listDiv = container.createDiv({ cls: "fluent-navigation-list" });

		// Render items
		items.forEach((item) => {
			const itemEl = listDiv.createDiv({
				cls: "fluent-navigation-item",
				attr: { "data-view-id": item.id },
			});
			const icon = itemEl.createDiv({ cls: "fluent-navigation-icon" });
			setIcon(icon, item.icon);
			itemEl.createSpan({
				cls: "fluent-navigation-label",
				text: item.label,
			});
			if (item.badge) {
				itemEl.createDiv({
					cls: "fluent-navigation-badge",
					text: String(item.badge),
				});
			}

			this.registerDomEvent(itemEl, "click", () => {
				this.setActiveItem(item.id);
				this.onNavigate(item.id);
			});
			this.registerDomEvent(itemEl, "contextmenu", (e) => {
				this.showViewContextMenu(e as MouseEvent, item.id);
			});
		});

		// Initialize Sortable with cross-region drag support
		const sortable = Sortable.create(listDiv, {
			group: "fluent-sidebar-views",
			animation: 150,
			ghostClass: "sortable-ghost",
			chosenClass: "sortable-chosen",
			dragClass: "sortable-drag",
			delay: Platform.isMobile ? 200 : 0,
			delayOnTouchOnly: true,
			onEnd: (evt) => this.handleReorder(evt),
		});
		this.sortables.push(sortable);
	}

	private async handleReorder(evt: Sortable.SortableEvent) {
		const { to, from, oldIndex, newIndex } = evt;

		// If moved within same list and index didn't change, skip
		if (to === from && oldIndex === newIndex) return;

		const container = this.containerEl;

		// Get all IDs from DOM in their new order
		const getIds = (region: "top" | "bottom") => {
			const section = container.querySelector(
				`.fluent-sidebar-section[data-region="${region}"] .fluent-navigation-list`,
			);
			if (!section) return [];
			return Array.from(section.children)
				.map((el) => el.getAttribute("data-view-id"))
				.filter((id) => id !== null) as string[];
		};

		const topIds = getIds("top");
		const bottomIds = getIds("bottom");
		const visibleIdSet = new Set([...topIds, ...bottomIds]);

		const currentConfig = this.plugin.settings.viewConfiguration;

		// Preserve hidden items (those not in DOM)
		const hiddenItems = currentConfig.filter(
			(v) => !visibleIdSet.has(v.id),
		);

		// Reconstruct visible items with updated region
		const findConfig = (id: string) =>
			currentConfig.find((v) => v.id === id);

		const newTopConfigs = topIds
			.map((id) => {
				const cfg = findConfig(id);
				if (cfg) cfg.region = "top";
				return cfg;
			})
			.filter((v) => v !== undefined) as ViewConfig[];

		const systemViewIds = Object.keys(this.SYSTEM_VIEWS);
		const newBottomConfigs = bottomIds
			.map((id) => {
				const cfg = findConfig(id);
				if (cfg) {
					// System views must stay in top region
					cfg.region = systemViewIds.includes(id) ? "top" : "bottom";
				}
				return cfg;
			})
			.filter((v) => v !== undefined) as ViewConfig[];

		// Separate system views (always top) from bottom configs
		const systemViewsInBottom = newBottomConfigs.filter((v) =>
			systemViewIds.includes(v.id),
		);
		const nonSystemBottomConfigs = newBottomConfigs.filter(
			(v) => !systemViewIds.includes(v.id),
		);

		// Update settings: Top (including system views) -> Bottom -> Hidden
		this.plugin.settings.viewConfiguration = [
			...newTopConfigs,
			...systemViewsInBottom, // System views dragged to bottom go back to top
			...nonSystemBottomConfigs,
			...hiddenItems,
		];

		await this.plugin.saveSettings();

		// Re-render to restore system views to top section if they were dragged to bottom
		if (systemViewsInBottom.length > 0) {
			this.render();
		}

		// Trigger event to notify other components (e.g., ViewSettingsTab)
		this.plugin.app.workspace.trigger("task-genius:view-config-changed", {
			reason: "sidebar-reorder",
		});
	}

	onload() {
		// Migration: Ensure system views exist in settings
		this.ensureSystemViews();

		// On mobile, ensure we render the full sidebar content
		// even though it starts "collapsed" (hidden off-screen)
		if (Platform.isPhone && this.collapsed) {
			// Temporarily set to not collapsed to render full content
			const wasCollapsed = this.collapsed;
			this.collapsed = false;
			this.render();
			this.collapsed = wasCollapsed;
			// Apply the collapsed class for CSS positioning
			this.containerEl.addClass("is-collapsed");
		} else {
			this.render();
		}

		// Subscribe to workspace events
		if (this.plugin.workspaceManager) {
			this.registerEvent(
				onWorkspaceSwitched(this.plugin.app, (payload) => {
					this.currentWorkspaceId = payload.workspaceId;
					this.render();
				}),
			);

			this.registerEvent(
				onWorkspaceDeleted(this.plugin.app, () => {
					this.render();
				}),
			);

			this.registerEvent(
				onWorkspaceCreated(this.plugin.app, () => {
					this.render();
				}),
			);
		}
	}

	onunload() {
		// Clean up sortable instances
		this.destroySortables();
		// Clean up is handled by Component base class
		this.containerEl.empty();
	}

	public setCollapsed(collapsed: boolean) {
		this.collapsed = collapsed;
		// On mobile, don't re-render when toggling collapse
		// The CSS will handle the drawer animation
		if (!Platform.isPhone) {
			this.render();
		} else {
			// Just toggle the class for mobile
			this.containerEl.toggleClass("is-collapsed", collapsed);
		}
	}

	private async handleWorkspaceChange(workspaceId: string) {
		if (this.plugin.workspaceManager) {
			await this.plugin.workspaceManager.setActiveWorkspace(workspaceId);
			this.currentWorkspaceId = workspaceId;
		}
	}

	private showWorkspaceMenuWithManager(event: MouseEvent) {
		if (!this.plugin.workspaceManager) return;

		const menu = new Menu();
		const workspaces = this.plugin.workspaceManager.getAllWorkspaces();
		const currentWorkspace =
			this.plugin.workspaceManager.getActiveWorkspace();

		workspaces.forEach((w) => {
			menu.addItem((item) => {
				const isDefault =
					this.plugin.workspaceManager?.isDefaultWorkspace(w.id);
				const title = isDefault ? `${w.name}` : w.name;

				item.setTitle(title)
					.setIcon("layers")
					.onClick(async () => {
						await this.handleWorkspaceChange(w.id);
					});
				if (w.id === currentWorkspace.id) item.setChecked(true);
			});
		});

		menu.addSeparator();
		menu.addItem((item) => {
			item.setTitle(t("Create Workspace"))
				.setIcon("plus")
				.onClick(() => this.showCreateWorkspaceDialog());
		});

		menu.showAtMouseEvent(event);
	}

	private showCreateWorkspaceDialog() {
		class CreateWorkspaceModal extends Modal {
			private nameInput: HTMLInputElement;

			constructor(
				private plugin: TaskProgressBarPlugin,
				private onCreated: () => void,
			) {
				super(plugin.app);
			}

			onOpen() {
				const { contentEl } = this;
				contentEl.createEl("h2", { text: t("Create New Workspace") });

				const inputContainer = contentEl.createDiv();
				inputContainer.createEl("label", {
					text: t("Workspace Name:"),
				});
				this.nameInput = inputContainer.createEl("input", {
					type: "text",
					placeholder: t("Enter workspace name..."),
				});

				const buttonContainer = contentEl.createDiv({
					cls: "modal-button-container",
				});
				const createButton = buttonContainer.createEl("button", {
					text: t("Create"),
				});
				const cancelButton = buttonContainer.createEl("button", {
					text: t("Cancel"),
				});

				createButton.addEventListener("click", async () => {
					const name = this.nameInput.value.trim();
					if (name && this.plugin.workspaceManager) {
						await this.plugin.workspaceManager.createWorkspace(
							name,
						);
						new Notice(
							t('Workspace "{{name}}" created', {
								interpolation: {
									name: name,
								},
							}),
						);
						this.onCreated();
						this.close();
					} else {
						new Notice(t("Please enter a workspace name"));
					}
				});

				cancelButton.addEventListener("click", () => {
					this.close();
				});

				this.nameInput.focus();
			}

			onClose() {
				const { contentEl } = this;
				contentEl.empty();
			}
		}

		new CreateWorkspaceModal(this.plugin, () => this.render()).open();
	}

	private showProjectMenu(event: MouseEvent) {
		// Try to use existing project list data; if missing, build a temporary one
		let projects: Project[] = [];
		const anyList: ProjectList = this.projectList as ProjectList;
		if (anyList && typeof anyList.getProjects === "function") {
			projects = anyList.getProjects();
		} else {
			const temp = createDiv();
			const tempList: ProjectList = new ProjectList(
				temp,
				this.plugin,
				this.onProjectSelect,
			);
			if (typeof tempList.getProjects === "function") {
				projects = tempList.getProjects();
			}
		}
		const menu = new Menu();
		projects.forEach((p) => {
			menu.addItem((item) => {
				item.setTitle(p.name)
					.setIcon("folder")
					.onClick(() => {
						this.onProjectSelect(p.filterKey);
					});
			});
		});
		menu.showAtMouseEvent(event);
	}

	private showOtherViewsMenu(
		event: MouseEvent,
		items: FluentTaskNavigationItem[],
	) {
		const menu = new Menu();
		items.forEach((it: FluentTaskNavigationItem) => {
			menu.addItem((mi) => {
				mi.setTitle(it.label)
					.setIcon(it.icon)
					.onClick(() => {
						this.setActiveItem(it.id);
						this.onNavigate(it.id);
					});
			});
		});
		menu.showAtMouseEvent(event);
	}

	private showViewContextMenu(event: MouseEvent, viewId: string) {
		event.preventDefault();
		event.stopPropagation();

		const menu = new Menu();

		// Check if this is a system view (inbox, today, upcoming, flagged)
		const isSystemView = viewId in this.SYSTEM_VIEWS;

		// Open in new tab
		menu.addItem((item) => {
			item.setTitle(t("Open in new tab"))
				.setIcon("plus-square")
				.onClick(() => {
					const leaf = this.plugin.app.workspace.getLeaf("tab");
					leaf.setViewState({
						type: TASK_SPECIFIC_VIEW_TYPE,
						state: {
							viewId: viewId,
						},
					});
				});
		});

		// Open settings
		menu.addItem((item) => {
			item.setTitle(t("Open settings"))
				.setIcon("settings")
				.onClick(async () => {
					// Special handling for habit view
					if (viewId === "habit") {
						(this.plugin.app as App).setting.open();
						(this.plugin.app as App).setting.openTabById(
							this.plugin.manifest.id,
						);
						setTimeout(() => {
							if (this.plugin.settingTab) {
								this.plugin.settingTab.openTab("habit");
							}
						}, 100);
						return;
					}

					// Normal handling for other views
					const view = this.plugin.settings.viewConfiguration.find(
						(v) => v.id === viewId,
					);
					if (!view) {
						return;
					}
					const currentRules = view?.filterRules || {};
					new ViewConfigModal(
						this.plugin.app,
						this.plugin,
						view,
						currentRules,
						(
							updatedView: ViewConfig,
							updatedRules: ViewFilterRule,
						) => {
							const currentIndex =
								this.plugin.settings.viewConfiguration.findIndex(
									(v) => v.id === updatedView.id,
								);
							if (currentIndex !== -1) {
								this.plugin.settings.viewConfiguration[
									currentIndex
								] = {
									...updatedView,
									filterRules: updatedRules,
								};
								this.plugin.saveSettings();
								// Re-render if visibility changed
								if (view.visible !== updatedView.visible) {
									this.render();
								}
								// Trigger view config changed event
								this.plugin.app.workspace.trigger(
									"task-genius:view-config-changed",
									{ reason: "edit", viewId: viewId },
								);
							}
						},
					).open();
				});
		});

		// Hide in sidebar - only for non-system views
		if (!isSystemView) {
			// Copy view
			menu.addItem((item) => {
				item.setTitle(t("Copy view"))
					.setIcon("copy")
					.onClick(() => {
						const view =
							this.plugin.settings.viewConfiguration.find(
								(v) => v.id === viewId,
							);
						if (!view) {
							return;
						}
						// Create a copy of the current view
						new ViewConfigModal(
							this.plugin.app,
							this.plugin,
							null, // null for create mode
							null, // null for create mode
							(
								createdView: ViewConfig,
								createdRules: ViewFilterRule,
							) => {
								if (
									!this.plugin.settings.viewConfiguration.some(
										(v) => v.id === createdView.id,
									)
								) {
									this.plugin.settings.viewConfiguration.push(
										{
											...createdView,
											filterRules: createdRules,
										},
									);
									this.plugin.saveSettings();
									// Re-render the sidebar to show the new view
									this.render();
									// Trigger view config changed event
									this.plugin.app.workspace.trigger(
										"task-genius:view-config-changed",
										{
											reason: "create",
											viewId: createdView.id,
										},
									);
									new Notice(
										t("View copied successfully: ") +
											createdView.name,
									);
								} else {
									new Notice(
										t("Error: View ID already exists."),
									);
								}
							},
							view, // Pass current view as copy source
							view.id,
						).open();
					});
			});

			menu.addItem((item) => {
				item.setTitle(t("Hide in sidebar"))
					.setIcon("eye-off")
					.onClick(() => {
						const view =
							this.plugin.settings.viewConfiguration.find(
								(v) => v.id === viewId,
							);
						if (!view) {
							return;
						}
						view.visible = false;
						this.plugin.saveSettings();
						// Re-render sidebar
						this.render();
						// Trigger view config changed event
						this.plugin.app.workspace.trigger(
							"task-genius:view-config-changed",
							{ reason: "visibility", viewId: viewId },
						);
					});
			});
		}

		// Delete (for custom views only)
		const view = this.plugin.settings.viewConfiguration.find(
			(v) => v.id === viewId,
		);
		if (view?.type === "custom") {
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle(t("Delete"))
					.setIcon("trash")
					.setWarning(true)
					.onClick(() => {
						this.plugin.settings.viewConfiguration =
							this.plugin.settings.viewConfiguration.filter(
								(v) => v.id !== viewId,
							);
						this.plugin.saveSettings();
						// Re-render sidebar
						this.render();
						// Trigger view config changed event
						this.plugin.app.workspace.trigger(
							"task-genius:view-config-changed",
							{ reason: "delete", viewId: viewId },
						);
						new Notice(t("View deleted: ") + view.name);
					});
			});
		}

		menu.showAtMouseEvent(event);
	}

	public setActiveItem(viewId: string) {
		// Clear active state from both full navigation items and rail buttons
		this.containerEl
			.querySelectorAll(
				".fluent-navigation-item, .fluent-rail-btn[data-view-id]",
			)
			.forEach((el) => {
				el.removeClass("is-active");
			});
		// Apply to any element that carries this view id (works in both modes)
		const activeEls = this.containerEl.querySelectorAll<HTMLElement>("[data-view-id]");
		activeEls.forEach(el => { if (el.dataset.viewId === viewId) el.addClass("is-active"); });
	}

	public updateWorkspace(workspaceOrId: string | WorkspaceData) {
		const workspaceId =
			typeof workspaceOrId === "string"
				? workspaceOrId
				: workspaceOrId.id;
		this.currentWorkspaceId = workspaceId;
		this.workspaceSelector?.setWorkspace(workspaceId);
		this.projectList?.refresh();
	}

	/**
	 * Enable or disable project list interaction
	 * Used when showing full projects overview to prevent conflicting navigation
	 */
	public setProjectListEnabled(enabled: boolean) {
		if (!this.projectList) return;
		this.projectList.setEnabled(enabled);
	}
}
