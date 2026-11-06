import {
	EditorView,
	ViewPlugin,
	ViewUpdate,
	Decoration,
	DecorationSet,
	WidgetType,
	PluginValue,
	PluginSpec,
} from "@codemirror/view";
import {
	App,
	editorLivePreviewField,
	Menu,
	MenuItem,
	moment,
	Platform,
} from "obsidian";
import TaskProgressBarPlugin from "../../index";
import { Annotation } from "@codemirror/state";
import { t } from "../../translations/helper";
import { DatePickerPopover } from "@/components/ui/date-picker/DatePickerPopover";
import { DatePickerModal } from "@/components/ui/date-picker/DatePickerModal";
import {
	DateMatch,
	WidgetInfo,
	isInsideTaskLine,
	findTaskLineAt,
	findDatesInTaskLine,
	generateWidgetId,
	isValidPosition,
	safeGetLine,
	getAffectedLineNumbers,
	shouldSkipRendering,
} from "./date-picker-utils";

export const dateChangeAnnotation = Annotation.define();

/**
 * Widget for rendering date picker in tasks
 */
class DatePickerWidget extends WidgetType {
	readonly lineNumber: number;
	readonly offsetInLine: number;

	constructor(
		readonly app: App,
		readonly plugin: TaskProgressBarPlugin,
		readonly view: EditorView,
		readonly match: DateMatch,
		readonly id: string
	) {
		super();
		// Store line context for precise repositioning
		try {
			const line = view.state.doc.lineAt(match.from);
			this.lineNumber = line.number;
			this.offsetInLine = match.from - line.from;
		} catch (e) {
			console.warn("Error calculating widget position:", e);
			this.lineNumber = 1;
			this.offsetInLine = 0;
		}
	}

	eq(other: DatePickerWidget): boolean {
		return (
			this.id === other.id &&
			this.match.dateText === other.match.dateText &&
			this.match.marker === other.match.marker
		);
	}

	toDOM(): HTMLElement {
		try {
			const wrapper = createEl("span", {
				cls: "date-picker-widget",
				attr: {
					"aria-label": "Task Date",
					"data-widget-id": this.id,
				},
			});

			const dateText = createSpan({
				cls: "task-date-text",
				text: this.match.fullMatch,
			});

			// Handle click to show date menu
			dateText.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.showDateMenu(e);
			});

			wrapper.appendChild(dateText);
			return wrapper;
		} catch (error) {
			console.error("Error creating date picker widget DOM:", error);
			// Return a fallback element to prevent crashes
			const fallback = createEl("span", {
				cls: "date-picker-widget-error",
				text: this.match.fullMatch,
			});
			return fallback;
		}
	}

	private showDateMenu(e: MouseEvent) {
		try {
			const currentDate = this.match.dateText;

			if (Platform.isDesktop) {
				// Desktop environment - show Popover
				const popover = new DatePickerPopover(
					this.app,
					this.plugin,
					currentDate || undefined,
					this.match.marker
				);

				popover.onDateSelected = (date: string | null) => {
					if (date) {
						this.setDate(date);
					} else {
						// Clear date
						this.setDate("");
					}
				};

				popover.showAtPosition({
					x: e.clientX,
					y: e.clientY,
				});
			} else {
				// Mobile environment - show Modal
				const modal = new DatePickerModal(
					this.app,
					this.plugin,
					currentDate || undefined,
					this.match.marker
				);

				modal.onDateSelected = (date: string | null) => {
					if (date) {
						this.setDate(date);
					} else {
						// Clear date
						this.setDate("");
					}
				};

				modal.open();
			}
		} catch (error) {
			console.error("Error showing date menu:", error);
		}
	}

	/**
	 * Resolve the current range of this widget's date in the live document
	 * Uses line number and offset for precise repositioning
	 */
	private resolveCurrentRange(): { from: number; to: number } | null {
		try {
			const state = this.view?.state;
			if (!state) return null;

			// 1. Get the line by number
			const line = safeGetLine(state.doc, this.lineNumber);
			if (!line) {
				return null;
			}

			// 2. Check if it's still a task line
			const taskLine = findTaskLineAt(state, line.from);
			if (!taskLine) {
				return null;
			}

			// 3. Find all dates in this line
			const dates = findDatesInTaskLine(
				line.text,
				line.from,
				this.plugin.settings.preferMetadataFormat === "dataview"
			);

			// 4. Find the date that matches our marker and is closest to our offset
			let bestMatch: DateMatch | null = null;
			let minOffsetDiff = Infinity;

			for (const date of dates) {
				// Must match the same marker
				if (date.marker !== this.match.marker) {
					continue;
				}

				const currentOffset = date.from - line.from;
				const offsetDiff = Math.abs(currentOffset - this.offsetInLine);

				// Use the closest match (with tolerance)
				if (offsetDiff < minOffsetDiff && offsetDiff < 10) {
					bestMatch = date;
					minOffsetDiff = offsetDiff;
				}
			}

			if (bestMatch) {
				return { from: bestMatch.from, to: bestMatch.to };
			}

			return null;
		} catch (e) {
			console.warn("Failed to resolve current date range:", e);
			return null;
		}
	}

	private setDate(date: string) {
		try {
			// Validate the view
			if (!this.view) {
				console.warn("Invalid view state, skipping date update");
				return;
			}

			// Re-resolve the current range
			const range = this.resolveCurrentRange();
			if (!range) {
				console.warn(
					"Could not locate current date range; skipping update"
				);
				return;
			}

			// Extra safety: ensure single-line range
			const fromLine = this.view.state.doc.lineAt(range.from);
			const toLine = this.view.state.doc.lineAt(range.to);
			if (fromLine.number !== toLine.number) {
				console.warn("Refusing to replace multi-line range for date");
				return;
			}

			const useDataviewFormat =
				this.plugin.settings.preferMetadataFormat === "dataview";
			let newText = "";

			if (date) {
				if (useDataviewFormat) {
					// For dataview format: reconstruct [xxx:: date] pattern
					newText = `${this.match.marker}${date}]`;
				} else {
					// For tasks format: emoji + space + date
					newText = `${this.match.marker} ${date}`;
				}
			}

			const transaction = this.view.state.update({
				changes: { from: range.from, to: range.to, insert: newText },
				annotations: [dateChangeAnnotation.of(true)],
			});
			this.view.dispatch(transaction);
		} catch (error) {
			console.error("Error setting date:", error);
		}
	}
}

/**
 * Date picker view plugin implementation
 */
export function datePickerExtension(app: App, plugin: TaskProgressBarPlugin) {
	// Don't enable if the setting is off
	if (!plugin.settings.enableDatePicker) {
		return [];
	}

	class DatePickerViewPluginValue implements PluginValue {
		public readonly view: EditorView;
		public readonly plugin: TaskProgressBarPlugin;
		decorations: DecorationSet = Decoration.none;
		public isDestroyed = false;
		private widgetRegistry: Map<string, WidgetInfo> = new Map();

		constructor(view: EditorView) {
			this.view = view;
			this.plugin = plugin;
			this.updateDecorations(view);
		}

		update(update: ViewUpdate): void {
			if (this.isDestroyed) return;

			try {
				// Handle selection changes immediately to hide widgets near cursor
				if (update.selectionSet || update.viewportChanged) {
					// Rebuild decorations to handle cursor overlap
					this.decorations = this.buildDecorationsFromRegistry();
				}

				// Only handle document changes
				if (!update.docChanged) {
					return;
				}

				// Perform immediate update (no debouncing)
				// This prevents widgets from appearing in wrong positions during fast typing
				this.performIncrementalUpdate(update);
			} catch (error) {
				console.error("Error in date picker update:", error);
				this.decorations = Decoration.none;
			}
		}

		/**
		 * Perform incremental update based on changes
		 */
		private performIncrementalUpdate(update: ViewUpdate): void {
			try {
				// 1. Map existing widgets to new positions
				const mappedRegistry = this.mapExistingWidgets(update.changes);

				// 2. Get affected line numbers
				const affectedLines = getAffectedLineNumbers(
					update.state,
					update.changes
				);

				// 3. Scan affected lines for dates
				const newWidgets = this.scanLines(
					Array.from(affectedLines),
					update.view
				);

				// 4. Merge registries
				this.widgetRegistry = this.mergeWidgetMaps(
					mappedRegistry,
					newWidgets,
					affectedLines
				);

				// 5. Build decorations
				this.decorations = this.buildDecorationsFromRegistry();
			} catch (e) {
				console.warn(
					"Error in incremental update, falling back to full scan:",
					e
				);
				this.fullScan(this.view);
			}
		}

		/**
		 * Map existing widgets to new positions using ChangeSet
		 */
		private mapExistingWidgets(
			changes: ViewUpdate["changes"]
		): Map<string, WidgetInfo> {
			const mapped = new Map<string, WidgetInfo>();

			for (const [id, info] of this.widgetRegistry) {
				try {
					// Map positions
					const newFrom = changes.mapPos(info.match.from, 1);
					const newTo = changes.mapPos(info.match.to, 1);

					// Validate new position
					if (!isValidPosition(this.view.state, newFrom, newTo)) {
						continue;
					}

					// Create updated match
					const newMatch: DateMatch = {
						...info.match,
						from: newFrom,
						to: newTo,
					};

					// Update line number
					const newLine = this.view.state.doc.lineAt(newFrom);

					mapped.set(id, {
						...info,
						match: newMatch,
						lineNumber: newLine.number,
						offsetInLine: newFrom - newLine.from,
						lastValidated: Date.now(),
					});
				} catch (e) {
					// Mapping failed, discard this widget
					continue;
				}
			}

			return mapped;
		}

		/**
		 * Scan specific lines for date widgets
		 */
		private scanLines(
			lineNumbers: number[],
			view: EditorView
		): Map<string, WidgetInfo> {
			const widgets = new Map<string, WidgetInfo>();

			for (const lineNum of lineNumbers) {
				const line = safeGetLine(view.state.doc, lineNum);
				if (!line) {
					continue;
				}

				// Check if it's a task line
				const taskLine = findTaskLineAt(view.state, line.from);
				if (!taskLine) {
					continue;
				}

				// Skip code blocks and frontmatter
				if (shouldSkipRendering(view.state, line.from, line.to)) {
					continue;
				}

				// Find dates in this line
				const dates = findDatesInTaskLine(
					taskLine.text,
					taskLine.from,
					this.plugin.settings.preferMetadataFormat === "dataview"
				);

				// Create widgets for each date
				for (const match of dates) {
					const id = generateWidgetId(match, lineNum);
					const widget = new DatePickerWidget(
						app,
						plugin,
						view,
						match,
						id
					);

					widgets.set(id, {
						id,
						match,
						lineNumber: lineNum,
						offsetInLine: match.from - line.from,
						lastValidated: Date.now(),
					});
				}
			}

			return widgets;
		}

		/**
		 * Merge widget maps, with new widgets replacing old ones in affected lines
		 */
		private mergeWidgetMaps(
			mapped: Map<string, WidgetInfo>,
			newWidgets: Map<string, WidgetInfo>,
			affectedLines: Set<number>
		): Map<string, WidgetInfo> {
			const merged = new Map(mapped);

			// Remove widgets from affected lines
			for (const [id, info] of merged) {
				if (affectedLines.has(info.lineNumber)) {
					merged.delete(id);
				}
			}

			// Add new widgets
			for (const [id, info] of newWidgets) {
				merged.set(id, info);
			}

			return merged;
		}

		/**
		 * Build decoration set from widget registry
		 */
		private buildDecorationsFromRegistry(): DecorationSet {
			const decorations: Array<{
				from: number;
				to: number;
				decoration: Decoration;
			}> = [];

			for (const info of this.widgetRegistry.values()) {
				try {
					// Validate position
					if (
						!isValidPosition(
							this.view.state,
							info.match.from,
							info.match.to
						)
					) {
						continue;
					}

					// Skip if cursor is inside
					// if (!this.shouldRenderAt(info.match.from, info.match.to)) {
					// 	continue;
					// }

					// Create widget
					const widget = new DatePickerWidget(
						app,
						plugin,
						this.view,
						info.match,
						info.id
					);

					decorations.push({
						from: info.match.from,
						to: info.match.to,
						decoration: Decoration.replace({ widget }),
					});
				} catch (e) {
					console.warn("Error building decoration:", e);
					continue;
				}
			}

			// Sort by position
			decorations.sort((a, b) => a.from - b.from);

			return Decoration.set(
				decorations.map((d) => d.decoration.range(d.from, d.to)),
				true
			);
		}

		/**
		 * Full document scan (fallback)
		 */
		private fullScan(view: EditorView): void {
			this.widgetRegistry.clear();

			// Scan all lines
			const lineCount = view.state.doc.lines;
			const lineNumbers: number[] = [];
			for (let i = 1; i <= lineCount; i++) {
				lineNumbers.push(i);
			}

			this.widgetRegistry = this.scanLines(lineNumbers, view);
			this.decorations = this.buildDecorationsFromRegistry();
		}

		/**
		 * Update decorations (initial load)
		 */
		updateDecorations(view: EditorView): void {
			if (this.isDestroyed) return;

			// Only apply in live preview mode
			if (!this.isLivePreview(view.state)) {
				this.decorations = Decoration.none;
				return;
			}

			try {
				this.fullScan(view);
			} catch (e) {
				console.warn("Error updating date decorations:", e);
				this.decorations = Decoration.none;
			}
		}

		destroy(): void {
			this.isDestroyed = true;
			this.decorations = Decoration.none;
			this.widgetRegistry.clear();
		}

		isLivePreview(state: EditorView["state"]): boolean {
			try {
				return state.field(editorLivePreviewField);
			} catch (error) {
				return false;
			}
		}

		/**
		 * Check if we should render at a specific position
		 */
		shouldRenderAt(from: number, to: number): boolean {
			try {
				const selection = this.view.state.selection;
				const state = this.view.state;

				// Get the line containing this widget
				const widgetLine = state.doc.lineAt(from);

				// Don't render if cursor is anywhere on the same line
				// This prevents flickering and position errors during editing
				const cursorOnSameLine = selection.ranges.some((r) => {
					try {
						const cursorLine = state.doc.lineAt(r.from);
						return cursorLine.number === widgetLine.number;
					} catch (e) {
						return false;
					}
				});

				if (cursorOnSameLine) {
					return false;
				}

				// Additional check: don't render if cursor is very close (within 20 chars)
				const tooClose = selection.ranges.some((r) => {
					return (
						Math.abs(r.from - from) < 20 ||
						Math.abs(r.from - to) < 20
					);
				});

				if (tooClose) {
					return false;
				}

				return true;
			} catch (e) {
				return false;
			}
		}
	}

	const DatePickerViewPluginSpec: PluginSpec<DatePickerViewPluginValue> = {
		decorations: (plugin) => {
			try {
				if (plugin.isDestroyed) {
					return Decoration.none;
				}
				return plugin.decorations;
			} catch (e) {
				console.warn("Error getting decorations:", e);
				return Decoration.none;
			}
		},
	};

	// Create the plugin with our implementation
	const pluginInstance = ViewPlugin.fromClass(
		DatePickerViewPluginValue,
		DatePickerViewPluginSpec
	);

	return pluginInstance;
}
