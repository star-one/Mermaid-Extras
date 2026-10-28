# Getting started

This page takes you from nothing to a chart on your page that you can zoom, export and click.

## 1. Copy the library

Copy the `lib/` folder into your project. It has no dependencies and no build step. (You can rename the folder; the files refer to each other with relative paths.)

```text
your-project/
  lib/
    mermaid-extras.js      <- the entry point you import
    mermaid-extras.css     <- the only stylesheet you need
    src/                   <- the rest of the library
```

## 2. Put a container on the page

```html
<link rel="stylesheet" href="lib/mermaid-extras.css">

<div id="chart" style="height: 600px"></div>

<script type="module" src="main.js"></script>
```

Give the container a height if you want the chart to scroll inside a fixed area; leave it out and the container grows with the chart.

## 3. Draw a chart

```js
// main.js
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs';
import { ChartView, createChart, createGroup, createNode } from './lib/mermaid-extras.js';

// A chart is a plain object. These helpers build one for you.
const chart = createChart({ name: 'Website relaunch', type: 'gantt' });
const design = createGroup(chart, { name: 'Design' });
createNode(chart, {
  caption: 'Wireframes',
  groupId: design.id,
  settings: { gantt: { startMode: 'date', startDate: '2026-11-02', endMode: 'duration', durValue: 2, durUnit: 'w' } },
});

const view = new ChartView(document.getElementById('chart'), { mermaid });
await view.render(chart);
```

You pass Mermaid in rather than the library importing it, so you decide which version to use and where it comes from (a CDN, your own server, or a bundler).

## 4. Add some controls

`ChartView` has no buttons of its own: it gives you methods, and you call them from whatever interface you have.

```js
document.getElementById('zoom-in').onclick  = () => view.zoom.in();
document.getElementById('zoom-out').onclick = () => view.zoom.out();
document.getElementById('fit').onclick      = () => view.zoom.fitWidth();
document.getElementById('png').onclick      = () => view.exportPNG();
document.getElementById('svg').onclick      = () => view.exportSVG();

// Gantt charts only: zoom the timeline itself
document.getElementById('longer').onclick  = () => view.timelineLonger();   // show more time
document.getElementById('shorter').onclick = () => view.timelineShorter();  // show less time
```

## 5. React to clicks

```js
view.on('target', ({ kind, id }) => {
  if (kind === 'node')  console.log('a box or task was clicked:', id);
  if (kind === 'group') console.log('a group, lane, column or section was clicked:', id);
});
```

What you do next is up to you: open a form, call your API, change the chart and call `view.render(chart)` again. See [Click to edit](editing.md).

## 6. Keep the chart somewhere

A chart is JSON, so `JSON.stringify(chart)` is all it takes to store it, and `normaliseChart(JSON.parse(text))` tidies it on the way back in:

```js
import { normaliseChart } from './lib/mermaid-extras.js';

localStorage.setItem('my-chart', JSON.stringify(chart));
const again = normaliseChart(JSON.parse(localStorage.getItem('my-chart')));
```

## Running it

Browsers refuse to load ES modules from `file://` addresses, so serve the folder:

```text
npx serve .
python3 -m http.server 8080
```

## Using it with a bundler or npm

The library is plain ES modules, so Vite, webpack, esbuild and the like all work with it. If you would rather install it than copy it, you can depend on the repository directly:

```text
npm install github:your-name/mermaid-extras
```

```js
import { ChartView } from 'mermaid-extras';
import 'mermaid-extras/css';
```

## Next steps

- [The chart data model](data-model.md): every field of a chart, box and group.
- [Chart types](chart-types.md): what each type uses.
- [ChartView reference](chart-view-api.md): every option, method and event.
- The `demo/` folder is a complete working application built on the library: see [Click to edit](editing.md) for a guide to it.
