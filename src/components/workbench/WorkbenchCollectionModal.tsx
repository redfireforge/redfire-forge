import { useState, useMemo } from 'react';
import type { WorkbenchCollection, WorkbenchEnv, Project, AuthConfig } from '../../types';

interface Props {
  collection: WorkbenchCollection | null;
  environments: WorkbenchEnv[];
  projects: Project[];
  onSave: (col: Omit<WorkbenchCollection, 'id' | 'requests'> & { id?: string }) => void;
  onClose: () => void;
}

export default function WorkbenchCollectionModal({ collection, environments, projects, onSave, onClose }: Props) {
  const [name, setName] = useState(collection?.name ?? '');
  const [mode, setMode] = useState<'direct' | 'multi-env'>(collection?.mode ?? 'direct');
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>(collection?.baseUrls ?? {});
  const [authType, setAuthType] = useState<'none' | 'bearer'>(
    collection?.auth?.type === 'bearer' ? 'bearer' : 'none'
  );
  const [bearerToken, setBearerToken] = useState(collection?.auth?.token ?? '');
  const [importProjectId, setImportProjectId] = useState('');

  const handleBaseUrlChange = (envId: string, url: string) => {
    setBaseUrls((prev) => ({ ...prev, [envId]: url }));
  };

  const handleImportFromProject = () => {
    const proj = projects.find((p) => p.id === importProjectId);
    if (!proj) return;
    const merged = { ...baseUrls };
    for (const svc of proj.microservices) {
      for (const env of proj.environments) {
        const wbEnv = environments.find((e) => e.name === env.name);
        if (wbEnv && svc.baseUrls[env.id]) {
          if (!merged[wbEnv.id]) merged[wbEnv.id] = svc.baseUrls[env.id];
        }
      }
    }
    setBaseUrls(merged);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const auth: AuthConfig | undefined = authType === 'bearer'
      ? { type: 'bearer', token: bearerToken }
      : undefined;
    onSave({
      ...(collection ? { id: collection.id } : {}),
      name: name.trim(),
      mode,
      baseUrls: mode === 'multi-env' ? baseUrls : undefined,
      auth,
    });
  };

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="modal wb-col-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <h3>{collection ? 'Edit Collection' : 'New Collection'}</h3>
          <button className="wb-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="wb-modal-body">
          <div className="wb-form-group">
            <label>Collection Name</label>
            <input
              className="wb-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. veh-metadata, weather-api"
              autoFocus
            />
          </div>

          <div className="wb-form-group">
            <label>URL Mode</label>
            <div className="wb-mode-switcher">
              <button
                className={`wb-mode-btn ${mode === 'direct' ? 'active' : ''}`}
                onClick={() => setMode('direct')}
              >
                <strong>Direct URL</strong>
                <span>Full URLs per request</span>
              </button>
              <button
                className={`wb-mode-btn ${mode === 'multi-env' ? 'active' : ''}`}
                onClick={() => setMode('multi-env')}
              >
                <strong>Multi-Environment</strong>
                <span>Base URLs + relative paths</span>
              </button>
            </div>
          </div>

          {mode === 'multi-env' && (
            <div className="wb-form-group">
              <label>Base URLs per Environment</label>
              {environments.length === 0 ? (
                <p className="wb-hint">
                  No environments defined yet. Use the gear icon in the sidebar to manage environments.
                </p>
              ) : (
                <div className="wb-base-url-list">
                  {environments.map((env) => (
                    <div key={env.id} className="wb-base-url-row">
                      <span className="wb-env-label">{env.name}</span>
                      <input
                        className="wb-input"
                        value={baseUrls[env.id] ?? ''}
                        onChange={(e) => handleBaseUrlChange(env.id, e.target.value)}
                        placeholder={`https://${name || 'service'}.${env.name}.example.com`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {projects.length > 0 && (
                <div className="wb-import-from-project">
                  <select
                    className="wb-select"
                    value={importProjectId}
                    onChange={(e) => setImportProjectId(e.target.value)}
                  >
                    <option value="">Import base URLs from project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn btn-sm"
                    disabled={!importProjectId}
                    onClick={handleImportFromProject}
                  >
                    Import
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="wb-form-group">
            <label>Default Auth (optional)</label>
            <select
              className="wb-select"
              value={authType}
              onChange={(e) => setAuthType(e.target.value as 'none' | 'bearer')}
            >
              <option value="none">No Auth</option>
              <option value="bearer">Bearer Token</option>
            </select>
            {authType === 'bearer' && (
              <input
                className="wb-input"
                style={{ marginTop: 8 }}
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Token"
              />
            )}
          </div>
        </div>

        <div className="wb-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {collection ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
