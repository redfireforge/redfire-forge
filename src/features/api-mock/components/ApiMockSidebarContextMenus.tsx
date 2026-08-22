import { createPortal } from 'react-dom';
import type { ApiMockServerListEntry } from '../ApiMockServerListBridge';
import { isSameOrDescendant } from '../apiMockFolderTree';

export interface CtxMenuState { id: string; name: string; x: number; y: number; }
export interface FolderMenuState { id: string; x: number; y: number; }
export interface FolderCtxMenuState { path: string; x: number; y: number; }
export interface FolderMoveMenuState { path: string; x: number; y: number; }

interface FlatFolder { path: string; name: string; depth: number; }

interface ApiMockSidebarFolderCreateRowProps {
  parent: string | undefined;
  value: string;
  isNameTaken: boolean;
  setValue: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

interface ApiMockSidebarContextMenusProps {
  entries: ApiMockServerListEntry[];
  flatFolders: FlatFolder[];
  ctxMenu: CtxMenuState | null;
  setCtxMenu: (menu: CtxMenuState | null) => void;
  folderMenu: FolderMenuState | null;
  setFolderMenu: (menu: FolderMenuState | null) => void;
  folderCtxMenu: FolderCtxMenuState | null;
  setFolderCtxMenu: (menu: FolderCtxMenuState | null) => void;
  folderMoveMenu: FolderMoveMenuState | null;
  setFolderMoveMenu: (menu: FolderMoveMenuState | null) => void;
  newFolderInput: string;
  setNewFolderInput: (value: string) => void;
  startRename: (id: string, name: string) => void;
  moveToFolder: (id: string, folder: string | undefined) => void;
  onDeleteServer: (id: string) => void;
  startFolderCreate: (parent: string | undefined) => void;
  startFolderRename: (path: string) => void;
  moveFolderInto: (source: string, destination: string | undefined) => void;
  deleteFolder: (path: string) => void;
}

export function ApiMockSidebarContextMenus({
  entries,
  flatFolders,
  ctxMenu,
  setCtxMenu,
  folderMenu,
  setFolderMenu,
  folderCtxMenu,
  setFolderCtxMenu,
  folderMoveMenu,
  setFolderMoveMenu,
  newFolderInput,
  setNewFolderInput,
  startRename,
  moveToFolder,
  onDeleteServer,
  startFolderCreate,
  startFolderRename,
  moveFolderInto,
  deleteFolder,
}: ApiMockSidebarContextMenusProps) {
  const moveMenuLeft = (baseX: number) => baseX + 155;

  return (
    <>
      {ctxMenu && createPortal(
        <>
          <div
            className="am-sidebar-ctx-backdrop"
            onClick={() => { setCtxMenu(null); setFolderMenu(null); }}
            onContextMenu={ev => { ev.preventDefault(); setCtxMenu(null); setFolderMenu(null); }}
            role="presentation"
          />
          <div
            className="am-sidebar-ctx-menu"
            style={{ top: ctxMenu.y, left: ctxMenu.x }}
            role="menu"
            data-testid="api-mock-sidebar-ctx-menu"
          >
            <button type="button" className="am-sidebar-ctx-item" role="menuitem"
              onClick={() => startRename(ctxMenu.id, ctxMenu.name)}
              data-testid="api-mock-sidebar-ctx-rename"
            >Rename</button>
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-has-arrow" role="menuitem"
              onClick={ev => { setFolderMenu(folderMenu ? null : { id: ctxMenu.id, x: ctxMenu.x, y: ev.clientY }); setNewFolderInput(''); }}
              data-testid="api-mock-sidebar-ctx-move-folder"
            >Move to folder <span className="am-sidebar-ctx-arrow">›</span></button>
            <div className="am-sidebar-ctx-divider" />
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-danger" role="menuitem"
              onClick={() => { onDeleteServer(ctxMenu.id); setCtxMenu(null); }}
              data-testid="api-mock-sidebar-ctx-delete"
            >Delete</button>
          </div>
          {folderMenu && (
            <div
              className="am-sidebar-ctx-menu am-sidebar-folder-submenu"
              style={{ top: folderMenu.y, left: moveMenuLeft(ctxMenu.x) }}
              role="menu"
              data-testid="api-mock-sidebar-folder-submenu"
            >
              {flatFolders.filter(f => f.path !== entries.find(e => e.id === folderMenu.id)?.serverFolder).map(f => (
                <button key={f.path} type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-folder" role="menuitem"
                  style={{ paddingLeft: 10 + f.depth * 14 }}
                  onClick={() => moveToFolder(folderMenu.id, f.path)}
                  data-testid={`api-mock-sidebar-move-to-${f.path}`}
                >
                  <FolderIcon />
                  {f.name}
                </button>
              ))}
              {entries.find(e => e.id === folderMenu.id)?.serverFolder && (
                <button type="button" className="am-sidebar-ctx-item" role="menuitem"
                  onClick={() => moveToFolder(folderMenu.id, undefined)}
                  data-testid="api-mock-sidebar-move-no-folder"
                >No folder</button>
              )}
              {flatFolders.length > 0 && <div className="am-sidebar-ctx-divider" />}
              <div className="am-sidebar-new-folder-row">
                <input
                  className="am-sidebar-new-folder-input"
                  placeholder="New folder…"
                  value={newFolderInput}
                  onChange={ev => setNewFolderInput(ev.target.value)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' && newFolderInput.trim()) moveToFolder(folderMenu.id, newFolderInput.trim());
                    if (ev.key === 'Escape') setFolderMenu(null);
                  }}
                  data-testid="api-mock-sidebar-new-folder-input"
                  autoFocus
                />
                <button type="button" className="am-sidebar-new-folder-btn"
                  disabled={!newFolderInput.trim()}
                  onClick={() => { if (newFolderInput.trim()) moveToFolder(folderMenu.id, newFolderInput.trim()); }}
                  data-testid="api-mock-sidebar-new-folder-btn"
                >Add</button>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}

      {folderCtxMenu && createPortal(
        <>
          <div
            className="am-sidebar-ctx-backdrop"
            onClick={() => { setFolderCtxMenu(null); setFolderMoveMenu(null); }}
            onContextMenu={ev => { ev.preventDefault(); setFolderCtxMenu(null); setFolderMoveMenu(null); }}
            role="presentation"
          />
          <div
            className="am-sidebar-ctx-menu"
            style={{ top: folderCtxMenu.y, left: folderCtxMenu.x }}
            role="menu"
            data-testid="api-mock-sidebar-folder-ctx-menu"
          >
            <button type="button" className="am-sidebar-ctx-item" role="menuitem"
              onClick={() => startFolderCreate(folderCtxMenu.path)}
              data-testid="api-mock-sidebar-folder-ctx-subfolder"
            >Create subfolder</button>
            <button type="button" className="am-sidebar-ctx-item" role="menuitem"
              onClick={() => startFolderRename(folderCtxMenu.path)}
              data-testid="api-mock-sidebar-folder-ctx-rename"
            >Rename</button>
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-has-arrow" role="menuitem"
              onClick={ev => setFolderMoveMenu(folderMoveMenu ? null : { path: folderCtxMenu.path, x: folderCtxMenu.x, y: ev.clientY })}
              data-testid="api-mock-sidebar-folder-ctx-move"
            >Move to folder <span className="am-sidebar-ctx-arrow">›</span></button>
            <div className="am-sidebar-ctx-divider" />
            <button type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-danger" role="menuitem"
              onClick={() => deleteFolder(folderCtxMenu.path)}
              data-testid="api-mock-sidebar-folder-ctx-delete"
            >Delete</button>
          </div>
          {folderMoveMenu && (
            <div
              className="am-sidebar-ctx-menu am-sidebar-folder-submenu"
              style={{ top: folderMoveMenu.y, left: moveMenuLeft(folderCtxMenu.x) }}
              role="menu"
              data-testid="api-mock-sidebar-folder-move-submenu"
            >
              <button type="button" className="am-sidebar-ctx-item" role="menuitem"
                onClick={() => moveFolderInto(folderMoveMenu.path, undefined)}
                data-testid="api-mock-sidebar-folder-move-top"
              >Top level</button>
              {flatFolders.filter(f => !isSameOrDescendant(f.path, folderMoveMenu.path)).length > 0 && <div className="am-sidebar-ctx-divider" />}
              {flatFolders.filter(f => !isSameOrDescendant(f.path, folderMoveMenu.path)).map(f => (
                <button key={f.path} type="button" className="am-sidebar-ctx-item am-sidebar-ctx-item-folder" role="menuitem"
                  style={{ paddingLeft: 10 + f.depth * 14 }}
                  onClick={() => moveFolderInto(folderMoveMenu.path, f.path)}
                  data-testid={`api-mock-sidebar-folder-move-to-${f.path}`}
                >
                  <FolderIcon />
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}

export function ApiMockSidebarFolderCreateRow({
  parent,
  value,
  isNameTaken,
  setValue,
  onConfirm,
  onCancel,
  inputRef,
}: ApiMockSidebarFolderCreateRowProps) {
  return (
    <div className="am-sidebar-folder-create-row">
      <input
        ref={inputRef}
        className="am-sidebar-folder-create-input"
        placeholder={parent ? 'Subfolder name…' : 'Folder name…'}
        value={value}
        autoFocus
        onChange={ev => setValue(ev.target.value)}
        onKeyDown={ev => {
          if (ev.key === 'Enter') { ev.preventDefault(); onConfirm(); }
          if (ev.key === 'Escape') onCancel();
        }}
        data-testid="api-mock-sidebar-folder-create-input"
      />
      <button
        type="button"
        className="am-sidebar-new-folder-btn"
        disabled={!value.trim() || isNameTaken}
        onClick={onConfirm}
        data-testid="api-mock-sidebar-folder-create-confirm"
      >Add</button>
      <button
        type="button"
        className="am-sidebar-folder-create-cancel"
        onClick={onCancel}
        title="Cancel"
      >×</button>
    </div>
  );
}

function FolderIcon() {
  return (
    <span className="am-sidebar-ctx-folder-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7A1.5 1.5 0 0 1 4.5 5.5h3.6l1.6 2H19.5A1.5 1.5 0 0 1 21 9v7.5A1.5 1.5 0 0 1 19.5 18h-15A1.5 1.5 0 0 1 3 16.5z" />
      </svg>
    </span>
  );
}