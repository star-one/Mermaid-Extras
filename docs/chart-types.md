# Chart types

All six types are drawn from the same [data model](data-model.md), so any chart can be drawn as any type. This page says what each type uses and what it ignores.

| Type | Mermaid diagram | Groups are... | Uses these box fields |
|---|---|---|---|
| `flowchart` | `flowchart` | boxes drawn around their contents | `caption`, `shape`, `colour`, `groupId`, `parents` (with labels) |
| `swimlane` | `swimlane-beta` | lanes | the same as a flow chart |
| `mindmap` | `mindmap` | not used | `caption`, `shape`, the first `parent` |
| `kanban` | `kanban` | columns | `caption`, `groupId` (required), `priority`, `assignee` |
| `treeview` | `treeView-beta` | not used | `caption`, the first `parent`, `settings.treeview` |
| `gantt` | `gantt` | sections | `caption`, `groupId`, `parents`, `settings.gantt` |

## Flow charts and swimlanes

Boxes are joined by arrows from each of their parents, and the arrow can carry a label. Each group is drawn as a box around the boxes in it, with its own background colour and its own direction. Boxes that are in no group sit in an invisible group so that they still follow the chart's direction.

Groups are drawn from the highest `order` down in a flow chart, and from the lowest up in a swimlane chart. A group with no boxes in it is not drawn.

Swimlanes use Mermaid's `swimlane-beta` diagram, so they need a Mermaid version that has it (11.17.2 does).

## Mind maps

The hierarchy comes from each box's **first** parent; boxes with no parent hang off a synthetic centre named after the chart. Other parents, labels, colours and groups are ignored. Mermaid numbers mind map nodes itself, so the library keeps a lookup (`meta.mindmapNodeIndex`) from Mermaid's number to your box id, which is how clicks are resolved. Clicking the centre reports `{ kind: 'node', id: 0, isRoot: true }`.

By default mind maps use Mermaid's `tidy-tree` layout. Pass `mindmapLayout: ''` to `ChartView` to use Mermaid's own default instead.

## Kanban boards

Groups are the columns and boxes are the cards. A card's `priority` is one of `Very Low`, `Low`, `Medium`, `High`, `Very High` or `Critical`, and its `assignee` is shown on the card. Mermaid has no *Critical* priority, so those cards are sent as *Very High* and their stripe is recoloured after drawing.

A card that is in no column is **not shown**: a board has nothing to draw it in. (That is the one place the types differ in what they show.) A board with no columns shows a placeholder card, because Mermaid cannot draw an empty board.

## Tree views and Gantt charts

These have their own pages: [Tree views](treeview.md) and [Gantt charts](gantt.md).

## Drawing a chart as a different type

```js
await view.render(chart, { type: 'treeview' });   // the chart is not changed: only how it is drawn
```

Nothing is lost or converted. A box that has never been set up for the type it is drawn as gets sensible defaults:

- as a **Gantt chart**, a box starts after its parents (or after the task before it if it has none) and lasts a day;
- as a **tree**, a box sits inside its first parent and is shown as a folder if anything is inside it;
- as a **Kanban board**, a box needs to be in a group to appear.

Per-type settings are stored separately (`settings.gantt`, `settings.treeview`), so what you set up for one type is still there when you come back to it.

## Moving a chart between types

To make the change permanent, change `chart.type` and render again. Nothing else needs to change. The [demo](../demo/) explains what a switch does to the viewer before it happens: see `demo/js/views/chart-notes.js`.
