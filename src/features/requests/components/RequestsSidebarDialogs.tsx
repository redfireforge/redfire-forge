import type { Dispatch, SetStateAction } from 'react';
import { METHOD_COLORS } from '../../../shared/constants/httpMethodColors';

interface ConfirmDeleteState {
  message: string;
  onConfirm: () => void;
}

interface NewRequestTarget {
  colId: string;
  folderId?: string;
}

interface DuplicateRequestTarget {
  colId: string;
  reqId: string;
}

interface SelectedRequestMeta {
  colId: string;
  name: string;
  method: string;
}

interface Props {
  confirmDelete: ConfirmDeleteState | null;
  setConfirmDelete: Dispatch<SetStateAction<ConfirmDeleteState | null>>;
  newReqTarget: NewRequestTarget | null;
  newReqName: string;
  setNewReqName: Dispatch<SetStateAction<string>>;
  newReqError: string;
  setNewReqError: Dispatch<SetStateAction<string>>;
  commitNewRequest: () => void;
  cancelNewRequest: () => void;
  dupReqTarget: DuplicateRequestTarget | null;
  dupReqName: string;
  setDupReqName: Dispatch<SetStateAction<string>>;
  dupReqError: string;
  setDupReqError: Dispatch<SetStateAction<string>>;
  commitDuplicateRequest: () => void;
  cancelDuplicateRequest: () => void;
  selectMode: boolean;
  selectedReqIds: Map<string, SelectedRequestMeta>;
  clearSelection: () => void;
  bulkDeleteConfirm: boolean;
  setBulkDeleteConfirm: Dispatch<SetStateAction<boolean>>;
  confirmBulkDelete: () => void;
  setSelectedReqIds: Dispatch<SetStateAction<Map<string, SelectedRequestMeta>>>;
}

export function RequestsSidebarDialogs({
  confirmDelete,
  setConfirmDelete,
  newReqTarget,
  newReqName,
  setNewReqName,
  newReqError,
  setNewReqError,
  commitNewRequest,
  cancelNewRequest,
  dupReqTarget,
  dupReqName,
  setDupReqName,
  dupReqError,
  setDupReqError,
  commitDuplicateRequest,
  cancelDuplicateRequest,
  selectMode,
  selectedReqIds,
  clearSelection,
  bulkDeleteConfirm,
  setBulkDeleteConfirm,
  confirmBulkDelete,
  setSelectedReqIds,
}: Props) {
  return (
    <>
      {confirmDelete && (
        <div className="req-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{confirmDelete.message}</p>
            <div className="req-confirm-actions">
              <button className="req-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="req-confirm-ok" onClick={() => { confirmDelete.onConfirm(); setConfirmDelete(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {newReqTarget && (
        <div className="req-confirm-overlay" onClick={cancelNewRequest}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()} data-testid="req-new-request-prompt">
            <p style={{ fontWeight: 500, marginBottom: 8 }}>New Request</p>
            <input
              className="req-input"
              value={newReqName}
              onChange={(e) => { setNewReqName(e.target.value); setNewReqError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitNewRequest();
                if (e.key === 'Escape') cancelNewRequest();
              }}
              placeholder="Request name"
              autoFocus
              data-testid="req-new-request-name"
            />
            {newReqError && <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '4px 0 0' }}>{newReqError}</p>}
            <div className="req-confirm-actions" style={{ marginTop: 10 }}>
              <button className="req-confirm-cancel" onClick={cancelNewRequest}>Cancel</button>
              <button className="btn btn-primary" onClick={commitNewRequest} disabled={!newReqName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {dupReqTarget && (
        <div className="req-confirm-overlay" onClick={cancelDuplicateRequest}>
          <div className="req-confirm-dialog" onClick={(e) => e.stopPropagation()} data-testid="req-dup-request-prompt">
            <p style={{ fontWeight: 500, marginBottom: 8 }}>Duplicate Request</p>
            <input
              className="req-input"
              value={dupReqName}
              onChange={(e) => { setDupReqName(e.target.value); setDupReqError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitDuplicateRequest();
                if (e.key === 'Escape') cancelDuplicateRequest();
              }}
              placeholder="Request name"
              autoFocus
              data-testid="req-dup-request-name"
            />
            {dupReqError && <p style={{ color: '#f87171', fontSize: '0.75rem', margin: '4px 0 0' }}>{dupReqError}</p>}
            <div className="req-confirm-actions" style={{ marginTop: 10 }}>
              <button className="req-confirm-cancel" onClick={cancelDuplicateRequest}>Cancel</button>
              <button className="btn btn-primary" onClick={commitDuplicateRequest} disabled={!dupReqName.trim()}>Duplicate</button>
            </div>
          </div>
        </div>
      )}

      {selectMode && (
        <div className="req-bulk-bar" data-testid="req-bulk-bar">
          <div className="req-bulk-bar__left">
            <span className="req-bulk-bar__badge">{selectedReqIds.size}</span>
            <span className="req-bulk-bar__label">selected</span>
          </div>
          <div className="req-bulk-bar__right">
            <button className="req-bulk-bar__clear" onClick={clearSelection} aria-label="Clear selection">Deselect</button>
            <button className="req-bulk-bar__delete" onClick={() => setBulkDeleteConfirm(true)} data-testid="req-bulk-delete" aria-label="Delete selected">
              Delete
            </button>
          </div>
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="req-confirm-overlay" onClick={() => setBulkDeleteConfirm(false)}>
          <div className="req-bulk-modal" onClick={(e) => e.stopPropagation()} data-testid="req-bulk-delete-confirm">
            <div className="req-bulk-modal__header">
              <h3 className="req-bulk-modal__title">Delete {selectedReqIds.size} request{selectedReqIds.size > 1 ? 's' : ''}</h3>
              <button className="req-bulk-modal__close" onClick={() => setBulkDeleteConfirm(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <p className="req-bulk-modal__desc">This cannot be undone. These requests will be permanently removed:</p>
            <div className="req-bulk-modal__list">
              {[...selectedReqIds.entries()].slice(0, 12).map(([id, { name, method }]) => (
                <div key={id} className="req-bulk-modal__item">
                  <span className="req-bulk-modal__method" style={{ color: METHOD_COLORS[method] || '#94a3b8' }}>{method}</span>
                  <span className="req-bulk-modal__name">{name}</span>
                  <button className="req-bulk-modal__uncheck" title="Remove from selection" aria-label={`Deselect ${name}`}
                    onClick={() => setSelectedReqIds(prev => { const next = new Map(prev); next.delete(id); return next; })}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
              {selectedReqIds.size > 12 && (
                <div className="req-bulk-modal__overflow">+{selectedReqIds.size - 12} more</div>
              )}
            </div>
            <div className="req-bulk-modal__footer">
              <button className="req-bulk-modal__cancel" onClick={() => setBulkDeleteConfirm(false)}>Cancel</button>
              <button className="req-bulk-modal__confirm" onClick={confirmBulkDelete} data-testid="req-bulk-delete-confirm-ok">
                Delete {selectedReqIds.size} request{selectedReqIds.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}