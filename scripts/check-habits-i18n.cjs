const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const base = 'src/integrations/habits';
const sources = [];
function discover(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) { if (name !== 'i18n') discover(file); }
    else if (name.endsWith('.ts')) sources.push(file);
  }
}
discover(base);
sources.push('src/components/features/habit/habit.ts', 'src/components/features/settings/tabs/HabitSettingsTab.ts');
const keys = new Set();
for (const file of sources) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visitCall = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (path.resolve(file).startsWith(path.resolve(base)) ? ['t', 'ht'] : ['ht']).includes(node.expression.text)
        && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) keys.add(node.arguments[0].text);
    ts.forEachChild(node, visitCall);
  };
  visitCall(tree);
}
const tree = ts.createSourceFile('zh.ts', fs.readFileSync(`${base}/i18n/zh.ts`, 'utf8'), ts.ScriptTarget.Latest, true);
const dictionary = new Map();
const visitProperty = node => {
  if (ts.isPropertyAssignment(node) && (ts.isStringLiteralLike(node.name) || ts.isIdentifier(node.name)) && ts.isStringLiteralLike(node.initializer)) {
    dictionary.set(node.name.text, node.initializer.text);
  }
  ts.forEachChild(node, visitProperty);
};
visitProperty(tree);
const missing = [...keys].filter(key => !dictionary.has(key));
const placeholders = text => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort().join(',');
const invalid = [...keys].filter(key => dictionary.has(key) && placeholders(key) !== placeholders(dictionary.get(key)));
if (missing.length || invalid.length) {
  console.error(JSON.stringify({missing, invalid}, null, 2));
  process.exitCode = 1;
} else console.log(`Habits: ${keys.size} English/Chinese strings and placeholders verified.`);
