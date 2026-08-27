import { useMemo, useState } from 'react';
import AppModalFrame from '@shared/components/AppModalFrame';
import { SearchMatchBar } from '@shared/components/SearchMatchBar';
import type { ApiMockHarSourceEntryV1 } from '@shared/api-mock/contracts';
import type { ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import { diffBodies, type DiffItem } from './apiMockHarCompareUtils';

interface Props {
  tx: ApiMockTransactionV1;
  harSource: ApiMockHarSourceEntryV1;
  onClose: () => void;
}

type DiffFilter = 'all' | 'diffs';

function formatBody(body: string | null | undefined): string | undefined {
  if (!body) return undefined;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function statusTone(code: number | undefined): 'success' | 'warning' | 'error' | 'neutral' {
  if (code == null) return 'neutral';
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400 && code < 500) return 'warning';
  if (code >= 500) return 'error';
  return 'neutral';
}

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
  301: 'Moved', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  410: 'Gone', 422: 'Unprocessable', 429: 'Too Many Requests',
  500: 'Server Error', 502: 'Bad Gateway', 503: 'Unavailable', 504: 'Gateway Timeout',
};

function httpStatusText(code: number | undefined): string {
  return code != null ? (HTTP_STATUS_TEXT[code] ?? '') : '';
}

function countDiffs(bodyDiff: DiffItem[]) {
  return {
    mismatchCount: bodyDiff.filter(d => d.status === 'mismatch').length,
    templateCount: bodyDiff.filter(d => d.status === 'template').length,
    onlyOrigCount: bodyDiff.filter(d => d.status === 'only-original').length,
    onlyMockCount: bodyDiff.filter(d => d.status === 'only-mock').length,
    matchCount: bodyDiff.filter(d => d.status === 'match').length,
  };
}

function filterDiffRows(bodyDiff: DiffItem[], query: string, diffFilter: DiffFilter): DiffItem[] {
  const q = query.trim().toLowerCase();
  return bodyDiff.filter(item => {
    if (diffFilter === 'diffs' && item.status === 'match') return false;
    if (!q) return true;
    return item.key.toLowerCase().includes(q)
      || (item.original?.toLowerCase().includes(q) ?? false)
      || (item.mock?.toLowerCase().includes(q) ?? false);
  });
}

function diffIcon(item: DiffItem) {
  switch (item.status) {
    case 'match':       return <span className="am-har-compare-diff-icon is-match"    title="Match">✓</span>;
    case 'mismatch':    return <span className="am-har-compare-diff-icon is-mismatch" title="Mismatch">✗</span>;
    case 'template':    return <span className="am-har-compare-diff-icon is-template" title="Mock uses template">~</span>;
    case 'only-original': return <span className="am-har-compare-diff-icon is-only-orig" title="Only in original HAR">←</span>;
    case 'only-mock':   return <span className="am-har-compare-diff-icon is-only-mock" title="Only in mock">→</span>;
    default: return null;
  }
}

interface StatusPillProps {
  code: number | undefined;
  label: string;
  testId: string;
}

function StatusPill({ code, label, testId }: StatusPillProps) {
  const tone = statusTone(code);
  const text = httpStatusText(code);
  return (
    <div className="am-har-compare-status-side">
      <span className="am-har-compare-status-side-label">{label}</span>
      <span
        className={`am-har-compare-status-pill am-har-compare-status-pill--${tone}`}
        data-testid={testId}
      >
        <span className="am-har-compare-status-code">{code ?? '—'}</span>
        {text && <span className="am-har-compare-status-name">{text}</span>}
      </span>
    </div>
  );
}

export function ApiMockHarCompareModal({ tx, harSource, onClose }: Props) {
  const mockStatus = tx.response?.status;
  const mockBody = tx.response ? formatBody(tx.response.body) : undefined;
  const originalBody = harSource.originalBody;

  const statusMatch = mockStatus === harSource.originalStatus;
  const bodyDiff = useMemo(() => diffBodies(originalBody, mockBody), [originalBody, mockBody]);
  const counts = useMemo(() => countDiffs(bodyDiff), [bodyDiff]);
  const {
    mismatchCount,
    templateCount,
    onlyOrigCount,
    onlyMockCount,
    matchCount,
  } = counts;

  const allBodyMatch = bodyDiff.length > 0
    && mismatchCount === 0
    && templateCount === 0
    && onlyOrigCount === 0
    && onlyMockCount === 0;

  const hasBodyDiffs = mismatchCount > 0 || templateCount > 0 || onlyOrigCount > 0 || onlyMockCount > 0;
  const overallMatch = statusMatch && !hasBodyDiffs;
  const diffTotal = mismatchCount + templateCount + onlyOrigCount + onlyMockCount;

  const method = tx.request.method;
  const path = tx.request.path;

  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [diffFilter, setDiffFilter] = useState<DiffFilter>(hasBodyDiffs ? 'diffs' : 'all');
  const [showFieldBreakdown, setShowFieldBreakdown] = useState(!allBodyMatch);

  const visibleRows = useMemo(
    () => filterDiffRows(bodyDiff, query, diffFilter),
    [bodyDiff, query, diffFilter],
  );

  const searchMatches = visibleRows.length;
  const currentMatch = searchMatches > 0 ? Math.min(matchIndex, searchMatches - 1) : 0;

  const verdictLabel = overallMatch ? 'Full match' : hasBodyDiffs && !statusMatch ? 'Mismatch' : statusMatch ? 'Partial match' : 'Mismatch';
  const verdictClass = overallMatch ? 'match' : statusMatch && !hasBodyDiffs ? 'match' : statusMatch ? 'partial' : 'mismatch';

  const title = (
    <div className="am-har-compare-title-block">
      <span className="am-har-compare-title-text">HAR round-trip comparison</span>
      <span className="am-har-compare-route">
        <span className={`am-method ${method.toLowerCase()}`}>{method}</span>
        <span className="am-har-compare-path">{path}</span>
      </span>
    </div>
  );

  return (
    <AppModalFrame
      title={title}
      onClose={onClose}
      overlayClassName="am-studio-modal-overlay am-har-compare-overlay"
      dialogClassName="modal am-studio-modal am-har-compare-modal"
      bodyClassName="am-studio-modal-body am-har-compare-body-shell"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      closeOnOverlayClick={false}
      closeButtonKind="none"
      dialogTestId="api-mock-har-compare-modal"
      titleId="am-har-compare-title"
      footer={(
        <div className="api-mock-root am-in-modal am-har-compare-footer">
          <span className="am-har-compare-footer-hint">
            Comparing recorded HAR traffic with the mock response for this journal entry.
          </span>
          <span className="am-spacer" />
          <button
            type="button"
            className="am-btn"
            data-testid="api-mock-har-compare-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      )}
      headerActions={(
        <span
          className={`am-har-compare-verdict am-har-compare-verdict--${verdictClass}`}
          data-testid="api-mock-har-compare-overall-verdict"
        >
          {verdictLabel}
        </span>
      )}
    >
      <div className="api-mock-root am-in-modal am-har-compare">

        {/* ── KPI metrics strip ── */}
        <div className="am-har-compare-metrics">
          <div className={`am-har-compare-metric ${statusMatch ? 'is-match' : 'is-mismatch'}`}>
            <span className="am-har-compare-metric-label">Status code</span>
            <span className="am-har-compare-metric-value">
              <span className={`am-har-compare-metric-dot ${statusMatch ? 'is-match' : 'is-mismatch'}`} />
              {statusMatch ? 'Match' : 'Mismatch'}
            </span>
          </div>
          <div className="am-har-compare-metric">
            <span className="am-har-compare-metric-label">Fields compared</span>
            <span className="am-har-compare-metric-value">
              {bodyDiff.length > 0 ? bodyDiff.length : <span className="am-har-compare-metric-em">—</span>}
            </span>
          </div>
          <div className={`am-har-compare-metric ${hasBodyDiffs ? 'is-mismatch' : allBodyMatch ? 'is-match' : ''}`}>
            <span className="am-har-compare-metric-label">Body differences</span>
            <span className="am-har-compare-metric-value">
              {bodyDiff.length === 0
                ? <span className="am-har-compare-metric-em">—</span>
                : hasBodyDiffs
                  ? <><span className={`am-har-compare-metric-dot is-mismatch`} />{diffTotal}</>
                  : <><span className="am-har-compare-metric-dot is-match" />0</>
              }
            </span>
          </div>
        </div>

        {/* ── HTTP status comparison ── */}
        <section className="am-har-compare-panel am-har-compare-panel--status" aria-label="HTTP status comparison">
          <div className="am-har-compare-panel-heading">
            <span className="am-har-compare-panel-heading-icon" aria-hidden="true">⇄</span>
            HTTP status
          </div>
          <div className="am-har-compare-status-compare">
            <StatusPill
              code={harSource.originalStatus}
              label="Original HAR"
              testId="api-mock-har-compare-orig-status"
            />
            <div
              className={`am-har-compare-status-bridge ${statusMatch ? 'match' : 'mismatch'}`}
              data-testid="api-mock-har-compare-status-badge"
              aria-label={statusMatch ? 'Status codes match' : 'Status codes differ'}
            >
              <span className="am-har-compare-bridge-icon">{statusMatch ? '✓' : '✗'}</span>
              <span className="am-har-compare-bridge-label">{statusMatch ? 'Match' : 'Mismatch'}</span>
            </div>
            <StatusPill
              code={mockStatus}
              label="Mock response"
              testId="api-mock-har-compare-mock-status"
            />
          </div>
        </section>

        {/* ── Response body section ── */}
        <section className="am-har-compare-panel am-har-compare-panel--body" aria-label="Response body comparison">
          <div className="am-har-compare-panel-heading">
            <span className="am-har-compare-panel-heading-icon" aria-hidden="true">≋</span>
            Response body
            {bodyDiff.length > 0 && (
              <span className="am-har-compare-panel-sub">
                {matchCount} matching · {hasBodyDiffs ? `${diffTotal} differing` : 'all fields match'}
              </span>
            )}
          </div>

          {bodyDiff.length > 0 && (
            <div className="am-har-compare-toolbar">
              <SearchMatchBar
                value={query}
                onChange={(value) => { setQuery(value); setMatchIndex(0); }}
                currentMatch={currentMatch}
                totalMatches={searchMatches}
                onPrev={() => setMatchIndex(i => (searchMatches > 0 ? (i - 1 + searchMatches) % searchMatches : 0))}
                onNext={() => setMatchIndex(i => (searchMatches > 0 ? (i + 1) % searchMatches : 0))}
                onClear={() => { setQuery(''); setMatchIndex(0); }}
                placeholder="Search fields or values…"
                className="am-har-compare-search"
                inputTestId="api-mock-har-compare-search"
                ariaLabel="Search comparison rows"
              />
              <div className="am-har-compare-toolbar-actions">
                <div className="am-har-compare-filter" role="group" aria-label="Row filter">
                  <button
                    type="button"
                    className={`am-har-compare-filter-btn ${diffFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => setDiffFilter('all')}
                    data-testid="api-mock-har-compare-filter-all"
                  >
                    All fields
                  </button>
                  <button
                    type="button"
                    className={`am-har-compare-filter-btn ${diffFilter === 'diffs' ? 'is-active' : ''}`}
                    onClick={() => setDiffFilter('diffs')}
                    data-testid="api-mock-har-compare-filter-diffs"
                  >
                    Differences only
                  </button>
                </div>
              </div>
            </div>
          )}

          {bodyDiff.length > 0 && (
            <div className="am-har-compare-legend" aria-label="Diff legend">
              <span className="am-har-compare-legend-item">
                <span className="am-har-compare-diff-icon is-match">✓</span> Match
              </span>
              <span className="am-har-compare-legend-item">
                <span className="am-har-compare-diff-icon is-mismatch">✗</span> Mismatch
              </span>
              <span className="am-har-compare-legend-item">
                <span className="am-har-compare-diff-icon is-template">~</span> Template
              </span>
              <span className="am-har-compare-legend-item">
                <span className="am-har-compare-diff-icon is-only-orig">←</span> HAR only
              </span>
              <span className="am-har-compare-legend-item">
                <span className="am-har-compare-diff-icon is-only-mock">→</span> Mock only
              </span>
            </div>
          )}

          {allBodyMatch && !showFieldBreakdown ? (
            <div className="am-har-compare-success" data-testid="api-mock-har-compare-success">
              <div className="am-har-compare-success-icon" aria-hidden="true">✓</div>
              <div className="am-har-compare-success-copy">
                <strong>Response bodies match</strong>
                <p>All {bodyDiff.length} JSON field{bodyDiff.length !== 1 ? 's' : ''} match the original HAR response.</p>
              </div>
              <button
                type="button"
                className="am-btn small ghost"
                onClick={() => setShowFieldBreakdown(true)}
                data-testid="api-mock-har-compare-show-breakdown"
              >
                Show breakdown
              </button>
            </div>
          ) : bodyDiff.length === 0 ? (
            <div className="am-har-compare-empty" data-testid="api-mock-har-compare-body-empty">
              {(!originalBody && !mockBody) ? 'No body in either response.' : 'Bodies are identical.'}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="am-har-compare-empty" data-testid="api-mock-har-compare-filter-empty">
              No rows match the current filter.
            </div>
          ) : (
            <div className="am-har-compare-table-wrap">
              <div className="am-har-compare-row am-har-compare-row--header">
                <div className="am-har-compare-col am-har-compare-col--label">Field / line</div>
                <div className="am-har-compare-col">Original HAR</div>
                <div className="am-har-compare-col am-har-compare-col--center">Diff</div>
                <div className="am-har-compare-col">Mock response</div>
              </div>
              <div className="am-har-compare-body-rows" data-testid="api-mock-har-compare-body-rows">
                {visibleRows.map((item, index) => (
                  <div
                    key={item.key}
                    className={`am-har-compare-row am-har-compare-row--${item.status} ${index === currentMatch && query.trim() ? 'is-search-focus' : ''}`}
                    data-testid={`api-mock-har-compare-row-${item.status}`}
                  >
                    <div className="am-har-compare-col am-har-compare-col--key">{item.key}</div>
                    <div className="am-har-compare-col am-har-compare-col--original">
                      {item.original !== undefined
                        ? <code>{item.original}</code>
                        : <span className="am-har-compare-absent">—</span>
                      }
                    </div>
                    <div className="am-har-compare-col am-har-compare-col--center">
                      {diffIcon(item)}
                    </div>
                    <div className="am-har-compare-col am-har-compare-col--mock">
                      {item.mock !== undefined
                        ? <code>{item.mock}</code>
                        : <span className="am-har-compare-absent">—</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allBodyMatch && showFieldBreakdown && (
            <div className="am-har-compare-breakdown-toggle">
              <button
                type="button"
                className="am-btn small ghost"
                onClick={() => setShowFieldBreakdown(false)}
                data-testid="api-mock-har-compare-hide-breakdown"
              >
                Hide breakdown
              </button>
            </div>
          )}
        </section>

        {/* ── Summary bar ── */}
        {bodyDiff.length > 0 && (
          <div className="am-har-compare-summary" data-testid="api-mock-har-compare-summary">
            {mismatchCount > 0 && (
              <span className="am-har-compare-summary-item mismatch">
                {mismatchCount} field{mismatchCount !== 1 ? 's' : ''} differ
              </span>
            )}
            {templateCount > 0 && (
              <span className="am-har-compare-summary-item template">
                {templateCount} use{templateCount !== 1 ? '' : 's'} template
              </span>
            )}
            {onlyOrigCount > 0 && (
              <span className="am-har-compare-summary-item only-original">
                {onlyOrigCount} only in HAR
              </span>
            )}
            {onlyMockCount > 0 && (
              <span className="am-har-compare-summary-item only-mock">
                {onlyMockCount} only in mock
              </span>
            )}
            {allBodyMatch && (
              <span className="am-har-compare-summary-item match">Bodies match</span>
            )}
          </div>
        )}

      </div>
    </AppModalFrame>
  );
}
