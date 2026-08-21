interface ApiMockStudioEmptyStateProps {
  onCreateServer: () => void;
}

export function ApiMockStudioEmptyState({ onCreateServer }: ApiMockStudioEmptyStateProps) {
  return (
    <div className="api-mock-root api-mock-empty" data-testid="api-mock-empty">
      <div className="am-empty-icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <circle cx="7" cy="7" r="0.6" fill="currentColor" />
          <circle cx="7" cy="17" r="0.6" fill="currentColor" />
        </svg>
      </div>
      <h2>API Mock Studio</h2>
      <p>Stand up a local HTTP mock server with rule-based routes, templated responses, and a live request journal.</p>
      <div className="am-empty-actions">
        <button className="am-btn primary" onClick={onCreateServer} data-testid="api-mock-create-first">
          Create Mock Server
        </button>
      </div>
    </div>
  );
}
