// Mind map. Hierarchy comes purely from indentation, so each box hangs off its first parent; boxes with none hang off
// a synthetic centre named after the chart. Mermaid numbers mind map nodes itself, in source order, so a lookup from
// that number to the real box id is returned for the view to use when something is clicked.

import { labelText } from './shared.js';

/** Mind map shapes wrap the label directly (square[Text], rounded(Text), ...), so map the box shapes onto them. */
function wrap(shape, caption) {
  const text = String(caption).replace(/[()[\]{}"]/g, '');
  let open; let close;
  switch (shape) {
    case 'odd': case 'stadium': open = '(('; close = '))'; break;   // circle
    case 'rounded': open = '('; close = ')'; break;                // rounded square
    case 'hex': open = '{{'; close = '}}'; break;                  // hexagon
    case 'lin-cyl': open = ')'; close = '('; break;                // cloud
    case 'tag-doc': open = '))'; close = '(('; break;              // bang
    default: open = '['; close = ']';                              // square
  }
  return `${open}"${text}"${close}`;
}

export function buildMindmap(chart, structure) {
  const children = new Map([[0, []]]);
  for (const id of structure.nodes.keys()) {
    const parent = structure.parents.has(id) ? structure.parents.get(id)[0] : 0;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(id);
  }

  const nodeIndex = [0]; // index 0 is the synthetic centre, which isn't a real box
  const seen = new Set();
  let body = `  )"${String(chart.name).replace(/["()]/g, '')}"(\n`;
  const emit = (id, depth) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = structure.nodes.get(id);
    body += '  '.repeat(depth) + wrap(node.shape, labelText(node.caption)) + '\n';
    nodeIndex.push(id);
    for (const childId of children.get(id) || []) emit(childId, depth + 1);
  };
  for (const rootId of children.get(0)) emit(rootId, 2);
  for (const id of structure.nodes.keys()) emit(id, 2); // anything left can only be part of a loop: show it rather than hide it
  return { header: 'mindmap\n', body, config: {}, meta: { mindmapNodeIndex: nodeIndex } };
}
