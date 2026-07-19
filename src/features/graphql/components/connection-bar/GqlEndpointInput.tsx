import { useRef, useState } from 'react';

export function GqlEndpointInput({
  endpoint,
  onEndpointChange,
  disabled,
  recentEndpoints,
  onRemoveRecentEndpoint,
  hasEndpointOverride,
  onClearEndpoint,
  endpointHasUnresolved,
  endpointUnresolvedTooltip,
}: {
  endpoint: string;
  onEndpointChange: (url: string) => void;
  disabled: boolean;
  recentEndpoints: string[];
  onRemoveRecentEndpoint?: (url: string) => void;
  hasEndpointOverride: boolean;
  onClearEndpoint?: () => void;
  endpointHasUnresolved: boolean;
  endpointUnresolvedTooltip: string;
}) {
  const [endpointFocused, setEndpointFocused] = useState(false);
  const endpointWrapRef = useRef<HTMLDivElement>(null);
  const showRecent = endpointFocused && recentEndpoints.length > 0;

  return (
    <div className="gql-connection-url-wrap" ref={endpointWrapRef}>
      <input
        type="text"
        className="gql-connection-url gql-input"
        value={endpoint}
        onChange={(e) => onEndpointChange(e.target.value)}
        onFocus={() => setEndpointFocused(true)}
        onBlur={(e) => {
          if (!endpointWrapRef.current?.contains(e.relatedTarget as Node)) {
            setEndpointFocused(false);
          }
        }}
        placeholder="https://api.example.com/graphql"
        spellCheck={false}
        disabled={disabled}
        data-testid="gql-endpoint-input"
        aria-label="GraphQL endpoint URL"
        aria-autocomplete="list"
        aria-expanded={showRecent}
      />

      {hasEndpointOverride && onClearEndpoint && (
        <button
          type="button"
          className="gql-endpoint-reset-btn"
          onClick={onClearEndpoint}
          disabled={disabled}
          data-testid="gql-endpoint-reset-btn"
          title="Reset endpoint to page default for this tab"
          aria-label="Reset endpoint to page default for this tab"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      )}

      {endpointHasUnresolved && (
        <span
          className="gql-endpoint-unresolved-icon"
          title={endpointUnresolvedTooltip}
          aria-label={endpointUnresolvedTooltip}
          data-testid="gql-endpoint-unresolved-icon"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
      )}

      {showRecent && (
        <ul
          className="gql-recent-endpoints"
          role="listbox"
          aria-label="Recent endpoints"
          data-testid="gql-recent-endpoints"
          onMouseDown={(e) => e.preventDefault()}
        >
          {recentEndpoints.map((url) => (
            <li
              key={url}
              className="gql-recent-endpoint-item"
              role="option"
              aria-selected={url === endpoint}
            >
              <button
                type="button"
                className="gql-recent-endpoint-btn"
                onClick={() => {
                  onEndpointChange(url);
                  setEndpointFocused(false);
                }}
                title={url}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="12 8 12 12 14 14" />
                  <path d="M3.05 11a9 9 0 1 0 .5-4.08" />
                  <polyline points="3 3 3 9 9 9" />
                </svg>
                <span className="gql-recent-endpoint-url">{url}</span>
              </button>
              {onRemoveRecentEndpoint && (
                <button
                  type="button"
                  className="gql-recent-endpoint-remove"
                  onClick={() => onRemoveRecentEndpoint(url)}
                  aria-label={`Remove ${url} from recent endpoints`}
                  title="Remove"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
