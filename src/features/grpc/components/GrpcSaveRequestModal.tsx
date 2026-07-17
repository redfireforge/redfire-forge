import { useEffect, useMemo, useState } from 'react';
import type { GrpcCollectionV1 } from '../../../shared/grpc/grpcPersistenceSchema';
import {
  createGrpcSavedRequestFromSnapshot,
  defaultGrpcSavedRequestName,
} from '../../../shared/grpc/grpcSavedRequest';
import { createGrpcSavedRequestIdentity } from '../../../shared/grpc/grpcPersistenceSchema';
import type { GrpcTabExecuteSnapshot } from '../../../shared/grpc/contracts';
import type { GrpcSavedRequestTabContext } from '../../../shared/grpc/grpcReplayTemplateCompatibility';

const DEFAULT_NEW_COLLECTION_NAME = 'Saved Requests';

export type GrpcSaveSnapshotResolveResult = {
  snapshot: GrpcTabExecuteSnapshot | null;
  errorMessage?: string;
  tabContext?: GrpcSavedRequestTabContext;
};

export interface GrpcSaveRequestModalProps {
  open: boolean;
  collections: GrpcCollectionV1[];
  resolveSnapshot: () => GrpcSaveSnapshotResolveResult;
  defaultName?: string;
  onClose: () => void;
  onSave: (collectionId: string, saved: ReturnType<typeof createGrpcSavedRequestFromSnapshot>) => Promise<void>;
  onCreateCollection?: (name: string) => Promise<GrpcCollectionV1>;
}

export function GrpcSaveRequestModal({
  open,
  collections,
  resolveSnapshot,
  defaultName,
  onClose,
  onSave,
  onCreateCollection,
}: GrpcSaveRequestModalProps) {
  const [name, setName] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [previewSnapshot, setPreviewSnapshot] = useState<GrpcTabExecuteSnapshot | null>(null);

  useEffect(() => {
    if (!open) return;
    const { snapshot, errorMessage } = resolveSnapshot();
    setPreviewSnapshot(snapshot);
    setName(defaultName ?? (snapshot
      ? defaultGrpcSavedRequestName(snapshot.service, snapshot.method)
      : ''));
    setCollectionId(collections[0]?.id ?? '');
    setNewCollectionName(collections.length === 0 ? DEFAULT_NEW_COLLECTION_NAME : '');
    setError(errorMessage);
  }, [open, resolveSnapshot, defaultName, collections]);

  const canSave = Boolean(previewSnapshot && name.trim() && (collectionId || newCollectionName.trim()));

  const collectionOptions = useMemo(
    () => collections.map((collection) => (
      <option key={collection.id} value={collection.id}>{collection.name}</option>
    )),
    [collections],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    const { snapshot, errorMessage, tabContext } = resolveSnapshot();
    if (!snapshot) {
      setError(errorMessage ?? 'Select a method and configure the request before saving.');
      return;
    }
    if (!name.trim() || !(collectionId || newCollectionName.trim())) return;
    setBusy(true);
    setError(undefined);
    try {
      let targetCollectionId = collectionId;
      const trimmedNewName = newCollectionName.trim();
      if (trimmedNewName && onCreateCollection) {
        const existingByName = collections.find((collection) => collection.name === trimmedNewName);
        if (existingByName) {
          targetCollectionId = existingByName.id;
        } else {
          const created = await onCreateCollection(trimmedNewName);
          targetCollectionId = created.id;
        }
      } else if (!targetCollectionId && onCreateCollection) {
        const created = await onCreateCollection(DEFAULT_NEW_COLLECTION_NAME);
        targetCollectionId = created.id;
      }
      if (!targetCollectionId) {
        setError('Select or create a collection');
        return;
      }
      const identity = createGrpcSavedRequestIdentity(
        globalThis.crypto?.randomUUID?.() ?? `sr-${Date.now()}`,
      );
      const saved = createGrpcSavedRequestFromSnapshot(snapshot, {
        ...identity,
        name: name.trim(),
      }, tabContext);
      await onSave(targetCollectionId, saved);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grpc-save-request-modal" data-testid="grpc-save-request-modal" role="dialog" aria-label="Save request to collection">
      <header className="grpc-save-request-modal__header">
        <h2 className="grpc-save-request-modal__title">Save request</h2>
      </header>
      <div className="grpc-save-request-modal__body">
        {!previewSnapshot && !error && (
          <p className="grpc-save-request-modal__hint">Select a method and configure the request before saving.</p>
        )}
        <label className="grpc-form-row">
          <span className="grpc-form-row__label">Name</span>
          <input
            className="grpc-form-row__input"
            data-testid="grpc-save-request-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy || !previewSnapshot}
          />
        </label>
        <label className="grpc-form-row">
          <span className="grpc-form-row__label">Collection</span>
          <select
            className="grpc-form-row__input"
            data-testid="grpc-save-request-collection"
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
            disabled={busy || collections.length === 0}
          >
            {collections.length === 0 && <option value="">No collections yet</option>}
            {collectionOptions}
          </select>
        </label>
        {onCreateCollection && (
          <label className="grpc-form-row">
            <span className="grpc-form-row__label">Or new collection</span>
            <input
              className="grpc-form-row__input"
              data-testid="grpc-save-request-new-collection"
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              placeholder="Collection name"
              disabled={busy}
            />
          </label>
        )}
        {error && <p className="grpc-save-request-modal__error" role="alert">{error}</p>}
      </div>
      <footer className="grpc-save-request-modal__footer">
        <button type="button" className="grpc-btn grpc-btn--ghost" data-testid="grpc-save-request-cancel" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="grpc-btn grpc-btn--primary" data-testid="grpc-save-request-submit" onClick={() => { void handleSubmit(); }} disabled={!canSave || busy}>
          Save
        </button>
      </footer>
    </div>
  );
}
