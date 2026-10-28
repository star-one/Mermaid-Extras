/** The chart types the library can draw. */
export const CHART_TYPES = Object.freeze({
  flowchart: { label: 'Flow chart', usesGroups: true, groupWord: 'group', nodeWord: 'box' },
  swimlane:  { label: 'Swimlanes', usesGroups: true, groupWord: 'lane', nodeWord: 'box' },
  mindmap:   { label: 'Mind map', usesGroups: false, groupWord: 'group', nodeWord: 'box' },
  kanban:    { label: 'Kanban board', usesGroups: true, groupWord: 'column', nodeWord: 'card' },
  treeview:  { label: 'Tree view', usesGroups: false, groupWord: 'group', nodeWord: 'item' },
  gantt:     { label: 'Gantt chart', usesGroups: true, groupWord: 'section', nodeWord: 'task' },
});

export const CHART_TYPE_IDS = Object.freeze(Object.keys(CHART_TYPES));

/** The words used on screen for the things in each type of chart. */
export function chartWords(type) {
  const t = CHART_TYPES[type] || CHART_TYPES.flowchart;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    node: t.nodeWord, Node: cap(t.nodeWord), nodes: t.nodeWord + 's', Nodes: cap(t.nodeWord) + 's',
    group: t.groupWord, Group: cap(t.groupWord), groups: t.groupWord + 's', Groups: cap(t.groupWord) + 's',
  };
}

export function chartUsesGroups(type) { return !!(CHART_TYPES[type] && CHART_TYPES[type].usesGroups); }

/** Box shapes (Mermaid's `shape:` names) offered for flow charts, swimlanes and mind maps. */
export const NODE_SHAPES = Object.freeze([
  ['rect', 'Square'], ['rounded', 'Rounded'], ['stadium', 'Stadium'], ['diam', 'Diamond'], ['hex', 'Hexagon'],
  ['circle', 'Circle'], ['odd', 'Flag'], ['cyl', 'Database'], ['doc', 'Document'], ['lin-cyl', 'Cloud'],
  ['tag-doc', 'Tagged document'],
]);

export const KANBAN_PRIORITIES = Object.freeze(['Very Low', 'Low', 'Medium', 'High', 'Very High', 'Critical']);
