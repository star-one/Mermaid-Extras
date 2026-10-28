// What changes when a chart is looked at (or switched to) as a different type. Shown beside the type choice.

export const TYPE_NOTES = {
  flowchart: 'Boxes and connexions are drawn as a flow chart, with groups drawn as boxes around their contents.',
  swimlane: 'Groups become lanes, and boxes are placed in the lane of their group.',
  mindmap: "A mind map only shows each box's first parent connexion (boxes with none hang off the centre), and doesn't use box colours, groups or connexion labels.",
  kanban: "On a Kanban board, groups become columns and boxes become cards. Boxes that aren't in a group aren't shown, and connexions aren't shown.",
  treeview: "A tree view shows each box under its first parent connexion, as an indented folder tree. It doesn't use shapes, colours, groups or connexion labels, so groups aren't shown. Boxes that have something under them are shown as folders.",
  gantt: "On a Gantt chart, groups become sections and boxes become tasks. A box that hasn't been set up as a task yet starts after its parent connexions (or, if it has none, after the task before it) and lasts a day. Boxes not in a group come first, before the sections.",
};

/** The note for changing a chart from one type to another. */
export function typeChangeNote(oldType, newType) {
  if (oldType === newType) return '';
  const notes = ['Nothing will be deleted: the boxes and groups are kept exactly as they are, so you can change back later.', TYPE_NOTES[newType]];
  if (oldType === 'gantt' || oldType === 'treeview') {
    notes.push(`The ${oldType === 'gantt' ? 'Gantt' : 'tree view'} settings (${oldType === 'gantt' ? 'dates, durations, status and the chart options' : 'folders, highlights, descriptions, icons and the chart styling'}) are kept but not shown, and come back if you change back.`);
  }
  return notes.join(' ');
}
