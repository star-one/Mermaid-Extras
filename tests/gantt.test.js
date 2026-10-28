import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers/env.js';
import {
  buildDiagram, createChart, createGroup, createNode, loadStructure, normaliseChart, planGantt, scheduleTasks,
  stackFollowers, cleanGanttNodeSettings, cleanGanttSettings, ganttAxisLines, GANTT_UNKNOWN_END,
} from '../lib/mermaid-extras.js';
import { resolveGanttTemplate } from '../lib/src/builders/index.js';

const TODAY = '2026-10-05';
const env = await setupEnv();
const g = (settings) => ({ settings: { gantt: settings } });
const after = (...ids) => ids.map((id) => ({ id, label: '' }));

function render(diagram) {
  env.mermaid.initialize({ startOnLoad: false, ...diagram.config });
  return env.mermaid.parse(diagram.source);
}

function lines(diagram) { return diagram.source.split('\n'); }

test('a task is written with an id, a start and an end', () => {
  const chart = createChart({ type: 'gantt' });
  createNode(chart, { caption: 'Plan', ...g({ startMode: 'date', startDate: '2026-11-02', endMode: 'duration', durValue: 2, durUnit: 'w' }) });
  const text = buildDiagram(chart, { today: TODAY }).source;
  assert.match(text, /Plan :n1, 2026-11-02, 2w/);
  assert.match(text, /dateFormat YYYY-MM-DD/);
  assert.match(text, /weekday monday/);          // week-based ticks default to Monday
});

test('statuses, milestones and vertical markers', () => {
  const chart = createChart({ type: 'gantt' });
  createNode(chart, { caption: 'A', ...g({ tags: ['done', 'crit'], startMode: 'date', startDate: '2026-11-02' }) });
  createNode(chart, { caption: 'M', ...g({ kind: 'milestone', startMode: 'date', startDate: '2026-11-09' }) });
  createNode(chart, { caption: 'V', ...g({ kind: 'vert', startDate: '2026-11-16' }) });
  const text = buildDiagram(chart, { today: TODAY }).source;
  assert.match(text, /A :done, crit, n1, 2026-11-02, 1d/);
  assert.match(text, /M :milestone, n2, 2026-11-09, 0d/);
  assert.match(text, /V :vert, n3, 2026-11-16, 1d/);
});

test('"when the task before it ends" is written as an explicit after, so rearranging never changes a date', () => {
  const chart = createChart({ type: 'gantt' });
  const a = createNode(chart, { caption: 'A', ...g({ startMode: 'date', startDate: '2026-11-02' }) });
  const b = createNode(chart, { caption: 'B', ...g({ startMode: 'previous' }) });          // follows A (the task before it)
  createNode(chart, { caption: 'C', parents: after(a.id), ...g({ startMode: 'after' }) }); // also follows A
  const text = buildDiagram(chart, { today: TODAY }).source;
  assert.match(text, new RegExp(`B :n${b.id}, after n${a.id},`));
});

test('followers are stacked directly beneath what they follow; an order number overrides that', () => {
  const chart = createChart({ type: 'gantt' });
  const a = createNode(chart, { caption: 'A', ...g({ startMode: 'date', startDate: '2026-11-02' }) });
  const b = createNode(chart, { caption: 'B unrelated', ...g({ startMode: 'date', startDate: '2026-11-09' }) });
  const c = createNode(chart, { caption: 'C after A', parents: after(a.id), ...g({ startMode: 'after' }) });
  let plan = planGantt(loadStructure(normaliseChart(chart)));
  assert.deepEqual(plan.order.get(0), [a.id, c.id, b.id]);     // C sits beneath A, ahead of the unrelated B

  c.settings = { gantt: { startMode: 'after', order: 1 } };     // pinned by hand: it goes first, and is not stacked
  plan = planGantt(loadStructure(normaliseChart(chart)));
  assert.deepEqual(plan.order.get(0), [c.id, a.id, b.id]);
});

test('stackFollowers waits for every predecessor and survives loops', () => {
  assert.deepEqual(stackFollowers([1, 2, 3, 4], new Map([[3, [1, 2]], [4, [3]]])), [1, 2, 3, 4]);
  // 1 and 2 wait for each other: they can never be placed by the normal rule, but they must not be lost (or loop)
  const looped = stackFollowers([1, 2, 3], new Map([[1, [2]], [2, [1]]]));
  assert.deepEqual([...looped].sort(), [1, 2, 3]);
  assert.equal(looped[0], 3);                      // the unconstrained task is placed first, the looped ones after it
});

test('dependency edges are reported for the arrows', () => {
  const chart = createChart({ type: 'gantt' });
  const a = createNode(chart, { caption: 'A', ...g({ startMode: 'date', startDate: '2026-11-02' }) });
  const b = createNode(chart, { caption: 'B', parents: after(a.id), ...g({ startMode: 'after' }) });
  const d = buildDiagram(chart, { today: TODAY });
  assert.deepEqual(d.meta.ganttDependencies, [[a.id, b.id]]);
  chart.settings.gantt = { showDependencies: false };
  assert.deepEqual(buildDiagram(chart, { today: TODAY }).meta.ganttDependencies, []);
});

test('an unknown end is a placeholder in the template and a fixed length in the standalone source', async () => {
  const chart = createChart({ type: 'gantt' });
  const a = createNode(chart, { caption: 'Open ended', ...g({ startMode: 'date', startDate: '2026-11-02', endMode: 'unknown' }) });
  const b = createNode(chart, { caption: 'Waits for it', parents: after(a.id), ...g({ startMode: 'after' }) });
  const d = buildDiagram(chart, { today: TODAY });
  assert.ok(d.template.includes(GANTT_UNKNOWN_END));
  assert.ok(!d.source.includes(GANTT_UNKNOWN_END));
  assert.deepEqual(d.meta.ganttFades[a.id], { start: false, end: true });
  assert.deepEqual(d.meta.ganttFades[b.id], { start: true, end: false });      // its start depends on an unknown end, so it fades in
  const resolved = resolveGanttTemplate(d.template, { axisLines: ganttAxisLines(d.meta.ganttTimeline, 10), unknownDays: 16 });
  assert.match(resolved, /Open ended :n1, 2026-11-02, 16d/);
  await render({ config: d.config, source: resolved });
});

test('an unknown start is drawn from today, or from just before a known end', () => {
  const chart = createChart({ type: 'gantt' });
  createNode(chart, { caption: 'TBC', ...g({ startMode: 'unknown', endMode: 'duration', durValue: 2, durUnit: 'w' }) });
  createNode(chart, { caption: 'Ends 1 Dec', ...g({ startMode: 'unknown', endMode: 'date', endDate: '2026-12-01' }) });
  createNode(chart, { caption: 'Either end', ...g({ startMode: 'unknown', endMode: 'unknown' }) });
  const text = buildDiagram(chart, { today: TODAY }).source;
  assert.match(text, /TBC :n1, 2026-10-05, 2w/);
  assert.match(text, /Ends 1 Dec :n2, 2026-10-05, 2026-12-01/);
  assert.match(text, /Either end :n3, 2026-10-05, 14d/);
});

test('scheduling never loops forever on circular dependencies', () => {
  const chart = createChart({ type: 'gantt' });
  const a = createNode(chart, { caption: 'A', ...g({ startMode: 'after', endMode: 'duration' }) });
  const b = createNode(chart, { caption: 'B', parents: after(a.id), ...g({ startMode: 'after' }) });
  a.parents = after(b.id);
  const structure = loadStructure(normaliseChart(chart));
  const plan = planGantt(structure);
  assert.equal(scheduleTasks(plan.resolved, Date.UTC(2026, 9, 5)).size, 2);
});

test('settings: the title, excluded days, today marker and layout are written; colours are theme variables', () => {
  const chart = createChart({ type: 'gantt' });
  createNode(chart, { caption: 'A' });
  chart.settings.gantt = cleanGanttSettings({
    title: 'My plan: v2', excludeWeekends: '1', excludeDays: ['friday'], excludeDates: '2026-12-25\n2026-12-26\nnope', weekend: 'friday',
    todayMarker: 'custom', todayWidth: 4, todayColour: '#00ff00', compact: '1', topAxis: '1', showDependencies: '1', cfg: { barHeight: 30 },
    colActiveBg: '#abcdef',
  });
  const d = buildDiagram(chart, { today: TODAY });
  const text = d.source;
  assert.match(text, /title My plan: v2/);
  assert.match(text, /excludes weekends/);
  assert.match(text, /excludes friday/);
  assert.match(text, /excludes 2026-12-25 2026-12-26/);
  assert.match(text, /weekend friday/);
  assert.match(text, /todayMarker stroke-width:4px,stroke:#00ff00,opacity:0.5/);
  assert.equal(d.config.gantt.displayMode, 'compact');
  assert.equal(d.config.gantt.topAxis, true);
  assert.equal(d.config.gantt.barHeight, 30);
  assert.equal(d.config.themeVariables.activeTaskBkgColor, '#abcdef');
  assert.equal(d.config.themeVariables.taskBkgColor, '#bfc7ff');   // not started = the lavender that "active" used to be
});

test('the axis: day, week and month ticks as the timeline zooms, and a chosen format is respected', () => {
  const timeline = { axisFormat: '%b %-d', axisFormatChosen: false, weekday: 'monday', userTick: null };
  assert.match(ganttAxisLines(timeline, 30), /tickInterval 1day/);
  assert.match(ganttAxisLines(timeline, 8), /tickInterval 1week\n {4}weekday monday/);
  assert.match(ganttAxisLines(timeline, 2), /tickInterval 1month/);
  assert.match(ganttAxisLines({ ...timeline, axisFormat: '%d/%m/%Y', axisFormatChosen: true }, 30), /axisFormat %d\/%m\/%Y/);
  assert.match(ganttAxisLines({ ...timeline, userTick: { n: 2, unit: 'week' } }, 30), /tickInterval 2week/);
});

test('validation: dates, the one-day minimum, and "until"', () => {
  const ok = (input, ctx) => cleanGanttNodeSettings(input, ctx);
  assert.match(ok({ startMode: 'date' }).error, /start date/);
  assert.match(ok({ startMode: 'date', startDate: '2026-02-30' }).error, /start date/);
  assert.match(ok({ startMode: 'date', startDate: '2026-11-02', endMode: 'duration', durValue: 0.5 }).error, /one day/);
  assert.match(ok({ startMode: 'date', startDate: '2026-11-02', endMode: 'date', endDate: '2026-11-02' }).error, /at least a day/);
  assert.match(ok({ endMode: 'date' }).error, /end date/);
  assert.match(ok({ endMode: 'until', untilNode: 9 }, { validIds: [1, 2], selfId: 3 }).error, /runs until/);
  assert.match(ok({ endMode: 'until', untilNode: 3 }, { validIds: [1, 2, 3], selfId: 3 }).error, /runs until/);
  assert.equal(ok({ endMode: 'until', untilNode: 2 }, { validIds: [1, 2], selfId: 3 }).error, null);
  assert.equal(ok({ startMode: 'unknown', endMode: 'unknown' }).error, null);
  assert.equal(ok({ kind: 'milestone', startMode: 'unknown' }).settings.startMode, 'previous');   // a milestone is a known moment
  assert.equal(ok({ kind: 'vert', startMode: 'previous', startDate: '2026-11-02' }).settings.startMode, 'date');
});

test('every Gantt feature together still parses and renders', async () => {
  const chart = createChart({ type: 'gantt' });
  const s1 = createGroup(chart, { name: 'One: "first"' });
  const s2 = createGroup(chart, { name: 'Two' });
  const a = createNode(chart, { caption: 'A: task', groupId: s1.id, ...g({ tags: ['active'], startMode: 'date', startDate: '2026-10-01', endMode: 'duration', durValue: 1.5, durUnit: 'M' }) });
  const b = createNode(chart, { caption: 'B', groupId: s1.id, parents: after(a.id), ...g({ startMode: 'after', endMode: 'unknown' }) });
  const c = createNode(chart, { caption: 'C', groupId: s2.id, ...g({ startMode: 'unknown', endMode: 'date', endDate: '2027-01-15' }) });
  createNode(chart, { caption: 'D', groupId: s2.id, parents: after(b.id, c.id), ...g({ startMode: 'after', endMode: 'until', untilNode: c.id }) });
  createNode(chart, { caption: 'E milestone', groupId: s2.id, ...g({ kind: 'milestone', startMode: 'previous' }) });
  createNode(chart, { caption: 'F marker', groupId: 0, ...g({ kind: 'vert', startDate: '2026-12-01' }) });
  const d = buildDiagram(chart, { today: TODAY });
  const resolved = resolveGanttTemplate(d.template, { axisLines: ganttAxisLines(d.meta.ganttTimeline, 8), unknownDays: 12 });
  await render({ config: d.config, source: resolved });
  env.mermaid.initialize({ startOnLoad: false, ...d.config });
  const { svg } = await env.mermaid.render('gantt-all', resolved);
  assert.ok(svg.includes('<svg'));
  assert.ok(lines({ source: resolved }).some((l) => l.includes('axisFormat')));
});
