import { useState, useRef, useEffect } from 'react';
import type { Environment, GlobalAuthProfile, Microservice, ProtocolKey } from '../../../shared/types';
import { DerivedVarsPanel } from './DerivedVarsPanel';
import {
  resolvePreviewEnvId,
  resolvePreviewEnvName,
} from '../utils/protocolEndpointUtils';
import {
  PROTOCOL_TABS,
  computeProtocolCompleteness,
  getExplicitBaseUrl,
  getResolvedDisplayValue,
  getRowStatus,
  graphqlPathForEnv,
  grpcTlsForEnv,
  listDeployedEnvRows,
  statusChipLabel,
  validateProtocolValue,
  type EndpointRowStatus,
} from '../utils/protocolEndpointUtils';

export type ProtocolEditTarget =
  | { kind: 'http'; envId: string; value: string }
  | { kind: 'protocol'; protocol: ProtocolKey; envId: string; value: string };

export interface MicroserviceProtocolPanelProps {
  svc: Microservice;
  environments: Environment[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
  selectedEnvId: string;
  activeProtocol: ProtocolKey;
  enabledProtocols: ProtocolKey[];
  onProtocolChange: (protocol: ProtocolKey) => void;
  onAddProtocol: (protocol: ProtocolKey) => void;
  onRemoveProtocol: (protocol: ProtocolKey) => void;
  editing: ProtocolEditTarget | null;
  onStartEdit: (target: ProtocolEditTarget) => void;
  onEditValueChange: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleDeploy: (envId: string) => void;
  onSetAuthProfile: (envId: string, profileId: string | undefined) => void;
  onGraphqlPathChange: (envId: string, path: string) => void;
  onToggleGrpcTls: (envId: string, tls: boolean) => void;
  newAdditionalEnvName: string;
  onNewAdditionalEnvNameChange: (value: string) => void;
  onAddAdditionalEnv: () => void;
  onDeleteAdditionalEnv: (envId: string) => void;
}

function statusChipClass(status: EndpointRowStatus): string {
  switch (status) {
    case 'explicit': return 'em-url-status--ok';
    case 'fallback': return 'em-url-status--fallback';
    case 'unresolved': return 'em-url-status--unresolved';
    case 'empty': return 'em-url-status--empty';
  }
}

function AuthSelect({
  svc,
  envId,
  profiles,
  onSetAuthProfile,
}: {
  svc: Microservice;
  envId: string;
  profiles: GlobalAuthProfile[];
  onSetAuthProfile: (envId: string, profileId: string | undefined) => void;
}) {
  return (
    <select
      className="env-auth-select"
      aria-label="Auth profile"
      value={svc.authProfileIds?.[envId] ?? ''}
      onChange={(e) => onSetAuthProfile(envId, e.target.value || undefined)}
    >
      <option value="">No Auth</option>
      {profiles.map((p) => (
        <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
      ))}
    </select>
  );
}

function EndpointEditor({
  value,
  placeholder,
  validationError,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  placeholder: string;
  validationError: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="svc-env-url-edit">
      <input
        autoFocus
        data-testid="em-endpoint-edit-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        aria-invalid={validationError ? true : undefined}
      />
      {validationError && <span className="em-validation-hint">{validationError}</span>}
      <button type="button" className="btn btn-primary btn-xs" data-testid="em-endpoint-save-btn" onClick={onSave} disabled={!!validationError}>Save</button>
      <button type="button" className="btn btn-xs" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function UrlDisplayCell({
  svc,
  protocol,
  envId,
  envName,
  isEditing,
  editValue,
  onStartEdit,
  onEditValueChange,
  onSave,
  onCancel,
}: {
  svc: Microservice;
  protocol: ProtocolKey;
  envId: string;
  envName: string;
  isEditing: boolean;
  editValue: string;
  onStartEdit: (value: string) => void;
  onEditValueChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const status = getRowStatus(svc, protocol, envId);
  const explicit = getExplicitBaseUrl(svc, protocol, envId);
  const resolved = getResolvedDisplayValue(svc, protocol, envId, envName);
  const validationError = isEditing ? validateProtocolValue(protocol, editValue) : null;

  if (isEditing) {
    return (
      <EndpointEditor
        value={editValue}
        placeholder={protocol === 'grpc' ? 'host:50051' : `https://${svc.name}.${envName}.example.com`}
        validationError={validationError}
        onChange={onEditValueChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  const displayText = explicit || resolved;
  const emptyLabel = protocol === 'grpc'
    ? 'Not configured'
    : status === 'fallback'
      ? 'Not set — using HTTP fallback'
      : 'No URL configured';

  return (
    <div className="em-url-display">
      {displayText
        ? <code className="em-url-text">{displayText}</code>
        : <span className="svc-env-url-empty">{emptyLabel}</span>}
      <span className={`em-url-status ${statusChipClass(status)}`}>{statusChipLabel(status)}</span>
      <button
        type="button"
        className="btn btn-xs"
        data-testid="em-endpoint-edit-btn"
        onClick={() => onStartEdit(explicit || '')}
      >
        Edit
      </button>
    </div>
  );
}

/** Dropdown for adding a new protocol tab */
function AddProtocolMenu({
  enabledProtocols,
  onAdd,
}: {
  enabledProtocols: ProtocolKey[];
  onAdd: (protocol: ProtocolKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Defer so the same click that opened the menu does not immediately close it.
    const timerId = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const available = PROTOCOL_TABS.filter((t) => !enabledProtocols.includes(t.key));
  if (available.length === 0) return null;

  return (
    <div className="em-add-protocol-wrap" ref={ref}>
      <button
        type="button"
        className="em-add-protocol-btn"
        aria-label="Add protocol"
        title="Add protocol tab"
        onClick={() => setOpen((v) => !v)}
        data-testid="em-add-protocol-btn"
      >
        + Add protocol
      </button>
      {open && (
        <div className="em-add-protocol-menu" role="menu" data-testid="em-add-protocol-menu">
          <div className="em-add-protocol-menu-title">Add protocol</div>
          {available.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="menuitem"
              className="em-add-protocol-item"
              data-testid={`em-add-protocol-item-${tab.key}`}
              onClick={() => { onAdd(tab.key); setOpen(false); }}
            >
              <span className={`em-proto-tab-dot em-proto-tab-dot--${tab.cssKey}`} />
              <span className="em-add-protocol-label">{tab.label}</span>
              <span className="em-add-protocol-hint">{protocolHint(tab.key)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function protocolHint(protocol: ProtocolKey): string {
  switch (protocol) {
    case 'http': return 'REST / JSON APIs';
    case 'websocket': return 'ws:// / wss://';
    case 'sse': return 'Server-Sent Events';
    case 'graphql': return 'GraphQL API';
    case 'grpc': return 'gRPC / protobuf';
    default: return '';
  }
}

export function MicroserviceProtocolPanel({
  svc,
  environments,
  appGlobalAuthProfiles,
  selectedEnvId,
  activeProtocol,
  enabledProtocols,
  onProtocolChange,
  onAddProtocol,
  onRemoveProtocol,
  editing,
  onStartEdit,
  onEditValueChange,
  onCancelEdit,
  onSaveEdit,
  onToggleDeploy,
  onSetAuthProfile,
  onGraphqlPathChange,
  onToggleGrpcTls,
  newAdditionalEnvName,
  onNewAdditionalEnvNameChange,
  onAddAdditionalEnv,
  onDeleteAdditionalEnv,
}: MicroserviceProtocolPanelProps) {
  const deployedRows = listDeployedEnvRows(svc, environments);
  const deployedEnvIds = deployedRows.map((r) => r.envId);
  const previewEnvId = resolvePreviewEnvId(selectedEnvId, deployedEnvIds);
  const previewEnvName = previewEnvId
    ? resolvePreviewEnvName(previewEnvId, environments, svc)
    : '';

  const visibleTabs = PROTOCOL_TABS.filter((t) => enabledProtocols.includes(t.key));
  const tabDef = PROTOCOL_TABS.find((t) => t.key === activeProtocol)!;
  const completeness = computeProtocolCompleteness(svc, activeProtocol, deployedEnvIds, tabDef.supportsFallback);

  const showSseFallbackNotice = activeProtocol === 'sse'
    && deployedRows.some(({ envId }) => getRowStatus(svc, 'sse', envId) === 'fallback');
  const showGrpcUnresolvedNotice = activeProtocol === 'grpc'
    && completeness.explicitCount === 0
    && deployedEnvIds.length > 0;

  const isEditingEnv = (protocol: ProtocolKey, envId: string) =>
    editing?.kind === 'http' && protocol === 'http' && editing.envId === envId
    || editing?.kind === 'protocol' && editing.protocol === protocol && editing.envId === envId;

  const renderHttpTable = () => (
    <table className="svc-env-table em-endpoint-table">
      <thead>
        <tr>
          <th className="svc-env-th-check" aria-label="Deploy" />
          <th className="svc-env-th-env">Environment</th>
          <th className="svc-env-th-url">Base URL <span className="em-col-hint">— drives {'{{baseUrl}}'}, {'{{host}}'}</span></th>
          <th className="svc-env-th-auth">Auth profile</th>
        </tr>
      </thead>
      <tbody>
        {environments.map((env) => {
          const deployed = env.id in svc.baseUrls;
          return (
            <tr key={env.id} className={deployed ? '' : 'svc-env-row-disabled'}>
              <td className="svc-env-td-check">
                <input type="checkbox" checked={deployed} aria-label={`Deploy ${env.name}`} onChange={() => onToggleDeploy(env.id)} />
              </td>
              <td className="svc-env-td-env"><span className="em-env-chip">{env.name}</span></td>
              <td className="svc-env-td-url">
                {deployed && (
                  <UrlDisplayCell
                    svc={svc}
                    protocol="http"
                    envId={env.id}
                    envName={env.name}
                    isEditing={isEditingEnv('http', env.id)}
                    editValue={editing?.kind === 'http' && editing.envId === env.id ? editing.value : ''}
                    onStartEdit={(value) => onStartEdit({ kind: 'http', envId: env.id, value })}
                    onEditValueChange={onEditValueChange}
                    onSave={onSaveEdit}
                    onCancel={onCancelEdit}
                  />
                )}
              </td>
              <td className="svc-env-td-auth">
                {deployed && (
                  <AuthSelect svc={svc} envId={env.id} profiles={appGlobalAuthProfiles} onSetAuthProfile={onSetAuthProfile} />
                )}
              </td>
            </tr>
          );
        })}
        {(svc.customEnvs ?? []).length > 0 && (
          <tr className="svc-env-separator-row">
            <td colSpan={4} className="svc-env-separator-td">Additional environments</td>
          </tr>
        )}
        {(svc.customEnvs ?? []).map((cEnv) => {
          const deployed = cEnv.id in svc.baseUrls;
          return (
            <tr key={cEnv.id} className={deployed ? '' : 'svc-env-row-disabled'}>
              <td className="svc-env-td-check">
                <input type="checkbox" checked={deployed} aria-label={`Deploy ${cEnv.name}`} onChange={() => onToggleDeploy(cEnv.id)} />
              </td>
              <td className="svc-env-td-env"><span className="em-env-chip svc-env-additional-tag">{cEnv.name}</span></td>
              <td className="svc-env-td-url">
                {deployed && (
                  <UrlDisplayCell
                    svc={svc}
                    protocol="http"
                    envId={cEnv.id}
                    envName={cEnv.name}
                    isEditing={isEditingEnv('http', cEnv.id)}
                    editValue={editing?.kind === 'http' && editing.envId === cEnv.id ? editing.value : ''}
                    onStartEdit={(value) => onStartEdit({ kind: 'http', envId: cEnv.id, value })}
                    onEditValueChange={onEditValueChange}
                    onSave={onSaveEdit}
                    onCancel={onCancelEdit}
                  />
                )}
              </td>
              <td className="svc-env-td-auth">
                <div className="svc-env-additional-auth-cell">
                  {deployed && (
                    <AuthSelect svc={svc} envId={cEnv.id} profiles={appGlobalAuthProfiles} onSetAuthProfile={onSetAuthProfile} />
                  )}
                  <button type="button" className="btn btn-xs btn-danger svc-env-additional-del" title="Remove additional environment" onClick={() => onDeleteAdditionalEnv(cEnv.id)}>×</button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="svc-env-add-row">
          <td colSpan={4}>
            <form className="svc-env-add-form" onSubmit={(e) => { e.preventDefault(); onAddAdditionalEnv(); }}>
              <input
                className="svc-env-add-input"
                value={newAdditionalEnvName}
                onChange={(e) => onNewAdditionalEnvNameChange(e.target.value)}
                placeholder="+ Add additional environment (e.g. staging-2)"
              />
            </form>
          </td>
        </tr>
      </tfoot>
    </table>
  );

  const renderProtocolTable = (protocol: ProtocolKey) => {
    const def = PROTOCOL_TABS.find((t) => t.key === protocol)!;
    const showAuth = protocol === 'websocket';
    const showPath = protocol === 'graphql';
    const showTls = protocol === 'grpc';
    const colSpan = 3 + (showPath ? 1 : 0) + (showTls ? 1 : 0) + (showAuth ? 1 : 0);

    const endpointVar: Partial<Record<ProtocolKey, string>> = {
      websocket: 'wsBaseUrl',
      sse: 'sseUrl',
      graphql: 'graphqlUrl',
      grpc: 'grpcHost',
    };
    const varName = endpointVar[protocol];

    const renderEnvRow = (envId: string, name: string, isAdditional: boolean, isCustom: boolean) => {
      const deployed = envId in svc.baseUrls;
      return (
        <tr key={envId} className={deployed ? '' : 'svc-env-row-disabled'}>
          <td className="svc-env-td-check">
            <input
              type="checkbox"
              checked={deployed}
              aria-label={`Deploy ${name}`}
              onChange={() => onToggleDeploy(envId)}
            />
          </td>
          <td className="svc-env-td-env">
            <span className={`em-env-chip ${isAdditional ? 'svc-env-additional-tag' : ''}`}>{name}</span>
          </td>
          <td className="svc-env-td-url">
            {deployed && (
              <UrlDisplayCell
                svc={svc}
                protocol={protocol}
                envId={envId}
                envName={name}
                isEditing={isEditingEnv(protocol, envId)}
                editValue={editing?.kind === 'protocol' && editing.protocol === protocol && editing.envId === envId ? editing.value : ''}
                onStartEdit={(value) => onStartEdit({ kind: 'protocol', protocol, envId, value })}
                onEditValueChange={onEditValueChange}
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
              />
            )}
          </td>
          {showPath && (
            <td className="svc-env-td-path">
              {deployed && (
                <input
                  className="em-path-input"
                  data-testid="em-graphql-path-input"
                  value={graphqlPathForEnv(svc, envId)}
                  aria-label={`Default path for ${name}`}
                  onChange={(e) => onGraphqlPathChange(envId, e.target.value)}
                />
              )}
            </td>
          )}
          {showTls && (
            <td className="svc-env-td-tls">
              {deployed && (
                <label className="em-tls-toggle">
                  <input
                    type="checkbox"
                    checked={grpcTlsForEnv(svc, envId)}
                    aria-label={`TLS for ${name}`}
                    onChange={(e) => onToggleGrpcTls(envId, e.target.checked)}
                  />
                  <span>{grpcTlsForEnv(svc, envId) ? 'On' : 'Off'}</span>
                </label>
              )}
            </td>
          )}
          {showAuth && (
            <td className="svc-env-td-auth">
              {deployed && (
                <div className="svc-env-additional-auth-cell">
                  <AuthSelect svc={svc} envId={envId} profiles={appGlobalAuthProfiles} onSetAuthProfile={onSetAuthProfile} />
                  {isCustom && (
                    <button type="button" className="btn btn-xs btn-danger svc-env-additional-del" title="Remove additional environment" onClick={() => onDeleteAdditionalEnv(envId)}>×</button>
                  )}
                </div>
              )}
              {!deployed && isCustom && (
                <div className="svc-env-additional-auth-cell">
                  <button type="button" className="btn btn-xs btn-danger svc-env-additional-del" title="Remove additional environment" onClick={() => onDeleteAdditionalEnv(envId)}>×</button>
                </div>
              )}
            </td>
          )}
        </tr>
      );
    };

    return (
      <table className="svc-env-table em-endpoint-table">
        <thead>
          <tr>
            <th className="svc-env-th-check" aria-label="Deploy" />
            <th className="svc-env-th-env">Environment</th>
            <th className="svc-env-th-url">
              {def.label} address
              {varName && <span className="em-col-hint">{`— drives {{${varName}}}`}</span>}
            </th>
            {showPath && <th className="svc-env-th-path">Default path</th>}
            {showTls && <th className="svc-env-th-tls">TLS</th>}
            {showAuth && <th className="svc-env-th-auth">Auth profile</th>}
          </tr>
        </thead>
        <tbody>
          {environments.length === 0 && (svc.customEnvs ?? []).length === 0 && (
            <tr>
              <td colSpan={colSpan} className="em-empty-deployed">No environments defined.</td>
            </tr>
          )}
          {environments.map((env) => renderEnvRow(env.id, env.name, false, false))}
          {(svc.customEnvs ?? []).length > 0 && (
            <tr className="svc-env-separator-row">
              <td colSpan={colSpan} className="svc-env-separator-td">Additional environments</td>
            </tr>
          )}
          {(svc.customEnvs ?? []).map((cEnv) => renderEnvRow(cEnv.id, cEnv.name, true, true))}
        </tbody>
      </table>
    );
  };

  if (visibleTabs.length === 0) {
    return (
      <div className="em-protocol-panel" data-testid="microservice-protocol-panel">
        <div className="em-proto-tabs-row em-proto-tabs-row--empty">
          <p className="em-proto-empty-hint">No protocols added yet. Use <strong>+ Add protocol</strong> to configure HTTP, WebSocket, SSE, and more.</p>
          <AddProtocolMenu enabledProtocols={enabledProtocols} onAdd={onAddProtocol} />
        </div>
      </div>
    );
  }

  return (
    <div className="em-protocol-panel" data-testid="microservice-protocol-panel">
      {/* Tab bar row: scrollable tabs on the left, "+ Add protocol" pinned on the right */}
      <div className="em-proto-tabs-row">
        <div className="em-proto-tabs" role="tablist" aria-label="Protocol endpoints">
          {visibleTabs.map((tab) => {
            const tabComplete = computeProtocolCompleteness(svc, tab.key, deployedEnvIds, tab.supportsFallback);
            const isActive = activeProtocol === tab.key;
            return (
              <div key={tab.key} className={`em-proto-tab-wrap ${isActive ? 'em-proto-tab-wrap--active' : ''}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`em-protocol-tab-${tab.key}`}
                  className={`em-proto-tab ${isActive ? `em-proto-tab--active em-proto-tab--${tab.cssKey}` : ''}`}
                  onClick={() => onProtocolChange(tab.key)}
                >
                  <span className={`em-proto-tab-dot em-proto-tab-dot--${tab.cssKey} ${tabComplete.explicitCount === 0 ? 'em-proto-tab-dot--none' : ''}`} />
                  {tab.label}
                  <span className={`em-proto-tab-count em-proto-tab-count--${tabComplete.tone}`}>{tabComplete.tabCountLabel}</span>
                </button>
                <button
                  type="button"
                  className="em-proto-tab-remove"
                  aria-label={`Remove ${tab.label} protocol`}
                  title={`Remove ${tab.label} tab`}
                  data-testid={`em-remove-protocol-${tab.key}`}
                  onClick={() => onRemoveProtocol(tab.key)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        <AddProtocolMenu enabledProtocols={enabledProtocols} onAdd={onAddProtocol} />
      </div>

      <div className="em-endpoint-panel" role="tabpanel">
        <div className="em-tab-meta">
          <span className={`em-tab-completeness em-tab-completeness--${completeness.tone}`}>
            {completeness.tabCountLabel === 'fallback' ? 'Using HTTP fallback' : `${completeness.label} configured`}
          </span>
        </div>

        {showSseFallbackNotice && (
          <div className="em-fallback-notice em-fallback-notice--warn" data-testid="sse-fallback-notice">
            No SSE endpoint configured. <code>{'{{sseUrl}}'}</code> falls back to the HTTP base URL from the HTTP tab.
          </div>
        )}
        {showGrpcUnresolvedNotice && (
          <div className="em-fallback-notice em-fallback-notice--danger" data-testid="grpc-unresolved-notice">
            No gRPC address configured. <code>{'{{grpcHost}}'}</code> stays unresolved until you set a host:port per environment.
          </div>
        )}

        {activeProtocol === 'http' ? renderHttpTable() : renderProtocolTable(activeProtocol)}

        {previewEnvId && (
          <DerivedVarsPanel
            svc={svc}
            protocol={activeProtocol}
            envId={previewEnvId}
            envName={previewEnvName}
          />
        )}
      </div>
    </div>
  );
}

export function ProtocolHeaderBadges({
  svc,
  environments,
  enabledProtocols,
}: {
  svc: Microservice;
  environments: Environment[];
  enabledProtocols: ProtocolKey[];
}) {
  const deployedEnvIds = listDeployedEnvRows(svc, environments).map((r) => r.envId);
  const visibleTabs = PROTOCOL_TABS.filter((t) => enabledProtocols.includes(t.key));
  return (
    <div className="em-svc-status-badges" data-testid="protocol-header-badges">
      {visibleTabs.map((tab) => {
        const c = computeProtocolCompleteness(svc, tab.key, deployedEnvIds, tab.supportsFallback);
        return (
          <span key={tab.key} className={`em-svc-badge em-svc-badge--${c.tone} em-svc-badge--${tab.cssKey}`}>
            {tab.shortLabel} {c.label}
          </span>
        );
      })}
    </div>
  );
}
