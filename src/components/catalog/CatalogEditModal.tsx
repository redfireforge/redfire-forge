import { useState, useCallback } from 'react';
import type { CatalogEntry, CatalogEnvironment } from '../../types/catalog';

interface Props {
  entry: CatalogEntry;
  onSave: (patch: Partial<CatalogEntry>) => void;
  onClose: () => void;
}

function newId() {
  return `env-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function CatalogEditModal({ entry, onSave, onClose }: Props) {
  const [envs, setEnvs] = useState<CatalogEnvironment[]>(() => entry.environments ?? []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', baseUrl: '' });

  const startAdd = useCallback(() => {
    const id = newId();
    setDraft({ name: '', baseUrl: '' });
    setEditingId(id);
    setEnvs(prev => [...prev, { id, name: '', baseUrl: '' }]);
  }, []);

  const startEdit = useCallback((env: CatalogEnvironment) => {
    setEditingId(env.id);
    setDraft({ name: env.name, baseUrl: env.baseUrl });
  }, []);

  const cancelEdit = useCallback(() => {
    if (editingId) {
      setEnvs(prev => prev.filter(e => !(e.id === editingId && !e.name && !e.baseUrl)));
    }
    setEditingId(null);
    setDraft({ name: '', baseUrl: '' });
  }, [editingId]);

  const confirmEdit = useCallback(() => {
    if (!editingId || !draft.name.trim() || !draft.baseUrl.trim()) return;
    setEnvs(prev => prev.map(e => e.id === editingId ? { ...e, name: draft.name.trim(), baseUrl: draft.baseUrl.trim() } : e));
    setEditingId(null);
    setDraft({ name: '', baseUrl: '' });
  }, [editingId, draft]);

  const removeEnv = useCallback((id: string) => {
    setEnvs(prev => prev.filter(e => e.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft({ name: '', baseUrl: '' });
    }
  }, [editingId]);

  const handleSave = useCallback(() => {
    const validEnvs = envs.filter(e => e.name.trim() && e.baseUrl.trim());
    const activeId = entry.activeEnvironmentId;
    const stillValid = validEnvs.some(e => e.id === activeId);
    onSave({
      environments: validEnvs,
      activeEnvironmentId: stillValid ? activeId : undefined,
      ...(entry.hostConfig.strategy === 'environment' && !stillValid
        ? { hostConfig: { ...entry.hostConfig, strategy: 'inherited', environmentId: undefined } }
        : {}),
    });
    onClose();
  }, [envs, entry, onSave, onClose]);

  return (
    <div className="cat-modal-overlay" onClick={onClose}>
      <div className="cat-modal" onClick={e => e.stopPropagation()}>
        <div className="cat-modal-header">
          <h3>Edit — {entry.name}</h3>
          <button className="cat-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="cat-modal-body">
          <div className="cat-edit-section">
            <div className="cat-edit-section-header">
              <h4 className="cat-edit-section-title">Environments</h4>
              <button className="cat-btn-sm" onClick={startAdd} disabled={editingId !== null}>
                + Add
              </button>
            </div>
            <p className="cat-edit-hint">
              Define environments with base URLs. Select one in the host bar to use it for requests.
            </p>

            {envs.length === 0 && !editingId && (
              <div className="cat-edit-empty">
                No environments configured. Click "+ Add" to create one.
              </div>
            )}

            <div className="cat-edit-env-list">
              {envs.map(env => (
                <div key={env.id} className={`cat-edit-env-item ${editingId === env.id ? 'editing' : ''}`}>
                  {editingId === env.id ? (
                    <div className="cat-edit-env-form">
                      <div className="cat-edit-env-field">
                        <label>Name</label>
                        <input
                          className="cep-field-input"
                          placeholder="e.g. Test, Staging, Production"
                          value={draft.name}
                          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                          autoFocus
                        />
                      </div>
                      <div className="cat-edit-env-field">
                        <label>Base URL</label>
                        <input
                          className="cep-field-input"
                          placeholder="https://api.example.com/v1"
                          value={draft.baseUrl}
                          onChange={e => setDraft(d => ({ ...d, baseUrl: e.target.value }))}
                        />
                      </div>
                      <div className="cat-edit-env-actions">
                        <button className="cat-btn cat-btn-primary" onClick={confirmEdit} disabled={!draft.name.trim() || !draft.baseUrl.trim()}>
                          Save
                        </button>
                        <button className="cat-btn" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="cat-edit-env-row">
                      <div className="cat-edit-env-info">
                        <span className="cat-edit-env-name">{env.name}</span>
                        <code className="cat-edit-env-url">{env.baseUrl}</code>
                      </div>
                      <div className="cat-edit-env-btns">
                        <button className="cat-btn-xs" onClick={() => startEdit(env)} disabled={editingId !== null}>
                          Edit
                        </button>
                        <button className="cat-btn-xs cat-btn-xs-danger" onClick={() => removeEnv(env.id)} disabled={editingId !== null}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cat-modal-footer">
          <button className="cat-btn" onClick={onClose}>Cancel</button>
          <button className="cat-btn cat-btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
