import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

// A minimal Obsidian surface lets us exercise the actual render/write code
// without a running desktop vault. Stats and date utilities remain real.
const result = await build({
  stdin: { contents: 'export { HabitsCompact } from "./src/integrations/habits/ui/habits-compact"; export { HabitsBlock } from "./src/integrations/habits/ui/habits-block";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'obsidian-test-surface', setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      export class Component {
        children = []; cleanups = [];
        addChild(c) { this.children.push(c); c.onload?.(); return c; }
        removeChild(c) { c.unload(); this.children = this.children.filter(x => x !== c); }
        registerDomEvent(el, type, fn) { el.handlers[type] = fn; this.cleanups.push(() => delete el.handlers[type]); }
        registerEvent() {}
		register(fn) { this.cleanups.push(fn); }
        unload() { this.onunload?.(); this.children.forEach(c => c.unload()); this.cleanups.forEach(f => f()); }
      }
      export class MarkdownRenderChild extends Component { constructor(root) { super(); this.containerEl = root; } }
      export class App {} export class TFile {} export class Notice { constructor(message) { globalThis.lastNotice = message; } }
      export class Modal { constructor(app) { this.app = app; this.modalEl = {addClass() {}}; } open() { globalThis.lastModal = this; } close() {} }
      export class Setting {}
      export class Menu {
        items = []; separators = 0;
        addSeparator() { this.separators++; return this; }
        addItem(fn) { const item = { setTitle(title) { this.title = title; return this; }, setIcon(icon) { this.icon = icon; return this; }, onClick(fn) { this.click = fn; return this; } }; fn(item); this.items.push(item); return this; }
        showAtPosition(position) { this.position = position; globalThis.lastMenu = this; globalThis.menuCount = (globalThis.menuCount ?? 0) + 1; }
      }
      export const debounce = fn => fn;
      export const normalizePath = s => s;
      export const setIcon = (el, icon) => { el.icon = icon; };
      export const setTooltip = () => {};
      export const moment = {};
    ` }));
    build.onLoad({ filter: /i18n[\\/]index\.ts$/ }, () => ({ contents: 'export const t = (s, vars = {}) => s.replace(/\\{(.*?)\\}/g, (_, k) => vars[k]);' }));
    build.onLoad({ filter: /ui[\\/]habit-modal\.ts$/ }, () => ({ contents: 'export class HabitModal { constructor(...args) { this.args = args; } open() { globalThis.lastHabitModal = this; } }' }));
    build.onLoad({ filter: /ui[\\/]confirm-modal\.ts$/ }, () => ({ contents: 'export class ConfirmModal { constructor(app, options) { this.options = options; } open() { globalThis.lastConfirmation = this.options; } }' }));
    build.onLoad({ filter: /ui[\\/]dashboard\.ts$/ }, () => ({ contents: 'import { MarkdownRenderChild } from "obsidian"; export class HabitsDashboard extends MarkdownRenderChild { constructor(a, s, g, e, p, root) { super(root); } onload() { this.containerEl.createSpan({ text: "Card dashboard" }); } }' }));
    build.onLoad({ filter: /ui[\\/]icon-suggest-modal\.ts$/ }, () => ({ contents: 'export const applyHabitIcon = (el, icon) => { el.icon = icon; };' }));
    build.onLoad({ filter: /ui[\\/]stats-view\.ts$/ }, () => ({ contents: 'export const renderStatsView = () => {};' }));
    build.onLoad({ filter: /[\\/]note-habit\.ts$/ }, () => ({ contents: 'export const notePathForDate = (h, k) => `${h.noteFolder}/${k}.md`; export const createNoteHabitEntry = async () => null;' }));
  } }],
});
const { HabitsCompact, HabitsBlock } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
class Element {
  children = []; handlers = {}; attrs = {}; dataset = {}; classes = new Set();
  win = { timers: new Map(), setTimeout(fn) { const id = this.timers.size + 1; this.timers.set(id, fn); return id; }, clearTimeout(id) { this.timers.delete(id); } };
  constructor(tag = 'div', options = {}) { this.tag = tag; this.text = options.text ?? ''; this.attrs = options.attr ?? {}; this.className = options.cls ?? ''; }
  createEl(tag, options) { const el = new Element(tag, options); this.children.push(el); return el; }
  createDiv(options) { return this.createEl('div', options); }
  createSpan(options) { return this.createEl('span', options); }
  addClass(cls) { this.classes.add(cls); }
  toggleClass(cls, active) { if (active) this.classes.add(cls); else this.classes.delete(cls); }
  setCssProps() {} setAttribute(key, value) { this.attrs[key] = value; }
  empty() { this.children = []; }
  all() { return [this, ...this.children.flatMap(el => el.all())]; }
}
function fixture(overrides = {}, write = async () => {}, extra = {}) {
  const habit = { path: 'Habits/Test.md', name: 'Test', type: 'repetition', frequency: 'daily', target: 5, unit: 'cups', goalDirection: 'min', startDate: '2020-01-01', records: {}, pauses: [], reschedules: [], failed: [], skipped: [], times: [], group: '', ...overrides };
  const events = {};
  const app = { metadataCache: { on: (name, fn) => { events[name] = fn; } }, vault: { on() {}, getAbstractFileByPath() {} }, workspace: { openLinkText() {} } };
  const snoozes = {};
  const store = {
    getHabits: () => structuredClone([habit, ...(extra.habits ?? [])]), setRecord: write, dayCalls: [], snoozes,
    snoozedUntil: (h, now = Date.now()) => (snoozes[h.path] > now ? snoozes[h.path] : null),
    snoozeHabit: async (h, until) => { snoozes[h.path] = until; },
    clearSnooze: async h => { delete snoozes[h.path]; },
    // Mirrors the real store: the passed habit's lists change, the cached copy doesn't.
    setDayStatus: async (h, key, status) => {
      store.dayCalls.push([h.path, key, status]);
      h.failed = (h.failed ?? []).filter(d => d !== key); h.skipped = (h.skipped ?? []).filter(d => d !== key);
      if (status) h[status].push(key);
    },
  };
  const settings = { habitsFolder: 'Habits', sortMode: 'name', manualOrder: [], groups: {}, groupOrder: [], experimental: {}, statusOrdering: true, ...extra.settings };
  const root = new Element();
  const view = new HabitsCompact(app, store, () => settings, { on() {} }, 'Dashboard.md', root);
  view.selectedDate = new Date(2026, 9, 12); view.onload();
  const button = label => root.all().find(el => el.attrs['aria-label'] === label);
  const text = () => root.all().map(el => el.text).join('');
  return { view, root, habit, events, button, text, app, store, settings };
}

const rowNames = root => root.all().filter(el => el.className === 'habits-compact-row').map(row => row.children.find(el => el.className === 'habits-compact-name').children.at(-1).text);

test('completed rows move down after saving and return when undone', async () => {
  const second = { path: 'Habits/Zebra.md', name: 'Zebra', type: 'binary', frequency: 'daily', target: 1, goalDirection: 'min', startDate: '2020-01-01', records: {}, pauses: [], reschedules: [], times: [], group: '' };
  const f = fixture({ name: 'Alpha', type: 'binary', target: 1 }, async () => {}, { habits: [second] });
  assert.deepEqual(rowNames(f.root), ['Alpha', 'Zebra']);
  f.button('Mark as done').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(rowNames(f.root), ['Zebra', 'Alpha']);
  const completed = f.root.all().find(el => el.className === 'habits-compact-row' && el.classes.has('is-done'));
  assert.ok(completed, 'completed row exposes its visual state');
  assert.ok(completed.all().some(el => el.attrs['aria-label'] === 'Mark as not done'), 'completed row remains interactive');
  f.button('Mark as not done').handlers.click(); await new Promise(setImmediate);
  assert.deepEqual(rowNames(f.root), ['Alpha', 'Zebra']);
  assert.equal(f.root.all().some(el => el.className === 'habits-compact-row' && el.classes.has('is-done')), false);
});

test('status order respects settings, selected date and paused rows', () => {
  const base = { type: 'binary', frequency: 'daily', target: 1, goalDirection: 'min', startDate: '2020-01-01', pauses: [], reschedules: [], times: [], group: '' };
  const f = fixture({ ...base, name: 'Alpha', records: { '2026-10-12': 1 } }, async () => {}, { habits: [
    { ...base, path: 'Habits/Beta.md', name: 'Beta', records: {} },
    { ...base, path: 'Habits/Gamma.md', name: 'Gamma', records: {}, pauses: [{ start: '2026-10-01', end: '' }] },
  ] });
  assert.deepEqual(rowNames(f.root), ['Beta', 'Alpha', 'Gamma']);
  f.button('Next day').handlers.click();
  assert.deepEqual(rowNames(f.root), ['Alpha', 'Beta', 'Gamma']);
  f.button('Previous day').handlers.click();
  f.settings.statusOrdering = false; f.events.changed({ path: 'other.md' });
  assert.deepEqual(rowNames(f.root), ['Alpha', 'Beta', 'Gamma']);
});

test('completed rows stay within their group', () => {
  const base = { type: 'binary', frequency: 'daily', target: 1, goalDirection: 'min', startDate: '2020-01-01', pauses: [], reschedules: [], times: [] };
  const f = fixture({ ...base, name: 'Alpha', group: 'First', records: { '2026-10-12': 1 } }, async () => {}, {
    habits: [
      { ...base, path: 'Habits/Beta.md', name: 'Beta', group: 'First', records: {} },
      { ...base, path: 'Habits/Gamma.md', name: 'Gamma', group: 'Second', records: {} },
    ],
    settings: { groupsEnabled: true, sortMode: 'group', groupOrder: ['First', 'Second'] },
  });
  assert.deepEqual(rowNames(f.root), ['Beta', 'Alpha', 'Gamma']);
});

test('date label opens the picker and a selected date changes the logged day', async () => {
  const writes = [];
  const f = fixture({}, async (...args) => writes.push(args));
  const input = f.root.all().find(el => el.className === 'habits-compact-date-input');
  const nav = f.root.all().find(el => el.className === 'habits-compact-nav');
  assert.deepEqual(nav.children.map(el => el.attrs['aria-label']), ['Previous day', 'Choose a date', 'Next day', 'Today']);
  assert.ok(f.root.children.includes(input), 'date picker must not occupy navigation space');
  let opened = false;
  input.showPicker = () => { opened = true; };
  f.button('Choose a date').handlers.click();
  assert.equal(opened, true);
  assert.equal(input.value, '2026-10-12');
  input.value = '2026-09-05'; input.handlers.change();
  f.button('Increase by 1').handlers.click(); await new Promise(setImmediate);
  assert.equal(writes[0][1], '2026-09-05');
  f.button('Today').handlers.click();
  const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  assert.equal(f.root.all().find(el=>el.className==='habits-compact-date-input').value,today);
});

test('successful writes bridge stale metadata, then accept external changes', async () => {
  const writes = [];
  const f = fixture({}, async (...args) => writes.push(args));
  f.button('Increase by 1').handlers.click();
  await new Promise(setImmediate);
  assert.match(f.text(), /1 \/ 5 cups/);
  f.button('Increase by 1').handlers.click();
  await new Promise(setImmediate);
  assert.equal(writes[1][2], 2);
  f.habit.records['2026-10-12'] = 4;
  f.events.changed({ path: f.habit.path });
  assert.match(f.text(), /4 \/ 5 cups/);
});

test('double clicks are serialized and changing dates cannot redirect a write', async () => {
  let release; const writes = [];
  const f = fixture({}, (...args) => { writes.push(args); return new Promise(r => { release = r; }); });
  const click = f.button('Increase by 1').handlers.click; click(); click();
  assert.equal(writes.length, 1);
  assert.equal(f.button('Increase by 1').disabled, true);
  f.button('Next day').handlers.click(); release();
  await new Promise(setImmediate);
  assert.equal(writes[0][1], '2026-10-12');
  assert.match(f.text(), /0 \/ 5 cups/);
  f.button('Previous day').handlers.click();
  assert.match(f.text(), /1 \/ 5 cups/);
});

test('failed saves preserve the count and restore controls', async () => {
  const f = fixture({}, async () => { throw new Error('disk full'); });
  f.button('Increase by 1').handlers.click(); await new Promise(setImmediate);
  assert.match(f.text(), /0 \/ 5 cups/);
  assert.equal(f.button('Increase by 1').disabled, false);
  assert.equal(globalThis.lastNotice, 'Could not save habit record.');
});

test('flexible totals span the week while steppers write only the selected day', async () => {
  const writes = [];
  const f = fixture({ frequency: 'flexibleWeekly', records: { '2026-10-12': 2, '2026-10-13': 1 } }, async (...args) => writes.push(args));
  f.button('Next day').handlers.click();
  assert.match(f.text(), /3 \/ 5 cups This week/);
  f.button('Increase by 1').handlers.click(); await new Promise(setImmediate);
  assert.equal(writes[0][2], 2);
  assert.match(f.text(), /4 \/ 5 cups This week/);
});

test('binary limits, paused habits, timed steps and listener cleanup', () => {
  const limit = fixture({ type: 'binary', goalDirection: 'max', target: 0 });
  assert.ok(limit.button('Mark as slipped'));
  const paused = fixture({ pauses: [{ start: '2026-10-01', end: '' }] });
  assert.match(paused.text(), /Paused/); assert.equal(paused.button('Increase by 1'), undefined);
  const timed = fixture({ type: 'timed' }); assert.ok(timed.button('Increase by 5')); assert.ok(timed.button('Decrease by 5'));
  const old = timed.button('Increase by 5'); timed.button('Next day').handlers.click();
  assert.equal(old.handlers.click, undefined);
  timed.view.unload(); assert.equal(timed.button('Increase by 5').handlers.click, undefined);
});

test('existing habits block switches layouts immediately and unloads old controls', () => {
  const root = new Element();
  const settings = { dashboardLayout: 'carousel', habitsFolder: 'Habits', sortMode: 'name', manualOrder: [], groups: {}, groupOrder: [], experimental: {} };
  const listeners = [];
  const events = { on: (_, fn) => { listeners.push(fn); } };
  const app = { metadataCache: { on() {} }, vault: { on() {} } };
  const block = new HabitsBlock(app, { getHabits: () => [] }, () => settings, events, 'Dashboard.md', root);
  block.onload();
  assert.ok(root.all().some(el => el.text === 'Card dashboard'));
  settings.dashboardLayout = 'compact'; listeners[0]();
  assert.ok(root.all().some(el => el.className === 'habits-compact-header'));
  assert.equal(root.all().some(el => el.text === 'Card dashboard'), false);
  const plus = root.all().find(el => el.attrs['aria-label'] === 'Add habit');
  settings.dashboardLayout = 'grid'; listeners[0]();
  assert.equal(plus.handlers.click, undefined);
  assert.ok(root.all().some(el => el.text === 'Card dashboard'));
  assert.equal(block.children.length, 1);
});

const item = (menu, title) => menu.items.find(i => i.title === title);

function openMenu(f) {
  const row = f.root.all().find(el => el.className === 'habits-compact-row');
  let prevented = false, stopped = false;
  row.handlers.contextmenu({ clientX: 100, clientY: 200, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.equal(prevented, true); assert.equal(stopped, true);
  assert.deepEqual(globalThis.lastMenu.position, { x: 100, y: 200 });
  openMenu.last = { row, menu: globalThis.lastMenu };
  return openMenu.last;
}

test('right-click offers working open, edit and pause actions', async () => {
  const f = fixture(); let opened, paused;
  f.app.workspace.openLinkText = (...args) => { opened = args; };
  f.store.pauseHabit = async h => { paused = h.path; };
  const { menu } = openMenu(f);
  assert.deepEqual(menu.items.map(i => i.title), ['Fail this day', 'Skip this day', 'Open note', 'Edit habit', 'Pause habit', 'Stop tracking', 'Remove habit']);
  assert.equal(menu.separators, 1, 'day actions are set apart from the rest');
  item(menu, 'Open note').click(); assert.deepEqual(opened, [f.habit.path, 'Dashboard.md', false]);
  item(menu, 'Edit habit').click(); assert.equal(globalThis.lastHabitModal.args[3].path, f.habit.path);
  assert.equal(globalThis.lastHabitModal.args.length, 5, 'modal takes no limit-habit flag any more');
  await item(menu, 'Pause habit').click(); assert.equal(paused, f.habit.path);
});

test('paused rows retain their menu and offer resume instead of pause', async () => {
  const f = fixture({ paused: true, pauses: [{ start: '2026-10-01', end: '' }] }); let resumed;
  f.store.resumeHabit = async h => { resumed = h.path; };
  const { menu } = openMenu(f);
  assert.equal(item(menu, 'Fail this day'), undefined, 'a paused day has nothing to fail or skip');
  await item(menu, 'Resume habit').click(); assert.equal(resumed, f.habit.path);
});

test('stop and remove are deferred until confirmation', async () => {
  const f = fixture(); const calls = [];
  f.store.stopHabit = async h => calls.push(['stop', h.path]);
  f.store.deleteHabit = async h => calls.push(['delete', h.path]);
  const { menu } = openMenu(f);
  item(menu, 'Stop tracking').click(); assert.deepEqual(calls, []);
  assert.equal(globalThis.lastConfirmation.title, 'Stop tracking');
  await globalThis.lastConfirmation.onConfirm();
  item(menu, 'Remove habit').click(); assert.equal(calls.length, 1);
  assert.equal(globalThis.lastConfirmation.danger, true);
  await globalThis.lastConfirmation.onConfirm();
  assert.deepEqual(calls, [['stop', f.habit.path], ['delete', f.habit.path]]);
});

test('long-press opens once, movement cancels it, and redraw removes timers', () => {
  const f = fixture(); const row = f.root.all().find(el => el.className === 'habits-compact-row');
  const count = globalThis.menuCount ?? 0;
  row.handlers.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
  const fn = [...row.win.timers.values()][0]; row.win.timers.clear(); fn();
  assert.equal(globalThis.menuCount, count + 1);
  row.handlers.contextmenu({ clientX: 100, clientY: 200, preventDefault() {}, stopPropagation() {} });
  assert.equal(globalThis.menuCount, count + 1);
  row.handlers.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
  row.handlers.touchmove({ touches: [{ clientX: 120, clientY: 200 }] });
  assert.equal(row.win.timers.size, 0);
  row.handlers.touchstart({ touches: [{ clientX: 100, clientY: 200 }] });
  f.button('Next day').handlers.click();
  assert.equal(row.win.timers.size, 0); assert.equal(row.handlers.contextmenu, undefined);
});

const hiddenToggle = root => root.all().find(el => el.className === 'habits-closed-toggle');
const toggleText = root => hiddenToggle(root)?.children.at(-1).text;

test('fail hides the row, lists it underneath, and undo brings it back', async () => {
  const zebra = { path: 'Habits/Zebra.md', name: 'Zebra', type: 'binary', frequency: 'daily', target: 1, goalDirection: 'min', startDate: '2020-01-01', records: {}, pauses: [], reschedules: [], failed: [], skipped: [], times: [], group: '' };
  const f = fixture({ name: 'Alpha', type: 'binary', target: 1 }, async () => {}, { habits: [zebra] });
  assert.deepEqual(rowNames(f.root), ['Alpha', 'Zebra']);
  assert.equal(hiddenToggle(f.root), undefined, 'nothing hidden yet');
  const { menu } = openMenu(f);
  await item(menu, 'Fail this day').click();
  assert.deepEqual(f.store.dayCalls, [[f.habit.path, '2026-10-12', 'failed']]);
  assert.deepEqual(rowNames(f.root), ['Zebra'], 'failed habit leaves the list before the cache catches up');
  assert.equal(toggleText(f.root), '1 hidden for this day');
  hiddenToggle(f.root).handlers.click();
  const hidden = f.root.all().find(el => el.className === 'habits-closed-row is-failed');
  assert.ok(hidden, 'listed as failed');
  assert.ok(hidden.all().some(el => el.text === 'Failed'));
  await hidden.all().find(el => el.text === 'Undo').handlers.click();
  assert.deepEqual(f.store.dayCalls.at(-1), [f.habit.path, '2026-10-12', null]);
  assert.deepEqual(rowNames(f.root), ['Alpha', 'Zebra']);
  assert.equal(hiddenToggle(f.root), undefined);
});

test('skipping works the same way, and the list reads as nothing left', async () => {
  const f = fixture({ type: 'binary', target: 1 });
  await item(openMenu(f).menu, 'Skip this day').click();
  assert.deepEqual(rowNames(f.root), []);
  assert.match(f.text(), /Nothing left on this day's list\./);
  hiddenToggle(f.root).handlers.click();
  assert.ok(f.root.all().some(el => el.className === 'habits-closed-row is-skipped'));
});

test('a completed habit cannot be failed, but a limit habit always can', () => {
  const done = fixture({ type: 'binary', target: 1, records: { '2026-10-12': 1 } });
  assert.equal(item(openMenu(done).menu, 'Fail this day'), undefined);
  const limit = fixture({ type: 'binary', target: 0, goalDirection: 'max' });
  assert.ok(item(openMenu(limit).menu, 'Fail this day'));
});

test('snooze is offered for today only, hides the row and schedules its return', async () => {
  const f = fixture({ type: 'binary', target: 1 });
  assert.equal(item(openMenu(f).menu, 'Snooze…'), undefined, 'not for another day');
  f.view.selectedDate = new Date(); f.view.render();
  f.view.lastMenuAt = -Infinity;
  const snooze = item(openMenu(f).menu, 'Snooze…');
  assert.ok(snooze); assert.ok(item(openMenu.last.menu, 'Fail for today'));
  snooze.click();
  assert.equal(globalThis.lastModal.constructor.name, 'SnoozeModal');
  await f.store.snoozeHabit(f.habit, Date.now() + 60_000); f.view.render();
  assert.deepEqual(rowNames(f.root), []);
  assert.equal(toggleText(f.root), '1 hidden for today');
  assert.equal(f.root.win.timers.size, 1, 'refresh scheduled for when the snooze ends');
  hiddenToggle(f.root).handlers.click();
  assert.ok(f.root.all().some(el => /^Snoozed until /.test(el.text)));
  await f.root.all().find(el => el.text === 'Undo').handlers.click();
  assert.deepEqual(rowNames(f.root), ['Test']);
  f.view.unload();
  assert.equal(f.root.win.timers.size, 0, 'pending refresh cancelled on unload');
});

test('counted habits step by their own decimal step size', async () => {
  const writes = [];
  const f = fixture({ step: 0.1, target: 1.5, unit: 'L' }, async (...args) => writes.push(args));
  assert.ok(f.button('Increase by 0.1') && f.button('Decrease by 0.1'));
  for (let i = 0; i < 3; i++) { f.button('Increase by 0.1').handlers.click(); await new Promise(setImmediate); }
  assert.deepEqual(writes.map(w => w[2]), [0.1, 0.2, 0.3], 'no floating-point drift');
  assert.match(f.text(), /0\.3 \/ 1\.5 L/);
  f.button('Decrease by 0.1').handlers.click(); await new Promise(setImmediate);
  assert.equal(writes.at(-1)[2], 0.2);
});
