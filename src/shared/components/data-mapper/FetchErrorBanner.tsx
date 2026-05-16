import { useState } from 'react';
import type { FetchErrorDetail } from './types';

interface FetchErrorBannerProps {
  error: FetchErrorDetail;
}

export default function FetchErrorBanner({ error }: FetchErrorBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(error.status || error.headers || error.body);

  return (
    <div className="dm-fetch-error-banner" role="alert">
      <div
        className={`dm-fetch-error-summary${hasDetail ? ' dm-fetch-error-clickable' : ''}`}
        onClick={hasDetail ? () => setExpanded((v) => !v) : undefined}
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyDown={hasDetail ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((v) => !v); } } : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
        aria-label={hasDetail ? 'Toggle error details' : undefined}
      >
        <span className="dm-fetch-error-message">{error.message}</span>
        {hasDetail && (
          <span className="dm-fetch-error-toggle">{expanded ? '▾' : '▸'} Details</span>
        )}
      </div>

      {expanded && hasDetail && (
        <div className="dm-fetch-error-detail">
          {error.status != null && (
            <div className="dm-fetch-error-row">
              <span className="dm-fetch-error-label">Status</span>
              <span className={`dm-fetch-error-status-badge ${error.status >= 500 ? 'status-5xx' : error.status >= 400 ? 'status-4xx' : 'status-ok'}`}>
                {error.status}
              </span>
              <span className="dm-fetch-error-value">{error.statusText ?? ''}</span>
            </div>
          )}
          {error.timing && (
            <div className="dm-fetch-error-row">
              <span className="dm-fetch-error-label">Timing</span>
              <span className="dm-fetch-error-value dm-fetch-error-timing">
                {error.timing.ttfb != null && <><span className="dm-fetch-error-timing-label">TTFB</span> {error.timing.ttfb}ms</>}
                {error.timing.ttfb != null && error.timing.total != null && <span className="dm-fetch-error-timing-sep"> · </span>}
                {error.timing.total != null && <><span className="dm-fetch-error-timing-label">Total</span> {error.timing.total}ms</>}
              </span>
            </div>
          )}
          {error.headers && Object.keys(error.headers).length > 0 && (
            <details className="dm-fetch-error-section">
              <summary className="dm-fetch-error-section-title">
                Response Headers <span className="dm-fetch-error-count">({Object.keys(error.headers).length})</span>
              </summary>
              <div className="dm-fetch-error-headers">
                {Object.entries(error.headers).map(([k, v]) => (
                  <div key={k} className="dm-fetch-error-header-row">
                    <span className="dm-fetch-error-header-key">{k}</span>
                    <span className="dm-fetch-error-header-sep">:</span>{' '}
                    <span className="dm-fetch-error-header-val">{v}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          {error.body && (
            <details className="dm-fetch-error-section" open>
              <summary className="dm-fetch-error-section-title">Response Body</summary>
              <pre
                className="dm-fetch-error-body"
                dangerouslySetInnerHTML={{ __html: highlightJson(formatBody(error.body)) }}
              />
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function formatBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightJson(json: string): string {
  return escapeHtml(json).replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    '<span class="json-hl-key">$1</span>:',
  ).replace(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    (_m, val) => `: <span class="json-hl-str">${val}</span>`,
  ).replace(
    /:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    ': <span class="json-hl-num">$1</span>',
  ).replace(
    /:\s*(true|false|null)/g,
    ': <span class="json-hl-kw">$1</span>',
  );
}
