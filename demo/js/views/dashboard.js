// The dashboard: your charts, a few numbers, and the features at a glance.

import { CHART_TYPES, chartWords } from '../../../lib/mermaid-extras.js';
import { h, icon, button, openModal, confirmModal, toast, pluralise, timeAgo } from '../ui.js';
import { buildForm } from '../forms/form-kit.js';
import { chartFormSpec, chartFormInitial, chartFieldsFromForm } from '../forms/chart-form.js';
import { typeChangeNote } from './chart-notes.js';

const TYPE_ICONS = { gantt: 'gantt', treeview: 'treeview', flowchart: 'flowchart', swimlane: 'swimlane', mindmap: 'mindmap', kanban: 'kanban' };

const FEATURES = [
  ['zoomIn', 'Zoom the picture', 'Zoom the finished chart, or fit it to the screen. Each chart remembers its own zoom.', 'zoom-and-export'],
  ['clock', 'Zoom the timeline', 'On a Gantt chart, change how much time is shown. The ticks switch between days, weeks and months.', 'gantt'],
  ['download', 'Export', 'Save a chart as PNG or SVG (with its name above it), or its data as CSV.', 'zoom-and-export'],
  ['cursor', 'Click to edit', 'Click any box or group to edit it, or to add something connected to it.', 'editing'],
  ['eye', 'View as another type', 'See the same chart as a tree, a Gantt chart, a board, a mind map... without changing it.', 'chart-types'],
  ['layers', 'A fuller Gantt chart', 'Dependencies with arrows, unknown start and end dates, milestones, colours and more.', 'gantt'],
];

export function renderDashboard(root, { store, navigate, makeSamples, refreshNav }) {
  const entries = store.list();
  const totalNodes = entries.reduce((n, e) => n + e.chart.nodes.length, 0);
  const totalGroups = entries.reduce((n, e) => n + e.chart.groups.length, 0);
  const typesUsed = new Set(entries.map((e) => e.chart.type)).size;
  const lastEdit = entries.length ? timeAgo(entries[0].updated) : 'never';

  const stat = (label, value, hint, tone) => h('div', { class: `stat stat-${tone}` }, h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-hint' }, hint));

  const grid = h('div', { class: 'chart-grid' });
  for (const { chart, updated } of entries) {
    const type = CHART_TYPES[chart.type];
    const words = chartWords(chart.type);
    const card = h('article', { class: `chart-card type-${chart.type}` },
      h('a', { class: 'chart-card-link', href: `#/chart/${encodeURIComponent(chart.id)}`, 'aria-label': `Open ${chart.name}` }),
      h('div', { class: 'chart-card-top' }, h('span', { class: 'chart-card-icon' }, icon(TYPE_ICONS[chart.type], 26)), h('span', { class: 'badge' }, type.label)),
      h('h3', {}, chart.name),
      h('p', { class: 'muted' }, `${pluralise(chart.nodes.length, words.node)}${chart.groups.length ? `, ${pluralise(chart.groups.length, words.group)}` : ''}`),
      h('p', { class: 'chart-card-time' }, icon('clock', 14), ` Edited ${timeAgo(updated)}`),
      h('div', { class: 'chart-card-actions' },
        h('button', { type: 'button', class: 'btn btn-quiet', title: 'Make a copy', onClick: () => { const copy = store.duplicate(chart.id); toast(`Copied as “${copy.name}”.`, 'success'); renderDashboard(root, { store, navigate, makeSamples, refreshNav }); refreshNav(); } }, icon('copy', 16), h('span', {}, 'Copy')),
        h('button', {
          type: 'button', class: 'btn btn-quiet btn-danger-text', title: 'Delete this chart',
          onClick: async () => {
            if (await confirmModal({ title: 'Delete this chart?', message: `“${chart.name}” will be removed from this browser. This can't be undone.`, confirmLabel: 'Delete', danger: true })) {
              store.remove(chart.id); toast('Chart deleted.'); renderDashboard(root, { store, navigate, makeSamples, refreshNav }); refreshNav();
            }
          },
        }, icon('trash', 16), h('span', {}, 'Delete'))));
    grid.appendChild(card);
  }
  if (!entries.length) {
    grid.appendChild(h('div', { class: 'empty-card' },
      h('h3', {}, 'No charts yet'),
      h('p', { class: 'muted' }, 'Create one, or bring the sample charts back.'),
      button('Bring back the samples', { iconName: 'refresh', onClick: () => { store.reset(makeSamples); renderDashboard(root, { store, navigate, makeSamples, refreshNav }); refreshNav(); } })));
  }

  const again = () => { renderDashboard(root, { store, navigate, makeSamples, refreshNav }); refreshNav(); };

  function newChart() {
    const form = buildForm(chartFormSpec(), chartFormInitial(null));
    openModal({
      title: 'New chart', body: form.el, wide: true,
      actions: [
        { label: 'Cancel', onClick: () => {} },
        {
          label: 'Create chart', kind: 'primary', iconName: 'plus',
          onClick: () => {
            const values = form.getValues();
            const fields = chartFieldsFromForm(values, null);
            if (!fields.name) { form.setError('Please give the chart a name.'); return false; }
            const chart = store.create(fields);
            navigate(`#/chart/${encodeURIComponent(chart.id)}`);
          },
        },
      ],
    });
    form.focusFirst();
  }

  function importCharts() {
    const file = h('input', { type: 'file', accept: 'application/json,.json' });
    const replace = h('input', { type: 'checkbox', id: 'import-replace' });
    openModal({
      title: 'Import charts',
      body: h('div', {}, h('p', {}, 'Choose a file you saved with “Export all”. It is read in your browser and goes nowhere else.'), file,
        h('label', { class: 'choice', for: 'import-replace' }, replace, h('span', {}, 'Replace the charts I have now (otherwise they are added to them)'))),
      actions: [
        { label: 'Cancel', onClick: () => {} },
        {
          label: 'Import', kind: 'primary', iconName: 'upload',
          onClick: async () => {
            if (!file.files[0]) { toast('Choose a file first.', 'error'); return false; }
            try {
              const count = store.importJSON(await file.files[0].text(), { replace: replace.checked });
              toast(`Imported ${pluralise(count, 'chart')}.`, 'success'); again();
            } catch (error) { toast(error.message, 'error'); return false; }
          },
        },
      ],
    });
  }

  function exportAll() {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const link = h('a', { href: URL.createObjectURL(blob), download: 'mermaid-extras-demo-charts.json' });
    document.body.appendChild(link); link.click(); link.remove();
    toast('Saved. Keep the file safe: it is the only copy outside this browser.', 'success');
  }

  async function resetDemo() {
    if (await confirmModal({ title: 'Reset the demo?', message: 'All the charts in this browser will be replaced by the original samples. This can’t be undone.', confirmLabel: 'Reset', danger: true })) {
      store.reset(makeSamples); toast('The samples are back.', 'success'); again();
    }
  }

  root.replaceChildren(
    h('header', { class: 'page-head' },
      h('div', {},
        h('p', { class: 'eyebrow' }, 'Dashboard'),
        h('h1', {}, 'Your charts'),
        h('p', { class: 'lede' }, 'A working demo of Mermaid Extras. Make a chart, click around, zoom, export, and look at the same chart as a different type.')),
      h('div', { class: 'page-actions' }, button('New chart', { iconName: 'plus', kind: 'primary', onClick: newChart }))),

    h('div', { class: 'notice notice-storage', role: 'note' },
      icon('info', 20),
      h('div', {},
        h('strong', {}, 'These charts live only in this browser. '),
        'They are saved in your browser’s local storage, so they are private to you on this device and can’t be shared: nobody else can see them, and they won’t appear on another computer or browser. Clearing your browsing data deletes them. To keep a copy or move them, use “Export all” below.')),

    h('div', { class: 'stats' },
      stat('Charts', String(entries.length), `${typesUsed} of 6 types in use`, 'teal'),
      stat('Boxes', String(totalNodes), 'boxes, cards, tasks and items', 'indigo'),
      stat('Groups', String(totalGroups), 'sections, lanes and columns', 'amber'),
      stat('Last change', lastEdit, store.size() ? `${Math.max(1, Math.round(store.size() / 1024))} KB stored here` : 'nothing stored yet', 'rose')),

    h('section', { class: 'section' },
      h('div', { class: 'section-head' },
        h('h2', {}, 'Charts'),
        h('div', { class: 'section-tools' },
          button('Import', { iconName: 'upload', kind: 'quiet', onClick: importCharts }),
          button('Export all', { iconName: 'download', kind: 'quiet', onClick: exportAll }),
          button('Reset the demo', { iconName: 'refresh', kind: 'quiet', onClick: resetDemo }))),
      grid),

    h('section', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', {}, 'What this adds to Mermaid'), h('a', { class: 'link-more', href: '#/docs' }, 'Read the documentation →')),
      h('div', { class: 'feature-grid' }, FEATURES.map(([iconName, title, text, page]) =>
        h('a', { class: 'feature', href: `#/docs/${page}` }, h('span', { class: 'feature-icon' }, icon(iconName, 22)), h('h3', {}, title), h('p', {}, text))))));
  void typeChangeNote;
}
