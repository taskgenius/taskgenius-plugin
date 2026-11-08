const fs = require('node:fs');
const path = require('node:path');
const roots = ['src', 'packages/calendar/src', 'scripts', 'tests', '.github/workflows'];
const signals = {
  timer: /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(/g,
  directDomListener: /\.addEventListener\s*\(/g,
  htmlAssignment: /\.innerHTML\s*=/g,
  dynamicEvaluation: /\b(?:eval\s*\(|new\s+Function\s*\()/g,
  directNoteWrite: /(?:this\.)?vault\.modify\s*\(/g,
  weakRandom: /Math\.random\s*\(/g,
};
const files=[];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file=path.join(directory, entry.name);
    if(entry.isDirectory())visit(file);
    else if(/\.(?:ts|tsx|js|mjs|cjs|css|yml|yaml)$/.test(file)) {
      const text=fs.readFileSync(file,'utf8');
      const counts=Object.fromEntries(Object.entries(signals).map(([name,pattern])=>[name,[...text.matchAll(pattern)].length]).filter(([,count])=>count));
      files.push({path:file.replace(/\\/g,'/'),lines:text.split(/\r?\n/).length,bytes:Buffer.byteLength(text),test:/__tests__|\.test\./.test(file),signals:counts});
    }
  }
}
roots.forEach(visit);
files.sort((a,b)=>a.path.localeCompare(b.path));
const report={
  purpose:'Repository-wide static review inventory. Signals are review prompts, not confirmed bugs.',
  roots,
  totals:{files:files.length,lines:files.reduce((sum,file)=>sum+file.lines,0),testFiles:files.filter(file=>file.test).length,typescriptFiles:files.filter(file=>/\.tsx?$/.test(file.path)).length},
  files,
};
fs.writeFileSync('docs/audit-2026-11-08-inventory.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.totals));
