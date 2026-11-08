import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {build} from 'esbuild';
import fs from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {installObsidianDom} from '../habits/dom-fixture.mjs';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const {JSDOM}=createRequire(require.resolve('jest-environment-jsdom'))('jsdom');
const directory=await mkdtemp(path.join(tmpdir(),'tg-ui-audit-'));
after(()=>rm(directory,{recursive:true,force:true}));
const owned=[
  'components/features/task/view/content.ts',
  'components/features/fluent/components/FluentTopNavigation.ts', 'components/features/fluent/components/ProjectList.ts',
  'components/features/fluent/managers/FluentDataManager.ts',
  'components/features/fluent/managers/FluentComponentManager.ts',
  'components/features/calendar/index.ts',
  'components/features/calendar/views/tg-year-view.ts',
  'components/features/calendar/views/tg-agenda-view.ts',
  'components/ui/behavior/ViewComponentManager.ts',
  'pages/FluentTaskView.ts', 'integrations/habits/ui/habit-modal.ts',
  'mcp/auth/AuthMiddleware.ts', 'services/view-settings-signature.ts', 'dataflow/events/Events.ts', 'utils/ui/view-mode-utils.ts',
  'utils/ui/tree-view-utils.ts',
	'utils/task/filter-compatibility.ts',
	'components/features/rewards/PointsDashboard.ts', 'managers/points-service.ts', 'managers/daily-points.ts',
].map(file=>path.resolve('src',file));
await build({stdin:{contents:`
 export {ContentComponent} from './src/components/features/task/view/content';
 export {TopNavigation} from './src/components/features/fluent/components/FluentTopNavigation';
 export {FluentDataManager} from './src/components/features/fluent/managers/FluentDataManager';
 export {FluentComponentManager} from './src/components/features/fluent/managers/FluentComponentManager';
 export {CalendarComponent} from './src/components/features/calendar';
 export {ViewComponentManager} from './src/components/ui/behavior/ViewComponentManager';
 export {FluentTaskView} from './src/pages/FluentTaskView';
 export {HabitModal} from './src/integrations/habits/ui/habit-modal';
 export {PointsDashboard} from './src/components/features/rewards/PointsDashboard';
 export {snapshotViewSettings} from './src/services/view-settings-signature';
 export {AuthMiddleware} from './src/mcp/auth/AuthMiddleware';
 export {ProjectList} from './src/components/features/fluent/components/ProjectList';
 export * from './tests/ui-audit/fixture.mjs';`,resolveDir:process.cwd(),loader:'ts'},
 bundle:true,format:'esm',platform:'node',outfile:path.join(directory,'ui.mjs'),loader:{'.css':'empty'},logLevel:'silent',
 alias:{'@':path.resolve('src'),'moment':createRequire(require.resolve('obsidian/package.json')).resolve('moment')},
 plugins:[{name:'isolated-ui-dependencies',setup(builder){
   builder.onResolve({filter:/^obsidian$/},()=>({path:path.resolve('tests/ui-audit/fixture.mjs')}));
   builder.onLoad({filter:/\.tsx?$/},args=>{
     if(!args.path.startsWith(path.resolve('src'))||owned.includes(args.path))return;
     if(args.path.endsWith(path.normalize('translations/helper.ts')))return{contents:'export const t = s=>s; export const settingsText = s=>s;'};
     if(args.path.endsWith(path.normalize('common/setting-definition.ts')))return{contents:'export const getViewSettingOrDefault=(p,id)=>p.settings.viewConfiguration.find(v=>v.id===id)??{id,name:id}; export const DEFAULT_SETTINGS={};'};
     if(args.path.endsWith(path.normalize('utils/task/task-filter-utils.ts')))return{contents:'export const filterTasks=tasks=>tasks;'};
     if(args.path.endsWith(path.normalize('commands/sortTaskCommands.ts')))return{contents:'export const sortTasks=tasks=>tasks;'};
     if(args.path.endsWith(path.normalize('dataflow/createDataflow.ts')))return{contents:'export const isDataflowEnabled=p=>!!p.dataflowOrchestrator;'};
     if(args.path.endsWith(path.normalize('utils/grouping/groupByStorage.ts')))return{contents:'export const getGroupByConfig=()=>"none";export const setGroupByConfig=()=>{};export const getGroupExpandedState=()=>true;export const setGroupExpandedState=()=>{};'};
     const tree=ts.createSourceFile(args.path,fs.readFileSync(args.path,'utf8'),ts.ScriptTarget.Latest,true);
     const exports=[];let defaultClass=false;
     for(const node of tree.statements){
       if(!node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;
       if(ts.isClassDeclaration(node)){if(node.modifiers.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword))defaultClass=true;else if(node.name)exports.push(`export const ${node.name.text}=StubComponent;`);}
       if(ts.isFunctionDeclaration(node)&&node.name)exports.push(`export const ${node.name.text}=(...args)=>args[0];`);
       if(ts.isVariableStatement(node))for(const d of node.declarationList.declarations)if(ts.isIdentifier(d.name))exports.push(`export const ${d.name.text}={};`);
     }
     return{contents:`import {StubComponent} from ${JSON.stringify(path.resolve('tests/ui-audit/fixture.mjs'))};\n${exports.join('\n')}\n${defaultClass?'export default StubComponent;':''}`};
   });
 }}],
});
const {ContentComponent,TopNavigation,FluentDataManager,FluentComponentManager,CalendarComponent,ViewComponentManager,FluentTaskView,HabitModal,PointsDashboard,snapshotViewSettings,AuthMiddleware,ProjectList,vaultFixture,moment}=await import(pathToFileURL(path.join(directory,'ui.mjs')));
function environment(){
 const dom=new JSDOM('<body></body>',{url:'https://obsidian.invalid',pretendToBeVisual:true});installObsidianDom(dom.window);
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;
 const frames=new Map();let sequence=0;
 window.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence;};window.cancelAnimationFrame=id=>frames.delete(id);
 const tick=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
 globalThis.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
 const f=vaultFixture(),storage=new Map();f.app.loadLocalStorage=k=>storage.get(k);f.app.saveLocalStorage=(k,v)=>storage.set(k,v);
 const plugin={app:f.app,settings:{viewConfiguration:[{id:'inbox',name:'Inbox'},{id:'projects',name:'Projects'},{id:'calendar',name:'Calendar',specificConfig:{viewType:'calendar',firstDayOfWeek:1}}],defaultViewMode:'list',taskTimer:{enabled:false}},preloadedTasks:[]};
 return{...f,dom,tick,frames,plugin,close:()=>dom.window.close()};
}
const task=(id)=>({id,content:id,filePath:'Tasks.md',status:' ',completed:false,metadata:{}});
test('old project preferences cannot resurrect deleted projects or replace canonical identifiers',()=>{
 const e=environment();e.plugin.settings.projectConfig={customProjects:[{id:'old-real-id',name:'Real',displayName:'Real',color:'#123'},{id:'ghost-id',name:'Deleted'}]};
 const list=Object.create(ProjectList.prototype);list.plugin=e.plugin;list.projects=[{id:'Real',name:'Real',filterKey:'Real'}];list.loadCustomProjects();
 assert.deepEqual(list.projects.map(project=>project.name),['Real']);assert.equal(list.projects[0].id,'Real');e.close();
});
test('search stays available in specialized task views and retains its text across view changes',()=>{
 const e=environment(),root=document.body.createDiv(),queries=[];
 const nav=new TopNavigation(root,e.plugin,value=>queries.push(value),()=>{},()=>{},()=>{},()=>{},[]);
 const input=root.querySelector('input'); input.value='project:Writing'; input.dispatchEvent(new window.Event('input'));
 nav.updateContext('gantt');nav.updateAvailableModes([]);
 assert.notEqual(root.style.display,'none');assert.equal(input.value,'project:Writing');assert.deepEqual(queries,['project:Writing']);
 nav.updateContext('points');assert.equal(root.style.display,'none');nav.updateContext('tags');assert.notEqual(root.style.display,'none');e.close();
});
test('structured searches and saved filters apply the same include and exclude rules',()=>{
 const e=environment();e.plugin.settings.taskStatuses={completed:'x',inProgress:'/',planned:'?',abandoned:'-',notStarted:' '};
 const state={liveFilterState:null,currentFilterState:null,viewStateFilters:{},selectedProject:undefined,searchQuery:'project:Writing AND priority:>=3',filterInputValue:'',activeTaskPreset:null};
 const manager=new FluentDataManager(e.plugin,()=> 'inbox',()=>state,()=>false);
 const rows=[{...task('write'),metadata:{project:'Writing',priority:4}},{...task('low'),metadata:{project:'Writing',priority:1}},{...task('other'),metadata:{project:'Other',priority:5}}];
 assert.deepEqual(manager.applyFilters(rows).map(item=>item.id),['write']);state.searchQuery='';
 state.activeTaskPreset={includeCompleted:true,includeInProgress:true,includeAbandoned:true,includeNotStarted:true,includePlanned:true,includeParentTasks:false,includeChildTasks:false,includeSiblingTasks:false,advancedFilterQuery:'project:Writing',filterMode:'EXCLUDE'};
 assert.deepEqual(manager.applyFilters(rows).map(item=>item.id),['other']);e.close();
});
test('table views receive the filtered task list rather than rebuilding from all tasks',()=>{
 const e=environment(),root=document.body.createDiv();let received=null;
 const manager=new FluentComponentManager(e.app,e.plugin,root,{addChild:child=>child},{});
 const table={containerEl:root.createDiv(),updateTasks:tasks=>received=tasks};
 manager.hideAllComponents=()=>{};manager.viewComponentManager={isSpecialView:()=>true,showComponent:()=>table};
 const all=[task('one'),task('two')];manager.switchView('table',all,[all[1]],null,'list');
 assert.deepEqual(received.map(item=>item.id),['two']);e.close();
});
test('the native points page renders the original bonus list, reward wishes and manual history',async()=>{
 const e=environment();e.plugin.settings.rewards={rewardItems:[],pointsLedger:[]};
 await e.app.vault.createFolder('99_System/01_Data');
 await e.app.vault.create('99_System/01_Data/积分系统数据.md','---\n'+JSON.stringify({manualPointRecords:[{id:'old',date:'2026-11-01',text:'Original reward history',points:30}],examplePropertyLeft:['Read a book + 50'],examplePropertyRight:['A trip - 5000']})+'\n---\n');
 const root=document.body.createDiv(),page=new PointsDashboard(e.app,e.plugin,root,true);page.onload();await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(root.textContent,/Read a book \+ 50/);assert.match(root.textContent,/A trip - 5000/);assert.match(root.textContent,/30/);
 const history=[...root.querySelectorAll('[role="tab"]')].find(button=>button.textContent==='Points history');history.click();assert.match(root.textContent,/Original reward history/);
 const input=root.querySelector('.tg-points-tools input');input.value='no match';input.dispatchEvent(new window.Event('input'));assert.doesNotMatch(root.querySelector('.tg-points-body').textContent,/Original reward history/);
 page.unload();e.close();
});
function contentFixture(e){
 const root=document.body.createDiv();const content=new ContentComponent(root,e.app,e.plugin);content.onload();content.isContainerVisible=()=>true;return content;
}
test('a hidden pending render keeps the newest task snapshot, then renders without a manual refresh',()=>{
 const e=environment(),c=contentFixture(e);let visible=false;c.isContainerVisible=()=>visible;
 c.setTasks([task('old')],[task('old')]);e.tick();assert.equal(c.pendingForceRefresh,true);
 c.setTasks([task('new')],[task('new')]);assert.equal(c.allTasks[0].id,'new');
 visible=true;e.app.workspace.trigger('active-leaf-change');e.tick();
 assert.equal(c.taskComponents[0].task.id,'new');assert.equal(c.isRendering,false);c.onunload();e.close();
});
test('list/tree toggles share the top navigation state and remain responsive on consecutive clicks',()=>{
 const e=environment(),c=contentFixture(e);const navRoot=document.body.createDiv();
 const modes=[];const nav=new TopNavigation(navRoot,e.plugin,()=>{},mode=>{modes.push(mode);c.setIsTreeView(mode==='tree');},()=>{},()=>{},()=>{});
 c.topNavigation=nav;c.toggleViewMode();c.toggleViewMode();c.toggleViewMode();
 assert.deepEqual(modes,['tree','list','tree']);assert.equal(c.isTreeView,true);assert.equal(nav.currentViewMode,'tree');
 c.setViewMode('inbox');assert.equal(c.isTreeView,true);c.onunload();e.close();
});
test('a synchronous render does not retain a delayed render lock or discard forced updates',()=>{
 const e=environment(),c=contentFixture(e);
 c.setTasks([task('one')],[task('one')],true);c.setTasks([task('two')],[task('two')]);e.tick();
 assert.equal(c.taskComponents[0].task.id,'two');assert.equal(c.isRendering,false);
 c.setTasks([task('three')],[task('three')]);e.tick();assert.equal(c.taskComponents[0].task.id,'three');
 c.onunload();assert.equal(e.frames.size,0);e.close();
});
test('a late task load cannot replace a newer load, or update a disposed view',async()=>{
 const e=environment();const pending=[];e.plugin.dataflowOrchestrator={getQueryAPI:()=>({getAllTasks:()=>new Promise(resolve=>pending.push(resolve))})};
 const manager=new FluentDataManager(e.plugin,()=> 'inbox',()=>({}),()=>false);const loaded=[];manager.setCallbacks({onTasksLoaded:tasks=>loaded.push(tasks)});
 const old=manager.loadTasks(false),recent=manager.loadTasks(false);pending[1]([task('recent')]);await recent;pending[0]([task('stale')]);await old;
 assert.deepEqual(loaded.map(tasks=>tasks[0].id),['recent']);const closed=manager.loadTasks(false);manager.onunload();pending[2]([task('closed')]);await closed;assert.equal(loaded.length,1);e.close();
});
test('cache-ready notifications are registered before the index exists and registration is idempotent',async()=>{
 const e=environment(),m=new FluentDataManager(e.plugin,()=> 'inbox',()=>({}),()=>false);let loads=0;m.loadTasks=async()=>{loads++;};
 await m.registerDataflowListeners();await m.registerDataflowListeners();e.app.workspace.trigger('task-genius:cache-ready');await Promise.resolve();assert.equal(loads,1);m.unload();e.close();
});
test('calendar next/previous/today update the existing header for all built-in periods',()=>{
 const e=environment(),calendar=new CalendarComponent(e.app,e.plugin,document.body.createDiv());calendar.dateDisplayEl=document.body.createSpan();
 for(const mode of ['month','week','year','day']){
   calendar.currentViewMode=mode;calendar.currentDate=moment('2026-11-08');let engine=moment('2026-11-08');
   calendar.tgCalendar={next(){engine.add(1,mode);calendar.updateDateHeader(engine.toDate());},prev(){engine.subtract(1,mode);calendar.updateDateHeader(engine.toDate());},today(){engine=moment();calendar.updateDateHeader(engine.toDate());}};
   calendar.updateDateHeader();const before=calendar.dateDisplayEl.textContent;calendar.navigate('next');assert.notEqual(calendar.dateDisplayEl.textContent,before,mode);calendar.navigate('prev');assert.equal(calendar.dateDisplayEl.textContent,before,mode);calendar.goToToday();assert.equal(calendar.currentDate.format('YYYY-MM-DD'),moment().format('YYYY-MM-DD'));
 }
 e.close();
});
test('projects overview leaves the sidebar project shortcuts enabled and selection coherent',()=>{
 const e=environment();const view=Object.create(FluentTaskView.prototype);let enabled,selected;
 Object.assign(view,{isInitializing:false,isLoading:false,loadError:null,currentViewId:'projects',viewState:{viewMode:'list'},tasks:[task('a')],filteredTasks:[task('a')],topNavigation:{updateAvailableModes(){},updateContext(){},setViewMode(){}},layoutManager:{updateTaskMark(){},setSidebarActiveItem(){},setActiveProject:value=>selected=value,sidebar:{setProjectListEnabled:value=>enabled=value}},selectionManager:{updateTaskCache(){}},componentManager:{getAvailableModesForView:()=>[],switchView(){}},ensureViewModeForView:()=> 'list'});
 view.updateView();assert.equal(enabled,true);assert.equal(selected,null);
 view.viewState.selectedProject='毕业设计';view.updateView();assert.equal(selected,'毕业设计');e.close();
});
test('an empty task cache does not replace the independent habit page with a task empty state',()=>{
 const e=environment();const view=Object.create(FluentTaskView.prototype);let switched=false,empty=false;
 Object.assign(view,{isInitializing:false,isLoading:false,loadError:null,currentViewId:'habit',viewState:{viewMode:'list'},tasks:[],filteredTasks:[],layoutManager:{updateTaskMark(){},setSidebarActiveItem(){},setActiveProject(){},sidebar:{setProjectListEnabled(){}}},selectionManager:{updateTaskCache(){}},componentManager:{getAvailableModesForView:()=>[],isContentBasedView:()=>false,switchView(){switched=true;},renderEmptyState(){empty=true;}},ensureViewModeForView:()=> 'list'});
 view.updateView();assert.equal(switched,true);assert.equal(empty,false);e.close();
});
test('settings refresh preserves view state while refreshing navigation, configuration and data',async()=>{
 const view=Object.create(FluentTaskView.prototype),order=[];const state={viewMode:'tree',selectedProject:'project'};
 Object.assign(view,{isInitializing:false,viewState:state,layoutManager:{sidebar:{render:()=>order.push('sidebar')},updateActionButtons:()=>order.push('actions')},componentManager:{refreshConfiguration:()=>order.push('configuration')},dataManager:{loadTasks:async()=>order.push('data')}});
 await view.refreshSettings();assert.equal(view.viewState,state);assert.deepEqual(order,['sidebar','configuration','actions','data']);
});

test('both native close-control versions dismiss the habit dialog even when document click bubbling is blocked',()=>{
 const e=environment();
 for(const css of ['modal-header-button','modal-close-button']){
  const modal=new HabitModal(e.app,{},()=>{});modal.build=()=>{};
  const button=modal.modalEl.querySelector('.modal-header-button');button.className=css;modal.onOpen();
  const swallow=event=>event.stopPropagation();document.addEventListener('click',swallow,true);
  button.dispatchEvent(new window.MouseEvent('pointerup',{bubbles:true,button:0}));
  assert.equal(modal.containerEl.isConnected,false);assert.equal(modal.closeButton,null);
  document.removeEventListener('click',swallow,true);
 }
 e.close();
});

test('view settings snapshots detect in-place changes without treating navigation persistence as configuration changes',()=>{
 const settings={viewConfiguration:[{id:'a',name:'Original',visible:true}],workspaces:{activeView:'a'}};
 const initial=snapshotViewSettings(settings);settings.workspaces.activeView='b';assert.equal(snapshotViewSettings(settings),initial);
 settings.viewConfiguration[0].name='Renamed';assert.notEqual(snapshotViewSettings(settings),initial);
});
test('unchanged top-navigation modes preserve the existing tab elements during data refresh',()=>{
 const e=environment();const nav=new TopNavigation(document.body.createDiv(),e.plugin,()=>{},()=>{},()=>{},()=>{},()=>{});
 const tab=nav.containerEl.querySelector('[data-mode="list"]');nav.updateAvailableModes(['list','kanban','tree','calendar']);assert.equal(nav.containerEl.querySelector('[data-mode="list"]'),tab);e.close();
});
test('cached calendar configuration changes refresh the existing instance and preserve its date',()=>{
 const e=environment();const parent={addChild:c=>c,removeChild:c=>c.unload()};const manager=new ViewComponentManager(parent,e.app,e.plugin,document.body.createDiv(),{});
 const calendar=manager.getOrCreateComponent('calendar');const selected=calendar.currentDate;let refreshed=0;calendar.refreshConfiguration=()=>{refreshed++;};
 e.plugin.settings.viewConfiguration.find(v=>v.id==='calendar').specificConfig.hideWeekends=true;
 assert.equal(manager.getOrCreateComponent('calendar'),calendar);assert.equal(calendar.currentDate,selected);assert.equal(refreshed,1);e.close();
});

test('task updates arriving during initialization are replayed when the view becomes ready',async()=>{
 const e=environment();let initializing=true,loads=0;const manager=new FluentDataManager(e.plugin,()=> 'inbox',()=>({}),()=>initializing);manager.loadTasks=async()=>{loads++;};
 await manager.registerDataflowListeners();e.app.workspace.trigger('task-genius:task-cache-updated');await new Promise(resolve=>setTimeout(resolve,550));assert.equal(loads,0);
 initializing=false;await manager.finishInitialization();assert.equal(loads,1);manager.unload();e.close();
});

test('real calendar engine navigation keeps month, week, day and year headers synchronized',()=>{
 const e=environment();globalThis.getComputedStyle=window.getComputedStyle.bind(window);globalThis.requestAnimationFrame=window.requestAnimationFrame;
 const calendar=new CalendarComponent(e.app,e.plugin,document.body.createDiv());calendar.currentDate=moment('2026-11-08');
 for(const mode of ['month','week','day','year']){
  calendar.currentViewMode=mode;calendar.render();const first=calendar.dateDisplayEl.textContent;
  calendar.navigate('next');assert.notEqual(calendar.dateDisplayEl.textContent,first,mode);
  calendar.navigate('prev');assert.equal(calendar.dateDisplayEl.textContent,first,mode);
  if(mode==='year')assert.equal(calendar.containerEl.querySelectorAll('.calendar-mini-month').length,12);
 }
 calendar.tgCalendar?.destroy();calendar.containerEl.remove();e.close();
});

test('new MCP tokens keep the existing format and do not use Math.random',()=>{
 const original=Math.random;Math.random=()=>{throw new Error('Weak randomness must not be used');};
 try{const token=AuthMiddleware.generateToken();assert.match(token,/^[A-Za-z0-9]{32}$/);}finally{Math.random=original;}
});

test('project names containing quotes and brackets can be selected without selector errors',()=>{
 const e=environment(),list=Object.create(ProjectList.prototype);list.containerEl=document.body.createDiv();
 const id='项目 "A" [阶段一]';const item=list.containerEl.createDiv({cls:'fluent-project-item'});item.dataset.projectId=id;
 assert.doesNotThrow(()=>list.setActiveProject(id));assert.equal(item.classList.contains('is-active'),true);list.setActiveProject(null);assert.equal(item.classList.contains('is-active'),false);e.close();
});
test('a removed sidebar project list cannot render after its pending query completes',async()=>{
 const e=environment();let resolve;const list=Object.create(ProjectList.prototype);let renders=0;
 Object.assign(list,{disposed:false,projectLoad:0,containerEl:document.body.createDiv(),plugin:{dataflowOrchestrator:{getQueryAPI:()=>({getAllTasks:()=>new Promise(done=>resolve=done)})}},render:()=>renders++});
 const load=list.loadProjects();list.onunload();resolve([]);await load;assert.equal(renders,0);e.close();
});

test('custom year and agenda views use their base period for navigation and header labels',()=>{
 const e=environment();e.plugin.settings.customCalendarViews=[{id:'custom-year',enabled:true,baseViewType:'year'},{id:'custom-agenda',enabled:true,baseViewType:'agenda'}];const calendar=new CalendarComponent(e.app,e.plugin,document.body.createDiv());calendar.currentDate=moment('2026-11-08');
 calendar.currentViewMode='custom-year';assert.equal(calendar.getViewUnit(),'year');assert.equal(calendar.getCurrentDateDisplay(),'2026');calendar.currentViewMode='custom-agenda';assert.equal(calendar.getViewUnit(),'week');assert.ok(calendar.getCurrentDateDisplay().includes('2026'));e.close();
});
