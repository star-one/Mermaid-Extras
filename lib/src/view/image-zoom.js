// Zooming the finished picture (as opposed to the Gantt timeline, which is re-drawn). The SVG is given an explicit
// pixel width and height rather than a CSS transform, so the scroll container's own scrollbars just work.

export class ImageZoom {
  /**
   * @param o.scroller  the scrolling element that holds the chart
   * @param o.storage   { get, set, remove } or null
   * @param o.key       storage key for this chart/view
   * @param o.onChange  called with the new zoom (1 = 100%)
   */
  constructor({ scroller, storage, key, min = 0.1, max = 3, step = 0.1, onChange = () => {} }) {
    Object.assign(this, { scroller, storage, key, min, max, step, onChange });
    this.svg = null; this.nativeWidth = 0; this.nativeHeight = 0;
    this.current = null;      // null until the first chart has been shown (and again whenever the key changes)
    this.loadedKey = null;
    this.autoFit = false;     // 'width' | 'height' | false: which fit (if any) follows window resizes
    this._resize = () => {
      if (this.autoFit === 'width') this.apply(this.fitWidthZoom());
      else if (this.autoFit === 'height') this.apply(this.fitHeightZoom());
    };
    window.addEventListener('resize', this._resize);
  }

  destroy() { window.removeEventListener('resize', this._resize); }

  _load() {
    if (!this.storage) return 1;
    const saved = parseFloat(this.storage.get(this.key));
    return (!Number.isNaN(saved) && saved >= this.min && saved <= this.max) ? saved : 1; // a new chart starts at 100%
  }

  _save() { if (this.storage) this.storage.set(this.key, String(this.current)); }

  /** The chart's true (unzoomed) size, preferring the viewBox Mermaid draws to since that never changes with zoom. */
  static nativeSize(svg) {
    const viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && viewBox.width && viewBox.height) return { width: viewBox.width, height: viewBox.height };
    const w = parseFloat(svg.getAttribute('width')); const h = parseFloat(svg.getAttribute('height'));
    if (w > 0 && h > 0) return { width: w, height: h };
    const box = svg.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }

  /** Call whenever a new <svg> has been put on the page. Keeps the current zoom, or loads the remembered one. */
  attach(svg) {
    // A different chart (or a "view as") has its own remembered zoom; a re-draw of the same one keeps the current zoom
    if (this.key !== this.loadedKey) { this.loadedKey = this.key; this.current = null; this.autoFit = false; }
    this.svg = svg;
    const size = ImageZoom.nativeSize(svg);
    this.nativeWidth = size.width; this.nativeHeight = size.height;
    this.apply(this.current === null ? this._load() : this.current);
  }

  fitWidthZoom() {
    if (!this.nativeWidth) return 1;
    const available = this.scroller.clientWidth - 30; // a small allowance so fitting never leaves a sliver of scrollbar
    return available > 0 ? available / this.nativeWidth : 1;
  }

  fitHeightZoom() {
    if (!this.nativeHeight) return 1;
    const available = window.innerHeight - this.scroller.getBoundingClientRect().top - 16;
    return available > 0 ? available / this.nativeHeight : 1;
  }

  apply(zoom) {
    if (!this.svg || !this.nativeWidth || !this.nativeHeight) return;
    this.current = Math.max(this.min, Math.min(this.max, zoom));
    this.svg.style.width = `${this.nativeWidth * this.current}px`;
    this.svg.style.height = `${this.nativeHeight * this.current}px`;
    this.onChange(this.current);
  }

  get zoom() { return this.current === null ? 1 : this.current; }

  set(zoom) { this.autoFit = false; this.apply(zoom); this._save(); }
  in() { this.set(this.zoom + this.step); }
  out() { this.set(this.zoom - this.step); }
  reset() { this.set(1); }
  fitWidth() { this.autoFit = 'width'; this.apply(this.fitWidthZoom()); this._save(); }
  fitHeight() { this.autoFit = 'height'; this.apply(this.fitHeightZoom()); this._save(); }
}
