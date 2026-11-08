/**
 * Day comments stored as a list in the note body.
 *
 * Frontmatter cannot carry tags or links that Obsidian will index — it
 * only reads tags from the `tags` property and from the body — so the
 * comments live in a marked-off section of the note instead:
 *
 * ```markdown
 * %%habits-log%%
 * - **2026-08-05** — Ran 5k #fitness with [[Marathon Plan]]
 * - **2026-08-04** — Rest day #recovery
 * %%/habits-log%%
 * ```
 *
 * The markers are Obsidian comments, so they vanish in reading view
 * while the list itself renders, stays editable by hand, and is indexed
 * like any other note content.
 */

/** Opening marker for the managed section. */
export const LOG_START = "%%habits-log%%";
/** Closing marker for the managed section. */
export const LOG_END = "%%/habits-log%%";

/**
 * One log entry.
 *
 * Parsing is deliberately forgiving so an entry the user has reformatted
 * by hand still round-trips: the bullet may be `-` or `*`, the date may
 * be bold and/or a `[[wiki link]]`, and the separator may be any dash or
 * a colon. Writing always uses the canonical form.
 */
const ENTRY_RE =
	/^[ \t]*[-*][ \t]+(?:\*\*)?(?:\[\[)?(\d{4}-\d{2}-\d{2})(?:\]\])?(?:\*\*)?[ \t]*(?:[—–:-][ \t]*)?(.*)$/;

/** Canonical rendering of a single entry, including any extra lines. */
function formatEntry(dateKey: string, text: string): string {
	const [first = "", ...rest] = text.split("\n");
	// Continuation lines are indented so Markdown keeps them in the item.
	const tail = rest.map((line) => `  ${line}`);
	return [`- **${dateKey}** — ${first}`, ...tail].join("\n");
}

/** Locate the managed section, if the note has one. */
function findSection(
	lines: string[],
): { start: number; end: number } | null {
	const start = lines.findIndex((line) => line.trim() === LOG_START);
	if (start === -1) {
		return null;
	}
	const end = lines.findIndex(
		(line, index) => index > start && line.trim() === LOG_END,
	);
	return end === -1 ? null : { start, end };
}

/** Read the day comments out of a note's raw contents. */
export function parseCommentLog(content: string): Record<string, string> {
	const lines = content.split("\n");
	const section = findSection(lines);
	if (!section) {
		return {};
	}

	const comments: Record<string, string> = {};
	let current: string | null = null;
	for (let i = section.start + 1; i < section.end; i++) {
		const line = lines[i];
		const match = ENTRY_RE.exec(line);
		if (match) {
			current = match[1];
			comments[current] = match[2].trim();
			continue;
		}
		// An indented line continues the entry above it; anything else
		// (including a blank line) ends it.
		if (current && /^[ \t]+\S/.test(line)) {
			comments[current] = `${comments[current]}\n${line.trim()}`.trim();
			continue;
		}
		current = null;
	}

	// Entries left empty by a hand edit are treated as absent.
	for (const [key, value] of Object.entries(comments)) {
		if (value === "") {
			delete comments[key];
		}
	}
	return comments;
}

/** True when the note already carries a managed section. */
export function hasCommentLog(content: string): boolean {
	return findSection(content.split("\n")) !== null;
}

/**
 * Return `content` with its managed section replaced by `comments`,
 * newest day first. An empty map removes the section entirely.
 *
 * If the note opens a frontmatter block that is never closed the content
 * is returned untouched, rather than risk appending inside it.
 */
export function applyCommentLog(
	content: string,
	comments: Record<string, string>,
): string {
	const lines = content.split("\n");
	const section = findSection(lines);

	const entries = Object.keys(comments)
		.filter((key) => comments[key].trim() !== "")
		.sort((a, b) => b.localeCompare(a))
		.map((key) => formatEntry(key, comments[key].trim()));

	if (section) {
		if (entries.length === 0) {
			// Drop the section and the blank line that padded it.
			const before = lines.slice(0, section.start);
			const after = lines.slice(section.end + 1);
			while (before.length > 0 && before[before.length - 1] === "") {
				before.pop();
			}
			while (after.length > 0 && after[0] === "") {
				after.shift();
			}
			const body = [...before, ...(after.length > 0 ? [""] : []), ...after];
			return `${body.join("\n").replace(/\n+$/, "")}\n`;
		}
		return [
			...lines.slice(0, section.start + 1),
			...entries,
			...lines.slice(section.end),
		].join("\n");
	}

	if (entries.length === 0) {
		return content;
	}
	if (!frontmatterIsClosed(lines)) {
		return content;
	}

	const body = content.replace(/\s+$/, "");
	const block = [LOG_START, ...entries, LOG_END].join("\n");
	return body === "" ? `${block}\n` : `${body}\n\n${block}\n`;
}

/** False only when the note starts a `---` block it never closes. */
function frontmatterIsClosed(lines: string[]): boolean {
	if (lines[0]?.trim() !== "---") {
		return true;
	}
	return lines.slice(1).some((line) => line.trim() === "---");
}
