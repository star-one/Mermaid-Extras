// ChartView: draws a chart into a container and adds everything that Mermaid itself doesn't do.
//
//   import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
//   const view = new ChartView(document.getElementById('chart'), { mermaid });
//   view.on('target', ({ kind, id }) => console.log('clicked', kind, id));
//   await view.render(chart);
//   view.zoom.in();  view.timeline?.shorter();  view.exportPNG();

import { buildDiagram } from '../builders/index.js';
import { normaliseChart } from '../model.js';
import { chartToTable, tableToCSV } from '../table.js';
import { ImageZoom } from './image-zoom.js';
import { GanttTimeline } from './gantt-timeline.js';
import { localStorageAdapter } from './storage.js';
import { resolveTarget, markClickables } from './targets.js';
import { applyGanttFades, drawGanttDependencies, pinSectionTitles, styleKanbanCritical, tagTreeviewRows } from './decorations.js';
import { download, pngBlob, prepareExport, safeFileName, svgString } from './export.js';

let viewCounter = 0;

/** Merges plain objects, the second over the first, one level of nesting at a time (arrays and values are replaced). */
function deepMerge(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    out[key] = (value && typeof value === 'object' && !Array.isArray(value) && base && typeof base[key] === 'object' && !Array.isArray(base[key]))
      ? deepMerge(base[key], value) : value;
  }
  return out;
}

// Tree view icons come from icon packs that Mermaid doesn't bundle, so they are loaded on demand from a CDN
const ICON_PACKS = [
  { name: 'material-icon-theme', loader: () => fetch('https://cdn.jsdelivr.net/npm/@iconify-json/material-icon-theme@1/icons.json').then((r) => r.json()) },
  { name: 'logos', loader: () => fetch('https://cdn.jsdelivr.net/npm/@iconify-json/logos@1/icons.json').then((r) => r.json()) },
];

export class ChartView {
  /**
   * @param container  the element to draw into (give it a height, or let it grow)
   * @param options.mermaid         REQUIRED. The Mermaid object (the default export of the Mermaid ES module).
   * @param options.storage         { get, set, remove } for remembering zoom levels. Default: localStorage. null: don't remember.
   * @param options.securityLevel   Mermaid's securityLevel (default 'strict'; nothing here needs 'loose')
   * @param options.mermaidConfig   extra options for mermaid.initialize() (a theme, fonts, ...). The chart's own options win over these.
   * @param options.mindmapLayout   default 'tidy-tree'; '' for Mermaid's own default
   * @param options.iconPacks       register the Tree view icon packs (default true)
   * @param options.ganttTimeline   enable the Gantt timeline zoom (default true)
   * @param options.interactive     tag clickable things and emit 'target' events (default true)
   * @param options.minZoom / maxZoom / zoomStep   image zoom limits (defaults 0.1, 3, 0.1)
   * @param options.exportTitle     write the chart's name above exported images (default true)
   * @param options.fontFamily      font for the export title (default: the container's)
   */
  constructor(container, options = {}) {
    if (!options.mermaid) throw new Error('ChartView needs the Mermaid object: new ChartView(el, { mermaid })');
    this.container = container;
    this.mermaid = options.mermaid;
    this.options = { securityLevel: 'strict', mindmapLayout: 'tidy-tree', iconPacks: true, ganttTimeline: true, interactive: true, exportTitle: true, ...options };
    this.storage = options.storage === undefined ? localStorageAdapter() : options.storage;
    this.uid = ++viewCounter;
    this.renderCount = 0;
    this.handlers = {};
    this.chart = null; this.diagram = null; this.viewType = null; this.timeline = null; this.svg = null;
    this._queue = Promise.resolve();

    container.classList.add('mx-view');
    container.innerHTML = '<div class="mx-scroll"><div class="mx-canvas"></div></div>';
    this.scroller = container.querySelector('.mx-scroll');
    this.canvas = container.querySelector('.mx-canvas');

    this.zoom = new ImageZoom({
      scroller: this.scroller, storage: this.storage, key: 'zoom:pending',
      min: this.options.minZoom, max: this.options.maxZoom, step: this.options.zoomStep,
      onChange: (zoom) => { this.emit('zoom', { zoom, percent: Math.round(zoom * 100) }); this.pinTitles(); },
    });

    this._onClick = (event) => {
      if (!this.options.interactive || !this.diagram) return;
      const target = resolveTarget(event.target, this.diagram, this.canvas);
      if (target) this.emit('target', { ...target, event });
    };
    this.canvas.addEventListener('click', this._onClick);

    let pending = false;
    this._onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; this.pinTitles(); });
    };
    this.scroller.addEventListener('scroll', this._onScroll);
  }

  // ---- events ----------------------------------------------------------------------------------------------------

  /**
   * Events:
   *   'target'    a box or group was clicked: { kind: 'node' | 'group', id, element, event, isRoot? }
   *   'rendered'  a chart has been drawn: { chart, type }
   *   'zoom'      the image zoom changed: { zoom, percent }
   *   'timeline'  (Gantt) the timeline zoom changed: { pixelsPerDay, daysShown, label }
   *   'error'     the chart could not be drawn: { error }
   */
  on(name, handler) { (this.handlers[name] = this.handlers[name] || []).push(handler); return this; }
  off(name, handler) { this.handlers[name] = (this.handlers[name] || []).filter((h) => h !== handler); return this; }
  emit(name, detail) { for (const handler of this.handlers[name] || []) handler(detail); }

  // ---- drawing ---------------------------------------------------------------------------------------------------

  get storageKey() { return `${this.chart.id}${this.viewType !== this.chart.type ? ':as-' + this.viewType : ''}`; }
  get timelineKey() { return `timeline:${this.storageKey}`; }

  /** Applies the options Mermaid needs for this chart. Called before every render and parse. */
  initMermaid(config = {}) {
    const mermaid = this.mermaid;
    if (this.options.iconPacks && !mermaid.__mxIconPacks && typeof mermaid.registerIconPacks === 'function') {
      mermaid.registerIconPacks(ICON_PACKS);
      mermaid.__mxIconPacks = true;
    }
    mermaid.initialize(deepMerge({ startOnLoad: false, securityLevel: this.options.securityLevel, ...(this.options.mermaidConfig || {}) }, config));
  }

  /** Renders `source` and puts the SVG on the page, then decorates it. Used by render() and by the Gantt timeline. */
  async drawSvg(source, config) {
    this.initMermaid(config);
    const { svg, bindFunctions } = await this.mermaid.render(`mx-${this.uid}-${++this.renderCount}`, source);
    this.canvas.innerHTML = svg;
    if (bindFunctions) bindFunctions(this.canvas);
    this.afterRender();
  }

  afterRender() {
    const svg = this.canvas.querySelector('svg');
    this.svg = svg;
    if (!svg) return;
    this.zoom.key = `zoom:${this.storageKey}`;
    this.zoom.attach(svg);
    const meta = this.diagram.meta;
    if (this.diagram.type === 'treeview') tagTreeviewRows(svg, meta.treeviewOrder);
    if (this.diagram.type === 'kanban') styleKanbanCritical(svg, meta.kanbanCriticalIds);
    if (this.diagram.type === 'gantt') { applyGanttFades(svg, meta.ganttFades); drawGanttDependencies(svg, meta.ganttDependencies); }
    if (this.options.interactive) markClickables(this.canvas, this.diagram);
  }

  pinTitles() {
    if (this.svg && this.diagram && this.diagram.type === 'gantt') pinSectionTitles(this.svg, this.scroller.scrollLeft, this.zoom.zoom);
  }

  /**
   * Draws a chart.
   * @param chart          a chart (see model.js)
   * @param options.type   draw it as a different type of chart ("view as"). Nothing about the chart is changed.
   * @param options.today  'YYYY-MM-DD' to treat as today
   * @returns {Promise<void>} resolves when the chart is on the page (rejects, and emits 'error', if Mermaid can't draw it)
   */
  render(chart, options = {}) {
    const job = async () => {
      this.chart = normaliseChart(chart);
      this.diagram = buildDiagram(this.chart, { type: options.type, today: options.today, mindmapLayout: this.options.mindmapLayout });
      this.viewType = this.diagram.type;
      this.timeline = null;
      try {
        if (this.diagram.type === 'gantt' && this.options.ganttTimeline && this.mermaid.mermaidAPI && this.mermaid.mermaidAPI.getDiagramFromText) {
          const timeline = new GanttTimeline(this, this.diagram);
          try { await timeline.start(); this.timeline = timeline; }
          catch (error) { console.warn('Gantt timeline zoom unavailable, drawing the chart normally:', error); this.timeline = null; await this._drawPlain(); }
        } else {
          await this._drawPlain();
        }
        this.emit('rendered', { chart: this.chart, type: this.viewType });
      } catch (error) {
        this.canvas.innerHTML = '';
        this.emit('error', { error });
        throw error;
      }
    };
    const promise = this._queue.then(job);
    this._queue = promise.catch(() => {});
    return promise;
  }

  async _drawPlain() {
    await this.drawSvg(this.diagram.source, this.diagram.config);
  }

  // ---- Gantt timeline (no-ops for other chart types) ------------------------------------------------------------

  get hasTimeline() { return !!this.timeline; }
  timelineShorter() { return this.timeline ? this.timeline.shorter() : Promise.resolve(); }
  timelineLonger() { return this.timeline ? this.timeline.longer() : Promise.resolve(); }
  timelineDefault() { return this.timeline ? this.timeline.reset() : Promise.resolve(); }
  timelineShowAll() { return this.timeline ? this.timeline.showAll() : Promise.resolve(); }

  // ---- exporting -------------------------------------------------------------------------------------------------

  _prepared() {
    if (!this.svg) throw new Error('There is no chart to export yet.');
    return prepareExport(this.svg, {
      title: this.options.exportTitle ? this.chart.name : '',
      fontFamily: this.options.fontFamily || getComputedStyle(this.container).fontFamily || 'sans-serif',
    });
  }

  /** The chart as SVG text. */
  getSVG() { return svgString(this._prepared()); }
  /** Downloads the chart as an SVG file. */
  exportSVG(filename) {
    download(new Blob([this.getSVG()], { type: 'image/svg+xml;charset=utf-8' }), `${filename || safeFileName(this.chart.name)}.svg`);
  }
  /** The chart as a PNG Blob (scale 2 by default for a crisper image). */
  getPNG(scale = 2) { return pngBlob(this._prepared(), scale); }
  /** Downloads the chart as a PNG file. */
  async exportPNG({ scale = 2, filename } = {}) {
    download(await this.getPNG(scale), `${filename || safeFileName(this.chart.name)}.png`);
  }
  /** The chart's data as CSV text, for the type it is currently shown as. */
  getCSV() { const { columns, rows } = chartToTable(this.chart, this.viewType); return tableToCSV(columns, rows); }
  exportCSV(filename) {
    download(new Blob([this.getCSV()], { type: 'text/csv;charset=utf-8;' }), `${filename || safeFileName(this.chart.name)}.csv`);
  }

  // ---- tidying up ------------------------------------------------------------------------------------------------

  destroy() {
    this.zoom.destroy();
    this.canvas.removeEventListener('click', this._onClick);
    this.scroller.removeEventListener('scroll', this._onScroll);
    this.container.classList.remove('mx-view');
    this.container.innerHTML = '';
    this.handlers = {};
  }
}
