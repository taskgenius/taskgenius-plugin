import assert from 'node:assert/strict';
import {test, after} from 'node:test';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {installObsidianDom} from './dom-fixture.mjs';
const require = createRequire(import.meta.url);
const {JSDOM} = createRequire(require.resolve('jest-environment-jsdom'))('jsdom');
const directory = await mkdtemp(path.join(tmpdir(), 'tg-habits-tests-'));
after(() => rm(directory, {recursive: true, force: true}));
await build({
  stdin: {contents: `export {TaskGeniusHabits} from './src/integrations/habits/task-genius-host';
    export {HabitStore} from './src/integrations/habits/habit-store';
    export {DEFAULT_SETTINGS, DEFAULT_FRONTMATTER_KEYS} from './src/integrations/habits/settings';
    export {planLegacyHabits, importLegacyHabits} from './src/integrations/habits/legacy-import';
    export {isDue, isActive, isComplete, habitStats} from './src/integrations/habits/stats';
    export {t} from './src/integrations/habits/i18n';
    export {ReminderSync} from './src/integrations/habits/reminders';
    export {NoteHabitSync, computeNoteValue} from './src/integrations/habits/note-habit';
    export {applyCommentLog, parseCommentLog} from './src/integrations/habits/comment-log';
    export {generateSummary} from './src/integrations/habits/ai-summary';
    export {ExportModal} from './src/integrations/habits/ui/export-modal';
    export * from './tests/habits/obsidian-fixture.mjs';`, resolveDir: process.cwd(), loader: 'ts'},
  bundle: true, format: 'esm', platform: 'node', outfile: path.join(directory, 'integration.mjs'),
  loader: {'.css': 'empty'}, logLevel: 'silent',
  plugins: [{name: 'obsidian-fixture', setup(builder) {
    builder.onResolve({filter: /^obsidian$/}, () => ({path: path.resolve('tests/habits/obsidian-fixture.mjs')}));
  }}],
});
const {TaskGeniusHabits, HabitStore, DEFAULT_SETTINGS, DEFAULT_FRONTMATTER_KEYS,
  planLegacyHabits, importLegacyHabits, isDue, isActive, isComplete, habitStats, t, vaultFixture,
  ReminderSync, NoteHabitSync, computeNoteValue, applyCommentLog, parseCommentLog, generateSummary, ExportModal} = await import(pathToFileURL(path.join(directory, 'integration.mjs')));
const settings = extra => ({...structuredClone(DEFAULT_SETTINGS), ...extra});
const date = value => {const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day);};
const habit = extra => ({type:'binary', goalDirection:'min', frequency:'interval', intervalMode:'completion', intervalDays:2, startDate:'2026-11-01', records:{}, pauses:[], reschedules:[], failed:[], skipped:[], target:1, ...extra});

test('rolling intervals remain due after a miss, then restart from the actual completion', () => {
  const h = habit({records:{'2026-11-01':1, '2026-11-04':1}});
  for (const [key, expected] of [['2026-10-31',false],['2026-11-01',true],['2026-11-02',false],['2026-11-03',true],['2026-11-04',true],['2026-11-05',false],['2026-11-06',true]]) assert.equal(isDue(h, date(key)), expected, key);
  assert.equal(isComplete(h, '2026-11-04'), true);
  assert.equal(isActive(h, date('2026-11-05')), false);
});
test('partial, failed, skipped and future records cannot shift earlier rolling due dates', () => {
  const h = habit({type:'repetition',target:3,records:{'2026-11-01':3,'2026-11-03':2,'2026-11-04':3,'2026-11-09':3}, failed:['2026-11-04']});
  assert.equal(isDue(h,date('2026-11-04')),true);
  assert.equal(isDue(h,date('2026-11-05')),true);
  delete h.records['2026-11-09'];
  assert.equal(isDue(h,date('2026-11-05')),true);
  h.failed=[]; h.skipped=['2026-11-04'];
  assert.equal(isDue(h,date('2026-11-05')),true);
});
test('fixed intervals and maximum limits retain the original start-date schedule', () => {
  const h = habit({intervalMode:'fixed',records:{'2026-11-04':1}});
  assert.equal(isDue(h,date('2026-11-05')),true);
  assert.equal(isDue(h,date('2026-11-06')),false);
  h.intervalMode='completion'; h.goalDirection='max';
  assert.equal(isDue(h,date('2026-11-05')),true);
});
test('legacy conversion retains zero mapping scores, fractional counts, details and event presence', () => {
  const source = [
    {id:'daily',name:'Read',icon:'book',type:'daily',completions:{'2026-11-01':'done','2026-11-02':false}},
    {id:'count',name:'Water',icon:'glass-water',type:'count',min:2,countUnit:'L',completions:{'2026-11-01':1.25}},
    {id:'mood',name:'Mood',icon:'smile',type:'mapping',mapping:{0:'Neutral',1:'Happy'},completions:{'2026-11-01':0}},
    {id:'schedule',name:'Routine',icon:'sun',type:'scheduled',events:[{name:'Morning',details:[]},{name:'Evening',details:[]}],completions:{'2026-11-01':{Morning:'',Evening:'Walked'}}},
  ];
  const plans = planLegacyHabits(source);
  assert.equal(plans.length,5);
  assert.equal(plans[0].records['2026-11-01'],1);
  assert.equal(plans[1].records['2026-11-01'],1.25);
  assert.equal(plans[2].records['2026-11-01'],0);
  assert.equal(plans[3].records['2026-11-01'],1);
  assert.deepEqual(plans[4].source,source[3]);
  assert.deepEqual(source[3].completions['2026-11-01'],{Morning:'',Evening:'Walked'});
});
test('legacy import uses configurable folders and keys, preserves source data and is idempotent', async () => {
  const fixture = vaultFixture();
  const config = settings({habitsFolder:'Tracking/习惯',frontmatterKeys:{...DEFAULT_FRONTMATTER_KEYS,records:'日志'}});
  const plans = planLegacyHabits([{id:'old',name:'健身',icon:'dumbbell',type:'daily',completions:{'2026-11-04':true}}]);
  assert.deepEqual(await importLegacyHabits(fixture.app,config,plans),{created:1,skipped:0});
  assert.deepEqual(await importLegacyHabits(fixture.app,config,plans),{created:0,skipped:1});
  const file = fixture.app.vault.getMarkdownFiles()[0];
  const fm = fixture.metadata.get(file.path).frontmatter;
  assert.ok(file.path.startsWith('Tracking/习惯/'));
  assert.deepEqual(fm['日志'],{'2026-11-04':1});
  assert.deepEqual(fm.taskGeniusLegacy.source,plans[0].source);
  const store = new HabitStore(fixture.app,()=>config,async()=>{});
  assert.equal(store.getHabits()[0].records['2026-11-04'],1);
  await store.setRecord(store.getHabits()[0],'2026-11-06',1);
  assert.deepEqual(fm['日志'],['2026-11-04','2026-11-06']);
});
test('import detects path conflicts and never overwrites an unrelated existing note', async () => {
  const fixture = vaultFixture(), config = settings();
  const plans = planLegacyHabits([{id:'old',name:'Read',icon:'book',type:'daily',completions:{}}]);
  await importLegacyHabits(fixture.app,config,plans);
  const file = fixture.app.vault.getMarkdownFiles()[0]; fixture.text.set(file.path,'Important unrelated content');
  await assert.rejects(importLegacyHabits(fixture.app,config,plans),/Import conflict/);
  assert.equal(fixture.text.get(file.path),'Important unrelated content');
  await assert.rejects(importLegacyHabits(fixture.app,{...config,habitsFolder:'../outside'},plans),/Invalid habits folder/);
});
test('habit store follows folder changes immediately and writes fractional values through the file API', async () => {
  const fixture = vaultFixture(), config = settings({habitsFolder:'One'});
  for (const folder of ['One','Two']) {
    await fixture.app.vault.createFolder(folder);
    await fixture.app.vault.create(`${folder}/Water.md`,`---\n${JSON.stringify({habit:true,type:'repetition',target:2,step:0.25,records:{'2026-11-01':0.5}})}\n---\n`);
  }
  const store = new HabitStore(fixture.app,()=>config,async()=>{});
  assert.equal(store.getHabits()[0].path,'One/Water.md');
  config.habitsFolder='Two';
  const h = store.getHabits()[0]; assert.equal(h.path,'Two/Water.md');
  await store.setRecord(h,'2026-11-02',0.1+0.2);
  assert.equal(fixture.metadata.get(h.path).frontmatter.records['2026-11-02'],0.3);
  assert.equal(fixture.metadata.get('One/Water.md').frontmatter.records['2026-11-02'],undefined);
});
test('host imports compatible Habits settings without copying API keys or enabling external writes', async () => {
  const fixture = vaultFixture();
  fixture.text.set('.obsidian/plugins/habits/data.json', JSON.stringify({habitsFolder:'Existing',cardsPerView:2,frontmatterKeys:{records:'done'},aiSummary:{apiKey:'secret'},reminders:{enabled:true}}));
  const host = {app:fixture.app,manifest:{id:'task-genius'},settings:{habit:{enableHabits:true}},saveSettings:async()=>{}};
  const plugin = new TaskGeniusHabits(host); await plugin.loadSettings();
  assert.equal(plugin.settings.habitsFolder,'Existing');
  assert.equal(plugin.settings.frontmatterKeys.records,'done');
  assert.equal(plugin.settings.aiSummary.apiKey,'');
  assert.equal(plugin.settings.reminders.enabled,false);
  await plugin.saveSettings();
  assert.equal(host.settings.habitsIntegration.habitsFolder,'Existing');
  assert.ok(!JSON.stringify(host.settings).includes('secret'));
});
test('full host registration namespaces commands, views and blocks and avoids standalone collisions', async () => {
  globalThis.window=globalThis;
  for (const standalone of [false,true]) {
    const fixture = vaultFixture(); if (standalone) fixture.app.plugins.enabledPlugins.add('habits');
    const host={app:fixture.app,manifest:{id:'task-genius'},settings:{habit:{enableHabits:true},habitsIntegration:settings()},saveSettings:async()=>{}};
    const plugin=new TaskGeniusHabits(host); await plugin.onload(); await plugin.ready;
    for (const language of ['habits','habit-metrics','habits-table','habits-heatmap']) {
      assert.ok(plugin.blocks.has(`tg-${language}`)); assert.equal(plugin.blocks.has(language),!standalone);
    }
    assert.ok(plugin.views.has('tg-habits-panel'));
    assert.equal(plugin.manifest.id,'task-genius-habits');
    const inserted=[]; plugin.commands.find(command=>command.id==='insert-dashboard').editorCallback({replaceSelection:value=>inserted.push(value)});
    assert.ok(inserted[0].startsWith('```tg-habits'));
    assert.ok(plugin.embeddedSettings);
    plugin.unload();
    assert.equal([...fixture.app.vault.handlers.values()].reduce((sum,set)=>sum+set.size,0),0);
  }
});
test('English and Chinese use separate complete strings and preserve zero placeholders', () => {
  globalThis.testLanguage='zh-cn'; assert.equal(t('Create habit'),'创建习惯');
  assert.equal(t('Imported {created} habits; skipped {skipped} existing imports.',{created:0,skipped:2}),'已导入 0 个习惯，跳过 2 个已导入习惯。');
  globalThis.testLanguage='en'; assert.equal(t('Create habit'),'Create habit');
});

test('background synchronization has one owner and stops after disabling or unloading', async () => {
  globalThis.window=globalThis;
  const originalPrime=NoteHabitSync.prototype.primeAll, originalUpdate=ReminderSync.prototype.update;
  let primes=0, updates=0;
  NoteHabitSync.prototype.primeAll=async()=>{primes++;};
  ReminderSync.prototype.update=async()=>{updates++;};
  try {
    const fixture=vaultFixture(); fixture.app.plugins.enabledPlugins.add('habits');
    const host={app:fixture.app,manifest:{id:'task-genius'},settings:{habit:{enableHabits:true},habitsIntegration:settings()},saveSettings:async()=>{}};
    const plugin=new TaskGeniusHabits(host); await plugin.onload();
    assert.deepEqual([primes,updates],[0,0]);
    fixture.app.plugins.enabledPlugins.delete('habits'); plugin.events.trigger('settings-changed');
    assert.deepEqual([primes,updates],[1,1]);
    host.settings.habit.enableHabits=false; plugin.events.trigger('settings-changed');
    assert.deepEqual([primes,updates],[1,1]);
    plugin.unload(); host.settings.habit.enableHabits=true; plugin.events.trigger('settings-changed');
    assert.deepEqual([primes,updates],[1,1]);
  } finally { NoteHabitSync.prototype.primeAll=originalPrime; ReminderSync.prototype.update=originalUpdate; }
});
test('unloading during asynchronous settings loading does not register late listeners', async () => {
  const fixture=vaultFixture();
  let release;
  fixture.app.vault.adapter.read=()=>new Promise(resolve=>{release=resolve;});
  const host={app:fixture.app,manifest:{id:'task-genius'},settings:{habit:{enableHabits:true}},saveSettings:async()=>{}};
  const plugin=new TaskGeniusHabits(host), loading=plugin.onload(); plugin.unload(); release('{}'); await loading; await plugin.ready;
  assert.equal(plugin.commands.length,0); assert.equal(plugin.blocks.size,0); assert.equal(fixture.app.vault.handlers.size,0);
});
test('reminder checkboxes and counted records synchronize in both directions', async () => {
  const fixture=vaultFixture(), config=settings({reminders:{enabled:true,target:'fixed-note',notePath:'Reminders.md'}});
  await fixture.app.vault.createFolder('Habits');
  await fixture.app.vault.create('Habits/Water.md',`---\n${JSON.stringify({type:'repetition',target:2,times:['09:00','18:00'],startDate:'2026-11-01',records:{}})}\n---\n`);
  const store=new HabitStore(fixture.app,()=>config,async()=>{}), sync=new ReminderSync(fixture.app,store,()=>config);
  await sync.update(date('2026-11-08'));
  const first=fixture.text.get('Reminders.md'); assert.equal((first.match(/- \[ \]/g)??[]).length,2);
  fixture.text.set('Reminders.md',first.replace('- [ ]','- [x]'));
  await sync.update(date('2026-11-08')); assert.equal(store.getHabits()[0].records['2026-11-08'],1);
  fixture.text.set('Reminders.md',fixture.text.get('Reminders.md').replace('- [x]','- [ ]'));
  await sync.update(date('2026-11-08')); assert.equal(store.getHabits()[0].records['2026-11-08'],undefined);
});
test('note habits support character, all-checklist, counted-checklist and failure rules', () => {
  const h={noteCompletionMode:'chars',noteChecklistRequirement:'all',noteChecklistMin:2,noteFailKeyword:'failed',target:10};
  assert.equal(computeNoteValue(h,'---\ntitle: ignored\n---\nhello'),5);
  h.noteCompletionMode='checklist';
  assert.equal(computeNoteValue(h,'- [x] one\n- [ ] two'),50);
  h.noteChecklistRequirement='count'; assert.equal(computeNoteValue(h,'- [x] one\n- [x] two\n- [ ] three'),2);
  assert.equal(computeNoteValue(h,'- [x] failed'),0);
});
test('day comments preserve unrelated Markdown, tags, links and multiline text', () => {
  const comments={'2026-11-08':'Gym #fitness [[Training]]\nSecond line','2026-11-06':'Rest'};
  const original='# Notes\n\nKeep this paragraph.\n';
  const result=applyCommentLog(original,comments);
  assert.ok(result.startsWith(original.trimEnd())); assert.deepEqual(parseCommentLog(result),comments);
  assert.equal(applyCommentLog(result,comments),result);
});
test('AI summary requests are opt-in, configurable, cached, and report endpoint errors', async () => {
  let count=0;
  globalThis.mockHabitRequest=async request=>{count++; assert.equal(request.url,'https://example.invalid/v1/chat/completions'); assert.equal(request.headers.Authorization,'Bearer test-key'); return {status:200,json:{choices:[{message:{content:'Summary'}}]}};};
  const config={baseUrl:'https://example.invalid/v1/',apiKey:'test-key',model:'local-test'};
  try {
    assert.equal(await generateSummary(config,'weekly','rolling','test-digest'),'Summary');
    assert.equal(await generateSummary(config,'weekly','rolling','test-digest'),'Summary'); assert.equal(count,1);
    globalThis.mockHabitRequest=async()=>({status:429,json:{error:{message:'Rate limited'}}});
    await assert.rejects(generateSummary(config,'weekly','rolling','test-digest',true),/Rate limited/);
  } finally { delete globalThis.mockHabitRequest; }
});
test('PDF export produces a real PDF in the vault without overwriting previous exports', async () => {
  const fixture=vaultFixture(), config=settings(); await fixture.app.vault.createFolder('Habits');
  await fixture.app.vault.create('Habits/Read.md',`---\n${JSON.stringify({type:'binary',startDate:'2026-11-01',records:{'2026-11-08':1}})}\n---\n`);
  const store=new HabitStore(fixture.app,()=>config,async()=>{});
  const dom=new JSDOM('<body></body>');
  dom.window.document.body.createSpan=()=>{
    const span=dom.window.document.createElement('span');
    Object.defineProperty(span,'win',{value:dom.window}); dom.window.document.body.append(span); return span;
  };
  for(let index=0;index<2;index++) {
    const modal=new ExportModal(fixture.app,store.getHabits()); modal.contentEl.doc=dom.window.document;
    modal.options.includeTrend=false; await modal.exportPdf();
  }
  const pdfs=[...fixture.text].filter(([name])=>name.endsWith('.pdf')); assert.equal(pdfs.length,2);
  for (const [,data] of pdfs) { const bytes=Buffer.from(data); assert.equal(bytes.subarray(0,5).toString(),'%PDF-'); assert.ok(bytes.length>1000); }
  dom.window.close();
});
test('all embedded settings tabs render in English and Chinese; folder input saves into Task Genius', async () => {
  for (const language of ['en','zh-cn']) {
    globalThis.testLanguage=language;
    const dom=new JSDOM('<body></body>'); installObsidianDom(dom.window);
    const fixture=vaultFixture(); let saves=0;
    const host={app:fixture.app,manifest:{id:'task-genius'},settings:{habit:{enableHabits:true},habitsIntegration:settings()},saveSettings:async()=>{saves++;}};
    const plugin=new TaskGeniusHabits(host); await plugin.onload();
    const root=dom.window.document.body.createDiv(); plugin.renderSettings(root);
    const tabs=[...root.querySelectorAll('.habits-settings-tab')]; assert.equal(tabs.length,3);
    assert.equal(tabs[0].textContent,language==='en'?'General':'常规');
    const input=root.querySelector('input'); input.value='Tracking/自定义'; input.dispatchEvent(new dom.window.Event('input')); await globalThis.lastSettingSave;
    assert.equal(host.settings.habitsIntegration.habitsFolder,'Tracking/自定义'); assert.ok(saves>0);
    tabs[1].click(); assert.ok(root.querySelectorAll('input[type=checkbox]').length>=3);
    tabs[2].click(); assert.ok(root.querySelectorAll('.setting-item').length>=30);
    plugin.unload(); dom.window.close();
  }
  globalThis.testLanguage='en';
});
