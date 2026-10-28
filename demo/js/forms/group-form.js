// The add/edit form for a group (a flow chart group, swimlane lane, Kanban column or Gantt section).

import { chartWords } from '../../../lib/mermaid-extras.js';

export function groupFormSpec(viewType) {
  const words = chartWords(viewType);
  const styled = viewType === 'flowchart' || viewType === 'swimlane';
  return [
    { name: 'name', type: 'text', label: `${words.Group} name`, required: true, maxlength: 200 },
    { name: 'order', type: 'number', label: 'Display order', help: viewType === 'flowchart' ? 'Flow chart groups are drawn from the highest number down.' : 'Lower numbers come first.' },
    ...(styled ? [
      { name: 'colour', type: 'color', label: 'Background colour' },
      { name: 'direction', type: 'select', label: 'Direction of the boxes inside', options: [['TB', 'Top to bottom'], ['LR', 'Left to right']] },
    ] : []),
  ];
}

export function groupFormInitial(group, chart) {
  if (group) return { name: group.name, order: group.order, colour: group.colour, direction: group.direction };
  const next = chart.groups.reduce((max, g) => Math.max(max, g.order || 0), 0) + 1;
  return { name: '', order: next, colour: '#ececff', direction: 'TB' };
}

/** @returns {{ fields, error }} */
export function groupFieldsFromForm(values) {
  const name = String(values.name || '').trim();
  if (!name) return { error: 'Please give it a name.' };
  const order = Number(values.order);
  return { fields: { name, order: Number.isFinite(order) ? Math.trunc(order) : 0, colour: values.colour || '#ececff', direction: values.direction === 'LR' ? 'LR' : 'TB' } };
}
