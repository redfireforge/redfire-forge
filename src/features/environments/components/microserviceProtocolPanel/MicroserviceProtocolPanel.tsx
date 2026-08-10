import { useState } from 'react';
import type { ProtocolKey } from '../../../../shared/types';
import { DerivedVarsPanel } from '../DerivedVarsPanel';
import {
  PROTOCOL_TABS,
  computeProtocolCompleteness,
  getRowStatus,
  graphqlPathForEnv,
  grpcTlsForEnv,
  listDeployedEnvRows,
  resolvePreviewEnvId,
  resolvePreviewEnvName,
} from '../../utils/protocolEndpointUtils';
import { AddProtocolMenu, AuthSelect, UrlDisplayCell } from './ProtocolPanelCells';
import { EnvVarsModal } from './EnvVarsModal';
import { ProtocolVarsModal } from './ProtocolVarsModal';
import type { MicroserviceProtocolPanelProps } from './microserviceProtocolPanelTypes';

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
  onSetGlobalVar,
  onDeleteGlobalVar,
  onSetEnvVar,
  onDeleteEnvVar,
}: MicroserviceProtocolPanelProps) {
  const [protocolVarsOpen, setProtocolVarsOpen] = useState(false);
  const [envVarsTarget, setEnvVarsTarget] = useState<{ envId: string; envName: string } | null>(null);
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
          <th className="svc-env-th-envvars">Env vars</th>
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
              <td className="svc-env-td-env"><span className="em-env-chip" data-env-name={env.name}>{env.name}</span></td>
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
              <td className="svc-env-td-envvars">
                {deployed && (
                  <button
                    type="button"
                    className="em-vars-badge em-vars-badge--env"
                    data-testid={`env-vars-badge-${env.id}`}
                    onClick={() => setEnvVarsTarget({ envId: env.id, envName: env.name })}
                    title={`Configure variables specific to ${env.name}`}
                  >
                    Env vars{' '}
                    <span className={`em-vars-badge-count ${Object.keys(svc.envVars?.[env.id] ?? {}).length > 0 ? 'em-vars-badge-count--set' : ''}`}>
                      {Object.keys(svc.envVars?.[env.id] ?? {}).length}
                    </span>
                  </button>
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
            <td colSpan={5} className="svc-env-separator-td">Additional environments</td>
          </tr>
        )}
        {(svc.customEnvs ?? []).map((cEnv) => {
          const deployed = cEnv.id in svc.baseUrls;
          return (
            <tr key={cEnv.id} className={deployed ? '' : 'svc-env-row-disabled'}>
              <td className="svc-env-td-check">
                <input type="checkbox" checked={deployed} aria-label={`Deploy ${cEnv.name}`} onChange={() => onToggleDeploy(cEnv.id)} />
              </td>
              <td className="svc-env-td-env"><span className="em-env-chip svc-env-additional-tag" data-env-name={cEnv.name}>{cEnv.name}</span></td>
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
              <td className="svc-env-td-envvars">
                {deployed && (
                  <button
                    type="button"
                    className="em-vars-badge em-vars-badge--env"
                    data-testid={`env-vars-badge-${cEnv.id}`}
                    onClick={() => setEnvVarsTarget({ envId: cEnv.id, envName: cEnv.name })}
                    title={`Configure variables specific to ${cEnv.name}`}
                  >
                    Env vars{' '}
                    <span className={`em-vars-badge-count ${Object.keys(svc.envVars?.[cEnv.id] ?? {}).length > 0 ? 'em-vars-badge-count--set' : ''}`}>
                      {Object.keys(svc.envVars?.[cEnv.id] ?? {}).length}
                    </span>
                  </button>
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
          <td colSpan={5}>
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
    const colSpan = 4 + (showPath ? 1 : 0) + (showTls ? 1 : 0) + (showAuth ? 1 : 0);

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
            <span className={`em-env-chip ${isAdditional ? 'svc-env-additional-tag' : ''}`} data-env-name={name}>{name}</span>
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
          <td className="svc-env-td-envvars">
            {deployed && (
              <button
                type="button"
                className="em-vars-badge em-vars-badge--env"
                data-testid={`env-vars-badge-${envId}`}
                onClick={() => setEnvVarsTarget({ envId, envName: name })}
                title={`Configure variables specific to ${name}`}
              >
                Env vars{' '}
                <span className={`em-vars-badge-count ${Object.keys(svc.envVars?.[envId] ?? {}).length > 0 ? 'em-vars-badge-count--set' : ''}`}>
                  {Object.keys(svc.envVars?.[envId] ?? {}).length}
                </span>
              </button>
            )}
          </td>
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
            <th className="svc-env-th-envvars">Env vars</th>
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
          <button
            type="button"
            className="em-vars-badge"
            data-testid="protocol-vars-badge"
            onClick={() => setProtocolVarsOpen(true)}
            title="Configure variables available in all environments"
          >
            Protocol vars{' '}
            <span className={`em-vars-badge-count ${Object.keys(svc.globalVars ?? {}).length > 0 ? 'em-vars-badge-count--set' : ''}`}>
              {Object.keys(svc.globalVars ?? {}).length}
            </span>
          </button>
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

      {protocolVarsOpen && (
        <ProtocolVarsModal
          svc={svc}
          onClose={() => setProtocolVarsOpen(false)}
          onSetGlobalVar={onSetGlobalVar}
          onDeleteGlobalVar={onDeleteGlobalVar}
        />
      )}
      {envVarsTarget && (
        <EnvVarsModal
          svc={svc}
          envId={envVarsTarget.envId}
          envName={envVarsTarget.envName}
          onClose={() => setEnvVarsTarget(null)}
          onSetEnvVar={onSetEnvVar}
          onDeleteEnvVar={onDeleteEnvVar}
        />
      )}
    </div>
  );
}
