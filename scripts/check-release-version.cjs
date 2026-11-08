const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
const expected = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version) || pkg.version !== manifest.version || versions[manifest.version] !== manifest.minAppVersion || (expected && expected !== manifest.version)) {
 console.error("Release version mismatch: package.json, manifest.json, versions.json and the release tag must agree."); process.exitCode = 1;
} else console.log("Release files agree on version " + manifest.version);
