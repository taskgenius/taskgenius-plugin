import { moment } from "obsidian";
import { translationManager, type SupportedLocale, type TranslationLoader } from "./manager";
import type { Translation } from "./types";
export type { TranslationKey } from "./types";

// All locale tables are bundled into main.js so translations work fully
// offline. The plugin never downloads translations at runtime.
import en from "./locale/en";
import enGB from "./locale/en-gb";
import ja from "./locale/ja";
import ptBR from "./locale/pt-br";
import ru from "./locale/ru";
import uk from "./locale/uk";
import zhCN from "./locale/zh-cn";
import zhTW from "./locale/zh-tw";

const BUNDLED_TRANSLATIONS: Record<SupportedLocale, Translation> = {
	en,
	"en-gb": enGB,
	ja,
	"pt-br": ptBR,
	ru,
	uk,
	"zh-cn": zhCN,
	"zh-tw": zhTW,
};

const loadTranslation: TranslationLoader = async (locale) => {
	const translation = BUNDLED_TRANSLATIONS[locale];
	if (!translation) {
		throw new Error(`No bundled translations for ${locale}`);
	}
	return translation;
};

export async function initializeTranslations(): Promise<void> {
	const currentLocale = moment.locale();
	await translationManager.initializeLocale(currentLocale, loadTranslation);
}

export const t = translationManager.t.bind(translationManager);
