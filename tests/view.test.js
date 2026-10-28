import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv, freshRoot, fakeLayout } from './helpers/env.js';
import { ChartView, createChart, createNode, nullStorage, chartToTable, tableToCSV, resolveTarget } from '../lib/mermaid-extras.js';
import { makeSamples } from '../demo/js/samples.js';

const env = await setupEnv();
const TODAY = new Date().toISOString().slice(0, 10);

function memoryStorage() {
  const data = new Map();
  return { get: (k) => (data.has(k) ? data.get(k) : null), set: (k, v) => data.set(k, String(v)), remove: (k) => data.delete(k), data };
}

async function makeView(options = {}) {
  const container = freshRoot(env);
  const view = new ChartView(container, { mermaid: env.mermaid, iconPacks: false, ...options });
  fakeLayout(view.scroller);
  return view;
}

const sample = (type) => makeSamples(TODAY).find((c) => c.type === type);

test('ChartView needs Mermaid', () => {
  assert.throws(() => new ChartView(freshRoot(env), {}), /needs the Mermaid object/);
});

test('renders each sample chart into an SVG and says so', async () => {
  for (const type of ['flowchart', 'swimlane', 'kanban', 'treeview', 'gantt']) {
    const view = await makeView({ storage: nullStorage });
    let rendered = null;
    view.on('rendered', (detail) => { rendered = detail; });
    await view.render(sample(type));
    assert.ok(view.canvas.querySelector('svg'), type);
    assert.equal(rendered.type, type);
    view.destroy();
  }
});

test('"view as" draws another type without touching the chart', async () => {
  const view = await makeView({ storage: nullStorage });
  const chart = sample('flowchart');
  const before = JSON.stringify(chart);
  await view.render(chart, { type: 'treeview' });
  assert.equal(view.viewType, 'treeview');
  assert.equal(view.chart.type, 'flowchart');
  assert.equal(JSON.stringify(chart), before);
});

test('clicking a flow chart box or group reports it', async () => {
  const view = await makeView({ storage: nullStorage });
  const targets = [];
  view.on('target', (t) => targets.push(t));
  await view.render(sample('flowchart'));
  const box = view.canvas.querySelector('.node[id*="-n2"]') || view.canvas.querySelector('.node');
  box.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(targets[0].kind, 'node');
  assert.ok(targets[0].id > 0);
  const group = view.canvas.querySelector('.cluster');
  group.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(targets[1].kind, 'group');
});

test('clicking a Kanban card reports the card, and only the column heading reports the column', async () => {
  const view = await makeView({ storage: nullStorage });
  const targets = [];
  view.on('target', (t) => targets.push(t));
  await view.render(sample('kanban'));
  view.canvas.querySelector('.node[id*="-n1"]').dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual([targets[0].kind, targets[0].id], ['node', 1]);
});

test('clicking a Gantt task bar reports the task', async () => {
  const view = await makeView({ storage: nullStorage });
  const targets = [];
  view.on('target', (t) => targets.push(t));
  await view.render(sample('gantt'));
  const bar = view.canvas.querySelector('rect.task[id$="-n3"]');
  assert.ok(bar, 'the bar for task 3 is drawn');
  bar.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.deepEqual([targets[0].kind, targets[0].id], ['node', 3]);
});

test('tree view rows are tagged, so they are clickable', async () => {
  const view = await makeView({ storage: nullStorage });
  const chart = sample('treeview');
  await view.render(chart);
  const tagged = view.canvas.querySelectorAll('[data-mx-node-id]');
  assert.equal(tagged.length, chart.nodes.length);
  const targets = [];
  view.on('target', (t) => targets.push(t));
  tagged[1].dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
  assert.equal(targets[0].kind, 'node');
});

test('image zoom: starts at 100%, steps, fits, and is remembered per chart and per view', async () => {
  const storage = memoryStorage();
  const view = await makeView({ storage });
  const chart = sample('flowchart');
  await view.render(chart);
  assert.equal(view.zoom.zoom, 1);
  view.zoom.in(); view.zoom.in();
  assert.equal(Math.round(view.zoom.zoom * 100), 120);
  assert.equal(storage.get(`zoom:${chart.id}`), String(view.zoom.zoom));
  view.zoom.out();
  view.zoom.reset();
  assert.equal(view.zoom.zoom, 1);
  view.zoom.set(0.5);

  const again = await makeView({ storage });
  await again.render(chart);
  assert.equal(again.zoom.zoom, 0.5);                       // remembered
  await again.render(chart, { type: 'treeview' });
  assert.equal(again.zoom.zoom, 1);                         // a "view as" has its own setting and starts at 100%
  again.zoom.set(1.5);
  assert.equal(storage.get(`zoom:${chart.id}:as-treeview`), '1.5');
  assert.equal(storage.get(`zoom:${chart.id}`), '0.5');     // ...and never changes the real chart's
  await again.render(chart);
  assert.equal(again.zoom.zoom, 0.5);                       // going back restores the real chart's zoom
});

test('image zoom stays within its limits', async () => {
  const view = await makeView({ storage: nullStorage });
  await view.render(sample('flowchart'));
  for (let i = 0; i < 60; i++) view.zoom.in();
  assert.equal(view.zoom.zoom, 3);
  for (let i = 0; i < 60; i++) view.zoom.out();
  assert.ok(Math.abs(view.zoom.zoom - 0.1) < 1e-9);
});

test('Gantt: the timeline starts at 7 weeks, zooms both ways, shows everything, and is remembered', async () => {
  const storage = memoryStorage();
  const view = await makeView({ storage });
  const chart = sample('gantt');
  const labels = [];
  view.on('timeline', (t) => labels.push(t));
  await view.render(chart);
  assert.ok(view.hasTimeline);
  const first = view.timeline.describe();
  assert.ok(Math.abs(first.daysShown - 49) < 1.5, `shows 7 weeks, got ${first.daysShown}`);

  await view.timelineLonger();
  const longer = view.timeline.describe();
  assert.ok(longer.daysShown > first.daysShown);
  await view.timelineShorter(); await view.timelineShorter();
  const shorter = view.timeline.describe();
  assert.ok(shorter.daysShown < first.daysShown);
  const saved = JSON.parse(storage.get(`timeline:${chart.id}`));
  assert.equal(saved.mode, 'days');

  await view.timelineShowAll();
  assert.equal(JSON.parse(storage.get(`timeline:${chart.id}`)).mode, 'all');
  assert.ok(view.timeline.describe().daysShown > longer.daysShown);

  await view.timelineDefault();
  assert.equal(storage.get(`timeline:${chart.id}`), null);   // the default isn't stored

  const again = await makeView({ storage });
  storage.set(`timeline:${chart.id}`, JSON.stringify({ mode: 'days', days: 20 }));
  await again.render(chart);
  assert.ok(Math.abs(again.timeline.describe().daysShown - 20) < 1.5, 'the remembered zoom comes back');
  assert.ok(labels.length > 3);
});

test('Gantt: unknown ends become a length based on the timeline on screen (a third of it)', async () => {
  const view = await makeView({ storage: nullStorage });
  await view.render(sample('gantt'));
  const t = view.timeline;
  const source = t.source(t.P);
  const days = t.unknownDays(t.P);
  assert.ok(Math.abs(days - t.viewDays() / 3) < 1);
  assert.ok(source.includes(`${days}d`));
  assert.ok(!source.includes('@@'));
});

test('Gantt: bars with an unknown end are masked, and arrows are drawn between dependent tasks', async () => {
  const view = await makeView({ storage: nullStorage });
  await view.render(sample('gantt'));
  assert.ok(view.canvas.querySelectorAll('rect.task[mask]').length >= 2);
  assert.ok(view.canvas.querySelector('g.mx-dependencies'));
  assert.ok(view.canvas.querySelector('#mxDependencyArrow'));
});

test('Gantt: section names get a white box and go back where they were for export', async () => {
  const view = await makeView({ storage: nullStorage });
  await view.render(sample('gantt'));
  assert.ok(view.canvas.querySelectorAll('rect.sectionTitleBg').length >= 1);
  view.scroller.scrollLeft = 400;
  view.pinTitles();
  const titles = [...view.canvas.querySelectorAll('text.sectionTitle')].filter((t) => t.textContent.trim());
  assert.ok(titles.every((t) => Number(t.getAttribute('x')) > 100), 'pinned to the scrolled edge');
  const exported = view.getSVG();
  assert.ok(!exported.includes('sectionTitleBg'));
  assert.ok(/<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/.test(exported));
  assert.ok(exported.includes('Product launch plan'), 'the chart name is written above the image');
});

test('export: the SVG is standalone, native sized and untouched by the on-screen zoom', async () => {
  const view = await makeView({ storage: nullStorage, exportTitle: false });
  await view.render(sample('kanban'));
  view.zoom.set(2);
  const svg = view.getSVG();
  assert.match(svg, /^<\?xml/);
  assert.ok(!/style="[^"]*width: ?\d+px/.test(svg.split('>')[1] || ''), 'the zoom is not baked into the export');
});

test('CSV and tables for every type', () => {
  for (const chart of makeSamples(TODAY)) {
    const { columns, rows } = chartToTable(chart);
    assert.ok(columns.length > 1, chart.type);
    assert.ok(rows.length > 0, chart.type);
    const csv = tableToCSV(columns, rows);
    assert.ok(csv.split('\r\n').length === rows.length + 1);
  }
  const gantt = chartToTable(sample('gantt'));
  assert.ok(gantt.rows.some((r) => r.includes('Not yet known')));
  assert.equal(tableToCSV(['a'], [['x "quoted", with comma']]), '"a"\r\n"x ""quoted"", with comma"');
});

test('resolveTarget ignores things that are not boxes', async () => {
  const view = await makeView({ storage: nullStorage });
  await view.render(sample('flowchart'));
  assert.equal(resolveTarget(view.canvas.querySelector('svg'), view.diagram, view.canvas), null);
  assert.equal(resolveTarget(null, view.diagram, view.canvas), null);
});

test('a chart Mermaid cannot draw emits an error and clears the old picture', async () => {
  const fake = { initialize: env.mermaid.initialize.bind(env.mermaid), render: async () => { throw new Error('boom'); }, mermaidAPI: env.mermaid.mermaidAPI };
  const broken = new ChartView(freshRoot(env), { mermaid: fake, storage: nullStorage });
  fakeLayout(broken.scroller);
  broken.canvas.innerHTML = '<svg id="old"></svg>';
  const seen = [];
  broken.on('error', (e) => seen.push(e));
  await assert.rejects(broken.render(createChart({ type: 'flowchart' })), /boom/);
  assert.equal(seen.length, 1);
  assert.equal(broken.canvas.querySelector('#old'), null);
});

test('rendering several times in a row finishes in order', async () => {
  const view = await makeView({ storage: nullStorage });
  const a = createChart({ name: 'A', type: 'flowchart' }); createNode(a, { caption: 'first' });
  const b = createChart({ name: 'B', type: 'treeview' }); createNode(b, { caption: 'second' });
  await Promise.all([view.render(a), view.render(b)]);
  assert.equal(view.chart.name, 'B');
  assert.equal(view.viewType, 'treeview');
});

test('mermaidConfig is passed to Mermaid, and the chart\'s own options are merged over it', async () => {
  const seen = [];
  const spy = { ...env.mermaid, initialize: (c) => { seen.push(c); return env.mermaid.initialize(c); }, render: env.mermaid.render.bind(env.mermaid), mermaidAPI: env.mermaid.mermaidAPI, registerIconPacks: env.mermaid.registerIconPacks && env.mermaid.registerIconPacks.bind(env.mermaid) };
  const view = new ChartView(freshRoot(env), { mermaid: spy, storage: nullStorage, iconPacks: false, mermaidConfig: { theme: 'neutral', themeVariables: { fontSize: '18px' } } });
  fakeLayout(view.scroller);
  await view.render(sample('kanban'));
  const last = seen[seen.length - 1];
  assert.equal(last.theme, 'neutral');
  assert.equal(last.securityLevel, 'strict');
  await view.render(sample('gantt'));
  const gantt = seen[seen.length - 1];
  assert.equal(gantt.theme, 'neutral');
  assert.equal(gantt.themeVariables.fontSize, '18px');            // yours is kept...
  assert.equal(gantt.themeVariables.activeTaskBkgColor, '#c3f0c3'); // ...alongside the chart's own colours
});
