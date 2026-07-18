import type { Dispatch, SetStateAction } from 'react';
import type { Environment, FeatureGroup, Microservice, RequestCollection } from '../../shared/types';
import type { Tab } from '../utils/appTabUtils';
import { domainOf, isApiTab, isHarnessTab, isWorkflowTab } from '../utils/appTabUtils';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import type { UseRequestsReturn } from '../../features/requests/hooks/useRequests';
import type { WorkflowHook } from '../../features/workflow/hooks/useWorkflows';
import type { WorkflowFoldersHook } from '../../features/workflow/hooks/useWorkflowFolders';
import type { GalleryDomain } from '../../data/galleries/types';
import CatalogSidebar from '../../features/catalog/components/CatalogSidebar';
import RequestsSidebar from '../../features/requests/components/RequestsSidebar';
import WorkflowSidebar from '../../features/workflow/components/panels/WorkflowSidebar';
import Sidebar from '../Sidebar';

export interface AppSidebarRegionProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  sidebarWidth: number;
  handleResizeStart: (e: React.MouseEvent) => void;
  catalog: UseCatalogReturn;
  wb: UseRequestsReturn;
  wfHook: WorkflowHook;
  wfFolders: WorkflowFoldersHook;
  environments: Environment[];
  microservices: Microservice[];
  featureGroups: FeatureGroup[];
  selectedEnvId: string;
  selectedSvcId: string;
  setSelectedEnvId: (id: string) => void;
  setSelectedSvcId: (id: string) => void;
  sidebarView: 'env' | 'svc';
  setSidebarView: Dispatch<SetStateAction<'env' | 'svc'>>;
  harnessRequestIds: Set<string>;
  setGalleryInitialDomain: Dispatch<SetStateAction<GalleryDomain | undefined>>;
  setCatalogReimportId: Dispatch<SetStateAction<string | undefined>>;
  setShowCatalogImport: Dispatch<SetStateAction<boolean>>;
  setCatalogVersionHistoryId: Dispatch<SetStateAction<string | undefined>>;
  setCatalogEditId: Dispatch<SetStateAction<string | undefined>>;
  setBatchHarnessTarget: Dispatch<SetStateAction<{ colId: string; folderId?: string } | undefined>>;
  handleExportSpec: (entryId: string) => void;
  handleConvertToOpenApi: (entryId: string) => void;
  handleBatchConvertToOpenApi: () => void;
  handleWorkflowExport: (id: string) => void;
  handleExportFolder: (folderId: string) => void;
  handleWorkflowImport: () => void;
  handleWbNewCollection: (mode?: 'direct' | 'multi-env', groupId?: string) => void;
  handleWbEditCollection: (col: RequestCollection) => void;
  handleWbNewRequest: (colId: string, folderId?: string) => void;
  handleEditSubCollection: (colId: string, folderId: string) => void;
}

export default function AppSidebarRegion({
  activeTab,
  setActiveTab,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  handleResizeStart,
  catalog,
  wb,
  wfHook,
  wfFolders,
  environments,
  microservices,
  featureGroups,
  selectedEnvId,
  selectedSvcId,
  setSelectedEnvId,
  setSelectedSvcId,
  sidebarView,
  setSidebarView,
  harnessRequestIds,
  setGalleryInitialDomain,
  setCatalogReimportId,
  setShowCatalogImport,
  setCatalogVersionHistoryId,
  setCatalogEditId,
  setBatchHarnessTarget,
  handleExportSpec,
  handleConvertToOpenApi,
  handleBatchConvertToOpenApi,
  handleWorkflowExport,
  handleExportFolder,
  handleWorkflowImport,
  handleWbNewCollection,
  handleWbEditCollection,
  handleWbNewRequest,
  handleEditSubCollection,
}: AppSidebarRegionProps) {
  const hideSidebar = domainOf(activeTab) === 'settings'
    || domainOf(activeTab) === 'gallery'
    || domainOf(activeTab) === 'protocols'
    || domainOf(activeTab) === 'demo';

  return (
    <>
      {!sidebarCollapsed && !hideSidebar && (
        <aside className="unified-sidebar" style={{ width: sidebarWidth }}>
          <div className="usb-content">
            {isApiTab(activeTab) && (
              <>
                <div className="usb-sidebar-toggle-row">
                  <button className={`usb-sidebar-toggle ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>Requests</button>
                  <button className={`usb-sidebar-toggle ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>Catalog</button>
                </div>
                <div style={{ display: activeTab === 'catalog' ? 'contents' : 'none' }}>
                  {catalog.loaded && (
                    <CatalogSidebar
                      entries={catalog.entries}
                      selectedEntryId={catalog.selectedEntryId}
                      onSelectEntry={(id) => { catalog.selectEntry(id); setActiveTab('catalog'); }}
                      onImport={() => { setCatalogReimportId(undefined); setShowCatalogImport(true); }}
                      onReimport={(entryId) => { setCatalogReimportId(entryId); setShowCatalogImport(true); }}
                      onDeleteEntry={catalog.removeEntry}
                      onVersionHistory={(entryId) => setCatalogVersionHistoryId(entryId)}
                      onEdit={(entryId) => setCatalogEditId(entryId)}
                      onExportSpec={handleExportSpec}
                      onConvertToOpenApi={handleConvertToOpenApi}
                      onBatchConvertToOpenApi={handleBatchConvertToOpenApi}
                    />
                  )}
                </div>
                <div style={{ display: activeTab === 'requests' ? 'contents' : 'none' }}>
                  {wb.loaded && (
                    <RequestsSidebar
                      collections={wb.collections}
                      selectedCollectionId={wb.selectedCollection?.id}
                      selectedRequestId={wb.selectedRequest?.id}
                      onSelectCollection={(colId) => { wb.selectCollection(colId); setActiveTab('requests'); }}
                      onSelectRequest={(colId, reqId) => { wb.selectRequest(colId, reqId); setActiveTab('requests'); }}
                      onNewCollection={handleWbNewCollection}
                      onEditCollection={handleWbEditCollection}
                      onDeleteCollection={wb.removeCollection}
                      onDuplicateCollection={wb.duplicateCollection}
                      onNewRequest={handleWbNewRequest}
                      onDeleteRequest={wb.removeRequest}
                      onDuplicateRequest={wb.duplicateRequest}
                      onAddFolder={wb.addFolder}
                      onAddSubCollection={wb.addSubCollection}
                      onEditSubCollection={handleEditSubCollection}
                      onRenameFolder={wb.renameFolder}
                      onDeleteFolder={wb.removeFolder}
                      onDuplicateFolder={wb.duplicateFolder}
                      onMoveFolder={wb.moveFolder}
                      onMoveFolderTo={wb.moveFolderTo}
                      onMoveRequest={wb.moveRequest}
                      onMoveRequestToCollection={wb.moveRequestToCollection}
                      onMoveFolderToCollection={wb.moveFolderToCollection}
                      onMergeCollectionInto={wb.moveCollectionAsSubCollection}
                      countAllRequests={wb.countAllRequests}
                      onImportCollection={wb.importCollection}
                      onImportFolder={wb.importFolder}
                      onAddGroup={wb.addGroup}
                      onRenameGroup={wb.renameGroup}
                      onDeleteGroup={wb.deleteGroup}
                      onMoveToGroup={wb.moveToGroup}
                      onDuplicateGroup={wb.duplicateGroup}
                      onSendCollectionToHarness={(colId) => setBatchHarnessTarget({ colId })}
                      onSendFolderToHarness={(colId, folderId) => setBatchHarnessTarget({ colId, folderId })}
                      harnessRequestIds={harnessRequestIds}
                    />
                  )}
                </div>
              </>
            )}
            {isWorkflowTab(activeTab) && (
              <WorkflowSidebar
                workflows={wfHook.workflows}
                selectedId={wfHook.selectedId}
                folders={wfFolders.folders}
                foldersLoaded={wfFolders.loaded}
                onSelect={(id) => { wfHook.select(id); setActiveTab('workflow'); }}
                onNew={(name: string) => {
                  wfHook.create(name);
                  setSidebarCollapsed(true);
                  setActiveTab('workflow');
                }}
                onBrowseTemplates={() => { setGalleryInitialDomain('workflows'); setActiveTab('gallery'); }}
                onRename={(id, name) => {
                  wfHook.update(id, { name });
                }}
                onDelete={(id) => { wfHook.remove(id); }}
                onDuplicate={(id) => { wfHook.duplicate(id); }}
                onExport={handleWorkflowExport}
                onExportFolder={handleExportFolder}
                onImport={handleWorkflowImport}
                onToggleFolderCollapse={wfFolders.toggleCollapse}
                onSetFolderCollapsed={wfFolders.setCollapsed}
                onCreateFolder={wfFolders.create}
                onRenameFolder={wfFolders.rename}
                onDeleteFolder={(id) => wfFolders.remove(id, wfFolders.folders)}
                onMoveWorkflowToFolder={(wfId, folderId, order) => {
                  wfHook.reorder(wfId, folderId, order);
                }}
                onMoveWorkflowsToFolder={(wfIds, folderId, startOrder) => {
                  wfIds.forEach((id, i) => {
                    wfHook.reorder(id, folderId, startOrder + i);
                  });
                }}
                onMoveFolder={wfFolders.move}
              />
            )}
            {isHarnessTab(activeTab) && (
              <Sidebar
                environments={environments}
                microservices={microservices}
                featureGroups={featureGroups}
                selectedEnvId={selectedEnvId}
                selectedSvcId={selectedSvcId}
                onEnvSelect={setSelectedEnvId}
                onSvcSelect={setSelectedSvcId}
                sidebarView={sidebarView}
                onSidebarViewChange={setSidebarView}
              />
            )}
          </div>

          <button className="usb-settings-btn" onClick={() => setActiveTab('preferences')}>⚙ Settings</button>
        </aside>
      )}
      {!sidebarCollapsed && !hideSidebar && (
        <div className="usb-resize-handle" onMouseDown={handleResizeStart} />
      )}
      <button
        className={`usb-toggle-btn ${sidebarCollapsed || hideSidebar ? 'collapsed' : ''}`}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        style={hideSidebar ? { display: 'none' } : undefined}
      >
        {sidebarCollapsed ? '▶' : '◀'}
      </button>
    </>
  );
}
