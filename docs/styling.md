# Styling

## The stylesheet

`lib/mermaid-extras.css` is small and every rule is namespaced with `mx-`. It does four things: gives the view a minimum height, makes the scrolling box fill it, stops Mermaid's own `max-width` from fighting the zoom, and sets a pointer cursor on clickable things.

| Class | Where | Use |
|---|---|---|
| `.mx-view` | your container | Set its height to make the chart scroll inside a fixed area. |
| `.mx-scroll` | inside it | The scrolling box. |
| `.mx-canvas` | inside that | Holds the `<svg>`. |
| `.mx-clickable` | boxes, groups, bars | Clickable (see [Click to edit](editing.md)). Add a hover effect here. |
| `.mx-add-only` | the centre of a mind map | Can be clicked to add to, but is not a real box. |
| `.mx-dependencies` | Gantt `<g>` | The dependency arrows. |
| `.sectionTitleBg` | Gantt `<rect>` | The white box behind a pinned section name. |

```css
.mx-clickable:hover { filter: drop-shadow(0 0 3px rgba(0, 120, 255, .6)); }
#chart { height: 70vh; border: 1px solid #ddd; }
```

## Mermaid's own look

Anything Mermaid can be configured with goes in `mermaidConfig`:

```js
new ChartView(el, {
  mermaid,
  mermaidConfig: {
    theme: 'neutral',
    themeVariables: { fontFamily: 'Georgia, serif' },
  },
});
```

The chart's own options (task colours, tree view icons) are merged over this, so a chart's colours still win. See [Mermaid's theming docs](https://mermaid.js.org/config/theming.html) for what themes and variables exist.

## The Gantt chart's colours

The colours of the task bars are chart settings, so they travel with the chart: see [the colour table](gantt.md#colours). They are applied as Mermaid theme variables, which means a theme in `mermaidConfig` is the base and the chart's colours are laid over it.

## The Tree view's colours

Also chart settings (`labelColor`, `lineColor`, `iconColor`, `descriptionColor` and the three highlight settings): see [Tree views](treeview.md#chart-settings).

## Dark backgrounds

The library draws on a transparent background and uses Mermaid's colours, so for a dark page use a dark Mermaid theme and set the colours you need:

```js
new ChartView(el, { mermaid, mermaidConfig: { theme: 'dark' } });
```

Exported PNGs have a white background whatever the page looks like. The Gantt section-name boxes are white too, so they always stay readable.

## Printing

The chart is an SVG, so it prints crisply. Print a whole chart by exporting it (`exportSVG()` or `exportPNG()`), which always uses the chart's real size and ignores the on-screen zoom and scrolling.
