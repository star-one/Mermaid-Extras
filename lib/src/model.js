// The chart data model, and small helpers for creating and tidying it. The library never stores anything itself:
// a chart is a plain JSON-serialisable object that you keep wherever you like.
//
// chart = {
//   id: 'any string',
//   name: 'Roadmap',
//   type: 'flowchart' | 'swimlane' | 'mindmap' | 'kanban' | 'treeview' | 'gantt',
//   direction: 'TB' | 'LR',                       // flow charts and swimlanes
//   settings: { treeview: {...}, gantt: {...} },  // chart-wide options for those two types (see settings.js)
//   groups: [ { id: 1, name: 'Phase 1', order: 1, colour: '#ececff', direction: 'TB' } ],
//   nodes:  [ { id: 1, caption: 'Kick-off', groupId: 1 /* 0 = none */, parents: [ { id: 3, label: 'yes' } ],
//               shape: 'rounded', colour: '#ececff',         // flow charts, swimlanes, mind maps
//               priority: 'Medium', assignee: 'Sam',         // Kanban cards
//               settings: { treeview: {...}, gantt: {...} } } ],
// }
//
// Group ids and box ids are positive integers that you allocate (see nextId). Group id 0 means "not in a group".

import { CHART_TYPE_IDS, KANBAN_PRIORITIES, NODE_SHAPES } from './constants.js';
import { cleanColour, cleanEnum, clone, plainLine } from './util.js';

export function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

export function createChart({ id, name = 'Untitled chart', type = 'flowchart', direction = 'TB', settings = {} } = {}) {
  return normaliseChart({
    id: id || `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name, type, direction, settings, groups: [], nodes: [],
  });
}

export function createGroup(chart, { name = 'New group', order, colour = '#ececff', direction = 'TB' } = {}) {
  const group = {
    id: nextId(chart.groups),
    name,
    order: Number.isFinite(order) ? order : chart.groups.reduce((max, g) => Math.max(max, g.order || 0), 0) + 1,
    colour, direction,
  };
  chart.groups.push(group);
  return group;
}

export function createNode(chart, fields = {}) {
  const node = {
    id: nextId(chart.nodes),
    caption: 'New box',
    groupId: 0,
    parents: [],
    shape: 'rounded',
    colour: '#ececff',
    priority: 'Medium',
    assignee: '',
    settings: {},
    ...fields,
  };
  chart.nodes.push(node);
  return node;
}

/**
 * Returns a tidy copy of a chart: every field present and of the right kind, unknown groups and parents removed.
 * Safe to call on data loaded from storage.
 */
export function normaliseChart(input) {
  const chart = clone(input || {});
  chart.id = String(chart.id ?? '');
  chart.name = plainLine(chart.name, 200) || 'Untitled chart';
  chart.type = cleanEnum(chart.type, CHART_TYPE_IDS, 'flowchart');
  chart.direction = cleanEnum(chart.direction, ['TB', 'LR'], 'TB');
  chart.settings = (chart.settings && typeof chart.settings === 'object') ? chart.settings : {};
  chart.groups = (Array.isArray(chart.groups) ? chart.groups : []).map((g) => ({
    id: Math.trunc(Number(g.id)) || 0,
    name: plainLine(g.name, 200) || 'Group',
    order: Number.isFinite(Number(g.order)) ? Math.trunc(Number(g.order)) : 0,
    colour: cleanColour(g.colour, '#ececff'),
    direction: cleanEnum(g.direction, ['TB', 'LR'], 'TB'),
  })).filter((g) => g.id > 0);

  const groupIds = new Set(chart.groups.map((g) => g.id));
  const nodeIds = new Set((Array.isArray(chart.nodes) ? chart.nodes : []).map((n) => Math.trunc(Number(n.id)) || 0));
  chart.nodes = (Array.isArray(chart.nodes) ? chart.nodes : []).map((n) => {
    const id = Math.trunc(Number(n.id)) || 0;
    const groupId = Math.trunc(Number(n.groupId)) || 0;
    return {
      id,
      caption: String(n.caption ?? '').slice(0, 500),
      groupId: groupIds.has(groupId) ? groupId : 0,
      parents: (Array.isArray(n.parents) ? n.parents : [])
        .map((p) => ({ id: Math.trunc(Number(p && p.id)) || 0, label: plainLine(p && p.label, 200) }))
        .filter((p) => p.id > 0 && p.id !== id && nodeIds.has(p.id)),
      shape: NODE_SHAPES.some((s) => s[0] === n.shape) ? n.shape : 'rounded',
      colour: cleanColour(n.colour, '#ececff'),
      priority: KANBAN_PRIORITIES.includes(n.priority) ? n.priority : 'Medium',
      assignee: plainLine(n.assignee, 100),
      settings: (n.settings && typeof n.settings === 'object') ? n.settings : {},
    };
  }).filter((n) => n.id > 0);
  return chart;
}
