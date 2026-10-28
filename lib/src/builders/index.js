// buildDiagram(): turns a chart (see model.js) into Mermaid source plus everything the view needs to decorate it.

import { CHART_TYPE_IDS } from '../constants.js';
import { normaliseChart } from '../model.js';
import { loadStructure } from '../structure.js';
import { todayLocal } from '../util.js';
import { frontMatter } from './shared.js';
import { buildFlowchart } from './flowchart.js';
import { buildMindmap } from './mindmap.js';
import { buildKanban } from './kanban.js';
import { buildTreeview } from './treeview.js';
import { buildGantt, GANTT_UNKNOWN_END, resolveGanttTemplate, ganttAxisLines, ganttTimelineConfig } from './gantt.js';

/**
 * @param chart    a chart (see model.js). It is tidied with normaliseChart() first.
 * @param options  type      draw it as this type instead of chart.type (a "view as" – nothing is changed)
 *                 today     'YYYY-MM-DD' to treat as today (default: the visitor's today)
 *                 mindmapLayout  Mermaid's mind map layout ('tidy-tree' by default; '' for Mermaid's own default)
 * @returns {{ type, source, template, config, meta }}
 *   source    complete Mermaid source you can pass straight to mermaid.render()
 *   template  (Gantt only) the same source with two placeholders left for ChartView to fill in as the timeline zooms
 *   config    options for mermaid.initialize() (theme variables, layout) that Mermaid ignores in front matter
 *   meta      lookups for decorating and clicking the rendered chart
 */
export function buildDiagram(chart, options = {}) {
  const normalised = normaliseChart(chart);
  const type = CHART_TYPE_IDS.includes(options.type) ? options.type : normalised.type;
  const today = options.today || todayLocal();
  const structure = loadStructure(normalised);
  const front = frontMatter({ mindmapLayout: options.mindmapLayout === undefined ? 'tidy-tree' : options.mindmapLayout });

  let part;
  let template = null;
  switch (type) {
    case 'mindmap': part = buildMindmap(normalised, structure); break;
    case 'kanban': part = buildKanban(normalised, structure); break;
    case 'treeview': part = buildTreeview(normalised, structure); break;
    case 'gantt': {
      const timelinePart = buildGantt(normalised, structure, { today, withAxis: false });
      template = front + timelinePart.header + timelinePart.body;
      // The standalone version uses the chart's own axis settings and a fixed length for unknown ends
      part = buildGantt(normalised, structure, { today, withAxis: true });
      part.body = part.body.split(GANTT_UNKNOWN_END).join('14d');
      part.meta = timelinePart.meta;
      break;
    }
    default: part = buildFlowchart(normalised, structure, type);
  }
  return {
    type,
    source: front + part.header + part.body,
    template,
    config: part.config,
    meta: part.meta,
  };
}

export { GANTT_UNKNOWN_END, resolveGanttTemplate, ganttAxisLines, ganttTimelineConfig };
