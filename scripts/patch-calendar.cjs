// Keep local fixes reproducible without requiring a commit to the upstream submodule.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const patches = require("../patches/calendar-layout.json");
const check = process.argv.includes("--check");
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
let changed = 0;
for (const patch of patches.files) {
 const file = path.join(__dirname, "..", "packages", "calendar", patch.file);
 let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
 if (hash(source) === patch.result) continue;
 if (check) throw new Error("Calendar fixes are missing. Run pnpm build:release: " + patch.file);
 if (hash(source) !== patch.baseline) throw new Error("Calendar source changed; review the layout patch before rebuilding: " + patch.file);
 for (const step of patch.steps) {
  const index = source.indexOf(step.before);
  if (index < 0 || source.indexOf(step.before, index + 1) >= 0) throw new Error("Ambiguous calendar patch: " + patch.file);
  source = source.slice(0, index) + step.after + source.slice(index + step.before.length);
 }
 if (hash(source) !== patch.result) throw new Error("Calendar patch verification failed: " + patch.file);
 fs.writeFileSync(file, source); changed++;
}
console.log(`Calendar fixes verified (${changed} files patched).`);
