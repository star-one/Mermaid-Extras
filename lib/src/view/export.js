// Exporting the rendered chart as SVG or PNG. The on-screen SVG may be zoomed or have section names pinned; the
// export always uses the chart's true size and puts everything where Mermaid drew it.

import { ImageZoom } from './image-zoom.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * A standalone copy of the rendered SVG, with the chart's title written above it if one is given.
 * @returns {{ svg: SVGElement, width: number, height: number }}
 */
export function prepareExport(svg, { title = '', fontFamily = 'sans-serif', fontWeight = '700' } = {}) {
  const clone = svg.cloneNode(true);
  // Gantt section names are pinned to the left of what's on screen while scrolling: put them back
  clone.querySelectorAll('.sectionTitleBg').forEach((box) => box.remove());
  clone.querySelectorAll('.sectionTitle').forEach((t) => {
    t.setAttribute('x', '10');
    t.querySelectorAll('tspan').forEach((span) => span.setAttribute('x', '10'));
  });
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // Clear the zoom the page applied, and Mermaid's own max-width, so the export has the chart's native size
  clone.style.removeProperty('width'); clone.style.removeProperty('height'); clone.style.removeProperty('max-width');
  const { width, height } = ImageZoom.nativeSize(svg);
  clone.setAttribute('width', width); clone.setAttribute('height', height);
  return title ? addTitle(clone, width, height, title, fontFamily, fontWeight) : { svg: clone, width, height };
}

/** Wraps the chart in a larger SVG with the title above it; widens the image if the title is wider than the chart. */
function addTitle(chartClone, chartWidth, chartHeight, title, fontFamily, fontWeight) {
  const padding = 20; const fontSize = 28; const gap = 12;
  let titleWidth = title.length * fontSize * 0.55; // a fair estimate; replaced by a real measurement where a canvas exists
  try {
    const context = document.createElement('canvas').getContext('2d');
    if (context) { context.font = `${fontWeight} ${fontSize}px ${fontFamily}`; titleWidth = Math.ceil(context.measureText(title).width); }
  } catch (e) { /* keep the estimate */ }

  const outerWidth = Math.max(chartWidth, titleWidth + padding * 2);
  const titleBlock = padding + fontSize + gap;
  const outerHeight = titleBlock + chartHeight;
  const outer = document.createElementNS(NS, 'svg');
  outer.setAttribute('xmlns', NS); outer.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  outer.setAttribute('width', outerWidth); outer.setAttribute('height', outerHeight);
  outer.setAttribute('viewBox', `0 0 ${outerWidth} ${outerHeight}`);

  const text = document.createElementNS(NS, 'text');
  text.setAttribute('x', padding); text.setAttribute('y', padding + fontSize);
  text.setAttribute('font-family', fontFamily); text.setAttribute('font-weight', fontWeight);
  text.setAttribute('font-size', fontSize); text.setAttribute('fill', '#212529');
  text.textContent = title;
  outer.appendChild(text);

  chartClone.setAttribute('x', (outerWidth - chartWidth) / 2); chartClone.setAttribute('y', titleBlock);
  outer.appendChild(chartClone);
  return { svg: outer, width: outerWidth, height: outerHeight };
}

export function svgString(prepared) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${new XMLSerializer().serializeToString(prepared.svg)}`;
}

/** @returns {Promise<Blob>} a PNG on a white background (the SVG itself is transparent) */
export function pngBlob(prepared, scale = 2) {
  return new Promise((resolve, reject) => {
    const markup = new XMLSerializer().serializeToString(prepared.svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(prepared.width * scale); canvas.height = Math.ceil(prepared.height * scale);
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The PNG could not be created.'))), 'image/png');
    };
    image.onerror = () => reject(new Error('The chart could not be turned into an image.'));
    image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(markup)));
  });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "My chart: v2!" -> "My-chart-v2" */
export function safeFileName(name) {
  return String(name || 'chart').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'chart';
}
