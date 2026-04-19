import { useState } from 'react';
import type { RequestCollection, RequestFolder } from '../../types';
import { collectAllGroups, collectGroupIds, countGroupRequests, findFolderDeep, findSiblingFolders, countFolderReqs } from '../../utils/requestTree';
import type { CtxMenuData } from './RequestsSidebar';

interface Props {
  contextMenu: CtxMenuData;
  collections: RequestCollection[];
  nonGroupCollections: RequestCollection[];
  showMoveMenu: boolean;
  showFolderMoveMenu: boolean;
  setShowMoveMenu: (v: boolean) => void;
  setShowFolderMoveMenu: (v: boolean) => void;
  dismiss: () => void;
  onNewRequest: (colId: string, folderId?: string) => void;
  onEditCollection: (col: RequestCollection) => void;
  onDuplicateCollection: (colId: string) => void;
  onDeleteCollection: (colId: string) => void;
  onEditSubCollection: (colId: string, folderId: string) => void;
  onDuplicateFolder: (colId: string, folderId: string) => void;
  onDuplicateRequest: (colId: string, reqId: string) => void;
  onDeleteFolder: (colId: string, folderId: string) => void;
  onDeleteRequest: (colId: string, reqId: string) => void;
  onMoveFolder: (colId: string, folderId: string, direction: 'up' | 'down') => void;
  onMoveFolderTo: (colId: string, folderId: string, targetParentFolderId: string | null) => void;
  onMoveRequest: (colId: string, reqId: string, targetFolderId: string | null) => void;
  onMoveRequestToCollection: (srcColId: string, reqId: string, destColId: string, destFolderId: string | null) => void;
  onMoveFolderToCollection: (srcColId: string, folderId: string, destColId: string, destParentFolderId: string | null) => void;
  onMergeCollectionInto: (srcColId: string, destColId: string) => void;
  countAllRequests: (col: RequestCollection) => number;
  startAddFolder: (colId: string, parentFolderId: string | undefined, isSubCollection: boolean) => void;
  startRenameFolder: (colId: string, folderId: string, currentName: string) => void;
  handleExportCollection: (colId: string) => void;
  handleExportFolder: (colId: string, folderId: string) => void;
  handleImportToCollection: (colId?: string, targetGroupId?: string) => void;
  handleImportToFolder: (colId: string, folderId: string) => void;
  setConfirmDelete: (v: { message: string; onConfirm: () => void } | null) => void;
  onNewCollection: (mode?: 'direct' | 'multi-env', groupId?: string) => void;
  startAddGroup: (parentGroupId?: string) => void;
  startRenameGroup: (groupId: string, currentName: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDuplicateGroup: (groupId: string) => void;
  onMoveToGroup: (colId: string, targetGroupId: string | undefined) => void;
  handleExportGroup: (groupId: string) => void;
}

function collectAllFolders(folders: RequestFolder[], depth = 0): { folder: RequestFolder; depth: number }[] {
  const result: { folder: RequestFolder; depth: number }[] = [];
  for (const f of folders) {
    result.push({ folder: f, depth });
    result.push(...collectAllFolders(f.folders ?? [], depth + 1));
  }
  return result;
}

function findReqInFoldersDeep(folders: RequestFolder[], reqId: string): string | undefined {
  for (const f of folders) {
    if (f.requests.some(r => r.id === reqId)) return f.id;
    const deep = findReqInFoldersDeep(f.folders ?? [], reqId);
    if (deep) return deep;
  }
  return undefined;
}

function findRequestLocation(col: RequestCollection, reqId: string): string | null | undefined {
  if (col.requests.some(r => r.id === reqId)) return null;
  return findReqInFoldersDeep(col.folders ?? [], reqId);
}

function findParentFolderId(folders: RequestFolder[], targetId: string): string | null | undefined {
  for (const f of folders) {
    if ((f.folders ?? []).some(sf => sf.id === targetId)) return f.id;
    const deep = findParentFolderId(f.folders ?? [], targetId);
    if (deep !== undefined) return deep;
  }
  return undefined;
}

function getFolderLocation(col: RequestCollection, folderId: string): string | null | undefined {
  if ((col.folders ?? []).some(f => f.id === folderId)) return null;
  return findParentFolderId(col.folders ?? [], folderId);
}

function isAncestorOf(folders: RequestFolder[], ancestorId: string, descendantId: string): boolean {
  const ancestor = findFolderDeep(folders, ancestorId);
  if (!ancestor) return false;
  return !!findFolderDeep(ancestor.folders ?? [], descendantId);
}

function findRequestName(col: RequestCollection, reqId: string): string {
  const root = col.requests.find(r => r.id === reqId);
  if (root) return root.name || 'Untitled';
  function findInFolders(folders: RequestFolder[]): string | null {
    for (const f of folders) {
      const r = f.requests.find(r => r.id === reqId);
      if (r) return r.name || 'Untitled';
      const deep = findInFolders(f.folders ?? []);
      if (deep) return deep;
    }
    return null;
  }
  return findInFolders(col.folders ?? []) ?? 'Untitled';
}

export default function SidebarContextMenu({
  contextMenu, collections, nonGroupCollections,
  showMoveMenu, showFolderMoveMenu,
  setShowMoveMenu, setShowFolderMoveMenu, dismiss,
  onNewRequest, onEditCollection, onDuplicateCollection, onDeleteCollection,
  onEditSubCollection, onDuplicateFolder, onDuplicateRequest,
  onDeleteFolder, onDeleteRequest,
  onMoveFolder, onMoveFolderTo, onMoveRequest,
  onMoveRequestToCollection, onMoveFolderToCollection, onMergeCollectionInto,
  countAllRequests, startAddFolder, startRenameFolder,
  handleExportCollection, handleExportFolder,
  handleImportToCollection, handleImportToFolder,
  setConfirmDelete,
  onNewCollection, startAddGroup, startRenameGroup,
  onDeleteGroup, onDuplicateGroup, onMoveToGroup, handleExportGroup,
}: Props) {
  const [showColMoveMenu, setShowColMoveMenu] = useState(false);
  const ctxCol = collections.find(c => c.id === contextMenu.colId) ?? null;
  const ctxReqLocation = contextMenu.type === 'request' && ctxCol && contextMenu.reqId
    ? findRequestLocation(ctxCol, contextMenu.reqId) : undefined;
  const ctxFolderLocation = contextMenu.type === 'folder' && ctxCol && contextMenu.folderId
    ? getFolderLocation(ctxCol, contextMenu.folderId) : undefined;

  const allGroupsFlat = collectAllGroups(collections);

  return (
    <div className="req-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}>

      {/* ── Group context menu ── */}
      {contextMenu.type === 'group' && (() => {
        const group = collections.find(c => c.id === contextMenu.colId);
        if (!group) return null;
        const groupReqCount = countGroupRequests(group.id, collections);
        return (<>
          <button onClick={() => { startAddGroup(contextMenu.colId); }}>Add Group</button>
          <button onClick={() => { onNewCollection('direct', contextMenu.colId); dismiss(); }}>Add URL Collection</button>
          <button onClick={() => { onNewCollection('multi-env', contextMenu.colId); dismiss(); }}>Add ENV Collection</button>
          <hr className="req-ctx-divider" />
          <button onClick={() => startRenameGroup(contextMenu.colId, group.name)}>Rename</button>
          <button onClick={() => { onDuplicateGroup(contextMenu.colId); dismiss(); }}>Duplicate Group</button>

          {(allGroupsFlat.length > (group.groupId ? 0 : 1) || group.groupId) && (() => {
            const descendantIds = new Set(collectGroupIds(contextMenu.colId, collections));
            return (
            <div className="req-ctx-submenu-wrapper">
              <button onClick={() => setShowColMoveMenu(!showColMoveMenu)}>
                Move to... <span className="req-ctx-arrow">&#9656;</span>
              </button>
              {showColMoveMenu && (
                <div className="req-ctx-submenu">
                  {group.groupId && (
                    <button onClick={() => { onMoveToGroup(contextMenu.colId, undefined); dismiss(); setShowColMoveMenu(false); }}>
                      &#128203; Root level
                    </button>
                  )}
                  {allGroupsFlat
                    .filter(({ group: g }) => !descendantIds.has(g.id) && g.id !== group.groupId)
                    .map(({ group: g, depth }) => (
                      <button key={g.id} style={{ paddingLeft: 8 + depth * 12 }} onClick={() => { onMoveToGroup(contextMenu.colId, g.id); dismiss(); setShowColMoveMenu(false); }}>
                        &#128450;&#65039; {g.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
            );
          })()}

          <hr className="req-ctx-divider" />
          <button onClick={() => handleExportGroup(contextMenu.colId)}>Export Group</button>
          <button onClick={() => handleImportToCollection(undefined, contextMenu.colId)}>Import into Group</button>
          <hr className="req-ctx-divider" />
          <button className="danger" onClick={() => {
            dismiss();
            setConfirmDelete({
              message: `Delete group "${group.name}"? Its ${groupReqCount > 0 ? `${groupReqCount} request${groupReqCount !== 1 ? 's' : ''} and ` : ''}children will be moved to the parent level.`,
              onConfirm: () => onDeleteGroup(contextMenu.colId),
            });
          }}>Delete Group</button>
        </>);
      })()}

      {/* ── Collection context menu ── */}
      {contextMenu.type === 'collection' && (<>
        <button onClick={() => { onNewRequest(contextMenu.colId); dismiss(); }}>Add Request</button>
        <button onClick={() => startAddFolder(contextMenu.colId, undefined, false)}>Add Folder</button>
        <button onClick={() => startAddFolder(contextMenu.colId, undefined, true)}>Add Sub-Collection</button>
        <button onClick={() => { const col = collections.find(c => c.id === contextMenu.colId); if (col) onEditCollection(col); dismiss(); }}>Edit Collection</button>
        <button onClick={() => { onDuplicateCollection(contextMenu.colId); dismiss(); }}>Duplicate Collection</button>
        <div className="req-ctx-submenu-wrapper">
          <button onClick={() => setShowColMoveMenu(!showColMoveMenu)}>
            Move to... <span className="req-ctx-arrow">&#9656;</span>
          </button>
          {showColMoveMenu && (
            <div className="req-ctx-submenu">
              {ctxCol?.groupId && (
                <button onClick={() => { onMoveToGroup(contextMenu.colId, undefined); dismiss(); setShowColMoveMenu(false); }}>
                  &#128203; Root level
                </button>
              )}
              {allGroupsFlat
                .filter(({ group: g }) => g.id !== ctxCol?.groupId)
                .map(({ group: g, depth }) => (
                  <button key={g.id} style={{ paddingLeft: 8 + depth * 12 }} onClick={() => { onMoveToGroup(contextMenu.colId, g.id); dismiss(); setShowColMoveMenu(false); }}>
                    &#128450;&#65039; {g.name}
                  </button>
                ))}
              {nonGroupCollections.filter(c => c.id !== contextMenu.colId).length > 0 && allGroupsFlat.length > 0 && (
                <div className="req-dropdown-divider" />
              )}
              {nonGroupCollections.filter(c => c.id !== contextMenu.colId).map(c => (
                <button key={c.id} onClick={() => { onMergeCollectionInto(contextMenu.colId, c.id); dismiss(); setShowColMoveMenu(false); }}>
                  &#128230; {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <hr className="req-ctx-divider" />
        <button onClick={() => handleExportCollection(contextMenu.colId)}>Export Collection</button>
        <button onClick={() => handleImportToCollection(contextMenu.colId)}>Import into Collection</button>
        <hr className="req-ctx-divider" />
        <button className="danger" onClick={() => {
          const colId = contextMenu.colId;
          const col = collections.find(c => c.id === colId);
          const reqCount = col ? countAllRequests(col) : 0;
          const msg = `Delete collection "${col?.name ?? ''}"${reqCount > 0 ? ` and its ${reqCount} request${reqCount > 1 ? 's' : ''}` : ''}?`;
          dismiss();
          setConfirmDelete({ message: msg, onConfirm: () => onDeleteCollection(colId) });
        }}>Delete Collection</button>
      </>)}

      {/* ── Folder context menu ── */}
      {contextMenu.type === 'folder' && contextMenu.folderId && (() => {
        const ctxFolder = findFolderDeep(ctxCol?.folders ?? [], contextMenu.folderId!);
        const isSub = ctxFolder?.isSubCollection;
        return (<>
          <button onClick={() => { onNewRequest(contextMenu.colId, contextMenu.folderId); dismiss(); }}>Add Request</button>
          <button onClick={() => startAddFolder(contextMenu.colId, contextMenu.folderId, false)}>Add Folder</button>
          <button onClick={() => startAddFolder(contextMenu.colId, contextMenu.folderId, true)}>Add Sub-Collection</button>
          {isSub && (
            <button onClick={() => { onEditSubCollection(contextMenu.colId, contextMenu.folderId!); dismiss(); }}>Edit Settings</button>
          )}
          <button onClick={() => {
            const col = collections.find(c => c.id === contextMenu.colId);
            const folder = findFolderDeep(col?.folders ?? [], contextMenu.folderId!);
            if (folder) startRenameFolder(contextMenu.colId, contextMenu.folderId!, folder.name);
          }}>Rename</button>
          {(() => {
            const col = collections.find(c => c.id === contextMenu.colId);
            const siblings = findSiblingFolders(col?.folders ?? [], contextMenu.folderId!);
            if (!siblings) return null;
            const idx = siblings.findIndex(f => f.id === contextMenu.folderId);
            return (<>
              {idx > 0 && <button onClick={() => { onMoveFolder(contextMenu.colId, contextMenu.folderId!, 'up'); dismiss(); }}>Move Up</button>}
              {idx < siblings.length - 1 && <button onClick={() => { onMoveFolder(contextMenu.colId, contextMenu.folderId!, 'down'); dismiss(); }}>Move Down</button>}
            </>);
          })()}
          {ctxCol && (
            <div className="req-ctx-submenu-wrapper">
              <button onClick={() => setShowFolderMoveMenu(!showFolderMoveMenu)}>
                Move to... <span className="req-ctx-arrow">&#9656;</span>
              </button>
              {showFolderMoveMenu && (
                <div className="req-ctx-submenu">
                  {ctxFolderLocation !== null && (
                    <button onClick={() => { onMoveFolderTo(contextMenu.colId, contextMenu.folderId!, null); dismiss(); setShowFolderMoveMenu(false); }}>
                      &#128203; Collection Root
                    </button>
                  )}
                  {collectAllFolders(ctxCol.folders ?? [])
                    .filter(({ folder: f }) =>
                      f.id !== contextMenu.folderId &&
                      f.id !== ctxFolderLocation &&
                      !isAncestorOf(ctxCol.folders ?? [], contextMenu.folderId!, f.id)
                    )
                    .map(({ folder: f, depth }) => (
                      <button key={f.id} style={{ paddingLeft: 8 + depth * 12 }} onClick={() => {
                        onMoveFolderTo(contextMenu.colId, contextMenu.folderId!, f.id);
                        dismiss(); setShowFolderMoveMenu(false);
                      }}>
                        &#128193; {f.name}
                      </button>
                    ))}
                  {nonGroupCollections.filter(c => c.id !== contextMenu.colId).length > 0 && (
                    <div className="req-dropdown-divider" />
                  )}
                  {nonGroupCollections.filter(c => c.id !== contextMenu.colId).map((c) => (
                    <div key={c.id}>
                      <button onClick={() => { onMoveFolderToCollection(contextMenu.colId, contextMenu.folderId!, c.id, null); dismiss(); setShowFolderMoveMenu(false); }}>
                        &#128230; {c.name}
                      </button>
                      {collectAllFolders(c.folders ?? []).map(({ folder: f, depth }) => (
                        <button key={f.id} style={{ paddingLeft: 20 + depth * 12 }} onClick={() => { onMoveFolderToCollection(contextMenu.colId, contextMenu.folderId!, c.id, f.id); dismiss(); setShowFolderMoveMenu(false); }}>
                          &#128193; {f.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => { onDuplicateFolder(contextMenu.colId, contextMenu.folderId!); dismiss(); }}>
            {isSub ? 'Duplicate Sub-Collection' : 'Duplicate Folder'}
          </button>
          <hr className="req-ctx-divider" />
          <button onClick={() => handleExportFolder(contextMenu.colId, contextMenu.folderId!)}>
            {isSub ? 'Export Sub-Collection' : 'Export Folder'}
          </button>
          <button onClick={() => handleImportToFolder(contextMenu.colId, contextMenu.folderId!)}>
            {isSub ? 'Import into Sub-Collection' : 'Import into Folder'}
          </button>
          <hr className="req-ctx-divider" />
          <button className="danger" onClick={() => {
            const colId = contextMenu.colId;
            const folderId = contextMenu.folderId!;
            const targetFolder = findFolderDeep(ctxCol?.folders ?? [], folderId);
            const folderReqs = targetFolder ? countFolderReqs(targetFolder) : 0;
            const label = isSub ? 'sub-collection' : 'folder';
            const msg = `Delete ${label} "${ctxFolder?.name ?? ''}"${folderReqs > 0 ? ` and its ${folderReqs} request${folderReqs > 1 ? 's' : ''}` : ''}?`;
            dismiss();
            setConfirmDelete({ message: msg, onConfirm: () => onDeleteFolder(colId, folderId) });
          }}>
            {isSub ? 'Delete Sub-Collection' : 'Delete Folder'}
          </button>
        </>);
      })()}

      {/* ── Request context menu ── */}
      {contextMenu.type === 'request' && contextMenu.reqId && (<>
        <button onClick={() => { onDuplicateRequest(contextMenu.colId, contextMenu.reqId!); dismiss(); }}>Duplicate</button>

        {ctxCol && (
          <div className="req-ctx-submenu-wrapper">
            <button onClick={() => setShowMoveMenu(!showMoveMenu)}>
              Move to... <span className="req-ctx-arrow">&#9656;</span>
            </button>
            {showMoveMenu && (
              <div className="req-ctx-submenu">
                {ctxReqLocation !== null && (
                  <button onClick={() => { onMoveRequest(contextMenu.colId, contextMenu.reqId!, null); dismiss(); setShowMoveMenu(false); }}>
                    &#128203; Collection Root
                  </button>
                )}
                {collectAllFolders(ctxCol.folders ?? []).filter(({ folder: f }) => f.id !== ctxReqLocation).map(({ folder: f, depth }) => (
                  <button key={f.id} style={{ paddingLeft: 8 + depth * 12 }} onClick={() => { onMoveRequest(contextMenu.colId, contextMenu.reqId!, f.id); dismiss(); setShowMoveMenu(false); }}>
                    &#128193; {f.name}
                  </button>
                ))}
                {nonGroupCollections.filter(c => c.id !== contextMenu.colId).length > 0 && (
                  <div className="req-dropdown-divider" />
                )}
                {nonGroupCollections.filter(c => c.id !== contextMenu.colId).map((c) => (
                  <div key={c.id}>
                    <button onClick={() => { onMoveRequestToCollection(contextMenu.colId, contextMenu.reqId!, c.id, null); dismiss(); setShowMoveMenu(false); }}>
                      &#128230; {c.name}
                    </button>
                    {collectAllFolders(c.folders ?? []).map(({ folder: f, depth }) => (
                      <button key={f.id} style={{ paddingLeft: 20 + depth * 12 }} onClick={() => { onMoveRequestToCollection(contextMenu.colId, contextMenu.reqId!, c.id, f.id); dismiss(); setShowMoveMenu(false); }}>
                        &#128193; {f.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button className="danger" onClick={() => {
          const colId = contextMenu.colId;
          const reqId = contextMenu.reqId!;
          const col = collections.find(c => c.id === colId);
          const reqName = col ? findRequestName(col, reqId) : 'Untitled';
          dismiss();
          setConfirmDelete({ message: `Delete request "${reqName}"?`, onConfirm: () => onDeleteRequest(colId, reqId) });
        }}>Delete</button>
      </>)}
    </div>
  );
}
