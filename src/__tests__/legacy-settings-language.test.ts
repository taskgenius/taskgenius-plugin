import { readFileSync } from "fs";
import { join } from "path";
import english from "@/translations/locale/en";
import chinese from "@/translations/locale/zh-cn";
import { translationManager } from "@/translations/manager";

describe("legacy settings language coverage", () => {
 const keys: string[] = JSON.parse(readFileSync(join(process.cwd(), "scripts/settings-i18n-keys.json"), "utf8"));
 afterEach(() => translationManager.setLocale("en"));
 it("provides both language entries for every audited settings label and preserves substitutions", () => {
  const placeholders = (value: string) => (value.match(/\{\{[^{}]+\}\}|\{[A-Za-z_][\w]*\}/g) || []).sort();
  for (const key of keys) {
   for (const dictionary of [english, chinese] as Record<string, string>[]) {
    expect(dictionary[key]).toBeTruthy();
    expect(placeholders(dictionary[key])).toEqual(placeholders(key));
   }
  }
 });
 it("renders the index and timer labels in Chinese while keeping user names in messages", () => {
  translationManager.setLocale("zh-cn");
  expect(translationManager.t("Index & Sources")).toBe("索引与来源");
  expect(translationManager.t("Enable Task Timer")).toBe("启用任务计时器");
  expect(translationManager.t("{{value0}} theme workflow", { interpolation: { value0: "My personal theme" } })).toBe("My personal theme 主题工作流");
 });
 it("keeps English available without fetching a language pack", () => {
  translationManager.setLocale("en");
  expect(translationManager.t("Enable Task Timer")).toBe("Enable Task Timer");
  expect(translationManager.t("Index & Sources")).toBe("Index & Sources");
 });
});
