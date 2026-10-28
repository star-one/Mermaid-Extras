# Hosting and self-hosting

The library and the demo are static files: there is no server code, no database and no build step.

## Running the demo

Browsers won't load ES modules from `file://`, so serve the folder with any web server:

```text
cd mermaid-extras
npx serve .            # or:  python3 -m http.server 8080
```

Then open `/demo/`. (The repository's top-level `index.html` just redirects there.)

## GitHub Pages

1. Push the repository to GitHub.
2. In the repository's *Settings*, open *Pages* and choose to deploy from the main branch, root folder.
3. The site is then at `https://<you>.github.io/<repository>/`, which redirects to the demo.

The repository includes a `.nojekyll` file so that GitHub Pages serves everything as it is.

Before you publish, set your repository's address in `demo/js/config.js` (`GITHUB_URL`) so the demo's GitHub link points at it.

## Any other server

Upload the whole repository (or at least `lib/`, `demo/` and `docs/`: the demo reads the documentation from `../docs/`). Nothing needs configuring. If your server sets a content type for `.js` files it must be a JavaScript one (`text/javascript`), which every common server does.

## Where Mermaid comes from

Mermaid is **not** included: you supply it. The demo loads a pinned version from the jsDelivr CDN:

```js
// demo/js/config.js
export const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs';
```

Pin an exact version, as above, rather than `@11`: charts are checked against a specific Mermaid, and Mermaid's beta diagrams (the Tree view and swimlanes) are still changing.

### Hosting Mermaid yourself

Mermaid's ES build loads extra files from the folder it is in as it needs them, so copy its whole `dist` folder, not just one file:

```text
npm pack mermaid@11.17.2          # downloads mermaid-11.17.2.tgz
tar xzf mermaid-11.17.2.tgz       # unpacks to ./package
cp -r package/dist your-site/vendor/mermaid
```

then point `MERMAID_URL` (or your own `import`) at `vendor/mermaid/mermaid.esm.min.mjs`.

## Tree view icons

The icon packs for the Tree view are fetched from the jsDelivr CDN the first time a chart needs them (`@iconify-json/material-icon-theme` and `@iconify-json/logos`). To host them yourself, or to work offline:

```js
const view = new ChartView(el, { mermaid, iconPacks: false });
mermaid.registerIconPacks([
  { name: 'material-icon-theme', loader: () => fetch('/vendor/icons/material-icon-theme.json').then((r) => r.json()) },
]);
```

The JSON files are the `icons.json` files from those npm packages.

## Content security policy

If you use a CSP, the demo needs:

- `script-src` to allow Mermaid's address (the CDN above, or your own server), and `'self'` for the demo's modules;
- `connect-src` to allow the icon pack addresses, if you use the Tree view's icons from the CDN;
- `img-src data:` and `style-src 'unsafe-inline'`, because Mermaid draws with inline styles and the exports use `data:` URLs.

## Privacy

The demo sends nothing anywhere. Charts live in your browser's `localStorage`, under the key `mermaid-extras-demo:v1`, and zoom levels under keys starting `mermaid-extras:`. The only network requests are the ones that fetch Mermaid and the icon packs. The demo says this to visitors in plain words, because it matters: a chart made in one browser cannot be seen from another, and cannot be shared.

If you build on the library, you decide where charts are stored and who can see them: the library has no opinion.
