# Mermaid Extras

Mermaid Extras adds the things people keep asking [Mermaid](https://mermaid.js.org) for: **zoom**, **export**, **click to edit**, a **Tree view**, and a far richer **Gantt chart**. It is a small set of plain JavaScript modules that sit on top of Mermaid. There is nothing to build and nothing to install except Mermaid itself.

It started life inside a project-management tool, where charts were stored in a database and edited in the browser. Everything useful from that work is here, separated from the application it came from, so you can use it in yours.

## What you get

- **Image zoom.** Zoom the finished chart in and out, fit it to the width or height of the screen, and have each chart remember its own zoom. See [Zoom and export](zoom-and-export.md).
- **Timeline zoom for Gantt charts.** Mermaid cannot zoom a Gantt chart's timeline. This can: the default view is seven weeks, and the axis switches between day, week and month ticks as you zoom. See [Gantt charts](gantt.md).
- **Export** as PNG or SVG (with the chart's name written above it), and the chart's data as CSV.
- **Click to edit.** Click any box, card, task or group and get an event telling you what it was. You decide what to do with it. See [Click to edit](editing.md).
- **Six chart types from one data model:** flow chart, swimlanes, mind map, Kanban board, Tree view and Gantt chart. Any chart can be drawn as any of the others (a "view as") without changing it. See [Chart types](chart-types.md).
- **A much fuller Gantt chart:** dependencies with arrows, tasks that follow on from other tasks, tasks with an unknown start or end, milestones, vertical markers, status colours you can change, excluded days, and more. See [Gantt charts](gantt.md).
- **A Tree view** with folders, highlights, descriptions and icons. See [Tree views](treeview.md).

## What is in this repository

The repository keeps the reusable code and the demo strictly apart:

| Folder | What it is | Do you need it? |
|---|---|---|
| `lib/` | **The library.** Plain ES modules and one small stylesheet. | **Yes: this is what you use.** |
| `docs/` | These documentation pages, as Markdown. | Read them; the demo site also displays them. |
| `demo/` | The demo site: a dashboard that stores charts in the browser's local storage. | No. It is an example, and a reference for wiring up forms and storage. |
| `tests/` | Automated tests (they use Node, jsdom and the real Mermaid). | Only if you are contributing. |

Nothing in `lib/` imports anything from `demo/`. The demo only uses the library through its public entry point, `lib/mermaid-extras.js`, exactly as your own code would.

## How it fits together

1. You describe a chart as a plain JSON object: its type, its **groups** and its **boxes**. See [The chart data model](data-model.md).
2. `buildDiagram(chart)` turns that into Mermaid source text. See [Builders and helpers](builders-api.md).
3. `ChartView` draws it with Mermaid, adds the zoom, export and decorations, and tells you when something is clicked. See [ChartView reference](chart-view-api.md).
4. You store the chart wherever you like. The library never stores anything itself.

## Requirements

- **Mermaid 11.14 or newer.** (The Tree view needs 11.14; everything is tested against 11.17.2.) You pass Mermaid in, so you control the version and where it is loaded from.
- A current browser: anything that supports ES modules, `<dialog>` (only the demo uses it) and SVG masks.
- To run the demo or the docs locally you need to serve the folder over HTTP (browsers will not load modules from `file://`). See [Hosting](hosting.md).

## Licence and credits

MIT licensed: see `LICENSE`. Mermaid Extras is an independent project and is not affiliated with or endorsed by the Mermaid project; all the drawing is done by Mermaid itself.
