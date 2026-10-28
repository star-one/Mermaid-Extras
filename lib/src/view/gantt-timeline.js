// Gantt timeline zoom. Mermaid can't zoom or pan a Gantt's timeline itself, but it does let the chart's width
// (gantt.useWidth) and tick spacing (tickInterval) be set. So the timeline is "zoomed" by re-drawing the chart at a
// different width: pixels per day go up or down, the ticks switch between days, weeks and months to suit, and the
// scroll position is set to the right place. (The image zoom next to it just scales the finished picture.)
//
// The default view shows 7 weeks: the week before this one plus the six after it. The visitor's zoom is remembered.

import { resolveGanttTemplate, ganttAxisLines } from '../builders/index.js';

const DAY_MS = 86400000;
const DEFAULT_DAYS = 49;   // 7 weeks
const STEP = 1.5;          // each click changes the scale by this factor

export class GanttTimeline {
  /**
   * @param view     the ChartView that owns this timeline
   * @param diagram  the buildDiagram() result for a Gantt chart (needs .template and .meta.ganttTimeline)
   */
  constructor(view, diagram) {
    this.view = view;
    this.template = diagram.template;
    this.config = diagram.config;
    this.timeline = diagram.meta.ganttTimeline;
    this.left = this.timeline.leftPadding;
    this.right = this.timeline.rightPadding;
    this.min = 0; this.max = 0; this.days = 0;           // the dates Mermaid will use for the ends of the timeline
    this.P = 0;                                          // pixels per day
    this.limits = { P0: 1, fit: 1, min: 0.05, max: 150 };
    this.width = 0;
    this.ready = false;
    this._queue = Promise.resolve();
  }

  // ---- remembered zoom -------------------------------------------------------------------------------------------

  _load() {
    const storage = this.view.storage;
    if (!storage) return null;
    try {
      const saved = JSON.parse(storage.get(this.view.timelineKey));
      if (saved && saved.mode === 'all') return { mode: 'all' };
      if (saved && saved.mode === 'days' && Number.isFinite(saved.days) && saved.days >= 1 && saved.days <= 5000) return { mode: 'days', days: Number(saved.days) };
    } catch (e) { /* unreadable: use the default */ }
    return null;
  }

  _save(view) {
    const storage = this.view.storage;
    if (!storage) return;
    if (view) storage.set(this.view.timelineKey, JSON.stringify(view)); else storage.remove(this.view.timelineKey);
  }

  // ---- dates (handled in local time, because that's how Mermaid reads the dates in the chart) --------------------

  static addDays(ms, days) { const d = new Date(ms); d.setDate(d.getDate() + days); return d.getTime(); }
  static today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); }

  weekStart() {
    const names = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const first = names.indexOf(this.timeline.weekday);
    const today = new Date(GanttTimeline.today());
    return GanttTimeline.addDays(today.getTime(), -((today.getDay() - first + 7) % 7));
  }

  // ---- geometry --------------------------------------------------------------------------------------------------

  get viewport() { return this.view.scroller.clientWidth || 1200; }
  /** How many days fit across the screen at P pixels per day (the part right of the section names). */
  viewDays(P = this.P) { return Math.max(1, (this.viewport - this.left) / P); }
  pFromDays(days) { return (this.viewport - this.left) / days; }
  /** A task that ends "at some unknown point in the future" is drawn for about a third of the timeline on screen. */
  unknownDays(P) { return Math.max(1, Math.round(this.viewDays(P) / 3)); }

  source(P) {
    return resolveGanttTemplate(this.template, { axisLines: ganttAxisLines(this.timeline, P), unknownDays: this.unknownDays(P) });
  }

  x(dateMs) { return this.left + ((dateMs - this.min) / (this.max - this.min)) * (this.width - this.left - this.right); }
  dateAtX(x) { return this.min + ((x - this.left) / (this.width - this.left - this.right)) * (this.max - this.min); }

  /** The first and last dates Mermaid will use, read from the parsed chart. They depend on the zoom (unknown ends). */
  async measure(P) {
    const mermaid = this.view.mermaid;
    this.view.initMermaid(this.config);
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(this.source(P));
    let min = Infinity; let max = -Infinity;
    for (const task of diagram.db.getTasks()) { min = Math.min(min, +task.startTime); max = Math.max(max, +task.endTime); }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) throw new Error('No dates to measure');
    this.min = min; this.max = max; this.days = (max - min) / DAY_MS;
  }

  setLimits() {
    this.limits.P0 = Math.max(0.5, this.pFromDays(DEFAULT_DAYS));                                   // 7 weeks fill the screen
    this.limits.fit = Math.max(0.05, (this.viewport - this.left - this.right - 20) / this.days);     // everything fills the screen
    this.limits.min = Math.min(1.4, this.limits.fit);
    this.limits.max = Math.max(this.limits.P0, Math.min(150, (60000 - this.left - this.right) / this.days)); // a sensible picture size
  }

  clamp(P) { return Math.max(this.limits.min, Math.min(this.limits.max, P)); }

  // ---- drawing ---------------------------------------------------------------------------------------------------

  /** Draws the chart at P pixels per day. anchor says what to keep in view: { date: ms, at: 'left' | 'center' }. */
  async draw(P, anchor) {
    P = this.clamp(P);
    await this.measure(P);
    this.setLimits();
    const clamped = this.clamp(P);
    if (clamped !== P) { P = clamped; await this.measure(P); }

    this.P = P;
    this.width = Math.round(P * this.days + this.left + this.right);
    await this.view.drawSvg(this.source(P), { ...this.config, gantt: { ...(this.config.gantt || {}), useWidth: this.width } });

    const scroller = this.view.scroller;
    if (anchor) {
      const zoom = this.view.zoom.zoom;
      const x = this.x(anchor.date) * zoom;
      scroller.scrollLeft = anchor.at === 'center' ? x - scroller.clientWidth / 2 : x - this.left * zoom;
    }
    this.view.pinTitles();
    this.view.emit('timeline', this.describe());
  }

  describe() {
    const days = this.viewDays();
    const weeks = days / 7;
    const label = weeks >= 8 ? `about ${Math.round(weeks)} weeks shown`
      : days >= 14 ? `${weeks.toFixed(1).replace(/\.0$/, '')} weeks shown` : `${Math.round(days)} days shown`;
    return { pixelsPerDay: this.P, daysShown: days, label };
  }

  centreDate() {
    const scroller = this.view.scroller;
    if (!this.ready) return this.min;
    return this.dateAtX((scroller.scrollLeft + scroller.clientWidth / 2) / this.view.zoom.zoom);
  }

  enqueue(job) {
    this._queue = this._queue.then(job).catch((error) => { console.error('Gantt timeline:', error); });
    return this._queue;
  }

  // ---- the controls ----------------------------------------------------------------------------------------------

  _zoomBy(factor) {
    return this.enqueue(async () => {
      if (!this.ready) return;
      const centre = this.centreDate();
      await this.draw(this.P * factor, { date: centre, at: 'center' });
      this._save({ mode: 'days', days: Math.round(this.viewDays() * 10) / 10 });
    });
  }
  /** Show a shorter period (zoom in: more detail). */
  shorter() { return this._zoomBy(STEP); }
  /** Show a longer period (zoom out: less detail). */
  longer() { return this._zoomBy(1 / STEP); }

  async _defaultView() {
    this.setLimits();
    await this.draw(this.limits.P0, { date: GanttTimeline.addDays(this.weekStart(), -7), at: 'left' });
  }

  /** Back to 7 weeks, starting with last week. */
  reset() {
    return this.enqueue(async () => { if (this.ready) { await this._defaultView(); this._save(null); } });
  }

  async _showAllView() {
    // The length drawn for an unknown end depends on the zoom, so the scale is settled by trying a few times
    let P = this.limits.fit || this.limits.P0;
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.measure(P);
      const fit = Math.max(0.05, (this.viewport - this.left - this.right - 20) / this.days);
      if (Math.abs(fit - P) / P < 0.02) break;
      P = fit;
    }
    this.limits.min = Math.min(this.limits.min, P);
    await this.draw(P, { date: this.min, at: 'left' });
  }

  /** Everything on the chart across the screen. */
  showAll() {
    return this.enqueue(async () => { if (this.ready) { await this._showAllView(); this._save({ mode: 'all' }); } });
  }

  async _initialView() {
    const saved = this._load();
    if (!saved) return this._defaultView();
    if (saved.mode === 'all') return this._showAllView();
    if (Math.abs(saved.days - DEFAULT_DAYS) < 0.5) return this._defaultView();
    // Start a little before today (a seventh of the way in, like the 7-week view)
    return this.draw(this.pFromDays(saved.days), { date: GanttTimeline.addDays(GanttTimeline.today(), -Math.round(saved.days / 7)), at: 'left' });
  }

  /** Measures the chart and draws the first view. Rejects if this Mermaid can't be measured (the caller falls back). */
  start() {
    const job = async () => {
      await this.measure(this.pFromDays(DEFAULT_DAYS));
      this.setLimits();
      this.ready = true;
      await this._initialView();
    };
    const promise = this._queue.then(job);
    this._queue = promise.catch(() => {});
    return promise;
  }

  /** Waits for anything in progress. */
  idle() { return this._queue; }
}
