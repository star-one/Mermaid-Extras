// Mermaid Extras - public entry point.
//
//   import { ChartView, buildDiagram, createChart, createNode, createGroup } from './lib/mermaid-extras.js';
//
// Everything here is plain ES modules with no build step and no dependencies of its own: you supply Mermaid.
// See docs/getting-started.md.

export { ChartView } from './src/view/chart-view.js';
export { localStorageAdapter, nullStorage } from './src/view/storage.js';
export { resolveTarget } from './src/view/targets.js';

export { buildDiagram } from './src/builders/index.js';
export { planGantt, scheduleTasks, resolveTask, stackFollowers, ganttAxisLines, resolveGanttTemplate, GANTT_UNKNOWN_END } from './src/builders/gantt.js';
export { treeviewWalk } from './src/builders/treeview.js';

export { createChart, createGroup, createNode, normaliseChart, nextId } from './src/model.js';
export { loadStructure } from './src/structure.js';
export { chartToTable, tableToCSV } from './src/table.js';

export {
  CHART_TYPES, CHART_TYPE_IDS, NODE_SHAPES, KANBAN_PRIORITIES, chartWords, chartUsesGroups,
} from './src/constants.js';

export {
  ICON_PACKS, DAYS, GANTT_AXIS_PRESETS, GANTT_COLOUR_FIELDS, GANTT_LAYOUT_FIELDS,
  treeviewDefaults, ganttDefaults, treeviewNodeDefaults, ganttNodeDefaults,
  cleanTreeviewSettings, cleanGanttSettings, cleanTreeviewNodeSettings, cleanGanttNodeSettings,
  chartTreeviewSettings, chartGanttSettings, nodeTreeviewSettings, nodeGanttSettings,
} from './src/settings.js';

export { todayLocal, clone } from './src/util.js';
