/**
 * GraphqlAdvancedSettings — Phase 3F
 *
 * Popover for APQ / batch / dedup / complexity-gate connection settings.
 * Opened via a gear button in the connection bar area.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import { GqlBatchSettingsPanel, type GqlBatchSettingsPanelProps } from './GqlBatchSettingsPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  subscriptionTransport: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  sseMode: 'distinct' | 'single';
  wsEndpointOverride: string;
  historyMaxItems: number;
  subscriptionBufferSize: number;
  maxFileSizeMb: number;
}

interface GraphqlAdvancedSettingsProps {
  values: AdvancedSettingsValues;
  /** Commits draft values when the user clicks Save. */
  onSave: (values: AdvancedSettingsValues) => void;
  /** Discards draft and closes (Cancel / Escape). */
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  /** Phase 6G — batch group + tab checklist (when batchEnabled in draft). */
  batchSettings?: GqlBatchSettingsPanelProps | null;
}

type SettingsTab = 'apq' | 'batch' | 'dedup' | 'performance' | 'transport' | 'limits';

const TABS: SettingsTab[] = ['apq', 'batch', 'dedup', 'performance', 'transport', 'limits'];

const TAB_META: Record<SettingsTab, { label: string; subtitle: string }> = {
  apq: {
    label: 'APQ',
    subtitle: 'Persist query hashes to reduce repeat-request payload size.',
  },
  batch: {
    label: 'Batch',
    subtitle: 'Combine multiple operations into one HTTP request.',
  },
  dedup: {
    label: 'Dedup',
    subtitle: 'Collapse duplicate in-flight requests within the active tab.',
  },
  performance: {
    label: 'Performance',
    subtitle: 'Gate expensive queries before they reach the server.',
  },
  transport: {
    label: 'Transport',
    subtitle: 'Subscription protocol and WebSocket endpoint overrides.',
  },
  limits: {
    label: 'Limits',
    subtitle: 'In-memory buffer sizes and upload constraints.',
  },
};

// ─── Layout helpers ───────────────────────────────────────────────────────────

function AdvIntro({ children }: { children: ReactNode }) {
  return <p className="gql-advsettings-intro">{children}</p>;
}

function AdvFormCard({ children }: { children: ReactNode }) {
  return <div className="gql-advsettings-form-card">{children}</div>;
}

function AdvToggleRow({
  checked,
  disabled = false,
  onChange,
  title,
  hint,
  badge,
  ariaLabel,
  testId,
  nested = false,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
  badge?: ReactNode;
  ariaLabel: string;
  testId?: string;
  nested?: boolean;
}) {
  return (
    <label
      className={`gql-advsettings-toggle${nested ? ' gql-advsettings-toggle--nested' : ''}${disabled ? ' gql-advsettings-toggle--disabled' : ''}`}
      data-testid={testId}
    >
      <input
        type="checkbox"
        className="gql-advsettings-toggle__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="gql-advsettings-toggle__box" aria-hidden="true" />
      <span className="gql-advsettings-toggle__content">
        <span className="gql-advsettings-toggle__title">
          {title}
          {badge}
        </span>
        {hint ? <span className="gql-advsettings-toggle__hint">{hint}</span> : null}
      </span>
    </label>
  );
}

function AdvFormRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`gql-advsettings-form-row${className ? ` ${className}` : ''}`}>
      <div className="gql-advsettings-form-row__label-col">
        <span className="gql-advsettings-form-row__label">{label}</span>
        {hint ? <span className="gql-advsettings-form-row__label-hint">{hint}</span> : null}
      </div>
      <div className="gql-advsettings-form-row__ctrl">{children}</div>
    </div>
  );
}

function AdvNote({ children, variant = 'info' }: { children: ReactNode; variant?: 'info' | 'warn' }) {
  return (
    <p className={`gql-advsettings-note gql-advsettings-note--${variant}`} role="note">
      {children}
    </p>
  );
}

function AdvAlert({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="gql-advsettings-alert" role="status">
      <span className="gql-advsettings-alert__text">{children}</span>
      {action}
    </div>
  );
}

function AdvRadioCards({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; title: string; hint: string }[];
}) {
  return (
    <div className="gql-advsettings-radio-cards" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`gql-advsettings-radio-card${value === opt.value ? ' gql-advsettings-radio-card--selected' : ''}`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="gql-advsettings-radio-card__input"
          />
          <span className="gql-advsettings-radio-card__title">{opt.title}</span>
          <span className="gql-advsettings-radio-card__hint">{opt.hint}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphqlAdvancedSettings({
  values,
  onSave,
  onClose,
  anchorRef: _anchorRef,
  open,
  batchSettings = null,
}: GraphqlAdvancedSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('apq');
  const [draft, setDraft] = useState<AdvancedSettingsValues>(values);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { onDragStart, isDragged, modalStyle } = useModalDrag(open);

  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const patchDraft = useCallback((patch: Partial<AdvancedSettingsValues>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft);
  }, [draft, onSave]);

  const handleEscapeClose = useCallback(() => {
    if (open) onClose();
  }, [open, onClose]);

  useModalEscapeClose(handleEscapeClose, { capture: true });

  if (!open) return null;

  const tabMeta = TAB_META[activeTab];

  return (
    <div
      ref={popoverRef}
      className={`gql-advsettings-popover${isDragged ? ' gql-advsettings-popover--dragged' : ''}`}
      style={modalStyle}
      role="dialog"
      aria-label="Advanced query settings"
      data-testid="gql-adv-settings-modal"
    >
      <div
        className="gql-advsettings-header gql-advsettings-header--draggable"
        onMouseDown={onDragStart}
      >
        <div className="gql-advsettings-header__text">
          <span className="gql-advsettings-title">Advanced settings</span>
          <span className="gql-advsettings-subtitle">{tabMeta.subtitle}</span>
        </div>
      </div>

      <div className="gql-advsettings-tabs" role="tablist" aria-label="Settings categories">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`gql-advsettings-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`gql-advsettings-panel-${tab}`}
            className={`gql-advsettings-tab${activeTab === tab ? ' active' : ''}`}
            data-testid={`gql-adv-settings-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_META[tab].label}
          </button>
        ))}
      </div>

      <div
        className="gql-advsettings-body"
        role="tabpanel"
        id={`gql-advsettings-panel-${activeTab}`}
        aria-labelledby={`gql-advsettings-tab-${activeTab}`}
      >
        {activeTab === 'apq' && (
          <div className="gql-advsettings-section">
            <AdvIntro>
              Automatic Persisted Queries (Apollo APQ spec v1) sends only the query hash on repeat
              executions, reducing bandwidth for large documents.
            </AdvIntro>

            <AdvFormCard>
              <AdvToggleRow
                checked={draft.apqEnabled}
                disabled={draft.apqUnsupportedDetected}
                onChange={(apqEnabled) => patchDraft({ apqEnabled })}
                title="Enable APQ"
                hint="Persist query hashes after first run."
                ariaLabel="Enable Automatic Persisted Queries"
                badge={
                  draft.apqUnsupportedDetected ? (
                    <span className="gql-advsettings-badge-warn" title="Server returned non-APQ response">
                      Unsupported
                    </span>
                  ) : undefined
                }
              />

              {draft.apqEnabled && (
                <AdvToggleRow
                  checked={draft.apqUseGet}
                  onChange={(apqUseGet) => patchDraft({ apqUseGet })}
                  title="Use GET for queries"
                  hint="Hash-only GET requests when allowed."
                  ariaLabel="Use GET for query requests"
                  nested
                />
              )}
            </AdvFormCard>

            {draft.apqEnabled && draft.batchEnabled && (
              <AdvNote>APQ is inactive while batch execution is running.</AdvNote>
            )}

            {draft.apqUnsupportedDetected && (
              <AdvAlert
                action={
                  <button
                    type="button"
                    className="gql-advsettings-reset-btn"
                    onClick={() => patchDraft({ apqUnsupportedDetected: false, apqEnabled: true })}
                  >
                    Reset detection
                  </button>
                }
              >
                This server did not accept persisted queries. Reset to try APQ again.
              </AdvAlert>
            )}
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="gql-advsettings-section">
            <AdvNote>
              Configure which operations share one HTTP request. Selection is reflected as
              {' '}<strong>Send Batch (N)</strong> on the connection bar.
            </AdvNote>

            <AdvFormCard>
              <AdvToggleRow
                checked={draft.batchEnabled}
                onChange={(batchEnabled) => patchDraft({ batchEnabled })}
                title="Enable query batching"
                hint="Select tabs by endpoint to include."
                ariaLabel="Enable query batching"
                testId="gql-adv-batch-enable-toggle"
              />
            </AdvFormCard>

            {draft.batchEnabled && batchSettings && (
              <div className="gql-adv-batch-workspace">
                <GqlBatchSettingsPanel {...batchSettings} />
              </div>
            )}

            {draft.batchEnabled && (
              <AdvFormCard>
                <AdvFormRow
                  label="Timeout"
                  hint="Max wait for the batch response."
                >
                  <div className="gql-advsettings-inline-ctrl">
                    <input
                      type="number"
                      min={5000}
                      max={120000}
                      step={1000}
                      value={draft.batchTimeoutMs}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        patchDraft({ batchTimeoutMs: Number.isFinite(n) && n >= 5000 ? n : 30000 });
                      }}
                      className="gql-advsettings-input-sm"
                      aria-label="Batch timeout in milliseconds"
                    />
                    <span className="gql-advsettings-inline-hint">ms</span>
                  </div>
                </AdvFormRow>
              </AdvFormCard>
            )}

            {draft.batchUnsupportedDetected && (
              <AdvAlert
                action={
                  <button
                    type="button"
                    className="gql-advsettings-reset-btn"
                    onClick={() => patchDraft({ batchUnsupportedDetected: false })}
                  >
                    Reset detection
                  </button>
                }
              >
                Server does not support array batching. Operations are sent individually.
              </AdvAlert>
            )}
          </div>
        )}

        {activeTab === 'dedup' && (
          <div className="gql-advsettings-section">
            <AdvIntro>
              Detects when the same query and variables are fired while an identical request is
              still in-flight. Choose to wait and merge, cancel the original, or send anyway.
            </AdvIntro>

            <AdvFormCard>
              <AdvToggleRow
                checked={draft.dedupEnabled}
                onChange={(dedupEnabled) => patchDraft({ dedupEnabled })}
                title="Enable request deduplication"
                hint="Scope is within the active tab only."
                ariaLabel="Enable request deduplication"
              />
            </AdvFormCard>

            <AdvNote variant="warn">
              Cross-tab deduplication is not implemented — each tab tracks its own in-flight set.
            </AdvNote>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="gql-advsettings-section">
            <AdvIntro>
              Block queries that exceed a complexity threshold before sending. The ≈N badge next to
              Execute still warns at half the block threshold.
            </AdvIntro>

            <AdvFormCard>
              <AdvToggleRow
                checked={draft.complexityBlockEnabled}
                onChange={(complexityBlockEnabled) => patchDraft({ complexityBlockEnabled })}
                title="Block high-complexity queries"
                hint="Gate queries above the cost threshold."
                ariaLabel="Enable complexity gate"
              />

              {draft.complexityBlockEnabled && (
                <AdvFormRow label="Block threshold" hint="Estimated cost units before blocking.">
                  <div className="gql-advsettings-inline-ctrl">
                    <input
                      type="number"
                      min={100}
                      max={100000}
                      step={100}
                      value={draft.complexityBlockThreshold}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        patchDraft({
                          complexityBlockThreshold: Number.isFinite(n) && n >= 100 ? n : 1000,
                        });
                      }}
                      className="gql-advsettings-input-sm"
                      aria-label="Complexity block threshold"
                    />
                    <span className="gql-advsettings-inline-hint">cost</span>
                  </div>
                </AdvFormRow>
              )}
            </AdvFormCard>
          </div>
        )}

        {activeTab === 'transport' && (
          <div className="gql-advsettings-section">
            <AdvIntro>
              Control which WebSocket sub-protocol or streaming transport is used for
              subscriptions. Auto lets the server negotiate the best option.
            </AdvIntro>

            <AdvFormCard>
              <AdvFormRow label="Subscription transport" hint="Live subscription protocol.">
                <select
                  value={draft.subscriptionTransport}
                  onChange={(e) =>
                    patchDraft({
                      subscriptionTransport: e.target.value as AdvancedSettingsValues['subscriptionTransport'],
                    })
                  }
                  className="gql-advsettings-select"
                  aria-label="Subscription transport protocol"
                >
                  <option value="auto">Auto (negotiate)</option>
                  <option value="graphql-transport-ws">graphql-transport-ws</option>
                  <option value="graphql-ws">graphql-ws (legacy)</option>
                  <option value="sse">Server-Sent Events</option>
                </select>
              </AdvFormRow>

              {draft.subscriptionTransport === 'sse' && (
                <div className="gql-advsettings-form-row gql-advsettings-form-row--stacked">
                  <div className="gql-advsettings-form-row__label-col">
                    <span className="gql-advsettings-form-row__label">SSE mode</span>
                    <span className="gql-advsettings-form-row__label-hint">
                      How subscriptions share streams.
                    </span>
                  </div>
                  <AdvRadioCards
                    name="sseMode"
                    value={draft.sseMode}
                    onChange={(sseMode) => patchDraft({ sseMode: sseMode as AdvancedSettingsValues['sseMode'] })}
                    options={[
                      {
                        value: 'distinct',
                        title: 'Distinct connection',
                        hint: 'New SSE stream per subscription',
                      },
                      {
                        value: 'single',
                        title: 'Single connection',
                        hint: 'Multiplex over one SSE stream',
                      },
                    ]}
                  />
                </div>
              )}

              <AdvFormRow
                label="WS endpoint override"
                hint="Blank uses main HTTP endpoint."
              >
                <input
                  type="url"
                  value={draft.wsEndpointOverride}
                  placeholder="wss://example.com/graphql"
                  onChange={(e) => patchDraft({ wsEndpointOverride: e.target.value })}
                  className="gql-advsettings-input"
                  aria-label="WebSocket endpoint override"
                />
              </AdvFormRow>
            </AdvFormCard>
          </div>
        )}

        {activeTab === 'limits' && (
          <div className="gql-advsettings-section">
            <AdvIntro>
              Tune in-memory buffer sizes and file upload limits for this connection profile.
            </AdvIntro>

            <AdvFormCard>
              <AdvFormRow label="History buffer" hint="Recent executions kept per tab.">
                <div className="gql-advsettings-inline-ctrl">
                  <input
                    type="number"
                    min={10}
                    max={500}
                    step={10}
                    value={draft.historyMaxItems}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patchDraft({
                        historyMaxItems: Number.isFinite(n) && n >= 10 ? Math.min(n, 500) : 100,
                      });
                    }}
                    className="gql-advsettings-input-sm"
                    aria-label="History buffer size"
                  />
                  <span className="gql-advsettings-inline-hint">10–500</span>
                </div>
              </AdvFormRow>

              <AdvFormRow label="Subscription buffer" hint="Live message ring per subscription.">
                <div className="gql-advsettings-inline-ctrl">
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={draft.subscriptionBufferSize}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patchDraft({
                        subscriptionBufferSize:
                          Number.isFinite(n) && n >= 100 ? Math.min(n, 10000) : 5000,
                      });
                    }}
                    className="gql-advsettings-input-sm"
                    aria-label="Subscription buffer size"
                  />
                  <span className="gql-advsettings-inline-hint">100–10k</span>
                </div>
              </AdvFormRow>

              <AdvFormRow label="Max file size" hint="Upload limit for file variables.">
                <div className="gql-advsettings-inline-ctrl">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={draft.maxFileSizeMb}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patchDraft({
                        maxFileSizeMb: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 50,
                      });
                    }}
                    className="gql-advsettings-input-sm"
                    aria-label="Max file upload size in megabytes"
                  />
                  <span className="gql-advsettings-inline-hint">MB</span>
                </div>
              </AdvFormRow>
            </AdvFormCard>
          </div>
        )}
      </div>

      <div className="gql-advsettings-footer">
        <button
          type="button"
          className="gql-btn gql-btn--secondary gql-advsettings-cancel-btn"
          onClick={onClose}
          data-testid="gql-adv-settings-cancel-btn"
        >
          Cancel
        </button>
        <button
          type="button"
          className="gql-btn gql-btn--primary gql-advsettings-save-btn"
          onClick={handleSave}
          data-testid="gql-adv-settings-save-btn"
        >
          Save
        </button>
      </div>
    </div>
  );
}
