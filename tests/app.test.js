import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers/env.js';

const env = await setupEnv();
globalThis.__MERMAID__ = env.mermaid;          // the demo uses this one instead of fetching Mermaid from a CDN
globalThis.__MX_NO_AUTOSTART__ = true;
const { startApp, parseRoute } = await import('../demo/js/app.js');
const { renderChartPage } = await import('../demo/js/views/chart-page.js');
const { renderDashboard } = await import('../demo/js/views/dashboard.js');
const { renderDocsPage, DOC_PAGES } = await import('../demo/js/views/docs-page.js');
const { createStore } = await import('../demo/js/store.js');
const { makeSamples } = await import('../demo/js/samples.js');
const { fakeLayout } = await import('./helpers/env.js');

const TODAY = new Date().toISOString().slice(0, 10);
const doc = env.document;

class MemoryStorage { constructor() { this.d = new Map(); } getItem(k) { return this.d.has(k) ? this.d.get(k) : null; } setItem(k, v) { this.d.set(k, String(v)); } removeItem(k) { this.d.delete(k); } }
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, what, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for ' + what);
    await wait(20);
  }
}
function freshStore() { const store = createStore({ storage: new MemoryStorage() }); store.ensureSeeded(() => makeSamples(TODAY)); return store; }
function freshRoot() { const root = doc.createElement('main'); doc.body.innerHTML = ''; doc.body.appendChild(root); return root; }
const click = (el) => el.dispatchEvent(new env.window.MouseEvent('click', { bubbles: true }));
const buttonByText = (root, text) => [...root.querySelectorAll('button, a.btn')].find((b) => b.textContent.trim() === text);
const dialog = () => doc.querySelector('dialog.modal');

async function openChart(store, id, query = '') {
  const root = freshRoot();
  const cleanup = renderChartPage(root, { store, id, params: new URLSearchParams(query), mermaid: env.mermaid, navigate: () => {} });
  fakeLayout(root.querySelector('.mx-scroll') || root, 1400);
  await waitFor(() => root.querySelector('.mx-canvas svg'), 'the chart to draw');
  return { root, cleanup };
}

test('routes', () => {
  assert.deepEqual(parseRoute('').name, 'dashboard');
  assert.deepEqual(parseRoute('#/chart/abc%20d?viewAs=gantt').id, 'abc d');
  assert.equal(parseRoute('#/chart/abc?viewAs=gantt').params.get('viewAs'), 'gantt');
  assert.deepEqual([parseRoute('#/docs/gantt').name, parseRoute('#/docs/gantt').slug], ['docs', 'gantt']);
  assert.equal(parseRoute('#/docs').slug, '');
});

test('the app starts, seeds the samples and shows the dashboard', () => {
  doc.body.innerHTML = '<main id="view"></main>';
  const app = startApp({ root: doc.getElementById('view'), storage: new MemoryStorage() });
  assert.equal(app.store.count(), 6);
  const text = doc.getElementById('view').textContent;
  assert.match(text, /Your charts/);
  assert.match(text, /live only in this browser/);
  assert.match(text, /can’t be shared/);                       // the demo says plainly that charts can't be shared
  assert.equal(doc.querySelectorAll('.chart-card').length, 6);
  assert.match(text, /Product launch plan/);
});

test('the dashboard: copy and delete', async () => {
  const store = freshStore(); const root = freshRoot();
  const ctx = { store, navigate: () => {}, makeSamples: () => makeSamples(TODAY), refreshNav: () => {} };
  renderDashboard(root, ctx);
  click(buttonByText(root.querySelector('.chart-card'), 'Copy'));
  assert.equal(store.count(), 7);
  const removeButton = buttonByText(root.querySelector('.chart-card'), 'Delete');
  click(removeButton);
  await waitFor(() => dialog(), 'the confirmation');
  click(buttonByText(dialog(), 'Delete'));
  await waitFor(() => store.count() === 6, 'the chart to go');
});

test('the dashboard: a new chart', async () => {
  const store = freshStore(); const root = freshRoot();
  let went = null;
  renderDashboard(root, { store, navigate: (h) => { went = h; }, makeSamples: () => makeSamples(TODAY), refreshNav: () => {} });
  click(buttonByText(root, 'New chart'));
  await waitFor(() => dialog(), 'the form');
  click(buttonByText(dialog(), 'Create chart'));
  assert.match(dialog().textContent, /give the chart a name/);   // refused, and the form stays open
  dialog().querySelector('input[type="text"]').value = 'Brand new';
  [...dialog().querySelectorAll('select')][0].value = 'treeview';
  click(buttonByText(dialog(), 'Create chart'));
  assert.equal(store.list().find((e) => e.chart.name === 'Brand new').chart.type, 'treeview');
  assert.match(went, /^#\/chart\//);
});

test('every sample chart opens, draws, and has its toolbar', async () => {
  const store = freshStore();
  for (const { chart } of store.list()) {
    const { root, cleanup } = await openChart(store, chart.id);
    assert.ok(root.querySelector('.toolbar'), chart.type);
    assert.ok(!/\bnull\b|undefined/.test(root.textContent), `${chart.type}: stray "null" or "undefined" on the page`);
    assert.match(root.querySelector('h1').textContent, new RegExp(chart.name.slice(0, 5)));
    assert.equal(root.querySelector('.tool-group[hidden]') === null, chart.type === 'gantt', `${chart.type}: the timeline controls appear for a Gantt chart only`);
    cleanup();
  }
});

test('click to edit: clicking a Gantt task opens its form, and saving changes the stored chart', async () => {
  const store = freshStore();
  const { root, cleanup } = await openChart(store, 'sample-gantt');
  click(root.querySelector('rect.task[id$="-n3"]'));
  await waitFor(() => dialog(), 'the edit form');
  assert.match(dialog().textContent, /Edit task/);
  const nameField = dialog().querySelector('input[type="text"]');
  assert.equal(nameField.value, 'Write the specification');
  nameField.value = 'Write the spec (v2)';
  click(buttonByText(dialog(), 'Save'));
  await waitFor(() => !dialog(), 'the form to close');
  assert.equal(store.get('sample-gantt').nodes.find((n) => n.id === 3).caption, 'Write the spec (v2)');
  await waitFor(() => /Write the spec \(v2\)/.test(root.textContent), 'the chart to redraw');
  cleanup();
});

test('a bad date is explained and nothing is saved', async () => {
  const store = freshStore();
  const { root, cleanup } = await openChart(store, 'sample-gantt');
  click(root.querySelector('rect.task[id$="-n3"]'));
  await waitFor(() => dialog(), 'the edit form');
  const radios = [...dialog().querySelectorAll('input[type="radio"]')];
  const dateStart = radios.find((r) => r.value === 'date'); dateStart.checked = true; dateStart.dispatchEvent(new env.window.Event('change', { bubbles: true }));
  const dateField = dialog().querySelector('input[type="date"]');
  assert.ok(dateField.value, 'the date starts filled in with today');
  dateField.value = '';                                   // ...and is cleared by the user
  click(buttonByText(dialog(), 'Save'));
  assert.match(dialog().querySelector('.form-error').textContent, /start date/);
  assert.ok(dialog(), 'the form stays open');
  click(buttonByText(dialog(), 'Cancel'));
  assert.equal(store.get('sample-gantt').nodes.find((n) => n.id === 3).settings.gantt.startMode, 'after');
  cleanup();
});

test('click to add: clicking a flow chart box starts a new box connected to it, in the same group', async () => {
  const store = freshStore();
  const { root, cleanup } = await openChart(store, 'sample-flowchart');
  click(buttonByText(root, 'Click to add'));
  const node = root.querySelector('.node[id*="-n2"]');
  click(node);
  await waitFor(() => dialog(), 'the add form');
  assert.match(dialog().textContent, /Add box/);
  const parent = dialog().querySelector('.parents-row select');
  assert.equal(parent.value, '2');
  const groupSelect = [...dialog().querySelectorAll('select')].find((s) => [...s.options].some((o) => /not in a group/.test(o.textContent)));
  assert.equal(groupSelect.value, '1');
  dialog().querySelector('input[type="text"]').value = 'A new step';
  click(buttonByText(dialog(), 'Add box'));
  await waitFor(() => !dialog(), 'the form to close');
  const added = store.get('sample-flowchart').nodes.find((n) => n.caption === 'A new step');
  assert.deepEqual([added.parents[0].id, added.groupId], [2, 1]);
  cleanup();
});

test('"view as": a mind map looked at as a Gantt chart is edited with task fields, and nothing about the chart changes', async () => {
  const store = freshStore();
  const before = JSON.stringify(store.get('sample-mindmap'));
  const { root, cleanup } = await openChart(store, 'sample-mindmap', 'viewAs=gantt');
  assert.match(root.querySelector('.notice-view').textContent, /temporary view/);
  assert.ok(!buttonByText(root, 'Edit chart'), 'chart settings can only be changed from the original view');
  assert.equal(JSON.stringify(store.get('sample-mindmap')), before);
  click(buttonByText(root, 'Add task'));
  await waitFor(() => dialog(), 'the add form');
  assert.match(dialog().textContent, /Task name/);
  dialog().querySelector('input[type="text"]').value = 'Plan the venue visit';
  click(buttonByText(dialog(), 'Add task'));
  await waitFor(() => !dialog(), 'the form to close');
  const saved = store.get('sample-mindmap');
  assert.equal(saved.type, 'mindmap', 'the chart is still a mind map');
  assert.ok(saved.nodes.find((n) => n.caption === 'Plan the venue visit').settings.gantt, 'the task fields were saved with the box');
  cleanup();
});

test('the "Change chart type view" panel leaves out nothing but sticks to the real types', async () => {
  const store = freshStore();
  const { root, cleanup } = await openChart(store, 'sample-treeview');
  click(buttonByText(root, 'Change chart type view'));
  await waitFor(() => dialog(), 'the panel');
  const links = [...dialog().querySelectorAll('a.btn')].map((a) => a.textContent);
  assert.deepEqual(links, ['Flow chart', 'Swimlanes', 'Mind map', 'Kanban board', 'Tree view', 'Gantt chart']);
  assert.ok([...dialog().querySelectorAll('a.btn')].find((a) => a.textContent === 'Gantt chart').href.endsWith('?viewAs=gantt'));
  assert.match(dialog().textContent, /as created/);
  cleanup();
});

test('the table shows the chart as rows, scrolls into view, can be hidden again, and the toolbar zoom works', async () => {
  const store = freshStore();
  const { root, cleanup } = await openChart(store, 'sample-kanban');
  const scrolled = [];
  env.window.Element.prototype.scrollIntoView = function scrollIntoView(options) { scrolled.push({ el: this, options }); };
  const panel = root.querySelector('.panel');
  assert.equal(panel.hidden, true);
  click(buttonByText(root, 'Table'));
  assert.equal(panel.hidden, false);
  assert.ok(root.querySelectorAll('.panel tbody tr').length >= 5);
  assert.equal(scrolled.at(-1).el, panel, 'the table is scrolled into view, because it opens below the chart');
  const toggle = buttonByText(root, 'Hide table');
  assert.ok(toggle, 'the button now says what it will do next');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  click(buttonByText(panel, 'Hide table'));                         // the Hide button in the table's own heading
  assert.equal(panel.hidden, true);
  assert.ok(buttonByText(root, 'Table'));
  assert.equal(scrolled.at(-1).el, root.querySelector('.chart-stage'), 'and the page scrolls back up to the chart');
  click(buttonByText(root, 'Table'));
  assert.equal(panel.hidden, false);
  const label = root.querySelector('.zoom-label');
  assert.equal(label.textContent, '100%');
  click(root.querySelector('[title="Zoom in"]'));
  assert.equal(label.textContent, '110%');
  click(buttonByText(root, '100%'));
  assert.equal(label.textContent, '100%');
  cleanup();
});

test('the Gantt timeline controls change what is shown, and show the label', async () => {
  const store = freshStore();
  const { root, cleanup } = await openChart(store, 'sample-gantt');
  const label = root.querySelector('.zoom-label-wide');
  await waitFor(() => /weeks shown/.test(label.textContent), 'the timeline label');
  const first = label.textContent;
  click(root.querySelector('[title="Show a longer period (less detail)"]'));
  await waitFor(() => label.textContent !== first, 'the label to change');
  click(buttonByText(root, '7 weeks'));
  await waitFor(() => label.textContent === first, 'the default to come back');
  cleanup();
});

test('a chart that is not in this browser says so, and does not crash', () => {
  const store = freshStore(); const root = freshRoot();
  renderChartPage(root, { store, id: 'someone-elses-chart', params: new URLSearchParams(), mermaid: env.mermaid, navigate: () => {} });
  assert.match(root.textContent, /not in this browser/);
});

test('documentation pages load from their files', async () => {
  const root = freshRoot();
  await renderDocsPage(root, { slug: 'gantt', fetchText: async (url) => { assert.match(url, /docs\/gantt\.md$/); return '# Gantt\n\n## One\n\ntext\n\n## Two\n\n```js\nx\n```\n'; } });
  assert.match(root.querySelector('article').innerHTML, /<h1 id="gantt">Gantt<\/h1>/);
  assert.equal(root.querySelectorAll('.docs-nav a').length, DOC_PAGES.length);
  assert.equal(root.querySelector('.docs-nav a.on').textContent, 'Gantt charts');
  assert.ok(root.querySelector('.copy-btn'));
  assert.equal(root.querySelectorAll('.docs-toc a').length, 2);
  await renderDocsPage(root, { slug: 'gantt', fetchText: async () => { throw new Error('404'); } });
  assert.match(root.textContent, /could not be loaded/);
  await renderDocsPage(root, { slug: 'no-such-page', fetchText: async () => '' });
  assert.match(root.textContent, /no documentation page/);
});

test('Edit chart: the form opens, warns about a change of type, saves, and can delete the chart', async () => {
  const store = freshStore();
  let went = null;
  const root = freshRoot();
  const cleanup = renderChartPage(root, { store, id: 'sample-flowchart', params: new URLSearchParams(), mermaid: env.mermaid, navigate: (hash) => { went = hash; } });
  fakeLayout(root.querySelector('.mx-scroll'), 1400);
  await waitFor(() => root.querySelector('.mx-canvas svg'), 'the chart to draw');

  click(buttonByText(root, 'Edit chart'));
  await waitFor(() => dialog(), 'the Edit chart form');
  const warn = dialog().querySelector('.notice-warn');
  assert.ok(warn && warn.hidden, 'no warning until the type is changed');
  const type = [...dialog().querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'gantt'));
  type.value = 'gantt'; type.dispatchEvent(new env.window.Event('change', { bubbles: true }));
  assert.ok(!warn.hidden);
  assert.match(warn.textContent, /Nothing will be deleted/);
  assert.match(warn.textContent, /groups become sections/);
  dialog().querySelector('input[type="text"]').value = 'Renamed as a plan';
  click(buttonByText(dialog(), 'Save'));
  await waitFor(() => !dialog(), 'the form to close');
  const saved = store.get('sample-flowchart');
  assert.deepEqual([saved.name, saved.type], ['Renamed as a plan', 'gantt']);
  assert.equal(saved.nodes.length, 7, 'nothing was deleted by changing the type');
  assert.match(went, /sample-flowchart/);

  click(buttonByText(root, 'Edit chart'));
  await waitFor(() => dialog(), 'the form again');
  click(buttonByText(dialog(), 'Delete chart'));
  await waitFor(() => doc.querySelectorAll('dialog.modal').length === 2, 'the confirmation');
  click(buttonByText([...doc.querySelectorAll('dialog.modal')][1], 'Delete'));
  await waitFor(() => store.get('sample-flowchart') === null, 'the chart to be deleted');
  assert.equal(went, '#/');
  cleanup();
});

test('every form and panel on the chart page opens without an error', async () => {
  const store = freshStore();
  const errors = [];
  const onError = (e) => errors.push(e.message || String(e));
  env.window.addEventListener('error', onError);
  for (const id of ['sample-gantt', 'sample-treeview', 'sample-flowchart', 'sample-swimlane', 'sample-kanban', 'sample-mindmap']) {
    const { root, cleanup } = await openChart(store, id);
    for (const label of ['Edit chart', 'Change chart type view', 'Table']) {
      const b = buttonByText(root, label);
      assert.ok(b, `${id}: ${label}`);
      click(b);
      await wait(20);
      doc.querySelectorAll('dialog.modal').forEach((d) => d.remove());
    }
    for (const b of [...root.querySelectorAll('.toolbar button')].filter((x) => /^(Add |Edit )/.test(x.textContent.trim()) && x.textContent.trim() !== 'Edit chart')) {
      click(b);
      await wait(20);
      doc.querySelectorAll('dialog.modal').forEach((d) => d.remove());
    }
    cleanup();
  }
  env.window.removeEventListener('error', onError);
  assert.deepEqual(errors, []);
});
