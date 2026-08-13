import { useCallback, useEffect, useMemo, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import type { ApiMockRouteFolderV1, ApiMockRouteV1, ApiMockServerDefinitionV1 } from '../../../shared/api-mock/contracts';
import { loadApiMockWorkspace, saveApiMockWorkspace } from '../apiMockPersistence';
import { batchToRoutes, requestItemsToSources, catalogEndpointsToSources } from '../../../shared/api-mock/importParsers';

export interface ExportToApiMockItem {
  method: string;
  url?: string;
  path?: string;
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  label?: string;
}

interface Props {
  items: ExportToApiMockItem[];
  sourceKind: 'requests' | 'catalog';
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExportToApiMockModal({ items, sourceKind, onClose, onSuccess }: Props) {
  const [servers, setServers] = useState<ApiMockServerDefinitionV1[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | undefined>();
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [folderSelection, setFolderSelection] = useState<string>('__new__');
  const [newFolderName, setNewFolderName] = useState('');
  const [priority, setPriority] = useState('10');
  const [preview, setPreview] = useState<{ routes: ApiMockRouteV1[] } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadApiMockWorkspace().then(ws => {
      setServers(ws.servers);
      setActiveServerId(ws.activeServerId);
      const targetId = ws.activeServerId ?? ws.servers[0]?.id;
      if (targetId) setSelectedServerId(targetId);
    });
  }, []);

  const selectedServer = useMemo(() => servers.find(s => s.id === selectedServerId), [servers, selectedServerId]);
  const folders = useMemo(() => selectedServer?.folders ?? [], [selectedServer]);
  const serverOptions = useMemo(
    () => servers.map(s => ({ value: s.id, label: `${s.name} (:${s.port})` })),
    [servers],
  );

  useEffect(() => {
    setFolderSelection(folders.length > 0 ? folders[0].id : '__new__');
  }, [folders]);

  const isCreatingFolder = folderSelection === '__new__';
  const folderId = isCreatingFolder ? undefined : folderSelection;
  const folderOptions = useMemo(
    () => [
      ...folders.map(f => ({ value: f.id, label: f.name })),
      { value: '__new__', label: '+ Create new folder' },
    ],
    [folders],
  );

  const generatePreview = useCallback(() => {
    if (items.length === 0) return;
    const defaultPriority = parseInt(priority) || 10;
    const sources = sourceKind === 'catalog'
      ? catalogEndpointsToSources(items.map(i => ({ method: i.method, path: i.path ?? i.url ?? '/', summary: i.label })))
      : requestItemsToSources(items);
    const converted = batchToRoutes(
      { sources, diagnostics: [], lossReport: [], label: sourceKind === 'catalog' ? 'Catalog' : 'Requests' },
      { defaultPriority, folderId, sourceKind },
    );
    setPreview({ routes: converted.routes });
  }, [items, sourceKind, priority, folderId]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const handleConfirm = useCallback(async () => {
    if (!preview || !selectedServer || preview.routes.length === 0) return;

    let nextFolders = selectedServer.folders;
    let assignFolderId: string | undefined;
    if (isCreatingFolder && newFolderName.trim()) {
      const newFolder: ApiMockRouteFolderV1 = {
        id: `fld-${crypto.randomUUID().slice(0, 8)}`,
        name: newFolderName.trim(),
        expanded: true,
        sortOrder: selectedServer.folders.length,
      };
      nextFolders = [...selectedServer.folders, newFolder];
      assignFolderId = newFolder.id;
    }
    let prepared = preview.routes;
    if (assignFolderId) {
      prepared = prepared.map(r => ({ ...r, folderId: assignFolderId }));
    }
    const nextRoutes = [...selectedServer.routes, ...prepared];
    const updatedServer = { ...selectedServer, routes: nextRoutes, folders: nextFolders };
    const updatedServers = servers.map(s => s.id === selectedServer.id ? updatedServer : s);
    await saveApiMockWorkspace({ servers: updatedServers, activeServerId });
    setSaved(true);
    onSuccess?.();
    setTimeout(onClose, 800);
  }, [preview, selectedServer, isCreatingFolder, newFolderName, servers, activeServerId, onClose, onSuccess]);

  const routeCount = preview?.routes.length ?? 0;

  return (
    <AppModalFrame
      title="Export to API Mock"
      onClose={onClose}
      overlayClassName="modal-overlay am-export-mock-overlay"
      dialogClassName="modal am-export-mock-modal"
      bodyClassName="am-export-mock-scroll"
      footerClassName="am-export-mock-footer"
      showExpandButton={false}
      showResizeHandles
      minWidth={480}
      minHeight={280}
      closeOnOverlayClick={false}
      closeButtonKind="none"
      footer={
        <div className="api-mock-root am-in-modal am-export-mock-actions">
          {saved && (
            <span className="am-export-success">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Exported successfully
            </span>
          )}
          <span className="am-spacer" />
          <button className="am-btn" onClick={onClose} data-testid="export-to-mock-cancel">Cancel</button>
          <button className="am-btn primary" onClick={handleConfirm} disabled={routeCount === 0 || !selectedServer || saved} data-testid="export-to-mock-confirm">
            {saved ? 'Done' : `Export ${routeCount} route${routeCount === 1 ? '' : 's'}`}
          </button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-export-mock-body" data-testid="export-to-mock-body">
        <div className="am-export-fields">
          <label className="am-export-field">
            <span className="am-export-field-label">Server</span>
            {servers.length === 0 ? (
              <span className="am-muted" style={{ fontSize: 12 }}>No mock servers found. Create one in API Mock Studio first.</span>
            ) : (
              <CustomSelect
                value={selectedServerId}
                onChange={setSelectedServerId}
                options={serverOptions}
                className="am-cs"
                menuMatchTriggerWidth
                aria-label="Target mock server"
                data-testid="export-to-mock-server"
              />
            )}
          </label>

          <div className="am-export-field">
            <span className="am-export-field-label">Folder</span>
            <CustomSelect
              value={folderSelection}
              onChange={setFolderSelection}
              options={folderOptions}
              className="am-cs"
              menuMatchTriggerWidth
              aria-label="Target folder"
              data-testid="export-to-mock-folder"
            />
            {isCreatingFolder && (
              <input
                className="am-input"
                placeholder="New folder name…"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                data-testid="export-to-mock-new-folder"
              />
            )}
          </div>

          <label className="am-export-field am-export-field--priority">
            <span className="am-export-field-label">Priority</span>
            <input
              className="am-input mono"
              type="number"
              min={1}
              max={999}
              value={priority}
              onChange={e => setPriority(e.target.value)}
              data-testid="export-to-mock-priority"
            />
          </label>
        </div>

        {preview && routeCount > 0 && (
          <div className="am-export-route-card">
            <div className="am-section-heading">
              Generated route{routeCount > 1 ? `s (${routeCount})` : ''}
            </div>
            <div data-testid="export-to-mock-routes">
              {preview.routes.map(r => (
                <div key={r.id} className="am-export-route-item">
                  <span className={`am-method-pill ${r.method.toLowerCase()}`}>{r.method}</span>
                  <span className="am-export-route-path">{r.path.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="am-export-hint">
          Routes will be imported as <strong>inactive drafts</strong>. Enable them in API Mock Studio after review.
        </p>
      </div>
    </AppModalFrame>
  );
}
