// Defaults, option lists and validation ("cleaning") for the chart-wide settings and the per-box settings of the
// Tree view and Gantt chart types. These are pure functions over plain objects, so they can be used to validate
// form input on a server as well as in the browser.
//
//   cleanTreeviewSettings(input)   -> a complete, valid settings object
//   cleanGanttSettings(input)      -> a complete, valid settings object
//   cleanTreeviewNodeSettings(input)            -> { settings, error }
//   cleanGanttNodeSettings(input, { validIds, selfId }) -> { settings, error }

import { cleanColour, cleanEnum, cleanInt, cleanOrder, DAY_MS, dayToMs, isNumeric, plainLine, truthy, validDate } from './util.js';

// ---------------------------------------------------------------------------------------------------------------
// Tree view
// ---------------------------------------------------------------------------------------------------------------

export const ICON_PACKS = Object.freeze({ '': 'None', 'material-icon-theme': 'Material Icon Theme', logos: 'Logos' });

export function treeviewDefaults() {
  return {
    showIcons: false,
    defaultIconPack: '',
    rowIndent: 10,
    paddingX: 5,
    paddingY: 5,
    lineThickness: 1,
    filenameIcons: '',          // lines of "file name = icon"
    extensionIcons: '',         // lines of "extension = icon"
    labelFontSize: 16,
    labelColor: '#000000',
    lineColor: '#000000',
    iconColor: '#546e7a',
    descriptionColor: '#6a9955',
    highlightBg: '#ffc107',
    highlightBgOpacity: 0.15,
    highlightStroke: '#ffc107',
  };
}

/** "key = value" lines -> normalised text. Lines that aren't valid are dropped. */
export function cleanIconMap(text) {
  const lines = new Map();
  for (const line of String(text ?? '').split(/\r\n|\r|\n/)) {
    const at = line.indexOf('=');
    if (at < 0) continue;
    const key = line.slice(0, at).trim().replace(/^\.+/, '');
    const value = line.slice(at + 1).trim();
    if (/^[A-Za-z0-9._-]+$/.test(key) && /^[A-Za-z0-9:_-]+$/.test(value)) lines.set(key, `${key} = ${value}`);
  }
  return [...lines.values()].join('\n');
}

export function iconMapToObject(text) {
  const map = {};
  for (const line of String(text ?? '').split(/\r\n|\r|\n/)) {
    const at = line.indexOf('=');
    if (at >= 0 && line.slice(0, at).trim() !== '') map[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return map;
}

export function cleanTreeviewSettings(input = {}) {
  const d = treeviewDefaults();
  const opacity = isNumeric(input.highlightBgOpacity) ? Math.max(0, Math.min(1, Number(input.highlightBgOpacity))) : d.highlightBgOpacity;
  return {
    showIcons: truthy(input.showIcons),
    defaultIconPack: cleanEnum(input.defaultIconPack ?? '', Object.keys(ICON_PACKS), ''),
    rowIndent: cleanInt(input.rowIndent, 0, 200, d.rowIndent),
    paddingX: cleanInt(input.paddingX, 0, 100, d.paddingX),
    paddingY: cleanInt(input.paddingY, 0, 100, d.paddingY),
    lineThickness: cleanInt(input.lineThickness, 1, 10, d.lineThickness),
    filenameIcons: cleanIconMap(input.filenameIcons),
    extensionIcons: cleanIconMap(input.extensionIcons),
    labelFontSize: cleanInt(input.labelFontSize, 6, 72, d.labelFontSize),
    labelColor: cleanColour(input.labelColor, d.labelColor),
    lineColor: cleanColour(input.lineColor, d.lineColor),
    iconColor: cleanColour(input.iconColor, d.iconColor),
    descriptionColor: cleanColour(input.descriptionColor, d.descriptionColor),
    highlightBg: cleanColour(input.highlightBg, d.highlightBg),
    highlightBgOpacity: Math.round(opacity * 100) / 100,
    highlightStroke: cleanColour(input.highlightStroke, d.highlightStroke),
  };
}

export function treeviewNodeDefaults() {
  return { isDir: false, highlight: false, description: '', iconMode: 'default', iconCustom: '', order: '' };
}

export function cleanTreeviewNodeSettings(input = {}) {
  const settings = {
    isDir: truthy(input.isDir),
    highlight: truthy(input.highlight),
    description: plainLine(input.description, 200),
    iconMode: cleanEnum(input.iconMode ?? '', ['default', 'none', 'folder', 'file', 'custom'], 'default'),
    iconCustom: /^[A-Za-z0-9:_-]{1,80}$/.test(input.iconCustom ?? '') ? input.iconCustom : '',
    order: cleanOrder(input.order),
  };
  if (settings.iconMode === 'custom' && settings.iconCustom === '') {
    return { settings: null, error: 'Please enter the name of the icon to use (for example material-icon-theme:rust), or choose a different icon option.' };
  }
  return { settings, error: null };
}

// ---------------------------------------------------------------------------------------------------------------
// Gantt chart
// ---------------------------------------------------------------------------------------------------------------

export const DAYS = Object.freeze(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);

/** name -> [label, minimum, maximum]. Left blank, Mermaid's own default is used. */
export const GANTT_LAYOUT_FIELDS = Object.freeze({
  titleTopMargin: ['Title top margin', 0, 200],
  barHeight: ['Bar height', 5, 100],
  barGap: ['Gap between bars', 0, 50],
  topPadding: ['Padding above the chart', 0, 300],
  rightPadding: ['Padding on the right', 0, 500],
  leftPadding: ['Padding on the left (section names)', 0, 500],
  gridLineStartPadding: ['Grid line start padding', 0, 200],
  fontSize: ['Font size', 6, 48],
  sectionFontSize: ['Section font size', 6, 72],
  numberSectionStyles: ['Number of alternating section styles', 1, 10],
  bottomMarginAdj: ['Bottom margin adjustment', 0, 20],
});

export const GANTT_AXIS_PRESETS = Object.freeze({
  '%b %-d': 'Oct 3',
  '%b %-d, %Y': 'Oct 3, 2026',
  '%-d %b': '3 Oct',
  '%a %-d %b': 'Sat 3 Oct',
  '%d/%m': '03/10',
  '%d/%m/%Y': '03/10/2026',
  '%Y-%m-%d': '2026-10-03',
  '%b %Y': 'Oct 2026',
  '%B %Y': 'October 2026',
  '%Y-W%W': '2026-W39 (week number)',
});

/** key -> [label, Mermaid theme variable, default colour]. */
export const GANTT_COLOUR_FIELDS = Object.freeze({
  colNotStartedBg: ['Not started: fill', 'taskBkgColor', '#bfc7ff'],
  colNotStartedBorder: ['Not started: border', 'taskBorderColor', '#534fbc'],
  colActiveBg: ['Active: fill', 'activeTaskBkgColor', '#c3f0c3'],
  colActiveBorder: ['Active: border', 'activeTaskBorderColor', '#4caf50'],
  colDoneBg: ['Done: fill', 'doneTaskBkgColor', '#d3d3d3'],
  colDoneBorder: ['Done: border', 'doneTaskBorderColor', '#808080'],
  colCritBg: ['Critical: fill', 'critBkgColor', '#ff0000'],
  colCritBorder: ['Critical: border', 'critBorderColor', '#ff8888'],
  colTextNotStarted: ['Text on not started tasks', 'taskTextColor', '#000000'],
  colTextOther: ['Text on active, done and critical tasks', 'taskTextDarkColor', '#000000'],
  colTextOutside: ['Text beside a bar', 'taskTextOutsideColor', '#000000'],
});

export function ganttDefaults() {
  const colours = {};
  for (const [key, field] of Object.entries(GANTT_COLOUR_FIELDS)) colours[key] = field[2];
  return {
    title: '',
    axisFormat: '%b %-d',
    axisFormatCustom: '',
    tickN: '',                  // blank = automatic (and changes with the timeline zoom)
    tickUnit: 'week',
    weekday: 'monday',          // the day week-based ticks fall on (Mermaid's own default is Sunday)
    weekend: 'saturday',        // 'saturday' = Saturday and Sunday; 'friday' = Friday and Saturday
    excludeWeekends: false,
    excludeDays: [],
    excludeDates: '',           // one YYYY-MM-DD per line
    todayMarker: 'on',          // 'on', 'off' or 'custom'
    todayWidth: 3,
    todayColour: '#ff0000',
    todayOpacity: 0.5,
    compact: false,
    topAxis: false,
    showDependencies: true,
    cfg: {},                    // layout numbers (see GANTT_LAYOUT_FIELDS); missing = Mermaid's default
    ...colours,
  };
}

export function cleanGanttSettings(input = {}) {
  const d = ganttDefaults();

  const dates = new Set();
  for (const date of String(input.excludeDates ?? '').split(/[\s,;]+/)) if (validDate(date)) dates.add(date);

  const days = [];
  for (const day of (Array.isArray(input.excludeDays) ? input.excludeDays : [])) if (DAYS.includes(day) && !days.includes(day)) days.push(day);

  const cfg = {};
  for (const [name, field] of Object.entries(GANTT_LAYOUT_FIELDS)) {
    const value = input.cfg ? input.cfg[name] : undefined;
    if (isNumeric(value) && value !== '') cfg[name] = cleanInt(value, field[1], field[2], field[1]);
  }

  let axisFormatCustom = String(input.axisFormatCustom ?? '');
  axisFormatCustom = /^[%A-Za-z0-9 /\-:.,_]{1,40}$/.test(axisFormatCustom) ? axisFormatCustom : '';
  let axisFormat = input.axisFormat ?? d.axisFormat;
  if (axisFormat !== 'custom' && !(axisFormat in GANTT_AXIS_PRESETS)) axisFormat = d.axisFormat;
  if (axisFormat === 'custom' && axisFormatCustom === '') axisFormat = d.axisFormat;

  const tickN = (isNumeric(input.tickN) && Math.trunc(Number(input.tickN)) >= 1) ? Math.min(100, Math.trunc(Number(input.tickN))) : '';
  const opacity = isNumeric(input.todayOpacity) ? Math.max(0, Math.min(1, Number(input.todayOpacity))) : d.todayOpacity;

  const colours = {};
  for (const [key, field] of Object.entries(GANTT_COLOUR_FIELDS)) colours[key] = cleanColour(input[key], field[2]);

  return {
    ...colours,
    title: plainLine(input.title, 100),
    axisFormat,
    axisFormatCustom,
    tickN,
    tickUnit: cleanEnum(input.tickUnit ?? '', ['day', 'week', 'month'], 'week'),
    weekday: cleanEnum(input.weekday ?? '', DAYS, 'monday'),
    weekend: cleanEnum(input.weekend ?? '', ['saturday', 'friday'], 'saturday'),
    excludeWeekends: truthy(input.excludeWeekends),
    excludeDays: days,
    excludeDates: [...dates].sort().join('\n'),
    todayMarker: cleanEnum(input.todayMarker ?? '', ['on', 'off', 'custom'], 'on'),
    todayWidth: cleanInt(input.todayWidth, 1, 20, d.todayWidth),
    todayColour: cleanColour(input.todayColour, d.todayColour),
    todayOpacity: Math.round(opacity * 100) / 100,
    compact: truthy(input.compact),
    topAxis: truthy(input.topAxis),
    showDependencies: truthy(input.showDependencies),
    cfg,
  };
}

export function ganttNodeDefaults() {
  return {
    kind: 'task',               // 'task', 'milestone' or 'vert' (a vertical marker)
    tags: [],                   // any of 'active', 'done', 'crit'
    startMode: 'previous',      // 'previous' (when the task before it ends), 'date', 'after' (tasks it follows) or 'unknown'
    startDate: '',
    endMode: 'duration',        // 'duration', 'date', 'until' (another task starts) or 'unknown'
    durValue: 1,
    durUnit: 'd',               // 'd' days, 'w' weeks, 'M' months, 'y' years - nothing shorter than a day
    endDate: '',
    untilNode: 0,
    order: '',
  };
}

/**
 * Validates the Gantt fields of one box.
 * @param input   the submitted values
 * @param context { validIds: ids of the boxes in the same chart, selfId: this box's id (0 when new) }
 */
export function cleanGanttNodeSettings(input = {}, context = {}) {
  const validIds = (context.validIds || []).map(Number);
  const selfId = Number(context.selfId || 0);
  const kind = cleanEnum(input.kind ?? '', ['task', 'milestone', 'vert'], 'task');
  const tags = [];
  for (const tag of (Array.isArray(input.tags) ? input.tags : [])) if (['active', 'done', 'crit'].includes(tag) && !tags.includes(tag)) tags.push(tag);

  let startMode = cleanEnum(input.startMode ?? '', ['previous', 'date', 'after', 'unknown'], 'previous');
  if (kind === 'vert') startMode = 'date';                                   // a vertical marker sits on a date
  if (kind === 'milestone' && startMode === 'unknown') startMode = 'previous'; // a milestone is a single known moment
  const endMode = cleanEnum(input.endMode ?? '', ['duration', 'date', 'until', 'unknown'], 'duration');
  const startDate = validDate(input.startDate) ? input.startDate : '';
  const endDate = validDate(input.endDate) ? input.endDate : '';
  const durValue = isNumeric(input.durValue) ? Number(input.durValue) : 1;
  const untilNode = Math.trunc(Number(input.untilNode || 0)) || 0;

  if (startMode === 'date' && startDate === '') return { settings: null, error: 'Please choose a start date.' };
  if (kind === 'task') {
    if (endMode === 'duration' && durValue < 1) return { settings: null, error: 'The shortest duration is one day.' };
    if (endMode === 'date') {
      if (endDate === '') return { settings: null, error: 'Please choose an end date.' };
      if (startMode === 'date' && dayToMs(endDate) < dayToMs(startDate) + DAY_MS) return { settings: null, error: 'The end date must be at least a day after the start date.' };
    }
    if (endMode === 'until' && (untilNode === selfId || !validIds.includes(untilNode))) return { settings: null, error: 'Please choose the task this one runs until.' };
  }

  return {
    settings: {
      kind, tags, startMode, startDate, endMode,
      durValue: Math.min(3650, durValue),
      durUnit: cleanEnum(input.durUnit ?? '', ['d', 'w', 'M', 'y'], 'd'),
      endDate, untilNode, order: cleanOrder(input.order),
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Reading settings off a chart / box, with defaults filled in
// ---------------------------------------------------------------------------------------------------------------

export function chartTreeviewSettings(chart) {
  return { ...treeviewDefaults(), ...((chart.settings && chart.settings.treeview) || {}) };
}

export function chartGanttSettings(chart) {
  const merged = { ...ganttDefaults(), ...((chart.settings && chart.settings.gantt) || {}) };
  if (!DAYS.includes(merged.weekday)) merged.weekday = 'monday';
  return merged;
}

export function nodeTreeviewSettings(node) {
  return { ...treeviewNodeDefaults(), ...((node.settings && node.settings.treeview) || {}) };
}

export function nodeGanttSettings(node) {
  return { ...ganttNodeDefaults(), ...((node.settings && node.settings.gantt) || {}) };
}

/** Whether a box has been set up for the given type ('treeview' | 'gantt') at all. */
export function nodeHasSettings(node, key) {
  return !!(node.settings && node.settings[key]);
}
