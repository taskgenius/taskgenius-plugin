import { App, Component, Menu, setIcon, Notice } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { t } from "@/translations/helper";
// Import necessary types from settings definition
import {
	ViewConfig,
	ViewFilterRule,
	ViewMode,
	getViewSettingOrDefault,
} from "@/common/setting-definition";
import { TASK_SPECIFIC_VIEW_TYPE } from "@/pages/TaskSpecificView";
import { ViewConfigModal } from "@/components/features/task/view/modals/ViewConfigModal";

// Remove the enum if it exists, use ViewMode type directly
// export type ViewMode = "inbox" | "forecast" | "projects" | "tags" | "review";

export class SidebarComponent extends Component {
	private containerEl: HTMLElement;
	private navEl: HTMLElement;
	private plugin: TaskProgressBarPlugin;
	private app: App;
	private currentViewId: ViewMode = "inbox";
	private isCollapsed = false;

	// Event handlers
	public onViewModeChanged: (viewId: ViewMode) => void = () => {};
	public onProjectSelected: (project: string) => void = () => {};

	constructor(parentEl: HTMLElement, plugin: TaskProgressBarPlugin) {
		super();
		this.containerEl = parentEl.createDiv({ cls: "task-sidebar" });
		this.plugin = plugin;
		this.app = plugin.app;
	}

	onload() {
		this.navEl = this.containerEl.createDiv({ cls: "sidebar-nav" });
		this.renderSidebarItems(); // Initial render
	}

	// New method to render sidebar items dynamically
	renderSidebarItems() {
		this.navEl.empty(); // Clear existing items

		// Ensure settings are initialized
		if (!this.plugin.settings.viewConfiguration) {
			// This should ideally be handled earlier, but as a fallback:
			console.warn(
				"SidebarComponent: viewConfiguration not initialized in settings."
			);
			return;
		}

		// 根据 region 属性将视图分为顶部组和底部组，同时保持各组内的顺序
		const topViews: ViewConfig[] = [];
		const bottomViews: ViewConfig[] = [];

		// 按照原始顺序遍历，根据 region 分组
		this.plugin.settings.viewConfiguration.forEach((viewConfig) => {
			if (viewConfig.visible) {
				if (viewConfig.region === "bottom") {
					bottomViews.push(viewConfig);
				} else {
					// 默认或 "top" 都放在顶部
					topViews.push(viewConfig);
				}
			}
		});

		// 先渲染顶部视图（保持原始顺序）
		topViews.forEach((viewConfig) => {
			this.createNavItem(
				viewConfig.id,
				t(viewConfig.name),
				viewConfig.icon
			);
		});

		// 如果有顶部视图和底部视图，添加分隔符
		if (topViews.length > 0 && bottomViews.length > 0) {
			this.createNavSpacer();
		}

		// 渲染底部视图（保持原始顺序）
		bottomViews.forEach((viewConfig) => {
			this.createNavItem(
				viewConfig.id,
				t(viewConfig.name),
				viewConfig.icon
			);
		});

		// Highlight the currently active view
		this.updateActiveItem();
	}

	private createNavSpacer() {
		this.navEl.createDiv({ cls: "sidebar-nav-spacer" });
	}

	private createNavItem(viewId: ViewMode, label: string, icon: string) {
		const navItem = this.navEl.createDiv({
			cls: "sidebar-nav-item",
			attr: { "data-view-id": viewId },
		});

		const iconEl = navItem.createSpan({ cls: "nav-item-icon" });
		setIcon(iconEl, icon);

		navItem.createSpan({ cls: "nav-item-label", text: label });

		this.registerDomEvent(navItem, "click", () => {
			this.setViewMode(viewId);
			// Trigger the event for TaskView to handle the switch
			if (this.onViewModeChanged) {
				this.onViewModeChanged(viewId);
			}
		});

		this.registerDomEvent(navItem, "contextmenu", (e) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(t("Open in new tab")).onClick(() => {
					const leaf = this.app.workspace.getLeaf();
					leaf.setViewState({
						type: TASK_SPECIFIC_VIEW_TYPE,
						state: {
							viewId: viewId,
						},
					});
				});
			})
				.addItem((item) => {
					item.setTitle(t("Open settings")).onClick(async () => {
						// Special handling for habit view
						if (viewId === "habit") {
							// Open the settings tab and navigate to habit section
							(this.app as any).setting.open();
							(this.app as any).setting.openTabById(this.plugin.manifest.id);
							// Wait a bit for the settings to open
							setTimeout(() => {
								if (this.plugin.settingTab) {
									this.plugin.settingTab.openTab("habit");
								}
							}, 100);
							return;
						}
						
						// Normal handling for other views
						const view =
							this.plugin.settings.viewConfiguration.find(
								(v) => v.id === viewId
							);
						if (!view) {
							return;
						}
						const currentRules = view?.filterRules || {};
						new ViewConfigModal(
							this.app,
							this.plugin,
							view,
							currentRules,
							(
								updatedView: ViewConfig,
								updatedRules: ViewFilterRule
							) => {
								const currentIndex =
									this.plugin.settings.viewConfiguration.findIndex(
										(v) => v.id === updatedView.id
									);
								if (currentIndex !== -1) {
									// Update the view config in the array
									this.plugin.settings.viewConfiguration[
										currentIndex
									] = {
										...updatedView,
										filterRules: updatedRules,
									}; // Ensure rules are saved back to viewConfig
									this.plugin.saveSettings();
									this.updateActiveItem();
								}
							}
						).open();
					});
				})
				.addItem((item) => {
					item.setTitle(t("Copy view")).onClick(() => {
						const view =
							this.plugin.settings.viewConfiguration.find(
								(v) => v.id === viewId
							);
						if (!view) {
							return;
						}
						// Create a copy of the current view
						new ViewConfigModal(
							this.app,
							this.plugin,
							null, // null for create mode
							null, // null for create mode
							(
								createdView: ViewConfig,
								createdRules: ViewFilterRule
							) => {
								if (
									!this.plugin.settings.viewConfiguration.some(
										(v) => v.id === createdView.id
									)
								) {
									// Save with filter rules embedded
									this.plugin.settings.viewConfiguration.push(
										{
											...createdView,
											filterRules: createdRules,
										}
									);
									this.plugin.saveSettings();
									this.renderSidebarItems();
									new Notice(
										t("View copied successfully: ") +
											createdView.name
									);
								} else {
									new Notice(
										t("Error: View ID already exists.")
									);
								}
							},
							view, // 传入当前视图作为拷贝源
							view.id
						).open();
					});
				})
				.addItem((item) => {
					item.setTitle(t("Hide in sidebar")).onClick(() => {
						const view =
							this.plugin.settings.viewConfiguration.find(
								(v) => v.id === viewId
							);
						if (!view) {
							return;
						}
						view.visible = false;
						this.plugin.saveSettings();
						this.renderSidebarItems();
					});
				});

			if (
				this.plugin.settings.viewConfiguration.find(
					(view) => view.id === viewId
				)?.type === "custom"
			) {
				menu.addItem((item) => {
					item.setTitle(t("Delete"))
						.setWarning(true)
						.onClick(() => {
							this.plugin.settings.viewConfiguration =
								this.plugin.settings.viewConfiguration.filter(
									(v) => v.id !== viewId
								);

							this.plugin.saveSettings();
							this.renderSidebarItems();
						});
				});
			}

			menu.showAtMouseEvent(e);
		});

		return navItem;
	}

	// Updated setViewMode to accept ViewMode type and use viewId
	setViewMode(viewId: ViewMode) {
		this.currentViewId = viewId;
		this.updateActiveItem();
	}

	private updateActiveItem() {
		const items = this.navEl.querySelectorAll(".sidebar-nav-item");
		items.forEach((item) => {
			if (item.getAttribute("data-view-id") === this.currentViewId) {
				item.addClass("is-active");
			} else {
				item.removeClass("is-active");
			}
		});
	}

	setCollapsed(collapsed: boolean) {
		this.isCollapsed = collapsed;
		this.containerEl.toggleClass("collapsed", collapsed);
	}

	onunload() {
		this.containerEl.empty();
	}
}
