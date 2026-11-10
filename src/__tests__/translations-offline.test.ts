/**
 * Translations must load entirely from the bundle: the plugin may not make
 * network requests to fetch them (offline use, no third-party traffic).
 */
const mockRequestUrl = jest.fn(() => {
	throw new Error("network access is not allowed");
});

jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	requestUrl: mockRequestUrl,
}));

import { moment } from "obsidian";
import { initializeTranslations, t } from "@/translations/helper";
import { translationManager } from "@/translations/manager";

describe("translations are bundled (no network)", () => {
	afterEach(() => {
		moment.locale("en");
	});

	afterAll(() => {
		expect(mockRequestUrl).not.toHaveBeenCalled();
	});

	it("loads a non-English locale without network access", async () => {
		moment.locale("ja");
		await initializeTranslations();

		expect(translationManager.getResolvedLocale()).toBe("ja");
		expect(t("Inherit from frontmatter")).toBe("フロントマターから継承");
	});

	it.each(translationManager.getSupportedLocales())(
		"bundles the %s locale",
		async (locale) => {
			moment.locale(locale);
			await initializeTranslations();

			// A locale that failed to load would fall back to "en".
			expect(translationManager.getResolvedLocale()).toBe(locale);
		},
	);
});
