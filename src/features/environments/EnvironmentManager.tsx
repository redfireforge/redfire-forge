import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Environment, Microservice, GlobalAuthProfile, FeatureGroup, ProtocolKey } from '../../shared/types';
import {
  logEnvironmentCreated, logEnvironmentDeleted,
  logMicroserviceCreated, logMicroserviceDeleted, logMicroserviceUpdated,
} from '../audit/utils/auditLog';
import type { AuditChange } from '../audit/utils/auditLog';
import {
  MicroserviceProtocolPanel,
  ProtocolHeaderBadges,
} from './components/MicroserviceProtocolPanel';
import {
  envDisplayName,
  getEffectiveEnabledProtocols,
  stripEnvFromProtocolEndpoints,
} from './utils/protocolEndpointUtils';
import {
  mergeEditValue,
  runSaveEdit,
  shouldClearEditingOnProtocolChange,
  type ActiveEdit,
} from './utils/environmentManagerEditHandlers';
import {
  applyAddAdditionalEnv,
  applyDeleteAdditionalEnv,
  applyToggleDeploy,
  isDuplicateAdditionalEnvName,
} from './utils/environmentManagerDeployUtils';
import {
  applyAuthProfile,
  applySaveGraphqlPath,
  applySaveProtocolEndpoint,
  applyToggleGrpcTls,
} from './utils/environmentManagerSaveHandlers';

export interface EnvironmentManagerProps {
  environments: Environment[];
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
  microservices: Microservice[];
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
  workspaceDefaults: Record<string, string>;
  setWorkspaceDefaults: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  featureGroups: FeatureGroup[];
  selectedEnvId: string;
  selectedSvcId: string;
  setSelectedEnvId: (id: string) => void;
  setSelectedSvcId: (id: string) => void;
  confirm: (message: string, onConfirm: () => void, detail?: string) => void;
}

export default function EnvironmentManager({
  environments,
  setEnvironments,
  microservices,
  setMicroservices,
  workspaceDefaults,
  setWorkspaceDefaults,
  appGlobalAuthProfiles,
  featureGroups,
  selectedEnvId,
  selectedSvcId,
  setSelectedEnvId,
  setSelectedSvcId,
  confirm,
}: EnvironmentManagerProps) {
  const [newEnvName, setNewEnvName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [expandedSvcId, setExpandedSvcId] = useState<string | null>(null);
  const [activeProtocolBySvc, setActiveProtocolBySvc] = useState<Record<string, ProtocolKey>>({});
  const [editing, setEditing] = useState<ActiveEdit | null>(null);
  const [newAdditionalEnvBySvc, setNewAdditionalEnvBySvc] = useState<Record<string, string>>({});
  const [draggingEnvIdx, setDraggingEnvIdx] = useState<number | null>(null);
  const [draggingSvcIdx, setDraggingSvcIdx] = useState<number | null>(null);
  const [newWorkspaceDefaultKey, setNewWorkspaceDefaultKey] = useState('');
  const [newWorkspaceDefaultValue, setNewWorkspaceDefaultValue] = useState('');

  const getActiveProtocol = useCallback((svc: Microservice): ProtocolKey => {
    const enabled = getEffectiveEnabledProtocols(svc);
    const current = activeProtocolBySvc[svc.id];
    if (current && enabled.includes(current)) return current;
    return enabled[0] ?? 'http';
  }, [activeProtocolBySvc]);

  const addEnv = useCallback((name: string) => {
    const id = uuidv4();
    setEnvironments((prev) => [...prev, { id, name }]);
    void logEnvironmentCreated(name, id);
  }, [setEnvironments]);

  const deleteEnv = useCallback((env: Environment) => {
    setEnvironments((prev) => prev.filter((e) => e.id !== env.id));
    setMicroservices((prev) => prev.map((s) => {
      const next = { ...s.baseUrls };
      delete next[env.id];
      return {
        ...s,
        baseUrls: next,
        protocolEndpoints: stripEnvFromProtocolEndpoints(s, env.id),
      };
    }));
    if (selectedEnvId === env.id) setSelectedEnvId('');
    void logEnvironmentDeleted(env.name, env.id);
  }, [setEnvironments, setMicroservices, selectedEnvId, setSelectedEnvId]);

  const addSvc = useCallback((name: string) => {
    const id = uuidv4();
    setMicroservices((prev) => [...prev, { id, name, baseUrls: {} }]);
    void logMicroserviceCreated(name, id);
  }, [setMicroservices]);

  const deleteSvc = useCallback((svc: Microservice) => {
    setMicroservices((prev) => prev.filter((s) => s.id !== svc.id));
    if (selectedSvcId === svc.id) setSelectedSvcId('');
    if (expandedSvcId === svc.id) setExpandedSvcId(null);
    void logMicroserviceDeleted(svc.name, svc.id);
  }, [setMicroservices, selectedSvcId, setSelectedSvcId, expandedSvcId]);

  const auditEnvName = useCallback((svc: Microservice, envId: string) =>
    envDisplayName(envId, environments, svc),
  [environments]);

  const saveBaseUrl = useCallback((svc: Microservice, envId: string, url: string) => {
    const oldUrl = svc.baseUrls[envId] ?? '';
    setMicroservices((prev) => prev.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [envId]: url } } : s));
    setEditing(null);
    if (oldUrl !== url) {
      const changes: AuditChange[] = [{ field: `baseUrl[${auditEnvName(svc, envId)}]`, oldValue: oldUrl, newValue: url }];
      void logMicroserviceUpdated(svc.name, svc.id, changes);
    }
  }, [setMicroservices, auditEnvName]);

  const saveProtocolEndpoint = useCallback((
    svc: Microservice,
    protocol: ProtocolKey,
    envId: string,
    baseUrl: string,
  ) => {
    setMicroservices((prev) => {
      const { microservices, changed, newUrl, oldUrl } = applySaveProtocolEndpoint(prev, svc, protocol, envId, baseUrl);
      if (changed) {
        const changes: AuditChange[] = [{
          field: `${protocol}[${auditEnvName(svc, envId)}]`,
          oldValue: oldUrl,
          newValue: newUrl,
        }];
        void logMicroserviceUpdated(svc.name, svc.id, changes);
      }
      return microservices;
    });
    setEditing(null);
  }, [setMicroservices, auditEnvName]);

  const saveGraphqlPath = useCallback((svc: Microservice, envId: string, path: string) => {
    setMicroservices((prev) => {
      const { microservices, changed, normalized, oldPath } = applySaveGraphqlPath(prev, svc, envId, path);
      if (changed) {
        const changes: AuditChange[] = [{
          field: `graphql.path[${auditEnvName(svc, envId)}]`,
          oldValue: oldPath,
          newValue: normalized,
        }];
        void logMicroserviceUpdated(svc.name, svc.id, changes);
      }
      return microservices;
    });
  }, [setMicroservices, auditEnvName]);

  const toggleGrpcTls = useCallback((svc: Microservice, envId: string, tls: boolean) => {
    setMicroservices((prev) => {
      const { microservices, changed, oldTls } = applyToggleGrpcTls(prev, svc, envId, tls);
      if (changed) {
        const changes: AuditChange[] = [{
          field: `grpc.tls[${auditEnvName(svc, envId)}]`,
          oldValue: String(oldTls),
          newValue: String(tls),
        }];
        void logMicroserviceUpdated(svc.name, svc.id, changes);
      }
      return microservices;
    });
  }, [setMicroservices, auditEnvName]);

  const setAuthProfile = useCallback((svc: Microservice, envId: string, profileId: string | undefined) => {
    setMicroservices((prev) => {
      const { microservices, changed, oldProfileId } = applyAuthProfile(prev, svc, envId, profileId);
      if (changed) {
        const oldName = (appGlobalAuthProfiles.find((p) => p.id === oldProfileId)?.name ?? oldProfileId) || '(none)';
        const newName = (appGlobalAuthProfiles.find((p) => p.id === profileId)?.name ?? profileId) || '(none)';
        const changes: AuditChange[] = [{ field: `authProfile[${auditEnvName(svc, envId)}]`, oldValue: oldName, newValue: newName }];
        void logMicroserviceUpdated(svc.name, svc.id, changes);
      }
      return microservices;
    });
  }, [setMicroservices, appGlobalAuthProfiles, auditEnvName]);

  const toggleDeploy = useCallback((svc: Microservice, envId: string) => {
    setMicroservices((prev) => applyToggleDeploy(prev, svc.id, envId));
  }, [setMicroservices]);

  const addAdditionalEnv = useCallback((svc: Microservice) => {
    const name = (newAdditionalEnvBySvc[svc.id] ?? '').trim();
    if (!name) return;
    if (isDuplicateAdditionalEnvName(name, environments, svc)) return;
    const id = `custom-${Date.now()}`;
    setMicroservices((prev) => applyAddAdditionalEnv(prev, svc.id, id, name));
    setNewAdditionalEnvBySvc((prev) => ({ ...prev, [svc.id]: '' }));
  }, [environments, newAdditionalEnvBySvc, setMicroservices]);

  const deleteAdditionalEnv = useCallback((svc: Microservice, envId: string) => {
    setMicroservices((prev) => applyDeleteAdditionalEnv(prev, svc.id, envId));
  }, [setMicroservices]);

  const addProtocol = useCallback((svc: Microservice, protocol: ProtocolKey) => {
    setMicroservices((prev) => prev.map((s) => {
      if (s.id !== svc.id) return s;
      const current = getEffectiveEnabledProtocols(s);
      if (current.includes(protocol)) return s;
      return { ...s, enabledProtocols: [...current, protocol] };
    }));
    setActiveProtocolBySvc((prev) => ({ ...prev, [svc.id]: protocol }));
  }, [setMicroservices]);

  const removeProtocol = useCallback((svc: Microservice, protocol: ProtocolKey) => {
    setMicroservices((prev) => prev.map((s) => {
      if (s.id !== svc.id) return s;
      const current = getEffectiveEnabledProtocols(s);
      return { ...s, enabledProtocols: current.filter((p) => p !== protocol) };
    }));
    setActiveProtocolBySvc((prev) => {
      if (prev[svc.id] !== protocol) return prev;
      const remaining = getEffectiveEnabledProtocols(svc).filter((p) => p !== protocol);
      return { ...prev, [svc.id]: remaining[0] ?? 'http' };
    });
  }, [setMicroservices]);

  const saveWorkspaceDefault = useCallback(() => {
    const key = newWorkspaceDefaultKey.trim();
    if (!key) return;
    setWorkspaceDefaults((prev) => ({ ...prev, [key]: newWorkspaceDefaultValue }));
    setNewWorkspaceDefaultKey('');
    setNewWorkspaceDefaultValue('');
  }, [newWorkspaceDefaultKey, newWorkspaceDefaultValue, setWorkspaceDefaults]);

  const updateWorkspaceDefaultValue = useCallback((key: string, value: string) => {
    setWorkspaceDefaults((prev) => ({ ...prev, [key]: value }));
  }, [setWorkspaceDefaults]);

  const deleteWorkspaceDefault = useCallback((key: string) => {
    setWorkspaceDefaults((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [setWorkspaceDefaults]);

  return (
    <div className="env-manager">
      <div className="env-manager-header">
        <h2>Environments</h2>
      </div>

      <div className="env-manager-body">
        <div className="env-section">
          <h4>Environments</h4>
          <div className="settings-add-row">
            <input
              data-testid="em-new-env-input"
              placeholder="e.g. t01, p01, staging"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newEnvName.trim()) {
                  addEnv(newEnvName.trim());
                  setNewEnvName('');
                }
              }}
            />
            <button data-testid="em-add-env-btn" type="button" className="btn btn-primary btn-xs" onClick={() => {
              addEnv(newEnvName.trim());
              setNewEnvName('');
            }} disabled={!newEnvName.trim()}>Add</button>
          </div>
          {environments.length === 0 && <div className="empty-hint">No environments defined.</div>}
          <div className="settings-env-chips">
            {environments.map((env, idx) => (
              <div
                key={env.id}
                data-env-name={env.name}
                className={`settings-chip ${draggingEnvIdx === idx ? 'dragging' : ''}`}
                draggable
                onDragStart={() => setDraggingEnvIdx(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggingEnvIdx === null || draggingEnvIdx === idx) return;
                  setEnvironments((prev) => {
                    const next = [...prev];
                    const [moved] = next.splice(draggingEnvIdx, 1);
                    next.splice(idx, 0, moved);
                    return next;
                  });
                  setDraggingEnvIdx(idx);
                }}
                onDragEnd={() => setDraggingEnvIdx(null)}
              >
                <span className="chip-grip">⠿</span>
                <span>{env.name}</span>
                <button type="button" className="settings-chip-delete" onClick={() => {
                  const affectedGroups = featureGroups.filter(g => g.environmentId === env.id);
                  const affectedScenarios = affectedGroups.reduce((n, g) => n + g.scenarios.length, 0);
                  const affectedTests = affectedGroups.reduce((n, g) => n + g.scenarios.reduce((m, s) => m + s.tests.length, 0), 0);
                  const affectedSvcs = microservices.filter(s => env.id in s.baseUrls);
                  const parts: string[] = [];
                  if (affectedSvcs.length > 0) parts.push(`${affectedSvcs.length} microservice${affectedSvcs.length !== 1 ? 's' : ''} will lose their base URL for this environment`);
                  if (affectedGroups.length > 0) parts.push(`${affectedGroups.length} feature group${affectedGroups.length !== 1 ? 's' : ''} (${affectedScenarios} scenario${affectedScenarios !== 1 ? 's' : ''}, ${affectedTests} test${affectedTests !== 1 ? 's' : ''}) will become unassociated`);
                  const detail = parts.length > 0
                    ? `Warning: ${parts.join('. ')}. They will NOT be deleted but will lose their environment association.`
                    : undefined;
                  confirm(`Delete environment "${env.name}"?`, () => {
                    deleteEnv(env);
                  }, detail);
                }} title="Delete">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="env-section">
          <h4>Microservices</h4>
          <div className="settings-add-row">
            <input
              data-testid="em-new-svc-input"
              placeholder="e.g. sales-product-autoassign"
              value={newSvcName}
              onChange={(e) => setNewSvcName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSvcName.trim()) {
                  addSvc(newSvcName.trim());
                  setNewSvcName('');
                }
              }}
            />
            <button data-testid="em-add-svc-btn" type="button" className="btn btn-primary btn-xs" onClick={() => {
              addSvc(newSvcName.trim());
              setNewSvcName('');
            }} disabled={!newSvcName.trim()}>Add</button>
          </div>
          {microservices.length === 0 && <div className="empty-hint">No microservices defined.</div>}
          <div className="settings-svc-list">
            {microservices.map((svc, svcIdx) => {
              const isSvcExpanded = expandedSvcId === svc.id;
              const deployedCount = environments.filter((env) => env.id in svc.baseUrls).length;
              const panelEditing = editing?.svcId === svc.id
                ? (editing.kind === 'http'
                  ? { kind: 'http' as const, envId: editing.envId, value: editing.value }
                  : { kind: 'protocol' as const, protocol: editing.protocol, envId: editing.envId, value: editing.value })
                : null;

              return (
                <div
                  key={svc.id}
                  data-svc-name={svc.name}
                  className={`settings-svc-card ${isSvcExpanded ? 'expanded' : ''} ${draggingSvcIdx === svcIdx ? 'dragging' : ''}`}
                  draggable={!isSvcExpanded}
                  onDragStart={() => setDraggingSvcIdx(svcIdx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggingSvcIdx === null || draggingSvcIdx === svcIdx) return;
                    setMicroservices((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(draggingSvcIdx, 1);
                      next.splice(svcIdx, 0, moved);
                      return next;
                    });
                    setDraggingSvcIdx(svcIdx);
                  }}
                  onDragEnd={() => setDraggingSvcIdx(null)}
                >
                  <div className="settings-svc-header">
                    <span className="svc-drag-grip" title="Drag to reorder">⠿</span>
                    <span className="settings-svc-name">{svc.name}</span>
                    <ProtocolHeaderBadges svc={svc} environments={environments} enabledProtocols={getEffectiveEnabledProtocols(svc)} />
                    <span className="settings-svc-count">{deployedCount}/{environments.length} envs</span>
                    <button
                      type="button"
                      className="btn btn-xs"
                      data-testid={`em-svc-configure-${svc.id}`}
                      onClick={() => {
                        setExpandedSvcId(isSvcExpanded ? null : svc.id);
                        setEditing(null);
                      }}
                    >{isSvcExpanded ? 'Collapse' : 'Configure'}</button>
                    <button type="button" className="btn btn-xs btn-danger" onClick={() => {
                      const affectedGroups = featureGroups.filter(g => g.microserviceId === svc.id);
                      const affectedScenarios = affectedGroups.reduce((n, g) => n + g.scenarios.length, 0);
                      const affectedTests = affectedGroups.reduce((n, g) => n + g.scenarios.reduce((m, s) => m + s.tests.length, 0), 0);
                      const detail = affectedGroups.length > 0
                        ? `Warning: ${affectedGroups.length} feature group${affectedGroups.length !== 1 ? 's' : ''} (${affectedScenarios} scenario${affectedScenarios !== 1 ? 's' : ''}, ${affectedTests} test${affectedTests !== 1 ? 's' : ''}) will become unassociated. They will NOT be deleted but will lose their microservice association.`
                        : undefined;
                      confirm(`Delete microservice "${svc.name}"?`, () => {
                        deleteSvc(svc);
                      }, detail);
                    }}>Delete</button>
                  </div>
                  {isSvcExpanded && (
                    <div className="svc-env-table-wrap">
                      {environments.length === 0 ? (
                        <div className="empty-hint" style={{ padding: '8px 12px' }}>Add environments first.</div>
                      ) : (
                        <MicroserviceProtocolPanel
                          svc={svc}
                          environments={environments}
                          appGlobalAuthProfiles={appGlobalAuthProfiles}
                          selectedEnvId={selectedEnvId}
                          activeProtocol={getActiveProtocol(svc)}
                          enabledProtocols={getEffectiveEnabledProtocols(svc)}
                          onProtocolChange={(protocol) => {
                            setActiveProtocolBySvc((prev) => ({ ...prev, [svc.id]: protocol }));
                            if (shouldClearEditingOnProtocolChange(editing, svc.id)) setEditing(null);
                          }}
                          onAddProtocol={(protocol) => addProtocol(svc, protocol)}
                          onRemoveProtocol={(protocol) => removeProtocol(svc, protocol)}
                          editing={panelEditing}
                          onStartEdit={(target) => setEditing({ svcId: svc.id, ...target })}
                          onEditValueChange={(value) => setEditing((prev) => mergeEditValue(prev, svc.id, value))}
                          onCancelEdit={() => setEditing(null)}
                          onSaveEdit={() => runSaveEdit(editing, svc.id, {
                            saveHttp: (envId, value) => saveBaseUrl(svc, envId, value),
                            saveProtocol: (protocol, envId, value) => saveProtocolEndpoint(svc, protocol, envId, value),
                          })}
                          onToggleDeploy={(envId) => toggleDeploy(svc, envId)}
                          onSetAuthProfile={(envId, profileId) => setAuthProfile(svc, envId, profileId)}
                          onGraphqlPathChange={(envId, path) => saveGraphqlPath(svc, envId, path)}
                          onToggleGrpcTls={(envId, tls) => toggleGrpcTls(svc, envId, tls)}
                          newAdditionalEnvName={newAdditionalEnvBySvc[svc.id] ?? ''}
                          onNewAdditionalEnvNameChange={(value) => setNewAdditionalEnvBySvc((prev) => ({ ...prev, [svc.id]: value }))}
                          onAddAdditionalEnv={() => addAdditionalEnv(svc)}
                          onDeleteAdditionalEnv={(envId) => deleteAdditionalEnv(svc, envId)}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="env-section">
          <h4>Workspace Defaults (Interpolation)</h4>
          <div className="em-workspace-defaults-note">
            Values in this map are available to gRPC interpolation as workspace-level defaults.
          </div>
          <div className="settings-add-row">
            <input
              data-testid="em-ws-default-key-input"
              placeholder="Key (e.g. grpcHost)"
              value={newWorkspaceDefaultKey}
              onChange={(e) => setNewWorkspaceDefaultKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newWorkspaceDefaultKey.trim()) saveWorkspaceDefault();
              }}
            />
            <input
              data-testid="em-ws-default-value-input"
              placeholder="Value"
              value={newWorkspaceDefaultValue}
              onChange={(e) => setNewWorkspaceDefaultValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newWorkspaceDefaultKey.trim()) saveWorkspaceDefault();
              }}
            />
            <button
              data-testid="em-ws-default-save-btn"
              type="button"
              className="btn btn-primary btn-xs"
              disabled={!newWorkspaceDefaultKey.trim()}
              onClick={saveWorkspaceDefault}
            >
              Set
            </button>
          </div>
          {Object.keys(workspaceDefaults).length === 0 && (
            <div className="empty-hint">No workspace defaults configured.</div>
          )}
          {Object.entries(workspaceDefaults)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => (
              <div key={key} className="em-workspace-default-row" data-testid={`em-ws-default-row-${key}`}>
                <code className="em-workspace-default-key">{key}</code>
                <input
                  data-testid={`em-ws-default-row-value-${key}`}
                  className="em-workspace-default-value"
                  value={value}
                  onChange={(e) => updateWorkspaceDefaultValue(key, e.target.value)}
                  aria-label={`Workspace default value for ${key}`}
                />
                <button
                  type="button"
                  className="btn btn-xs btn-danger"
                  data-testid={`em-ws-default-delete-${key}`}
                  onClick={() => deleteWorkspaceDefault(key)}
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
