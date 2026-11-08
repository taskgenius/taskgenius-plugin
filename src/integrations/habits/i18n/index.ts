import { moment } from "obsidian";
import { es } from "./es";
import { fr } from "./fr";
import { de } from "./de";
import { zh } from "./zh";
import { ja } from "./ja";
import { ko } from "./ko";

const LOCALES: Record<string, Record<string, string>> = {
	es,
	fr,
	de,
	zh,
	ja,
	ko,
};

/** Resolve the active dictionary from Obsidian's language setting. */
function dictionary(): Record<string, string> | null {
	const lang = moment.locale();
	if (lang.startsWith("zh")) {
		// Only Simplified Chinese is bundled; Traditional falls back to
		// English rather than showing Simplified text.
		return lang === "zh-tw" ? null : LOCALES.zh;
	}
	return LOCALES[lang.split("-")[0]] ?? null;
}

/**
 * Translate an English source string, interpolating `{placeholders}`.
 *
 * The English text itself is the lookup key (i18next-style natural keys),
 * so any string missing from a dictionary safely falls back to English.
 */
export function t(
	text: string,
	vars?: Record<string, string | number>,
): string {
	return interpolate(dictionary()?.[text] ?? text, vars);
}

/** Interpolate placeholders without translating (English source text). */
export function tEn(
	text: string,
	vars?: Record<string, string | number>,
): string {
	return interpolate(text, vars);
}

function interpolate(
	text: string,
	vars?: Record<string, string | number>,
): string {
	let out = text;
	if (vars) {
		for (const [key, value] of Object.entries(vars)) {
			out = out.split(`{${key}}`).join(String(value));
		}
	}
	return out;
}
