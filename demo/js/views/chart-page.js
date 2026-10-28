// A chart: the picture, its toolbar, and the forms for changing it. This is the part of the demo that shows how to put
// ChartView to work: the library draws and decorates the chart and reports clicks; everything else (the toolbar, the
// forms, storing the result) is ordinary application code that you would write to suit your own project.

import {
  CHART_TYPES, CHART_TYPE_IDS, ChartView, chartToTable, chartUsesGroups, chartWords, clone, createGroup, loadStructure, nextId, planGantt, treeviewWalk,
} from '../../../lib/mermaid-extras.js';
import { h, icon, button, openModal, confirmModal, toast, pluralise } from '../ui.js';
import { buildForm } from '../forms/form-kit.js';
import { chartFormSpec, chartFormInitial, chartFieldsFromForm } from '../forms/chart-form.js';
import { nodeFormSpec, nodeFormInitial, applyNodeForm } from '../forms/node-form.js';
import { groupFormSpec, groupFormInitial, groupFieldsFromForm } from '../forms/group-form.js';
import { TYPE_NOTES, typeChangeNote } from './chart-notes.js';

/** What a new box starts with when it is added by clicking an existing box or group. */
export function defaultsForTarget(viewType, chart, target) {
  if (target.kind === 'group') return target.id > 0 && viewType !== 'gantt' ? { groupId: target.id } : {};
  if (target.isRoot || !target.id) return {};
  const node = chart.nodes.find((n) => n.id === target.id);
  if (!node) return {};
  switch (viewType) {
    case 'kanban': return { groupId: node.groupId };
    case 'gantt': return { groupId: node.groupId, gt: { startMode: 'after' }, afterIds: [String(node.id)] };
    case 'treeview':
    case 'mindmap': return { parentId: node.id };
    default: return { parentId: node.id, groupId: node.groupId };   // flow chart, swimlane
  }
}

const nameOf = (node) => String(node.caption || '').replace(/\s+/g, ' ').trim() || '(untitled)';

export function renderChartPage(root, { store, id, params, mermaid, navigate }) {
  let chart = store.get(id);
  if (!chart) {
    root.replaceChildren(h('div', { class: 'notice' }, icon('info', 20), h('div', {}, h('strong', {}, 'That chart is not in this browser. '), 'Charts are kept in the browser that made them. ', h('a', { href: '#/' }, 'Back to the dashboard'))));
    return () => {};
  }

  const requested = params.get('viewAs');
  const viewAs = CHART_TYPE_IDS.includes(requested) && requested !== chart.type ? requested : null;
  const viewType = viewAs || chart.type;
  const words = chartWords(viewType);
  const usesGroups = chartUsesGroups(viewType);
  let mode = 'edit';
  let view = null;

  // ---- saving ---------------------------------------------------------------------------------------------------

  async function commit(next, message) {
    try { chart = store.put(next); } catch (error) { toast(error.message, 'error'); return false; }
    if (message) toast(message, 'success');
    await draw();
    return true;
  }

  // ---- forms ----------------------------------------------------------------------------------------------------

  function openNodeForm(nodeId, defaults = {}) {
    const existing = nodeId ? chart.nodes.find((n) => n.id === nodeId) : null;
    if (viewType === 'kanban' && !chart.groups.length) { toast('Add a column first: cards live in columns.', 'error'); return; }
    const form = buildForm(nodeFormSpec(chart, viewType, nodeId || 0), nodeFormInitial(chart, viewType, existing, defaults));
    const actions = [];
    if (existing) {
      actions.push({
        label: `Delete ${words.node}`, kind: 'danger', iconName: 'trash',
        onClick: async () => {
          if (!(await confirmModal({ title: `Delete this ${words.node}?`, message: `“${nameOf(existing)}” will be removed${viewType === 'treeview' ? '; anything inside it moves up to the top level' : ''}.`, confirmLabel: 'Delete', danger: true }))) return false;
          const next = clone(chart);
          next.nodes = next.nodes.filter((n) => n.id !== nodeId);
          for (const n of next.nodes) n.parents = n.parents.filter((p) => p.id !== nodeId);
          await commit(next, `${words.Node} deleted.`);
        },
      });
    }
    actions.push({ label: 'Cancel', onClick: () => {} });
    actions.push({
      label: existing ? 'Save' : `Add ${words.node}`, kind: 'primary', iconName: existing ? 'check' : 'plus',
      onClick: async () => {
        const next = clone(chart);
        let node = existing ? next.nodes.find((n) => n.id === nodeId) : null;
        if (!node) {
          node = { id: nextId(next.nodes), caption: '', groupId: 0, parents: [], shape: 'rounded', colour: '#ececff', priority: 'Medium', assignee: '', settings: {} };
          next.nodes.push(node);
        }
        const result = applyNodeForm(next, viewType, node, form.getValues());
        if (result.error) { form.setError(result.error); return false; }
        if (!(await commit(next, existing ? `${words.Node} saved.` : `${words.Node} added.`))) return false;
      },
    });
    openModal({ title: existing ? `Edit ${words.node}` : `Add ${words.node}`, body: form.el, actions });
    form.focusFirst();
  }

  function openGroupForm(groupId) {
    const existing = groupId ? chart.groups.find((g) => g.id === groupId) : null;
    const form = buildForm(groupFormSpec(viewType), groupFormInitial(existing, chart));
    const actions = [];
    if (existing) {
      actions.push({
        label: `Delete ${words.group}`, kind: 'danger', iconName: 'trash',
        onClick: async () => {
          if (!(await confirmModal({ title: `Delete this ${words.group}?`, message: `“${existing.name}” will be removed. The ${words.nodes} in it are not deleted${viewType === 'kanban' ? ', but they won’t be shown on the board until you move them into another column' : '; they just stop being in a ' + words.group}.`, confirmLabel: 'Delete', danger: true }))) return false;
          const next = clone(chart);
          next.groups = next.groups.filter((g) => g.id !== groupId);
          for (const n of next.nodes) if (n.groupId === groupId) n.groupId = 0;
          await commit(next, `${words.Group} deleted.`);
        },
      });
    }
    actions.push({ label: 'Cancel', onClick: () => {} });
    actions.push({
      label: existing ? 'Save' : `Add ${words.group}`, kind: 'primary', iconName: existing ? 'check' : 'plus',
      onClick: async () => {
        const result = groupFieldsFromForm(form.getValues());
        if (result.error) { form.setError(result.error); return false; }
        const next = clone(chart);
        if (existing) Object.assign(next.groups.find((g) => g.id === groupId), result.fields);
        else createGroup(next, result.fields);
        if (!(await commit(next, existing ? `${words.Group} saved.` : `${words.Group} added.`))) return false;
      },
    });
    openModal({ title: existing ? `Edit ${words.group}` : `Add ${words.group}`, body: form.el, actions });
    form.focusFirst();
  }

  function openList(kind) {
    const list = h('div', { class: 'pick-list' });
    const item = (label, onClick, depth = 0) => list.appendChild(h('button', { type: 'button', class: 'pick', style: { marginLeft: `${depth * 1.2}em` }, onClick: () => { dialog.close(); onClick(); } }, label));
    const heading = (label) => list.appendChild(h('h4', {}, label));
    const structure = loadStructure(chart);
    if (kind === 'groups') {
      for (const group of [...chart.groups].sort((a, b) => a.order - b.order)) item(group.name, () => openGroupForm(group.id));
      if (!chart.groups.length) list.appendChild(h('p', { class: 'muted' }, `There aren't any ${words.groups} yet.`));
    } else if (viewType === 'treeview') {
      for (const row of treeviewWalk(structure)) item(nameOf(structure.nodes.get(row.id)), () => openNodeForm(row.id), row.depth);
    } else if (viewType === 'gantt') {
      const plan = planGantt(structure);
      for (const [groupId, ids] of plan.order) {
        if (!ids.length) continue;
        heading(groupId ? (structure.groups.get(groupId) || {}).name : 'Not in a section');
        for (const nodeId of ids) item(nameOf(structure.nodes.get(nodeId)), () => openNodeForm(nodeId));
      }
    } else if (usesGroups) {
      for (const groupId of [0, ...chart.groups.map((g) => g.id)]) {
        const members = chart.nodes.filter((n) => (chart.groups.some((g) => g.id === n.groupId) ? n.groupId : 0) === groupId);
        if (!members.length) continue;
        heading(groupId ? (structure.groups.get(groupId) || {}).name : `Not in a ${words.group}`);
        for (const node of members) item(nameOf(node), () => openNodeForm(node.id));
      }
    } else {
      for (const node of chart.nodes) item(nameOf(node), () => openNodeForm(node.id));
    }
    if (kind === 'nodes' && !chart.nodes.length) list.appendChild(h('p', { class: 'muted' }, `There aren't any ${words.nodes} yet.`));
    const dialog = openModal({ title: `Edit ${kind === 'groups' ? words.groups : words.nodes}`, body: list, actions: [{ label: 'Close', onClick: () => {} }] });
    return dialog;
  }

  function openChartForm() {
    // (declared first: the form calls onChange as soon as it is built)
    const note = h('div', { class: 'notice notice-warn', hidden: true });
    const form = buildForm(chartFormSpec(), chartFormInitial(chart), { onChange: (values) => { note.textContent = typeChangeNote(chart.type, values.type); note.hidden = !note.textContent; } });
    form.el.insertBefore(note, form.el.children[3] || null);
    openModal({
      title: 'Edit chart', body: form.el, wide: true,
      actions: [
        {
          label: 'Delete chart', kind: 'danger', iconName: 'trash',
          onClick: async () => {
            if (!(await confirmModal({ title: 'Delete this chart?', message: `“${chart.name}” and everything in it will be removed from this browser. This can't be undone.`, confirmLabel: 'Delete', danger: true }))) return false;
            store.remove(chart.id); toast('Chart deleted.'); navigate('#/');
          },
        },
        { label: 'Cancel', onClick: () => {} },
        {
          label: 'Save', kind: 'primary', iconName: 'check',
          onClick: async () => {
            const fields = chartFieldsFromForm(form.getValues(), chart);
            if (!fields.name) { form.setError('Please give the chart a name.'); return false; }
            const next = { ...clone(chart), ...fields };
            const typeChanged = fields.type !== chart.type;
            if (!(await commit(next, 'Chart saved.'))) return false;
            // The toolbar and forms are built for one type, so a change of type rebuilds the whole page
            if (typeChanged) navigate(`#/chart/${encodeURIComponent(chart.id)}`);
          },
        },
      ],
    });
    form.focusFirst();
  }

  function openViewAs() {
    const body = h('div', { class: 'view-as' },
      h('p', {}, 'See this chart as a different type of chart. This is only for you and only for this visit: the chart itself isn’t changed, and next time it will show the way it was set up.'));
    for (const typeId of CHART_TYPE_IDS) {
      const original = typeId === chart.type;
      body.appendChild(h('div', { class: 'view-as-row' },
        h('a', { class: `btn ${typeId === viewType ? 'btn-primary' : 'btn-default'}`, href: `#/chart/${encodeURIComponent(chart.id)}${original ? '' : `?viewAs=${typeId}`}`, onClick: () => dialog.close() }, CHART_TYPES[typeId].label),
        original ? h('span', { class: 'muted' }, '(as created)') : null,
        !original && TYPE_NOTES[typeId] ? h('small', { class: 'muted' }, TYPE_NOTES[typeId]) : null));
    }
    const dialog = openModal({ title: 'Change chart type view', body, actions: [{ label: 'Close', onClick: () => {} }] });
  }

  // ---- clicking on the chart --------------------------------------------------------------------------------------

  function onTarget(target) {
    if (mode === 'add') {
      if (viewType === 'kanban' && !chart.groups.length) { toast('Add a column first.', 'error'); return; }
      openNodeForm(0, defaultsForTarget(viewType, chart, target));
      return;
    }
    if (target.kind === 'group') {
      if (!target.id) { toast(`That isn't a real ${words.group}: it just holds the ${words.nodes} that aren't in one.`); return; }
      openGroupForm(target.id);
    } else if (target.isRoot) {
      toast('The centre of a mind map is the chart’s name. Click a box to edit it, or switch to “Click to add”.');
    } else {
      openNodeForm(target.id);
    }
  }

  // ---- the page -------------------------------------------------------------------------------------------------

  const host = h('div', { class: 'chart-host' });
  const stage = h('div', { class: 'chart-stage' }, host);
  const empty = h('div', { class: 'chart-empty', hidden: true });
  stage.appendChild(empty);
  const zoomLabel = h('span', { class: 'zoom-label' }, '100%');
  const timelineLabel = h('span', { class: 'zoom-label zoom-label-wide' }, ' ');
  const tablePanel = h('section', { class: 'panel', hidden: true });
  const timelineGroup = h('div', { class: 'tool-group', hidden: true },
    h('span', { class: 'tool-title' }, 'Timeline'),
    h('button', { type: 'button', class: 'btn btn-default btn-icon', title: 'Show a shorter period (more detail)', onClick: () => view.timelineShorter() }, icon('minus', 16)),
    timelineLabel,
    h('button', { type: 'button', class: 'btn btn-default btn-icon', title: 'Show a longer period (less detail)', onClick: () => view.timelineLonger() }, icon('plus', 16)),
    h('button', { type: 'button', class: 'btn btn-default', title: 'Show 7 weeks, starting with last week', onClick: () => view.timelineDefault() }, '7 weeks'),
    h('button', { type: 'button', class: 'btn btn-default', title: 'Show everything on the chart', onClick: () => view.timelineShowAll() }, 'Show all'));

  const modeButtons = ['edit', 'add'].map((m) => h('button', {
    type: 'button', class: `seg${m === mode ? ' seg-on' : ''}`, 'aria-pressed': String(m === mode),
    onClick: () => { mode = m; modeButtons.forEach((b, i) => { const on = ['edit', 'add'][i] === mode; b.classList.toggle('seg-on', on); b.setAttribute('aria-pressed', String(on)); }); host.dataset.mode = mode; },
  }, m === 'edit' ? 'Click to edit' : 'Click to add'));
  host.dataset.mode = mode;

  const exportError = (error) => toast(error.message || 'The export did not work.', 'error');

  // The table opens below the chart, which can be off the bottom of the screen, so showing it scrolls it into view
  // (and hiding it scrolls back up to the chart). The button says which it will do next.
  const tableButton = button('Table', { iconName: 'table', title: 'Show the chart as a table', onClick: () => toggleTable() });
  tableButton.setAttribute('aria-pressed', 'false');
  function toggleTable(show = tablePanel.hidden) {
    tablePanel.hidden = !show;
    tableButton.setAttribute('aria-pressed', String(show));
    tableButton.title = show ? 'Hide the table' : 'Show the chart as a table';
    tableButton.lastElementChild.textContent = show ? 'Hide table' : 'Table';
    if (show) {
      drawTable();
      if (tablePanel.scrollIntoView) tablePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (stage.scrollIntoView) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  const toolbar = h('div', { class: 'toolbar' },
    h('div', { class: 'tool-group' },
      h('span', { class: 'tool-title' }, 'Edit'),
      button(`Add ${words.node}`, { iconName: 'plus', kind: 'primary', onClick: () => openNodeForm(0) }),
      usesGroups ? button(`Add ${words.group}`, { iconName: 'plus', onClick: () => openGroupForm(0) }) : null,
      button(`Edit ${words.nodes}`, { iconName: 'edit', onClick: () => openList('nodes') }),
      usesGroups ? button(`Edit ${words.groups}`, { iconName: 'edit', onClick: () => openList('groups') }) : null,
      h('div', { class: 'seg-group', role: 'group', 'aria-label': 'What clicking the chart does' }, modeButtons)),
    h('div', { class: 'tool-group' },
      h('span', { class: 'tool-title' }, 'Picture'),
      h('button', { type: 'button', class: 'btn btn-default btn-icon', title: 'Zoom out', onClick: () => view.zoom.out() }, icon('zoomOut', 16)),
      zoomLabel,
      h('button', { type: 'button', class: 'btn btn-default btn-icon', title: 'Zoom in', onClick: () => view.zoom.in() }, icon('zoomIn', 16)),
      h('button', { type: 'button', class: 'btn btn-default', title: 'Fit the width of the screen', onClick: () => view.zoom.fitWidth() }, 'Fit width'),
      h('button', { type: 'button', class: 'btn btn-default', title: 'Fit the height of the screen', onClick: () => view.zoom.fitHeight() }, 'Fit height'),
      h('button', { type: 'button', class: 'btn btn-default', title: 'Back to 100%', onClick: () => view.zoom.reset() }, '100%')),
    timelineGroup,
    h('div', { class: 'tool-group' },
      h('span', { class: 'tool-title' }, 'Export'),
      button('PNG', { iconName: 'download', onClick: () => view.exportPNG().catch(exportError) }),
      button('SVG', { iconName: 'download', onClick: () => { try { view.exportSVG(); } catch (error) { exportError(error); } } }),
      button('CSV', { iconName: 'download', onClick: () => { try { view.exportCSV(); } catch (error) { exportError(error); } } })),
    h('div', { class: 'tool-group' },
      h('span', { class: 'tool-title' }, 'View'),
      button('Change chart type view', { iconName: 'eye', onClick: openViewAs }),
      viewAs ? null : button('Edit chart', { iconName: 'edit', onClick: openChartForm }),
      tableButton));

  const banner = viewAs ? h('div', { class: 'notice notice-view', role: 'note' },
    icon('eye', 20),
    h('div', {},
      'You are viewing this chart as a ', h('strong', {}, CHART_TYPES[viewAs].label), '. This is a temporary view just for you: the chart itself hasn’t changed. You can still add and edit its ', words.nodes, ' and ', words.groups, ' here; its settings (name, type and options) can only be changed from the original view. ',
      h('a', { class: 'btn btn-primary btn-small', href: `#/chart/${encodeURIComponent(chart.id)}` }, `Back to the original view (${CHART_TYPES[chart.type].label})`))) : null;

  root.replaceChildren(...[
    h('header', { class: 'page-head' },
      h('div', {},
        h('p', { class: 'eyebrow' }, h('a', { href: '#/' }, 'Dashboard'), ' / ', CHART_TYPES[chart.type].label),
        h('h1', { id: 'chart-title' }, chart.name)),
      h('div', { class: 'page-actions' }, h('span', { class: `badge badge-lg type-${viewType}` }, CHART_TYPES[viewType].label))),
    banner,
    toolbar,
    stage,
    tablePanel,
  ].filter(Boolean)); // (replaceChildren would write the word "null" for the banner when there isn't one)

  function drawTable() {
    const { columns, rows } = chartToTable(chart, viewType);
    tablePanel.replaceChildren(
      h('div', { class: 'panel-head' },
        h('h2', {}, 'The chart as a table'),
        h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => toggleTable(false) }, 'Hide table')),
      rows.length
        ? h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, columns.map((c) => h('th', {}, c)))), h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c)))))))
        : h('p', { class: 'muted' }, 'There is nothing to show yet.'));
  }

  function drawEmpty() {
    const none = !chart.nodes.length;
    const noGroups = usesGroups && viewType === 'kanban' && !chart.groups.length;
    empty.hidden = !(none || noGroups);
    empty.replaceChildren(
      h('p', {}, noGroups ? 'This board has no columns yet. Add a column, then add cards to it.' : `This chart doesn't have any ${words.nodes} yet.`),
      noGroups ? button('Add a column', { iconName: 'plus', kind: 'primary', onClick: () => openGroupForm(0) }) : button(`Add ${words.node}`, { iconName: 'plus', kind: 'primary', onClick: () => openNodeForm(0) }));
  }

  async function draw() {
    drawEmpty();
    if (!tablePanel.hidden) drawTable();
    document.getElementById('chart-title').textContent = chart.name;
    try {
      await view.render(chart, { type: viewAs || undefined });
      timelineGroup.hidden = !view.hasTimeline;
      if (view.hasTimeline) timelineLabel.textContent = view.timeline.describe().label;
    } catch (error) {
      host.querySelector('.mx-canvas').replaceChildren(h('div', { class: 'notice notice-error' }, icon('info', 20), h('div', {}, h('strong', {}, 'Mermaid could not draw this chart. '), String(error.message || error))));
    }
  }

  view = new ChartView(host, { mermaid, storage: window.localStorage ? undefined : null });
  view.on('target', onTarget);
  view.on('zoom', ({ percent }) => { zoomLabel.textContent = `${percent}%`; });
  view.on('timeline', ({ label }) => { timelineLabel.textContent = label; });
  draw();

  return () => view.destroy();
}
