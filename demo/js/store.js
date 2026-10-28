// The demo's storage: every chart lives in this browser's localStorage and nowhere else. (The library itself
// has no storage at all: a chart is just a JSON object, so you can keep yours in a database, a file or an API.)

import { normaliseChart, createChart, clone } from '../../lib/mermaid-extras.js';
import { STORAGE_KEY } from './config.js';

export class StoreError extends Error {}

export function createStore({ storage = window.localStorage, key = STORAGE_KEY, now = () => Date.now() } = {}) {
  let data = null;

  function load() {
    if (data) return data;
    data = { version: 1, seeded: false, charts: {} };
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.charts && typeof parsed.charts === 'object') {
          data.seeded = !!parsed.seeded;
          for (const [id, entry] of Object.entries(parsed.charts)) {
            if (entry && entry.chart) data.charts[id] = { chart: normaliseChart({ ...entry.chart, id }), created: entry.created || now(), updated: entry.updated || now() };
          }
        }
      }
    } catch (error) { /* unreadable data is treated as empty */ }
    return data;
  }

  function persist() {
    try { storage.setItem(key, JSON.stringify(data)); }
    catch (error) {
      throw new StoreError('Your browser would not store that. Its local storage may be full or switched off (private browsing can do this).');
    }
  }

  return {
    /** Puts the sample charts in on the very first visit only (so deleting them all doesn't bring them back). */
    ensureSeeded(makeSamples) {
      const d = load();
      if (d.seeded) return false;
      d.seeded = true;
      for (const chart of makeSamples()) d.charts[chart.id] = { chart: normaliseChart(chart), created: now(), updated: now() };
      persist();
      return true;
    },
    /** Every chart, most recently changed first. */
    list() {
      return Object.values(load().charts).sort((a, b) => b.updated - a.updated).map((e) => ({ chart: clone(e.chart), created: e.created, updated: e.updated }));
    },
    get(id) { const e = load().charts[id]; return e ? clone(e.chart) : null; },
    meta(id) { const e = load().charts[id]; return e ? { created: e.created, updated: e.updated } : null; },
    /** Saves a chart (new or changed). Returns the tidied chart that was stored. */
    put(chart) {
      const d = load();
      const tidy = normaliseChart(chart);
      if (!tidy.id) throw new StoreError('A chart needs an id.');
      const existing = d.charts[tidy.id];
      d.charts[tidy.id] = { chart: tidy, created: existing ? existing.created : now(), updated: now() };
      persist();
      return clone(tidy);
    },
    create(fields) { return this.put(createChart(fields)); },
    remove(id) { const d = load(); delete d.charts[id]; persist(); },
    duplicate(id) {
      const original = this.get(id);
      if (!original) return null;
      const copy = { ...original, id: `chart-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: `${original.name} (copy)` };
      return this.put(copy);
    },
    /** Replaces everything with the samples. */
    reset(makeSamples) {
      const d = load();
      d.charts = {}; d.seeded = true;
      for (const chart of makeSamples()) d.charts[chart.id] = { chart: normaliseChart(chart), created: now(), updated: now() };
      persist();
    },
    clear() { const d = load(); d.charts = {}; d.seeded = true; persist(); },
    /** All charts as JSON text, to keep a backup or move them to another browser. */
    exportJSON() {
      return JSON.stringify({ format: 'mermaid-extras-demo', version: 1, exported: new Date(now()).toISOString(), charts: this.list().map((e) => e.chart) }, null, 2);
    },
    /**
     * @param text     JSON text from exportJSON() (or a single chart object)
     * @param replace  true: replace everything; false: add to what's there (charts with a clashing id are given a new one)
     * @returns {number} how many charts were imported
     */
    importJSON(text, { replace = false } = {}) {
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { throw new StoreError('That is not valid JSON.'); }
      const charts = Array.isArray(parsed.charts) ? parsed.charts : (parsed && parsed.nodes && parsed.type ? [parsed] : null);
      if (!charts || !charts.length) throw new StoreError('No charts were found in that file.');
      const d = load();
      if (replace) d.charts = {};
      let count = 0;
      for (const raw of charts) {
        if (!raw || typeof raw !== 'object' || !raw.type) continue;
        let id = String(raw.id || '');
        if (!id || d.charts[id]) id = `chart-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}${count}`;
        d.charts[id] = { chart: normaliseChart({ ...raw, id }), created: now(), updated: now() };
        count++;
      }
      if (!count) throw new StoreError('No charts were found in that file.');
      d.seeded = true;
      persist();
      return count;
    },
    /** Roughly how much space the charts take, in bytes. */
    size() { return JSON.stringify(load()).length; },
    count() { return Object.keys(load().charts).length; },
  };
}
