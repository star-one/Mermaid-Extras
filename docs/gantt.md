# Gantt charts

Mermaid draws Gantt charts. Mermaid Extras builds the Mermaid source for them from your boxes and groups, and adds what Mermaid does not have: a zoomable timeline, dependency arrows, unknown start and end dates, a way of keeping followers beneath what they follow, and colours you control.

Groups become **sections**; boxes become **tasks**. Tasks that are in no section are drawn first, ahead of the sections.

## A task

Everything specific to a task lives in `node.settings.gantt`. All fields are optional and have defaults.

```js
createNode(chart, {
  caption: 'Build the back end',
  groupId: build.id,
  parents: [{ id: spec.id, label: '' }],          // the tasks it starts after (used when startMode is 'after')
  settings: { gantt: {
    kind: 'task',            // 'task' | 'milestone' | 'vert'
    tags: ['crit'],          // any of 'active', 'done', 'crit'
    startMode: 'after',      // 'previous' | 'after' | 'date' | 'unknown'
    startDate: '',           // YYYY-MM-DD, for startMode 'date'
    endMode: 'duration',     // 'duration' | 'date' | 'until' | 'unknown'
    durValue: 3, durUnit: 'w',   // 'd' days, 'w' weeks, 'M' months, 'y' years
    endDate: '',             // YYYY-MM-DD, for endMode 'date'
    untilNode: 0,            // a task id, for endMode 'until'
    order: '',               // an explicit position within its section, or '' for automatic
  } },
});
```

### What it is

| `kind` | Drawn as |
|---|---|
| `task` | a bar with a start and an end |
| `milestone` | a single moment (written to Mermaid with a length of 0 days) |
| `vert` | a vertical line across the whole chart, on a date. It has no end and is not part of the sequence of tasks. |

`tags` give a task a status colour: `active`, `done` and `crit` (critical). They can be combined.

### When it starts

| `startMode` | Meaning |
|---|---|
| `previous` | when the task before it ends (the default) |
| `after` | after the tasks in `parents` have all ended: it starts after the latest of them |
| `date` | on `startDate` |
| `unknown` | at some unknown point in the future (see below) |

### When it ends

| `endMode` | Meaning |
|---|---|
| `duration` | after `durValue` of `durUnit`. **The shortest duration is one day.** Fractions are allowed (`1.5` weeks). |
| `date` | on `endDate`, which must be at least a day after the start |
| `until` | when the task `untilNode` starts |
| `unknown` | at some unknown point in the future (see below) |

A milestone has no end, a vertical marker has only a date, and neither can have an unknown start.

### A box that was never set up as a task

A box with no `settings.gantt` still draws, so any chart can be viewed as a Gantt chart. It starts after its parents if it has any, otherwise after the task before it, and lasts one day. The very first task with nothing before it starts today.

## Unknown start and end dates

Sometimes the honest answer is "later, and we don't know when". Mermaid has no way to draw that, so Mermaid Extras does it for you.

- **Unknown end.** The bar starts where it should and is drawn for about **a third of the timeline currently on screen**, fading out. Because the length follows the timeline zoom, it stays easy to see however far you zoom out on a long plan.
- **Unknown start.** The bar is drawn from today (or from a day before its end, if that is sooner) and fades in at its start. If the end is a duration, the bar has that length from today.
- **Both unknown.** A band from today, fading at both ends.
- **Things that wait for an unknown end.** A task that starts after (or "when the task before it ends" and that task has an unknown end) cannot know when it starts either, so it is drawn after the faded bar and fades in. The same goes for a task that ends "when another task starts" if that other task's start is unknown.

The fading is a gradient mask applied to the drawn bar, so the bar keeps its own status colour.

## Dependencies

Tasks that follow on from other tasks are connected by arrows. An arrow leaves the end of the task that has to finish, and turns down (or up) onto the start of the one that waits for it. Tasks on the same row are joined by a straight line.

Arrows are drawn for `after` and `previous`. They are not drawn for `until`, or to or from vertical markers. Turn them off with `settings.gantt.showDependencies = false`. `buildDiagram(chart).meta.ganttDependencies` lists the pairs if you want to draw your own.

### Followers sit beneath what they follow

Within a section, a task that follows on from another is placed **directly beneath it**, ahead of unrelated tasks that were added earlier. A task with several predecessors goes beneath the last of them. Giving a task an `order` number takes it out of this: tasks with a number go first, in number order, and are not moved.

Rearranging never changes a date. "When the task before it ends" is settled from the order the tasks would have without any rearranging, and is written to Mermaid as an explicit "after that task".

## The timeline

Mermaid can't zoom a Gantt chart's timeline, but it lets you set how wide the chart is and how often the axis ticks. Mermaid Extras zooms the timeline by drawing the chart again at a different width. (The picture zoom is separate: it only scales the finished picture. See [Zoom and export](zoom-and-export.md).)

- **The default view is 7 weeks:** the week before this one, this week, and the five after. The week starts on the day set by `weekday` (Monday unless changed). If the chart's first task starts later than that, the view starts there instead.
- **Zooming** changes the scale by a factor of 1.5, keeping the middle of what you are looking at in place. `view.timelineShorter()` shows less time (more detail); `view.timelineLonger()` shows more.
- **"Show all"** fits the whole chart across the screen; **`timelineDefault()`** returns to 7 weeks.
- **The ticks change as you zoom:** day ticks when zoomed in (16 pixels a day or more), week ticks in the middle, and month ticks when zoomed out. Week ticks fall on `weekday`.
- **It is remembered** for each chart in the browser (as how many days fit across the screen, so it comes back sensibly on a different-sized screen). The default view is not stored.
- **Section names stay visible** while you scroll along the timeline, in a white box at the left edge.

If you set a tick spacing (`tickN`) or choose your own date format, those are used at every zoom level instead of the automatic ones.

## Chart settings

`chart.settings.gantt`. Every key is optional. Run user input through `cleanGanttSettings()` to get a complete, valid object.

| Key | Default | What it does |
|---|---|---|
| `title` | `''` | A title above the chart. |
| `axisFormat` | `'%b %-d'` | The date format along the axis (Oct 3). A preset from `GANTT_AXIS_PRESETS`, or `'custom'` with `axisFormatCustom`. Uses [d3 time format](https://d3js.org/d3-time-format) codes; `%-d` drops the leading zero. |
| `tickN`, `tickUnit` | `''`, `'week'` | A fixed tick spacing (every `tickN` days, weeks or months). Blank means automatic, which follows the timeline zoom. |
| `weekday` | `'monday'` | The day week-based ticks fall on, and the day the default view's week starts. |
| `weekend` | `'saturday'` | `'saturday'` means Saturday and Sunday; `'friday'` means Friday and Saturday. |
| `excludeWeekends` | `false` | Weekends are marked on the chart and not counted towards a task's duration. |
| `excludeDays` | `[]` | Other days of the week to exclude (`'monday'`...). |
| `excludeDates` | `''` | Particular dates to exclude, one per line, as YYYY-MM-DD. |
| `todayMarker` | `'on'` | `'on'`, `'off'` or `'custom'` (with `todayWidth`, `todayColour`, `todayOpacity`). |
| `compact` | `false` | Show several tasks on one row where they don't overlap. |
| `topAxis` | `false` | Also show the dates along the top. |
| `showDependencies` | `true` | Draw the dependency arrows. |
| `cfg` | `{}` | Layout numbers: `barHeight`, `barGap`, `topPadding`, `leftPadding`, `rightPadding`, `fontSize`, `sectionFontSize`, `numberSectionStyles`, `titleTopMargin`, `gridLineStartPadding`, `bottomMarginAdj`. Left out, Mermaid's own default is used. See `GANTT_LAYOUT_FIELDS` for the allowed ranges. |

### Colours

| Key | Default | Mermaid theme variable |
|---|---|---|
| `colNotStartedBg` / `colNotStartedBorder` | `#bfc7ff` / `#534fbc` | `taskBkgColor` / `taskBorderColor` |
| `colActiveBg` / `colActiveBorder` | `#c3f0c3` / `#4caf50` | `activeTaskBkgColor` / `activeTaskBorderColor` |
| `colDoneBg` / `colDoneBorder` | `#d3d3d3` / `#808080` | `doneTaskBkgColor` / `doneTaskBorderColor` |
| `colCritBg` / `colCritBorder` | `#ff0000` / `#ff8888` | `critBkgColor` / `critBorderColor` |
| `colTextNotStarted` | `#000000` | `taskTextColor` |
| `colTextOther` | `#000000` | `taskTextDarkColor` |
| `colTextOutside` | `#000000` | `taskTextOutsideColor` |

Out of the box, tasks that haven't started are the light lavender that Mermaid uses for active tasks, and active tasks are light green. The colours are applied as Mermaid theme variables, so they are in `buildDiagram(chart).config.themeVariables`.

## Limits worth knowing

- **Dates only.** There are no times of day, so no durations shorter than a day. Dates are always `YYYY-MM-DD`.
- **Excluded days and the placeholders.** Mermaid works out every real date itself, including skipping excluded days. The library's own rough schedule (used only to choose placeholder dates for unknown starts and ends) ignores excluded days, so a placeholder can be a few days off. It never affects a known date.
- **Names.** Mermaid reads `:`, `;` and `#` in a task name as syntax, so they are replaced (`:` becomes ` -`, `;` becomes `,`, `#` is dropped). A name that starts with `call`, `click`, `href`, `gantt`, `topAxis` or `inclusiveEndDates` would be read as a command, so an invisible zero-width space is put in front of it.
- **Loops.** Tasks that depend on each other in a circle are not an error: they are each drawn, and nothing hangs.
