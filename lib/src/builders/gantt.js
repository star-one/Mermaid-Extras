// Gantt chart. This builds on Mermaid's own gantt diagram and adds:
//   * tasks that start after other tasks, with followers stacked directly beneath what they follow
//   * milestones and vertical markers
//   * an unknown start and/or an unknown end ("sometime in the future"), drawn as a faded bar
//   * dependency arrows (the list of pairs is returned for the view to draw)
//   * a timeline whose zoom the view can change (the axis lines are written by ganttAxisLines())
//   * configurable task colours, axis format, excluded days, today marker and layout
//
// Mermaid works out every task's dates itself, but a task whose start or end isn't known still has to be given
// *some* date to be drawn. A rough schedule is worked out here (in whole days, ignoring excluded days) to decide
// which tasks are affected and to choose a placeholder start: a task that starts at an unknown point in the
// future is drawn from today. A task that ends at an unknown point is written with GANTT_UNKNOWN_END instead of
// an end, which is replaced by a duration (about a third of the timeline on screen) when the chart is drawn.

import { DAY_MS, dayToMs, msToDay, validDate, cleanEnum } from '../util.js';
import {
  chartGanttSettings, nodeGanttSettings, nodeHasSettings, GANTT_COLOUR_FIELDS, GANTT_LAYOUT_FIELDS,
} from '../settings.js';
import { captionText, sortNodeIds, hasExplicitOrder } from './shared.js';

export const GANTT_UNKNOWN_END = '@@UNKNOWNEND@@';
export const GANTT_AXIS_MARKER = '%%AXIS%%';

// A task whose name starts with one of these words is read by Mermaid as a command ("Call the client" as a callback,
// "Click here" as a link, ...), which is a syntax error. They are given an invisible zero-width space in front.
const GANTT_KEYWORDS = /^(call|click|href|inclusiveEndDates|topAxis|gantt)\b/i;

/** Mermaid's gantt syntax can't cope with ":" ";" "#" or "%%" in a name, or with names that start like a command. */
export function ganttText(caption, fallback = 'Untitled') {
  let text = captionText(caption);
  text = text.replace(/:/g, ' -').replace(/;/g, ',').replace(/#/g, '').replace(/%%/g, '%');
  text = text.replace(/\s+/g, ' ').trim();
  if (text === '') text = fallback;
  return GANTT_KEYWORDS.test(text) ? '\u200B' + text : text;
}

export function ganttDuration(ns) {
  const value = Math.max(1, Number(ns.durValue) || 1);
  const text = value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return text + cleanEnum(ns.durUnit, ['d', 'w', 'M', 'y'], 'd');
}

function axisFormatOf(s) { return s.axisFormat === 'custom' ? s.axisFormatCustom : s.axisFormat; }

/** What the view needs to write the axis lines itself while the timeline is zoomed in and out. */
export function ganttTimelineConfig(chart) {
  const s = chartGanttSettings(chart);
  const hasTick = s.tickN !== '' && s.tickN !== null && s.tickN !== undefined;
  const format = axisFormatOf(s);
  return {
    axisFormat: format,
    // A format other than the default is the user's own choice, so it is used at every zoom level. (2026-10-03 was
    // an earlier default, so it doesn't count: charts saved with it keep their automatic day and month labels.)
    axisFormatChosen: !['%b %-d', '%Y-%m-%d'].includes(format),
    weekday: s.weekday,
    userTick: hasTick ? { n: Number(s.tickN), unit: s.tickUnit } : null, // fixed tick spacing, not changed by zooming
    leftPadding: s.cfg && s.cfg.leftPadding !== undefined ? Number(s.cfg.leftPadding) : 75,
    rightPadding: s.cfg && s.cfg.rightPadding !== undefined ? Number(s.cfg.rightPadding) : 75,
  };
}

/**
 * The axis lines for a timeline drawn at `pixelsPerDay`: day ticks when zoomed in, week ticks in the middle,
 * month ticks when zoomed out. A tick spacing or date format the chart's author chose is used as it is.
 */
export function ganttAxisLines(timeline, pixelsPerDay) {
  const P = pixelsPerDay;
  let unit; let n = 1; let format;
  if (timeline.userTick) { unit = timeline.userTick.unit; n = timeline.userTick.n; }
  else if (P >= 16) unit = 'day';
  else if (P >= 4) unit = 'week';
  else unit = 'month';

  if (timeline.axisFormatChosen) format = timeline.axisFormat;
  else if (unit === 'day') format = (P * n >= 34) ? '%a %-d' : '%-d';
  else if (unit === 'week') format = (7 * P * n >= 90) ? timeline.axisFormat : ((7 * P * n >= 52) ? '%b %-d' : '%-d');
  else format = (30 * P * n >= 110) ? '%B %Y' : ((30 * P * n >= 60) ? '%b %Y' : '%b');

  let lines = `    axisFormat ${format}\n    tickInterval ${n}${unit}\n`;
  if (unit === 'week') lines += `    weekday ${timeline.weekday}\n`;
  return lines;
}

/** Fills in the two placeholders in a template made with { withAxis: false }. */
export function resolveGanttTemplate(template, { axisLines, unknownDays }) {
  return template
    .replace(new RegExp(`^.*${GANTT_AXIS_MARKER}.*\\n?`, 'm'), axisLines)
    .split(GANTT_UNKNOWN_END).join(`${Math.max(1, Math.round(unknownDays))}d`);
}

function headerLines(chart, withAxis) {
  const s = chartGanttSettings(chart);
  const lines = [];
  if (s.title !== '') lines.push('    title ' + s.title.replace(/[;#]/g, ' '));
  lines.push('    dateFormat YYYY-MM-DD'); // dates are entered with date pickers, so the input format is fixed
  if (withAxis) {
    lines.push('    axisFormat ' + axisFormatOf(s));
    const hasTick = s.tickN !== '' && s.tickN !== null && s.tickN !== undefined;
    if (hasTick) lines.push(`    tickInterval ${Number(s.tickN)}${s.tickUnit}`);
    if (s.tickUnit === 'week' || !hasTick) lines.push('    weekday ' + s.weekday);
  } else {
    lines.push('    ' + GANTT_AXIS_MARKER); // the view writes the axis lines, to suit the timeline zoom
  }
  if (s.weekend === 'friday') lines.push('    weekend friday');
  if (s.excludeWeekends) lines.push('    excludes weekends');
  if (s.excludeDays.length) lines.push('    excludes ' + s.excludeDays.join(' '));
  const dates = s.excludeDates.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < dates.length; i += 10) lines.push('    excludes ' + dates.slice(i, i + 10).join(' '));
  if (s.todayMarker === 'off') lines.push('    todayMarker off');
  else if (s.todayMarker === 'custom') lines.push(`    todayMarker stroke-width:${Number(s.todayWidth)}px,stroke:${s.todayColour},opacity:${Number(s.todayOpacity)}`);
  return lines.join('\n') + '\n';
}

// ---- Scheduling ---------------------------------------------------------------------------------------------------

/** `ms` plus the task's duration (never less than a day). */
export function addDuration(ms, ns) {
  const value = Math.max(1, Number(ns.durValue) || 1);
  const unit = cleanEnum(ns.durUnit, ['d', 'w', 'M', 'y'], 'd');
  if (unit === 'd' || unit === 'w') return ms + Math.round(value * (unit === 'w' ? 7 : 1) * 86400) * 1000;
  const whole = Math.floor(value);
  const months = unit === 'y' ? whole * 12 : whole;
  const extraDays = (value - whole) * (unit === 'y' ? 365 : 30);
  const date = new Date(ms);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime() + Math.round(extraDays * 86400) * 1000;
}

/**
 * Works out how one box's start and end are to be written. `previousId` is the box drawn just before it (for "when
 * the task before it ends"). Anything that can't be honoured (a date never filled in, a target task that has been
 * deleted, ...) falls back to something sensible rather than breaking the chart.
 */
export function resolveTask(id, node, structure, previousId) {
  const ns = nodeGanttSettings(node);
  const validParents = (structure.parents.get(id) || []).filter((p) => p !== id && structure.nodes.has(p));
  // A box that has never been set up as a Gantt task (e.g. it came from a flow chart) starts after its parents
  // if it has any, otherwise after the task before it, and lasts a day.
  if (!nodeHasSettings(node, 'gantt') && validParents.length) ns.startMode = 'after';

  const kind = ns.kind;
  let startMode = kind === 'vert' ? 'date' : ns.startMode;
  if (kind !== 'task' && startMode === 'unknown') startMode = 'previous';
  if (startMode === 'after' && !validParents.length) startMode = 'previous';
  if (startMode === 'date' && !validDate(ns.startDate)) startMode = 'previous';
  if (startMode === 'previous' && previousId === null) startMode = 'today';

  let endMode;
  if (kind === 'milestone') endMode = 'milestone';
  else if (kind === 'vert') endMode = 'vert';
  else {
    endMode = ns.endMode;
    if (endMode === 'date' && !validDate(ns.endDate)) endMode = 'duration';
    if (endMode === 'until' && (Number(ns.untilNode) === id || !structure.nodes.has(Number(ns.untilNode)))) endMode = 'duration';
  }
  return { ns, kind, startMode, endMode, parents: validParents, previous: previousId };
}

/**
 * Rough dates for every box: id -> { s, e, su, eu } (start/end in ms; su/eu: that end is unknown). A null means
 * "can't be worked out yet", which happens when a task has to wait for another whose end is unknown.
 */
export function scheduleTasks(resolved, todayMs) {
  const res = new Map(); const busy = new Set();
  const get = (id) => {
    if (res.has(id)) return res.get(id);
    if (!resolved.has(id) || busy.has(id)) return { s: todayMs, e: todayMs + DAY_MS, su: false, eu: false }; // missing, or a loop
    busy.add(id);
    const r = resolved.get(id); const ns = r.ns;
    let su = false; let eu = false; let s; let e;

    switch (r.startMode) {
      case 'date': s = dayToMs(ns.startDate); break;
      case 'today': s = todayMs; break;
      case 'previous': s = get(r.previous).e; break;
      case 'after': {
        s = 0;
        for (const parentId of r.parents) {
          const p = get(parentId);
          s = (p.e === null || s === null) ? null : Math.max(s, p.e);
        }
        break;
      }
      default: s = null; su = true; // 'unknown': decided below, once the end is known
    }
    if (s === null) su = true;

    switch (r.endMode) {
      case 'milestone':
      case 'vert': e = s; break;
      case 'date': e = dayToMs(ns.endDate); break;
      case 'until': {
        const t = get(Number(ns.untilNode));
        if (t.su || t.s === null) { e = null; eu = true; } else e = t.s;
        break;
      }
      case 'unknown': e = null; eu = true; break;
      default: e = s !== null ? addDuration(s, ns) : null; // 'duration'
    }

    if (r.startMode === 'unknown') {
      // Starts at some point in the future: drawn from today (or, if the end is already known and sooner, from just before it)
      if (r.endMode === 'duration') { s = todayMs; e = addDuration(s, ns); }
      else if (e !== null) s = Math.min(todayMs, e - DAY_MS);
      else s = todayMs;
    }
    busy.delete(id);
    const out = { s, e, su, eu };
    res.set(id, out);
    return out;
  };
  for (const id of resolved.keys()) get(id);
  return res;
}

/**
 * Puts tasks that follow on from one another directly beneath the task they follow, keeping everything else in the
 * order given. `ids` is the list to arrange (oldest first); `preds` maps id -> ids it has to wait for. A task with
 * several predecessors goes beneath the last of them to be placed.
 */
export function stackFollowers(ids, preds) {
  const inSet = new Set(ids);
  const waitsFor = new Map(); const followers = new Map();
  for (const id of ids) {
    waitsFor.set(id, new Set());
    for (const pred of preds.get(id) || []) {
      if (inSet.has(pred) && pred !== id) {
        waitsFor.get(id).add(pred);
        if (!followers.has(pred)) followers.set(pred, []);
        followers.get(pred).push(id);
      }
    }
  }
  const placed = new Set(); const result = [];
  const place = (id) => {
    if (placed.has(id)) return;
    for (const pred of waitsFor.get(id)) if (!placed.has(pred)) return; // not until everything it waits for is down
    placed.add(id); result.push(id);
    for (const follower of followers.get(id) || []) place(follower);
  };
  for (const id of ids) if (!waitsFor.get(id).size) place(id);
  for (const id of ids) if (!placed.has(id)) { placed.add(id); result.push(id); } // only if the data has a loop in it
  return result;
}

/**
 * How a Gantt chart is arranged.
 * @returns {{ order: Map<number, number[]>, resolved: Map, edges: number[][] }}
 *   order     group id (0 = no section) -> its tasks in the order they are drawn
 *   resolved  box id -> resolveTask()
 *   edges     [from, to] pairs: the task that has to finish, and the one that waits for it
 *
 * "When the task before it ends" is settled from the order the tasks would have without any rearranging (order
 * numbers first, then oldest first) and is written as an explicit "after", so rearranging the tasks to put
 * followers beneath what they follow never changes a date.
 */
export function planGantt(structure) {
  const bySection = new Map([[0, []]]);
  for (const group of structure.groups.values()) bySection.set(group.id, []);
  for (const [id, node] of structure.nodes) {
    const groupId = structure.groups.has(node.groupId) ? node.groupId : 0;
    bySection.get(groupId).push(id);
  }
  for (const ids of bySection.values()) sortNodeIds(ids, structure.nodes, 'gantt');

  const sequence = [bySection.get(0), ...[...structure.groups.keys()].map((gid) => bySection.get(gid))];
  const resolved = new Map(); let previousId = null;
  for (const ids of sequence) {
    for (const id of ids) {
      const r = resolveTask(id, structure.nodes.get(id), structure, previousId);
      resolved.set(id, r);
      if (r.kind !== 'vert') previousId = id; // vertical markers don't take a place in the sequence
    }
  }

  const preds = new Map(); const edges = new Map();
  for (const [id, r] of resolved) {
    if (r.kind === 'vert') continue;
    let waitsFor = [];
    if (r.startMode === 'after') waitsFor = r.parents;
    else if (r.startMode === 'previous' && r.previous !== null) waitsFor = [r.previous];
    for (const pred of waitsFor) {
      if (!resolved.has(pred) || resolved.get(pred).kind === 'vert' || pred === id) continue;
      if (!preds.has(id)) preds.set(id, []);
      preds.get(id).push(pred);
      edges.set(`${pred}>${id}`, [pred, id]);
    }
  }

  // Within each section: tasks with an order number stay where that puts them, and the rest are arranged so
  // that a task that follows on from another sits directly beneath it.
  const order = new Map();
  for (const [groupId, ids] of bySection) {
    const fixed = ids.filter((id) => hasExplicitOrder(structure.nodes.get(id), 'gantt'));
    const automatic = ids.filter((id) => !hasExplicitOrder(structure.nodes.get(id), 'gantt'));
    order.set(groupId, [...fixed, ...stackFollowers(automatic, preds)]);
  }
  return { order, resolved, edges: [...edges.values()] };
}

function taskLine(id, node, r, t, today) {
  const ns = r.ns;
  const tokens = [];
  for (const tag of ns.tags) if (['active', 'done', 'crit'].includes(tag)) tokens.push(tag);
  if (r.kind === 'milestone') tokens.push('milestone');
  if (r.kind === 'vert') tokens.push('vert');
  tokens.push('n' + id);

  switch (r.startMode) {
    case 'today': tokens.push(today); break;
    case 'previous': tokens.push('after n' + r.previous); break;
    case 'after': tokens.push('after ' + r.parents.map((p) => 'n' + p).join(' ')); break;
    case 'unknown': tokens.push(msToDay(t.s)); break;
    default: tokens.push(ns.startDate);
  }

  if (r.endMode === 'milestone') tokens.push('0d');
  else if (r.endMode === 'vert') tokens.push('1d');
  else if (t.eu) tokens.push(GANTT_UNKNOWN_END);       // ends at some point in the future: the view decides how long to draw it
  else if (r.endMode === 'date') tokens.push(ns.endDate);
  else if (r.endMode === 'until') tokens.push('until n' + Number(ns.untilNode));
  else tokens.push(ganttDuration(ns));

  return `    ${ganttText(node.caption)} :${tokens.join(', ')}\n`;
}

export function buildGantt(chart, structure, { today, withAxis = false } = {}) {
  let body = headerLines(chart, withAxis);
  const fades = {};
  const clickable = [];
  let edges = [];
  if (!structure.nodes.size) {
    body += `    section Get started\n    Add a task above :milestone, placeholder, ${today}, 0d\n`;
  } else {
    const plan = planGantt(structure);
    const schedule = scheduleTasks(plan.resolved, dayToMs(today));
    edges = plan.edges;
    const emit = (ids) => {
      for (const id of ids) {
        body += taskLine(id, structure.nodes.get(id), plan.resolved.get(id), schedule.get(id), today);
        clickable.push(id);
        const t = schedule.get(id);
        if (plan.resolved.get(id).kind === 'task' && (t.su || t.eu)) fades[id] = { start: !!t.su, end: !!t.eu };
      }
    };
    emit(plan.order.get(0));
    for (const group of structure.groups.values()) {
      if (!(plan.order.get(group.id) || []).length) continue;
      body += `    section ${ganttText(group.name, 'Section')}\n`;
      emit(plan.order.get(group.id));
    }
  }
  return {
    header: 'gantt\n',
    body,
    config: ganttMermaidConfig(chart),
    meta: { ganttFades: fades, ganttDependencies: chartGanttSettings(chart).showDependencies ? edges : [], ganttTasks: clickable, ganttTimeline: ganttTimelineConfig(chart) },
  };
}

/** The options that go to mermaid.initialize(): layout, and the task colours as theme variables. */
export function ganttMermaidConfig(chart) {
  const s = chartGanttSettings(chart);
  const config = { useMaxWidth: false };
  if (s.compact) config.displayMode = 'compact';
  if (s.topAxis) config.topAxis = true;
  for (const name of Object.keys(GANTT_LAYOUT_FIELDS)) {
    if (s.cfg && s.cfg[name] !== undefined && s.cfg[name] !== '') config[name] = Math.trunc(Number(s.cfg[name]));
  }
  const theme = {};
  for (const [key, field] of Object.entries(GANTT_COLOUR_FIELDS)) theme[field[1]] = String(s[key]).toLowerCase();
  return { gantt: config, themeVariables: theme };
}
