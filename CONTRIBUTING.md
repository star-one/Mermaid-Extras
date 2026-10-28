# Contributing

Thank you for thinking of it. This is a small project and contributions of every size are welcome: a bug report, a documentation fix, a new option.

## Ground rules

- **`lib/` is the library and `demo/` is the demo, and they stay apart.** `lib/` must never import from `demo/`, from `tests/`, or from anything outside itself. The demo may only use the library through `lib/mermaid-extras.js`, as a user of it would.
- **No build step, no runtime dependencies.** The library is plain ES modules that run in a browser as they are. Mermaid is passed in by the user, never imported by the library.
- **Pure functions where you can.** The builders, settings cleaners and table code touch neither the DOM nor Mermaid, which is what makes them easy to test and to use on a server.
- **Say what is untested.** If you change how something looks and could only check it in jsdom, say so in the pull request.

## Running the tests

```text
npm install
npm test
```

The tests run in Node with [jsdom](https://github.com/jsdom/jsdom) and the **real Mermaid** (the version pinned in `package.json`). They check that every sample chart, viewed as every type, is accepted by Mermaid's parser and drawn by its renderer, and they exercise the zoom, export, click handling and the demo's forms and pages.

jsdom has no layout engine, so the tests check structure (what was drawn, what was clicked, what was saved), not appearance. Please look at a visual change in a real browser too.

## Adding a chart option

1. Add the default and the validation to `lib/src/settings.js`.
2. Use it in the builder (`lib/src/builders/`).
3. Add a field to the demo's form (`demo/js/forms/`) so it can be tried.
4. Add a test, and a row to the settings table in `docs/`.

## Documentation

The pages in `docs/` are plain Markdown, shown on GitHub and also by the demo site. Link between pages as `other-page.md` (the demo turns these into its own routes); a test fails if a page links to one that doesn't exist. Add a new page to `DOC_PAGES` in `demo/js/views/docs-page.js`.

## Mermaid versions

When you move the pinned Mermaid version, change it in three places: `package.json`, `demo/js/config.js` and the examples in `docs/`. Then run the tests: Mermaid's beta diagrams (Tree view, swimlanes) are the ones most likely to change.
