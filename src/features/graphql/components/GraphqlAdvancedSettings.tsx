/**
 * GraphqlAdvancedSettings — Phase 3F
 *
 * Popover for APQ / batch / dedup / complexity-gate connection settings.
 * Opened via a gear button in the connection bar area.
 *
 * Settings exposed:
 *   APQ tab:          Enable APQ toggle + "Use GET" sub-option
 *   Batch tab:        Enable batch toggle + timeout input + Reset detection
 *   Dedup tab:        Enable dedup toggle
 *   Performance tab:  Complexity gate toggle + block-threshold input
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AdvancedSettingsValues {
  apqEnabled: boolean;
  apqUseGet: boolean;
  apqUnsupportedDetected: boolean;
  batchEnabled: boolean;
  batchTimeoutMs: number;
  batchUnsupportedDetected: boolean;
  dedupEnabled: boolean;
  complexityBlockEnabled: boolean;
  complexityBlockThreshold: number;
  // Phase 2 Deferred — Transport + Limits
  subscriptionTransport: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  sseMode: 'distinct' | 'single';
  wsEndpointOverride: string;
  historyMaxItems: number;
  subscriptionBufferSize: number;
  maxFileSizeMb: number;
}

interface GraphqlAdvancedSettingsProps {
  values: AdvancedSettingsValues;
  onChange: (patch: Partial<AdvancedSettingsValues>) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'apq' | 'batch' | 'dedup' | 'performance' | 'transport' | 'limits';

const TAB_LABELS: Record<SettingsTab, string> = {
  apq: 'APQ',
  batch: 'Batch',
  dedup: 'Dedup',
  performance: 'Performance',
  transport: 'Transport',
  limits: 'Limits',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlAdvancedSettings({
  values,
  onChange,
  anchorRef,
  open,
  onClose,
}: GraphqlAdvancedSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('apq');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        anchorRef.current &&
        !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  const handleEscapeClose = useCallback(() => {
    if (open) onClose();
  }, [open, onClose]);

  useModalEscapeClose(handleEscapeClose, { capture: true });

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      className="gql-advsettings-popover"
      role="dialog"
      aria-label="Advanced query settings"
    >
      <div className="gql-advsettings-header">
        <span className="gql-advsettings-title">Advanced Settings</span>
        <button
          type="button"
          className="gql-advsettings-close"
          onClick={onClose}
          aria-label="Close advanced settings"
        >×</button>
      </div>

      {/* Tab bar */}
      <div className="gql-advsettings-tabs" role="tablist">
        {(['apq', 'batch', 'dedup', 'performance', 'transport', 'limits'] as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`gql-advsettings-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="gql-advsettings-body">
        {/* ── APQ tab ───────────────────────────────────────────────────────── */}
        {activeTab === 'apq' && (
          <div className="gql-advsettings-section">
            <p className="gql-advsettings-desc">
              Automatic Persisted Queries (Apollo APQ spec v1) reduces bandwidth by
              sending only the query hash on repeat executions.
            </p>

            <label className="gql-advsettings-row">
              <input
                type="checkbox"
                checked={values.apqEnabled}
                disabled={values.apqUnsupportedDetected}
                onChange={(e) => onChange({ apqEnabled: e.target.checked })}
                aria-label="Enable Automatic Persisted Queries"
              />
              <span>
                Enable APQ
                {values.apqUnsupportedDetected && (
                  <span className="gql-advsettings-badge-warn" title="Server returned non-APQ response">
                    Unsupported by server
                  </span>
                )}
              </span>
            </label>

            {values.apqEnabled && (
              <label className="gql-advsettings-row gql-advsettings-indent">
                <input
                  type="checkbox"
                  checked={values.apqUseGet}
                  onChange={(e) => onChange({ apqUseGet: e.target.checked })}
                  aria-label="Use GET for query requests"
                />
                <span>
                  Use GET for queries
                  <span className="gql-advsettings-hint">CDN-cacheable hash-only requests</span>
                </span>
              </label>
            )}

            {values.apqEnabled && values.batchEnabled && (
              <p className="gql-advsettings-note">
                APQ is inactive during batch execution.
              </p>
            )}

            {values.apqUnsupportedDetected && (
              <button
                type="button"
                className="gql-advsettings-reset-btn"
                onClick={() => onChange({ apqUnsupportedDetected: false, apqEnabled: true })}
              >
                Reset APQ detection
              </button>
            )}
          </div>
        )}

        {/* ── Batch tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'batch' && (
          <div className="gql-advsettings-section">
            <p className="gql-advsettings-desc">
              Send multiple operations in a single HTTP request. Check the "Batch"
              checkbox on operation tabs, then click "Send Batch (N)".
            </p>

            <label className="gql-advsettings-row">
              <input
                type="checkbox"
                checked={values.batchEnabled}
                onChange={(e) => onChange({ batchEnabled: e.target.checked })}
                aria-label="Enable query batching"
              />
              <span>Enable query batching</span>
            </label>

            {values.batchEnabled && (
              <label className="gql-advsettings-row gql-advsettings-indent">
                <span className="gql-advsettings-label">Timeout</span>
                <input
                  type="number"
                  min={5000}
                  max={120000}
                  step={1000}
                  value={values.batchTimeoutMs}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    onChange({ batchTimeoutMs: Number.isFinite(n) && n >= 5000 ? n : 30000 });
                  }}
                  className="gql-advsettings-input-sm"
                  aria-label="Batch timeout in milliseconds"
                />
                <span className="gql-advsettings-hint">ms</span>
              </label>
            )}

            {values.batchUnsupportedDetected && (
              <div className="gql-advsettings-warn-block">
                <span>Server does not support array batching. Operations are sent individually.</span>
                <button
                  type="button"
                  className="gql-advsettings-reset-btn"
                  onClick={() => onChange({ batchUnsupportedDetected: false })}
                >
                  Reset batch detection
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Dedup tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'dedup' && (
          <div className="gql-advsettings-section">
            <p className="gql-advsettings-desc">
              Detects when the same query + variables is fired while an identical
              request is still in-flight. Offers three choices: wait and merge,
              cancel original, or send anyway.
            </p>

            <label className="gql-advsettings-row">
              <input
                type="checkbox"
                checked={values.dedupEnabled}
                onChange={(e) => onChange({ dedupEnabled: e.target.checked })}
                aria-label="Enable request deduplication"
              />
              <span>Enable request deduplication</span>
            </label>
            <p className="gql-advsettings-note">
              Deduplication scope is within-tab only. Cross-tab dedup is not implemented.
            </p>
          </div>
        )}

        {/* ── Performance tab ───────────────────────────────────────────────── */}
        {activeTab === 'performance' && (
          <div className="gql-advsettings-section">
            <p className="gql-advsettings-desc">
              Block queries that exceed a complexity threshold before sending.
              The existing complexity badge still warns at ½× threshold.
            </p>

            <label className="gql-advsettings-row">
              <input
                type="checkbox"
                checked={values.complexityBlockEnabled}
                onChange={(e) => onChange({ complexityBlockEnabled: e.target.checked })}
                aria-label="Enable complexity gate"
              />
              <span>Block high-complexity queries</span>
            </label>

            {values.complexityBlockEnabled && (
              <label className="gql-advsettings-row gql-advsettings-indent">
                <span className="gql-advsettings-label">Block threshold</span>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={100}
                  value={values.complexityBlockThreshold}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    onChange({ complexityBlockThreshold: Number.isFinite(n) && n >= 100 ? n : 1000 });
                  }}
                  className="gql-advsettings-input-sm"
                  aria-label="Complexity block threshold"
                />
                <span className="gql-advsettings-hint">cost units</span>
              </label>
            )}
          </div>
        )}

        {/* ── Transport tab ─────────────────────────────────────────────────── */}
        {activeTab === 'transport' && (
          <div className="gql-advsettings-section">
            <p className="gql-advsettings-desc">
              Control which WebSocket sub-protocol or streaming transport is used
              for subscriptions. "Auto" lets the server negotiate.
            </p>

            <label className="gql-advsettings-row">
              <span className="gql-advsettings-label">Subscription transport</span>
              <select
                value={values.subscriptionTransport}
                onChange={(e) =>
                  onChange({ subscriptionTransport: e.target.value as AdvancedSettingsValues['subscriptionTransport'] })
                }
                className="gql-advsettings-select"
                aria-label="Subscription transport protocol"
              >
                <option value="auto">Auto (negotiate)</option>
                <option value="graphql-transport-ws">graphql-transport-ws (WS)</option>
                <option value="graphql-ws">graphql-ws (legacy WS)</option>
                <option value="sse">Server-Sent Events (SSE)</option>
              </select>
            </label>

            {values.subscriptionTransport === 'sse' && (
              <fieldset className="gql-advsettings-fieldset">
                <legend className="gql-advsettings-legend">SSE mode</legend>
                <label className="gql-advsettings-row">
                  <input
                    type="radio"
                    name="sseMode"
                    value="distinct"
                    checked={values.sseMode === 'distinct'}
                    onChange={() => onChange({ sseMode: 'distinct' })}
                  />
                  <span>
                    Distinct connection
                    <span className="gql-advsettings-hint">New SSE stream per subscription</span>
                  </span>
                </label>
                <label className="gql-advsettings-row">
                  <input
                    type="radio"
                    name="sseMode"
                    value="single"
                    checked={values.sseMode === 'single'}
                    onChange={() => onChange({ sseMode: 'single' })}
                  />
                  <span>
                    Single connection
                    <span className="gql-advsettings-hint">Multiplex over one SSE stream</span>
                  </span>
                </label>
              </fieldset>
            )}

            <label className="gql-advsettings-row">
              <span className="gql-advsettings-label">WS endpoint override</span>
              <input
                type="url"
                value={values.wsEndpointOverride}
                placeholder="wss://example.com/graphql (leave blank to use main endpoint)"
                onChange={(e) => onChange({ wsEndpointOverride: e.target.value })}
                className="gql-advsettings-input"
                aria-label="WebSocket endpoint override"
              />
            </label>
            <p className="gql-advsettings-note">
              Leave blank to derive the WebSocket URL from the main HTTP endpoint.
            </p>
          </div>
        )}

        {/* ── Limits tab ────────────────────────────────────────────────────── */}
        {activeTab === 'limits' && (
          <div className="gql-advsettings-section">
            <p className="gql-advsettings-desc">
              Tune in-memory buffer sizes and file upload limits.
            </p>

            <label className="gql-advsettings-row">
              <span className="gql-advsettings-label">History buffer</span>
              <input
                type="number"
                min={10}
                max={500}
                step={10}
                value={values.historyMaxItems}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({ historyMaxItems: Number.isFinite(n) && n >= 10 ? Math.min(n, 500) : 100 });
                }}
                className="gql-advsettings-input-sm"
                aria-label="History buffer size"
              />
              <span className="gql-advsettings-hint">items (10–500)</span>
            </label>

            <label className="gql-advsettings-row">
              <span className="gql-advsettings-label">Subscription buffer</span>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={values.subscriptionBufferSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({ subscriptionBufferSize: Number.isFinite(n) && n >= 100 ? Math.min(n, 10000) : 5000 });
                }}
                className="gql-advsettings-input-sm"
                aria-label="Subscription buffer size"
              />
              <span className="gql-advsettings-hint">messages (100–10000)</span>
            </label>

            <label className="gql-advsettings-row">
              <span className="gql-advsettings-label">Max file size</span>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={values.maxFileSizeMb}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange({ maxFileSizeMb: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 50 });
                }}
                className="gql-advsettings-input-sm"
                aria-label="Max file upload size in megabytes"
              />
              <span className="gql-advsettings-hint">MB (1–100)</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
