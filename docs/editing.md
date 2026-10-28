# Click to edit

The library draws charts and tells you what was clicked. Everything else (forms, saving, deciding what a click should *do*) is yours. This page shows the pattern, and the demo is a complete example of it.

## Clicks

```js
view.on('target', (target) => {
  // target.kind     'node' or 'group'
  // target.id       the box or group id (0 has a special meaning, below)
  // target.element  the SVG element that was clicked
  // target.isRoot   true for the centre of a mind map
  // target.event    the browser's click event
});
```

What counts as a target depends on the type of chart:

| Chart | Clickable | Notes |
|---|---|---|
| Flow chart, swimlane | boxes (`node`), groups and lanes (`group`) | A click on the invisible "not in a group" group reports `group` with id `0`. |
| Mind map | nodes (`node`) | The centre reports `{ kind: 'node', id: 0, isRoot: true }`: it is the chart's name, not a box. |
| Kanban | cards (`node`) and column **headings** (`group`) | The rest of a column is just a backdrop for its cards. |
| Tree view | rows (`node`) | Rows are tagged after drawing (see [Tree views](treeview.md)). |
| Gantt | task bars and their text (`node`) | Section names are not clickable: offer a list of sections instead. |

Everything clickable gets the CSS class `mx-clickable`, so you can show a pointer or a hover effect. The centre of a mind map also gets `mx-add-only`.

No Mermaid `click` directives are used and Mermaid's `securityLevel` stays at `strict`. Clicks are caught by one listener on the container.

## The pattern

1. On `target`, look the box or group up in your chart by `id`.
2. Show a form.
3. Check the answer (the library has [cleaners](data-model.md#checking-user-input) for the Tree view and Gantt fields).
4. Put the result in the chart, **save it**, and call `view.render(chart)` again.

```js
view.on('target', ({ kind, id }) => {
  if (kind !== 'node' || !id) return;
  const node = chart.nodes.find((n) => n.id === id);
  const caption = prompt('Rename', node.caption);
  if (caption === null) return;
  node.caption = caption;
  save(chart);               // yours: a fetch(), localStorage, ...
  view.render(chart);
});
```

Drawing again is cheap, keeps the zoom the visitor chose, and (for a Gantt chart) keeps their timeline zoom.

## Adding by clicking

A nice pattern, used by the demo, is a switch between *click to edit* and *click to add*. In add mode, clicking a box starts a new box that is connected to it:

| Drawn as | The new box starts... |
|---|---|
| flow chart, swimlane | connected to the clicked box, in the same group (or the clicked group) |
| mind map, tree view | as a child of the clicked box |
| Kanban | in the same column |
| Gantt | after the clicked task, in the same section |

The demo has this as one small function, `defaultsForTarget()` in `demo/js/views/chart-page.js`.

## Editing while "viewing as" another type

A chart can be drawn as a different type with `render(chart, { type })`. If you let people edit in that view, build the forms for the type being *viewed*: someone looking at a mind map as a Gantt chart should get task fields. The type-specific settings are stored in the box (`settings.gantt`), so they do not disturb what the chart looks like in its real type.

Changing the chart's own settings (its name, its type, the chart-wide options) is best kept to the real view.

## The demo as a reference

Everything in `demo/` is application code written against the library's public API, so it is a good place to look when you wire up your own:

| File | Shows |
|---|---|
| `demo/js/views/chart-page.js` | `ChartView` in use: the toolbar, click handling, the add/edit/delete flows, "view as". |
| `demo/js/forms/form-kit.js` | A small form builder driven by data. Not part of the library: use your own form tools. |
| `demo/js/forms/node-form.js` | Which fields each type of box has, and how a form's values are checked with the cleaners and written to the chart. |
| `demo/js/forms/chart-form.js` | The chart-wide options for the Tree view and Gantt chart, with the rarely used ones in a twistout. |
| `demo/js/store.js` | Keeping charts in `localStorage`: the part you would replace with your own database or API. |
| `demo/js/samples.js` | Building charts in code with `createChart`, `createGroup` and `createNode`. |
