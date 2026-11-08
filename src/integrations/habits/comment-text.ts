import { App, Component } from "obsidian";

/**
 * Parsing and rendering for the rich bits of a day comment: Obsidian
 * tags (`#tag`) and internal links (`[[Note]]` / `[[Note|alias]]`).
 *
 * Comments live inside frontmatter, so they are stored as plain strings
 * and only interpreted when we render them on a card.
 */

/** One piece of a parsed comment. */
export type CommentToken =
	| { kind: "text"; text: string }
	| { kind: "tag"; text: string; tag: string }
	| { kind: "link"; text: string; target: string; alias: string };

/**
 * Matches a tag or a wiki link.
 *
 * Tags follow Obsidian's rules: they start with `#`, must contain at
 * least one non-numeric character, and may nest with `/`. A tag only
 * counts when it is not glued to the end of a preceding word, which the
 * caller checks via the character before the match.
 */
const TOKEN_RE = /\[\[([^\][|]+)(?:\|([^\][]*))?\]\]|#([\w/\-_À-￿]+)/gu;

/** True when `raw` (without `#`) is a usable Obsidian tag. */
function isTagBody(raw: string): boolean {
	// Purely numeric tags are not valid in Obsidian, and a trailing or
	// leading slash makes for an empty nesting level.
	if (raw === "" || /^[\d/]+$/.test(raw)) {
		return false;
	}
	return !raw.startsWith("/") && !raw.endsWith("/");
}

/** Split comment text into plain runs, tags and links. */
export function parseComment(text: string): CommentToken[] {
	const tokens: CommentToken[] = [];
	let last = 0;
	TOKEN_RE.lastIndex = 0;

	const pushText = (upto: number): void => {
		if (upto > last) {
			tokens.push({ kind: "text", text: text.slice(last, upto) });
		}
	};

	let match: RegExpExecArray | null;
	while ((match = TOKEN_RE.exec(text)) !== null) {
		const [whole, linkTarget, linkAlias, tagBody] = match;
		if (tagBody !== undefined) {
			const before = match.index > 0 ? text[match.index - 1] : " ";
			if (!/\s|^$/.test(before) || !isTagBody(tagBody)) {
				continue;
			}
			pushText(match.index);
			tokens.push({ kind: "tag", text: whole, tag: tagBody });
		} else {
			const target = linkTarget.trim();
			if (target === "") {
				continue;
			}
			pushText(match.index);
			tokens.push({
				kind: "link",
				text: whole,
				target,
				alias: (linkAlias ?? "").trim() || target,
			});
		}
		last = match.index + whole.length;
	}
	pushText(text.length);
	return tokens;
}

/** Every distinct tag (without the leading `#`) used in a comment. */
export function tagsInComment(text: string): string[] {
	const seen = new Set<string>();
	for (const token of parseComment(text)) {
		if (token.kind === "tag") {
			seen.add(token.tag);
		}
	}
	return [...seen];
}

/** Every distinct tag used across a whole `comments` map. */
export function tagsInComments(comments: Record<string, string>): Set<string> {
	const all = new Set<string>();
	for (const text of Object.values(comments)) {
		for (const tag of tagsInComment(text)) {
			all.add(tag);
		}
	}
	return all;
}

/** True when the comment holds at least one tag or link. */
export function hasRichTokens(text: string): boolean {
	return parseComment(text).some((token) => token.kind !== "text");
}

/** Options for {@link renderComment}. */
export interface RenderCommentOptions {
	/** Note path the links are resolved relative to. */
	sourcePath: string;
	/** Component the hover-preview listeners are tied to. */
	component: Component;
}

/**
 * Render a comment into `el` with clickable tag chips and internal
 * links. Links open the target note and support Obsidian's hover
 * preview; tags open the search pane filtered to that tag.
 */
export function renderComment(
	app: App,
	el: HTMLElement,
	text: string,
	options: RenderCommentOptions,
): void {
	el.empty();
	for (const token of parseComment(text)) {
		if (token.kind === "text") {
			el.appendText(token.text);
			continue;
		}

		if (token.kind === "tag") {
			const chip = el.createEl("a", {
				cls: "habits-comment-tag",
				text: `#${token.tag}`,
				href: `#${token.tag}`,
			});
			chip.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				openTagSearch(app, token.tag);
			});
			continue;
		}

		const link = el.createEl("a", {
			cls: "habits-comment-link internal-link",
			text: token.alias,
			href: token.target,
		});
		link.dataset.href = token.target;
		const resolved = app.metadataCache.getFirstLinkpathDest(
			token.target,
			options.sourcePath,
		);
		if (!resolved) {
			link.addClass("is-unresolved");
		}
		link.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			void app.workspace.openLinkText(
				token.target,
				options.sourcePath,
				event.ctrlKey || event.metaKey,
			);
		});
		options.component.registerDomEvent(link, "mouseover", (event) => {
			(app.workspace as unknown as {trigger(name: string, event: unknown): void}).trigger("hover-link", {
				event,
				source: "tg-habits",
				hoverParent: options.component,
				targetEl: link,
				linktext: token.target,
				sourcePath: options.sourcePath,
			});
		});
	}
}

/** Open the search pane filtered to a tag, mirroring the tag pane. */
function openTagSearch(app: App, tag: string): void {
	const search = app.workspace.getLeavesOfType("search")[0];
	const query = `tag:#${tag}`;
	if (search) {
		const view = search.view as unknown as {
			setQuery?: (value: string) => void;
		};
		if (typeof view.setQuery === "function") {
			void app.workspace.revealLeaf(search);
			view.setQuery(query);
			return;
		}
	}
	const globalSearch = (
		app as unknown as {
			internalPlugins?: {
				getPluginById?: (id: string) => {
					instance?: { openGlobalSearch?: (q: string) => void };
				} | null;
			};
		}
	).internalPlugins?.getPluginById?.("global-search");
	globalSearch?.instance?.openGlobalSearch?.(query);
}
