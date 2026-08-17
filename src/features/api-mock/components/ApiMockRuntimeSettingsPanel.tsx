import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { ApiMockServerDefinitionV1, ApiMockServerSettingsV1 } from '../../../shared/api-mock/contracts';
import { HARD_CEILINGS } from '../../../shared/api-mock/defaults';
import { ApiMockRedactHeaderPicker } from './ApiMockRedactHeaderPicker';

interface Props {
  server: ApiMockServerDefinitionV1;
  onSave: (patch: Partial<ApiMockServerDefinitionV1>) => void;
}

const HOST_OPTIONS = [
  { value: '127.0.0.1', label: '127.0.0.1 (loopback)' },
  { value: 'localhost', label: 'localhost' },
  { value: '0.0.0.0', label: '0.0.0.0 (LAN exposed)' },
];

const MULTIPLE_MATCH_OPTIONS: Array<{ value: ApiMockServerSettingsV1['selection']['multipleMatchPolicy']; label: string }> = [
  { value: 'highest_priority', label: 'Choose highest priority' },
  { value: 'reject_multiple', label: 'Reject all multiple matches' },
];

const EQUAL_PRIORITY_OPTIONS: Array<{ value: ApiMockServerSettingsV1['selection']['equalPriorityPolicy']; label: string }> = [
  { value: 'reject', label: 'Reject as ambiguous' },
  { value: 'specificity_then_id', label: 'Specificity, then stable ID' },
];

const FALLBACK_OPTIONS: Array<{ value: ApiMockServerSettingsV1['fallback']['mode']; label: string }> = [
  { value: 'default_response', label: 'Default response (404)' },
  { value: 'closest_match_debug', label: 'Closest match debug' },
  { value: 'proxy', label: 'Proxy to allowlisted upstream' },
];

function FormRow({
  label,
  htmlFor,
  hint,
  hintPlacement = 'below',
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  hintPlacement?: 'below' | 'inline';
  children: ReactNode;
}) {
  const hinted = Boolean(hint);
  const rowClass = [
    'am-rt-stg-row',
    hinted ? 'am-rt-stg-row--hinted' : '',
    hinted && hintPlacement === 'inline' ? 'am-rt-stg-row--inline-hint' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowClass}>
      <div className="am-rt-stg-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : <span>{label}</span>}
      </div>
      <div className="am-rt-stg-control">
        <div className="am-rt-stg-control-main">
          {children}
          {hint && hintPlacement === 'inline' && <div className="am-rt-stg-hint">{hint}</div>}
        </div>
        {hint && hintPlacement === 'below' && <div className="am-rt-stg-hint">{hint}</div>}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  wide,
}: {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`am-rt-stg-card${wide ? ' wide' : ''}`}>
      <header className="am-rt-stg-card-head">
        <h3 className="am-rt-stg-card-title">{title}</h3>
        <p className="am-rt-stg-card-desc">{description}</p>
      </header>
      <div className="am-rt-stg-card-body">{children}</div>
    </section>
  );
}

/**
 * Runtime Settings tab — policy cards for selection, CORS, limits, journal, fallback, LAN.
 */
export function ApiMockRuntimeSettingsPanel({ server, onSave }: Props) {
  const [host, setHost] = useState(server.host);
  const [multipleMatchPolicy, setMultipleMatchPolicy] = useState(server.settings.selection.multipleMatchPolicy);
  const [equalPriorityPolicy, setEqualPriorityPolicy] = useState(server.settings.selection.equalPriorityPolicy);
  const [corsEnabled, setCorsEnabled] = useState(server.settings.cors.enabled);
  const [corsOrigins, setCorsOrigins] = useState(server.settings.cors.allowOrigins.join(', ') || '*');
  const [maxInbound, setMaxInbound] = useState(String(server.settings.limits.maxInboundBodyBytes));
  const [maxConnections, setMaxConnections] = useState(String(server.settings.limits.maxConcurrentConnections));
  const [timeoutHoldMax, setTimeoutHoldMax] = useState(String(server.settings.limits.longRunningMaxMs));
  const [drainMs, setDrainMs] = useState(String(server.settings.limits.gracefulDrainMs));
  const [journalEnabled, setJournalEnabled] = useState(server.settings.journal.enabled);
  const [persistDisk, setPersistDisk] = useState(server.settings.journal.persistToDisk);
  const [journalMax, setJournalMax] = useState(String(server.settings.journal.maxEntries));
  const [redactionHeaders, setRedactionHeaders] = useState(server.settings.redaction.headerNames.join(', '));
  const [redactionPaths, setRedactionPaths] = useState(server.settings.redaction.jsonPaths.join(', '));
  const [fallbackMode, setFallbackMode] = useState(server.settings.fallback.mode);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setHost(server.host);
    setMultipleMatchPolicy(server.settings.selection.multipleMatchPolicy);
    setEqualPriorityPolicy(server.settings.selection.equalPriorityPolicy);
    setCorsEnabled(server.settings.cors.enabled);
    setCorsOrigins(server.settings.cors.allowOrigins.join(', ') || '*');
    setMaxInbound(String(server.settings.limits.maxInboundBodyBytes));
    setMaxConnections(String(server.settings.limits.maxConcurrentConnections));
    setTimeoutHoldMax(String(server.settings.limits.longRunningMaxMs));
    setDrainMs(String(server.settings.limits.gracefulDrainMs));
    setJournalEnabled(server.settings.journal.enabled);
    setPersistDisk(server.settings.journal.persistToDisk);
    setJournalMax(String(server.settings.journal.maxEntries));
    setRedactionHeaders(server.settings.redaction.headerNames.join(', '));
    setRedactionPaths(server.settings.redaction.jsonPaths.join(', '));
    setFallbackMode(server.settings.fallback.mode);
    setDirty(false);
  }, [server]);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  const listenPreview = useMemo(
    () => `http://${host}:${server.port}${server.basePath || ''}`,
    [host, server.port, server.basePath],
  );

  const handleSave = () => {
    onSave({
      host,
      settings: {
        ...server.settings,
        selection: { ...server.settings.selection, multipleMatchPolicy, equalPriorityPolicy },
        fallback: { ...server.settings.fallback, mode: fallbackMode },
        cors: {
          ...server.settings.cors,
          enabled: corsEnabled,
          allowOrigins: corsOrigins.split(',').map(s => s.trim()).filter(Boolean),
        },
        limits: {
          ...server.settings.limits,
          maxInboundBodyBytes: parseInt(maxInbound, 10) || server.settings.limits.maxInboundBodyBytes,
          maxConcurrentConnections: parseInt(maxConnections, 10) || server.settings.limits.maxConcurrentConnections,
          longRunningMaxMs: (() => {
            const n = parseInt(timeoutHoldMax, 10);
            if (!Number.isFinite(n) || n <= 0) return server.settings.limits.longRunningMaxMs;
            return Math.min(n, HARD_CEILINGS.maxLongRunningMs);
          })(),
          gracefulDrainMs: parseInt(drainMs, 10) || server.settings.limits.gracefulDrainMs,
        },
        journal: {
          ...server.settings.journal,
          enabled: journalEnabled,
          persistToDisk: persistDisk,
          maxEntries: parseInt(journalMax, 10) || server.settings.journal.maxEntries,
        },
        redaction: {
          ...server.settings.redaction,
          headerNames: redactionHeaders.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
          jsonPaths: redactionPaths.split(',').map(s => s.trim()).filter(Boolean),
        },
      },
    });
    setDirty(false);
  };

  return (
    <div className="am-runtime-settings" data-testid="api-mock-runtime-settings-panel">
      <div className="am-rt-stg-bar">
        <div className="am-rt-stg-listen">
          <span className="am-rt-stg-listen-label">Listen URL</span>
          <code className="am-rt-stg-listen-value" title={listenPreview}>{listenPreview}</code>
          {host === '0.0.0.0' && <span className="am-badge warning">LAN</span>}
        </div>
        <span className="am-spacer" />
        {dirty && <span className="am-badge warning" data-testid="api-mock-runtime-settings-dirty">Unsaved</span>}
        <button
          type="button"
          className="am-btn primary"
          disabled={!dirty}
          onClick={handleSave}
          data-testid="api-mock-runtime-settings-save"
        >
          Save settings
        </button>
      </div>

      <div className="am-rt-stg-grid">
        <SectionCard
          title="Selection policy"
          description="How the mock chooses a winner when more than one rule matches."
        >
          <FormRow label="Multiple matches">
            <CustomSelect
              value={multipleMatchPolicy}
              onChange={v => mark(setMultipleMatchPolicy)(v as ApiMockServerSettingsV1['selection']['multipleMatchPolicy'])}
              options={MULTIPLE_MATCH_OPTIONS}
              className="am-cs am-cs--fill"
              aria-label="Multiple match policy"
              data-testid="api-mock-runtime-settings-multiple"
            />
          </FormRow>
          <FormRow label="Equal priority">
            <CustomSelect
              value={equalPriorityPolicy}
              onChange={v => mark(setEqualPriorityPolicy)(v as ApiMockServerSettingsV1['selection']['equalPriorityPolicy'])}
              options={EQUAL_PRIORITY_OPTIONS}
              className="am-cs am-cs--fill"
              aria-label="Equal priority policy"
              data-testid="api-mock-runtime-settings-equal"
            />
          </FormRow>
        </SectionCard>

        <SectionCard
          title="CORS"
          description="Browser cross-origin access to this mock server."
        >
          <FormRow label="Enabled">
            <button
              type="button"
              className={`am-toggle${corsEnabled ? ' on' : ''}`}
              role="switch"
              aria-checked={corsEnabled}
              aria-label="Enable CORS"
              data-testid="api-mock-runtime-settings-cors"
              onClick={() => mark(setCorsEnabled)(!corsEnabled)}
            />
          </FormRow>
          <FormRow label="Allow origins" htmlFor="am-rt-cors-origins" hint="Comma-separated origins, or *" hintPlacement="inline">
            <input
              id="am-rt-cors-origins"
              className="am-input am-input--fill mono"
              value={corsOrigins}
              disabled={!corsEnabled}
              onChange={e => mark(setCorsOrigins)(e.target.value)}
              data-testid="api-mock-runtime-settings-cors-origins"
            />
          </FormRow>
        </SectionCard>

        <SectionCard
          title="Limits"
          description="Protect the companion from oversized bodies, hung Timeout faults, and long drains."
        >
          <FormRow label="Inbound body" htmlFor="am-rt-inbound" hint="Bytes · max 10 MiB" hintPlacement="inline">
            <input
              id="am-rt-inbound"
              className="am-input am-input--num mono"
              value={maxInbound}
              onChange={e => mark(setMaxInbound)(e.target.value)}
              data-testid="api-mock-runtime-settings-inbound"
            />
          </FormRow>
          <FormRow label="Connections" htmlFor="am-rt-conn" hint="Max concurrent · 500" hintPlacement="inline">
            <input
              id="am-rt-conn"
              className="am-input am-input--num mono"
              value={maxConnections}
              onChange={e => mark(setMaxConnections)(e.target.value)}
              data-testid="api-mock-runtime-settings-conn"
            />
          </FormRow>
          <FormRow label="Timeout hold max" htmlFor="am-rt-timeout-hold" hint="Milliseconds · default 30s · max 1h" hintPlacement="inline">
            <input
              id="am-rt-timeout-hold"
              className="am-input am-input--num mono"
              type="number"
              min={1}
              max={HARD_CEILINGS.maxLongRunningMs}
              value={timeoutHoldMax}
              onChange={e => mark(setTimeoutHoldMax)(e.target.value)}
              data-testid="api-mock-runtime-settings-timeout-hold"
            />
          </FormRow>
          <FormRow label="Drain timeout" htmlFor="am-rt-drain" hint="Milliseconds · max 30s" hintPlacement="inline">
            <input
              id="am-rt-drain"
              className="am-input am-input--num mono"
              value={drainMs}
              onChange={e => mark(setDrainMs)(e.target.value)}
              data-testid="api-mock-runtime-settings-drain"
            />
          </FormRow>
        </SectionCard>

        <SectionCard
          title="Fallback"
          description="Response strategy when no enabled rule matches."
        >
          <FormRow label="Unmatched">
            <CustomSelect
              value={fallbackMode}
              onChange={v => mark(setFallbackMode)(v as ApiMockServerSettingsV1['fallback']['mode'])}
              options={FALLBACK_OPTIONS}
              className="am-cs am-cs--fill"
              aria-label="Unmatched fallback"
              data-testid="api-mock-runtime-settings-fallback"
            />
          </FormRow>
        </SectionCard>

        <SectionCard
          title="Journal & redaction"
          description="What the Runtime transaction log captures and which secrets are scrubbed."
          wide
        >
          <FormRow label="Journal">
            <button
              type="button"
              className={`am-toggle${journalEnabled ? ' on' : ''}`}
              role="switch"
              aria-checked={journalEnabled}
              aria-label="Enable journal"
              data-testid="api-mock-runtime-settings-journal"
              onClick={() => mark(setJournalEnabled)(!journalEnabled)}
            />
          </FormRow>
          <FormRow label="Max entries" htmlFor="am-rt-journal-max" hint="Oldest entries drop when the cap is reached" hintPlacement="inline">
            <input
              id="am-rt-journal-max"
              className="am-input am-input--num mono"
              value={journalMax}
              disabled={!journalEnabled}
              onChange={e => mark(setJournalMax)(e.target.value)}
              aria-label="Max journal entries"
              data-testid="api-mock-runtime-settings-journal-max"
            />
          </FormRow>
          <FormRow
            label="Persist to disk"
            hint={journalEnabled
              ? 'Capped, redacted snapshot in the OS temp directory — survives companion restart'
              : 'Turn Journal on first — then a capped, redacted snapshot is written under the OS temp directory'}
          >
            <button
              type="button"
              className={`am-toggle${persistDisk ? ' on' : ''}`}
              role="switch"
              aria-checked={persistDisk}
              aria-label="Persist journal to disk"
              data-testid="api-mock-runtime-settings-persist"
              onClick={() => mark(setPersistDisk)(!persistDisk)}
            />
          </FormRow>
          <FormRow
            label="Redact headers"
            htmlFor="am-rt-redact-h"
            hint="Click a name to add or remove it. Type any other header above, comma-separated."
          >
            <div className="am-redact-headers-field">
              <input
                id="am-rt-redact-h"
                className="am-input am-input--fill mono"
                value={redactionHeaders}
                onChange={e => mark(setRedactionHeaders)(e.target.value)}
                data-testid="api-mock-runtime-settings-redact-headers"
              />
              <ApiMockRedactHeaderPicker
                value={redactionHeaders}
                onChange={mark(setRedactionHeaders)}
                testId="api-mock-runtime-settings-redact-header-picker"
              />
            </div>
          </FormRow>
          <FormRow label="Redact paths" htmlFor="am-rt-redact-p" hint="JSONPath expressions in request/response bodies">
            <input
              id="am-rt-redact-p"
              className="am-input am-input--fill mono"
              value={redactionPaths}
              placeholder="$.password, $.secret"
              onChange={e => mark(setRedactionPaths)(e.target.value)}
              data-testid="api-mock-runtime-settings-redact-paths"
            />
          </FormRow>
        </SectionCard>

        <SectionCard
          title="LAN binding"
          description="Interface the companion listens on. Loopback is safest for local work."
          wide
        >
          <FormRow label="Host">
            <CustomSelect
              value={host}
              onChange={v => mark(setHost)(v as ApiMockServerDefinitionV1['host'])}
              options={HOST_OPTIONS}
              className="am-cs am-cs--fill"
              aria-label="Listen host"
              data-testid="api-mock-runtime-settings-host"
            />
          </FormRow>
          {host === '0.0.0.0' && (
            <div className="am-notice warning am-rt-stg-notice">
              <span>
                <strong>0.0.0.0</strong> exposes this mock on your local network. Confirm before Start —
                a LAN badge stays visible while bound.
              </span>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
