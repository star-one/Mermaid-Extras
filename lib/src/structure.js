// Indexes a chart for the builders: boxes by id, groups in display order, and each box's (valid) parents.

/**
 * @returns {{ nodes: Map<number, object>, groups: Map<number, object>, parents: Map<number, number[]> }}
 *   nodes   all boxes, oldest (lowest id) first
 *   groups  all real groups (not the "no group" group 0), by display order then id
 *   parents the ids each box has a connexion from, in the order they were added. Parents that don't exist are left out.
 */
export function loadStructure(chart) {
  const nodes = new Map();
  for (const node of [...chart.nodes].sort((a, b) => a.id - b.id)) nodes.set(node.id, node);
  const groups = new Map();
  for (const group of [...chart.groups].sort((a, b) => (a.order - b.order) || (a.id - b.id))) groups.set(group.id, group);
  const parents = new Map();
  for (const node of nodes.values()) {
    const list = [];
    for (const parent of node.parents || []) {
      if (parent.id > 0 && parent.id !== node.id && nodes.has(parent.id) && !list.includes(parent.id)) list.push(parent.id);
    }
    if (list.length) parents.set(node.id, list);
  }
  return { nodes, groups, parents };
}

/** The label on the connexion from a parent to a box ('' if none). */
export function connexionLabel(node, parentId) {
  const parent = (node.parents || []).find((p) => p.id === parentId);
  return parent ? (parent.label || '') : '';
}
