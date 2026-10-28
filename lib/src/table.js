// A plain tabular version of a chart (for a "show as table" panel and for CSV export). Pure data, no DOM.
//
//   const { columns, rows } = chartToTable(chart);     // rows is an array of arrays of strings
//   const csv = tableToCSV(columns, rows);

import { loadStructure, connexionLabel } from './structure.js';
import { plainLine, todayLocal } from './util.js';
import { chartWords } from './constants.js';
import { nodeGanttSettings, nodeTreeviewSettings } from './settings.js';
import { treeviewWalk } from './builders/treeview.js';
import { ganttDuration, planGantt } from './builders/gantt.js';
import { normaliseChart } from './model.js';

const text = (value) => plainLine(value, 500);

export function chartToTable(input, type) {
  const chart = normaliseChart(input);
  type = type || chart.type;
  const structure = loadStructure(chart);
  const words = chartWords(type);
  const caption = (id) => (structure.nodes.has(id) ? text(structure.nodes.get(id).caption) : '');
  const groupName = (id) => (structure.groups.has(id) ? text(structure.groups.get(id).name) : '');

  if (type === 'treeview') {
    const walk = treeviewWalk(structure);
    const maxDepth = walk.reduce((m, r) => Math.max(m, r.depth), 0);
    const columns = [...Array(maxDepth + 1)].map((_, i) => (i === 0 ? 'Name' : '')).concat(['Folder', 'Description']);
    const rows = walk.map((r) => {
      const ns = nodeTreeviewSettings(structure.nodes.get(r.id));
      const cells = Array(maxDepth + 1).fill('');
      cells[r.depth] = caption(r.id);
      return [...cells, (ns.isDir || r.hasChildren) ? 'Yes' : '', ns.description];
    });
    return { columns, rows };
  }

  if (type === 'gantt') {
    const plan = planGantt(structure);
    const kinds = { task: 'Task', milestone: 'Milestone', vert: 'Vertical marker' };
    const rows = [];
    for (const groupId of [0, ...structure.groups.keys()]) {
      for (const id of plan.order.get(groupId) || []) {
        const r = plan.resolved.get(id); const ns = r.ns;
        let start;
        if (r.kind === 'task' && r.startMode === 'unknown') start = 'Not yet known';
        else if (r.startMode === 'after') start = 'After ' + r.parents.map(caption).join(', ');
        else if (r.startMode === 'previous') start = 'After ' + caption(r.previous);
        else if (r.startMode === 'today') start = 'Today';
        else start = ns.startDate;
        let end = '';
        if (r.kind === 'task') {
          if (r.endMode === 'unknown') end = 'Not yet known';
          else if (r.endMode === 'date') end = ns.endDate;
          else if (r.endMode === 'until') end = `When ${caption(Number(ns.untilNode))} starts`;
          else end = ganttDuration(ns);
        }
        rows.push([groupName(groupId), caption(id), kinds[r.kind] || 'Task', ns.tags.join(', '), start, end]);
      }
    }
    return { columns: ['Section', 'Task', 'Kind', 'Status', 'Starts', 'Ends'], rows };
  }

  if (type === 'kanban') {
    const rows = [];
    for (const group of structure.groups.values()) {
      for (const node of structure.nodes.values()) {
        if (node.groupId === group.id) rows.push([text(group.name), caption(node.id), node.priority, node.assignee]);
      }
    }
    return { columns: [words.Group, words.Node, 'Priority', 'Assignee'], rows };
  }

  // Flow chart, swimlanes and mind map: one row per box with where it sits and what it follows
  const usesGroups = type !== 'mindmap';
  const columns = usesGroups ? [words.Node, words.Group, 'Follows', 'Connexion label'] : [words.Node, 'Parent'];
  const rows = [];
  for (const node of structure.nodes.values()) {
    const parentIds = structure.parents.get(node.id) || [];
    if (!usesGroups) { rows.push([caption(node.id), parentIds.length ? caption(parentIds[0]) : '']); continue; }
    if (!parentIds.length) rows.push([caption(node.id), groupName(node.groupId), '', '']);
    for (const parentId of parentIds) rows.push([caption(node.id), groupName(node.groupId), caption(parentId), text(connexionLabel(node, parentId))]);
  }
  return { columns, rows };
}

/** Rows -> CSV text (RFC 4180 style, CRLF line ends). */
export function tableToCSV(columns, rows) {
  const field = (value) => '"' + String(value ?? '').replace(/\s+/g, ' ').trim().replace(/"/g, '""') + '"';
  return [columns, ...rows].map((row) => row.map(field).join(',')).join('\r\n');
}

export { todayLocal };
