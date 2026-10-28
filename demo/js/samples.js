// Sample charts that the demo starts with (and that "Reset the demo" brings back). They show off each chart type; dates
// are worked out from today so the Gantt chart always looks current. The tests use these too.

import { createChart, createGroup, createNode } from '../../lib/mermaid-extras.js';

function addDays(ymd, days) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function node(chart, caption, fields = {}) { return createNode(chart, { caption, ...fields }); }
const after = (...ids) => ids.map((id) => ({ id, label: '' }));

export function ganttSample(today) {
  const chart = createChart({ id: 'sample-gantt', name: 'Product launch plan', type: 'gantt' });
  chart.settings.gantt = { title: 'Product launch', excludeWeekends: true };
  const discovery = createGroup(chart, { name: 'Discovery' });
  const build = createGroup(chart, { name: 'Build' });
  const launch = createGroup(chart, { name: 'Launch' });

  const kickoff = node(chart, 'Kick-off', { groupId: discovery.id, settings: { gantt: { kind: 'milestone', startMode: 'date', startDate: addDays(today, -10) } } });
  const research = node(chart, 'User research', { groupId: discovery.id, settings: { gantt: { tags: ['done'], startMode: 'date', startDate: addDays(today, -10), endMode: 'duration', durValue: 1.5, durUnit: 'w' } } });
  const spec = node(chart, 'Write the specification', { groupId: discovery.id, parents: after(research.id), settings: { gantt: { tags: ['active'], startMode: 'after', endMode: 'duration', durValue: 1, durUnit: 'w' } } });
  const design = node(chart, 'Design', { groupId: build.id, parents: after(spec.id), settings: { gantt: { startMode: 'after', endMode: 'duration', durValue: 2, durUnit: 'w' } } });
  const backend = node(chart, 'Build the back end', { groupId: build.id, parents: after(spec.id), settings: { gantt: { tags: ['crit'], startMode: 'after', endMode: 'duration', durValue: 3, durUnit: 'w' } } });
  node(chart, 'Build the front end', { groupId: build.id, parents: after(design.id), settings: { gantt: { startMode: 'after', endMode: 'duration', durValue: 2, durUnit: 'w' } } });
  const test = node(chart, 'Test and fix', { groupId: launch.id, parents: after(backend.id), settings: { gantt: { tags: ['crit'], startMode: 'after', endMode: 'duration', durValue: 10, durUnit: 'd' } } });
  node(chart, 'Launch day', { groupId: launch.id, parents: after(test.id), settings: { gantt: { kind: 'milestone', startMode: 'after' } } });
  node(chart, 'Launch deadline', { groupId: launch.id, settings: { gantt: { kind: 'vert', startMode: 'date', startDate: addDays(today, 56) } } });
  node(chart, 'Phase 2: new markets (date to be agreed)', { groupId: launch.id, settings: { gantt: { startMode: 'unknown', endMode: 'unknown' } } });
  node(chart, 'Customer support (ongoing)', { groupId: launch.id, settings: { gantt: { startMode: 'date', startDate: addDays(today, 50), endMode: 'unknown' } } });
  void kickoff;
  return chart;
}

export function treeviewSample() {
  const chart = createChart({ id: 'sample-treeview', name: 'Repository layout', type: 'treeview' });
  chart.settings.treeview = { showIcons: true, defaultIconPack: 'material-icon-theme', extensionIcons: 'js = javascript\ncss = css\nmd = markdown\njson = json' };
  const root = node(chart, 'mermaid-extras', { settings: { treeview: { isDir: true, description: 'the whole project' } } });
  const lib = node(chart, 'lib', { parents: after(root.id), settings: { treeview: { highlight: true, description: 'the library: this is what you copy into your project' } } });
  node(chart, 'mermaid-extras.js', { parents: after(lib.id), settings: { treeview: { description: 'the entry point' } } });
  node(chart, 'mermaid-extras.css', { parents: after(lib.id) });
  const src = node(chart, 'src', { parents: after(lib.id), settings: { treeview: { isDir: true } } });
  node(chart, 'builders', { parents: after(src.id), settings: { treeview: { isDir: true } } });
  node(chart, 'view', { parents: after(src.id), settings: { treeview: { isDir: true } } });
  const demo = node(chart, 'demo', { parents: after(root.id), settings: { treeview: { description: 'the demo site: not part of the library' } } });
  node(chart, 'index.html', { parents: after(demo.id) });
  node(chart, 'js', { parents: after(demo.id), settings: { treeview: { isDir: true } } });
  const docs = node(chart, 'docs', { parents: after(root.id), settings: { treeview: { isDir: true } } });
  node(chart, 'getting-started.md', { parents: after(docs.id) });
  node(chart, 'package.json', { parents: after(root.id) });
  return chart;
}

export function flowchartSample() {
  const chart = createChart({ id: 'sample-flowchart', name: 'Customer onboarding', type: 'flowchart' });
  const signup = createGroup(chart, { name: 'Sign-up', order: 2, colour: '#e0f2fe' });
  const setup = createGroup(chart, { name: 'Set-up', order: 1, colour: '#dcfce7' });
  const start = node(chart, 'Visitor arrives', { groupId: signup.id, shape: 'stadium', colour: '#bae6fd' });
  const form = node(chart, 'Fills in the sign-up form', { groupId: signup.id, parents: [{ id: start.id, label: '' }] });
  const valid = node(chart, 'Details valid?', { groupId: signup.id, shape: 'diam', colour: '#fde68a', parents: [{ id: form.id, label: '' }] });
  node(chart, 'Show the errors', { groupId: signup.id, shape: 'rounded', colour: '#fecaca', parents: [{ id: valid.id, label: 'no' }] });
  const account = node(chart, 'Create the account', { groupId: setup.id, shape: 'cyl', colour: '#bbf7d0', parents: [{ id: valid.id, label: 'yes' }] });
  const email = node(chart, 'Send the welcome email', { groupId: setup.id, parents: [{ id: account.id, label: '' }] });
  node(chart, 'Customer is onboarded', { groupId: 0, shape: 'stadium', colour: '#c7d2fe', parents: [{ id: email.id, label: '' }] });
  return chart;
}

export function swimlaneSample() {
  const chart = createChart({ id: 'sample-swimlane', name: 'Expenses approval', type: 'swimlane', direction: 'TB' });
  const staff = createGroup(chart, { name: 'Staff member', order: 1, colour: '#ede9fe' });
  const manager = createGroup(chart, { name: 'Line manager', order: 2, colour: '#dbeafe' });
  const finance = createGroup(chart, { name: 'Finance', order: 3, colour: '#dcfce7' });
  const claim = node(chart, 'Submits the claim', { groupId: staff.id });
  const check = node(chart, 'Reviews the claim', { groupId: manager.id, parents: [{ id: claim.id, label: '' }] });
  const ok = node(chart, 'Approved?', { groupId: manager.id, shape: 'diam', colour: '#fde68a', parents: [{ id: check.id, label: '' }] });
  node(chart, 'Fixes and resubmits', { groupId: staff.id, parents: [{ id: ok.id, label: 'no' }] });
  const pay = node(chart, 'Pays the claim', { groupId: finance.id, parents: [{ id: ok.id, label: 'yes' }] });
  node(chart, 'Files the receipt', { groupId: finance.id, shape: 'doc', parents: [{ id: pay.id, label: '' }] });
  return chart;
}

export function mindmapSample() {
  const chart = createChart({ id: 'sample-mindmap', name: 'Planning a conference', type: 'mindmap' });
  const venue = node(chart, 'Venue', { shape: 'rounded' });
  node(chart, 'Capacity', { parents: after(venue.id) });
  node(chart, 'Accessibility', { parents: after(venue.id) });
  const speakers = node(chart, 'Speakers', { shape: 'rounded' });
  node(chart, 'Call for papers', { parents: after(speakers.id) });
  node(chart, 'Keynote', { parents: after(speakers.id), shape: 'hex' });
  const money = node(chart, 'Budget', { shape: 'rounded' });
  node(chart, 'Sponsors', { parents: after(money.id) });
  node(chart, 'Ticket prices', { parents: after(money.id) });
  return chart;
}

export function kanbanSample() {
  const chart = createChart({ id: 'sample-kanban', name: 'Sprint board', type: 'kanban' });
  const todo = createGroup(chart, { name: 'To do' });
  const doing = createGroup(chart, { name: 'In progress' });
  const done = createGroup(chart, { name: 'Done' });
  node(chart, 'Write the release notes', { groupId: todo.id, priority: 'Low', assignee: 'Sam' });
  node(chart, 'Fix the login bug', { groupId: todo.id, priority: 'Critical', assignee: 'Alex' });
  node(chart, 'Review the pull requests', { groupId: doing.id, priority: 'High', assignee: 'Priya' });
  node(chart, 'Update the dependencies', { groupId: doing.id, priority: 'Medium' });
  node(chart, 'Set up the new analytics', { groupId: done.id, priority: 'Medium', assignee: 'Jo' });
  return chart;
}

/** All the sample charts, in the order they appear on the dashboard. `today` is YYYY-MM-DD. */
export function makeSamples(today) {
  return [ganttSample(today), treeviewSample(), flowchartSample(), swimlaneSample(), kanbanSample(), mindmapSample()];
}
