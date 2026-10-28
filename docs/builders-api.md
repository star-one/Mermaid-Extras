# Builders and helpers

`ChartView` is built on top of the pieces on this page, which you can also use on their own: to generate Mermaid source on a server, to draw with your own code, or to build a table of a chart's contents.

## `buildDiagram(chart, options?)`

```js
import { buildDiagram } from './lib/mermaid-extras.js';

const diagram = buildDiagram(chart, { type: 'gantt', today: '2026-10-05' });
```

| Option | What it does |
|---|---|
| `type` | Draw the chart as this type (a "view as"). Default: `chart.type`. |
| `today` | A date, `'YYYY-MM-DD'`, to treat as today. Default: the visitor's today. |
| `mindmapLayout` | `'tidy-tree'` by default; `''` for Mermaid's own default. |

It returns:

| | |
|---|---|
| `type` | The type that was drawn. |
| `source` | Complete Mermaid source. You can give this straight to `mermaid.render()`. |
| `config` | Options for `mermaid.initialize()`: task colours, tree icons and the like, which Mermaid ignores when they are in front matter. **Pass these to `initialize` before you render.** |
| `template` | Gantt only: the same source with two placeholders left in it, which the timeline zoom fills in (see below). `null` for other types. |
| `meta` | Lookups for decorating and clicking the drawn chart. |

### Drawing it yourself

```js
const { source, config } = buildDiagram(chart);
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...config });
const { svg } = await mermaid.render('my-chart', source);
container.innerHTML = svg;
```

You get the chart, but none of the zoom, export, decoration or click handling: that is what `ChartView` adds. For a Gantt chart, `source` uses the chart's own axis settings and draws unknown ends for 14 days.

### `meta`

| Key | For | What it holds |
|---|---|---|
| `mindmapNodeIndex` | mind map | `[0, id, id, ...]`: Mermaid's own node numbers to your box ids (index 0 is the centre). |
| `treeviewOrder` | tree view | box ids in the order they are drawn, to match rows to boxes. |
| `kanbanCardColumn` | Kanban | `{ cardId: columnId }`. |
| `kanbanCriticalIds` | Kanban | ids of cards whose stripe is recoloured after drawing. |
| `ganttFades` | Gantt | `{ taskId: { start, end } }`: tasks with an unknown start and/or end. |
| `ganttDependencies` | Gantt | `[[fromId, toId], ...]`: the arrows to draw (empty if `showDependencies` is off). |
| `ganttTasks` | Gantt | ids of the tasks, in drawing order. |
| `ganttTimeline` | Gantt | what the timeline zoom needs: the axis format, week day, any fixed tick spacing and the side paddings. |

## The Gantt template

For a Gantt chart, `template` is the Mermaid source with two placeholders in it:

- a line `%%AXIS%%`, replaced by the axis lines (`axisFormat`, `tickInterval`, `weekday`) that suit the zoom, and
- `@@UNKNOWNEND@@`, replaced by a length such as `16d` for each task with an unknown end.

```js
import { resolveGanttTemplate, ganttAxisLines } from './lib/mermaid-extras.js';

const source = resolveGanttTemplate(diagram.template, {
  axisLines: ganttAxisLines(diagram.meta.ganttTimeline, 8),   // 8 pixels per day: week ticks
  unknownDays: 16,
});
```

## Gantt scheduling helpers

| Function | What it does |
|---|---|
| `planGantt(structure)` | How the chart is arranged: `{ order, resolved, edges }`. `order` maps each section id (0 for none) to its task ids in drawing order; `edges` is the dependency list. |
| `resolveTask(id, node, structure, previousId)` | How one task's start and end are to be written, after every fallback. |
| `scheduleTasks(resolved, todayMs)` | Rough start and end dates for every task, and which are unknown. Used to choose placeholders. |
| `stackFollowers(ids, preds)` | The rule that puts followers beneath what they follow. |
| `ganttAxisLines(timeline, pixelsPerDay)` | The axis lines for a zoom level. |
| `loadStructure(chart)` | The indexes these use: `{ nodes, groups, parents }` as `Map`s. |

## Tables and CSV

```js
import { chartToTable, tableToCSV } from './lib/mermaid-extras.js';

const { columns, rows } = chartToTable(chart, 'gantt');   // the second argument is optional: a "view as"
const csv = tableToCSV(columns, rows);
```

Each type has its own columns: a Gantt chart gives section, task, kind, status, start and end; a Kanban board gives column, card, priority and assignee; a tree is indented across columns; flow charts list each box with where it sits and what it follows.

## Settings: defaults and cleaners

| | |
|---|---|
| `ganttDefaults()`, `treeviewDefaults()` | Complete chart settings objects. |
| `ganttNodeDefaults()`, `treeviewNodeDefaults()` | Complete per-box settings objects. |
| `chartGanttSettings(chart)`, `chartTreeviewSettings(chart)` | A chart's settings with the defaults filled in. |
| `nodeGanttSettings(node)`, `nodeTreeviewSettings(node)` | A box's settings with the defaults filled in. |
| `cleanGanttSettings(input)`, `cleanTreeviewSettings(input)` | Validate chart settings from a form. Always return a complete, valid object. |
| `cleanGanttNodeSettings(input, { validIds, selfId })`, `cleanTreeviewNodeSettings(input)` | Validate a box's settings. Return `{ settings, error }`: `error` is a sentence you can show the person, and `settings` is `null` if there is one. |

The option lists the demo's forms are built from are exported too: `GANTT_AXIS_PRESETS`, `GANTT_COLOUR_FIELDS`, `GANTT_LAYOUT_FIELDS`, `ICON_PACKS`, `DAYS`, `NODE_SHAPES`, `KANBAN_PRIORITIES`, `CHART_TYPES`.
