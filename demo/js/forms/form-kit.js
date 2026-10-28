// A tiny form builder for the demo: describe the fields as data, get a form back. The chart, box and group forms are
// all written this way, which keeps them short and keeps their "show this only if..." rules in one place.
//
// Field specs:
//   { name, label, type, ... }      type: text | textarea | number | date | color | checkbox | select | radio | checks
//     options     for select/radio/checks: [[value, label], ...] (or a function returning that, called each time the form opens)
//     help        small text under the field
//     required, placeholder, min, max, step, rows, maxlength
//     showIf      (values) => boolean: the field is hidden (but still read) when this is false
//   { type: 'heading', text }   { type: 'note', text }
//   { type: 'group', fields: [...], columns: 2 }      lays fields out side by side
//   { type: 'details', label, fields: [...] }         a show/hide twistout, closed to begin with
//   { type: 'parents', name, options, labels }        a list of "connected to" rows (a box and, optionally, a label)
//   { type: 'button', label, onClick(form) }
// Names can be dotted ("gt.cfg.barHeight"): values are read and written as nested objects.

import { h } from '../ui.js';

let formCounter = 0;

export function getPath(object, path) {
  return path.split('.').reduce((o, key) => (o === undefined || o === null ? undefined : o[key]), object);
}

export function setPath(object, path, value) {
  const keys = path.split('.');
  let target = object;
  for (const key of keys.slice(0, -1)) {
    if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
    target = target[key];
  }
  target[keys[keys.length - 1]] = value;
}

const resolveOptions = (options) => (typeof options === 'function' ? options() : (options || []));

export function buildForm(specs, initial = {}, { onChange } = {}) {
  const id = ++formCounter;
  const form = h('form', { class: 'kit-form', novalidate: true });
  const errorBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
  form.appendChild(errorBox);
  const fields = [];   // { spec, wrapper, get, set }
  let uid = 0;

  const readAll = () => {
    const values = {};
    for (const f of fields) if (f.spec.name && f.get) setPath(values, f.spec.name, f.get());
    return values;
  };

  const refresh = () => {
    const values = readAll();
    for (const f of fields) if (f.spec.showIf) f.wrapper.hidden = !f.spec.showIf(values);
    if (onChange) onChange(values);
  };

  function control(spec, container) {
    const fieldId = `f${id}-${++uid}`;
    const start = spec.name ? getPath(initial, spec.name) : undefined;
    let get; let set; let input;

    switch (spec.type) {
      case 'textarea':
        input = h('textarea', { id: fieldId, rows: spec.rows || 3, placeholder: spec.placeholder, maxlength: spec.maxlength });
        input.value = start ?? '';
        get = () => input.value; set = (v) => { input.value = v ?? ''; };
        break;
      case 'select': {
        input = h('select', { id: fieldId });
        for (const [value, label] of resolveOptions(spec.options)) input.appendChild(h('option', { value: String(value) }, label));
        input.value = String(start ?? (resolveOptions(spec.options)[0] || [''])[0]);
        get = () => input.value; set = (v) => { input.value = String(v ?? ''); };
        break;
      }
      case 'checkbox':
        input = h('input', { id: fieldId, type: 'checkbox' });
        input.checked = !!start;
        get = () => input.checked; set = (v) => { input.checked = !!v; };
        break;
      case 'radio': {
        const name = `r${id}-${uid}`;
        input = h('div', { class: 'choice-list', role: 'radiogroup' });
        const radios = [];
        for (const [value, label] of resolveOptions(spec.options)) {
          const radio = h('input', { type: 'radio', name, value: String(value), id: `${fieldId}-${radios.length}` });
          radio.checked = String(start ?? resolveOptions(spec.options)[0][0]) === String(value);
          radios.push(radio);
          input.appendChild(h('label', { class: 'choice', for: radio.id }, radio, h('span', {}, label)));
        }
        get = () => (radios.find((r) => r.checked) || {}).value; set = (v) => radios.forEach((r) => { r.checked = r.value === String(v); });
        break;
      }
      case 'checks': {
        input = h('div', { class: 'choice-list choice-inline' });
        const boxes = [];
        const chosen = new Set((Array.isArray(start) ? start : []).map(String));
        for (const [value, label] of resolveOptions(spec.options)) {
          const box = h('input', { type: 'checkbox', value: String(value), id: `${fieldId}-${boxes.length}` });
          box.checked = chosen.has(String(value));
          boxes.push(box);
          input.appendChild(h('label', { class: 'choice', for: box.id }, box, h('span', {}, label)));
        }
        if (!boxes.length) input.appendChild(h('span', { class: 'muted' }, spec.empty || 'Nothing to choose from yet.'));
        get = () => boxes.filter((b) => b.checked).map((b) => b.value);
        set = (v) => { const s = new Set((v || []).map(String)); boxes.forEach((b) => { b.checked = s.has(b.value); }); };
        break;
      }
      case 'parents': {
        input = h('div', { class: 'parents-editor' });
        const rows = h('div', { class: 'parents-rows' });
        const addRow = (value = {}) => {
          const select = h('select', { 'aria-label': 'Connected to' });
          select.appendChild(h('option', { value: '0' }, '-- choose --'));
          for (const [optionValue, label] of resolveOptions(spec.options)) select.appendChild(h('option', { value: String(optionValue) }, label));
          select.value = String(value.id ?? 0);
          const label = spec.labels ? h('input', { type: 'text', placeholder: 'Label on the connexion (optional)', value: value.label || '', maxlength: 100, 'aria-label': 'Connexion label' }) : null;
          const row = h('div', { class: 'parents-row' }, select, label, h('button', { type: 'button', class: 'btn btn-quiet', title: 'Remove', onClick: () => { row.remove(); refresh(); } }, '×'));
          row._get = () => ({ id: Number(select.value) || 0, label: label ? label.value : '' });
          rows.appendChild(row);
        };
        for (const parent of (Array.isArray(start) ? start : [])) addRow(parent);
        input.appendChild(rows);
        input.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', onClick: () => addRow() }, '+ ' + (spec.addLabel || 'Add a connexion')));
        get = () => [...rows.children].map((row) => row._get()).filter((p) => p.id > 0);
        set = (v) => { rows.innerHTML = ''; (v || []).forEach(addRow); };
        break;
      }
      default: { // text, number, date, color
        input = h('input', {
          id: fieldId, type: spec.type || 'text', placeholder: spec.placeholder, min: spec.min, max: spec.max, step: spec.step,
          maxlength: spec.maxlength, autocomplete: 'off',
        });
        input.value = start ?? (spec.type === 'color' ? '#000000' : '');
        get = () => input.value; set = (v) => { input.value = v ?? ''; };
      }
    }
    const focusTarget = input.matches && input.matches('input, select, textarea') ? input : null;
    return { fieldId, input, get, set, focusTarget };
  }

  function build(spec, container) {
    const wrapper = h('div', { class: `field field-${spec.type || 'text'}${spec.class ? ' ' + spec.class : ''}` });
    const entry = { spec, wrapper };
    fields.push(entry);
    container.appendChild(wrapper);

    switch (spec.type) {
      case 'heading': wrapper.appendChild(h('h3', {}, spec.text)); return;
      case 'note': wrapper.appendChild(h('p', { class: 'muted' }, spec.text)); return;
      case 'button':
        wrapper.appendChild(h('button', { type: 'button', class: 'btn btn-default', onClick: () => spec.onClick(api) }, spec.label));
        return;
      case 'group': {
        wrapper.classList.add(`cols-${spec.columns || 2}`);
        for (const child of spec.fields) build(child, wrapper);
        return;
      }
      case 'details': {
        const details = h('details', { class: 'twistout' }, h('summary', {}, spec.label));
        wrapper.appendChild(details);
        for (const child of spec.fields) build(child, details);
        return;
      }
      default: break;
    }

    const c = control(spec, wrapper);
    entry.get = c.get; entry.set = c.set; entry.focus = () => c.focusTarget && c.focusTarget.focus();
    if (spec.type === 'checkbox') {
      wrapper.appendChild(h('label', { class: 'choice', for: c.fieldId }, c.input, h('span', {}, spec.label)));
    } else {
      if (spec.label) wrapper.appendChild(h('label', { class: 'field-label', for: spec.type === 'radio' || spec.type === 'checks' || spec.type === 'parents' ? null : c.fieldId }, spec.label, spec.required ? h('span', { class: 'req', title: 'required' }, ' *') : null));
      wrapper.appendChild(c.input);
    }
    if (spec.help) wrapper.appendChild(h('p', { class: 'help' }, spec.help));
    c.input.addEventListener('input', refresh);
    c.input.addEventListener('change', refresh);
  }

  for (const spec of specs) build(spec, form);

  const api = {
    el: form,
    getValues: readAll,
    /** Sets some fields: { 'gt.colActiveBg': '#fff' } or nested */
    setValues(values) {
      for (const f of fields) {
        if (!f.spec.name || !f.set) continue;
        const value = getPath(values, f.spec.name);
        if (value !== undefined) f.set(value);
      }
      refresh();
    },
    setError(message) { errorBox.hidden = !message; errorBox.textContent = message || ''; if (message) errorBox.scrollIntoView && errorBox.scrollIntoView({ block: 'nearest' }); },
    focusFirst() { const f = fields.find((x) => x.focus && !x.wrapper.hidden); if (f) f.focus(); },
  };
  refresh();
  return api;
}
