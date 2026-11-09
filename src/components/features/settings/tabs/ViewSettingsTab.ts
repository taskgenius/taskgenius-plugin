import { Setting, Notice, setIcon } from "obsidian";
import { ViewConfig, ViewFilterRule } from "@/common/setting-definition";
import { t } from "@/translations/helper";
import { TaskProgressBarSettingTab } from "@/setting";
import { ViewConfigModal } from "@/components/features/task/view/modals/ViewConfigModal";
import Sortable from "sortablejs";
import "@/styles/view-setting-tab.css";

export function renderViewSettingsTab(
	settingTab: TaskProgressBarSettingTab,
	containerEl: HTMLElement,
) {
	new Setting(containerEl)
		.setName(t("View Configuration"))
		.setDesc(
			t(
				"Configure the Task Genius sidebar views, visibility, order, and create custom views.",
			),
		)
		.setHeading();

	new Setting(containerEl)
		.setName(t("Enable Task Genius Views"))
		.setDesc(
			t(
				"Enable Task Genius sidebar views to display and manage tasks. Requires the indexer to be enabled.",
			),
		)
		.addToggle((toggle) => {
			toggle.setValue(settingTab.plugin.settings.enableView);
			toggle.onChange((value) => {
				if (value && !settingTab.plugin.settings.enableIndexer) {
					// If trying to enable views but indexer is disabled, show warning
					new Notice(
						t(
							"Cannot enable views without indexer. Please enable the indexer first in Index & Sources settings.",
						),
					);
					toggle.setValue(false);
					return;
				}
				settingTab.plugin.settings.enableView = value;
				settingTab.applySettingsUpdate();
				settingTab.display(); // Refresh settings display
			});
		});

	if (!settingTab.plugin.settings.enableView) {
		// Show message when views are disabled
		new Setting(containerEl)
			.setName(t("Views are disabled"))
			.setDesc(
				t("Enable Task Genius Views above to configure view settings."),
			);
		return;
	}

	new Setting(containerEl)
		.setName(t("Default view mode"))
		.setDesc(
			t(
				"Choose the default display mode for all views. This affects how tasks are displayed when you first open a view or create a new view.",
			),
		)
		.addDropdown((dropdown) => {
			dropdown
				.addOption("list", t("List View"))
				.addOption("tree", t("Tree View"))
				.setValue(settingTab.plugin.settings.defaultViewMode)
				.onChange((value) => {
					settingTab.plugin.settings.defaultViewMode = value as
						| "list"
						| "tree";
					settingTab.applySettingsUpdate();
				});
		});

	// Project Tree View Settings
	new Setting(containerEl)
		.setName(t("Project Tree View Settings"))
		.setDesc(t("Configure how projects are displayed in tree view."))
		.setHeading();

	new Setting(containerEl)
		.setName(t("Default project view mode"))
		.setDesc(
			t(
				"Choose whether to display projects as a flat list or hierarchical tree by default.",
			),
		)
		.addDropdown((dropdown) => {
			dropdown
				.addOption("list", t("List View"))
				.addOption("tree", t("Tree View"))
				.setValue(settingTab.plugin.settings.projectViewDefaultMode)
				.onChange((value) => {
					settingTab.plugin.settings.projectViewDefaultMode =
						value as "list" | "tree";
					settingTab.applySettingsUpdate();
				});
		});

	new Setting(containerEl)
		.setName(t("Auto-expand project tree"))
		.setDesc(
			t(
				"Automatically expand all project nodes when opening the project view in tree mode.",
			),
		)
		.addToggle((toggle) => {
			toggle
				.setValue(settingTab.plugin.settings.projectTreeAutoExpand)
				.onChange((value) => {
					settingTab.plugin.settings.projectTreeAutoExpand = value;
					settingTab.applySettingsUpdate();
				});
		});

	new Setting(containerEl)
		.setName(t("Show empty project folders"))
		.setDesc(
			t("Display project folders even if they don't contain any tasks."),
		)
		.addToggle((toggle) => {
			toggle
				.setValue(
					settingTab.plugin.settings.projectTreeShowEmptyFolders,
				)
				.onChange((value) => {
					settingTab.plugin.settings.projectTreeShowEmptyFolders =
						value;
					settingTab.applySettingsUpdate();
				});
		});

	new Setting(containerEl)
		.setName(t("Project path separator"))
		.setDesc(
			t(
				"Character used to separate project hierarchy levels (e.g., '/' in 'Project/SubProject').",
			),
		)
		.addText((text) => {
			text.setPlaceholder("/")
				.setValue(settingTab.plugin.settings.projectPathSeparator)
				.onChange((value) => {
					settingTab.plugin.settings.projectPathSeparator =
						value || "/";
					settingTab.applySettingsUpdate();
				});
		});

	// Date and Time Configuration Section
	new Setting(containerEl)
		.setName(t("Date and Time Display"))
		.setDesc(t("Configure how dates and times are displayed in views."))
		.setHeading();

	new Setting(containerEl)
		.setName(t("Use relative time for date"))
		.setDesc(
			t(
				"Use relative time for date in task list item, e.g. 'yesterday', 'today', 'tomorrow', 'in 2 days', '3 months ago', etc.",
			),
		)
		.addToggle((toggle) => {
			toggle.setValue(settingTab.plugin.settings.useRelativeTimeForDate);
			toggle.onChange((value) => {
				settingTab.plugin.settings.useRelativeTimeForDate = value;
				settingTab.applySettingsUpdate();
			});
		});

	// Inline Editor Configuration
	new Setting(containerEl)
		.setName(t("Editor Configuration"))
		.setDesc(t("Configure inline editing and metadata positioning."))
		.setHeading();

	new Setting(containerEl)
		.setName(t("Enable inline editor"))
		.setDesc(
			t(
				"Enable inline editing of task content and metadata directly in task views. When disabled, tasks can only be edited in the source file.",
			),
		)
		.addToggle((toggle) => {
			toggle.setValue(settingTab.plugin.settings.enableInlineEditor);
			toggle.onChange((value) => {
				settingTab.plugin.settings.enableInlineEditor = value;
				settingTab.applySettingsUpdate();
			});
		});

	new Setting(containerEl)
		.setName(t("Enable dynamic metadata positioning"))
		.setDesc(
			t(
				"Intelligently position task metadata. When enabled, metadata appears on the same line as short tasks and below long tasks. When disabled, metadata always appears below the task content.",
			),
		)
		.addToggle((toggle) => {
			toggle.setValue(
				settingTab.plugin.settings.enableDynamicMetadataPositioning,
			);
			toggle.onChange((value) => {
				settingTab.plugin.settings.enableDynamicMetadataPositioning =
					value;
				settingTab.applySettingsUpdate();
			});
		});

	let topSortable: Sortable | null = null;
	let bottomSortable: Sortable | null = null;
	(containerEl as any).cleanupViewSortables = () => { topSortable?.destroy(); bottomSortable?.destroy(); topSortable = null; bottomSortable = null; };

	// --- New View Management Section ---
	new Setting(containerEl)
		.setName(t("Manage Views"))
		.setDesc(
			t(
				"Drag views between sections or within sections to reorder them. Toggle visibility with the eye icon.",
			),
		)
		.setHeading();

	const viewListContainer = containerEl.createDiv({
		cls: "view-management-list",
	});

	// Create two containers for top and bottom sections
	const topSectionContainer = viewListContainer.createDiv({
		cls: "view-section-container",
	});
	const topSectionHeader = topSectionContainer.createDiv({
		cls: "view-section-header",
	});
	topSectionHeader.createEl("h4", { text: t("Top Section") });
	const topViewsContainer = topSectionContainer.createDiv({
		cls: "view-section-items sortable-views",
		attr: { "data-region": "top" },
	});

	const bottomSectionContainer = viewListContainer.createDiv({
		cls: "view-section-container",
	});
	const bottomSectionHeader = bottomSectionContainer.createDiv({
		cls: "view-section-header",
	});
	bottomSectionHeader.createEl("h4", { text: t("Bottom Section") });
	const bottomViewsContainer = bottomSectionContainer.createDiv({
		cls: "view-section-items sortable-views",
		attr: { "data-region": "bottom" },
	});

	// Function to render the list of views
	const renderViewList = () => {
		topViewsContainer.empty();
		bottomViewsContainer.empty();

		// Destroy existing sortables before re-rendering
		if (topSortable) {
			topSortable.destroy();
			topSortable = null;
		}
		if (bottomSortable) {
			bottomSortable.destroy();
			bottomSortable = null;
		}

		// Group views by region
		const topViews: ViewConfig[] = [];
		const bottomViews: ViewConfig[] = [];

		settingTab.plugin.settings.viewConfiguration.forEach((view) => {
			if (view.region === "bottom") {
				bottomViews.push(view);
			} else {
				topViews.push(view);
			}
		});

		// Helper function to create view item
		const createViewItem = (view: ViewConfig, container: HTMLElement) => {
			const viewEl = container.createDiv({
				cls: "view-item sortable-view-item",
				attr: {
					"data-view-id": view.id,
				},
			});

			// Add drag handle
			const dragHandle = viewEl.createDiv({ cls: "view-drag-handle" });
			setIcon(dragHandle, "grip-vertical");

			// View icon
			const iconEl = viewEl.createDiv({ cls: "view-item-icon" });
			setIcon(iconEl, view.icon);

			// View info
			const infoEl = viewEl.createDiv({ cls: "view-item-info" });
			infoEl.createEl("div", { cls: "view-item-name", text: view.name });
			infoEl.createEl("div", {
				cls: "view-item-type",
				text: `[${view.type}]`,
			});

			// Actions container
			const actionsEl = viewEl.createDiv({ cls: "view-item-actions" });

			// Visibility toggle
			const visibilityBtn = actionsEl.createEl("button", {
				cls: ["view-action-button", "clickable-icon"],
				attr: {
					"aria-label": view.visible
						? t("Hide from sidebar")
						: t("Show in sidebar"),
				},
			});
			setIcon(visibilityBtn, view.visible ? "eye" : "eye-off");
			visibilityBtn.onclick = async () => {
				view.visible = !view.visible;
				// Save only; avoid full view refresh
				await settingTab.plugin.saveSettings();
				renderViewList();
				// Emit event to notify TaskView sidebar to update without full view refresh
				(settingTab.app.workspace as any).trigger(
					"task-genius:view-config-changed",
					{ reason: "visibility-changed", viewId: view.id },
				);
			};

			// Edit button
			const editBtn = actionsEl.createEl("button", {
				cls: ["view-action-button", "clickable-icon"],
				attr: {
					"aria-label": t("Edit View"),
				},
			});
			setIcon(editBtn, "pencil");
			editBtn.onclick = () => {
				if (view.id === "habit") {
					settingTab.openTab("habit");
					return;
				}
				new ViewConfigModal(
					settingTab.app,
					settingTab.plugin,
					view,
					view.filterRules || {},
					(updatedView: ViewConfig, updatedRules: ViewFilterRule) => {
						const currentIndex =
							settingTab.plugin.settings.viewConfiguration.findIndex(
								(v) => v.id === updatedView.id,
							);
						if (currentIndex !== -1) {
							settingTab.plugin.settings.viewConfiguration[
								currentIndex
							] = {
								...updatedView,
								filterRules: updatedRules,
							};
							settingTab.plugin.saveSettings();
							renderViewList();
							(settingTab.app.workspace as any).trigger(
								"task-genius:view-config-changed",
								{
									reason: "view-updated",
									viewId: updatedView.id,
								},
							);
						}
					},
				).open();
			};

			// Copy button
			const copyBtn = actionsEl.createEl("button", {
				cls: ["view-action-button", "clickable-icon"],
				attr: {
					"aria-label": t("Copy View"),
				},
			});
			setIcon(copyBtn, "copy");
			copyBtn.onclick = () => {
				new ViewConfigModal(
					settingTab.app,
					settingTab.plugin,
					null,
					null,
					(createdView: ViewConfig, createdRules: ViewFilterRule) => {
						if (
							!settingTab.plugin.settings.viewConfiguration.some(
								(v) => v.id === createdView.id,
							)
						) {
							settingTab.plugin.settings.viewConfiguration.push({
								...createdView,
								filterRules: createdRules,
							});
							settingTab.plugin.saveSettings();
							renderViewList();
							(settingTab.app.workspace as any).trigger(
								"task-genius:view-config-changed",
								{
									reason: "view-copied",
									viewId: createdView.id,
								},
							);
							new Notice(
								t("View copied successfully: ") +
									createdView.name,
							);
						} else {
							new Notice(t("Error: View ID already exists."));
						}
					},
					view,
					view.id,
				).open();
			};

			// Delete button for custom views
			if (view.type === "custom") {
				const deleteBtn = actionsEl.createEl("button", {
					cls: [
						"view-action-button",
						"view-action-delete",
						"clickable-icon",
					],
					attr: {
						"aria-label": t("Delete View"),
					},
				});
				setIcon(deleteBtn, "trash");
				deleteBtn.onclick = () => {
					const index =
						settingTab.plugin.settings.viewConfiguration.findIndex(
							(v) => v.id === view.id,
						);
					if (index !== -1) {
						settingTab.plugin.settings.viewConfiguration.splice(
							index,
							1,
						);
						settingTab.applySettingsUpdate();
						renderViewList();
					}
				};
			}

			return viewEl;
		};

		// Render views in their respective containers
		topViews.forEach((view) => createViewItem(view, topViewsContainer));
		bottomViews.forEach((view) =>
			createViewItem(view, bottomViewsContainer),
		);

		// Setup sortable for both containers
		const updateViewOrder = () => {
			const newOrder: ViewConfig[] = [];

			// Get all views from top container
			topViewsContainer
				.querySelectorAll(".sortable-view-item")
				.forEach((el) => {
					const viewId = el.getAttribute("data-view-id");
					const view =
						settingTab.plugin.settings.viewConfiguration.find(
							(v) => v.id === viewId,
						);
					if (view) {
						view.region = "top";
						newOrder.push(view);
					}
				});

			// Get all views from bottom container
			bottomViewsContainer
				.querySelectorAll(".sortable-view-item")
				.forEach((el) => {
					const viewId = el.getAttribute("data-view-id");
					const view =
						settingTab.plugin.settings.viewConfiguration.find(
							(v) => v.id === viewId,
						);
					if (view) {
						view.region = "bottom";
						newOrder.push(view);
					}
				});

			// Update the settings
			settingTab.plugin.settings.viewConfiguration = newOrder;
			settingTab.plugin.saveSettings();
			(settingTab.app.workspace as any).trigger(
				"task-genius:view-config-changed",
				{ reason: "order-changed" },
			);
		};

		// Create sortable instances
		topSortable = Sortable.create(topViewsContainer, {
			group: "views",
			animation: 150,
			handle: ".view-drag-handle",
			ghostClass: "sortable-ghost",
			chosenClass: "sortable-chosen",
			dragClass: "sortable-drag",
			onEnd: () => {
				updateViewOrder();
			},
		});

		bottomSortable = Sortable.create(bottomViewsContainer, {
			group: "views",
			animation: 150,
			handle: ".view-drag-handle",
			ghostClass: "sortable-ghost",
			chosenClass: "sortable-chosen",
			dragClass: "sortable-drag",
			onEnd: () => {
				updateViewOrder();
			},
		});
	};

	renderViewList(); // Initial render

	// Listen for view config changes from FluentSidebar or other sources
	settingTab.plugin.registerEvent(
		settingTab.app.workspace.on(
			"task-genius:view-config-changed",
			(payload: { reason: string }) => {
				// Only refresh if the change came from sidebar reorder
				if (payload?.reason === "sidebar-reorder") {
					renderViewList();
				}
			},
		),
	);

	// Add New Custom View Button (Logic unchanged)
	const addBtnContainer = containerEl.createDiv();
	new Setting(addBtnContainer).addButton((button) => {
		button
			.setButtonText(t("Add Custom View"))
			.setCta()
			.onClick(() => {
				new ViewConfigModal(
					settingTab.app,
					settingTab.plugin,
					null,
					null,
					(createdView: ViewConfig, createdRules: ViewFilterRule) => {
						if (
							!settingTab.plugin.settings.viewConfiguration.some(
								(v) => v.id === createdView.id,
							)
						) {
							// Save with filter rules embedded
							settingTab.plugin.settings.viewConfiguration.push({
								...createdView,
								filterRules: createdRules,
							});
							settingTab.plugin.saveSettings();
							renderViewList();
							(settingTab.app.workspace as any).trigger(
								"task-genius:view-config-changed",
								{
									reason: "view-added",
									viewId: createdView.id,
								},
							);
						} else {
							new Notice(t("Error: View ID already exists."));
						}
					},
				).open();
			});
	});
}
