// The demo's entry point: sets up storage and the router, and shows the right page for the address.
//   #/                      the dashboard
//   #/chart/<id>            a chart            (#/chart/<id>?viewAs=treeview: looked at as another type, temporarily)
//   #/docs  #/docs/<page>   the documentation

import { makeSamples } from './samples.js';
import { createStore } from './store.js';
import { loadMermaid } from './mermaid-loader.js';
import { renderDashboard } from './views/dashboard.js';
import { renderChartPage } from './views/chart-page.js';
import { renderDocsPage } from './views/docs-page.js';
import { h, toast } from './ui.js';
import { GITHUB_URL, APP_NAME, APP_VERSION } from './config.js';
import { todayLocal } from '../../lib/mermaid-extras.js';

export function parseRoute(hash) {
  const raw = String(hash || '').replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = new URLSearchParams(query);
  if (parts[0] === 'chart' && parts[1]) return { name: 'chart', id: decodeURIComponent(parts[1]), params };
  if (parts[0] === 'docs') return { name: 'docs', slug: parts[1] || '', params };
  return { name: 'dashboard', params };
}

export function startApp({ root = document.getElementById('view'), storage = window.localStorage } = {}) {
  const samples = () => makeSamples(todayLocal());
  let store;
  try { store = createStore({ storage }); store.ensureSeeded(samples); }
  catch (error) {
    root.replaceChildren(h('div', { class: 'notice notice-error' }, h('div', {}, h('strong', {}, 'This demo needs browser storage. '), error.message || 'Local storage is not available (private browsing can switch it off).')));
    return null;
  }

  let cleanup = null;
  const nav = {
    dashboard: document.querySelector('[data-nav="dashboard"]'),
    docs: document.querySelector('[data-nav="docs"]'),
  };
  const countEl = document.getElementById('nav-count');
  const refreshNav = () => { if (countEl) countEl.textContent = String(store.count()); };
  const navigate = (hash) => { if (window.location.hash === hash) route(); else window.location.hash = hash; };

  async function route() {
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    const r = parseRoute(window.location.hash);
    for (const [name, el] of Object.entries(nav)) if (el) el.classList.toggle('active', (name === 'dashboard' && r.name !== 'docs') || name === r.name);
    root.scrollTop = 0; window.scrollTo(0, 0);
    refreshNav();
    if (r.name === 'docs') { await renderDocsPage(root, { slug: r.slug }); return; }
    if (r.name === 'chart') {
      root.replaceChildren(h('p', { class: 'muted loading' }, 'Loading the chart...'));
      try {
        const mermaid = await loadMermaid();
        cleanup = renderChartPage(root, { store, id: r.id, params: r.params, mermaid, navigate });
      } catch (error) {
        root.replaceChildren(h('div', { class: 'notice notice-error' }, h('div', {}, h('strong', {}, 'Could not start. '), error.message)));
      }
      return;
    }
    renderDashboard(root, { store, navigate, makeSamples: samples, refreshNav });
  }

  const github = document.getElementById('github-link');
  if (github) github.href = GITHUB_URL;
  const version = document.getElementById('app-version');
  if (version) version.textContent = `${APP_NAME} v${APP_VERSION}`;
  window.addEventListener('hashchange', route);
  route();
  return { store, route };
}

if (typeof document !== 'undefined' && document.getElementById('view') && !globalThis.__MX_NO_AUTOSTART__) startApp();
void toast;
