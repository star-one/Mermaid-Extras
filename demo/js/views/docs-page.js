// The documentation pages: the same Markdown files that GitHub shows, fetched and rendered here.

import { h, icon } from '../ui.js';
import { renderMarkdown } from '../markdown.js';

export const DOC_PAGES = [
  ['index', 'Overview'],
  ['getting-started', 'Getting started'],
  ['data-model', 'The chart data model'],
  ['chart-types', 'Chart types'],
  ['gantt', 'Gantt charts'],
  ['treeview', 'Tree views'],
  ['chart-view-api', 'ChartView reference'],
  ['builders-api', 'Builders and helpers'],
  ['zoom-and-export', 'Zoom and export'],
  ['editing', 'Click to edit'],
  ['styling', 'Styling'],
  ['hosting', 'Hosting and self-hosting'],
  ['faq', 'Limits and questions'],
];

/** Links between docs pages are written page.md in the Markdown (so they work on GitHub); here they become routes. */
export function rewriteDocLink(url) {
  const m = /^(?:\.\/)?([a-z-]+)\.md(?:#.*)?$/.exec(url);
  return m ? `#/docs/${m[1]}` : url;
}

export async function renderDocsPage(root, { slug, fetchText = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); }) }) {
  const known = DOC_PAGES.find(([id]) => id === slug) ? slug : (slug ? null : 'index');
  const nav = h('nav', { class: 'docs-nav', 'aria-label': 'Documentation' }, h('h2', {}, 'Documentation'),
    DOC_PAGES.map(([id, title]) => h('a', { href: `#/docs/${id === 'index' ? '' : id}`.replace(/\/$/, ''), class: id === known ? 'on' : '' }, title)));
  const article = h('article', { class: 'docs-article' });
  const toc = h('aside', { class: 'docs-toc' });
  root.replaceChildren(h('div', { class: 'docs-layout' }, nav, article, toc));

  if (!known) { article.appendChild(h('p', {}, 'There is no documentation page called “' + slug + '”.')); return; }
  try {
    const text = await fetchText(`../docs/${known}.md`);
    const { html, headings } = renderMarkdown(text, { rewriteLink: rewriteDocLink });
    article.innerHTML = html;
    // Copy buttons on code blocks
    article.querySelectorAll('pre.code').forEach((pre) => {
      const copy = h('button', { type: 'button', class: 'copy-btn', title: 'Copy', onClick: async () => {
        try { await navigator.clipboard.writeText(pre.querySelector('code').textContent); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy'; }, 1500); } catch (e) { copy.textContent = 'Press Ctrl+C'; }
      } }, 'Copy');
      pre.appendChild(copy);
    });
    const sections = headings.filter((x) => x.level === 2);
    if (sections.length > 1) {
      toc.appendChild(h('h3', {}, 'On this page'));
      for (const s of sections) toc.appendChild(h('a', { href: `#/docs/${known}`, onClick: (e) => { e.preventDefault(); const el = article.querySelector(`[id="${s.id}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, s.text));
    }
  } catch (error) {
    article.appendChild(h('div', { class: 'notice notice-error' }, icon('info', 20), h('div', {}, h('strong', {}, 'This page could not be loaded. '),
      'The documentation is read from the ', h('code', {}, 'docs'), ' folder next to the demo. If you opened the demo straight from your files, serve the folder over HTTP instead (see the README). The same pages are in the repository as Markdown.')));
  }
}
