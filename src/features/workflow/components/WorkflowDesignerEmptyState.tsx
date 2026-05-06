/** Empty state when no workflow is selected in the designer. */
export default function WorkflowDesignerEmptyState() {
  return (
    <div className="wf-designer">
      <div className="wf-empty-state">
        <div className="wf-empty-icon">⚡</div>
        <h2>Workflow Designer</h2>
        <p>Design multi-step API workflows with variable chaining, conditions, and delays.</p>
        <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Select a workflow from the sidebar, or create a new one.
        </p>
      </div>
    </div>
  );
}
