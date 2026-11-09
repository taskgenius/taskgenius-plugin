const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const esbuild = require("esbuild");
const vault = process.argv[2];
if (!vault) throw new Error("Usage: node scripts/audit-native-points.cjs <vault> [report.json]");
const yamlDirectory = fs.readdirSync("node_modules/.pnpm").find(name => name.startsWith("js-yaml@4")) || fs.readdirSync("node_modules/.pnpm").find(name => name.startsWith("js-yaml@"));
const yaml = require(path.resolve("node_modules/.pnpm", yamlDirectory, "node_modules/js-yaml"));
function readData(file) {
	const match = fs.readFileSync(file, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? yaml.load(match[1]) || {} : {};
}
const dataPath = "99_System/01_Data/积分系统数据.md";
const panelPath = "99_System/00_Panel/CHECK - 每日打卡.md";
const data = readData(path.join(vault, dataPath));
const files = fs.readdirSync(path.join(vault, "Habits")).filter(name => name.endsWith(".md")).map(name => `Habits/${name}`);
const inputs = files.map(file => ({ name: path.basename(file, ".md"), path: file, frontmatter: readData(path.join(vault, file)) })).filter(item => item.frontmatter.habit);
const panel = fs.readFileSync(path.join(vault, panelPath), "utf8");
const helpers = panel.slice(panel.indexOf("  const toText"), panel.indexOf("  const collectHabitData"));
const builder = panel.slice(panel.indexOf("  const buildHabitSummaries"), panel.indexOf("  const { parseYaml, getFrontMatterInfo }"));
const collect = `const collectHabitData = async () => rawHabits.map(item => ({ name:item.name, path:item.path,
 type:toText(item.frontmatter.type), frequency:toText(item.frontmatter.frequency,'daily'), target:Math.max(0,toNumber(item.frontmatter.target)),
 pointRate:Object.prototype.hasOwnProperty.call(item.frontmatter,'bravoPoints')?toNumber(item.frontmatter.bravoPoints):null,
 entries:parseRecordEntries(item.frontmatter.records) }));`;
(async () => {
	const today = new Date();
	const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
	const old = await vm.runInNewContext(`(async()=>{${helpers}${collect}${builder};return await buildHabitSummaries(frontmatter,todayKey);})()`, { rawHabits: inputs, frontmatter: data, todayKey, Date, Map, Math, Number });
	const module = { exports: {} };
	vm.runInNewContext(esbuild.transformSync(fs.readFileSync("src/managers/daily-points.ts", "utf8"), { loader: "ts", format: "cjs", target: "es2020" }).code, { module, exports: module.exports, Date, Map, Set });
	const native = module.exports.calculateDailyHabitPoints(inputs, data, todayKey);
	const mismatches = native.filter(item => {
		const prior = old.find(value => value.habit === item.name);
		return !prior || prior.points !== item.points || prior.todayPoints !== item.todayPoints;
	});
	const sourceHashes = Object.fromEntries([dataPath, panelPath, ...files].map(file => [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(vault, file))).digest("hex")]));
	const report = { habits: inputs.length, habitRecords: inputs.reduce((sum, item) => sum + Object.keys(item.frontmatter.records || {}).length, 0),
		manualRecords: (data.manualPointRecords || []).length, bonusActions: (data.examplePropertyLeft || []).length, rewardWishes: (data.examplePropertyRight || []).length,
		oldHabitPoints: old.reduce((sum, item) => sum + item.points, 0), nativeHabitPoints: native.reduce((sum, item) => sum + item.points, 0),
		manualPoints: (data.manualPointRecords || []).reduce((sum, item) => sum + Number(item.points), 0), mismatches, sourceHashes };
	if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2));
	const { sourceHashes: _, ...summary } = report;
	console.log(JSON.stringify(summary));
	if (mismatches.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
