# Mermaid Extras

**Zoom, export, click-to-edit, a Tree view and a far richer Gantt chart for [Mermaid](https://mermaid.js.org).**

A small set of plain JavaScript modules that sit on top of Mermaid: no build step, no dependencies of their own, and no server. Mermaid does all the drawing; Mermaid Extras adds what people keep asking it for.

> **Try the demo:** serve this folder and open `/demo/` (see [Running the demo](#running-the-demo)). It keeps your charts in your own browser's local storage, so **what you make there is private to you and can't be shared**.

## What it adds

| | |
|---|---|
| **Image zoom** | Zoom the finished chart, fit it to the width or height, and have each chart remember its zoom. |
| **Timeline zoom** | Zoom a Gantt chart's *timeline*: 7 weeks by default, with day, week and month ticks that change as you zoom. Mermaid can't do this by itself. |
| **Export** | PNG and SVG (with the chart's name above it) and CSV. |
| **Click to edit** | Click a box, card, task, tree row or group and get an event. You decide what happens. |
| **Six chart types, one data model** | Flow chart, swimlanes, mind map, Kanban, **Tree view** and **Gantt**. Draw any chart as any other type ("view as") without changing it. |
| **A fuller Gantt chart** | Dependencies with arrows, followers stacked beneath what they follow, **unknown start and end dates**, milestones, vertical markers, status colours you control, excluded days, a today marker and more. |
| **Tree view** | Folders, highlights, descriptions and icons. |

## Quick start

Copy `lib/` into your project, then:

```html
<link rel="stylesheet" href="lib/mermaid-extras.css">
<div id="chart" style="height: 600px"></div>

<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs';
  import { ChartView, createChart, createGroup, createNode } from './lib/mermaid-extras.js';

  const chart = createChart({ name: 'Website relaunch', type: 'gantt' });
  const design = createGroup(chart, { name: 'Design' });
  createNode(chart, {
    caption: 'Wireframes', groupId: design.id,
    settings: { gantt: { startMode: 'date', startDate: '2026-11-02', endMode: 'duration', durValue: 2, durUnit: 'w' } },
  });

  const view = new ChartView(document.getElementById('chart'), { mermaid });
  view.on('target', ({ kind, id }) => console.log('clicked', kind, id));
  await view.render(chart);

  // view.zoom.in()   view.timelineLonger()   view.exportPNG()   view.render(chart, { type: 'treeview' })
</script>
```

Read on in **[docs/getting-started.md](docs/getting-started.md)**.

## What is in the repository

The reusable code and the demo are kept strictly apart.

```text
mermaid-extras/
├── lib/        THE LIBRARY: what you copy into your own project
│   ├── mermaid-extras.js     the entry point
│   ├── mermaid-extras.css    the only stylesheet you need
│   └── src/                  builders, settings, zoom, export, decorations
├── docs/       the documentation (Markdown; the demo site shows it too)
├── demo/       THE DEMO SITE: not part of the library
│   ├── index.html
│   ├── css/    the dashboard styling
│   └── js/     routing, browser storage, forms, pages
├── tests/      automated tests (Node + jsdom + the real Mermaid)
└── index.html  sends visitors to the demo
```

Nothing in `lib/` imports anything from `demo/`. The demo uses the library only through `lib/mermaid-extras.js`, just as your code would, so it doubles as a worked example.

## Documentation

| | |
|---|---|
| [Getting started](docs/getting-started.md) | From nothing to a chart you can zoom, export and click. |
| [The chart data model](docs/data-model.md) | A chart, its boxes and groups, as JSON. |
| [Chart types](docs/chart-types.md) | What each type uses, and "view as". |
| [Gantt charts](docs/gantt.md) | Tasks, dependencies, unknown dates, the timeline, colours, settings. |
| [Tree views](docs/treeview.md) | Folders, highlights, icons. |
| [ChartView reference](docs/chart-view-api.md) | Every option, method and event. |
| [Builders and helpers](docs/builders-api.md) | Generate Mermaid source without `ChartView`. |
| [Zoom and export](docs/zoom-and-export.md) | How both zooms and every export work. |
| [Click to edit](docs/editing.md) | Wiring clicks to forms and storage. |
| [Styling](docs/styling.md) | The CSS classes and Mermaid theming. |
| [Hosting](docs/hosting.md) | GitHub Pages, your own server, hosting Mermaid yourself. |
| [Limits and questions](docs/faq.md) | Known limits, and what to try when something doesn't work. |

## Running the demo

Browsers won't load ES modules from `file://`, so serve the folder:

```text
npx serve .                 # or: python3 -m http.server 8080
```

and open `http://localhost:8080/demo/`. The demo needs an internet connection to fetch Mermaid from a CDN (or see [Hosting](docs/hosting.md) to host it yourself).

**The demo stores everything in your browser's local storage.** That keeps it private and needs no server, but it means charts can't be shared between people, or even between your browsers, and clearing your browsing data deletes them. The demo has *Export all* and *Import* so you can keep a copy.

## Requirements

- **Mermaid 11.14 or newer** (the Tree view needs it). Everything is tested with **11.17.2**.
- A current browser with ES module support.

## Tests

```text
npm install
npm test
```

The tests use the real Mermaid in jsdom. jsdom has no layout engine, so they check what is drawn, clicked and saved, but not how it *looks*: look at visual changes in a real browser. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT: see [LICENSE](LICENSE). Put your own name in the copyright line before you publish.

Mermaid Extras is an independent project. It is not affiliated with or endorsed by the Mermaid project; all the drawing is done by [Mermaid](https://mermaid.js.org).
