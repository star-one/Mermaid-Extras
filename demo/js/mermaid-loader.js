// Loads Mermaid once, when the first chart needs it. The tests (and anyone embedding the demo) can supply their own
// by setting globalThis.__MERMAID__ before the demo starts.

import { MERMAID_URL } from './config.js';

let loading = null;

export function loadMermaid() {
  if (globalThis.__MERMAID__) return Promise.resolve(globalThis.__MERMAID__);
  if (!loading) {
    loading = import(/* @vite-ignore */ MERMAID_URL).then((module) => module.default).catch((error) => {
      loading = null;
      throw new Error('Mermaid could not be loaded from ' + MERMAID_URL + '. The demo needs an internet connection (or a copy of Mermaid you host yourself: see docs/hosting.md).');
    });
  }
  return loading;
}
