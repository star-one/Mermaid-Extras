import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, StoreError } from '../demo/js/store.js';
import { makeSamples } from '../demo/js/samples.js';

class MemoryStorage {
  constructor() { this.data = new Map(); this.full = false; }
  getItem(k) { return this.data.has(k) ? this.data.get(k) : null; }
  setItem(k, v) { if (this.full) throw new Error('QuotaExceededError'); this.data.set(k, String(v)); }
  removeItem(k) { this.data.delete(k); }
}
const samples = () => makeSamples('2026-10-05');
let clock = 1000;
const make = (storage = new MemoryStorage()) => ({ storage, store: createStore({ storage, now: () => ++clock }) });

test('the samples are put in once, on the first visit only', () => {
  const { store, storage } = make();
  assert.equal(store.ensureSeeded(samples), true);
  assert.equal(store.count(), 6);
  store.remove('sample-gantt');
  assert.equal(createStore({ storage }).ensureSeeded(samples), false);       // a second visit doesn't bring it back
  assert.equal(createStore({ storage }).count(), 5);
});

test('charts survive a reload (a new store on the same storage)', () => {
  const { store, storage } = make();
  const created = store.create({ name: 'Mine', type: 'kanban' });
  const again = createStore({ storage });
  assert.equal(again.get(created.id).name, 'Mine');
});

test('list is most recently changed first, and put keeps the created time', () => {
  const { store } = make();
  const a = store.create({ name: 'A' }); const b = store.create({ name: 'B' });
  assert.deepEqual(store.list().map((e) => e.chart.name), ['B', 'A']);
  const createdA = store.meta(a.id).created;
  store.put({ ...a, name: 'A renamed' });
  assert.deepEqual(store.list().map((e) => e.chart.name), ['A renamed', 'B']);
  assert.equal(store.meta(a.id).created, createdA);
  void b;
});

test('stored charts are copies: changing one you were given does not change the store', () => {
  const { store } = make();
  const chart = store.create({ name: 'A' });
  chart.name = 'changed';
  assert.equal(store.get(chart.id).name, 'A');
});

test('duplicate and remove', () => {
  const { store } = make();
  const chart = store.create({ name: 'Original' });
  const copy = store.duplicate(chart.id);
  assert.equal(copy.name, 'Original (copy)');
  assert.notEqual(copy.id, chart.id);
  store.remove(chart.id);
  assert.equal(store.get(chart.id), null);
  assert.equal(store.duplicate('nope'), null);
});

test('export and import round-trip, adding or replacing', () => {
  const { store } = make();
  store.ensureSeeded(samples);
  const text = store.exportJSON();
  const other = make().store;
  assert.equal(other.importJSON(text), 6);
  assert.equal(other.count(), 6);
  assert.equal(other.importJSON(text), 6);          // adding the same ones again gives them new ids
  assert.equal(other.count(), 12);
  assert.equal(other.importJSON(text, { replace: true }), 6);
  assert.equal(other.count(), 6);
});

test('import accepts a single chart and rejects rubbish', () => {
  const { store } = make();
  const chart = samples()[0];
  assert.equal(store.importJSON(JSON.stringify(chart)), 1);
  assert.throws(() => store.importJSON('not json'), StoreError);
  assert.throws(() => store.importJSON('{"charts": []}'), /No charts/);
  assert.throws(() => store.importJSON('{"hello": 1}'), /No charts/);
});

test('imported charts are tidied, so hostile or broken data cannot get in', () => {
  const { store } = make();
  store.importJSON(JSON.stringify({ charts: [{ id: 'x', name: '<img src=x onerror=alert(1)>', type: 'flowchart', nodes: [{ id: 1, caption: 'ok', groupId: 99, parents: [{ id: 1 }, { id: 7 }], colour: 'red', shape: 'bogus' }] }] }));
  const chart = store.get('x');
  assert.ok(!chart.name.includes('<'));
  const node = chart.nodes[0];
  assert.deepEqual([node.groupId, node.parents.length, node.colour, node.shape], [0, 0, '#ececff', 'rounded']);
});

test('a full or disabled browser store is reported clearly and nothing is half-saved', () => {
  const { store, storage } = make();
  store.create({ name: 'fits' });
  storage.full = true;
  assert.throws(() => store.create({ name: 'does not fit' }), /local storage/i);
});

test('unreadable stored data is treated as empty', () => {
  const storage = new MemoryStorage();
  storage.setItem('mermaid-extras-demo:v1', '{broken');
  assert.equal(createStore({ storage }).count(), 0);
});

test('reset brings back exactly the samples', () => {
  const { store } = make();
  store.create({ name: 'mine' });
  store.reset(samples);
  assert.deepEqual(store.list().map((e) => e.chart.id).sort(), samples().map((c) => c.id).sort());
});
