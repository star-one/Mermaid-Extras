// Kanban board: groups are the columns, boxes are the cards. A card's priority and assignee are shown with Mermaid's
// own card metadata. Mermaid has no "Critical" priority, so those cards are drawn as Very High and the view
// recolours their stripe after rendering (the ids are returned in meta.kanbanCriticalIds).

import { KANBAN_PRIORITIES } from '../constants.js';
import { plainLine } from '../util.js';
import { labelText, quoted } from './shared.js';

export function buildKanban(chart, structure) {
  const cardColumn = {};
  const critical = [];
  let body = '';
  if (!structure.groups.size) {
    // A board with no columns has nothing to draw and Mermaid throws on an empty board, so give it a placeholder.
    // The ids are deliberately non-numeric so clicking it is never mistaken for a real card.
    body += '\tcardplaceholder["Get started"]\n\t\tplaceholder["Add a column to get started"]\n';
  }
  for (const group of structure.groups.values()) {
    body += `\tcard${group.id} ["${quoted(plainLine(group.name, 200))}"]\n`;
    for (const node of structure.nodes.values()) {
      if (node.groupId !== group.id) continue;
      cardColumn[node.id] = group.id;
      const priority = KANBAN_PRIORITIES.includes(node.priority) ? node.priority : 'Medium';
      const assigned = plainLine(node.assignee, 100).replace(/[{}]/g, ' ').trim();
      const metadata = [];
      if (priority === 'Critical') { metadata.push(`priority: ${JSON.stringify('Very High')}`); critical.push(node.id); }
      else if (priority !== 'Medium') metadata.push(`priority: ${JSON.stringify(priority)}`);
      if (assigned !== '') metadata.push(`assigned: ${JSON.stringify(assigned)}`);
      body += `\t\tn${node.id}["${quoted(labelText(node.caption))}"]${metadata.length ? `@{ ${metadata.join(', ')} }` : ''}\n`;
    }
  }
  return { header: 'kanban\n', body, config: {}, meta: { kanbanCardColumn: cardColumn, kanbanCriticalIds: critical } };
}
