import {
	App,
	Component,
	TFile,
	getAllTags,
	prepareFuzzySearch,
	renderResults,
	setIcon,
	type SearchResult,
} from "obsidian";

/**
 * Autocomplete for the day-comment textarea.
 *
 * Obsidian's own `EditorSuggest` only attaches to CodeMirror editors and
 * `AbstractInputSuggest` only to `<input>`/contenteditable, so neither can
 * drive a `<textarea>`. This is a small standalone popup that watches the
 * caret, offers vault tags after `#` and note names after `[[`, and
 * splices the choice back into the text.
 */

/** How many rows the popup shows at once. */
const MAX_SUGGESTIONS = 20;

/** What the caret is currently sitting in. */
type TriggerKind = "tag" | "link";

interface Trigger {
	kind: TriggerKind;
	/** Index of the trigger character (`#` or the first `[`). */
	start: number;
	/** Text typed after the trigger, up to the caret. */
	query: string;
}

interface Suggestion {
	/** Text inserted, excluding the trigger and any closing brackets. */
	value: string;
	/** Row label. */
	label: string;
	/** Dimmer second line, such as a folder path. */
	detail: string;
	match: SearchResult | null;
}

/** Detect a `#tag` or `[[link` in progress immediately before the caret. */
function findTrigger(text: string, caret: number): Trigger | null {
	const before = text.slice(0, caret);

	// `[[` wins over `#` because a link alias may itself contain a hash.
	const openLink = before.lastIndexOf("[[");
	if (openLink !== -1) {
		const inner = before.slice(openLink + 2);
		if (!inner.includes("]]") && !inner.includes("\n")) {
			return { kind: "link", start: openLink, query: inner };
		}
	}

	const hash = before.lastIndexOf("#");
	if (hash !== -1) {
		const inner = before.slice(hash + 1);
		if (/^[\w/\-_À-￿]*$/u.test(inner)) {
			const prev = hash > 0 ? before[hash - 1] : " ";
			if (/\s/.test(prev) || hash === 0) {
				return { kind: "tag", start: hash, query: inner };
			}
		}
	}
	return null;
}

/**
 * Attaches to one textarea for its lifetime. Create it alongside the
 * textarea and register it on the owning component so the popup and its
 * listeners are torn down with the view.
 */
export class CommentSuggest extends Component {
	private popup: HTMLElement | null = null;
	private items: Suggestion[] = [];
	private active = 0;
	private trigger: Trigger | null = null;
	private tagCache: string[] | null = null;

	constructor(
		private app: App,
		private input: HTMLTextAreaElement,
	) {
		super();
	}

	override onload(): void {
		this.registerDomEvent(this.input, "input", () => this.refresh());
		this.registerDomEvent(this.input, "click", () => this.refresh());
		this.registerDomEvent(this.input, "keydown", (event) =>
			this.onKeyDown(event),
		);
		this.registerDomEvent(this.input, "blur", () => {
			// Let a click on a row land before the popup disappears.
			window.setTimeout(() => this.close(), 120);
		});
		this.registerEvent(
			this.app.metadataCache.on("changed", () => {
				this.tagCache = null;
			}),
		);
	}

	override onunload(): void {
		this.close();
	}

	/** True while the popup is showing, so callers can defer their own keys. */
	get isOpen(): boolean {
		return this.popup !== null;
	}

	private onKeyDown(event: KeyboardEvent): void {
		if (!this.popup) {
			return;
		}
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				this.move(1);
				return;
			case "ArrowUp":
				event.preventDefault();
				this.move(-1);
				return;
			case "Enter":
			case "Tab":
				event.preventDefault();
				event.stopPropagation();
				this.apply(this.items[this.active]);
				return;
			case "Escape":
				event.preventDefault();
				event.stopPropagation();
				this.close();
				return;
			default:
		}
	}

	/** Re-evaluate the caret and show, update or hide the popup. */
	private refresh(): void {
		const trigger = findTrigger(
			this.input.value,
			this.input.selectionStart ?? 0,
		);
		if (!trigger) {
			this.close();
			return;
		}
		this.trigger = trigger;
		this.items =
			trigger.kind === "tag"
				? this.tagSuggestions(trigger.query)
				: this.linkSuggestions(trigger.query);
		if (this.items.length === 0) {
			this.close();
			return;
		}
		this.active = 0;
		this.render();
	}

	/** Every tag in the vault, cached until the metadata cache changes. */
	private allTags(): string[] {
		if (this.tagCache) {
			return this.tagCache;
		}
		const tags = new Set<string>();
		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file);
			for (const tag of (cache && getAllTags(cache)) ?? []) {
				tags.add(tag.replace(/^#/, ""));
			}
		}
		this.tagCache = [...tags].sort((a, b) => a.localeCompare(b));
		return this.tagCache;
	}

	private tagSuggestions(query: string): Suggestion[] {
		const score = prepareFuzzySearch(query);
		const out: Suggestion[] = [];
		for (const tag of this.allTags()) {
			const match = query === "" ? null : score(tag);
			if (query !== "" && !match) {
				continue;
			}
			out.push({ value: tag, label: tag, detail: "", match });
		}
		this.sortByScore(out);
		return out.slice(0, MAX_SUGGESTIONS);
	}

	private linkSuggestions(query: string): Suggestion[] {
		// Only the part before a `|` alias is used for matching.
		const needle = query.split("|")[0];
		const score = prepareFuzzySearch(needle);
		const out: Suggestion[] = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const match = needle === "" ? null : score(file.basename);
			if (needle !== "" && !match) {
				continue;
			}
			out.push({
				value: this.linkTextFor(file),
				label: file.basename,
				detail: file.parent?.path === "/" ? "" : (file.parent?.path ?? ""),
				match,
			});
		}
		this.sortByScore(out);
		return out.slice(0, MAX_SUGGESTIONS);
	}

	/** Shortest unambiguous link text, matching Obsidian's own linker. */
	private linkTextFor(file: TFile): string {
		return this.app.metadataCache.fileToLinktext(file, this.sourcePath(), true);
	}

	private sourcePath(): string {
		return this.app.workspace.getActiveFile()?.path ?? "";
	}

	private sortByScore(items: Suggestion[]): void {
		items.sort((a, b) => {
			const scoreA = a.match?.score ?? 0;
			const scoreB = b.match?.score ?? 0;
			if (scoreA !== scoreB) {
				return scoreB - scoreA;
			}
			return a.label.localeCompare(b.label);
		});
	}

	private move(delta: number): void {
		this.active =
			(this.active + delta + this.items.length) % this.items.length;
		this.render();
	}

	private render(): void {
		if (!this.popup) {
			this.popup = document.body.createDiv({
				cls: "habits-comment-suggest suggestion-container tg-habits-surface",
			});
		}
		this.popup.empty();
		const list = this.popup.createDiv({ cls: "suggestion" });
		this.items.forEach((item, index) => {
			const row = list.createDiv({
				cls: "suggestion-item habits-comment-suggest-item",
			});
			row.toggleClass("is-selected", index === this.active);
			const icon = row.createSpan({ cls: "habits-comment-suggest-icon" });
			setIcon(icon, this.trigger?.kind === "tag" ? "hash" : "file-text");
			const body = row.createDiv({ cls: "habits-comment-suggest-body" });
			const title = body.createDiv({ cls: "habits-comment-suggest-title" });
			if (item.match) {
				renderResults(title, item.label, item.match);
			} else {
				title.setText(item.label);
			}
			if (item.detail) {
				body.createDiv({
					cls: "habits-comment-suggest-detail",
					text: item.detail,
				});
			}
			row.addEventListener("mousedown", (event) => {
				// Fires before blur, so the textarea keeps focus.
				event.preventDefault();
				this.apply(item);
			});
			row.addEventListener("mouseenter", () => {
				this.active = index;
				this.paintSelection();
			});
		});
		this.position();
	}

	private paintSelection(): void {
		const rows = this.popup?.querySelectorAll(".suggestion-item");
		rows?.forEach((row, index) => {
			row.toggleClass("is-selected", index === this.active);
		});
	}

	/** Anchor the popup under the textarea, flipping up when short on room. */
	private position(): void {
		if (!this.popup) {
			return;
		}
		const box = this.input.getBoundingClientRect();
		const height = this.popup.offsetHeight;
		const below = window.innerHeight - box.bottom;
		const top =
			below < height && box.top > height ? box.top - height - 4 : box.bottom + 4;
		this.popup.setCssProps({
			"--habits-suggest-top": `${Math.max(4, top)}px`,
			"--habits-suggest-left": `${box.left}px`,
			"--habits-suggest-width": `${Math.max(box.width, 220)}px`,
		});
	}

	/** Splice the chosen value into the textarea and close the popup. */
	private apply(item: Suggestion | undefined): void {
		const trigger = this.trigger;
		if (!item || !trigger) {
			return;
		}
		const text = this.input.value;
		const caret = this.input.selectionStart ?? text.length;
		// A `|alias` the user already typed survives the completion.
		const alias =
			trigger.kind === "link" && trigger.query.includes("|")
				? `|${trigger.query.slice(trigger.query.indexOf("|") + 1)}`
				: "";
		const inserted =
			trigger.kind === "tag"
				? `#${item.value} `
				: `[[${item.value}${alias}]]`;
		// Swallow a closing `]]` the user (or the editor) already typed.
		const after = text.slice(caret);
		const skip =
			trigger.kind === "link" && after.startsWith("]]") ? 2 : 0;
		this.input.value =
			text.slice(0, trigger.start) + inserted + after.slice(skip);
		const cursor = trigger.start + inserted.length;
		this.input.setSelectionRange(cursor, cursor);
		this.input.dispatchEvent(new Event("input", { bubbles: true }));
		this.close();
		this.input.focus();
	}

	private close(): void {
		this.popup?.remove();
		this.popup = null;
		this.items = [];
		this.trigger = null;
	}
}
