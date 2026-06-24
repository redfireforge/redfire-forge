/** Workflow Designer lessons that teach creating a workflow from the sidebar + New flow. */
export function isWorkflowDesignerLesson(lesson: { initialTab?: string }): boolean {
  return lesson.initialTab === 'workflow';
}
