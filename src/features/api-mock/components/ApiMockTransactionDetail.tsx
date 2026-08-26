import { useEffect, useState } from 'react';
import type { ApiMockHarSourceEntryV1, ApiMockTransactionV1 } from '@shared/api-mock/contracts';
import {
  copyTextToClipboard,
  copyTransactionToClipboard,
  formatJournalRequestPreview,
  formatJournalResponsePreview,
} from '../apiMockJournalActions';
import { CopyIcon } from './ApiMockIcons';
import { httpStatusTone, TX_FLASH_MS } from './apiMockDockHelpers';

type TxFlash = 'copied' | 'saved' | 'created' | null;

export function ApiMockTransactionDetail({
  selected,
  routeName,
  onSelectRoute,
  onOpenInRequests,
  onCreateRouteFromTransaction,
  onSaveSampleFromTransaction,
  onCopyTransaction,
  matchedRouteHarSource,
  onCompareHar,
}: {
  selected: ApiMockTransactionV1;
  routeName: (id?: string) => string;
  onSelectRoute?: (routeId: string) => void;
  onOpenInRequests?: (tx: ApiMockTransactionV1) => void;
  onCreateRouteFromTransaction?: (tx: ApiMockTransactionV1) => string | void;
  onSaveSampleFromTransaction?: (tx: ApiMockTransactionV1) => void;
  onCopyTransaction?: (tx: ApiMockTransactionV1) => void;
  matchedRouteHarSource?: ApiMockHarSourceEntryV1;
  onCompareHar?: () => void;
}) {
  const [flash, setFlash] = useState<TxFlash>(null);
  const [copiedPane, setCopiedPane] = useState<'request' | 'response' | null>(null);
  const [createdRouteId, setCreatedRouteId] = useState<string | undefined>();
  const requestPreview = formatJournalRequestPreview(selected.request);
  const responsePreview = formatJournalResponsePreview(selected.response);
  const statusTone = httpStatusTone(selected.response?.status);
  const outcomeTone = selected.outcome === 'matched' ? 'success'
    : selected.outcome === 'ambiguous' ? 'warning'
      : selected.outcome === 'unmatched' ? ''
        : 'danger';

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), TX_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!copiedPane) return;
    const t = window.setTimeout(() => setCopiedPane(null), TX_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [copiedPane]);

  const copyPane = async (pane: 'request' | 'response', text: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) setCopiedPane(pane);
  };

  return (
    <div className="am-tx-detail" data-testid="api-mock-tx-detail">
      <div className="am-tx-match-bar">
        <span className={`am-badge ${outcomeTone}`} data-testid="api-mock-tx-outcome">{selected.outcome}</span>
        {selected.matchedRouteId && (
          onSelectRoute ? (
            <button
              type="button"
              className="am-tx-match-rule am-tx-match-rule-btn"
              data-testid="api-mock-tx-matched-route"
              onClick={() => onSelectRoute(selected.matchedRouteId!)}
            >
              → {routeName(selected.matchedRouteId)}
            </button>
          ) : (
            <span className="am-tx-match-rule">→ {routeName(selected.matchedRouteId)}</span>
          )
        )}
        <span className="am-tx-kv" data-testid="api-mock-tx-detail-duration">Duration: {selected.durationMs != null ? `${selected.durationMs} ms` : '—'}</span>
        <span className="am-tx-kv">gen {selected.generation}</span>
        <span className="am-tx-kv">policy {selected.explanation.policyDecision.policy.replace(/_/g, ' ')}</span>
      </div>
      <div className="am-tx-io" data-testid="api-mock-tx-io">
        <section className="am-tx-io-pane" data-testid="api-mock-tx-request">
          <div className="am-tx-io-head">
            <span>Request</span>
            <button
              type="button"
              className="am-btn ghost small"
              data-testid="api-mock-tx-copy-request"
              onClick={() => void copyPane('request', requestPreview)}
            >
              <CopyIcon size={12} /> {copiedPane === 'request' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="am-code-block">{requestPreview}</pre>
        </section>
        <section className="am-tx-io-pane" data-testid="api-mock-tx-response">
          <div className="am-tx-io-head">
            <span className="am-tx-io-title">
              Response
              {selected.response && (
                <span className={`am-badge ${statusTone}`} data-testid="api-mock-tx-response-status">{selected.response.status}</span>
              )}
            </span>
            {selected.response && (
              <button
                type="button"
                className="am-btn ghost small"
                data-testid="api-mock-tx-copy-response"
                onClick={() => void copyPane('response', responsePreview)}
              >
                <CopyIcon size={12} /> {copiedPane === 'response' ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {selected.response ? (
            <pre className="am-code-block">{responsePreview}</pre>
          ) : (
            <div className="am-tx-io-empty">No response captured</div>
          )}
        </section>
      </div>
      {(selected.explanation.candidates.length > 0 || selected.explanation.nearMisses.length > 0) && (
        <div className="am-tx-meta">
          {selected.explanation.candidates.length > 0 && (
            <div className="am-tx-candidates" data-testid="api-mock-tx-candidates">
              {selected.explanation.candidates.slice(0, 6).map(c => {
                const label = (
                  <>
                    {c.routeName || routeName(c.routeId)}
                    <span className="am-faint"> P{c.priority}</span>
                    {' · '}
                    <span className={c.overallMatch ? 'am-ok' : 'am-muted'}>{c.overallMatch ? 'match' : 'miss'}</span>
                  </>
                );
                return onSelectRoute ? (
                  <button key={c.routeId} type="button" className="am-chip" onClick={() => onSelectRoute(c.routeId)}>
                    {label}
                  </button>
                ) : (
                  <div key={c.routeId} className="am-chip">{label}</div>
                );
              })}
            </div>
          )}
          {selected.explanation.nearMisses.length > 0 && (
            <>
              <div className="am-section-heading">Near misses</div>
              <ul className="am-near-miss-list" data-testid="api-mock-tx-near-misses">
                {selected.explanation.nearMisses.slice(0, 4).map(n => (
                  <li key={n.routeId}>
                    <strong>{n.routeName || routeName(n.routeId)}</strong>
                    {n.failedPredicates.slice(0, 2).map(fp => (
                      <span key={fp.predicateId} className="am-muted"> — {fp.source}: {fp.reason}</span>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {flash === 'created' && (
        <div className="am-notice am-notice--flush am-tx-notice" data-testid="api-mock-tx-notice">
          <span>Draft route created from this transaction. Open it in Studio to review and enable matching.</span>
          {createdRouteId && onSelectRoute && (
            <button type="button" className="am-btn small primary" data-testid="api-mock-tx-open-created" onClick={() => onSelectRoute(createdRouteId)}>
              Open in Studio
            </button>
          )}
        </div>
      )}
      {flash === 'saved' && (
        <div className="am-notice am-notice--flush am-tx-notice" data-testid="api-mock-tx-notice">
          <span>
            {selected.matchedRouteId
              ? 'Example saved on the matched rule.'
              : 'Example saved. Attach it to a rule from Studio → Examples.'}
          </span>
          {selected.matchedRouteId && onSelectRoute && (
            <button type="button" className="am-btn small primary" data-testid="api-mock-tx-view-example" onClick={() => onSelectRoute(selected.matchedRouteId!)}>
              View in Studio
            </button>
          )}
        </div>
      )}

      <div className="am-tx-actions" data-testid="api-mock-tx-actions">
        {matchedRouteHarSource && onCompareHar && (
          <button
            type="button"
            className="am-btn small primary"
            data-testid="api-mock-tx-compare-har"
            onClick={onCompareHar}
          >
            Compare HAR
          </button>
        )}
        {onOpenInRequests && (
          <button type="button" className="am-btn small" data-testid="api-mock-tx-open-requests" onClick={() => onOpenInRequests(selected)}>
            Open in Requests
          </button>
        )}
        {onCreateRouteFromTransaction && (
          <button
            type="button"
            className={`am-btn small${selected.outcome !== 'matched' ? ' primary' : ''}`}
            data-testid="api-mock-tx-create-route"
            onClick={() => {
              const id = onCreateRouteFromTransaction(selected);
              setCreatedRouteId(typeof id === 'string' ? id : undefined);
              setFlash('created');
            }}
          >
            {flash === 'created' ? 'Created' : 'Create route'}
          </button>
        )}
        {onSaveSampleFromTransaction && (
          <button
            type="button"
            className="am-btn small"
            data-testid="api-mock-tx-save-example"
            onClick={() => {
              onSaveSampleFromTransaction(selected);
              setFlash('saved');
            }}
          >
            {flash === 'saved' ? 'Saved' : 'Save as example'}
          </button>
        )}
        <button
          type="button"
          className="am-btn small"
          data-testid="api-mock-tx-copy"
          onClick={() => {
            void copyTransactionToClipboard(selected);
            onCopyTransaction?.(selected);
            setFlash('copied');
          }}
        >
          {flash === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
