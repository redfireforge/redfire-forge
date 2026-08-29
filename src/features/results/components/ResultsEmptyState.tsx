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
  // A workflow-filtered dashboard must not send the user to the test runner:
  // running a test there would leave this view just as empty.
  const isWorkflow = runTypeFilter === 'workflow';
  const destination = isWorkflow ? 'workflow-runner' : 'runner';
  const message = isWorkflow ? 'No workflow runs yet' : 'No test runs yet';
  const action = isWorkflow ? 'Run a workflow' : 'Run a test';

  return (
    <div className="results-empty-state" data-testid="results-empty-state">
      <svg
        className="results-empty-state-icon"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
      <p className="results-empty-state-message">{message}</p>
      {onNavigate && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate(destination)}
          data-testid="results-empty-state-cta"
        >
          {action}
        </button>
      )}
    </div>
  );
}
