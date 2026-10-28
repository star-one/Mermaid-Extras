// Things drawn or recoloured on the SVG after Mermaid has rendered it. Each function takes the <svg> element.

const NS = 'http://www.w3.org/2000/svg';

function ensureDefs(svg) {
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.insertBefore(defs, svg.firstChild); }
  return defs;
}

/** Tree view: Mermaid draws one label per item, in source order, after an extra label for the unnamed root. */
export function tagTreeviewRows(svg, order) {
  if (!order || !order.length) return;
  const labels = Array.from(svg.querySelectorAll('text.treeView-node-label'));
  if (labels.length === order.length + 1) labels.shift();
  if (labels.length !== order.length) return; // can't be matched safely, so nothing is tagged
  labels.forEach((label, index) => {
    const parent = label.parentNode;
    const row = parent && parent.tagName && parent.tagName.toLowerCase() === 'g' ? parent : label;
    row.setAttribute('data-mx-node-id', String(order[index]));
  });
}

/** Kanban: "Critical" cards are sent to Mermaid as Very High; their stripe is recoloured here. */
export function styleKanbanCritical(svg, criticalIds, colour = '#7a0019') {
  if (!criticalIds || !criticalIds.length) return;
  svg.querySelectorAll('.node').forEach((el) => {
    const match = /-n(\d+)$/.exec(el.id || '');
    if (!match || !criticalIds.includes(Number(match[1]))) return;
    el.querySelectorAll('line').forEach((line) => { if (line.getAttribute('stroke-width') === '4') line.setAttribute('stroke', colour); });
  });
}

/**
 * Gantt: fades the unknown ends of bars. Mermaid has no open-ended bars, so those tasks are drawn with a
 * placeholder length and masked with a gradient here, which keeps the bar's own done/active/critical colour.
 * fades is { [taskId]: { start: bool, end: bool } }.
 */
export function applyGanttFades(svg, fades) {
  const ids = Object.keys(fades || {});
  if (!ids.length) return;
  const defs = ensureDefs(svg);
  for (const id of ids) {
    const fade = fades[id];
    const bar = svg.querySelector(`rect.task[id$="-n${id}"]`);
    if (!bar || (!fade.start && !fade.end)) continue;

    const gradient = document.createElementNS(NS, 'linearGradient');
    gradient.setAttribute('id', `mxFadeGradient-${id}`);
    gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0'); gradient.setAttribute('x2', '1'); gradient.setAttribute('y2', '0');
    // In a mask white shows the bar and black hides it: fade in over the first third, out over the last third
    const stops = [];
    if (fade.start) stops.push(['0', '#000'], ['0.35', '#fff']); else stops.push(['0', '#fff']);
    if (fade.end) stops.push(['0.65', '#fff'], ['1', '#000']); else stops.push(['1', '#fff']);
    for (const [offset, colour] of stops) {
      const stop = document.createElementNS(NS, 'stop');
      stop.setAttribute('offset', offset); stop.setAttribute('stop-color', colour);
      gradient.appendChild(stop);
    }

    const mask = document.createElementNS(NS, 'mask');
    mask.setAttribute('id', `mxFadeMask-${id}`);
    mask.setAttribute('maskUnits', 'objectBoundingBox'); mask.setAttribute('maskContentUnits', 'objectBoundingBox');
    mask.setAttribute('x', '0'); mask.setAttribute('y', '0'); mask.setAttribute('width', '1'); mask.setAttribute('height', '1');
    const cover = document.createElementNS(NS, 'rect');
    cover.setAttribute('x', '0'); cover.setAttribute('y', '0'); cover.setAttribute('width', '1'); cover.setAttribute('height', '1');
    cover.setAttribute('fill', `url(#mxFadeGradient-${id})`);
    mask.appendChild(cover);

    defs.appendChild(gradient);
    defs.appendChild(mask);
    bar.setAttribute('mask', `url(#mxFadeMask-${id})`);
  }
}

/**
 * Gantt: arrows from a task to the tasks that wait for it to finish. Out of the end of the task that has to finish,
 * then down (or up) onto the start of the one that waits. Tasks on the same row are joined by a straight line.
 * dependencies is [[fromId, toId], ...].
 */
export function drawGanttDependencies(svg, dependencies, colour = '#444') {
  const old = svg.querySelector('g.mx-dependencies');
  if (old) old.parentNode.removeChild(old);
  if (!dependencies || !dependencies.length) return;

  const viewBox = svg.viewBox && svg.viewBox.baseVal;
  const svgBounds = svg.getBoundingClientRect();
  const scale = (viewBox && viewBox.width && svgBounds.width) ? viewBox.width / svgBounds.width : 1;

  // A task bar's position and size in the chart's own units. Milestones are turned, so those are measured on screen.
  const boxOf = (id) => {
    const bar = svg.querySelector(`rect[id$="-n${id}"]`);
    if (!bar) return null;
    let x = parseFloat(bar.getAttribute('x')); let y = parseFloat(bar.getAttribute('y'));
    let w = parseFloat(bar.getAttribute('width')); let h = parseFloat(bar.getAttribute('height'));
    if (bar.getAttribute('transform') || [x, y, w, h].some(Number.isNaN)) {
      const r = bar.getBoundingClientRect();
      x = (r.left - svgBounds.left) * scale; y = (r.top - svgBounds.top) * scale; w = r.width * scale; h = r.height * scale;
    }
    return { x, y, w, h };
  };

  const defs = ensureDefs(svg);
  if (!svg.querySelector('#mxDependencyArrow')) {
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', 'mxDependencyArrow'); marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('markerWidth', '9'); marker.setAttribute('markerHeight', '9'); marker.setAttribute('orient', 'auto');
    const head = document.createElementNS(NS, 'path');
    head.setAttribute('d', 'M0,0 L10,5 L0,10 z'); head.setAttribute('fill', colour);
    marker.appendChild(head); defs.appendChild(marker);
  }

  const group = document.createElementNS(NS, 'g');
  group.setAttribute('class', 'mx-dependencies');
  group.setAttribute('pointer-events', 'none');
  for (const [fromId, toId] of dependencies) {
    const from = boxOf(fromId); const to = boxOf(toId);
    if (!from || !to) continue;
    const x1 = from.x + from.w; const y1 = from.y + from.h / 2;
    let d;
    if (Math.abs(to.y - from.y) < 2) {
      if (to.x - x1 <= 6) continue; // side by side already: nothing to join
      d = `M${x1} ${y1} H${to.x - 1}`;
    } else {
      let xv = Math.max(x1, to.x) + 6;
      if (xv > to.x + to.w - 2) xv = to.x + to.w / 2;
      const yTarget = to.y > from.y ? to.y - 1 : to.y + to.h + 1;
      d = `M${x1} ${y1} H${xv} V${yTarget}`;
    }
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('d', d); line.setAttribute('fill', 'none'); line.setAttribute('stroke', colour);
    line.setAttribute('stroke-width', '1.4'); line.setAttribute('marker-end', 'url(#mxDependencyArrow)');
    group.appendChild(line);
  }
  svg.appendChild(group);
}

/**
 * Gantt: pins the section names, in a white box, to the left of what is on screen so they stay visible while the
 * timeline is scrolled. Call again on every scroll.
 */
export function pinSectionTitles(svg, scrollLeft, imageZoom) {
  const titles = svg.querySelectorAll('text.sectionTitle');
  if (!titles.length) return;
  const x = String(scrollLeft / (imageZoom || 1) + 10);
  titles.forEach((title) => {
    title.setAttribute('x', x);
    title.querySelectorAll('tspan').forEach((span) => span.setAttribute('x', x));
    let box = title._mxBox;
    if (!box) {
      box = document.createElementNS(NS, 'rect');
      box.setAttribute('class', 'sectionTitleBg'); box.setAttribute('fill', '#fff');
      box.setAttribute('stroke', '#bbb'); box.setAttribute('stroke-width', '1'); box.setAttribute('rx', '3');
      title._mxBox = box;
      // The box and its text go last, so they sit above the bars and grid lines
      svg.appendChild(box); svg.appendChild(title);
    }
    if (!(title.textContent || '').trim()) { box.setAttribute('display', 'none'); return; }
    box.removeAttribute('display');
    const bounds = title.getBBox();
    box.setAttribute('x', bounds.x - 6); box.setAttribute('y', bounds.y - 3);
    box.setAttribute('width', bounds.width + 12); box.setAttribute('height', bounds.height + 6);
  });
}
