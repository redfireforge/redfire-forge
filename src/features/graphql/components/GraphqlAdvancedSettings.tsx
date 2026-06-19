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
}

interface GraphqlAdvancedSettingsProps {
  values: AdvancedSettingsValues;
  onChange: (patch: Partial<AdvancedSettingsValues>) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
}

type SettingsTab = 'apq' | 'batch' | 'dedup' | 'performance';

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
        {(['apq', 'batch', 'dedup', 'performance'] as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`gql-advsettings-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'apq' ? 'APQ' : tab === 'batch' ? 'Batch' : tab === 'dedup' ? 'Dedup' : 'Performance'}
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
                    // Guard NaN and values below the configured minimum (100 cost units)
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
      </div>
    </div>
  );
}
