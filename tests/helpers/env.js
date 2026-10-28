// A browser-ish environment for the tests: jsdom plus the real Mermaid. jsdom has no layout engine, so text sizes
// are faked; that's enough for Mermaid to render, but it means the tests check structure, not appearance.

import { JSDOM } from 'jsdom';

let cached = null;

export async function setupEnv() {
  if (cached) return cached;
  const dom = new JSDOM('<!DOCTYPE html><body><div id="root"></div></body>', { pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  globalThis.window = w; globalThis.document = w.document;
  Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true });
  w.SVGElement.prototype.getBBox = function () { return { x: 0, y: 0, width: 80, height: 18 }; };
  w.SVGElement.prototype.getComputedTextLength = function () { return 60; };
  for (const name of ['SVGElement', 'CSSStyleSheet', 'HTMLElement', 'Element', 'Node', 'XMLSerializer', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame']) {
    if (w[name]) globalThis[name] = typeof w[name] === 'function' && !/^[A-Z]/.test(name) ? w[name].bind(w) : w[name];
  }
  const mermaid = (await import('mermaid')).default;
  cached = { dom, window: w, document: w.document, mermaid };
  return cached;
}

export function freshRoot(env) {
  const root = env.document.getElementById('root');
  root.innerHTML = '';
  const el = env.document.createElement('div');
  root.appendChild(el);
  return el;
}

/** A scrolling element with a fixed width, since jsdom has no layout. */
export function fakeLayout(el, width = 1400) {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 800, configurable: true });
}
