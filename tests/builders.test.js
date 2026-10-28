import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers/env.js';
import { buildDiagram, CHART_TYPE_IDS, createChart, createGroup, createNode } from '../lib/mermaid-extras.js';
import { makeSamples } from '../demo/js/samples.js';

const TODAY = '2026-10-05';
const env = await setupEnv();
const { mermaid } = env;

async function parses(diagram) {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...diagram.config });
  return mermaid.parse(diagram.source);
}

test('every sample chart parses as its own type', async () => {
  const expected = { gantt: 'gantt', treeview: 'treeView', flowchart: 'flowchart-v2', swimlane: 'swimlane', kanban: 'kanban', mindmap: 'mindmap' };
  for (const chart of makeSamples(TODAY)) {
    const diagram = buildDiagram(chart, { today: TODAY });
    const result = await parses(diagram);
    assert.equal(result.diagramType, expected[chart.type], chart.name);
  }
});

test('every sample chart parses when viewed as every other type', async () => {
  for (const chart of makeSamples(TODAY)) {
    for (const type of CHART_TYPE_IDS) {
      const diagram = buildDiagram(chart, { type, today: TODAY });
      await assert.doesNotReject(parses(diagram), `${chart.name} viewed as ${type}`);
    }
  }
});

test('an empty chart of every type still parses', async () => {
  for (const type of CHART_TYPE_IDS) {
    const chart = createChart({ name: 'Empty', type });
    await assert.doesNotReject(parses(buildDiagram(chart, { today: TODAY })), type);
  }
});

test('charts with an awkward caption still parse', async () => {
  const awkward = ['Say "hi" now', 'Tom & Jerry <b>bold</b>', 'Colon: semi; hash # percent %% (brackets) [x] {y}', 'a'.repeat(120), 'ünïcödé – dash', ''];
  for (const type of CHART_TYPE_IDS) {
    const chart = createChart({ name: 'Awkward "name"', type });
    const group = createGroup(chart, { name: 'Group: "one"' });
    for (const caption of awkward) createNode(chart, { caption, groupId: group.id });
    await assert.doesNotReject(parses(buildDiagram(chart, { today: TODAY })), type);
  }
});

test('flow chart: groups, labelled connexions and the invisible "no group" group', () => {
  const chart = makeSamples(TODAY).find((c) => c.type === 'flowchart');
  const { source } = buildDiagram(chart);
  assert.match(source, /^flowchart TB$/m);
  assert.match(source, /subgraph sg\d+ \["Sign-up"\]/);
  assert.match(source, /subgraph sg0 \[" "\]/);       // the boxes that are in no group
  assert.match(source, /-- "yes" -->/);
  assert.ok(!/click /.test(source), 'no click directives: clicks are handled by the view');
});

test('flow chart: groups are listed highest order first, swimlanes lowest first', () => {
  const chart = makeSamples(TODAY).find((c) => c.type === 'flowchart');
  const flow = buildDiagram(chart).source;
  assert.ok(flow.indexOf('"Sign-up"') < flow.indexOf('"Set-up"'));
  const lanes = buildDiagram(chart, { type: 'swimlane' }).source;
  assert.ok(lanes.indexOf('"Set-up"') < lanes.indexOf('"Sign-up"'));
});

test('kanban: priorities, assignees, and Critical sent as Very High', () => {
  const chart = makeSamples(TODAY).find((c) => c.type === 'kanban');
  const d = buildDiagram(chart);
  assert.match(d.source, /priority: "Very High"/);
  assert.match(d.source, /assigned: "Sam"/);
  assert.deepEqual(d.meta.kanbanCriticalIds.length, 1);
  assert.ok(!/priority: "Medium"/.test(d.source), 'Medium has no stripe, so it is left out');
});

test('kanban with no columns gets a placeholder so Mermaid can draw it', async () => {
  const chart = createChart({ type: 'kanban' });
  const d = buildDiagram(chart);
  assert.match(d.source, /cardplaceholder/);
  await parses(d);
});

test('mind map: indentation, wrappers, and the node index used for clicks', () => {
  const chart = makeSamples(TODAY).find((c) => c.type === 'mindmap');
  const d = buildDiagram(chart);
  assert.match(d.source, /\)"Planning a conference"\(/);
  assert.equal(d.meta.mindmapNodeIndex[0], 0);
  assert.equal(d.meta.mindmapNodeIndex.length, chart.nodes.length + 1);
  assert.match(d.source, /\{\{"Keynote"\}\}/);     // hex -> hexagon
});

test('tree view: nesting, folders, highlight, icons and descriptions', () => {
  const chart = makeSamples(TODAY).find((c) => c.type === 'treeview');
  const d = buildDiagram(chart);
  assert.match(d.source, /^treeView-beta$/m);
  assert.match(d.source, /^ {8}lib\/ :::highlight ## the library/m);
  assert.match(d.source, /^ {12}"mermaid-extras\.js" ## the entry point$|^ {12}mermaid-extras\.js ## the entry point$/m);
  assert.equal(d.config.treeView.showIcons, true);
  assert.equal(d.config.treeView.extensionIcons.js, 'javascript');
  assert.equal(d.meta.treeviewOrder.length, chart.nodes.length);
});

test('tree view: items with children are always folders; loops cannot hide boxes', () => {
  const chart = createChart({ type: 'treeview' });
  const a = createNode(chart, { caption: 'a' });
  const b = createNode(chart, { caption: 'b', parents: [{ id: a.id, label: '' }] });
  a.parents = [{ id: b.id, label: '' }];            // a loop: a -> b -> a
  const d = buildDiagram(chart);
  assert.equal(d.meta.treeviewOrder.length, 2);
});

test('the same chart can be drawn as any type without changing it', () => {
  const chart = makeSamples(TODAY)[0];
  const before = JSON.stringify(chart);
  for (const type of CHART_TYPE_IDS) buildDiagram(chart, { type, today: TODAY });
  assert.equal(JSON.stringify(chart), before);
});

test('a Gantt task whose name starts like a Mermaid command still parses', async () => {
  const chart = createChart({ type: 'gantt' });
  for (const caption of ['Call the client', 'Click here to start', 'topAxis review', 'Gantt review']) createNode(chart, { caption });
  const d = buildDiagram(chart, { today: TODAY });
  await assert.doesNotReject(parses(d));
});
