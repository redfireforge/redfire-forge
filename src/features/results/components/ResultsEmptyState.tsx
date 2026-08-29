interface Props {
  /** Which run type the dashboard is filtered to; decides the wording and the destination. */
  runTypeFilter: 'all' | 'test' | 'workflow';
  /** Navigate to a top-level tab. Omitted when the host cannot navigate, which hides the CTA. */
  onNavigate?: (tab: 'runner' | 'workflow-runner') => void;
}

/**
 * Shown on the Results dashboard before anything has been run.
 *
 * The panel already said "No test runs yet" and stopped there, which tells a
 * new user what is missing but not what to do about it. The call to action is
 * the point of this component; the icon is what stops the panel reading as a
 * failed load.
 */
export function ResultsEmptyState({ runTypeFilter, onNavigate }: Props) {
  const isWorkflow = runTypeFilter === 'workflow';
  const destination = isWorkflow ? 'workflow-runner' : 'runner';
  const message = isWorkflow ? 'No workflow runs yet' : 'No test runs yet';
  const subtitle = isWorkflow
    ? 'Run a workflow to see execution results, timings, and node traces here.'
    : 'Run a test to see pass/fail results, response times, and assertion details here.';
  const action = isWorkflow ? 'Run a workflow' : 'Run a test';

  return (
    <div className="results-empty-state" data-testid="results-empty-state">
      <div className="results-empty-state-icon-ring" aria-hidden="true">
        {/* Bar chart icon — matches the "Results" analytics context */}
        <svg
          className="results-empty-state-icon"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6"  y1="20" x2="6"  y2="14" />
          <line x1="2"  y1="20" x2="22" y2="20" />
        </svg>
      </div>
      <p className="results-empty-state-message">{message}</p>
      <p className="results-empty-state-subtitle">{subtitle}</p>
      {onNavigate && (
        <button
          type="button"
          className="btn btn-primary results-empty-state-cta"
          onClick={() => onNavigate(destination)}
          data-testid="results-empty-state-cta"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5,3 19,12 5,21" />
          </svg>
          {action}
        </button>
      )}
    </div>
  );
}
