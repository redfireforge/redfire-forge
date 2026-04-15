import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Project, GlobalAuthProfile, AuthType } from '../types';
import { useAuthVerify } from '../hooks/useAuthVerify';
import { getStorageUsage, getMaxRuns } from '../utils/storage';
import SettingsProjectsTab from './SettingsProjectsTab';
import SettingsStorageTab from './SettingsStorageTab';

export interface SettingsModalProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  selectedProjectId: string;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  setAppGlobalAuthProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>;
  modifyProject: (projectId: string, fn: (p: Project) => Project) => void;
  onClose: () => void;
  onProjectSwitch: (projectId: string) => void;
  onAddProject: (name: string, desc?: string) => void;
  onRemoveProject: (id: string) => void;
  onUpdateProjectMeta: (id: string, updates: { name?: string; description?: string }) => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function SettingsModal({
  projects,
  setProjects,
  selectedProjectId,
  appGlobalAuthProfiles,
  setAppGlobalAuthProfiles,
  modifyProject,
  onClose,
  onProjectSwitch,
  onAddProject,
  onRemoveProject,
  onUpdateProjectMeta,
  onOpenExport,
  onOpenImport,
  confirm,
}: SettingsModalProps) {
  const [settingsTab, setSettingsTab] = useState<'projects' | 'globalAuth' | 'exportImport' | 'storage'>('projects');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newEnvName, setNewEnvName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [editingBaseUrls, setEditingBaseUrls] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState<{ svcId: string; envId: string; value: string } | null>(null);
  const [maxRunsLocal, setMaxRunsLocal] = useState(50);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; entries: Record<string, number> }>({ usedBytes: 0, entries: {} });
  const [storageExpanded, setStorageExpanded] = useState(false);
  const [editingGlobalAuth, setEditingGlobalAuth] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newGlobalProfileName, setNewGlobalProfileName] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const { authVerifying, authVerifyResult, setAuthVerifyResult, verifyAuth: verifyProfileAuth } = useAuthVerify();

  useEffect(() => {
    void (async () => {
      const [usage, maxR] = await Promise.all([getStorageUsage(), getMaxRuns()]);
      setStorageUsage(usage);
      setMaxRunsLocal(maxR);
    })();
  }, []);

  return (
    <div className="modal-overlay settings-overlay" onClick={onClose}>
      <div className="modal settings-modal settings-modal-split" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Settings</h3>
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
        <div className="settings-split">
          <nav className="settings-nav">
            <button type="button" className={`settings-nav-item ${settingsTab === 'projects' ? 'active' : ''}`} onClick={() => setSettingsTab('projects')}>Projects</button>
            <button type="button" className={`settings-nav-item ${settingsTab === 'globalAuth' ? 'active' : ''}`} onClick={() => setSettingsTab('globalAuth')}>Global Auth Profiles</button>
            <button type="button" className={`settings-nav-item ${settingsTab === 'exportImport' ? 'active' : ''}`} onClick={() => setSettingsTab('exportImport')}>Export & Import</button>
            <button type="button" className={`settings-nav-item ${settingsTab === 'storage' ? 'active' : ''}`} onClick={() => setSettingsTab('storage')}>Storage</button>
          </nav>
          <div className="settings-content">

            {settingsTab === 'projects' && (
              <SettingsProjectsTab
                projects={projects}
                setProjects={setProjects}
                selectedProjectId={selectedProjectId}
                modifyProject={modifyProject}
                newProjectName={newProjectName}
                setNewProjectName={setNewProjectName}
                newProjectDesc={newProjectDesc}
                setNewProjectDesc={setNewProjectDesc}
                editingProjectId={editingProjectId}
                setEditingProjectId={setEditingProjectId}
                newEnvName={newEnvName}
                setNewEnvName={setNewEnvName}
                newSvcName={newSvcName}
                setNewSvcName={setNewSvcName}
                editingBaseUrls={editingBaseUrls}
                setEditingBaseUrls={setEditingBaseUrls}
                editingUrl={editingUrl}
                setEditingUrl={setEditingUrl}
                appGlobalAuthProfiles={appGlobalAuthProfiles}
                setAppGlobalAuthProfiles={setAppGlobalAuthProfiles}
                editingGlobalAuth={editingGlobalAuth}
                setEditingGlobalAuth={setEditingGlobalAuth}
                newProfileName={newProfileName}
                setNewProfileName={setNewProfileName}
                showSecret={showSecret}
                setShowSecret={setShowSecret}
                authVerifying={authVerifying}
                authVerifyResult={authVerifyResult}
                verifyProfileAuth={verifyProfileAuth}
                setAuthVerifyResult={setAuthVerifyResult}
                onAddProject={onAddProject}
                onRemoveProject={onRemoveProject}
                onUpdateProjectMeta={onUpdateProjectMeta}
                onProjectSwitch={onProjectSwitch}
                confirm={confirm}
              />
            )}

            {settingsTab === 'globalAuth' && (
            <div className="settings-section">
              <h4>Global Auth Profiles</h4>
              <p className="settings-section-desc">
                Shared across all projects. Feature Groups can choose between these and project-level profiles.
              </p>
              <div className="settings-add-row">
                <input placeholder="Profile name (e.g. shared-oauth2, company-bearer)" value={newGlobalProfileName} onChange={(e) => setNewGlobalProfileName(e.target.value)} onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGlobalProfileName.trim()) {
                    const id = uuidv4();
                    setAppGlobalAuthProfiles((prev) => [...prev, { id, name: newGlobalProfileName.trim(), auth: { type: 'none' } }]);
                    setNewGlobalProfileName('');
                    setEditingGlobalAuth(id);
                  }
                }} />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => {
                  if (!newGlobalProfileName.trim()) return;
                  const id = uuidv4();
                  setAppGlobalAuthProfiles((prev) => [...prev, { id, name: newGlobalProfileName.trim(), auth: { type: 'none' } }]);
                  setNewGlobalProfileName('');
                  setEditingGlobalAuth(id);
                }} disabled={!newGlobalProfileName.trim()}>Add</button>
              </div>

              {appGlobalAuthProfiles.length === 0 && <div className="empty-hint">No global auth profiles yet.</div>}
              {appGlobalAuthProfiles.map((profile) => {
                const isAuthEditing = editingGlobalAuth === profile.id;
                const pa = profile.auth;
                return (
                  <div key={profile.id} className="global-auth-profile-card">
                    <div className="global-auth-profile-header">
                      <input className="global-auth-profile-name" value={profile.name} onChange={(e) => {
                        setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, name: e.target.value } : a));
                      }} />
                      <span className={`auth-badge ${pa.type === 'none' ? 'auth-badge-none' : `auth-badge-type-${pa.type}`}`}>{pa.type === 'none' ? 'No Auth' : pa.type.toUpperCase()}</span>
                      <button type="button" className="btn btn-sm" onClick={() => { setEditingGlobalAuth(isAuthEditing ? null : profile.id); setAuthVerifyResult(null); setShowSecret(false); }}>{isAuthEditing ? 'Collapse' : 'Configure'}</button>
                      {projects.length > 0 && (
                        <select className="auth-xfer-select" defaultValue="" onChange={(e) => {
                          const val = e.target.value; e.target.value = '';
                          if (!val) return;
                          const [action, destId] = val.split(':');
                          const tgt = projects.find((p) => p.id === destId);
                          if (!tgt) return;
                          if (tgt.globalAuthProfiles.some((a) => a.id === profile.id)) { alert(`Already exists in "${tgt.name}".`); return; }
                          if (action === 'copy') {
                            modifyProject(destId, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, profile] }));
                          } else if (action === 'move') {
                            confirm(`Move "${profile.name}" to "${tgt.name}"?`, () => {
                              modifyProject(destId, (p) => ({ ...p, globalAuthProfiles: [...p.globalAuthProfiles, profile] }));
                              setAppGlobalAuthProfiles((prev) => prev.filter((a) => a.id !== profile.id));
                            });
                          }
                        }}>
                          <option value="">Copy/Move...</option>
                          <optgroup label="Copy to">
                            {projects.map((p) => <option key={p.id} value={`copy:${p.id}`}>{p.name}</option>)}
                          </optgroup>
                          <optgroup label="Move to">
                            {projects.map((p) => <option key={p.id} value={`move:${p.id}`}>{p.name}</option>)}
                          </optgroup>
                        </select>
                      )}
                      <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => {
                        confirm(`Delete global auth profile "${profile.name}"?`, () => {
                          setAppGlobalAuthProfiles((prev) => prev.filter((a) => a.id !== profile.id));
                          if (editingGlobalAuth === profile.id) setEditingGlobalAuth(null);
                        });
                      }}>Delete</button>
                    </div>
                    {isAuthEditing && (
                      <div className="global-auth-profile-body">
                        <div className="auth-type-select">
                          <label>Type</label>
                          <select value={pa.type} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, type: e.target.value as AuthType } } : a))}>
                            <option value="none">No Auth</option>
                            <option value="basic">Basic Auth</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="apikey">API Key</option>
                            <option value="digest">Digest Auth</option>
                            <option value="oauth2">OAuth2 Client Credentials</option>
                          </select>
                        </div>
                        {pa.type === 'basic' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                        {pa.type === 'bearer' && (<div className="form-row two-col"><div><label>Token</label><input value={pa.token || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, token: e.target.value } } : a))} placeholder="eyJhbGciOi..." /></div><div><label>Prefix</label><input value={pa.prefix ?? 'Bearer'} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, prefix: e.target.value } } : a))} placeholder="Bearer" /></div></div>)}
                        {pa.type === 'apikey' && (<><div className="form-row two-col"><div><label>Key Name</label><input value={pa.apiKeyName || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyName: e.target.value } } : a))} placeholder="X-API-Key" /></div><div><label>Key Value</label><input value={pa.apiKeyValue || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyValue: e.target.value } } : a))} placeholder="your-api-key" /></div></div><div className="form-row"><label>Add to</label><div className="radio-group"><label className="radio-label"><input type="radio" checked={pa.apiKeyIn !== 'query'} onChange={() => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'header' } } : a))} />Header</label><label className="radio-label"><input type="radio" checked={pa.apiKeyIn === 'query'} onChange={() => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, apiKeyIn: 'query' } } : a))} />Query Parameter</label></div></div></>)}
                        {pa.type === 'digest' && (<div className="form-row two-col"><div><label>Username</label><input value={pa.username || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, username: e.target.value } } : a))} /></div><div><label>Password</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.password || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, password: e.target.value } } : a))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div>)}
                        {pa.type === 'oauth2' && (<><div className="form-row"><label>Token URL</label><input value={pa.tokenUrl || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, tokenUrl: e.target.value } } : a))} placeholder="https://auth.example.com/oauth/token" /></div><div className="form-row two-col"><div><label>Client ID</label><input value={pa.clientId || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientId: e.target.value } } : a))} /></div><div><label>Client Secret</label><div className="secret-input-wrap"><input type={showSecret ? 'text' : 'password'} value={pa.clientSecret || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((a) => a.id === profile.id ? { ...a, auth: { ...pa, clientSecret: e.target.value } } : a))} /><button type="button" className="secret-toggle" onClick={() => setShowSecret((v) => !v)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button></div></div></div></>)}
                        {pa.type !== 'none' && (
                          <div className="auth-verify-section">
                            <button type="button" className="btn btn-sm btn-verify" onClick={() => verifyProfileAuth(pa)} disabled={authVerifying}>{authVerifying ? 'Verifying...' : 'Verify Auth'}</button>
                            {authVerifyResult && (<div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}><span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>{authVerifyResult.message}</div>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}

            {settingsTab === 'storage' && (
              <SettingsStorageTab
                storageUsage={storageUsage}
                setStorageUsage={setStorageUsage}
                maxRunsLocal={maxRunsLocal}
                setMaxRunsLocal={setMaxRunsLocal}
                storageExpanded={storageExpanded}
                setStorageExpanded={setStorageExpanded}
              />
            )}

            {settingsTab === 'exportImport' && (
            <div className="settings-section">
              <h4>Export & Import</h4>
              <p className="settings-section-desc">Export a project (with all its environments, microservices, auth profiles, and feature groups) or import one from a JSON file.</p>
              <div className="settings-export-import-row">
                <button type="button" className="btn btn-primary btn-sm" onClick={onOpenExport}>Export Project</button>
                <button type="button" className="btn btn-sm" onClick={onOpenImport}>Import Project</button>
              </div>
            </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
