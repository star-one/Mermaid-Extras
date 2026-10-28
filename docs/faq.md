# Limits and questions

## Can I share a chart made in the demo?

No. The demo keeps charts in your own browser's local storage, which is private to you on that device: there is no account and no server. Another person (or another browser of yours) will not see them. To move charts yourself, use *Export all* on the dashboard to save a JSON file, and *Import* to load it elsewhere. Sharing is something *you* add when you build the library into a project that has a database.

## The demo says Mermaid could not be loaded.

The demo loads Mermaid from a CDN, so it needs an internet connection. Check your connection and any ad or script blocker, or host Mermaid yourself: see [Hosting](hosting.md).

## The demo is blank, or the docs won't load.

You are probably opening `index.html` straight from your files. Serve the folder over HTTP instead (`npx serve .`): browsers refuse to load ES modules and fetch files from `file://`.

## Which Mermaid versions work?

11.14 or newer, because the Tree view needs it. Everything is tested against **11.17.2**. The Tree view (`treeView-beta`) and swimlanes (`swimlane-beta`) are beta diagrams in Mermaid, so their syntax can still change: pin the version you tested.

## Why aren't there Mermaid `click` directives?

Mermaid's `click` needs `securityLevel: 'loose'` and a global function to call. The library catches clicks with one listener on the container and works out what was clicked from the drawn SVG, so Mermaid stays at its safer `strict` level and nothing is added to the global scope.

## Why can't a Gantt task last less than a day?

Dates are entered without times, so a day is the smallest unit: the one-day minimum is what the rest of the Gantt chart is built around. (A milestone is a moment and is written with a length of zero.)

## Does it work on a phone?

It has not been tested on phones or tablets. Nothing in the library depends on a mouse (clicks are ordinary click events), but the demo's toolbar is designed for a desktop-sized screen, and the zooms are buttons rather than pinching.

## How big a chart can it handle?

Drawing is Mermaid's, so Mermaid's limits apply: a very large chart is slow to draw. The Gantt timeline zoom caps the width it draws at about 60,000 pixels, and uses day ticks only when it is zoomed in far enough to read them.

## Known limits

- **Gantt:** dates only (no times); the placeholder dates for unknown starts and ends ignore excluded days (known dates are unaffected); see [Gantt charts](gantt.md#limits-worth-knowing).
- **Mind maps:** only each box's first parent is used. Mermaid numbers mind map nodes itself, so clicks are resolved through a lookup built from the drawing order.
- **Tree view rows** are matched to boxes by their position in the drawing. If Mermaid ever draws a different number of rows than expected, rows stop being clickable (the chart still draws).
- **Kanban:** a card must be in a column to appear. Mermaid cannot draw a board with no columns, so an empty one shows a placeholder.
- **Exports:** a PNG is made in the browser from the SVG, so it can differ slightly from the screen if the browser drops some HTML label styling (see [Zoom and export](zoom-and-export.md#if-a-png-has-missing-text)).
- **The sticky-note board** of the original application is not included.

## Can I use only part of it?

Yes. `buildDiagram()` works on its own (see [Builders and helpers](builders-api.md)), and `ChartView` is the only part that needs a browser. The data model and the cleaners are plain functions.

## Is it accessible?

The charts are Mermaid's SVG, so their accessibility is Mermaid's. `chartToTable()` gives you the same information as rows and columns, which is the best way to offer an accessible alternative; the demo does this with its *Table* panel.
