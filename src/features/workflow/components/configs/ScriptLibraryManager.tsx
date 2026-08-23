import { useState, useMemo } from 'react';
import type { ScriptLibrary } from '@workflow/engine/scriptLibraries';
import { createScriptLibrary, updateScriptLibrary, deleteScriptLibrary } from '@workflow/engine/scriptLibraries';
import { autoSaveVersion, findLibraryUsages } from '@workflow/engine/scriptLibraryVersioning';
import type { LibraryUsage } from '@workflow/engine/scriptLibraryVersioning';
import ScriptLibraryVersionPanel from './ScriptLibraryVersionPanel';

interface Props {
  libraries: ScriptLibrary[];
  selectedIds: string[];
  onLibrariesChange: (libraries: ScriptLibrary[]) => void;
  onSelectionChange: (ids: string[]) => void;
  onClose: () => void;
  workflows?: Array<{ id: string; name: string; nodes: Array<{ id: string; type: string; data: Record<string, unknown> }> }>;
}

export default function ScriptLibraryManager({
  libraries,
  selectedIds,
  onLibrariesChange,
  onSelectionChange,
  onClose,
  workflows = [],
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCode, setNewCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [historyLibId, setHistoryLibId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const lib = createScriptLibrary(newName, newDesc, newCode);
    onLibrariesChange([...libraries, lib]);
    setNewName('');
    setNewDesc('');
    setNewCode('');
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    onLibrariesChange(deleteScriptLibrary(libraries, id));
    onSelectionChange(selectedIds.filter(sid => sid !== id));
  };

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(sid => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSaveEdit = (id: string, name: string, description: string, code: string) => {
    // Auto-save version of the current state before applying edits
    const lib = libraries.find(l => l.id === id);
    let updatedLibs = libraries;
    if (lib) {
      const versioned = autoSaveVersion(lib);
      if (versioned !== lib) {
        updatedLibs = libraries.map(l => l.id === id ? versioned : l);
      }
    }
    onLibrariesChange(updateScriptLibrary(updatedLibs, id, { name, description, code }));
    setEditingId(null);
  };

  const handleLibraryVersionChange = (updated: ScriptLibrary) => {
    onLibrariesChange(libraries.map(l => l.id === updated.id ? updated : l));
  };

  const historyLib = historyLibId ? libraries.find(l => l.id === historyLibId) : null;

  const historyUsages = useMemo<LibraryUsage[]>(() => {
    if (!historyLibId || workflows.length === 0) return [];
    return findLibraryUsages(workflows, historyLibId);
  }, [historyLibId, workflows]);

  if (historyLib) {
    return (
      <div className="wf-script-library-manager">
        <ScriptLibraryVersionPanel
          library={historyLib}
          onLibraryChange={handleLibraryVersionChange}
          usages={historyUsages}
          onClose={() => setHistoryLibId(null)}
        />
      </div>
    );
  }

  return (
    <div className="wf-script-library-manager">
      <div className="wf-script-library-header">
        <h4>Script Libraries</h4>
      </div>

      <p className="wf-config-hint">
        Libraries provide reusable functions that are prepended to your script code. Check libraries to include them.
      </p>

      {libraries.length === 0 && !showCreate && (
        <div className="wf-script-library-empty">No libraries yet. Create one to share code across script nodes.</div>
      )}

      <div className="wf-script-library-list">
        {libraries.map(lib => (
          <div key={lib.id} className="wf-script-library-item">
            {editingId === lib.id ? (
              <LibraryEditForm
                library={lib}
                onSave={(name, desc, code) => handleSaveEdit(lib.id, name, desc, code)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <label className="wf-script-library-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lib.id)}
                    onChange={() => handleToggle(lib.id)}
                  />
                  <span className="wf-script-library-name">{lib.name}</span>
                </label>
                {lib.description && (
                  <div className="wf-script-library-desc">{lib.description}</div>
                )}
                <div className="wf-script-library-actions">
                  <button className="wf-config-add-btn" onClick={() => setEditingId(lib.id)}>Edit</button>
                  <button className="wf-config-add-btn" onClick={() => setHistoryLibId(lib.id)}>
                    History{(lib.versions?.length ?? 0) > 0 && <span className="count-badge">{lib.versions!.length}</span>}
                  </button>
                  <button className="wf-config-remove-btn" onClick={() => handleDelete(lib.id)} title="Delete">✕</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showCreate ? (
        <div className="wf-script-library-create">
          <input
            placeholder="Library name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          <textarea
            placeholder="// Reusable functions..."
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            rows={5}
          />
          <div className="wf-config-button-row">
            <button className="wf-config-add-btn" onClick={handleCreate}>Create</button>
            <button className="wf-config-add-btn" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="wf-config-add-btn" onClick={() => setShowCreate(true)}>+ New Library</button>
      )}
      <div className="wf-script-library-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function LibraryEditForm({
  library,
  onSave,
  onCancel,
}: {
  library: ScriptLibrary;
  onSave: (name: string, desc: string, code: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(library.name);
  const [desc, setDesc] = useState(library.description);
  const [code, setCode] = useState(library.code);

  return (
    <div className="wf-script-library-edit">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" />
      <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={5} />
      <div className="wf-config-button-row">
        <button className="wf-config-add-btn" onClick={() => onSave(name, desc, code)}>Save</button>
        <button className="wf-config-add-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
