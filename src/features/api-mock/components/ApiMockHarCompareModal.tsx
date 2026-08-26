import { useEffect } from 'react';
import type { ApiMockHarSourceEntryV1 } from '@shared/api-mock/contracts';
import type { ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import { diffBodies } from './apiMockHarCompareUtils';

interface Props {
  tx: ApiMockTransactionV1;
  harSource: ApiMockHarSourceEntryV1;
  onClose: () => void;
}

export function ApiMockHarCompareModal({ tx, harSource, onClose }: Props) {
  const mockStatus = tx.response?.status;
  const mockBody = tx.response ? formatBody(tx.response.body) : undefined;
  const originalBody = harSource.originalBody;

  const statusMatch = mockStatus === harSource.originalStatus;
  const bodyDiff = diffBodies(originalBody, mockBody);
  const mismatchCount = bodyDiff.filter(d => d.status === 'mismatch').length;
  const templateCount = bodyDiff.filter(d => d.status === 'template').length;
  const onlyOrigCount = bodyDiff.filter(d => d.status === 'only-original').length;
  const onlyMockCount = bodyDiff.filter(d => d.status === 'only-mock').length;

  const method = tx.request.method;
  const path = tx.request.path;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="am-har-compare-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`HAR round-trip comparison — ${method} ${path}`}
      data-testid="api-mock-har-compare-modal"
    >
      <div className="am-har-compare-modal">
        <div className="am-har-compare-header">
          <span className="am-har-compare-title">
            HAR round-trip comparison
            <span className="am-har-compare-route">
              <span className={`am-method ${method.toLowerCase()}`}>{method}</span>
              {' '}{path}
            </span>
          </span>
        </div>

        {/* Status row */}
        <div className="am-har-compare-section">
          <div className="am-har-compare-row am-har-compare-row--header">
            <div className="am-har-compare-col am-har-compare-col--label">Status</div>
            <div className="am-har-compare-col" data-testid="api-mock-har-compare-orig-status">
              {harSource.originalStatus}
            </div>
            <div className={`am-har-compare-col am-har-compare-col--match-badge ${statusMatch ? 'match' : 'mismatch'}`}
              data-testid="api-mock-har-compare-status-badge"
            >
              {statusMatch ? '✓ Match' : '✗ Mismatch'}
            </div>
            <div className="am-har-compare-col" data-testid="api-mock-har-compare-mock-status">
              {mockStatus ?? '—'}
            </div>
          </div>
        </div>

        {/* Body diff */}
        <div className="am-har-compare-section am-har-compare-section--body">
          <div className="am-har-compare-row am-har-compare-row--header">
            <div className="am-har-compare-col am-har-compare-col--label">Field / Line</div>
            <div className="am-har-compare-col">Original HAR</div>
            <div className="am-har-compare-col am-har-compare-col--center">Diff</div>
            <div className="am-har-compare-col">Mock response</div>
          </div>
          {bodyDiff.length === 0 ? (
            <div className="am-har-compare-empty" data-testid="api-mock-har-compare-body-empty">
              {(!originalBody && !mockBody) ? 'No body in either response.' : 'Bodies are identical.'}
            </div>
          ) : (
            <div className="am-har-compare-body-rows" data-testid="api-mock-har-compare-body-rows">
              {bodyDiff.map(item => (
                <div
                  key={item.key}
                  className={`am-har-compare-row am-har-compare-row--${item.status}`}
                  data-testid={`api-mock-har-compare-row-${item.status}`}
                >
                  <div className="am-har-compare-col am-har-compare-col--key">{item.key}</div>
                  <div className="am-har-compare-col am-har-compare-col--original">
                    {item.original !== undefined ? (
                      <code>{item.original}</code>
                    ) : (
                      <span className="am-har-compare-absent">—</span>
                    )}
                  </div>
                  <div className="am-har-compare-col am-har-compare-col--center">
                    {item.status === 'match' && <span className="am-har-compare-match-icon" title="Match">✓</span>}
                    {item.status === 'mismatch' && <span className="am-har-compare-mismatch-icon" title="Mismatch">✗</span>}
                    {item.status === 'template' && <span className="am-har-compare-template-icon" title="Mock uses template">~</span>}
                    {item.status === 'only-original' && <span className="am-har-compare-only-orig-icon" title="Only in original">←</span>}
                    {item.status === 'only-mock' && <span className="am-har-compare-only-mock-icon" title="Only in mock">→</span>}
                  </div>
                  <div className="am-har-compare-col am-har-compare-col--mock">
                    {item.mock !== undefined ? (
                      <code>{item.mock}</code>
                    ) : (
                      <span className="am-har-compare-absent">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
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
                {onlyOrigCount} only in original
              </span>
            )}
            {onlyMockCount > 0 && (
              <span className="am-har-compare-summary-item only-mock">
                {onlyMockCount} only in mock
              </span>
            )}
            {mismatchCount === 0 && templateCount === 0 && onlyOrigCount === 0 && onlyMockCount === 0 && (
              <span className="am-har-compare-summary-item match">Bodies match</span>
            )}
          </div>
        )}

        <div className="am-har-compare-footer">
          <button
            type="button"
            className="am-btn small"
            data-testid="api-mock-har-compare-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBody(body: string | null | undefined): string | undefined {
  if (!body) return undefined;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
