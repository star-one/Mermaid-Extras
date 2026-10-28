// Pieces shared by the builders.

import { plainLine } from '../util.js';

/** The front matter every chart's Mermaid source starts with. */
export function frontMatter({ mindmapLayout = 'tidy-tree' } = {}) {
  let out = '---\nconfig:\n  flowchart:\n    useMaxWidth: false\n  swimlane:\n    ignoreCrossLaneEdges: false\n';
  if (mindmapLayout) out += `  mindmap:\n    layout: ${mindmapLayout}\n`;
  return out + '---\n';
}

/** A box caption as one line of plain text (what the table view and most builders use). */
export function captionText(caption) { return plainLine(caption, 300); }

/** A box caption for diagrams that can't draw an empty label: the caption, or "Untitled" when there isn't one. */
export function labelText(caption) {
  const text = captionText(caption);
  return text === '' ? 'Untitled' : text;
}

/** Text that goes inside "double quotes" in Mermaid source: the quotes themselves are written as an entity. */
export function quoted(text) {
  return String(text ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '#quot;');
}

/** The explicit order number a box has been given for a chart type ('treeview' | 'gantt'), or '' for none. */
export function explicitOrder(node, key) {
  const value = node.settings && node.settings[key] ? node.settings[key].order : '';
  return (value === '' || value === null || value === undefined) ? '' : Number(value);
}

export function hasExplicitOrder(node, key) { return explicitOrder(node, key) !== ''; }

/**
 * Sorts box ids in place: those with an explicit order number first (lowest first), then the rest oldest first.
 * @param ids   array of box ids
 * @param nodes Map of id -> box
 * @param key   'treeview' or 'gantt'
 */
export function sortNodeIds(ids, nodes, key) {
  ids.sort((a, b) => {
    const oa = explicitOrder(nodes.get(a), key);
    const ob = explicitOrder(nodes.get(b), key);
    const ha = oa !== ''; const hb = ob !== '';
    if (ha && hb && oa !== ob) return oa < ob ? -1 : 1;
    if (ha !== hb) return ha ? -1 : 1;
    return a - b;
  });
  return ids;
}
