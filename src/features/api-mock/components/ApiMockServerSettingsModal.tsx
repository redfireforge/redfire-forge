import { useMemo, useState, type ReactNode } from 'react';
import AppModalFrame from '@shared/components/AppModalFrame';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { ApiMockServerDefinitionV1, ApiMockServerSettingsV1 } from '@shared/api-mock/contracts';
import { DEFAULT_PROXY_SETTINGS } from '@shared/api-mock/proxyContracts';
import { DEFAULT_CALLBACK_SETTINGS } from '@shared/api-mock/callbackContracts';
import { HARD_CEILINGS } from '@shared/api-mock/defaults';
import { apiMockControlClient } from '../apiMockControlClient';
import { findPortOwner, formatPortTakenMessage } from '../apiMockPageHelpers';
import { ApiMockRedactHeaderPicker } from './ApiMockRedactHeaderPicker';

interface Props {
  server: ApiMockServerDefinitionV1;
  onSave: (patch: Partial<ApiMockServerDefinitionV1>) => void;
  onClose: () => void;
  statusLabel?: string;
  /** Full saved library (open tabs + parked). Used to refuse a listen port another mock already claims. */
  libraryServers?: Array<{ id: string; name: string; port: number }>;
}

const HOST_OPTIONS = [
  { value: '127.0.0.1', label: '127.0.0.1 (loopback)' },
  { value: 'localhost', label: 'localhost' },
  { value: '0.0.0.0', label: '0.0.0.0 (LAN — exposes to network)' },
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
  { value: 'default_response', label: 'Static fallback body' },
  { value: 'closest_match_debug', label: 'Closest-match debug JSON' },
  { value: 'proxy', label: 'Proxy to allowlisted upstream' },
];

function FormRow({ label, htmlFor, tall, rowClassName, children }: { label: string; htmlFor?: string; tall?: boolean; rowClassName?: string; children: ReactNode }) {
  return (
    <div className={`am-stg-row${tall ? ' am-stg-row--tall' : ''}${rowClassName ? ` ${rowClassName}` : ''}`}>
      <div className="am-stg-row-label">
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
      </div>
      <div className="am-stg-row-ctrl">{children}</div>
    </div>
  );
}

type SettingsTab = 'general' | 'selection' | 'network' | 'journal' | 'proxy' | 'tls';

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string; badge?: string }> = [
  { id: 'general', label: 'General' },
  { id: 'selection', label: 'Selection' },
  { id: 'network', label: 'Network' },
  { id: 'journal', label: 'Journal' },
  { id: 'proxy', label: 'Proxy' },
  { id: 'tls', label: 'TLS' },
];

export function ApiMockServerSettingsModal({ server, onSave, onClose, statusLabel, libraryServers = [] }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [name, setName] = useState(server.name);
  const [host, setHost] = useState<ApiMockServerDefinitionV1['host']>(server.host);
  const [port, setPort] = useState(String(server.port));
  const [basePath, setBasePath] = useState(server.basePath);
  const [multipleMatchPolicy, setMultipleMatchPolicy] = useState(server.settings.selection.multipleMatchPolicy);
  const [equalPriorityPolicy, setEqualPriorityPolicy] = useState(server.settings.selection.equalPriorityPolicy);
  const [ambiguityBody, setAmbiguityBody] = useState(server.settings.selection.ambiguityResponse.body);
  const [corsEnabled, setCorsEnabled] = useState(server.settings.cors.enabled);
  const [corsOrigins, setCorsOrigins] = useState(server.settings.cors.allowOrigins.join(', '));
  const [maxInbound, setMaxInbound] = useState(String(server.settings.limits.maxInboundBodyBytes));
  const [maxConnections, setMaxConnections] = useState(String(server.settings.limits.maxConcurrentConnections));
  const [timeoutHoldMax, setTimeoutHoldMax] = useState(String(server.settings.limits.longRunningMaxMs));
  const [journalEnabled, setJournalEnabled] = useState(server.settings.journal.enabled);
  const [journalMax, setJournalMax] = useState(String(server.settings.journal.maxEntries));
  const [redactionHeaders, setRedactionHeaders] = useState(server.settings.redaction.headerNames.join(', '));
  const [fallbackMode, setFallbackMode] = useState(server.settings.fallback.mode);
  const [tlsEnabled, setTlsEnabled] = useState(server.settings.tls?.enabled ?? false);
  const [tlsCert, setTlsCert] = useState(server.settings.tls?.certPem ?? '');
  const [tlsKey, setTlsKey] = useState(server.settings.tls?.keyPem ?? '');
  const [tlsPassphrase, setTlsPassphrase] = useState(server.settings.tls?.passphrase ?? '');
  const [tlsSelfSigned, setTlsSelfSigned] = useState(server.settings.tls?.selfSigned ?? false);
  const [tlsBusy, setTlsBusy] = useState(false);
  const [tlsError, setTlsError] = useState<string | undefined>();
  const [certCopied, setCertCopied] = useState(false);
  const initialMtls = server.settings.tls?.mtls;
  const [mtlsEnabled, setMtlsEnabled] = useState(initialMtls?.enabled ?? false);
  const [mtlsCaPem, setMtlsCaPem] = useState(initialMtls?.clientCaPem ?? '');
  const [mtlsClientCert, setMtlsClientCert] = useState(initialMtls?.clientCertPem ?? '');
  const [mtlsClientKey, setMtlsClientKey] = useState(initialMtls?.clientKeyPem ?? '');
  const [mtlsCommonName, setMtlsCommonName] = useState(initialMtls?.clientCommonName ?? 'api-mock-client');
  const [mtlsBusy, setMtlsBusy] = useState(false);
  const initialProxy = server.settings.proxy ?? DEFAULT_PROXY_SETTINGS;
  const [proxyEnabled, setProxyEnabled] = useState(initialProxy.enabled);
  const [proxyAllowlist, setProxyAllowlist] = useState(initialProxy.allowlist.join('\n'));
  const [proxyBlockPrivate, setProxyBlockPrivate] = useState(initialProxy.blockPrivateNetworks);
  const [proxyForwardAuth, setProxyForwardAuth] = useState(initialProxy.forwardAuth);
  const [proxyTimeout, setProxyTimeout] = useState(String(initialProxy.timeoutMs));
  const [proxyRecordDrafts, setProxyRecordDrafts] = useState(initialProxy.recordAsDrafts);
  const initialCallbacks = server.settings.callbacks ?? DEFAULT_CALLBACK_SETTINGS;
  const [callbackAllowlist, setCallbackAllowlist] = useState(initialCallbacks.allowlist.join('\n'));

  const portNum = parseInt(port, 10);
  const portValid = Number.isFinite(portNum) && portNum >= 1024 && portNum <= 65535;
  const portOwner = portValid ? findPortOwner(libraryServers, portNum, server.id) : undefined;
  const portTakenMessage = portOwner ? formatPortTakenMessage(portNum, portOwner.name) : undefined;
  const nameValid = name.trim().length > 0;
  const tlsValid = !tlsEnabled || (tlsCert.trim().length > 0 && tlsKey.trim().length > 0);
  const mtlsValid = !tlsEnabled || !mtlsEnabled || mtlsCaPem.trim().length > 0;
  const canSave = portValid && !portOwner && nameValid && tlsValid && mtlsValid;
  const fallbackStatus = server.settings.fallback.unmatchedResponse.status;
  const fallbackCt = server.settings.fallback.unmatchedResponse.contentType ?? 'application/json';
  const isRunning = statusLabel === 'Running';

  const listenPreview = useMemo(() => {
    const path = basePath.trim();
    const normalized = !path ? '' : path.startsWith('/') ? path : `/${path}`;
    const safePort = portValid ? portNum : server.port;
    return `${tlsEnabled ? 'https' : 'http'}://${host}:${safePort}${normalized}`;
  }, [basePath, host, portNum, portValid, server.port, tlsEnabled]);

  const handleGenerateCert = async () => {
    setTlsBusy(true);
    setTlsError(undefined);
    const hosts = [...new Set([host, 'localhost', '127.0.0.1'])];
    const res = await apiMockControlClient.generateSelfSignedTls(hosts);
    if (res.ok) {
      setTlsCert(res.data.certPem);
      setTlsKey(res.data.keyPem);
      setTlsSelfSigned(true);
    } else {
      setTlsError(res.error.message);
    }
    setTlsBusy(false);
  };

  // The certificate is the public half — it is what clients need in order to trust this mock.
  const certFileName = `${server.name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'api-mock'}-cert.pem`;

  const handleCopyCert = () => {
    void navigator.clipboard?.writeText(tlsCert).then(
      () => { setCertCopied(true); setTimeout(() => setCertCopied(false), 1500); },
      () => setTlsError('Could not copy the certificate to the clipboard.'),
    );
  };

  const handleDownloadCert = () => {
    const url = URL.createObjectURL(new Blob([tlsCert], { type: 'application/x-pem-file' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = certFileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const serverSlug = server.name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-') || 'api-mock';

  // mTLS only exists inside a TLS handshake, so it cannot outlive HTTPS.
  const toggleTls = () => setTlsEnabled(prev => {
    if (prev) setMtlsEnabled(false);
    return !prev;
  });

  const downloadPem = (contents: string, suffix: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/x-pem-file' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serverSlug}-${suffix}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateClientCert = async () => {
    setMtlsBusy(true);
    setTlsError(undefined);
    const res = await apiMockControlClient.generateClientCredentials(mtlsCommonName);
    if (res.ok) {
      setMtlsCaPem(res.data.caCertPem);
      setMtlsClientCert(res.data.clientCertPem);
      setMtlsClientKey(res.data.clientKeyPem);
      setMtlsCommonName(res.data.commonName);
      setMtlsEnabled(true);
    } else {
      setTlsError(res.error.message);
    }
    setMtlsBusy(false);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      host,
      port: portNum,
      basePath: basePath.trim(),
      settings: {
        ...server.settings,
        selection: {
          ...server.settings.selection,
          multipleMatchPolicy,
          equalPriorityPolicy,
          ambiguityResponse: { ...server.settings.selection.ambiguityResponse, body: ambiguityBody },
        },
        fallback: { ...server.settings.fallback, mode: fallbackMode },
        tls: {
          enabled: tlsEnabled,
          certPem: tlsCert.trim(),
          keyPem: tlsKey.trim(),
          passphrase: tlsPassphrase || undefined,
          selfSigned: tlsSelfSigned,
          mtls: {
            enabled: mtlsEnabled,
            clientCaPem: mtlsCaPem.trim(),
            clientCertPem: mtlsClientCert.trim() || undefined,
            clientKeyPem: mtlsClientKey.trim() || undefined,
            clientCommonName: mtlsCommonName.trim() || undefined,
          },
        },
        proxy: {
          ...(server.settings.proxy ?? DEFAULT_PROXY_SETTINGS),
          enabled: proxyEnabled,
          allowlist: proxyAllowlist.split('\n').map(s => s.trim()).filter(Boolean),
          blockPrivateNetworks: proxyBlockPrivate,
          forwardAuth: proxyForwardAuth,
          forwardCredentialHeaders: proxyForwardAuth ? ['authorization', 'cookie', 'x-api-key'] : [],
          timeoutMs: parseInt(proxyTimeout, 10) || DEFAULT_PROXY_SETTINGS.timeoutMs,
          recordAsDrafts: proxyRecordDrafts,
        },
        callbacks: {
          ...(server.settings.callbacks ?? DEFAULT_CALLBACK_SETTINGS),
          allowlist: callbackAllowlist.split('\n').map(s => s.trim()).filter(Boolean),
        },
        cors: { ...server.settings.cors, enabled: corsEnabled, allowOrigins: corsOrigins.split(',').map(s => s.trim()).filter(Boolean) },
        limits: {
          ...server.settings.limits,
          maxInboundBodyBytes: parseInt(maxInbound, 10) || server.settings.limits.maxInboundBodyBytes,
          maxConcurrentConnections: parseInt(maxConnections, 10) || server.settings.limits.maxConcurrentConnections,
          longRunningMaxMs: (() => {
            const n = parseInt(timeoutHoldMax, 10);
            if (!Number.isFinite(n) || n <= 0) return server.settings.limits.longRunningMaxMs;
            return Math.min(n, HARD_CEILINGS.maxLongRunningMs);
          })(),
        },
        journal: { ...server.settings.journal, enabled: journalEnabled, maxEntries: parseInt(journalMax, 10) || server.settings.journal.maxEntries },
        redaction: { ...server.settings.redaction, headerNames: redactionHeaders.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) },
      },
    });
    onClose();
  };

  const titleNode = (
    <div className="am-stg-title-row">
      <span className="am-stg-title">{name.trim() || server.name} settings</span>
      {statusLabel && (
        <span className={`am-stg-status${isRunning ? ' running' : ''}`} data-testid="am-stg-status">{statusLabel}</span>
      )}
    </div>
  );

  return (
    <AppModalFrame
      title={titleNode}
      onClose={onClose}
      overlayClassName="modal-overlay am-stg-overlay"
      dialogClassName="modal am-stg-modal"
      bodyClassName="am-stg-body"
      footerClassName="am-stg-footer"
      overlayTestId="api-mock-settings-overlay"
      closeOnOverlayClick={false}
      showExpandButton={false}
      showResizeHandles
      constrainDragToViewport
      minWidth={760}
      minHeight={420}
      footer={
        <div className="api-mock-root am-in-modal am-stg-footer-inner">
          <button className="am-btn" onClick={onClose} data-testid="api-mock-settings-cancel">Cancel</button>
          <button className="am-btn primary" onClick={handleSave} disabled={!canSave} data-testid="api-mock-settings-save">Save settings</button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-stg-content" data-testid="api-mock-settings-modal">
        {/* Listen URL */}
        <div className="am-stg-url-bar">
          <span className="am-stg-url-label">Listen URL</span>
          <code className="am-stg-url-value" title={listenPreview} data-testid="api-mock-settings-listen-url">{listenPreview}</code>
        </div>

        {/* Tabs */}
        <div className="am-stg-shell">
          <nav className="am-stg-sidenav" role="tablist" aria-orientation="vertical" aria-label="Settings sections">
            {SETTINGS_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                className={`am-stg-tab${activeTab === t.id ? ' active' : ''}`}
                aria-selected={activeTab === t.id}
                data-testid={`api-mock-settings-tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
                {t.badge && <span className="am-stg-tab-badge">{t.badge}</span>}
              </button>
            ))}
          </nav>

        {/* Panel */}
        <div className="am-stg-panel">
          {activeTab === 'general' && (
            <div className="am-stg-form" data-testid="api-mock-settings-panel-general">
              <FormRow label="Name" htmlFor="am-settings-name">
                <input id="am-settings-name" className="am-input am-input--fill" value={name} onChange={e => setName(e.target.value)} data-testid="api-mock-settings-name" />
              </FormRow>
              <FormRow label="Host">
                <CustomSelect value={host} onChange={v => setHost(v as ApiMockServerDefinitionV1['host'])} options={HOST_OPTIONS} className="am-cs am-cs--md" aria-label="Server host" data-testid="api-mock-settings-host" />
              </FormRow>
              <FormRow label="Port" htmlFor="am-settings-port">
                <div className="am-stg-inline">
                  <input
                    id="am-settings-port"
                    className="am-input num mono"
                    type="number"
                    min={1024}
                    max={65535}
                    value={port}
                    onChange={e => setPort(e.target.value)}
                    aria-invalid={!portValid || Boolean(portOwner)}
                    aria-describedby={!portValid ? 'am-settings-port-range' : portTakenMessage ? 'am-settings-port-taken' : undefined}
                    data-testid="api-mock-settings-port"
                  />
                  <span className="am-stg-hint">1024–65535</span>
                </div>
                {!portValid && (
                  <span id="am-settings-port-range" className="am-stg-hint am-stg-hint--error">Port must be 1024–65535.</span>
                )}
                {portValid && portTakenMessage && (
                  <span id="am-settings-port-taken" className="am-stg-hint am-stg-hint--error" data-testid="api-mock-settings-port-taken">
                    {portTakenMessage}
                  </span>
                )}
              </FormRow>
              <FormRow label="Base path" htmlFor="am-settings-basepath">
                <input id="am-settings-basepath" className="am-input am-input--md mono" value={basePath} placeholder="/api" onChange={e => setBasePath(e.target.value)} data-testid="api-mock-settings-basepath" />
              </FormRow>
              {host === '0.0.0.0' && (
                <div className="am-stg-warning" data-testid="api-mock-settings-host-warning">Binding to 0.0.0.0 exposes this mock server to your local network.</div>
              )}
            </div>
          )}

          {activeTab === 'selection' && (
            <div className="am-stg-form" data-testid="api-mock-settings-panel-selection">
              <FormRow label="Multiple matches">
                <CustomSelect value={multipleMatchPolicy} onChange={v => setMultipleMatchPolicy(v as ApiMockServerSettingsV1['selection']['multipleMatchPolicy'])} options={MULTIPLE_MATCH_OPTIONS} className="am-cs am-cs--md" aria-label="Multiple match policy" data-testid="api-mock-settings-multiple-match" />
              </FormRow>
              <FormRow label="Equal priority">
                <CustomSelect value={equalPriorityPolicy} onChange={v => setEqualPriorityPolicy(v as ApiMockServerSettingsV1['selection']['equalPriorityPolicy'])} options={EQUAL_PRIORITY_OPTIONS} className="am-cs am-cs--md" aria-label="Equal priority policy" data-testid="api-mock-settings-equal-priority" />
              </FormRow>
              <FormRow label="Ambiguous response" htmlFor="am-settings-ambiguity-body" tall>
                <div className="am-stg-inline" style={{ alignItems: 'flex-start' }}>
                  <span className="am-badge warning" data-testid="api-mock-settings-ambiguity-status">
                    {server.settings.selection.ambiguityResponse.status}
                  </span>
                  <textarea
                    id="am-settings-ambiguity-body"
                    className="am-textarea mono am-textarea--expand"
                    value={ambiguityBody}
                    onChange={e => setAmbiguityBody(e.target.value)}
                    aria-label="Ambiguous response body"
                    data-testid="api-mock-settings-ambiguity-body"
                  />
                </div>
                <span className="am-stg-hint">Returned when two or more rules match and the policy refuses to guess. Placeholders: {'{{requestId}}'}, {'{{competingRuleCount}}'}.</span>
              </FormRow>
              <FormRow label="Unmatched mode">
                <CustomSelect value={fallbackMode} onChange={v => setFallbackMode(v as ApiMockServerSettingsV1['fallback']['mode'])} options={FALLBACK_OPTIONS} className="am-cs am-cs--md" aria-label="Unmatched fallback mode" data-testid="api-mock-settings-fallback-mode" />
                <span className="am-stg-hint">Proxy mode requires an allowlist in the Proxy tab.</span>
              </FormRow>
              <FormRow label="Default response">
                <div className="am-stg-inline">
                  <span className="am-badge warning" data-testid="api-mock-settings-fallback-status">{fallbackStatus}</span>
                  <span className="am-mono am-muted" style={{ fontSize: '0.75rem' }}>{fallbackCt}</span>
                  <span className="am-stg-hint">Static mode only</span>
                </div>
              </FormRow>
            </div>
          )}

          {activeTab === 'network' && (
            <div data-testid="api-mock-settings-panel-network">
              <div className="am-stg-section-label">CORS</div>
              <div className="am-stg-form">
                <FormRow label="Enabled" rowClassName="am-stg-row--network">
                  <button type="button" className={`am-toggle${corsEnabled ? ' on' : ''}`} role="switch" aria-checked={corsEnabled} aria-label="Enable CORS" data-testid="api-mock-settings-cors" onClick={() => setCorsEnabled(v => !v)} />
                </FormRow>
                <FormRow label="Allow origins" htmlFor="am-settings-cors-origins" rowClassName="am-stg-row--network">
                  <input id="am-settings-cors-origins" className="am-input am-input--fill mono" value={corsOrigins} onChange={e => setCorsOrigins(e.target.value)} data-testid="api-mock-settings-cors-origins" disabled={!corsEnabled} />
                </FormRow>
              </div>
              <div className="am-stg-section-label" style={{ marginTop: 18 }}>Limits</div>
              <div className="am-stg-form">
                <FormRow label="Max inbound body" htmlFor="am-settings-max-inbound" rowClassName="am-stg-row--network">
                  <div className="am-stg-inline">
                    <input id="am-settings-max-inbound" className="am-input num mono am-input--num-lg" type="number" value={maxInbound} onChange={e => setMaxInbound(e.target.value)} data-testid="api-mock-settings-max-inbound" />
                    <span className="am-stg-hint">bytes</span>
                  </div>
                </FormRow>
                <FormRow label="Max connections" htmlFor="am-settings-max-conn" rowClassName="am-stg-row--network">
                  <div className="am-stg-inline">
                    <input id="am-settings-max-conn" className="am-input mono am-input--num-sm" type="number" value={maxConnections} onChange={e => setMaxConnections(e.target.value)} data-testid="api-mock-settings-max-conn" />
                  </div>
                </FormRow>
                <FormRow label="Timeout hold max" htmlFor="am-settings-timeout-hold-max" rowClassName="am-stg-row--network">
                  <div className="am-stg-inline">
                    <input
                      id="am-settings-timeout-hold-max"
                      className="am-input num mono am-input--num-lg"
                      type="number"
                      min={1}
                      max={HARD_CEILINGS.maxLongRunningMs}
                      value={timeoutHoldMax}
                      onChange={e => setTimeoutHoldMax(e.target.value)}
                      data-testid="api-mock-settings-timeout-hold-max"
                    />
                    <span className="am-stg-hint">ms · default 30s · max 1h</span>
                  </div>
                </FormRow>
              </div>
            </div>
          )}

          {activeTab === 'journal' && (
            <div className="am-stg-form" data-testid="api-mock-settings-panel-journal">
              <FormRow label="Journal">
                <div className="am-stg-inline">
                  <button type="button" className={`am-toggle${journalEnabled ? ' on' : ''}`} role="switch" aria-checked={journalEnabled} aria-label="Enable journal" data-testid="api-mock-settings-journal" onClick={() => setJournalEnabled(v => !v)} />
                  <input className="am-input num mono" type="number" value={journalMax} onChange={e => setJournalMax(e.target.value)} aria-label="Max journal entries" data-testid="api-mock-settings-journal-max" disabled={!journalEnabled} />
                  <span className="am-stg-hint">max entries</span>
                </div>
              </FormRow>
              <FormRow label="Redact headers" htmlFor="am-settings-redaction" tall>
                <input id="am-settings-redaction" className="am-input am-input--fill mono" value={redactionHeaders} onChange={e => setRedactionHeaders(e.target.value)} data-testid="api-mock-settings-redaction" />
                <ApiMockRedactHeaderPicker
                  value={redactionHeaders}
                  onChange={setRedactionHeaders}
                  testId="api-mock-settings-redact-header-picker"
                />
                <span className="am-stg-hint am-stg-hint--block">Click a name to add or remove it. Type any other header above, comma-separated.</span>
              </FormRow>
            </div>
          )}

          {activeTab === 'proxy' && (
            <div className="am-stg-flex-panel" data-testid="api-mock-settings-panel-proxy">
              <div className="am-stg-section-label">
                Proxy
                {proxyForwardAuth && <span className="am-badge warning" style={{ marginLeft: 8 }} data-testid="api-mock-proxy-cred-badge">Credentials forwarded</span>}
              </div>
              <div className="am-stg-form" data-testid="api-mock-settings-proxy">
                <FormRow label="Enabled" tall>
                  <div className="am-stg-inline">
                    <button type="button" className={`am-toggle${proxyEnabled ? ' on' : ''}`} role="switch" aria-checked={proxyEnabled} aria-label="Enable unmatched proxy" data-testid="api-mock-settings-proxy-enabled" onClick={() => setProxyEnabled(v => !v)} />
                    <span className="am-stg-hint">Active when unmatched mode is Proxy</span>
                  </div>
                  <span className="am-stg-hint am-stg-hint--block" data-testid="api-mock-settings-proxy-deny">
                    Default-deny: unmatched traffic is not forwarded until an origin is allowlisted.
                  </span>
                  <span className="am-stg-hint am-stg-hint--block" data-testid="api-mock-settings-proxy-loop">
                    Loop guard: a proxied hop that comes back to this mock (header <code>X-RedfireForge-Mock</code>) is rejected with <strong>508 Loop Detected</strong> — the HTTP status for "a request looped back on itself." Mocks refuse to proxy themselves.
                  </span>
                </FormRow>
                <FormRow label="Allowlist" tall>
                  <textarea className="am-textarea mono am-textarea--expand" value={proxyAllowlist} onChange={e => setProxyAllowlist(e.target.value)} placeholder={'https://api.example.com\nhttps://staging.example.com:8443'} data-testid="api-mock-settings-proxy-allowlist" />
                  <span className="am-stg-hint am-stg-hint--block">One origin per line (scheme+host[+port]). No wildcards. Tried top to bottom — the next line is used only if a server is unreachable or returns 5xx / 404.</span>
                </FormRow>
                <FormRow label="Block private nets">
                  <div className="am-stg-inline">
                    <button type="button" className={`am-toggle${proxyBlockPrivate ? ' on' : ''}`} role="switch" aria-checked={proxyBlockPrivate} aria-label="Block private-network upstreams" data-testid="api-mock-settings-proxy-private" onClick={() => setProxyBlockPrivate(v => !v)} />
                    <span className="am-stg-hint">On by default — loopback, RFC1918, and link-local are rejected</span>
                  </div>
                </FormRow>
                <FormRow label="Forward auth">
                  <div className="am-stg-inline">
                    <button type="button" className={`am-toggle${proxyForwardAuth ? ' on' : ''}`} role="switch" aria-checked={proxyForwardAuth} aria-label="Forward credential headers" data-testid="api-mock-settings-proxy-forward-auth" onClick={() => setProxyForwardAuth(v => !v)} />
                    <span className="am-stg-hint">Off by default — strips Authorization / Cookie / API keys</span>
                  </div>
                </FormRow>
                <FormRow label="Timeout" htmlFor="am-settings-proxy-timeout">
                  <div className="am-stg-inline">
                    <input id="am-settings-proxy-timeout" className="am-input num mono" type="number" value={proxyTimeout} onChange={e => setProxyTimeout(e.target.value)} data-testid="api-mock-settings-proxy-timeout" />
                    <span className="am-stg-hint">ms</span>
                  </div>
                </FormRow>
                <FormRow label="Record drafts">
                  <div className="am-stg-inline">
                    <button type="button" className={`am-toggle${proxyRecordDrafts ? ' on' : ''}`} role="switch" aria-checked={proxyRecordDrafts} aria-label="Record proxied traffic as inactive drafts" data-testid="api-mock-settings-proxy-record" onClick={() => setProxyRecordDrafts(v => !v)} />
                    <span className="am-stg-hint">Successful proxies become disabled drafts</span>
                  </div>
                </FormRow>
              </div>
              <div className="am-stg-section-label" style={{ marginTop: 18 }}>Callbacks</div>
              <div className="am-stg-form am-stg-form--grow" data-testid="api-mock-settings-callbacks">
                <FormRow label="URL allowlist" tall>
                  <textarea className="am-textarea mono am-textarea--expand" value={callbackAllowlist} onChange={e => setCallbackAllowlist(e.target.value)} placeholder={'https://hooks.example.com/mock-event\nhttps://hooks.example.com/audit'} data-testid="api-mock-settings-callback-allowlist" />
                  <span className="am-stg-hint">Exact absolute URLs only. Empty allowlist blocks every callback.</span>
                </FormRow>
              </div>
            </div>
          )}

          {activeTab === 'tls' && (
            <div className="am-stg-flex-panel" data-testid="api-mock-settings-panel-tls">
              <div className="am-stg-form am-stg-form--grow">
                <FormRow label="HTTPS">
                  <div className="am-stg-inline">
                    <button
                      type="button"
                      className={`am-toggle${tlsEnabled ? ' on' : ''}`}
                      role="switch"
                      aria-checked={tlsEnabled}
                      aria-label="Enable HTTPS"
                      data-testid="api-mock-settings-tls-enabled"
                      onClick={toggleTls}
                    />
                    <span className="am-stg-hint">
                      Serves this mock over TLS. Clients must trust the certificate.
                    </span>
                  </div>
                </FormRow>
                <FormRow label="Certificate" htmlFor="am-settings-tls-cert" tall>
                  <textarea
                    id="am-settings-tls-cert"
                    className="am-textarea am-textarea--expand mono"
                    value={tlsCert}
                    disabled={!tlsEnabled}
                    spellCheck={false}
                    placeholder={'-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----'}
                    onChange={e => setTlsCert(e.target.value)}
                    data-testid="api-mock-settings-tls-cert"
                  />
                  <div className="am-stg-inline">
                    <button
                      type="button"
                      className="am-btn small ghost"
                      disabled={!tlsCert.trim()}
                      onClick={handleCopyCert}
                      data-testid="api-mock-settings-tls-copy-cert"
                    >{certCopied ? 'Copied' : 'Copy certificate'}</button>
                    <button
                      type="button"
                      className="am-btn small ghost"
                      disabled={!tlsCert.trim()}
                      onClick={handleDownloadCert}
                      data-testid="api-mock-settings-tls-download-cert"
                    >Download .pem</button>
                    <span className="am-stg-hint am-stg-hint--block">
                      This is the public half — share it with clients so they can trust this mock.
                    </span>
                  </div>
                </FormRow>
                <FormRow label="Private key" htmlFor="am-settings-tls-key" tall>
                  <textarea
                    id="am-settings-tls-key"
                    className="am-textarea am-textarea--expand mono"
                    value={tlsKey}
                    disabled={!tlsEnabled}
                    spellCheck={false}
                    placeholder={'-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----'}
                    onChange={e => setTlsKey(e.target.value)}
                    data-testid="api-mock-settings-tls-key"
                  />
                  <span className="am-stg-hint">Never share this. Redacted from all exports.</span>
                </FormRow>
                <FormRow label="Passphrase" htmlFor="am-settings-tls-pass">
                  <input
                    id="am-settings-tls-pass"
                    className="am-input am-input--md mono"
                    type="password"
                    value={tlsPassphrase}
                    disabled={!tlsEnabled}
                    placeholder="Optional"
                    onChange={e => setTlsPassphrase(e.target.value)}
                    data-testid="api-mock-settings-tls-passphrase"
                  />
                </FormRow>
              </div>

              <div className="am-stg-inline" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="am-btn"
                  disabled={!tlsEnabled || tlsBusy}
                  onClick={() => { void handleGenerateCert(); }}
                  data-testid="api-mock-settings-tls-generate"
                >
                  {tlsBusy ? 'Generating…' : 'Generate self-signed'}
                </button>
                <span className="am-stg-hint">
                  Creates a 365-day localhost certificate with SANs for {host} and localhost.
                </span>
              </div>
              {tlsError && (
                <div className="am-stg-hint am-stg-hint--error" data-testid="api-mock-settings-tls-error">{tlsError}</div>
              )}
              {tlsEnabled && (
                <div className="am-notice warning" style={{ marginTop: 12 }}>
                  <span>
                    Self-signed certificates are not trusted by default. Give clients the
                    certificate (never the key) and point them at it:
                    <code>curl --cacert {certFileName} {listenPreview}</code>,
                    or <code>NODE_EXTRA_CA_CERTS={certFileName}</code> for Node.
                    Skipping verification with <code>curl -k</code> also works for throwaway checks.
                  </span>
                </div>
              )}

              <div className="am-stg-section-label" style={{ marginTop: 18 }}>Client certificates (mTLS)</div>
              <p className="am-stg-hint am-stg-hint--block" style={{ margin: '0 0 10px' }}>
                Normally the client generates its own key and a signing request. Instead, this
                studio acts as the certificate authority and issues a ready-to-use client
                certificate and key that you hand over directly — nothing for the client to create.
              </p>

              <div className="am-form-grid">
                <FormRow label="Require client cert">
                  <div className="am-stg-inline">
                    <button
                      type="button"
                      className={`am-toggle${mtlsEnabled ? ' on' : ''}`}
                      role="switch"
                      aria-checked={mtlsEnabled}
                      aria-label="Require client certificate"
                      disabled={!tlsEnabled}
                      data-testid="api-mock-settings-mtls-enabled"
                      onClick={() => setMtlsEnabled(v => !v)}
                    />
                    <span className="am-stg-hint am-stg-hint--block">
                      Rejects any connection that does not present a certificate signed by the CA below.
                    </span>
                  </div>
                </FormRow>
                <FormRow label="Client name" htmlFor="am-settings-mtls-cn">
                  <input
                    id="am-settings-mtls-cn"
                    className="am-input am-input--md mono"
                    value={mtlsCommonName}
                    disabled={!tlsEnabled}
                    placeholder="api-mock-client"
                    onChange={e => setMtlsCommonName(e.target.value)}
                    data-testid="api-mock-settings-mtls-cn"
                  />
                  <span className="am-stg-hint am-stg-hint--block">
                    Becomes the certificate&apos;s common name, so you can tell issued clients apart.
                  </span>
                </FormRow>
              </div>

              <div className="am-stg-inline" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="am-btn"
                  disabled={!tlsEnabled || mtlsBusy}
                  onClick={() => { void handleGenerateClientCert(); }}
                  data-testid="api-mock-settings-mtls-generate"
                >
                  {mtlsBusy ? 'Issuing…' : 'Generate client certificate'}
                </button>
                <span className="am-stg-hint am-stg-hint--block">
                  Creates a CA, issues a 365-day client certificate from it, and turns on mTLS.
                </span>
              </div>

              {mtlsClientCert && (
                <div className="am-notice" style={{ marginTop: 12 }} data-testid="api-mock-settings-mtls-issued">
                  <div>
                    <strong>Issued for “{mtlsCommonName}”. Send the client these two files:</strong>
                    <ul style={{ margin: '6px 0 10px 18px' }}>
                      <li><code>{serverSlug}-client.pem</code> — the client certificate (public).</li>
                      <li><code>{serverSlug}-client-key.pem</code> — the client private key. <strong>Send it over a secure channel and treat it as a password.</strong></li>
                    </ul>
                    <div className="am-stg-inline" style={{ flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        className="am-btn small ghost"
                        onClick={() => downloadPem(mtlsClientCert, 'client.pem')}
                        data-testid="api-mock-settings-mtls-download-cert"
                      >Download client cert</button>
                      <button
                        type="button"
                        className="am-btn small ghost"
                        onClick={() => downloadPem(mtlsClientKey, 'client-key.pem')}
                        data-testid="api-mock-settings-mtls-download-key"
                      >Download client key</button>
                      <button
                        type="button"
                        className="am-btn small ghost"
                        onClick={() => downloadPem(mtlsCaPem, 'client-ca.pem')}
                        data-testid="api-mock-settings-mtls-download-ca"
                      >Download CA</button>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      The client then calls the mock with both halves:
                      <br />
                      <code>
                        curl --cacert {certFileName} --cert {serverSlug}-client.pem --key {serverSlug}-client-key.pem {listenPreview}
                      </code>
                      <br />
                      The CA file is only needed if you want to verify clients from a different tool —
                      it is already stored in these settings.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </AppModalFrame>
  );
}
