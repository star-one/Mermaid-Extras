import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnv } from './helpers/env.js';
import { createChart, createGroup, createNode, GANTT_COLOUR_FIELDS } from '../lib/mermaid-extras.js';
import { buildForm, getPath } from '../demo/js/forms/form-kit.js';
import { nodeFormSpec, nodeFormInitial, applyNodeForm } from '../demo/js/forms/node-form.js';
import { chartFormSpec, chartFormInitial, chartFieldsFromForm } from '../demo/js/forms/chart-form.js';
import { groupFormSpec, groupFormInitial, groupFieldsFromForm } from '../demo/js/forms/group-form.js';
import { defaultsForTarget } from '../demo/js/views/chart-page.js';

const env = await setupEnv();
const doc = env.document;
const change = (el) => el.dispatchEvent(new env.window.Event('change', { bubbles: true }));
const input = (form, name) => form.el.querySelector(`[id]`) && [...form.el.querySelectorAll('input, select, textarea')].find((e) => e.dataset && e.dataset.name === name);

test('form kit: nested values, every field kind, and "show only if"', () => {
  const form = buildForm([
    { name: 'a.name', type: 'text', label: 'Name' },
    { name: 'a.n', type: 'number', label: 'N' },
    { name: 'flag', type: 'checkbox', label: 'Flag' },
    { name: 'pick', type: 'select', label: 'Pick', options: [['x', 'X'], ['y', 'Y']] },
    { name: 'mode', type: 'radio', label: 'Mode', options: [['one', 'One'], ['two', 'Two']] },
    { name: 'tags', type: 'checks', label: 'Tags', options: [['a', 'A'], ['b', 'B']] },
    { name: 'extra', type: 'text', label: 'Extra', showIf: (v) => v.flag },
  ], { a: { name: 'hello', n: 5 }, pick: 'y', mode: 'two', tags: ['b'] });
  assert.deepEqual(form.getValues(), { a: { name: 'hello', n: '5' }, flag: false, pick: 'y', mode: 'two', tags: ['b'], extra: '' });
  const extra = form.el.querySelector('.field:last-of-type');
  assert.equal(extra.hidden, true);
  const flag = form.el.querySelector('input[type="checkbox"]');
  flag.checked = true; change(flag);
  assert.equal(extra.hidden, false);
  form.setValues({ pick: 'x', tags: ['a', 'b'] });
  assert.deepEqual([form.getValues().pick, form.getValues().tags], ['x', ['a', 'b']]);
  form.setError('Oops'); assert.equal(form.el.querySelector('.form-error').textContent, 'Oops');
  form.setError(''); assert.equal(form.el.querySelector('.form-error').hidden, true);
});

test('form kit: the "connected to" editor adds, reads and removes rows', () => {
  const form = buildForm([{ name: 'parents', type: 'parents', options: [[1, 'One'], [2, 'Two']], labels: true }], { parents: [{ id: 2, label: 'yes' }] });
  assert.deepEqual(form.getValues().parents, [{ id: 2, label: 'yes' }]);
  form.el.querySelector('.parents-editor > .btn').click();
  assert.equal(form.el.querySelectorAll('.parents-row').length, 2);
  assert.equal(form.getValues().parents.length, 1, 'an unchosen row is ignored');
  form.el.querySelector('.parents-row .btn').click();
  assert.equal(form.el.querySelectorAll('.parents-row').length, 1);
});

test('form kit: twistouts are closed to begin with and their fields are still read', () => {
  const form = buildForm([{ type: 'details', label: 'More', fields: [{ name: 'deep.x', type: 'text', label: 'X' }] }], { deep: { x: 'kept' } });
  assert.equal(form.el.querySelector('details').open, false);
  assert.equal(getPath(form.getValues(), 'deep.x'), 'kept');
});

test('node form (flow chart): shape, colour, group and labelled parents are saved', () => {
  const chart = createChart({ type: 'flowchart' });
  const g = createGroup(chart, { name: 'G' });
  const a = createNode(chart, { caption: 'A' });
  const node = createNode(chart, { caption: '' });
  const form = buildForm(nodeFormSpec(chart, 'flowchart', node.id), nodeFormInitial(chart, 'flowchart', null, { parentId: a.id, groupId: g.id }));
  const values = form.getValues();
  assert.deepEqual(values.parents, [{ id: a.id, label: '' }]);
  assert.equal(Number(values.groupId), g.id);
  const result = applyNodeForm(chart, 'flowchart', node, { ...values, caption: ' New caption ', shape: 'diam', colour: '#112233', parents: [{ id: a.id, label: 'yes' }, { id: 999, label: 'gone' }] });
  assert.equal(result.error, null);
  assert.deepEqual([node.caption, node.shape, node.colour, node.groupId, node.parents], ['New caption', 'diam', '#112233', g.id, [{ id: a.id, label: 'yes' }]]);
  assert.match(applyNodeForm(chart, 'flowchart', node, { ...values, caption: '  ' }).error, /name/);
});

test('node form (Kanban): a card must be in a column', () => {
  const chart = createChart({ type: 'kanban' });
  const node = createNode(chart, { caption: 'c' });
  assert.match(applyNodeForm(chart, 'kanban', node, { caption: 'c', groupId: '0', priority: 'High' }).error, /column/);
  const col = createGroup(chart, { name: 'Todo' });
  assert.equal(applyNodeForm(chart, 'kanban', node, { caption: 'c', groupId: String(col.id), priority: 'High', assignee: ' Sam ' }).error, null);
  assert.deepEqual([node.groupId, node.priority, node.assignee], [col.id, 'High', 'Sam']);
  assert.equal(nodeFormInitial(chart, 'kanban', null).groupId, col.id, 'a new card starts in the first column');
});

test('node form (tree view): parent, folder, highlight, description and a custom icon', () => {
  const chart = createChart({ type: 'treeview' });
  const a = createNode(chart, { caption: 'a' });
  const node = createNode(chart, { caption: 'b' });
  const base = { caption: 'b', parentId: String(a.id), tv: { isDir: true, highlight: true, description: 'hi', iconMode: 'custom', iconCustom: 'logos:react', order: '2' } };
  assert.equal(applyNodeForm(chart, 'treeview', node, base).error, null);
  assert.deepEqual(node.parents, [{ id: a.id, label: '' }]);
  assert.deepEqual(node.settings.treeview, { isDir: true, highlight: true, description: 'hi', iconMode: 'custom', iconCustom: 'logos:react', order: 2 });
  assert.match(applyNodeForm(chart, 'treeview', node, { ...base, tv: { ...base.tv, iconCustom: '' } }).error, /icon/);
});

test('node form (Gantt): validation, and parents are only changed when "after particular tasks" is chosen', () => {
  const chart = createChart({ type: 'gantt' });
  const s = createGroup(chart, { name: 'S' });
  const a = createNode(chart, { caption: 'a' });
  const node = createNode(chart, { caption: 'b', parents: [{ id: a.id, label: 'flow label' }] });
  const gt = { kind: 'task', startMode: 'date', startDate: '2026-11-02', endMode: 'duration', durValue: '2', durUnit: 'w', tags: ['active'] };
  assert.equal(applyNodeForm(chart, 'gantt', node, { caption: 'b', groupId: String(s.id), gt, afterIds: [] }).error, null);
  assert.equal(node.settings.gantt.durValue, 2);
  assert.deepEqual(node.parents, [{ id: a.id, label: 'flow label' }], 'its flow chart connexion is not lost by editing it as a task');
  assert.equal(node.groupId, s.id);
  assert.equal(applyNodeForm(chart, 'gantt', node, { caption: 'b', groupId: '0', gt: { ...gt, startMode: 'after' }, afterIds: [String(a.id)] }).error, null);
  assert.deepEqual(node.parents, [{ id: a.id, label: '' }]);
  assert.match(applyNodeForm(chart, 'gantt', node, { caption: 'b', groupId: '0', gt: { ...gt, durValue: '0.5' }, afterIds: [] }).error, /one day/);
});

test('node form specs exist for every type and open without error', () => {
  for (const type of ['flowchart', 'swimlane', 'mindmap', 'kanban', 'treeview', 'gantt']) {
    const chart = createChart({ type });
    createGroup(chart, { name: 'G' });
    createNode(chart, { caption: 'x', groupId: 1 });
    const form = buildForm(nodeFormSpec(chart, type, 0), nodeFormInitial(chart, type, null));
    assert.ok(form.el.querySelector('input[type="text"]'), type);
  }
});

test('Gantt form shows the right fields for each start and end choice', () => {
  const chart = createChart({ type: 'gantt' });
  createNode(chart, { caption: 'x' });
  const form = buildForm(nodeFormSpec(chart, 'gantt', 0), nodeFormInitial(chart, 'gantt', null));
  const visible = () => [...form.el.querySelectorAll('.field:not([hidden]) label.field-label, .field:not([hidden]) .choice span, .field-note:not([hidden]) p')].map((e) => e.textContent);
  assert.ok(!visible().includes('Date'), 'no date for "when the task before it ends"');
  form.setValues({ gt: { startMode: 'date' } });
  assert.ok(visible().includes('Date'));
  form.setValues({ gt: { endMode: 'unknown' } });
  assert.ok(visible().some((t) => t.startsWith('The bar starts where it should')), 'explains how an unknown end is drawn');
  form.setValues({ gt: { kind: 'vert' } });
  assert.ok(!visible().includes('Ends'), 'a marker has no end');
});

test('chart form: defaults, validated output, and colours reset', () => {
  const initial = chartFormInitial(null);
  assert.equal(initial.gt.weekday, 'monday');
  assert.equal(initial.gt.axisFormat, '%b %-d');
  assert.equal(initial.gt.colActiveBg, '#c3f0c3');
  const form = buildForm(chartFormSpec(), { ...initial, name: 'Plan', type: 'gantt' });
  form.setValues({ gt: { colActiveBg: '#000000', title: 'T', cfg: { barHeight: '30' } } });
  const fields = chartFieldsFromForm(form.getValues(), null);
  assert.equal(fields.settings.gantt.colActiveBg, '#000000');
  assert.equal(fields.settings.gantt.cfg.barHeight, 30);
  const reset = [...form.el.querySelectorAll('button')].find((b) => /Reset the task colours/.test(b.textContent));
  reset.click();
  assert.equal(chartFieldsFromForm(form.getValues(), null).settings.gantt.colActiveBg, GANTT_COLOUR_FIELDS.colActiveBg[2]);
  assert.equal(fields.type, 'gantt');
});

test('chart form: only the options for the chosen type are shown, and the advanced ones are folded away', () => {
  const form = buildForm(chartFormSpec(), chartFormInitial({ name: 'x', type: 'treeview', direction: 'TB', settings: {} }));
  const shown = (text) => [...form.el.querySelectorAll('h3')].some((h) => h.textContent === text && !h.closest('.field').hidden);
  assert.ok(shown('Tree view options'));
  assert.ok(!shown('Gantt chart options'));
  form.setValues({ type: 'gantt' });
  assert.ok(shown('Gantt chart options'));
  assert.ok([...form.el.querySelectorAll('details')].every((d) => !d.open));
});

test('group form', () => {
  const chart = createChart({ type: 'gantt' });
  createGroup(chart, { name: 'one', order: 4 });
  assert.equal(groupFormInitial(null, chart).order, 5);
  assert.deepEqual(groupFormSpec('kanban').map((f) => f.name), ['name', 'order']);
  assert.deepEqual(groupFormSpec('flowchart').map((f) => f.name), ['name', 'order', 'colour', 'direction']);
  assert.match(groupFieldsFromForm({ name: ' ' }).error, /name/);
  assert.deepEqual(groupFieldsFromForm({ name: ' Go ', order: '3', colour: '#ffffff', direction: 'LR' }).fields, { name: 'Go', order: 3, colour: '#ffffff', direction: 'LR' });
});

test('clicking a box in "add" mode starts the new box in the right place for each type', () => {
  const chart = createChart({ type: 'flowchart' });
  const g = createGroup(chart, { name: 'G' });
  const a = createNode(chart, { caption: 'A', groupId: g.id });
  const click = (type) => defaultsForTarget(type, chart, { kind: 'node', id: a.id });
  assert.deepEqual(click('flowchart'), { parentId: a.id, groupId: g.id });
  assert.deepEqual(click('swimlane'), { parentId: a.id, groupId: g.id });
  assert.deepEqual(click('kanban'), { groupId: g.id });
  assert.deepEqual(click('treeview'), { parentId: a.id });
  assert.deepEqual(click('mindmap'), { parentId: a.id });
  assert.deepEqual(click('gantt'), { groupId: g.id, gt: { startMode: 'after' }, afterIds: [String(a.id)] });
  assert.deepEqual(defaultsForTarget('flowchart', chart, { kind: 'group', id: g.id }), { groupId: g.id });
  assert.deepEqual(defaultsForTarget('mindmap', chart, { kind: 'node', id: 0, isRoot: true }), {});
  void input; void doc;
});
