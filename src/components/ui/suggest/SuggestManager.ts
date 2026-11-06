import { App, Editor, EditorSuggest, TFile } from "obsidian";
import TaskProgressBarPlugin from "@/index";
import { UniversalEditorSuggest, UniversalSuggestConfig } from "./UniversalEditorSuggest";

export interface SuggestManagerConfig {
	enableDynamicPriority: boolean;
	defaultTriggerChars: string[];
	contextFilters: {
		[key: string]: (editor: Editor, file: TFile) => boolean;
	};
}

/**
 * Manages dynamic suggest registration and priority in workspace
 */
export class SuggestManager {
	private app: App;
	private plugin: TaskProgressBarPlugin;
	private config: SuggestManagerConfig;
	private activeSuggests: Map<string, EditorSuggest<any>> = new Map();
	private originalSuggestsOrder: EditorSuggest<any>[] = [];
	private isManaging = false;

	constructor(app: App, plugin: TaskProgressBarPlugin, config?: Partial<SuggestManagerConfig>) {
		this.app = app;
		this.plugin = plugin;
		this.config = {
			enableDynamicPriority: true,
			defaultTriggerChars: ["!", "~", "*", "#"],
			contextFilters: {},
			...config,
		};
	}

	/**
	 * Start managing suggests with dynamic priority
	 */
	startManaging(): void {
		if (this.isManaging) return;

		this.isManaging = true;
		// Store original order for restoration
		this.originalSuggestsOrder = [...(this.app.workspace as any).editorSuggest.suggests];
	}

	/**
	 * Stop managing and restore original order
	 */
	stopManaging(): void {
		if (!this.isManaging) return;

		// Remove all our managed suggests
		this.removeAllManagedSuggests();

		// Restore original order if needed
		if (this.originalSuggestsOrder.length > 0) {
			(this.app.workspace as any).editorSuggest.suggests = [...this.originalSuggestsOrder];
		}

		this.isManaging = false;
		this.originalSuggestsOrder = [];
	}

	/**
	 * Add a suggest with high priority (insert at beginning)
	 */
	addSuggestWithPriority(suggest: EditorSuggest<any>, id: string): void {
		if (!this.isManaging) {
			console.warn("SuggestManager: Not managing, call startManaging() first");
			return;
		}

		// Remove if already exists
		this.removeManagedSuggest(id);

		// Add to our tracking
		this.activeSuggests.set(id, suggest);

		// Insert at the beginning for high priority
		(this.app.workspace as any).editorSuggest.suggests.unshift(suggest);
	}

	/**
	 * Remove a managed suggest
	 */
	removeManagedSuggest(id: string): void {
		const suggest = this.activeSuggests.get(id);
		if (!suggest) return;

		// Remove from workspace
		const index = (this.app.workspace as any).editorSuggest.suggests.indexOf(suggest);
		if (index !== -1) {
			(this.app.workspace as any).editorSuggest.suggests.splice(index, 1);
		}

		// Remove from our tracking
		this.activeSuggests.delete(id);
	}

	/**
	 * Remove all managed suggests
	 */
	removeAllManagedSuggests(): void {
		for (const [id] of this.activeSuggests) {
			this.removeManagedSuggest(id);
		}
	}

	/**
	 * Create and add a universal suggest for specific context
	 */
	createUniversalSuggest(
		contextId: string,
		config: Partial<UniversalSuggestConfig> = {}
	): UniversalEditorSuggest {
		const suggestConfig: UniversalSuggestConfig = {
			triggerChars: this.config.defaultTriggerChars,
			contextFilter: this.config.contextFilters[contextId],
			priority: 1,
			...config,
		};

		const suggest = new UniversalEditorSuggest(this.app, this.plugin, suggestConfig);
		
		// Add with priority
		this.addSuggestWithPriority(suggest, `universal-${contextId}`);
		
		return suggest;
	}

	/**
	 * Enable suggests for a specific editor context
	 */
	enableForEditor(editor: Editor, contextId = "default"): UniversalEditorSuggest {
		const suggest = this.createUniversalSuggest(contextId, {
			contextFilter: (ed, file) => ed === editor,
		});
		
		suggest.enable();
		return suggest;
	}

	/**
	 * Disable suggests for a specific context
	 */
	disableForContext(contextId: string): void {
		this.removeManagedSuggest(`universal-${contextId}`);
	}

	/**
	 * Enable suggests for minimal quick capture modal
	 */
	enableForMinimalModal(editor: Editor): UniversalEditorSuggest {
		return this.createUniversalSuggest("minimal-modal", {
			contextFilter: (ed, file) => {
				// Check if we're in a minimal quick capture context
				const editorEl = (ed as any).cm?.dom as HTMLElement;
				return editorEl?.closest(".quick-capture-modal.minimal") !== null;
			},
		});
	}

	/**
	 * Enable suggests for regular quick capture modal
	 */
	enableForQuickCaptureModal(editor: Editor): UniversalEditorSuggest {
		return this.createUniversalSuggest("quick-capture-modal", {
			contextFilter: (ed, file) => {
				// Check if we're in a quick capture context
				const editorEl = (ed as any).cm?.dom as HTMLElement;
				return editorEl?.closest(".quick-capture-modal") !== null;
			},
		});
	}

	/**
	 * Add a custom context filter
	 */
	addContextFilter(
		contextId: string,
		filter: (editor: Editor, file: TFile) => boolean
	): void {
		this.config.contextFilters[contextId] = filter;
	}

	/**
	 * Remove a context filter
	 */
	removeContextFilter(contextId: string): void {
		delete this.config.contextFilters[contextId];
	}

	/**
	 * Get all active suggests
	 */
	getActiveSuggests(): Map<string, EditorSuggest<any>> {
		return new Map(this.activeSuggests);
	}

	/**
	 * Check if currently managing
	 */
	isCurrentlyManaging(): boolean {
		return this.isManaging;
	}

	/**
	 * Get current configuration
	 */
	getConfig(): SuggestManagerConfig {
		return { ...this.config };
	}

	/**
	 * Update configuration
	 */
	updateConfig(newConfig: Partial<SuggestManagerConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Debug: Log current suggest order
	 */
	debugLogSuggestOrder(): void {
		console.log("Current suggest order:", (this.app.workspace as any).editorSuggest.suggests);
		console.log("Managed suggests:", Array.from(this.activeSuggests.keys()));
	}

	/**
	 * Cleanup method for proper disposal
	 */
	cleanup(): void {
		this.stopManaging();
		this.activeSuggests.clear();
		this.config.contextFilters = {};
	}
}
