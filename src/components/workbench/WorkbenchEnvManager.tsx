import { useState } from 'react';
import type { WorkbenchEnv, Project } from '../../types';

interface Props {
  environments: WorkbenchEnv[];
  projects: Project[];
  onAdd: (name: string) => void;
  onRemove: (envId: string) => void;
  onImport: (envs: { name: string }[]) => void;
  onClose: () => void;
}

export default function WorkbenchEnvManager({ environments, projects, onAdd, onRemove, onImport, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [importProjectId, setImportProjectId] = useState('');

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (environments.some((e) => e.name === trimmed)) return;
    onAdd(trimmed);
    setNewName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  const handleImport = () => {
    const proj = projects.find((p) => p.id === importProjectId);
    if (!proj) return;
    onImport(proj.environments.map((e) => ({ name: e.name })));
    setImportProjectId('');
  };

  return (
    <div className="wb-modal-overlay" onClick={onClose}>
      <div className="modal wb-env-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wb-modal-header">
          <h3>Workbench Environments</h3>
          <button className="wb-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="wb-modal-body">
          <p className="wb-hint">
            Define environment names (e.g. d01, t01, p01) used across your collections.
          </p>

          <div className="wb-env-add-row">
            <input
              className="wb-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="New environment name"
              autoFocus
            />
            <button className="btn btn-sm btn-primary" onClick={handleAdd} disabled={!newName.trim()}>
              Add
            </button>
          </div>

          {projects.length > 0 && (
            <div className="wb-import-from-project" style={{ marginTop: 12 }}>
              <select
                className="wb-select"
                value={importProjectId}
                onChange={(e) => setImportProjectId(e.target.value)}
              >
                <option value="">Import from project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button className="btn btn-sm" disabled={!importProjectId} onClick={handleImport}>
                Import
              </button>
            </div>
          )}

          <div className="wb-env-list">
            {environments.length === 0 && (
              <div className="wb-sidebar-empty">No environments yet.</div>
            )}
            {environments.map((env) => (
              <div key={env.id} className="wb-env-item">
                <span className="wb-env-name">{env.name}</span>
                <button className="wb-icon-btn danger" onClick={() => onRemove(env.id)} title="Remove">
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="wb-modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
