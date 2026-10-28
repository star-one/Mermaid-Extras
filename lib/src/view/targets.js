// Works out which chart box or group a click landed on. Every chart type marks its boxes differently:
//   flow chart / swimlane   a ".node" whose id ends  ...-n12-3     and ".cluster" groups  ...-sg4
//   Kanban                  cards ".node" ...-n12                  and column clusters ...-card4 (only the heading is clickable)
//   mind map                ".node" ...node_7  (Mermaid numbers them itself, so meta.mindmapNodeIndex translates)
//   tree view               rows are tagged with data-mx-node-id after rendering (see decorations.tagTreeviewRows)
//   Gantt                   task bars  rect#...-n12  and their text  text#...-n12-text
//
// Returns null, or { kind: 'node' | 'group', id, element, isRoot? }:
//   kind 'node', id 0, isRoot true   the synthetic centre of a mind map (not a real box)
//   kind 'group', id 0               the invisible "not in a group" group of a flow chart or swimlane

export function resolveTarget(el, diagram, root) {
  if (!el || !el.closest) return null;
  const type = diagram.type; const meta = diagram.meta || {};

  const tagged = el.closest('[data-mx-node-id]');
  if (tagged) return { kind: 'node', id: Number(tagged.getAttribute('data-mx-node-id')), element: tagged };

  if (type === 'gantt') {
    for (let n = el; n && n !== root; n = n.parentElement) {
      const tag = (n.tagName || '').toLowerCase();
      const match = n.id && (tag === 'rect' || tag === 'text') ? /-n(\d+)(?:-text)?$/.exec(n.id) : null;
      if (match) return { kind: 'node', id: Number(match[1]), element: n };
    }
    return null;
  }

  const nodeEl = el.closest('.node');
  if (nodeEl && nodeEl.id) {
    const nodeMatch = /(?:^|-)n(\d+)(?:-\d+)?$/.exec(nodeEl.id);
    if (nodeMatch) return { kind: 'node', id: Number(nodeMatch[1]), element: nodeEl };
    const mindmapMatch = /node_(\d+)$/.exec(nodeEl.id);
    if (mindmapMatch && meta.mindmapNodeIndex) {
      const id = meta.mindmapNodeIndex[Number(mindmapMatch[1])];
      if (id) return { kind: 'node', id, element: nodeEl };
      if (id === 0) return { kind: 'node', id: 0, element: nodeEl, isRoot: true };
    }
  }

  const clusterEl = el.closest('.cluster');
  if (clusterEl && clusterEl.id) {
    // Kanban columns are "card3"; only the heading is clickable, the rest is backdrop for the cards
    const column = /-card(\d+)$/.exec(clusterEl.id);
    if (column) {
      const heading = el.closest('.cluster-label');
      return heading ? { kind: 'group', id: Number(column[1]), element: heading } : null;
    }
    const group = /(?:^|-)sg(\d+)$/.exec(clusterEl.id);
    if (group) return { kind: 'group', id: Number(group[1]), element: clusterEl };
  }
  return null;
}

/** Adds the class "mx-clickable" to everything resolveTarget() would answer for, so your CSS can show a pointer. */
export function markClickables(canvas, diagram) {
  const candidates = canvas.querySelectorAll('.node, .cluster, .cluster-label, [data-mx-node-id], rect, text');
  candidates.forEach((el) => {
    if (diagram.type !== 'gantt' && (el.tagName.toLowerCase() === 'rect' || el.tagName.toLowerCase() === 'text') && !el.closest('.node, .cluster')) return;
    const target = resolveTarget(el, diagram, canvas);
    if (target && target.element === el) {
      el.classList.add('mx-clickable');
      if (target.isRoot) el.classList.add('mx-add-only');
    }
  });
}
