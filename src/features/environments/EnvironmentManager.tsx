import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Environment, Microservice, GlobalAuthProfile } from '../../shared/types';

export interface EnvironmentManagerProps {
  environments: Environment[];
  setEnvironments: React.Dispatch<React.SetStateAction<Environment[]>>;
  microservices: Microservice[];
  setMicroservices: React.Dispatch<React.SetStateAction<Microservice[]>>;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function EnvironmentManager({
  environments,
  setEnvironments,
  microservices,
  setMicroservices,
  appGlobalAuthProfiles,
  confirm,
}: EnvironmentManagerProps) {
  const [newEnvName, setNewEnvName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [editingBaseUrls, setEditingBaseUrls] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<{ svcId: string; envId: string; value: string } | null>(null);
  const [newCustomEnvName, setNewCustomEnvName] = useState('');
  const [draggingEnvIdx, setDraggingEnvIdx] = useState<number | null>(null);
  const [draggingSvcIdx, setDraggingSvcIdx] = useState<number | null>(null);

  return (
    <div className="env-manager">
      <div className="env-manager-header">
        <h2>Environments</h2>
      </div>

      <div className="env-manager-body">
        {/* ── Environments ── */}
        <div className="env-section">
          <h4>Environments</h4>
          <div className="settings-add-row">
            <input
              placeholder="e.g. t01, p01, staging"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newEnvName.trim()) {
                  setEnvironments((prev) => [...prev, { id: uuidv4(), name: newEnvName.trim() }]);
                  setNewEnvName('');
                }
              }}
            />
            <button type="button" className="btn btn-primary btn-xs" onClick={() => {
              if (!newEnvName.trim()) return;
              setEnvironments((prev) => [...prev, { id: uuidv4(), name: newEnvName.trim() }]);
              setNewEnvName('');
            }} disabled={!newEnvName.trim()}>Add</button>
          </div>
          {environments.length === 0 && <div className="empty-hint">No environments defined.</div>}
          <div className="settings-env-chips">
            {environments.map((env, idx) => (
              <div
                key={env.id}
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
                  confirm(`Delete environment "${env.name}"?`, () => {
                    setEnvironments((prev) => prev.filter((e) => e.id !== env.id));
                    setMicroservices((prev) => prev.map((s) => {
                      const next = { ...s.baseUrls };
                      delete next[env.id];
                      return { ...s, baseUrls: next };
                    }));
                  });
                }} title="Delete">×</button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Microservices ── */}
        <div className="env-section">
          <h4>Microservices</h4>
          <div className="settings-add-row">
            <input
              placeholder="e.g. sales-product-autoassign"
              value={newSvcName}
              onChange={(e) => setNewSvcName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newSvcName.trim()) {
                  setMicroservices((prev) => [...prev, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }]);
                  setNewSvcName('');
                }
              }}
            />
            <button type="button" className="btn btn-primary btn-xs" onClick={() => {
              if (!newSvcName.trim()) return;
              setMicroservices((prev) => [...prev, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }]);
              setNewSvcName('');
            }} disabled={!newSvcName.trim()}>Add</button>
          </div>
          {microservices.length === 0 && <div className="empty-hint">No microservices defined.</div>}
          <div className="settings-svc-list">
            {microservices.map((svc, svcIdx) => {
              const isSvcExpanded = editingBaseUrls === svc.id;
              const deployedCount = environments.filter((env) => env.id in svc.baseUrls).length;
              return (
                <div
                  key={svc.id}
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
                    <span className="settings-svc-count">{deployedCount}/{environments.length} envs</span>
                    <button type="button" className="btn btn-xs" onClick={() => setEditingBaseUrls(isSvcExpanded ? null : svc.id)}>{isSvcExpanded ? 'Collapse' : 'Configure'}</button>
                    <button type="button" className="btn btn-xs btn-danger" onClick={() => {
                      confirm(`Delete microservice "${svc.name}"?`, () => {
                        setMicroservices((prev) => prev.filter((s) => s.id !== svc.id));
                      });
                    }}>Delete</button>
                  </div>
                  {isSvcExpanded && (
                    <div className="svc-env-table-wrap">
                      {environments.length === 0 ? (
                        <div className="empty-hint" style={{ padding: '8px 12px' }}>Add environments first.</div>
                      ) : (
                        <table className="svc-env-table">
                          <thead>
                            <tr>
                              <th className="svc-env-th-check"></th>
                              <th className="svc-env-th-env">Env</th>
                              <th className="svc-env-th-url">Base URL</th>
                              <th className="svc-env-th-auth">Auth Profile</th>
                            </tr>
                          </thead>
                          <tbody>
                            {environments.map((env) => {
                              const deployed = env.id in svc.baseUrls;
                              const isEditingThis = editingUrl?.svcId === svc.id && editingUrl?.envId === env.id;
                              const currentUrl = svc.baseUrls[env.id] ?? '';
                              return (
                                <tr key={env.id} className={deployed ? '' : 'svc-env-row-disabled'}>
                                  <td className="svc-env-td-check">
                                    <input type="checkbox" checked={deployed} onChange={() => {
                                      setMicroservices((prev) => prev.map((s) => {
                                        if (s.id !== svc.id) return s;
                                        const next = { ...s.baseUrls };
                                        if (env.id in next) delete next[env.id]; else next[env.id] = '';
                                        return { ...s, baseUrls: next };
                                      }));
                                    }} />
                                  </td>
                                  <td className="svc-env-td-env">
                                    <span className="svc-env-name">{env.name}</span>
                                  </td>
                                  <td className="svc-env-td-url">
                                    {deployed && (
                                      isEditingThis && editingUrl ? (
                                        <div className="svc-env-url-edit">
                                          <input autoFocus value={editingUrl.value}
                                            onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                setMicroservices((prev) => prev.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [env.id]: editingUrl.value } } : s));
                                                setEditingUrl(null);
                                              }
                                              if (e.key === 'Escape') setEditingUrl(null);
                                            }}
                                            placeholder={`https://${svc.name}.${env.name}.example.com`} />
                                          <button type="button" className="btn btn-primary btn-xs" onClick={() => {
                                            setMicroservices((prev) => prev.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [env.id]: editingUrl.value } } : s));
                                            setEditingUrl(null);
                                          }}>Save</button>
                                          <button type="button" className="btn btn-xs" onClick={() => setEditingUrl(null)}>Cancel</button>
                                        </div>
                                      ) : (
                                        <div className="svc-env-url-show">
                                          {currentUrl ? <code>{currentUrl}</code> : <span className="svc-env-url-empty">No URL configured</span>}
                                          <button type="button" className="btn btn-xs" onClick={() => setEditingUrl({ svcId: svc.id, envId: env.id, value: currentUrl })}>Edit</button>
                                        </div>
                                      )
                                    )}
                                  </td>
                                  <td className="svc-env-td-auth">
                                    {deployed && (
                                      <select
                                        className="env-auth-select"
                                        value={svc.authProfileIds?.[env.id] ?? ''}
                                        onChange={(e) => {
                                          const profileId = e.target.value || undefined;
                                          setMicroservices((prev) => prev.map((s) => {
                                            if (s.id !== svc.id) return s;
                                            const next = { ...(s.authProfileIds ?? {}) };
                                            if (profileId) next[env.id] = profileId; else delete next[env.id];
                                            return { ...s, authProfileIds: next };
                                          }));
                                        }}
                                      >
                                        <option value="">No Auth</option>
                                        {appGlobalAuthProfiles.map((p) => (
                                          <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {(svc.customEnvs ?? []).length > 0 && (
                              <tr className="svc-env-separator-row">
                                <td colSpan={4} className="svc-env-separator-td">Custom Environments</td>
                              </tr>
                            )}
                            {(svc.customEnvs ?? []).map((cEnv) => {
                              const deployed = cEnv.id in svc.baseUrls;
                              const isEditingThis = editingUrl?.svcId === svc.id && editingUrl?.envId === cEnv.id;
                              const currentUrl = svc.baseUrls[cEnv.id] ?? '';
                              return (
                                <tr key={cEnv.id} className={deployed ? '' : 'svc-env-row-disabled'}>
                                  <td className="svc-env-td-check">
                                    <input type="checkbox" checked={deployed} onChange={() => {
                                      setMicroservices((prev) => prev.map((s) => {
                                        if (s.id !== svc.id) return s;
                                        const next = { ...s.baseUrls };
                                        if (cEnv.id in next) delete next[cEnv.id]; else next[cEnv.id] = '';
                                        return { ...s, baseUrls: next };
                                      }));
                                    }} />
                                  </td>
                                  <td className="svc-env-td-env">
                                    <span className="svc-env-name svc-env-custom-tag">{cEnv.name}</span>
                                  </td>
                                  <td className="svc-env-td-url">
                                    {deployed && (
                                      isEditingThis && editingUrl ? (
                                        <div className="svc-env-url-edit">
                                          <input autoFocus value={editingUrl.value}
                                            onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                setMicroservices((prev) => prev.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [cEnv.id]: editingUrl.value } } : s));
                                                setEditingUrl(null);
                                              }
                                              if (e.key === 'Escape') setEditingUrl(null);
                                            }}
                                            placeholder={`https://${svc.name}.${cEnv.name}.example.com`} />
                                          <button type="button" className="btn btn-primary btn-xs" onClick={() => {
                                            setMicroservices((prev) => prev.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [cEnv.id]: editingUrl.value } } : s));
                                            setEditingUrl(null);
                                          }}>Save</button>
                                          <button type="button" className="btn btn-xs" onClick={() => setEditingUrl(null)}>Cancel</button>
                                        </div>
                                      ) : (
                                        <div className="svc-env-url-show">
                                          {currentUrl ? <code>{currentUrl}</code> : <span className="svc-env-url-empty">No URL configured</span>}
                                          <button type="button" className="btn btn-xs" onClick={() => setEditingUrl({ svcId: svc.id, envId: cEnv.id, value: currentUrl })}>Edit</button>
                                        </div>
                                      )
                                    )}
                                  </td>
                                  <td className="svc-env-td-auth">
                                    <div className="svc-env-custom-auth-cell">
                                      {deployed && (
                                        <select
                                          className="env-auth-select"
                                          value={svc.authProfileIds?.[cEnv.id] ?? ''}
                                          onChange={(e) => {
                                            const profileId = e.target.value || undefined;
                                            setMicroservices((prev) => prev.map((s) => {
                                              if (s.id !== svc.id) return s;
                                              const next = { ...(s.authProfileIds ?? {}) };
                                              if (profileId) next[cEnv.id] = profileId; else delete next[cEnv.id];
                                              return { ...s, authProfileIds: next };
                                            }));
                                          }}
                                        >
                                          <option value="">No Auth</option>
                                          {appGlobalAuthProfiles.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.auth.type})</option>
                                          ))}
                                        </select>
                                      )}
                                      <button type="button" className="btn btn-xs btn-danger svc-env-custom-del"
                                        title="Remove custom environment"
                                        onClick={() => {
                                          setMicroservices((prev) => prev.map((s) => {
                                            if (s.id !== svc.id) return s;
                                            const nextUrls = { ...s.baseUrls };
                                            delete nextUrls[cEnv.id];
                                            const nextAuth = { ...(s.authProfileIds ?? {}) };
                                            delete nextAuth[cEnv.id];
                                            return {
                                              ...s,
                                              baseUrls: nextUrls,
                                              authProfileIds: nextAuth,
                                              customEnvs: (s.customEnvs ?? []).filter((ce) => ce.id !== cEnv.id),
                                            };
                                          }));
                                        }}>×</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="svc-env-add-row">
                              <td colSpan={4}>
                                <form className="svc-env-add-form" onSubmit={(e) => {
                                  e.preventDefault();
                                  const name = newCustomEnvName.trim();
                                  if (!name) return;
                                  const allEnvNames = [
                                    ...environments.map((e) => e.name.toLowerCase()),
                                    ...(svc.customEnvs ?? []).map((e) => e.name.toLowerCase()),
                                  ];
                                  if (allEnvNames.includes(name.toLowerCase())) return;
                                  const id = `custom-${Date.now()}`;
                                  setMicroservices((prev) => prev.map((s) => {
                                    if (s.id !== svc.id) return s;
                                    return {
                                      ...s,
                                      customEnvs: [...(s.customEnvs ?? []), { id, name }],
                                      baseUrls: { ...s.baseUrls, [id]: '' },
                                    };
                                  }));
                                  setNewCustomEnvName('');
                                }}>
                                  <input
                                    className="svc-env-add-input"
                                    value={newCustomEnvName}
                                    onChange={(e) => setNewCustomEnvName(e.target.value)}
                                    placeholder="+ Add custom environment (e.g. staging-2)"
                                  />
                                </form>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
