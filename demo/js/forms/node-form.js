// The add/edit form for a box (a flow chart box, mind map node, Kanban card, tree view item or Gantt task). The fields
// follow the type of chart being *viewed*, so someone looking at a flow chart as a Gantt chart edits its boxes as tasks.

import {
  KANBAN_PRIORITIES, NODE_SHAPES, chartWords, cleanGanttNodeSettings, cleanTreeviewNodeSettings, nodeGanttSettings, nodeTreeviewSettings,
} from '../../../lib/mermaid-extras.js';

const text = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function otherNodes(chart, selfId) {
  return chart.nodes.filter((n) => n.id !== selfId).map((n) => [n.id, text(n.caption) || '(untitled)']);
}
function groupOptions(chart, { none }) {
  const groups = [...chart.groups].sort((a, b) => a.order - b.order).map((g) => [g.id, text(g.name)]);
  return none ? [[0, none], ...groups] : groups;
}

/** Form fields for a box, for the type of chart being viewed. `selfId` is 0 for a new box. */
export function nodeFormSpec(chart, viewType, selfId = 0) {
  const words = chartWords(viewType);
  const caption = { name: 'caption', type: 'text', label: viewType === 'treeview' ? 'Name' : viewType === 'gantt' ? 'Task name' : `${words.Node} caption`, required: true, maxlength: 300 };
  const others = () => otherNodes(chart, selfId);

  switch (viewType) {
    case 'flowchart':
    case 'swimlane':
      return [
        caption,
        { name: 'shape', type: 'select', label: 'Shape', options: NODE_SHAPES },
        { name: 'colour', type: 'color', label: 'Colour' },
        { name: 'groupId', type: 'select', label: words.Group, options: () => groupOptions(chart, { none: `-- not in a ${words.group} --` }) },
        { type: 'heading', text: 'Follows on from' },
        { name: 'parents', type: 'parents', options: others, labels: true, addLabel: 'Add a box it follows on from' },
      ];

    case 'mindmap':
      return [
        caption,
        { name: 'shape', type: 'select', label: 'Shape', options: NODE_SHAPES.filter(([id]) => ['rect', 'rounded', 'circle', 'hex', 'lin-cyl', 'tag-doc'].includes(id)) },
        { name: 'parentId', type: 'select', label: 'Branches off', options: () => [[0, '-- the centre --'], ...others()] },
      ];

    case 'kanban':
      return [
        caption,
        { name: 'groupId', type: 'select', label: words.Group, options: () => groupOptions(chart, { none: null }), help: chart.groups.length ? null : 'This board has no columns yet: add a column first.' },
        { name: 'priority', type: 'select', label: 'Priority', options: KANBAN_PRIORITIES.map((p) => [p, p]) },
        { name: 'assignee', type: 'text', label: 'Assigned to', maxlength: 100 },
      ];

    case 'treeview':
      return [
        caption,
        { name: 'parentId', type: 'select', label: 'Inside', options: () => [[0, '-- top level --'], ...others()] },
        { name: 'tv.order', type: 'number', label: 'Order (optional)', help: 'Lower numbers come first among items in the same place. Items without a number come after, in the order they were added.' },
        { type: 'heading', text: 'Appearance' },
        { name: 'tv.isDir', type: 'checkbox', label: 'Folder (shown in bold with a trailing /). Items with something inside them are always folders.' },
        { name: 'tv.highlight', type: 'checkbox', label: 'Highlight this item' },
        { name: 'tv.description', type: 'text', label: 'Description shown beside it (optional)', maxlength: 200 },
        {
          name: 'tv.iconMode', type: 'select', label: 'Icon',
          options: [['default', 'Chart default'], ['none', 'No icon'], ['folder', 'Folder icon'], ['file', 'File icon'], ['custom', 'Icon from an icon pack...']],
        },
        { name: 'tv.iconCustom', type: 'text', label: 'Icon name, as pack:name', help: 'e.g. logos:react or material-icon-theme:rust', maxlength: 80, showIf: (v) => v.tv.iconMode === 'custom' },
      ];

    case 'gantt': {
      const isTask = (v) => v.gt.kind === 'task';
      return [
        caption,
        { name: 'groupId', type: 'select', label: words.Group, options: () => groupOptions(chart, { none: `-- not in a ${words.group} --` }) },
        { type: 'heading', text: 'What it is' },
        {
          name: 'gt.kind', type: 'select', label: 'Kind', options: [
            ['task', 'Task (a bar with a start and an end)'], ['milestone', 'Milestone (a single moment)'], ['vert', 'Vertical marker (a line across the whole chart)'],
          ],
        },
        { name: 'gt.tags', type: 'checks', label: 'Status', options: [['active', 'Active'], ['done', 'Done'], ['crit', 'Critical']] },
        { type: 'heading', text: 'Starts', showIf: (v) => v.gt.kind !== 'vert' },
        {
          name: 'gt.startMode', type: 'radio', label: null, showIf: (v) => v.gt.kind !== 'vert',
          options: [['previous', 'When the task before it ends'], ['after', 'After particular tasks end'], ['date', 'On a date'], ['unknown', 'At some unknown point in the future']],
        },
        { type: 'note', text: 'The bar fades in at its start. It has to be drawn somewhere, so it is drawn from today, or from shortly before its end if that is sooner.', showIf: (v) => v.gt.kind === 'task' && v.gt.startMode === 'unknown' },
        {
          name: 'afterIds', type: 'checks', label: 'After these tasks (it starts after the latest to end)', options: others, empty: 'There are no other tasks to follow yet.',
          showIf: (v) => v.gt.kind !== 'vert' && v.gt.startMode === 'after',
        },
        { name: 'gt.startDate', type: 'date', label: 'Date', showIf: (v) => v.gt.kind === 'vert' || v.gt.startMode === 'date' },
        { type: 'heading', text: 'Ends', showIf: isTask },
        {
          name: 'gt.endMode', type: 'radio', label: null, showIf: isTask,
          options: [['duration', 'After a duration'], ['date', 'On a date'], ['until', 'When another task starts'], ['unknown', 'At some unknown point in the future']],
        },
        {
          type: 'group', showIf: (v) => isTask(v) && v.gt.endMode === 'duration', fields: [
            { name: 'gt.durValue', type: 'number', label: 'Duration (the shortest is one day)', min: 1, max: 3650, step: 0.5 },
            { name: 'gt.durUnit', type: 'select', label: 'Unit', options: [['d', 'day(s)'], ['w', 'week(s)'], ['M', 'month(s)'], ['y', 'year(s)']] },
          ],
        },
        { name: 'gt.endDate', type: 'date', label: 'End date', showIf: (v) => isTask(v) && v.gt.endMode === 'date' },
        { name: 'gt.untilNode', type: 'select', label: 'Runs until this task starts', options: () => [[0, '-- choose a task --'], ...others()], showIf: (v) => isTask(v) && v.gt.endMode === 'until' },
        { type: 'note', text: 'The bar starts where it should and fades out after about a third of the timeline currently on screen, so it is easy to see however far you zoom out. Tasks that start after it are drawn after that point, and fade in, because their start is not known either.', showIf: (v) => isTask(v) && v.gt.endMode === 'unknown' },
        { name: 'gt.order', type: 'number', label: 'Order within its section (optional)', help: 'Lower numbers come first. Tasks without a number come after, in the order they were added, except that a task that follows on from another is placed directly beneath it. Giving a task a number overrides that.' },
      ];
    }
    default:
      return [caption];
  }
}

/** The starting values for the form. `node` is null for a new box; `defaults` are values to start a new one with. */
export function nodeFormInitial(chart, viewType, node, defaults = {}) {
  const parentIds = node ? node.parents.map((p) => p.id) : [];
  const base = {
    caption: node ? node.caption : '',
    shape: node ? node.shape : (viewType === 'flowchart' || viewType === 'swimlane' ? 'rounded' : 'rounded'),
    colour: node ? node.colour : '#ececff',
    groupId: node ? node.groupId : (viewType === 'kanban' && chart.groups.length ? [...chart.groups].sort((a, b) => a.order - b.order)[0].id : 0),
    parents: node ? node.parents.map((p) => ({ ...p })) : [],
    parentId: parentIds[0] || 0,
    priority: node ? node.priority : 'Medium',
    assignee: node ? node.assignee : '',
    tv: { ...nodeTreeviewSettings(node || { settings: {} }) },
    gt: { ...nodeGanttSettings(node || { settings: {} }) },
    afterIds: parentIds.map(String),
  };
  // A box that has never been set up as a Gantt task starts after what it follows, or after the task before it
  if (!node || !(node.settings && node.settings.gantt)) {
    base.gt.startMode = parentIds.length ? 'after' : 'previous';
    base.gt.startDate = base.gt.startDate || new Date().toISOString().slice(0, 10);
    base.gt.endDate = base.gt.endDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  } else {
    base.gt.startDate = base.gt.startDate || new Date().toISOString().slice(0, 10);
    base.gt.endDate = base.gt.endDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  }
  const merged = { ...base, ...defaults };
  if (defaults.tv) merged.tv = { ...base.tv, ...defaults.tv };
  if (defaults.gt) merged.gt = { ...base.gt, ...defaults.gt };
  if (defaults.parentId !== undefined && viewType !== 'flowchart' && viewType !== 'swimlane') merged.afterIds = defaults.parentId ? [String(defaults.parentId)] : merged.afterIds;
  if (defaults.parentId !== undefined && (viewType === 'flowchart' || viewType === 'swimlane')) merged.parents = defaults.parentId ? [{ id: defaults.parentId, label: '' }] : merged.parents;
  return merged;
}

/**
 * Checks the form's values and, if they are fine, writes them onto `node` (which is in `chart`).
 * @returns {{ error: string|null }}
 */
export function applyNodeForm(chart, viewType, node, values) {
  const caption = String(values.caption ?? '').trim();
  if (!caption) return { error: 'Please give it a name.' };
  const selfId = node.id;
  const validIds = chart.nodes.filter((n) => n.id !== selfId).map((n) => n.id);
  const groupId = Math.trunc(Number(values.groupId)) || 0;

  switch (viewType) {
    case 'flowchart':
    case 'swimlane':
      node.shape = values.shape; node.colour = values.colour; node.groupId = groupId;
      node.parents = (values.parents || []).filter((p) => validIds.includes(p.id)).map((p) => ({ id: p.id, label: String(p.label || '').trim() }));
      break;
    case 'mindmap': {
      node.shape = values.shape;
      const parentId = Number(values.parentId) || 0;
      node.parents = parentId && validIds.includes(parentId) ? [{ id: parentId, label: '' }] : [];
      break;
    }
    case 'kanban':
      if (!chart.groups.some((g) => g.id === groupId)) return { error: 'Please choose a column. If there are none, add a column first.' };
      node.groupId = groupId; node.priority = values.priority; node.assignee = String(values.assignee || '').trim();
      break;
    case 'treeview': {
      const result = cleanTreeviewNodeSettings(values.tv || {});
      if (result.error) return { error: result.error };
      node.settings = { ...node.settings, treeview: result.settings };
      const parentId = Number(values.parentId) || 0;
      node.parents = parentId && validIds.includes(parentId) ? [{ id: parentId, label: '' }] : [];
      break;
    }
    case 'gantt': {
      const input = { ...(values.gt || {}) };
      const result = cleanGanttNodeSettings(input, { validIds, selfId });
      if (result.error) return { error: result.error };
      node.settings = { ...node.settings, gantt: result.settings };
      node.groupId = groupId;
      // The tasks it follows are kept as its connexions. They only change when "after particular tasks" is chosen, so
      // a box that came from a flow chart doesn't lose its connexions by being edited as a task.
      if (result.settings.startMode === 'after') {
        node.parents = (values.afterIds || []).map(Number).filter((id) => validIds.includes(id)).map((id) => ({ id, label: '' }));
      }
      break;
    }
    default: break;
  }
  node.caption = caption;
  return { error: null };
}
