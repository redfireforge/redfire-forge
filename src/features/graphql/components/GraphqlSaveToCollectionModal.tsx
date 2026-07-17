/**
 * SaveToCollectionModal — modal dialog for saving the current operation into a
 * GraphQL collection.
 * Extracted from GraphqlCollections.tsx to reduce its line count.
 */
import { useState, useEffect, useRef } from 'react';
import type { CollectionTree } from '../hooks/useGraphqlCollections';

export interface SaveToCollectionModalProps {
  defaultName: string;
  trees: CollectionTree[];
  operationVariables?: string;
  onSave: (collectionId: string, folderId: string | undefined, name: string) => void;
  onCancel: () => void;
}

export function SaveToCollectionModal({ defaultName, trees, operationVariables, onSave, onCancel }: SaveToCollectionModalProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(trees[0]?.collection.id ?? '');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [name, setName] = useState(defaultName || 'Unnamed operation');
  const [error, setError] = useState<string | null>(null);

  const prevFirstIdRef = useRef(trees[0]?.collection.id ?? '');
  useEffect(() => {
    const firstId = trees[0]?.collection.id ?? '';
    if (firstId && !selectedCollectionId && firstId !== prevFirstIdRef.current) {
      setSelectedCollectionId(firstId);
    }
    prevFirstIdRef.current = firstId;
  }, [trees, selectedCollectionId]);

  const selectedTree = trees.find((t) => t.collection.id === selectedCollectionId);
  const folders = selectedTree?.folders ?? [];

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!selectedCollectionId) { setError('Select a collection'); return; }
    const vars = operationVariables?.trim() ?? '';
    if (vars && vars !== '{}') {
      try {
        JSON.parse(vars);
      } catch {
        setError('Variables must be valid JSON');
        return;
      }
    }
    onSave(selectedCollectionId, selectedFolderId || undefined, name.trim());
  };

  return (
    <div
      className="gql-save-col-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Save to collection"
      data-testid="gql-save-col-modal"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <div className="gql-save-col-panel">
        <h3 className="gql-save-col-title">Save to Collection</h3>

        <label className="gql-save-col-label" htmlFor="gql-save-col-name">Name</label>
        <input
          id="gql-save-col-name"
          className="gql-save-col-input"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          autoFocus
          data-testid="gql-save-col-name"
        />

        <label className="gql-save-col-label" htmlFor="gql-save-col-collection">Collection</label>
        {trees.length === 0 ? (
          <p className="gql-save-col-empty">No collections yet. Create one first.</p>
        ) : (
          <select
            id="gql-save-col-collection"
            className="gql-save-col-select"
            value={selectedCollectionId}
            onChange={(e) => { setSelectedCollectionId(e.target.value); setSelectedFolderId(''); }}
            data-testid="gql-save-col-collection"
          >
            {trees.map((t) => (
              <option key={t.collection.id} value={t.collection.id}>{t.collection.name}</option>
            ))}
          </select>
        )}

        {folders.length > 0 && (
          <>
            <label className="gql-save-col-label" htmlFor="gql-save-col-folder">Folder (optional)</label>
            <select
              id="gql-save-col-folder"
              className="gql-save-col-select"
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              data-testid="gql-save-col-folder"
            >
              <option value="">— No folder —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </>
        )}

        {error && <p className="gql-save-col-error" role="alert">{error}</p>}

        <div className="gql-save-col-footer">
          <button
            type="button"
            className="gql-save-col-btn gql-save-col-btn--cancel"
            onClick={onCancel}
            data-testid="gql-save-col-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="gql-save-col-btn gql-save-col-btn--save"
            onClick={handleSave}
            disabled={trees.length === 0}
            data-testid="gql-save-col-save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
