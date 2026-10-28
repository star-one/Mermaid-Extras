// The "new chart" / "edit chart" form, including the Tree view and Gantt options (the less common ones sit in a
// twistout, closed to begin with).

import {
  CHART_TYPES, CHART_TYPE_IDS, DAYS, GANTT_AXIS_PRESETS, GANTT_COLOUR_FIELDS, GANTT_LAYOUT_FIELDS, ICON_PACKS,
  chartGanttSettings, chartTreeviewSettings, cleanGanttSettings, cleanTreeviewSettings,
} from '../../../lib/mermaid-extras.js';

const is = (type) => (values) => values.type === type;

function treeviewFields() {
  return [
    { type: 'heading', text: 'Tree view options', showIf: is('treeview') },
    { name: 'tv.showIcons', type: 'checkbox', label: 'Show the built-in file and folder icons', showIf: is('treeview') },
    {
      type: 'details', label: 'Advanced options', showIf: is('treeview'), fields: [
        { name: 'tv.defaultIconPack', type: 'select', label: 'Icon pack used for icon names without a prefix', options: Object.entries(ICON_PACKS) },
        { name: 'tv.filenameIcons', type: 'textarea', label: 'Icons for particular file names', help: 'One per line, e.g.  Dockerfile = docker' },
        { name: 'tv.extensionIcons', type: 'textarea', label: 'Icons for file extensions', help: 'One per line, e.g.  ts = typescript   (use "none" to hide). Needs an icon pack above, or a pack:name value.' },
        { type: 'heading', text: 'Spacing' },
        {
          type: 'group', fields: [
            { name: 'tv.rowIndent', type: 'number', label: 'Row indent', min: 0, max: 200 },
            { name: 'tv.lineThickness', type: 'number', label: 'Line thickness', min: 1, max: 10 },
            { name: 'tv.paddingX', type: 'number', label: 'Horizontal padding', min: 0, max: 100 },
            { name: 'tv.paddingY', type: 'number', label: 'Vertical padding', min: 0, max: 100 },
          ],
        },
        { type: 'heading', text: 'Colours and text' },
        {
          type: 'group', fields: [
            { name: 'tv.labelFontSize', type: 'number', label: 'Label font size (px)', min: 6, max: 72 },
            { name: 'tv.labelColor', type: 'color', label: 'Label colour' },
            { name: 'tv.lineColor', type: 'color', label: 'Line colour' },
            { name: 'tv.iconColor', type: 'color', label: 'Icon colour' },
            { name: 'tv.descriptionColor', type: 'color', label: 'Description colour' },
            { name: 'tv.highlightStroke', type: 'color', label: 'Highlight border' },
            { name: 'tv.highlightBg', type: 'color', label: 'Highlight fill' },
            { name: 'tv.highlightBgOpacity', type: 'number', label: 'Highlight fill opacity (0-1)', min: 0, max: 1, step: 0.05 },
          ],
        },
      ],
    },
  ];
}

function ganttFields() {
  const show = is('gantt');
  return [
    { type: 'heading', text: 'Gantt chart options', showIf: show },
    { name: 'gt.title', type: 'text', label: 'Title shown above the chart (optional)', maxlength: 100, showIf: show },
    {
      name: 'gt.axisFormat', type: 'select', label: 'Date format along the top', showIf: show,
      options: [...Object.entries(GANTT_AXIS_PRESETS), ['custom', 'Custom format...']],
    },
    {
      name: 'gt.axisFormatCustom', type: 'text', label: 'Custom format', maxlength: 40, showIf: (v) => v.type === 'gantt' && v.gt.axisFormat === 'custom',
      help: 'e.g. %d/%m. Codes: %a %A %b %B %d %e %H %j %m %M %p %U %w %W %y %Y %%. Put a hyphen after the % to drop leading zeros (%-d gives 3, not 03).',
    },
    { name: 'gt.excludeWeekends', type: 'checkbox', label: "Exclude weekends (marked on the chart, and not counted towards a task's duration)", showIf: show },
    { name: 'gt.showDependencies', type: 'checkbox', label: 'Draw arrows between tasks that follow on from one another', showIf: show },
    {
      type: 'details', label: 'Advanced options', showIf: show, fields: [
        { type: 'heading', text: 'Tick marks along the axis' },
        { type: 'note', text: 'Leave the number blank for automatic ticks: days, weeks or months, depending on how far the timeline is zoomed.' },
        {
          type: 'group', fields: [
            { name: 'gt.tickN', type: 'number', label: 'Every', min: 1, max: 100, placeholder: 'auto' },
            { name: 'gt.tickUnit', type: 'select', label: 'Unit', options: [['day', 'day(s)'], ['week', 'week(s)'], ['month', 'month(s)']] },
          ],
        },
        { name: 'gt.weekday', type: 'select', label: 'Week-based ticks start on', options: [...DAYS.slice(1), DAYS[0]].map((d) => [d, d[0].toUpperCase() + d.slice(1) + (d === 'monday' ? ' (default)' : '')]) },
        { type: 'heading', text: "Days that don't count" },
        { name: 'gt.weekend', type: 'select', label: 'The weekend is', options: [['saturday', 'Saturday and Sunday (default)'], ['friday', 'Friday and Saturday']] },
        { name: 'gt.excludeDays', type: 'checks', label: 'Exclude particular days of the week', options: DAYS.map((d) => [d, d[0].toUpperCase() + d.slice(1, 3)]) },
        { name: 'gt.excludeDates', type: 'textarea', label: 'Exclude particular dates', help: 'One per line, as YYYY-MM-DD' },
        { type: 'heading', text: 'Today marker' },
        { name: 'gt.todayMarker', type: 'select', label: 'Today marker', options: [['on', 'Show (default style)'], ['custom', 'Show (custom style)'], ['off', 'Hide']] },
        {
          type: 'group', columns: 3, showIf: (v) => v.type === 'gantt' && v.gt.todayMarker === 'custom', fields: [
            { name: 'gt.todayWidth', type: 'number', label: 'Width (px)', min: 1, max: 20 },
            { name: 'gt.todayColour', type: 'color', label: 'Colour' },
            { name: 'gt.todayOpacity', type: 'number', label: 'Opacity (0-1)', min: 0, max: 1, step: 0.1 },
          ],
        },
        { type: 'heading', text: 'Task colours' },
        {
          type: 'group', fields: Object.entries(GANTT_COLOUR_FIELDS).map(([key, field]) => ({ name: `gt.${key}`, type: 'color', label: field[0] })),
        },
        {
          type: 'button', label: 'Reset the task colours to the defaults',
          onClick: (form) => form.setValues({ gt: Object.fromEntries(Object.entries(GANTT_COLOUR_FIELDS).map(([key, field]) => [key, field[2]])) }),
        },
        { type: 'heading', text: 'Layout' },
        { name: 'gt.compact', type: 'checkbox', label: "Compact mode (show several tasks on the same row where they don't overlap)" },
        { name: 'gt.topAxis', type: 'checkbox', label: 'Also show the dates along the top' },
        { type: 'note', text: "Spacing and sizes: leave blank to use Mermaid's defaults." },
        {
          type: 'group', fields: Object.entries(GANTT_LAYOUT_FIELDS).map(([name, field]) => ({ name: `gt.cfg.${name}`, type: 'number', label: field[0], min: field[1], max: field[2] })),
        },
      ],
    },
  ];
}

/** Form fields for a new chart (chart = null) or for changing an existing one. */
export function chartFormSpec() {
  return [
    { name: 'name', type: 'text', label: 'Chart name', required: true, maxlength: 200 },
    { name: 'type', type: 'select', label: 'Type of chart', options: CHART_TYPE_IDS.map((id) => [id, CHART_TYPES[id].label]) },
    { name: 'direction', type: 'select', label: 'Direction', options: [['TB', 'Top to bottom'], ['LR', 'Left to right']], showIf: (v) => v.type === 'flowchart' || v.type === 'swimlane' },
    ...treeviewFields(),
    ...ganttFields(),
  ];
}

export function chartFormInitial(chart) {
  const base = chart || { name: '', type: 'gantt', direction: 'TB', settings: {} };
  const gt = chartGanttSettings(base);
  return {
    name: base.name, type: base.type, direction: base.direction,
    tv: chartTreeviewSettings(base),
    gt: { ...gt, cfg: { ...(gt.cfg || {}) } },
  };
}

/** The form's values as chart fields, with both option blocks validated by the library. */
export function chartFieldsFromForm(values, existing) {
  const settings = { ...((existing && existing.settings) || {}) };
  settings.treeview = cleanTreeviewSettings(values.tv || {});
  settings.gantt = cleanGanttSettings(values.gt || {});
  return { name: String(values.name || '').trim(), type: values.type, direction: values.direction === 'LR' ? 'LR' : 'TB', settings };
}
