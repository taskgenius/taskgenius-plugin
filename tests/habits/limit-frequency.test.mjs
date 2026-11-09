import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const built = await build({ entryPoints: ['src/integrations/habits/stats.ts'], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'obsidian-stubs', setup(b) {
  b.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const moment = {};' }));
  b.onLoad({ filter: /i18n\/index\.ts$/ }, () => ({ contents: 'export const t = s => s;' }));
} }] });
const { isActive, isDue, isComplete, flexiblePeriodTotal, currentStreak, longestStreak, habitStats } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const date = key => { const [y,m,d] = key.split('-').map(Number); return new Date(y,m-1,d); };
const habit = overrides => ({ type: 'repetition', goalDirection: 'max', frequency: 'daily', target: 2, startDate: '2026-10-01', records: {}, pauses: [], reschedules: [], weekdays: [1,3], monthDay: 31, intervalDays: 2, ...overrides });

test('daily limits preserve equality, zero allowance and existing semantics', () => {
  const h = habit({ records: { '2026-10-12': 2, '2026-10-13': 3 } });
  assert.equal(isComplete(h, '2026-10-12'), true);
  assert.equal(isComplete(h, '2026-10-13'), false);
  assert.equal(isComplete(h, '2026-10-11'), true);
  assert.equal(isComplete(h, '2026-09-30'), false);
});
test('scheduled weekly limits only count their selected due days', () => {
  const h = habit({ frequency: 'weekly', startDate: '2026-10-12', records: { '2026-10-12': 2, '2026-10-13': 99, '2026-10-14': 3 } });
  assert.equal(isActive(h, date('2026-10-13')), false);
  assert.equal(isActive(h, date('2026-10-14')), true);
  const s = habitStats(h, { start: date('2026-10-12'), end: date('2026-10-14') }, date('2026-10-14'));
  assert.equal(s.days, 2); assert.equal(s.completed, 1); assert.equal(s.total, 5);
});
test('monthly date clamping and interval anchors work for limits', () => {
  const monthly = habit({ frequency: 'monthly', startDate: '2026-01-01' });
  assert.equal(isDue(monthly, date('2026-02-28')), true);
  assert.equal(isDue(monthly, date('2026-02-27')), false);
  const interval = habit({ frequency: 'interval', startDate: '2026-10-12' });
  assert.equal(isActive(interval, date('2026-10-11')), false);
  assert.equal(isActive(interval, date('2026-10-13')), false);
  assert.equal(isActive(interval, date('2026-10-14')), true);
});
test('weekly totals cross days, stop at selected day, and reset on Monday', () => {
  const h = habit({ frequency: 'flexibleWeekly', records: { '2026-10-12': 1, '2026-10-13': 1, '2026-10-14': 1 } });
  assert.equal(flexiblePeriodTotal(h, date('2026-10-13')), 2);
  assert.equal(isComplete(h, '2026-10-13'), true);
  assert.equal(isComplete(h, '2026-10-14'), false);
  assert.equal(isActive(h, date('2026-10-15')), true);
  assert.equal(isComplete(h, '2026-10-19'), true);
});
test('monthly zero and binary limits reject any consumption in the period', () => {
  for (const extra of [{ target: 0 }, { type: 'binary', target: 999 }]) {
    const h = habit({ frequency: 'flexibleMonthly', records: { '2026-10-02': 1 }, ...extra });
    assert.equal(isComplete(h, '2026-10-01'), true);
    assert.equal(isComplete(h, '2026-10-20'), false);
    assert.equal(isComplete(h, '2026-11-01'), true);
    assert.equal(isComplete(h, '2026-09-30'), false);
  }
});
test('exceeding an open weekly limit breaks streaks; correction restores them', () => {
  const h = habit({ frequency: 'flexibleWeekly', startDate: '2026-10-05', records: { '2026-10-06': 2, '2026-10-12': 3 } });
  assert.equal(currentStreak(h, date('2026-10-13')), 0);
  assert.equal(longestStreak(h, date('2026-10-13')), 1);
  h.records['2026-10-12'] = 2;
  assert.equal(currentStreak(h, date('2026-10-13')), 2);
});
test('completed period statistics exclude fully paused weeks and count zero consumption', () => {
  const h = habit({ frequency: 'flexibleWeekly', startDate: '2026-10-05', pauses: [{ start: '2026-10-12', end: '2026-10-18' }], records: { '2026-10-06': 3 } });
  const s = habitStats(h, { start: date('2026-10-05'), end: date('2026-10-25') }, date('2026-10-25'));
  assert.equal(s.days, 2); assert.equal(s.completed, 1); assert.equal(s.total, 3);
});
test('minimum flexible goals retain unfinished-period grace', () => {
  const h = habit({ goalDirection: 'min', frequency: 'flexibleWeekly', startDate: '2026-10-05', records: { '2026-10-06': 2 } });
  assert.equal(isComplete(h, '2026-10-13'), false);
  assert.equal(currentStreak(h, date('2026-10-13')), 1);
});
