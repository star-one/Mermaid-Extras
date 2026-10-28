// Flow charts and swimlanes: boxes joined by arrows, optionally inside groups (flow chart subgraphs / swimlane lanes).

import { NODE_SHAPES } from '../constants.js';
import { cleanColour } from '../util.js';
import { connexionLabel } from '../structure.js';
import { captionText, labelText, quoted } from './shared.js';

const SHAPES = new Set(NODE_SHAPES.map((s) => s[0]));

export function buildFlowchart(chart, structure, type) {
  const isSwimlane = type === 'swimlane';
  const direction = chart.direction === 'LR' ? 'LR' : 'TB';

  // Boxes that aren't in a group sit in an invisible group of their own (id 0) that follows the chart's direction.
  const groups = [{ id: 0, name: ' ', order: 0, colour: '#ffffff', direction }, ...structure.groups.values()];
  // Flow charts list groups from the highest display order down; swimlanes from the lowest up.
  groups.sort((a, b) => (isSwimlane ? a.order - b.order : b.order - a.order) || (a.id - b.id));

  let body = '';
  let connexions = '';
  let anyNodes = false;
  for (const group of groups) {
    const members = [...structure.nodes.values()].filter((n) => (structure.groups.has(n.groupId) ? n.groupId : 0) === group.id);
    if (!members.length) continue; // an empty group isn't drawn at all
    anyNodes = true;

    let nodes = ''; let shapes = ''; let styles = '';
    for (const node of members) {
      const caption = quoted(labelText(node.caption));
      const shape = SHAPES.has(node.shape) ? node.shape : 'rect';
      const colour = cleanColour(node.colour, '#ececff');
      const parentIds = structure.parents.get(node.id) || [];
      if (!parentIds.length) {
        nodes += `n${node.id}["${caption}"]\n`;
      } else {
        for (const parentId of parentIds) {
          const label = quoted(captionText(connexionLabel(node, parentId)));
          const edge = label ? ` -- "${label}"` : '';
          if (isSwimlane) {
            nodes += `n${node.id}["${caption}"]\n`;
            connexions += `n${parentId}${edge} --> n${node.id}\n`;
          } else {
            nodes += `n${parentId}${edge} --> n${node.id}["${caption}"]\n`;
          }
        }
      }
      shapes += `n${node.id}@{ shape: ${shape}}\n`;
      styles += `style n${node.id} fill:${colour}\n`;
    }

    body += `subgraph sg${group.id} ["${quoted(group.name)}"]\n`;
    body += `direction ${group.id === 0 ? direction : (group.direction === 'LR' ? 'LR' : 'TB')}\n`;
    body += nodes + shapes + styles;
    body += `style sg${group.id} fill:${cleanColour(group.colour, '#ececff')}`;
    if (group.id === 0) body += ',stroke:#fff,stroke-width:0px';
    body += '\nend\n';
  }
  if (!anyNodes) {
    // Mermaid needs something to draw; the real invitation to add a box is up to your own interface
    body = isSwimlane
      ? 'subgraph sg0 [" "]\ndirection TB\nplaceholder["Add a box to get started"]\nend\n'
      : 'placeholder["Add a box to get started"]\n';
  }
  body += connexions;
  return { header: `${isSwimlane ? 'swimlane-beta' : 'flowchart'} ${direction}\n`, body, config: {}, meta: {} };
}
