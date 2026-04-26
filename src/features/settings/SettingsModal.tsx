import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { GlobalAuthProfile, AuthType } from '../../shared/types';
import { useAuthVerify } from '../requests/hooks/useAuthVerify';
import { getStorageUsage, getMaxRuns } from '../../shared/utils/storage';
import SettingsStorageTab from './SettingsStorageTab';
import AppModalFrame from '../../shared/components/AppModalFrame';

export interface SettingsModalProps {
  appGlobalAuthProfiles: GlobalAuthProfile[];
  setAppGlobalAuthProfiles: React.Dispatch<React.SetStateAction<GlobalAuthProfile[]>>;
  onClose: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  confirm: (message: string, onConfirm: () => void) => void;
}

export default function SettingsModal({
  appGlobalAuthProfiles,
  setAppGlobalAuthProfiles,
  onClose,
  onOpenExport,
  onOpenImport,
  confirm,
}: SettingsModalProps) {
  const [settingsTab, setSettingsTab] = useState<'globalAuth' | 'exportImport' | 'storage'>('globalAuth');
  const [maxRunsLocal, setMaxRunsLocal] = useState(50);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; entries: Record<string, number> }>({ usedBytes: 0, entries: {} });
  const [storageExpanded, setStorageExpanded] = useState(false);
  const [editingGlobalAuth, setEditingGlobalAuth] = useState<string | null>(null);
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
    <AppModalFrame
      title="Settings"
      onClose={onClose}
      overlayClassName="settings-overlay"
      dialogClassName="settings-modal settings-modal-split"
      headerClassName="settings-header"
      bodyClassName="settings-split"
      closeButtonKind="text"
    >
      <nav className="settings-nav">
        <button type="button" className={`settings-nav-item ${settingsTab === 'globalAuth' ? 'active' : ''}`} onClick={() => setSettingsTab('globalAuth')}>Global Auth Profiles</button>
        <button type="button" className={`settings-nav-item ${settingsTab === 'exportImport' ? 'active' : ''}`} onClick={() => setSettingsTab('exportImport')}>Export & Import</button>
        <button type="button" className={`settings-nav-item ${settingsTab === 'storage' ? 'active' : ''}`} onClick={() => setSettingsTab('storage')}>Storage</button>
      </nav>

      <div className="settings-content">
        {settingsTab === 'globalAuth' && (
          <div className="settings-section">
            <h4>Global Auth Profiles</h4>
            <p className="settings-section-desc">
              Shared across all environments. Feature Groups and microservices can reference these profiles.
            </p>
            <div className="settings-add-row">
              <input
                placeholder="Profile name (e.g. shared-oauth2, company-bearer)"
                value={newGlobalProfileName}
                onChange={(e) => setNewGlobalProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGlobalProfileName.trim()) {
                    const id = uuidv4();
                    setAppGlobalAuthProfiles((prev) => [...prev, { id, name: newGlobalProfileName.trim(), auth: { type: 'none' } }]);
                    setNewGlobalProfileName('');
                    setEditingGlobalAuth(id);
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (!newGlobalProfileName.trim()) return;
                  const id = uuidv4();
                  setAppGlobalAuthProfiles((prev) => [...prev, { id, name: newGlobalProfileName.trim(), auth: { type: 'none' } }]);
                  setNewGlobalProfileName('');
                  setEditingGlobalAuth(id);
                }}
                disabled={!newGlobalProfileName.trim()}
              >
                Add
              </button>
            </div>

            {appGlobalAuthProfiles.length === 0 && <div className="empty-hint">No global auth profiles yet.</div>}
            {appGlobalAuthProfiles.map((profile) => {
              const isAuthEditing = editingGlobalAuth === profile.id;
              const profileAuth = profile.auth;

              return (
                <div key={profile.id} className="global-auth-profile-card">
                  <div className="global-auth-profile-header">
                    <input
                      className="global-auth-profile-name"
                      value={profile.name}
                      onChange={(e) => {
                        setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, name: e.target.value } : authProfile));
                      }}
                    />
                    <span className={`auth-badge ${profileAuth.type === 'none' ? 'auth-badge-none' : `auth-badge-type-${profileAuth.type}`}`}>
                      {profileAuth.type === 'none' ? 'No Auth' : profileAuth.type.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setEditingGlobalAuth(isAuthEditing ? null : profile.id);
                        setAuthVerifyResult(null);
                        setShowSecret(false);
                      }}
                    >
                      {isAuthEditing ? 'Collapse' : 'Configure'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-outline"
                      onClick={() => {
                        confirm(`Delete global auth profile "${profile.name}"?`, () => {
                          setAppGlobalAuthProfiles((prev) => prev.filter((authProfile) => authProfile.id !== profile.id));
                          if (editingGlobalAuth === profile.id) setEditingGlobalAuth(null);
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  {isAuthEditing && (
                    <div className="global-auth-profile-body">
                      <div className="auth-type-select">
                        <label>Type</label>
                        <select
                          value={profileAuth.type}
                          onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, type: e.target.value as AuthType } } : authProfile))}
                        >
                          <option value="none">No Auth</option>
                          <option value="basic">Basic Auth</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="apikey">API Key</option>
                          <option value="digest">Digest Auth</option>
                          <option value="oauth2">OAuth2 Client Credentials</option>
                        </select>
                      </div>

                      {profileAuth.type === 'basic' && (
                        <div className="form-row two-col">
                          <div>
                            <label>Username</label>
                            <input value={profileAuth.username || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, username: e.target.value } } : authProfile))} />
                          </div>
                          <div>
                            <label>Password</label>
                            <div className="secret-input-wrap">
                              <input type={showSecret ? 'text' : 'password'} value={profileAuth.password || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, password: e.target.value } } : authProfile))} />
                              <button type="button" className="secret-toggle" onClick={() => setShowSecret((value) => !value)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {profileAuth.type === 'bearer' && (
                        <div className="form-row two-col">
                          <div>
                            <label>Token</label>
                            <input value={profileAuth.token || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, token: e.target.value } } : authProfile))} placeholder="eyJhbGciOi..." />
                          </div>
                          <div>
                            <label>Prefix</label>
                            <input value={profileAuth.prefix ?? 'Bearer'} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, prefix: e.target.value } } : authProfile))} placeholder="Bearer" />
                          </div>
                        </div>
                      )}

                      {profileAuth.type === 'apikey' && (
                        <>
                          <div className="form-row two-col">
                            <div>
                              <label>Key Name</label>
                              <input value={profileAuth.apiKeyName || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, apiKeyName: e.target.value } } : authProfile))} placeholder="X-API-Key" />
                            </div>
                            <div>
                              <label>Key Value</label>
                              <input value={profileAuth.apiKeyValue || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, apiKeyValue: e.target.value } } : authProfile))} placeholder="your-api-key" />
                            </div>
                          </div>
                          <div className="form-row">
                            <label>Add to</label>
                            <div className="radio-group">
                              <label className="radio-label"><input type="radio" checked={profileAuth.apiKeyIn !== 'query'} onChange={() => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, apiKeyIn: 'header' } } : authProfile))} />Header</label>
                              <label className="radio-label"><input type="radio" checked={profileAuth.apiKeyIn === 'query'} onChange={() => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, apiKeyIn: 'query' } } : authProfile))} />Query Parameter</label>
                            </div>
                          </div>
                        </>
                      )}

                      {profileAuth.type === 'digest' && (
                        <div className="form-row two-col">
                          <div>
                            <label>Username</label>
                            <input value={profileAuth.username || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, username: e.target.value } } : authProfile))} />
                          </div>
                          <div>
                            <label>Password</label>
                            <div className="secret-input-wrap">
                              <input type={showSecret ? 'text' : 'password'} value={profileAuth.password || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, password: e.target.value } } : authProfile))} />
                              <button type="button" className="secret-toggle" onClick={() => setShowSecret((value) => !value)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                            </div>
                          </div>
                        </div>
                      )}

                      {profileAuth.type === 'oauth2' && (
                        <>
                          <div className="form-row">
                            <label>Token URL</label>
                            <input value={profileAuth.tokenUrl || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, tokenUrl: e.target.value } } : authProfile))} placeholder="https://auth.example.com/oauth/token" />
                          </div>
                          <div className="form-row two-col">
                            <div>
                              <label>Client ID</label>
                              <input value={profileAuth.clientId || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, clientId: e.target.value } } : authProfile))} />
                            </div>
                            <div>
                              <label>Client Secret</label>
                              <div className="secret-input-wrap">
                                <input type={showSecret ? 'text' : 'password'} value={profileAuth.clientSecret || ''} onChange={(e) => setAppGlobalAuthProfiles((prev) => prev.map((authProfile) => authProfile.id === profile.id ? { ...authProfile, auth: { ...profileAuth, clientSecret: e.target.value } } : authProfile))} />
                                <button type="button" className="secret-toggle" onClick={() => setShowSecret((value) => !value)} title={showSecret ? 'Hide' : 'Show'}>{showSecret ? '🙈' : '👁'}</button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {profileAuth.type !== 'none' && (
                        <div className="auth-verify-section">
                          <button type="button" className="btn btn-sm btn-verify" onClick={() => verifyProfileAuth(profileAuth)} disabled={authVerifying}>{authVerifying ? 'Verifying...' : 'Verify Auth'}</button>
                          {authVerifyResult && (
                            <div className={`auth-verify-result ${authVerifyResult.ok ? 'auth-verify-ok' : 'auth-verify-fail'}`}>
                              <span className="auth-verify-icon">{authVerifyResult.ok ? '✓' : '✗'}</span>
                              {authVerifyResult.message}
                            </div>
                          )}
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
            <p className="settings-section-desc">Export your environments, microservices, auth profiles, and feature groups, or import from a JSON file.</p>
            <div className="settings-export-import-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={onOpenExport}>Export Data</button>
              <button type="button" className="btn btn-sm" onClick={onOpenImport}>Import Data</button>
            </div>
          </div>
        )}
      </div>
    </AppModalFrame>
  );
}
