import {
	App,
	FuzzyMatch,
	FuzzySuggestModal,
	getIconIds,
	setIcon,
} from "obsidian";
import { t } from "../i18n";

/**
 * Fuzzy-search modal for picking a built-in Lucide icon.
 *
 * Uses `getIconIds()` so every icon shown is guaranteed to render with
 * `setIcon()` elsewhere in the plugin.
 */
export class IconSuggestModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private onChoose: (icon: string) => void,
	) {
		super(app);
		this.modalEl.addClass("tg-habits-surface");
		this.setPlaceholder(t("Search icons…"));
		this.limit = 150;
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(item: string): string {
		// Include the readable label so fuzzy search matches spaced words too.
		return `${item} ${iconLabel(item)}`;
	}

	renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement): void {
		el.addClass("habits-icon-suggestion");
		const glyph = el.createSpan({ cls: "habits-icon-suggestion-glyph" });
		setIcon(glyph, match.item);
		el.createSpan({
			cls: "habits-icon-suggestion-name",
			text: iconLabel(match.item),
		});
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
	}
}

/** Turn an icon id such as "lucide-arrow-up" into a label like "Arrow up". */
export function iconLabel(iconId: string): string {
	const spaced = iconId.replace(/^lucide-/, "").replace(/-/g, " ");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** True when the value is a Lucide icon id rather than an emoji. */
export function isLucideIcon(icon: string): boolean {
	return /^[a-z0-9-]+$/.test(icon);
}

/** Render a habit icon — a Lucide id via setIcon, or an emoji as text. */
export function applyHabitIcon(el: HTMLElement, icon: string): void {
	el.empty();
	if (isLucideIcon(icon)) {
		setIcon(el, icon);
	} else {
		el.setText(icon);
	}
}
