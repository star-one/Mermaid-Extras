// Tree view ("treeView-beta"): each box hangs off its first parent, as an indented folder tree.

import { iconMapToObject, chartTreeviewSettings, nodeTreeviewSettings, treeviewDefaults } from '../settings.js';
import { captionText, sortNodeIds } from './shared.js';

/**
 * Depth-first walk. Each box hangs off its first parent connexion; boxes with none (or whose parent no longer
 * exists) are top-level. Returns [{ id, depth, hasChildren }] in display order. Loops in the data can't hide boxes.
 */
export function treeviewWalk(structure) {
  const { nodes, parents } = structure;
  const children = new Map([[0, []]]);
  for (const id of nodes.keys()) {
    let parent = parents.has(id) ? parents.get(id)[0] : 0;
    if (parent === id || !nodes.has(parent)) parent = 0;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(id);
  }
  for (const ids of children.values()) sortNodeIds(ids, nodes, 'treeview');

  const rows = []; const seen = new Set();
  const walk = (id, depth) => {
    if (seen.has(id)) return;
    seen.add(id);
    rows.push({ id, depth, hasChildren: (children.get(id) || []).length > 0 });
    for (const childId of children.get(id) || []) walk(childId, depth + 1);
  };
  for (const rootId of children.get(0)) walk(rootId, 0);
  for (const id of nodes.keys()) if (!seen.has(id)) walk(id, 0); // only possible if the data has a loop
  return rows;
}

export function treeviewLabel(caption, isDir) {
  let text = String(caption).replace(/[\r\n]+/g, ' ').trim();
  if (text === '') text = 'Untitled';
  // Plain names can be written bare; anything else (spaces, punctuation Mermaid reads as syntax) is quoted.
  if (/^[\p{L}\p{N}_.\-@+]+$/u.test(text)) return text + (isDir ? '/' : '');
  return '"' + text.replace(/"/g, "'") + (isDir ? '/' : '') + '"';
}

export function buildTreeview(chart, structure) {
  const rows = treeviewWalk(structure);
  let body = '';
  if (!structure.nodes.size) {
    body = '    "Add an item to get started"\n';
  } else {
    for (const row of rows) {
      const node = structure.nodes.get(row.id);
      const ns = nodeTreeviewSettings(node);
      let line = '    '.repeat(row.depth + 1) + treeviewLabel(captionText(node.caption), ns.isDir || row.hasChildren);
      // Annotations in the order the Mermaid examples use: class, icon, then the description, which runs to the
      // end of the line so it has to come last.
      if (ns.highlight) line += ' :::highlight';
      if (ns.iconMode === 'none') line += ' icon(none)';
      else if (ns.iconMode === 'folder') line += ' icon(folder)';
      else if (ns.iconMode === 'file') line += ' icon(file)';
      else if (ns.iconMode === 'custom' && ns.iconCustom !== '') line += ` icon(${ns.iconCustom})`;
      if (ns.description !== '') line += ' ## ' + ns.description;
      body += line + '\n';
    }
  }
  return {
    header: 'treeView-beta\n',
    body,
    config: treeviewMermaidConfig(chart),
    meta: { treeviewOrder: structure.nodes.size ? rows.map((r) => r.id) : [] },
  };
}

/**
 * The options that go to mermaid.initialize(). They are not put in the diagram's front matter because Mermaid's
 * front-matter sanitiser silently drops some of them (the icon, description and highlight colours).
 */
export function treeviewMermaidConfig(chart) {
  const s = chartTreeviewSettings(chart); const d = treeviewDefaults();
  const config = { useMaxWidth: false };
  if (s.showIcons) config.showIcons = true;
  if (s.defaultIconPack !== '') config.defaultIconPack = s.defaultIconPack;
  for (const name of ['rowIndent', 'paddingX', 'paddingY', 'lineThickness']) if (Number(s[name]) !== d[name]) config[name] = Number(s[name]);
  for (const name of ['filenameIcons', 'extensionIcons']) {
    const map = iconMapToObject(s[name]);
    if (Object.keys(map).length) config[name] = map;
  }
  const theme = {};
  if (Number(s.labelFontSize) !== d.labelFontSize) theme.labelFontSize = `${Number(s.labelFontSize)}px`;
  for (const name of ['labelColor', 'lineColor', 'iconColor', 'descriptionColor', 'highlightStroke']) {
    if (String(s[name]).toLowerCase() !== d[name]) theme[name] = s[name];
  }
  if (String(s.highlightBg).toLowerCase() !== d.highlightBg || Number(s.highlightBgOpacity) !== d.highlightBgOpacity) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s.highlightBg) || [];
    theme.highlightBg = `rgba(${parseInt(m[1], 16) || 0}, ${parseInt(m[2], 16) || 0}, ${parseInt(m[3], 16) || 0}, ${Number(s.highlightBgOpacity)})`;
  }
  const result = { treeView: config };
  if (Object.keys(theme).length) result.themeVariables = { treeView: theme };
  return result;
}
