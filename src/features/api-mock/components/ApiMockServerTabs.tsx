import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent as RKeyboardEvent } from 'react';
import type { ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { computeDropIndex } from '../../../shared/components/studio-tabs/computeDropIndex';
import {
  buildContextMenuItems,
  useTabContextMenu,
} from '../../../shared/components/studio-tabs/TabContextMenu';
import { handleTabListArrowKeys } from '../../../shared/utils/tabListKeyboard';
import { API_MOCK_MAX_TABS } from '../apiMockPageHelpers';
import { PlusIcon, XIcon } from './ApiMockIcons';

export type ApiMockRuntimeStatus = 'stopped' | 'starting' | 'running' | 'draining' | 'applying' | 'error';

/** Panel id the server tabs control (the workspace region). */
export const API_MOCK_WORKSPACE_PANEL_ID = 'api-mock-workspace-panel';

const DND_MIME = 'text/x-api-mock-tab-index';

function transferHasType(dt: DataTransfer, mime: string): boolean {
  return Array.from((dt.types ?? []) as ArrayLike<string>).includes(mime);
}

interface Props {
  servers: ApiMockServerDefinitionV1[];
  activeServerId?: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
  /** Close several tabs in one confirm (Close others / Close to the right). */
  onCloseMany?: (ids: string[]) => void;
  /** Permanently remove the server from the saved library (context menu only). */
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** Optional per-server runtime status; defaults to 'stopped'. */
  statusById?: Record<string, ApiMockRuntimeStatus>;
  /** Optional per-server dirty flag (unapplied draft changes). */
  dirtyById?: Record<string, boolean>;
  /** When true, omit outer chrome so the tablist nests in the title bar (mockup 01). */
  embedded?: boolean;
}

const STATUS_TITLE: Record<ApiMockRuntimeStatus, string> = {
  stopped: 'Stopped', starting: 'Starting', running: 'Running',
  draining: 'Draining', applying: 'Applying', error: 'Error',
};

export function ApiMockServerTabs({
  servers,
  activeServerId,
  onSelect,
  onCreate,
  onClose,
  onCloseMany,
  onDelete,
  onRename,
  onDuplicate,
  onReorder,
  statusById,
  dirtyById,
  embedded = false,
}: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);
  const ctxMenu = useTabContextMenu();
  const atLimit = servers.length >= API_MOCK_MAX_TABS;

  const startEditing = useCallback((id: string, currentName: string) => {
    if (!onRename) return;
    skipCommitRef.current = false;
    setEditingTabId(id);
    setEditValue(currentName);
  }, [onRename]);

  useEffect(() => {
    if (!editingTabId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingTabId]);

  const commitEdit = useCallback(() => {
    if (skipCommitRef.current) {
      setEditingTabId(null);
      return;
    }
    if (editingTabId && editValue.trim()) onRename?.(editingTabId, editValue.trim());
    skipCommitRef.current = true;
    setEditingTabId(null);
  }, [editingTabId, editValue, onRename]);

  const onKeyDown = (e: RKeyboardEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'F2') {
      const el = document.activeElement as HTMLElement | null;
      const id = el?.getAttribute('data-server-id');
      const srv = id ? servers.find(s => s.id === id) : undefined;
      if (srv) {
        e.preventDefault();
        startEditing(srv.id, srv.name);
        return;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const el = document.activeElement as HTMLElement | null;
      const id = el?.getAttribute('data-server-id');
      if (id) { e.preventDefault(); onClose(id); return; }
    }
    handleTabListArrowKeys(e);
  };

  const handleContextMenuAction = useCallback((actionId: string) => {
    const tabId = ctxMenu.menuState?.tabId;
    if (!tabId) return;
    const srv = servers.find(s => s.id === tabId);
    if (!srv) return;
    const idx = servers.findIndex(s => s.id === tabId);
    switch (actionId) {
      case 'rename':
        startEditing(tabId, srv.name);
        break;
      case 'duplicate':
        onDuplicate?.(tabId);
        break;
      case 'copy-label':
        void navigator.clipboard.writeText(srv.name);
        break;
      case 'close':
        onClose(tabId);
        break;
      case 'close-others': {
        const ids = servers.filter(s => s.id !== tabId).map(s => s.id);
        if (onCloseMany) onCloseMany(ids);
        else ids.forEach(id => onClose(id));
        break;
      }
      case 'close-right': {
        const ids = servers.slice(idx + 1).map(s => s.id);
        if (onCloseMany) onCloseMany(ids);
        else ids.forEach(id => onClose(id));
        break;
      }
      case 'delete':
        onDelete?.(tabId);
        break;
    }
  }, [ctxMenu.menuState, servers, startEditing, onDuplicate, onClose, onCloseMany, onDelete]);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, index: number, tabId: string) => {
    if (editingTabId || !onReorder) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(DND_MIME, String(index));
    setDraggingTabId(tabId);
  }, [editingTabId, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDropSide(null);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, tabId: string) => {
    if (!onReorder || !transferHasType(e.dataTransfer, DND_MIME)) return;
    if (tabId === draggingTabId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOverTabId(tabId);
    setDropSide(e.clientX < rect.left + rect.width / 2 ? 'before' : 'after');
  }, [onReorder, draggingTabId]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (!onReorder || !transferHasType(e.dataTransfer, DND_MIME)) {
      handleDragEnd();
      return;
    }
    const from = Number(e.dataTransfer.getData(DND_MIME));
    if (!Number.isInteger(from) || from < 0) {
      handleDragEnd();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const to = computeDropIndex(from, targetIndex, e.clientX, rect.left, rect.width);
    handleDragEnd();
    if (to == null) return;
    onReorder(from, to);
  }, [onReorder, handleDragEnd]);

  return (
    <div
      className={`api-mock-server-tabs${embedded ? ' embedded' : ''}`}
      role="tablist"
      aria-label="Mock server tabs"
      data-testid="api-mock-server-tabs"
      onKeyDown={onKeyDown}
    >
      {servers.map((srv, index) => {
        const status = statusById?.[srv.id] ?? 'stopped';
        const dirty = dirtyById?.[srv.id] ?? false;
        const active = srv.id === activeServerId;
        const isEditing = editingTabId === srv.id;
        const dropClass = dragOverTabId === srv.id && dropSide
          ? dropSide === 'before' ? ' am-server-tab-drop-before' : ' am-server-tab-drop-after'
          : '';
        return (
          <div
            key={srv.id}
            id={`api-mock-tabhdr-${srv.id}`}
            role="tab"
            aria-selected={active}
            aria-controls={API_MOCK_WORKSPACE_PANEL_ID}
            tabIndex={active ? 0 : -1}
            data-server-id={srv.id}
            draggable={!isEditing && Boolean(onReorder)}
            className={`am-server-tab${active ? ' active' : ''}${draggingTabId === srv.id ? ' dragging' : ''}${dropClass}`}
            onClick={() => { if (!isEditing) onSelect(srv.id); }}
            onDoubleClick={() => startEditing(srv.id, srv.name)}
            onContextMenu={e => ctxMenu.openMenu(srv.id, e)}
            onDragStart={e => handleDragStart(e, index, srv.id)}
            onDragEnd={handleDragEnd}
            onDragOver={e => handleDragOver(e, srv.id)}
            onDrop={e => handleDrop(e, index)}
            title={`${srv.name} — ${STATUS_TITLE[status]}${dirty ? ' · unapplied changes' : ''}`}
            data-testid={`api-mock-tab-${srv.id}`}
          >
            <span className={`am-status-dot ${status}`} title={STATUS_TITLE[status]} />
            {isEditing ? (
              <input
                ref={inputRef}
                className="am-server-tab-rename"
                value={editValue}
                maxLength={64}
                aria-label={`Rename ${srv.name}`}
                data-testid={`api-mock-tab-rename-${srv.id}`}
                onChange={e => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onClick={e => e.stopPropagation()}
                onDoubleClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') commitEdit();
                  else if (e.key === 'Escape') {
                    skipCommitRef.current = true;
                    commitEdit();
                  }
                }}
              />
            ) : (
              <span className="am-server-tab-label">
                <span className="am-server-tab-name">{srv.name}</span>
                <span className="am-server-tab-port">:{srv.port}</span>
              </span>
            )}
            {dirty && <span className="am-dirty-dot" title="Unapplied changes" aria-label="Unapplied changes" role="img" />}
            <span
              className="am-tab-close"
              role="button"
              tabIndex={-1}
              aria-label={`Close ${srv.name}`}
              title={`Close ${srv.name} — rules stay in Saved servers`}
              onClick={e => { e.stopPropagation(); onClose(srv.id); }}
              data-testid={`api-mock-tab-close-${srv.id}`}
            ><XIcon size={12} /></span>
          </div>
        );
      })}
      <button
        type="button"
        className="am-icon-btn"
        aria-label="New mock server"
        title={atLimit ? `Maximum ${API_MOCK_MAX_TABS} open tabs — close one first` : 'New mock server'}
        disabled={atLimit}
        onClick={() => { if (!atLimit) onCreate(); }}
        data-testid="api-mock-tab-add"
      ><PlusIcon /></button>
      {ctxMenu.renderMenu(
        ctxMenu.menuState
          ? buildContextMenuItems({
              tabId: ctxMenu.menuState.tabId,
              tabLabel: servers.find(s => s.id === ctxMenu.menuState!.tabId)?.name ?? '',
              tabIndex: servers.findIndex(s => s.id === ctxMenu.menuState!.tabId),
              totalTabs: servers.length,
              canDuplicate: !atLimit && Boolean(onDuplicate),
              canClose: true,
              extraItems: onDelete
                ? [{ id: 'delete', label: 'Delete Server…', dividerBefore: true, danger: true }]
                : [],
            })
          : [],
        handleContextMenuAction,
      )}
    </div>
  );
}
