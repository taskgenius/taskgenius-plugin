import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import type { HabitStore } from "../habit-store";
import type { HabitDefinition } from "../types";
import { applyHabitIcon } from "./icon-suggest-modal";

/**
 * Suggests habit names while typing `habits:` (or the older `habit:`)
 * inside a `habit-metrics` code block, so users can point the block at any
 * habit by name. `habits:` takes a comma-separated list, so suggestions
 * cover whichever name is being typed after the last comma.
 */
export class HabitMetricsSuggest extends EditorSuggest<HabitDefinition> {
	/** Lower-cased names already listed on the line, left out of suggestions. */
	private listed = new Set<string>();

	constructor(
		app: App,
		private store: HabitStore,
	) {
		super(app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const before = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = /^(\s*habits?\s*:)(.*)$/i.exec(before);
		if (!match || !this.inMetricsBlock(editor, cursor.line)) {
			return null;
		}
		const value = match[2];
		const lastComma = value.lastIndexOf(",");
		const segment = value.slice(lastComma + 1);
		const query = segment.trimStart();
		// The rest of the line (after the cursor) can hold names too.
		const after = editor.getLine(cursor.line).slice(cursor.ch);
		this.listed = new Set(
			[...value.slice(0, lastComma + 1).split(","), ...after.split(",")]
				.map((name) => name.trim().toLowerCase())
				.filter((name) => name !== ""),
		);
		return {
			start: {
				line: cursor.line,
				ch: match[1].length + lastComma + 1 + segment.length - query.length,
			},
			end: cursor,
			query,
		};
	}

	/** True when the nearest fence above the line opens a metrics block. */
	private inMetricsBlock(editor: Editor, lineNo: number): boolean {
		for (let i = lineNo - 1; i >= 0; i--) {
			const line = editor.getLine(i).trim();
			if (line.startsWith("```")) {
				return /^`{3,}\s*(?:tg-)?habit-metrics\s*$/.test(line);
			}
		}
		return false;
	}

	getSuggestions(context: EditorSuggestContext): HabitDefinition[] {
		const needle = context.query.toLowerCase();
		return this.store
			.getHabits()
			.filter(
				(habit) =>
					habit.name.toLowerCase().includes(needle) &&
					!this.listed.has(habit.name.toLowerCase()),
			);
	}

	renderSuggestion(habit: HabitDefinition, el: HTMLElement): void {
		const row = el.createDiv({ cls: "habits-icon-suggestion" });
		const glyph = row.createSpan({
			cls: "habits-icon-suggestion-glyph",
		});
		if (habit.icon) {
			applyHabitIcon(glyph, habit.icon);
		}
		row.createSpan({ text: habit.name });
	}

	selectSuggestion(habit: HabitDefinition): void {
		const context = this.context;
		if (!context) {
			return;
		}
		// Keep list entries readable ("A, B") when typed straight after a comma.
		const previous = context.editor
			.getLine(context.start.line)
			.charAt(context.start.ch - 1);
		const text = previous === "," || previous === ":" ? ` ${habit.name}` : habit.name;
		context.editor.replaceRange(text, context.start, context.end);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + text.length,
		});
		this.close();
	}
}
