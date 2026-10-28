# ChartView reference

`ChartView` draws a chart into an element and adds the zoom, export and decorations. It has no buttons or forms of its own: it gives you methods and events, and you build the interface.

```js
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs';
import { ChartView } from './lib/mermaid-extras.js';

const view = new ChartView(document.getElementById('chart'), { mermaid });
view.on('target', ({ kind, id }) => { /* ... */ });
await view.render(chart);
```

## `new ChartView(container, options)`

`container` is an element. The view fills it (it adds the class `mx-view` and one scrolling child), so give it a height if you want the chart to scroll inside a fixed area.

| Option | Default | What it does |
|---|---|---|
| `mermaid` | *required* | The Mermaid object: the default export of the Mermaid ES module. |
| `storage` | `localStorage` | Where zoom levels are remembered: an object with `get(key)`, `set(key, value)` and `remove(key)`. Pass `null` to remember nothing. See below. |
| `securityLevel` | `'strict'` | Mermaid's `securityLevel`. Nothing here needs `'loose'`. |
| `mermaidConfig` | `{}` | Extra options for `mermaid.initialize()`: a theme, fonts, and so on. The chart's own options (task colours, tree icons) are merged over these, one level of nesting deep. |
| `mindmapLayout` | `'tidy-tree'` | Mind map layout. `''` uses Mermaid's own default. |
| `iconPacks` | `true` | Register the Tree view icon packs (loaded from a CDN when first needed). `false` if you register your own. |
| `ganttTimeline` | `true` | Enable the timeline zoom for Gantt charts. `false` draws a Gantt chart like any other. |
| `interactive` | `true` | Tag clickable things (class `mx-clickable`) and emit `target` events. |
| `minZoom`, `maxZoom`, `zoomStep` | `0.1`, `3`, `0.1` | Limits and step of the picture zoom (1 is 100%). |
| `exportTitle` | `true` | Write the chart's name above exported images. |
| `fontFamily` | the container's | The font for that title. |

## Methods

### `render(chart, options?)` → `Promise<void>`

Draws a chart, replacing whatever was there. The chart is tidied with `normaliseChart()` first. Calls queue up: if you call `render` twice quickly, they finish in order.

| Option | What it does |
|---|---|
| `type` | Draw the chart as this type instead of `chart.type`: a "view as". The chart itself is not changed. |
| `today` | A date, `'YYYY-MM-DD'`, to treat as today (handy in tests). |

The promise rejects, and an `error` event is emitted, if Mermaid cannot draw the chart. The old picture is cleared.

### Picture zoom: `view.zoom`

| | |
|---|---|
| `zoom.zoom` | the current zoom, as a number (1 is 100%) |
| `zoom.in()`, `zoom.out()` | one step up or down |
| `zoom.set(z)` | a particular zoom, within the limits |
| `zoom.reset()` | back to 100% |
| `zoom.fitWidth()`, `zoom.fitHeight()` | fit the chart to the width or height of the container. A fit keeps following the window as it is resized, until you zoom some other way. |

Every one of these remembers the result (see *Remembering*, below).

### Gantt timeline

These do nothing (and return a resolved promise) for any other type of chart, or if the timeline zoom is not available. `view.hasTimeline` says whether it is.

| | |
|---|---|
| `timelineShorter()` | show less time: zoom in, more detail |
| `timelineLonger()` | show more time: zoom out, less detail |
| `timelineDefault()` | back to 7 weeks, starting with last week |
| `timelineShowAll()` | fit the whole chart across the screen |
| `view.timeline.describe()` | `{ pixelsPerDay, daysShown, label }`, where `label` is text such as `about 7 weeks shown` |

### Exporting

| | |
|---|---|
| `getSVG()` → string | The chart as a standalone SVG file's text. |
| `exportSVG(filename?)` | Downloads it. |
| `getPNG(scale = 2)` → `Promise<Blob>` | A PNG on a white background. |
| `exportPNG({ scale, filename })` → `Promise` | Downloads it. |
| `getCSV()` → string | The chart's data as CSV, for the type it is currently drawn as. |
| `exportCSV(filename?)` | Downloads it. |

File names default to the chart's name with anything awkward replaced by hyphens, and the right extension is added for you. See [Zoom and export](zoom-and-export.md).

### Events

```js
view.on('target', handler);   view.off('target', handler);
```

| Event | Detail | When |
|---|---|---|
| `target` | `{ kind: 'node' \| 'group', id, element, event, isRoot? }` | A box or group was clicked. See [Click to edit](editing.md). |
| `rendered` | `{ chart, type }` | A chart has been drawn. |
| `zoom` | `{ zoom, percent }` | The picture zoom changed. |
| `timeline` | `{ pixelsPerDay, daysShown, label }` | A Gantt timeline was drawn or zoomed. |
| `error` | `{ error }` | Mermaid could not draw the chart. |

### Other

| | |
|---|---|
| `destroy()` | Removes the listeners and empties the container. |
| `pinTitles()` | Re-pins the Gantt section names. Called for you on scroll and zoom. |

## Properties

`view.chart` (the tidied chart last rendered), `view.viewType` (the type it is drawn as), `view.diagram` (the `buildDiagram()` result), `view.svg` (the current `<svg>`), `view.canvas` and `view.scroller` (the elements), `view.container`, and `view.storage`.

## Remembering zoom levels

The picture zoom and the Gantt timeline zoom are remembered per chart, so that a chart comes back the way the visitor left it. By default they go in `localStorage` under keys that start with `mermaid-extras:`:

| Key | Holds |
|---|---|
| `zoom:<chart id>` | the picture zoom, e.g. `1.2` |
| `timeline:<chart id>` | `{"mode":"days","days":20}` or `{"mode":"all"}`. The default view is not stored. |

A chart drawn as a different type ("view as") uses its own keys, ending in `:as-<type>`, so looking at a chart another way never changes how the real chart is zoomed.

To keep these somewhere else (a cookie, your server, `sessionStorage`), pass your own object:

```js
const view = new ChartView(el, {
  mermaid,
  storage: {
    get: (key) => sessionStorage.getItem('mine:' + key),
    set: (key, value) => sessionStorage.setItem('mine:' + key, value),
    remove: (key) => sessionStorage.removeItem('mine:' + key),
  },
});
```
