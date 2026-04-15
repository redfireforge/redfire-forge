import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Project, GlobalAuthProfile, AuthType, AuthConfig } from '../types';

export interface SettingsProjectsTabProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  selectedProjectId: string;
  modifyProject: (projectId: string, fn: (p: Project) => Project) => void;
  newProjectName: string;
  setNewProjectName: React.Dispatch<React.SetStateAction<string>>;
  newProjectDesc: string;
  setNewProjectDesc: React.Dispatch<React.SetStateAction<string>>;
  editingProjectId: string | null;
  setEditingProjectId: React.Dispatch<React.SetStateAction<string | null>>;
  newEnvName: string;
  setNewEnvName: React.Dispatch<React.SetStateAction<string>>;
  newSvcName: string;
  setNewSvcName: React.Dispatch<React.SetStateAction<string>>;
  editingBaseUrls: string | null;
  setEditingBaseUrls: React.Dispatch<React.SetStateAction<string | null>>;
  editingUrl: { svcId: string; envId: string; value: string } | null;
  setEditingUrl: React.Dispatch<React.SetStateAction<{ svcId: string; envId: string; value: string } | null>>;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  setAppGlobalAuthProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>;
  editingGlobalAuth: string | null;
  setEditingGlobalAuth: React.Dispatch<React.SetStateAction<string | null>>;
  newProfileName: string;
  setNewProfileName: React.Dispatch<React.SetStateAction<string>>;
  showSecret: boolean;
  setShowSecret: React.Dispatch<React.SetStateAction<boolean>>;
  authVerifying: boolean;
  authVerifyResult: { ok: boolean; msg: string } | null;
  verifyProfileAuth: (auth: AuthConfig) => Promise<void>;
  setAuthVerifyResult: React.Dispatch<React.SetStateAction<{ ok: boolean; msg: string } | null>>;
  onAddProject: (name: string, desc?: string) => void;
  onRemoveProject: (id: string) => void;
  onUpdateProjectMeta: (id: string, updates: { name?: string; description?: string }) => void;
  onProjectSwitch: (projectId: string) => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function SettingsProjectsTab({
  projects,
  setProjects,
  selectedProjectId,
  modifyProject,
  newProjectName,
  setNewProjectName,
  newProjectDesc,
  setNewProjectDesc,
  editingProjectId,
  setEditingProjectId,
  newEnvName,
  setNewEnvName,
  newSvcName,
  setNewSvcName,
  editingBaseUrls,
  setEditingBaseUrls,
  editingUrl,
  setEditingUrl,
  appGlobalAuthProfiles,
  setAppGlobalAuthProfiles,
  editingGlobalAuth,
  setEditingGlobalAuth,
  newProfileName,
  setNewProfileName,
  showSecret,
  setShowSecret,
  authVerifying,
  authVerifyResult,
  verifyProfileAuth,
  setAuthVerifyResult,
  onAddProject,
  onRemoveProject,
  onUpdateProjectMeta,
  onProjectSwitch,
  confirm,
}: SettingsProjectsTabProps) {
  const handleAddProject = () => {
    if (!newProjectName.trim()) return;
    onAddProject(newProjectName.trim(), newProjectDesc.trim() || undefined);
    setNewProjectName('');
    setNewProjectDesc('');
  };

  const handleRemoveProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    const fgCount = project?.featureGroups.length ?? 0;
    const detail = fgCount > 0 ? ` It contains ${fgCount} feature group(s) that will be deleted.` : '';
    confirm(`Delete project "${project?.name}"?${detail}`, () => onRemoveProject(id));
  };

  return (
    <div className="settings-section">
      <h4>Projects</h4>
      <p className="settings-section-desc">
        Each project has its own environments, microservices, auth profiles, and feature groups.
      </p>
      <div className="settings-add-row">
        <input
          placeholder="Project name (e.g. Payment Gateway, User Auth)"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddProject(); }}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAddProject} disabled={!newProjectName.trim()}>Add</button>
      </div>
      <div className="settings-list">
        {projects.map((prj) => {
          const isEditing = editingProjectId === prj.id;
          const isCurrent = prj.id === selectedProjectId;
          const pEnvs = prj.environments;
          const pSvcs = prj.microservices;
          const pAuth = prj.globalAuthProfiles;
          return (
            <div key={prj.id} className={`settings-svc-card ${isEditing ? 'expanded' : ''} ${isCurrent ? 'settings-card-active' : ''}`}>
              <div className="settings-svc-header">
                <span className="settings-svc-name">{prj.name} {isCurrent && <span style={{ fontSize: '0.7em', opacity: 0.6 }}>(active)</span>}</span>
                <span className="settings-svc-count">{pEnvs.length} envs · {pSvcs.length} svcs · {prj.featureGroups.length} features</span>
                <button type="button" className="btn btn-sm" onClick={() => setEditingProjectId(isEditing ? null : prj.id)}>
                  {isEditing ? 'Collapse' : 'Edit'}
                </button>
                {!isCurrent && <button type="button" className="btn btn-sm btn-primary" onClick={() => onProjectSwitch(prj.id)}>Switch</button>}
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemoveProject(prj.id)} disabled={projects.length <= 1}>Delete</button>
              </div>
              {isEditing && (
                <div className="settings-project-body">
                  <div className="settings-project-meta">
                    <div className="form-row">
                      <label>Name</label>
                      <input value={prj.name} onChange={(e) => onUpdateProjectMeta(prj.id, { name: e.target.value })} />
                    </div>
                    <div className="form-row">
                      <label>Description</label>
                      <input value={prj.description || ''} onChange={(e) => onUpdateProjectMeta(prj.id, { description: e.target.value || undefined })} placeholder="Optional description" />
                    </div>
                  </div>

                  <div className="settings-project-subsection">
                    <h5>Environments</h5>
                    <div className="settings-add-row">
                      <input placeholder="e.g. t01, p01, staging" value={editingProjectId === prj.id ? newEnvName : ''} onChange={(e) => setNewEnvName(e.target.value)} onKeyDown={(e) => {
                        if (e.key === 'Enter' && newEnvName.trim()) {
                          modifyProject(prj.id, (p) => ({ ...p, environments: [...p.environments, { id: uuidv4(), name: newEnvName.trim() }] }));
                          setNewEnvName('');
                        }
                      }} />
                      <button type="button" className="btn btn-primary btn-xs" onClick={() => {
                        if (!newEnvName.trim()) return;
                        modifyProject(prj.id, (p) => ({ ...p, environments: [...p.environments, { id: uuidv4(), name: newEnvName.trim() }] }));
                        setNewEnvName('');
                      }} disabled={!newEnvName.trim()}>Add</button>
                    </div>
                    {projects.length > 1 && (() => {
                      const otherProjects = projects.filter((op) => op.id !== prj.id && op.environments.length > 0);
                      if (otherProjects.length === 0) return null;
                      return (
                        <div className="settings-transfer-row">
                          <select id={`xfer-env-src-${prj.id}`} defaultValue="">
                            <option value="" disabled>Select project...</option>
                            {otherProjects.map((op) => <option key={op.id} value={op.id}>{op.name} ({op.environments.length} envs)</option>)}
                          </select>
                          <button type="button" className="btn btn-xs" title="Duplicate environments into this project" onClick={() => {
                            const sel = (document.getElementById(`xfer-env-src-${prj.id}`) as HTMLSelectElement)?.value;
                            const src = projects.find((p) => p.id === sel);
                            if (!src) return;
                            const existingIds = new Set(prj.environments.map((e) => e.id));
                            const toCopy = src.environments.filter((e) => !existingIds.has(e.id));
                            if (toCopy.length === 0) { alert('All environments already exist.'); return; }
                            modifyProject(prj.id, (p) => ({ ...p, environments: [...p.environments, ...toCopy] }));
                          }}>Copy</button>
                          <button type="button" className="btn btn-xs" title="Move environments from the selected project (removes them from source)" onClick={() => {
                            const sel = (document.getElementById(`xfer-env-src-${prj.id}`) as HTMLSelectElement)?.value;
                            const src = projects.find((p) => p.id === sel);
                            if (!src) return;
                            const existingIds = new Set(prj.environments.map((e) => e.id));
                            const toMove = src.environments.filter((e) => !existingIds.has(e.id));
                            if (toMove.length === 0) { alert('All environments already exist.'); return; }
                            const moveIds = new Set(toMove.map((e) => e.id));
                            confirm(`Move ${toMove.length} environment(s) from "${src.name}" to "${prj.name}"? They will be removed from "${src.name}".`, () => {
                              setProjects((prev) => prev.map((p) => {
                                if (p.id === prj.id) return { ...p, environments: [...p.environments, ...toMove] };
                                if (p.id === src.id) return { ...p, environments: p.environments.filter((e) => !moveIds.has(e.id)) };
                                return p;
                              }));
                            });
                          }}>Move</button>
                        </div>
                      );
                    })()}
                    {pEnvs.length === 0 && <div className="empty-hint">No environments defined.</div>}
                    <div className="settings-env-chips">
                      {pEnvs.map((env) => (
                        <div key={env.id} className="settings-chip">
                          <span>{env.name}</span>
                          <button type="button" className="settings-chip-delete" onClick={() => {
                            confirm(`Delete environment "${env.name}" from "${prj.name}"?`, () => {
                              modifyProject(prj.id, (p) => ({
                                ...p,
                                environments: p.environments.filter((e) => e.id !== env.id),
                                microservices: p.microservices.map((s) => {
                                  const next = { ...s.baseUrls };
                                  delete next[env.id];
                                  return { ...s, baseUrls: next };
                                }),
                              }));
                            });
                          }} title="Delete">×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="settings-project-subsection">
                    <h5>Microservices</h5>
                    <div className="settings-add-row">
                      <input placeholder="e.g. sales-product-autoassign" value={editingProjectId === prj.id ? newSvcName : ''} onChange={(e) => setNewSvcName(e.target.value)} onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSvcName.trim()) {
                          modifyProject(prj.id, (p) => ({ ...p, microservices: [...p.microservices, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }] }));
                          setNewSvcName('');
                        }
                      }} />
                      <button type="button" className="btn btn-primary btn-xs" onClick={() => {
                        if (!newSvcName.trim()) return;
                        modifyProject(prj.id, (p) => ({ ...p, microservices: [...p.microservices, { id: uuidv4(), name: newSvcName.trim(), baseUrls: {} }] }));
                        setNewSvcName('');
                      }} disabled={!newSvcName.trim()}>Add</button>
                    </div>
                    {projects.length > 1 && (() => {
                      const otherProjects = projects.filter((op) => op.id !== prj.id && op.microservices.length > 0);
                      if (otherProjects.length === 0) return null;
                      return (
                        <div className="settings-transfer-row">
                          <select id={`xfer-svc-src-${prj.id}`} defaultValue="">
                            <option value="" disabled>Select project...</option>
                            {otherProjects.map((op) => <option key={op.id} value={op.id}>{op.name} ({op.microservices.length} svcs)</option>)}
                          </select>
                          <button type="button" className="btn btn-xs" title="Duplicate microservices into this project" onClick={() => {
                            const sel = (document.getElementById(`xfer-svc-src-${prj.id}`) as HTMLSelectElement)?.value;
                            const src = projects.find((p) => p.id === sel);
                            if (!src) return;
                            const existingIds = new Set(prj.microservices.map((s) => s.id));
                            const toCopy = src.microservices.filter((s) => !existingIds.has(s.id));
                            if (toCopy.length === 0) { alert('All microservices already exist.'); return; }
                            modifyProject(prj.id, (p) => ({ ...p, microservices: [...p.microservices, ...toCopy] }));
                          }}>Copy</button>
                          <button type="button" className="btn btn-xs" title="Move microservices from the selected project (removes them from source)" onClick={() => {
                            const sel = (document.getElementById(`xfer-svc-src-${prj.id}`) as HTMLSelectElement)?.value;
                            const src = projects.find((p) => p.id === sel);
                            if (!src) return;
                            const existingIds = new Set(prj.microservices.map((s) => s.id));
                            const toMove = src.microservices.filter((s) => !existingIds.has(s.id));
                            if (toMove.length === 0) { alert('All microservices already exist.'); return; }
                            const moveIds = new Set(toMove.map((s) => s.id));
                            confirm(`Move ${toMove.length} microservice(s) from "${src.name}" to "${prj.name}"? They will be removed from "${src.name}".`, () => {
                              setProjects((prev) => prev.map((p) => {
                                if (p.id === prj.id) return { ...p, microservices: [...p.microservices, ...toMove] };
                                if (p.id === src.id) return { ...p, microservices: p.microservices.filter((s) => !moveIds.has(s.id)) };
                                return p;
                              }));
                            });
                          }}>Move</button>
                        </div>
                      );
                    })()}
                    {pSvcs.length === 0 && <div className="empty-hint">No microservices defined.</div>}
                    <div className="settings-svc-list">
                      {pSvcs.map((svc) => {
                        const isSvcExpanded = editingBaseUrls === svc.id;
                        const deployedCount = pEnvs.filter((env) => env.id in svc.baseUrls).length;
                        return (
                          <div key={svc.id} className={`settings-svc-card ${isSvcExpanded ? 'expanded' : ''}`}>
                            <div className="settings-svc-header">
                              <span className="settings-svc-name">{svc.name}</span>
                              <span className="settings-svc-count">{deployedCount}/{pEnvs.length} envs</span>
                              <button type="button" className="btn btn-xs" onClick={() => setEditingBaseUrls(isSvcExpanded ? null : svc.id)}>{isSvcExpanded ? 'Collapse' : 'Configure'}</button>
                              <button type="button" className="btn btn-xs btn-danger" onClick={() => {
                                confirm(`Delete microservice "${svc.name}" from "${prj.name}"?`, () => {
                                  modifyProject(prj.id, (p) => ({
                                    ...p,
                                    microservices: p.microservices.filter((s) => s.id !== svc.id),
                                    featureGroups: p.featureGroups.filter((fg) => fg.microserviceId !== svc.id),
                                  }));
                                });
                              }}>Delete</button>
                            </div>
                            {isSvcExpanded && (
                              <div className="settings-svc-envs">
                                {pEnvs.length === 0 && <div className="empty-hint">Add environments first.</div>}
                                {pEnvs.map((env) => {
                                  const deployed = env.id in svc.baseUrls;
                                  const isEditingThis = editingUrl?.svcId === svc.id && editingUrl?.envId === env.id;
                                  const currentUrl = svc.baseUrls[env.id] ?? '';
                                  return (
                                    <div key={env.id} className={`settings-env-row ${deployed ? 'deployed' : ''}`}>
                                      <label className="settings-env-check">
                                        <input type="checkbox" checked={deployed} onChange={() => {
                                          modifyProject(prj.id, (p) => ({
                                            ...p,
                                            microservices: p.microservices.map((s) => {
                                              if (s.id !== svc.id) return s;
                                              const next = { ...s.baseUrls };
                                              if (env.id in next) delete next[env.id]; else next[env.id] = '';
                                              return { ...s, baseUrls: next };
                                            }),
                                          }));
                                        }} />
                                        <span className="settings-env-name">{env.name}</span>
                                      </label>
                                      {deployed && (
                                        isEditingThis && editingUrl ? (
                                          <div className="settings-url-edit">
                                            <input className="settings-env-url" autoFocus value={editingUrl.value}
                                              onChange={(e) => setEditingUrl({ ...editingUrl, value: e.target.value })}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  modifyProject(prj.id, (p) => ({
                                                    ...p,
                                                    microservices: p.microservices.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [env.id]: editingUrl.value } } : s),
                                                  }));
                                                  setEditingUrl(null);
                                                }
                                                if (e.key === 'Escape') setEditingUrl(null);
                                              }}
                                              placeholder={`https://${svc.name}.${env.name}.example.com`} />
                                            <button type="button" className="btn btn-primary btn-xs" onClick={() => {
                                              modifyProject(prj.id, (p) => ({
                                                ...p,
                                                microservices: p.microservices.map((s) => s.id === svc.id ? { ...s, baseUrls: { ...s.baseUrls, [env.id]: editingUrl.value } } : s),
                                              }));
                                              setEditingUrl(null);
                                            }}>Save</button>
                                            <button type="button" className="btn btn-xs" onClick={() => setEditingUrl(null)}>Cancel</button>
                                          </div>
                                        ) : (
                                          <div className="settings-url-display">
                                            {currentUrl ? <code className="settings-url-value">{currentUrl}</code> : <span className="settings-url-placeholder">No URL configured</span>}
                                            <button type="button" className="btn btn-xs" onClick={() => setEditingUrl({ svcId: svc.id, envId: env.id, value: currentUrl })}>Edit</button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="settings-project-subsection">
                    <h5>Auth Profiles</h5>
                    <div className="settings-add-row">
                      <input placeholder="Profile name (e.g. dev-oauth2)" value={editingProjectId === prj.id ? newProfileName : ''} onChange={(e) => setNewProfileName(e.target.value)} onKeyDown={(e) => {
                        if (e.key === 'Enter' && newProfileName.trim()) {
                          const id = uuidv4();
                          modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, { id, name: newProfileName.trim(), auth: { type: 'none' } }] }));
                          setNewProfileName('');
                          setEditingGlobalAuth(id);
                        }
                      }} />
                      <button type="button" className="btn btn-primary btn-xs" onClick={() => {
                        if (!newProfileName.trim()) return;
                        const id = uuidv4();
                        modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, { id, name: newProfileName.trim(), auth: { type: 'none' } }] }));
                        setNewProfileName('');
                        setEditingGlobalAuth(id);
                      }} disabled={!newProfileName.trim()}>Add</button>
                    </div>

                    {pAuth.length === 0 && <div className="empty-hint">No auth profiles yet.</div>}
                    {pAuth.map((profile) => {
                      const isAuthEditing = editingGlobalAuth === profile.id;
                      const pa = profile.auth;
                      return (
                        <div key={profile.id} className="global-auth-profile-card">
                          <div className="global-auth-profile-header">
                            <input className="global-auth-profile-name" value={profile.name} onChange={(e) => {
                              modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, name: e.target.value } : a) }));
                            }} />
                            <span className={`auth-badge ${pa.type === 'none' ? 'auth-badge-none' : `auth-badge-type-${pa.type}`}`}>{pa.type === 'none' ? 'No Auth' : pa.type.toUpperCase()}</span>
                            <button type="button" className="btn btn-xs" onClick={() => { setEditingGlobalAuth(isAuthEditing ? null : profile.id); setAuthVerifyResult(null); setShowSecret(false); }}>{isAuthEditing ? 'Collapse' : 'Configure'}</button>
                            <select className="auth-xfer-select" defaultValue="" onChange={(e) => {
                              const val = e.target.value; e.target.value = '';
                              if (!val) return;
                              const [action, destType, destId] = val.split(':');
                              const addToTarget = () => {
                                if (destType === 'global') {
                                  if (appGlobalAuthProfiles.some((a) => a.id === profile.id)) { alert('Already exists in Global.'); return false; }
                                  setAppGlobalAuthProfiles((prev) => [...prev, profile]);
                                } else {
                                  const tgt = projects.find((p) => p.id === destId);
                                  if (tgt?.globalAuthProfiles.some((a) => a.id === profile.id)) { alert(`Already exists in "${tgt.name}".`); return false; }
                                  modifyProject(destId, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, profile] }));
                                }
                                return true;
                              };
                              if (action === 'copy') { addToTarget(); }
                              else if (action === 'move') {
                                const destName = destType === 'global' ? 'Global' : projects.find((p) => p.id === destId)?.name ?? '';
                                confirm(`Move "${profile.name}" to "${destName}"?`, () => {
                                  if (addToTarget()) modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.filter((a) => a.id !== profile.id) }));
                                });
                              }
                            }}>
                              <option value="">Copy/Move...</option>
                              <optgroup label="Copy to">
                                <option value={`copy:global:`}>Global</option>
                                {projects.filter((op) => op.id !== prj.id).map((op) => <option key={op.id} value={`copy:project:${op.id}`}>{op.name}</option>)}
                              </optgroup>
                              <optgroup label="Move to">
                                <option value={`move:global:`}>Global</option>
                                {projects.filter((op) => op.id !== prj.id).map((op) => <option key={op.id} value={`move:project:${op.id}`}>{op.name}</option>)}
                              </optgroup>
                            </select>
                            <button type="button" className="btn btn-xs btn-danger" onClick={() => {
                              confirm(`Delete auth profile "${profile.name}"?`, () => {
                                modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.filter((a) => a.id !== profile.id) }));
                                if (editingGlobalAuth === profile.id) setEditingGlobalAuth(null);
                              });
                            }}>Delete</button>
                          </div>
                          {isAuthEditing && (
                            <div className="global-auth-profile-body">
                              <div className="auth-type-select">
                                <label>Type</label>
                                <select value={pa.type} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, type: e.target.value as AuthType } } : a) }))}>
                                  <option value="none">No Auth</option>
                                  <option value="basic">Basic Auth</option>
                                  <option value="bearer">Bearer Token</option>
                                  <option value="apikey">API Key</option>
                                  <option value="digest">Digest Auth</option>
                                  <option value="oauth2">OAuth2 Client Credentials</option>
                                </select>
                              </div>
                              {pa.type === 'basic' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a) }))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a) }))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                              {pa.type === 'bearer' && (<div className="form-row two-col"><div><label>Token</label><input value={pa.token || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, token: e.target.value } } : a) }))} placeholder="eyJhbGciOi..." /></div><div><label>Prefix</label><input value={pa.prefix ?? 'Bearer'} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, prefix: e.target.value } } : a) }))} placeholder="Bearer" /></div></div>)}
                              {pa.type === 'apikey' && (<><div className="form-row two-col"><div><label>Key Name</label><input value={pa.apiKeyName || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyName: e.target.value } } : a) }))} placeholder="X-API-Key" /></div><div><label>Key Value</label><input value={pa.apiKeyValue || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyValue: e.target.value } } : a) }))} placeholder="your-api-key" /></div></div><div className="form-row"><label>Add to</label><div className="radio-group"><label className="radio-label"><input type="radio" checked={pa.apiKeyIn !== 'query'} onChange={() => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'header' } } : a) }))} />Header</label><label className="radio-label"><input type="radio" checked={pa.apiKeyIn === 'query'} onChange={() => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'query' } } : a) }))} />Query Parameter</label></div></div></>)}
                              {pa.type === 'digest' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a) }))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a) }))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                              {pa.type === 'oauth2' && (<><div className="form-row"><label>Token URL</label><input value={pa.tokenUrl || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, tokenUrl: e.target.value } } : a) }))} placeholder="https://auth.example.com/oauth/token" /></div><div className="form-row two-col"><div><label>Client ID</label><input value={pa.clientId || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientId: e.target.value } } : a) }))} /></div><div><label>Client Secret</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.clientSecret || ''} onChange={(e) => modifyProject(prj.id, (p) => ({ ...p, globalAuthProfiles: p.globalAuthProfiles.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientSecret: e.target.value } } : a) }))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div></>)}
                              {pa.type !== 'none' && (
                                <div className="auth-verify-section">
                                  <button type="button" className="btn btn-sm btn-verify" onClick={() => verifyProfileAuth(pa)} disabled={authVerifying}>{authVerifying ? 'Verifying...' : 'Verify Auth'}</button>
                                  {authVerifyResult && (<div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}><span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>{authVerifyResult.msg}</div>)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: '0.8em', opacity: 0.5, marginTop: 8, textAlign: 'right' }}>
                    Created: {new Date(prj.createdAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
