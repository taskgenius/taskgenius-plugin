import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('calendar patches rebuild the pinned upstream source, are idempotent, and reject unknown changes',async()=>{
 const directory=await fs.mkdtemp(path.join(tmpdir(),'tg-calendar-patch-'));
 try{
 const patch=JSON.parse(await fs.readFile('patches/calendar-layout.json','utf8'));
 await fs.mkdir(path.join(directory,'scripts'),{recursive:true});await fs.mkdir(path.join(directory,'patches'),{recursive:true});
 await fs.copyFile('scripts/patch-calendar.cjs',path.join(directory,'scripts/patch-calendar.cjs'));await fs.copyFile('patches/calendar-layout.json',path.join(directory,'patches/calendar-layout.json'));
 for(const file of patch.files){let original=(await fs.readFile(path.join('packages/calendar',file.file),'utf8')).replace(/\r\n/g,'\n');for(const step of [...file.steps].reverse())original=original.replace(step.after,step.before);assert.equal(createHash('sha256').update(original).digest('hex'),file.baseline);const target=path.join(directory,'packages/calendar',file.file);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,original);}
 const run=()=>execFileSync(process.execPath,['scripts/patch-calendar.cjs'],{cwd:directory,stdio:'pipe'}).toString();
 assert.match(run(),/6 files patched/);assert.match(run(),/0 files patched/);
 for(const file of patch.files){const content=await fs.readFile(path.join(directory,'packages/calendar',file.file),'utf8');assert.equal(createHash('sha256').update(content).digest('hex'),file.result);}
 await fs.appendFile(path.join(directory,'packages/calendar',patch.files[0].file),'\n// unexpected upstream edit\n');assert.throws(run);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
