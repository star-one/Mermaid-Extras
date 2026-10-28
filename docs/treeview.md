# Tree views

A tree view draws an indented folder tree, using Mermaid's `treeView-beta` diagram (Mermaid 11.14 or newer). It is good for file layouts, outlines, taxonomies and anything else that is a hierarchy.

## The hierarchy

Each box sits inside its **first parent**. Boxes with no parent are at the top level. Order within a level is by the box's `order` number if it has one (lowest first), then oldest first. Groups, shapes, colours and connexion labels are not used.

```js
const root = createNode(chart, { caption: 'src' });
createNode(chart, { caption: 'index.js', parents: [{ id: root.id, label: '' }] });
```

A box with something inside it is always drawn as a **folder** (bold, with a trailing `/`). You can also mark a box as a folder yourself.

## An item

`node.settings.treeview`:

| Key | Default | What it does |
|---|---|---|
| `isDir` | `false` | Draw it as a folder even if nothing is inside it. |
| `highlight` | `false` | Highlight it (a coloured fill and border). |
| `description` | `''` | Text shown beside it, in the description colour. |
| `iconMode` | `'default'` | `'default'` (follow the chart), `'none'`, `'folder'`, `'file'`, or `'custom'`. |
| `iconCustom` | `''` | For `'custom'`: an icon as `pack:name`, e.g. `logos:react` or `material-icon-theme:rust`. |
| `order` | `''` | An explicit position among the items in the same place. |

`cleanTreeviewNodeSettings(input)` returns `{ settings, error }` and refuses a custom icon with no name.

## Chart settings

`chart.settings.treeview`. Run user input through `cleanTreeviewSettings()`.

| Key | Default | What it does |
|---|---|---|
| `showIcons` | `false` | Show the built-in file and folder icons. |
| `defaultIconPack` | `''` | The icon pack used for icon names with no prefix: `''`, `'material-icon-theme'` or `'logos'`. |
| `filenameIcons` | `''` | Icons for particular file names: lines of `Dockerfile = docker`. |
| `extensionIcons` | `''` | Icons for file extensions: lines of `ts = typescript` (use `none` to hide). |
| `rowIndent`, `paddingX`, `paddingY`, `lineThickness` | `10`, `5`, `5`, `1` | Spacing. |
| `labelFontSize` | `16` | Label size in pixels. |
| `labelColor`, `lineColor`, `iconColor`, `descriptionColor` | `#000000`, `#000000`, `#546e7a`, `#6a9955` | Colours. |
| `highlightBg`, `highlightBgOpacity`, `highlightStroke` | `#ffc107`, `0.15`, `#ffc107` | The highlight's fill, how opaque it is, and its border. |

## Icons

The icon packs are not bundled with Mermaid. `ChartView` registers two (`material-icon-theme` and `logos`) and they are loaded **on demand from the jsDelivr CDN** the first time a chart needs them. To avoid that (for an offline site, or a strict content security policy), pass `iconPacks: false` and register your own packs with `mermaid.registerIconPacks()`. See [Hosting](hosting.md).

## How the options reach Mermaid

Mermaid quietly drops some of a tree view's options when they are put in the diagram's own front matter (the icon, description and highlight colours among them), so they are passed to `mermaid.initialize()` instead. `buildDiagram()` puts them in `result.config`, and `ChartView` does the rest. If you draw charts yourself, pass `result.config` to `mermaid.initialize()` before every `render()`.

## Clicking a row

Mermaid doesn't mark tree rows with anything you can use to identify them, so after drawing, `ChartView` tags each row with its box id (`data-mx-node-id`), matching them up by position. If the number of rows is not what was expected, nothing is tagged and rows simply are not clickable: the chart still draws.
