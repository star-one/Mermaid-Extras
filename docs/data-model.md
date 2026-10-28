# The chart data model

A chart is a plain, JSON-serialisable object. The library never stores it for you: keep it in a database, a file, a cookie or an API, whichever suits your project.

```js
const chart = {
  id: 'roadmap-2026',            // any string you like; the library only uses it to key remembered zoom levels
  name: 'Roadmap 2026',
  type: 'gantt',                 // 'flowchart' | 'swimlane' | 'mindmap' | 'kanban' | 'treeview' | 'gantt'
  direction: 'TB',               // 'TB' (top to bottom) or 'LR': flow charts and swimlanes only
  settings: {                    // chart-wide options for the Tree view and the Gantt chart
    treeview: { /* see Tree views */ },
    gantt:    { /* see Gantt charts */ },
  },
  groups: [
    { id: 1, name: 'Discovery', order: 1, colour: '#ececff', direction: 'TB' },
  ],
  nodes: [
    {
      id: 1,
      caption: 'User research',
      groupId: 1,                // 0 means "not in a group"
      parents: [{ id: 3, label: 'yes' }],   // the boxes this one follows on from, each with an optional label
      shape: 'rounded',          // flow charts, swimlanes and mind maps
      colour: '#ececff',         // flow charts and swimlanes
      priority: 'Medium',        // Kanban cards
      assignee: 'Sam',           // Kanban cards
      settings: {                // per-box options for the Tree view and the Gantt chart
        treeview: { /* ... */ },
        gantt:    { /* ... */ },
      },
    },
  ],
};
```

## Boxes and groups

The model uses two words for everything, and each chart type gives them its own name:

| Type | A **box** is a... | A **group** is a... |
|---|---|---|
| flow chart | box | group (drawn as a box around its boxes) |
| swimlane | box | lane |
| mind map | node | (not used) |
| Kanban | card | column |
| Tree view | item | (not used) |
| Gantt | task, milestone or marker | section |

Because it is one model, the same chart can be drawn as any type. See [Chart types](chart-types.md).

## Rules

- **Ids** are positive integers you allocate, unique within the chart. `nextId(chart.nodes)` gives the next free one. Group id `0` is reserved for "not in a group".
- **`parents`** lists the boxes this one follows on from. A box can have several. What that means depends on how the chart is drawn: a flow chart draws an arrow from each parent; a mind map or tree uses only the first; a Gantt task starts after all of them.
- **A box is never dependent on a missing box.** Parents that don't exist, a group that doesn't exist, and a box that is its own parent are all ignored when the chart is drawn, and removed by `normaliseChart()`.
- **Settings are kept per type.** `settings.gantt` and `settings.treeview` sit side by side, so a chart can be switched from a Gantt chart to a tree and back without losing either's options.

## Helpers

```js
import { createChart, createGroup, createNode, normaliseChart, nextId } from './lib/mermaid-extras.js';
```

| Function | What it does |
|---|---|
| `createChart({ id, name, type, direction, settings })` | A new, empty, tidy chart. |
| `createGroup(chart, { name, order, colour, direction })` | Adds a group to the chart and returns it. `order` defaults to one more than the highest. |
| `createNode(chart, fields)` | Adds a box and returns it. Any field you leave out gets a sensible default. |
| `normaliseChart(input)` | Returns a tidy **copy**: every field present and of the right kind, colours and shapes checked, unknown groups and parents removed, text trimmed. Safe to call on anything loaded from storage or a user. |
| `nextId(items)` | The next free id in a list of groups or boxes. |

`ChartView` and `buildDiagram` call `normaliseChart()` themselves, so you can hand them rough data and they will not choke on it.

## Checking user input

Settings you get from a form should be passed through the library's *cleaners*, which fill in defaults and refuse bad values. They are plain functions, so they work on a server too.

```js
import { cleanGanttNodeSettings, cleanGanttSettings, cleanTreeviewSettings, cleanTreeviewNodeSettings } from './lib/mermaid-extras.js';

const { settings, error } = cleanGanttNodeSettings(formValues, { validIds: [1, 2, 3], selfId: 4 });
if (error) showError(error);                 // e.g. "The shortest duration is one day."
else node.settings = { ...node.settings, gantt: settings };

chart.settings.gantt = cleanGanttSettings(chartFormValues);       // always returns a complete, valid object
```

## Moving from the numeric type codes

If you are porting from the project-management tool this library came out of, its chart types were stored as numbers:

| Number | Type |
|---|---|
| 1 | `flowchart` |
| 2 | `swimlane` |
| 3 | `mindmap` |
| 4 | *(a sticky-note board: retired, not included)* |
| 5 | `kanban` |
| 6 | `treeview` |
| 7 | `gantt` |

There, a Kanban card's priority and assignee were stored in the box's shape and colour columns; here they have fields of their own (`priority`, `assignee`).
