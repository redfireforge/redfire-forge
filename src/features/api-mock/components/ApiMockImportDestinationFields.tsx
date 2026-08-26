import type { RefObject } from 'react';
import type { ApiMockRouteFolderV1 } from '@shared/api-mock/contracts';

interface Props {
  folders: ApiMockRouteFolderV1[];
  folderRef: RefObject<HTMLDivElement | null>;
  folderDisplayLabel: string;
  folderSelection: string;
  folderDropdownOpen: boolean;
  setFolderDropdownOpen: (open: boolean | ((o: boolean) => boolean)) => void;
  setFolderSelection: (id: string) => void;
  isCreatingFolder: boolean;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  priority: string;
  setPriority: (value: string) => void;
}

export function ApiMockImportDestinationFields({
  folders,
  folderRef,
  folderDisplayLabel,
  folderSelection,
  folderDropdownOpen,
  setFolderDropdownOpen,
  setFolderSelection,
  isCreatingFolder,
  newFolderName,
  setNewFolderName,
  priority,
  setPriority,
}: Props) {
  return (
    <div className="am-form-grid" style={{ marginTop: 10 }}>
      <div className="am-form-row">
        <div className="am-form-label">Folder</div>
        <div className="am-form-control">
          <div className="am-folder-select" ref={folderRef}>
            <button
              type="button"
              className="am-folder-trigger"
              onClick={() => setFolderDropdownOpen(o => !o)}
              data-testid="api-mock-import-folder"
            >
              <span className="am-folder-value">{folderDisplayLabel}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {folderDropdownOpen && (
              <div className="am-folder-menu" data-testid="api-mock-import-folder-menu">
                {folders.map(f => (
                  <button
                    type="button"
                    key={f.id}
                    className={`am-folder-option${folderSelection === f.id ? ' active' : ''}`}
                    onClick={() => { setFolderSelection(f.id); setFolderDropdownOpen(false); }}
                  >
                    {f.name}
                  </button>
                ))}
                {folders.length > 0 && <div className="am-folder-divider" />}
                <button
                  type="button"
                  className={`am-folder-option${folderSelection === '__new__' ? ' active' : ''}`}
                  onClick={() => { setFolderSelection('__new__'); setFolderDropdownOpen(false); }}
                  data-testid="api-mock-import-folder-new"
                >
                  + Create new folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {isCreatingFolder && (
        <div className="am-form-row">
          <div className="am-form-label">Name</div>
          <div className="am-form-control">
            <input
              className="am-input"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder name…"
              autoFocus
              data-testid="api-mock-import-new-folder-name"
            />
          </div>
        </div>
      )}
      <div className="am-form-row">
        <div className="am-form-label">Priority</div>
        <div className="am-form-control">
          <input className="am-input num mono" type="number" value={priority} onChange={e => setPriority(e.target.value)} data-testid="api-mock-import-priority" />
        </div>
      </div>
    </div>
  );
}
