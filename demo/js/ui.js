// Small DOM helpers for the demo: element builder, icons, toasts and dialogs.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') el.className = value;
    else if (name === 'dataset') Object.assign(el.dataset, value);
    else if (name === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (name === 'html') el.innerHTML = value;
    else if (name.startsWith('on') && typeof value === 'function') el.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(name, '');
    else el.setAttribute(name, value);
  }
  const add = (child) => {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) child.forEach(add);
    else el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  };
  children.forEach(add);
  return el;
}

// 24px line icons (a small set drawn for this demo)
const PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  gantt: '<path d="M4 6h8M8 12h10M6 18h7"/><path d="M4 3v18"/>',
  treeview: '<path d="M5 4v16M5 8h5M5 14h5M10 14v0M13 11h6M13 17h6"/><circle cx="12" cy="8" r="1"/>',
  flowchart: '<rect x="9" y="3" width="6" height="4" rx="1"/><rect x="3" y="17" width="6" height="4" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><path d="M12 7v4M6 17v-3h12v3"/>',
  swimlane: '<path d="M3 7h18M3 12h18M3 17h18"/><circle cx="7" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="17" cy="17" r="1.5"/>',
  mindmap: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="6" r="1.5"/><circle cx="19" cy="6" r="1.5"/><circle cx="5" cy="18" r="1.5"/><circle cx="19" cy="18" r="1.5"/><path d="M6.3 7l4 3.5M17.7 7l-4 3.5M6.3 17l4-3.5M17.7 17l-4-3.5"/>',
  kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  zoomIn: '<circle cx="11" cy="11" r="6"/><path d="M21 21l-5-5M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="6"/><path d="M21 21l-5-5M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  github: '<path d="M9 19c-4 1.5-4-2-6-2m12 4v-3.5a3 3 0 0 0-.8-2.3c2.700-.3 5.500-1.300 5.500-6a4.700 4.700 0 0 0-1.300-3.200 4.400 4.400 0 0 0-.1-3.200s-1-.3-3.400 1.300a11.600 11.600 0 0 0-6 0C6.500 2.600 5.500 2.900 5.500 2.900a4.400 4.400 0 0 0-.1 3.200A4.700 4.700 0 0 0 4 9.300c0 4.600 2.800 5.700 5.500 6A3 3 0 0 0 8.700 17.500V21"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.300 5.700M20 4v7h-7"/>',
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  cursor: '<path d="M6 3l12 8-5 1.500L10.500 18z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
};

export function icon(name, size = 18) {
  const wrapper = document.createElement('span');
  wrapper.className = 'icon';
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;
  return wrapper;
}

export function button(label, { iconName, kind = 'default', title, onClick, type = 'button', disabled } = {}) {
  return h('button', { type, class: `btn btn-${kind}`, title, disabled, onClick }, iconName ? icon(iconName, 16) : null, label ? h('span', {}, label) : null);
}

// ---- toasts -------------------------------------------------------------------------------------------------------

export function toast(message, kind = 'info') {
  let host = document.getElementById('toasts');
  if (!host) { host = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(host); }
  const el = h('div', { class: `toast toast-${kind}`, role: 'status' }, message);
  host.appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, kind === 'error' ? 7000 : 3500);
  return el;
}

// ---- dialogs ------------------------------------------------------------------------------------------------------

/**
 * @param o.title    heading
 * @param o.body     an element (or array of elements)
 * @param o.actions  [{ label, kind, onClick(close) }] shown in the footer; onClick may return false to keep the dialog open
 * @param o.wide     a wider dialog
 * @returns {{ el, close }}
 */
export function openModal({ title, body, actions = [], wide = false, onClose } = {}) {
  const dialog = h('dialog', { class: `modal${wide ? ' modal-wide' : ''}` });
  const close = () => {
    if (dialog.close) { try { dialog.close(); } catch (e) { /* already closed */ } }
    dialog.removeAttribute('open');
    dialog.remove();
    if (onClose) onClose();
  };
  const footer = h('div', { class: 'modal-actions' });
  for (const action of actions) {
    footer.appendChild(button(action.label, {
      kind: action.kind || 'default', iconName: action.iconName, type: action.type || 'button',
      onClick: async (event) => { const result = await action.onClick(close, event); if (result !== false && action.closes !== false) close(); },
    }));
  }
  dialog.appendChild(h('div', { class: 'modal-head' },
    h('h2', {}, title),
    h('button', { type: 'button', class: 'modal-x', 'aria-label': 'Close', onClick: close }, '×')));
  dialog.appendChild(h('div', { class: 'modal-body' }, body));
  if (actions.length) dialog.appendChild(footer);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  document.body.appendChild(dialog);
  if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  return { el: dialog, close };
}

export function confirmModal({ title = 'Are you sure?', message, confirmLabel = 'OK', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (value) => { if (!answered) { answered = true; resolve(value); } };
    openModal({
      title, body: h('p', {}, message),
      actions: [
        { label: 'Cancel', onClick: () => { answer(false); } },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => { answer(true); } },
      ],
      onClose: () => answer(false),
    });
  });
}

export function pluralise(count, word) { return `${count} ${word}${count === 1 ? '' : 's'}`; }

export function timeAgo(ms, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - ms) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return pluralise(minutes, 'minute') + ' ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return pluralise(hours, 'hour') + ' ago';
  const days = Math.round(hours / 24);
  if (days < 30) return pluralise(days, 'day') + ' ago';
  return new Date(ms).toLocaleDateString();
}
