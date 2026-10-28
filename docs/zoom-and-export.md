# Zoom and export

## Picture zoom

`view.zoom` scales the finished picture. It sets an explicit pixel width and height on the SVG rather than using a CSS transform, so the scroll container's own scrollbars work naturally.

```js
view.zoom.in();          // +10%
view.zoom.out();         // -10%
view.zoom.set(1.5);      // 150%
view.zoom.reset();       // 100%
view.zoom.fitWidth();    // fit the container's width
view.zoom.fitHeight();   // fit what is visible of the window's height
view.on('zoom', ({ percent }) => (label.textContent = percent + '%'));
```

- **The range** is 10% to 300% by default (`minZoom`, `maxZoom`, `zoomStep` options).
- **A new chart starts at 100%**, not fitted to the screen, and every chart then remembers its own zoom.
- **A fit follows the window.** After `fitWidth()` or `fitHeight()` the chart is re-fitted when the window is resized, until you zoom some other way.
- **A "view as" has its own zoom.** Looking at a chart as a different type starts at 100% and never changes how the real chart is zoomed.

## Timeline zoom (Gantt)

A Gantt chart has a second zoom, which changes how much *time* is shown rather than how big the picture is:

```js
view.timelineLonger();    // show more time
view.timelineShorter();   // show less time
view.timelineDefault();   // 7 weeks, starting with last week
view.timelineShowAll();   // everything on the chart
```

The two zooms combine: the timeline zoom decides how many days fit across the screen at 100%, and the picture zoom then scales that. The details, including how the axis changes, are in [Gantt charts](gantt.md#the-timeline).

## Exporting

```js
view.exportPNG();                         // downloads  Roadmap-2026.png
view.exportPNG({ scale: 3 });             // a larger PNG
view.exportSVG();                         // downloads  Roadmap-2026.svg
view.exportCSV();                         // downloads  Roadmap-2026.csv
const blob = await view.getPNG();         // or get the data to upload or show instead
const svgText = view.getSVG();
```

### What an export contains

- **Always the chart's true size**, whatever the picture zoom is set to.
- **The chart's name written above it** (turn this off with `exportTitle: false`). The image is made wider if the title is wider than the chart.
- **A white background** for the PNG (the SVG itself is transparent).
- **Everything where Mermaid drew it:** a Gantt chart's section names, which are pinned to the edge of the screen while you scroll, are put back in their places and their white boxes removed.
- **The decorations:** dependency arrows, faded bars and recoloured Kanban stripes are all part of the SVG, so they are in every export.

The PNG is made by drawing the SVG onto a canvas at twice its size by default (`scale`).

### CSV

`getCSV()` gives the chart's data for the type it is currently drawn as, using the same columns as `chartToTable()`. Fields are always quoted, so commas, quotes and line breaks inside a caption are safe.

### If a PNG has missing text

Flow chart labels are HTML inside the SVG. Some browsers drop the styling of that HTML when an SVG is drawn onto a canvas. If your PNGs have missing or unstyled labels, try asking Mermaid for plain SVG text:

```js
new ChartView(el, { mermaid, mermaidConfig: { flowchart: { htmlLabels: false } } });
```

Your own fonts are only used in an export if they are installed where the image is made; the export title's font is taken from the container (set `fontFamily` to choose another).
