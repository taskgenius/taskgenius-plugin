const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const vm = require("vm");

function locale(name) {
 const filename = path.join("src/translations/locale", name + ".ts");
 const js = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
 const context = { exports: {} }; vm.runInNewContext(js, context); return context.exports.default;
}
function settingsKeys() {
 const keys = new Set(JSON.parse(fs.readFileSync("scripts/settings-i18n-keys.json", "utf8")));
 function visitFile(filename) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node) {
   if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ["t", "settingsText"].includes(node.expression.text) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) keys.add(node.arguments[0].text);
   ts.forEachChild(node, visit);
  } visit(source);
 }
 function directory(folder) { for (const entry of fs.readdirSync(folder, { withFileTypes: true })) { const file = path.join(folder, entry.name); if (entry.isDirectory()) directory(file); else if (/\.tsx?$/.test(file)) visitFile(file); } }
 directory("src/components/features/settings"); visitFile("src/setting.ts"); return [...keys];
}
const en = locale("en"), zh = locale("zh-cn"), keys = settingsKeys();
const tokens = text => (text.match(/\{\{[^{}]+\}\}|\{[A-Za-z_][\w]*\}/g) || []).sort().join("|");
const errors = [];
for (const key of keys) {
 for (const [name, dictionary] of [["en", en], ["zh-cn", zh]]) {
  if (typeof dictionary[key] !== "string" || !dictionary[key].trim()) errors.push(name + ": missing " + key);
  else if (tokens(key) !== tokens(dictionary[key])) errors.push(name + ": placeholder mismatch " + key);
 }
}
if (errors.length) { console.error(errors.slice(0, 25).join("\n")); console.error(errors.length + " settings translation errors"); process.exitCode = 1; }
else console.log("Settings coverage: " + keys.length + " English/Chinese keys; interpolation placeholders match.");
