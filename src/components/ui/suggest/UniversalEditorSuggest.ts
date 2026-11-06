import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
	setIcon,
} from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { t } from "@/translations/helper";
import { getSuggestOptionsByTrigger } from "./SpecialCharacterSuggests";
import "@/styles/universal-suggest.scss";

export interface SuggestOption {
	id: string;
	label: string;
	icon: string;
	description: string;
	replacement: string;
	trigger: string;
	action?: (editor: Editor, cursor: EditorPosition) => void;
}

export interface UniversalSuggestConfig {
	triggerChars: string[];
	contextFilter?: (editor: Editor, file: TFile) => boolean;
	priority?: number;
}

/**
 * Universal EditorSuggest that handles multiple special characters
 * and provides dynamic priority management
 */
export class UniversalEditorSuggest extends EditorSuggest<SuggestOption> {
	plugin: TaskProgressBarPlugin;
	private config: UniversalSuggestConfig;
	private suggestOptions: SuggestOption[] = [];
	private isEnabled = false;

	constructor(
		app: App,
		plugin: TaskProgressBarPlugin,
		config: UniversalSuggestConfig
	) {
		super(app);
		this.plugin = plugin;
		this.config = config;
		this.initializeSuggestOptions();
	}

	/**
	 * Initialize suggest options for all supported special characters
	 */
	private initializeSuggestOptions(): void {
		// Initialize with empty array - options will be loaded dynamically
		this.suggestOptions = [];
	}

	/**
	 * Enable this suggest instance
	 */
	enable(): void {
		this.isEnabled = true;
	}

	/**
	 * Disable this suggest instance
	 */
	disable(): void {
		this.isEnabled = false;
	}

	/**
	 * Check if suggestion should be triggered
	 */
	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile
	): EditorSuggestTriggerInfo | null {
		// Only trigger if enabled
		if (!this.isEnabled) {
			return null;
		}

		// Apply context filter if provided
		if (
			this.config.contextFilter &&
			!this.config.contextFilter(editor, file)
		) {
			return null;
		}

		// Get the current line
		const line = editor.getLine(cursor.line);

		// Check if cursor is right after any of our trigger characters
		if (cursor.ch > 0) {
			const charBefore = line.charAt(cursor.ch - 1);
			if (this.config.triggerChars.includes(charBefore)) {
				return {
					start: { line: cursor.line, ch: cursor.ch - 1 },
					end: cursor,
					query: charBefore,
				};
			}
		}

		return null;
	}

	/**
	 * Get suggestions based on the trigger character
	 */
	getSuggestions(context: EditorSuggestContext): SuggestOption[] {
		const triggerChar = context.query;
		// Get dynamic suggestions based on trigger character
		return getSuggestOptionsByTrigger(triggerChar, this.plugin);
	}

	/**
	 * Render suggestion in the popup
	 */
	renderSuggestion(suggestion: SuggestOption, el: HTMLElement): void {
		const container = el.createDiv({ cls: "universal-suggest-item" });

		// Icon
		container.createDiv({ cls: "universal-suggest-container" },(el)=>{
			const icon = el.createDiv({ cls: "universal-suggest-icon" });
			setIcon(icon, suggestion.icon);

			el.createDiv({
				cls: "universal-suggest-label",
				text: suggestion.label,
			});
		});

		
	}

	/**
	 * Handle suggestion selection
	 */
	selectSuggestion(
		suggestion: SuggestOption,
		evt: MouseEvent | KeyboardEvent
	): void {
		const editor = this.context?.editor;
		const cursor = this.context?.end;

		if (!editor || !cursor) return;

		// Replace the trigger character with the replacement
		const startPos = { line: cursor.line, ch: cursor.ch - 1 };
		const endPos = cursor;

		editor.replaceRange(suggestion.replacement, startPos, endPos);

		// Move cursor to after the replacement
		const newCursor = {
			line: cursor.line,
			ch: cursor.ch - 1 + suggestion.replacement.length,
		};
		editor.setCursor(newCursor);

		// Execute custom action if provided
		if (suggestion.action) {
			suggestion.action(editor, newCursor);
		}
	}

	/**
	 * Add a custom suggest option
	 */
	addSuggestOption(option: SuggestOption): void {
		this.suggestOptions.push(option);
		if (!this.config.triggerChars.includes(option.trigger)) {
			this.config.triggerChars.push(option.trigger);
		}
	}

	/**
	 * Remove a suggest option by id
	 */
	removeSuggestOption(id: string): void {
		this.suggestOptions = this.suggestOptions.filter(
			(option) => option.id !== id
		);
	}

	/**
	 * Get current configuration
	 */
	getConfig(): UniversalSuggestConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<UniversalSuggestConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}
}
