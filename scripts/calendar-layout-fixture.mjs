// Independent layout fixture: uses the calendar source and the planner's exported real DOM.
import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const output=path.resolve('output/playwright');fs.mkdirSync(output,{recursive:true});
await build({stdin:{resolveDir:process.cwd(),loader:'ts',contents:`
import {Calendar,DateFnsAdapter} from './packages/calendar/src';
import * as dateFns from 'date-fns';
const day=new Date();day.setHours(0,0,0,0);
const date=(hour,minute=0)=>{const result=new Date(day);result.setHours(hour,minute);return result.toISOString();};
const calendar=new Calendar(document.querySelector('#engine'),{dateAdapter:new DateFnsAdapter(dateFns),view:{type:'week',firstDayOfWeek:1},events:[
{id:'a',title:'Exercise',start:date(8),end:date(11)},
{id:'b',title:'Write',start:date(8,30),end:date(10)},
{id:'c',title:'Research',start:date(9),end:date(12)}
],theme:{cellHeight:60},onRenderEvent:ctx=>{ctx.defaultRender();const check=document.createElement('input');check.type='checkbox';check.className='task-list-item-checkbox';ctx.el.prepend(check);}});
calendar.goToDate(day);
window.layoutCalendar=calendar;
window.layoutDay=()=>calendar.setView('day');
window.layoutWorking=()=>{calendar.config.view.timeFilter=hour=>hour>=6&&hour<21;calendar.setView('day');calendar.refresh();};
`},bundle:true,format:'iife',platform:'browser',outfile:path.join(output,'calendar.js'),logLevel:'silent'});
const css=['packages/calendar/dist/styles.css','src/styles/taskgenius-calendar.css','src/styles/task-planner.css','src/styles/points-dashboard.css'].map(file=>fs.readFileSync(file,'utf8')).join('\n');
const planner=fs.readFileSync(path.join(output,'planner.html'),'utf8');const points=fs.existsSync(path.join(output,'points.html'))?fs.readFileSync(path.join(output,'points.html'),'utf8'):'';
const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Task Genius layout verification</title><style>
:root{--background-primary:#1e2021;--background-secondary:#272a2d;--background-secondary-alt:#30363b;--background-modifier-border:#454b50;--text-normal:#d7dce1;--text-muted:#a0a8b0;--interactive-accent:#6a97c0;--font-ui-medium:15px;--font-ui-small:13px;--font-ui-smaller:12px;--shadow-s:0 2px 5px #0006;--radius-s:5px;--size-4-3:12px;}
body{font:14px system-ui;background:#1e2021;color:#d7dce1;margin:20px}h2{font-size:18px}section{height:640px;margin-bottom:45px}button{background:#30363b;color:#d7dce1;border:1px solid #454b50;border-radius:5px;padding:5px 10px}input{accent-color:#6a97c0}
${css}
#engine{height:100%;width:100%;min-height:0}.full-calendar-container{height:640px}
</style></head><body class="theme-dark"><h2>Calendar week / day</h2><section class="full-calendar-container"><div id="engine"></div></section><h2>Task scheduler with 100 unplanned tasks</h2><section>${planner}</section><h2>Points and rewards</h2><section>${points}</section><script src="calendar.js"></script></body></html>`;
fs.writeFileSync(path.join(output,'layout.html'),html);
console.log('Layout fixture ready:',path.join(output,'layout.html'));
