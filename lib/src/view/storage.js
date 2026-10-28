// Where a ChartView remembers the visitor's zoom levels. Any object with get(key), set(key, value) and remove(key)
// works, so you can swap this for sessionStorage, a cookie, your own server, or nothing at all (pass `storage: null`).

/** The default: the browser's localStorage, with every key prefixed so it can't collide with your own. */
export function localStorageAdapter(prefix = 'mermaid-extras:') {
  return {
    get(key) { try { return window.localStorage.getItem(prefix + key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(prefix + key, String(value)); } catch (e) { /* storage unavailable: it just won't persist */ } },
    remove(key) { try { window.localStorage.removeItem(prefix + key); } catch (e) { /* ignore */ } },
  };
}

/** Does nothing, remembers nothing. */
export const nullStorage = { get() { return null; }, set() {}, remove() {} };
