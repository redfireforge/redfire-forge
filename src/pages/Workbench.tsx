import { useState, useCallback } from 'react';
import type { Project, GlobalAuthProfile, WorkbenchCollection, WorkbenchRequest } from '../types';
import { useWorkbench } from '../hooks/useWorkbench';
import WorkbenchSidebar from '../components/workbench/WorkbenchSidebar';
import WorkbenchRequestEditor from '../components/workbench/WorkbenchRequestEditor';
import WorkbenchCollectionModal from '../components/workbench/WorkbenchCollectionModal';
import WorkbenchEnvManager from '../components/workbench/WorkbenchEnvManager';

interface Props {
  projects: Project[];
  appGlobalAuthProfiles: GlobalAuthProfile[];
}

export default function Workbench({ projects, appGlobalAuthProfiles }: Props) {
  const wb = useWorkbench();

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<WorkbenchCollection | null>(null);
  const [showEnvManager, setShowEnvManager] = useState(false);

  const handleNewCollection = useCallback(() => {
    setEditingCollection(null);
    setShowCollectionModal(true);
  }, []);

  const handleEditCollection = useCallback((col: WorkbenchCollection) => {
    setEditingCollection(col);
    setShowCollectionModal(true);
  }, []);

  const handleSaveCollection = useCallback((col: Omit<WorkbenchCollection, 'id' | 'requests'> & { id?: string }) => {
    if (col.id) {
      wb.updateCollection(col.id, { name: col.name, mode: col.mode, baseUrls: col.baseUrls, auth: col.auth });
    } else {
      wb.addCollection({ name: col.name, mode: col.mode, baseUrls: col.baseUrls, auth: col.auth });
    }
    setShowCollectionModal(false);
    setEditingCollection(null);
  }, [wb]);

  const handleNewRequest = useCallback((colId: string) => {
    wb.addRequest(colId);
  }, [wb]);

  const handleUpdateRequest = useCallback((reqPatch: Partial<WorkbenchRequest>) => {
    if (wb.selectedCollection && wb.selectedRequest) {
      wb.updateRequest(wb.selectedCollection.id, wb.selectedRequest.id, reqPatch);
    }
  }, [wb]);

  const resolveUrl = useCallback((request: WorkbenchRequest): string => {
    if (!wb.selectedCollection) return request.url;
    if (wb.selectedCollection.mode === 'direct') return request.url;
    if (request.url.startsWith('http://') || request.url.startsWith('https://')) return request.url;
    const envId = wb.selectedEnvId;
    if (!envId || !wb.selectedCollection.baseUrls?.[envId]) return request.url;
    const base = wb.selectedCollection.baseUrls[envId].replace(/\/+$/, '');
    const path = request.url.startsWith('/') ? request.url : `/${request.url}`;
    return `${base}${path}`;
  }, [wb.selectedCollection, wb.selectedEnvId]);

  if (!wb.loaded) {
    return <div className="wb-loading">Loading Workbench...</div>;
  }

  return (
    <div className="wb-container">
      <WorkbenchSidebar
        collections={wb.collections}
        selectedCollectionId={wb.selectedCollection?.id}
        selectedRequestId={wb.selectedRequest?.id}
        onSelectCollection={wb.selectCollection}
        onSelectRequest={wb.selectRequest}
        onNewCollection={handleNewCollection}
        onEditCollection={handleEditCollection}
        onDeleteCollection={wb.removeCollection}
        onNewRequest={handleNewRequest}
        onDeleteRequest={wb.removeRequest}
        onManageEnvs={() => setShowEnvManager(true)}
      />

      <div className="wb-main">
        {wb.selectedCollection && wb.selectedRequest ? (
          <WorkbenchRequestEditor
            collection={wb.selectedCollection}
            request={wb.selectedRequest}
            environments={wb.environments}
            selectedEnvId={wb.selectedEnvId}
            onEnvChange={wb.setSelectedEnvId}
            onUpdateRequest={handleUpdateRequest}
            resolveUrl={resolveUrl}
            appGlobalAuthProfiles={appGlobalAuthProfiles}
          />
        ) : (
          <div className="wb-empty-state">
            <div className="wb-empty-icon">&#128269;</div>
            <h3>No Request Selected</h3>
            <p>
              {wb.collections.length === 0
                ? 'Create a collection to get started.'
                : 'Select a request from the sidebar, or create a new one.'}
            </p>
            {wb.collections.length === 0 && (
              <button className="btn btn-primary" onClick={handleNewCollection}>
                + New Collection
              </button>
            )}
          </div>
        )}
      </div>

      {showCollectionModal && (
        <WorkbenchCollectionModal
          collection={editingCollection}
          environments={wb.environments}
          projects={projects}
          onSave={handleSaveCollection}
          onClose={() => { setShowCollectionModal(false); setEditingCollection(null); }}
        />
      )}

      {showEnvManager && (
        <WorkbenchEnvManager
          environments={wb.environments}
          projects={projects}
          onAdd={wb.addEnv}
          onRemove={wb.removeEnv}
          onImport={wb.importEnvsFromProject}
          onClose={() => setShowEnvManager(false)}
        />
      )}
    </div>
  );
}
