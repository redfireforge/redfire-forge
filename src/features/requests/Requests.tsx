import { useCallback, useMemo } from 'react';
import type { GlobalAuthProfile, Microservice, Environment, RequestItem, RequestCollection, RequestTab, RequestSubTab, ResponseSubTab, RequestInputMode } from '@shared/types';
import type { UseRequestsReturn } from './hooks/useRequests';
import { findRequestInCollection, findAncestorSubCollection } from './utils/requestTree';
import RequestEditor from './components/RequestEditor';
import { RequestTabBar } from './components/RequestTabBar';

export interface PreviewRequest {
  collection: RequestCollection;
  request: RequestItem;
  entryName: string;
}

interface Props {
  wb: UseRequestsReturn;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  appMicroservices: Microservice[];
  appEnvironments: Environment[];
  previewRequest?: PreviewRequest | null;
  onClearPreview?: () => void;
  onImportPreview?: () => void;
  onSendToHarness?: () => void;
  harnessRequestIds?: Set<string>;
  tabs: RequestTab[];
  activeTabId: string;
  activeTab: RequestTab | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  onRenameTab: (tabId: string, label: string) => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onEnvChange: (envId: string | undefined) => void;
  onUpdateTabUI: (tabId: string, patch: Partial<Pick<RequestTab, 'activeSubTab' | 'responseSubTab' | 'inputMode' | 'envId' | 'activeHistoryId'>>) => void;
  onSyncTabLabel?: (reqId: string, name: string) => void;
}

export default function Requests({
  wb, appGlobalAuthProfiles, appMicroservices, appEnvironments,
  previewRequest, onClearPreview, onImportPreview, onSendToHarness, harnessRequestIds,
  tabs, activeTabId, activeTab, onSelectTab, onCloseTab, onAddTab, onRenameTab,
  onReorderTabs, onDuplicateTab, onCloseOtherTabs, onCloseTabsToRight, onCloseAllTabs,
  onEnvChange, onUpdateTabUI, onSyncTabLabel,
}: Props) {
  const tabCollection = useMemo(() => {
    if (!activeTab) return null;
    return wb.collections.find(c => c.id === activeTab.collectionId) ?? null;
  }, [wb.collections, activeTab]);

  const tabRequest = useMemo(() => {
    if (!tabCollection || !activeTab) return null;
    return findRequestInCollection(tabCollection, activeTab.requestId);
  }, [tabCollection, activeTab]);

  const collection = previewRequest ? previewRequest.collection : (tabCollection ?? wb.selectedCollection);
  const request = previewRequest ? previewRequest.request : (tabRequest ?? wb.selectedRequest);

  const handleUpdateRequest = useCallback((reqPatch: Partial<RequestItem>) => {
    if (previewRequest) return;
    if (collection && request) {
      wb.updateRequest(collection.id, request.id, reqPatch);
      if (reqPatch.name !== undefined && onSyncTabLabel) {
        onSyncTabLabel(request.id, reqPatch.name || request.url || 'Untitled');
      }
    }
  }, [wb, collection, request, previewRequest, onSyncTabLabel]);

  const parentSubCollection = useMemo(() => {
    if (previewRequest) return null;
    if (!collection || !request) return null;
    return findAncestorSubCollection(collection.folders ?? [], request.id);
  }, [collection, request, previewRequest]);

  const handleActiveSubTabChange = useCallback((tab: RequestSubTab) => {
    if (activeTab) onUpdateTabUI(activeTab.id, { activeSubTab: tab });
  }, [activeTab, onUpdateTabUI]);

  const handleResponseSubTabChange = useCallback((tab: ResponseSubTab) => {
    if (activeTab) onUpdateTabUI(activeTab.id, { responseSubTab: tab });
  }, [activeTab, onUpdateTabUI]);

  const handleInputModeChange = useCallback((mode: RequestInputMode) => {
    if (activeTab) onUpdateTabUI(activeTab.id, { inputMode: mode });
  }, [activeTab, onUpdateTabUI]);

  const handleActiveHistoryIdChange = useCallback((id: string | null) => {
    if (activeTab) onUpdateTabUI(activeTab.id, { activeHistoryId: id });
  }, [activeTab, onUpdateTabUI]);

  const methodByRequestId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const tab of tabs) {
      const col = wb.collections.find(c => c.id === tab.collectionId);
      if (!col) continue;
      const req = findRequestInCollection(col, tab.requestId);
      if (req) map[tab.requestId] = req.method;
    }
    return map;
  }, [tabs, wb.collections]);

  if (!wb.loaded) {
    return <div className="req-loading">Loading Requests...</div>;
  }

  const showTabBar = tabs.length > 0 && !previewRequest;

  return (
    <div className="req-container req-no-sidebar">
      <div className="req-main">
        {showTabBar && (
          <RequestTabBar
            tabs={tabs}
            activeTabId={activeTabId}
            methodByRequestId={methodByRequestId}
            onSelect={onSelectTab}
            onClose={onCloseTab}
            onAdd={onAddTab}
            onRename={onRenameTab}
            onReorder={onReorderTabs}
            onDuplicate={onDuplicateTab}
            onCloseOthers={onCloseOtherTabs}
            onCloseRight={onCloseTabsToRight}
            onCloseAll={onCloseAllTabs}
          />
        )}
        {previewRequest && (
          <div className="req-preview-banner">
            <span className="req-preview-banner-icon">🔍</span>
            <span className="req-preview-banner-text">
              Preview: <strong>{previewRequest.entryName}</strong> — This is a gallery sample. Send the request to test it, then import if you like it.
            </span>
            <div className="req-preview-banner-actions">
              {onImportPreview && (
                <button className="req-preview-btn req-preview-btn-import" onClick={onImportPreview} type="button">
                  Import
                </button>
              )}
              {onClearPreview && (
                <button className="req-preview-btn req-preview-btn-back" onClick={onClearPreview} type="button">
                  ✕ Close Preview
                </button>
              )}
            </div>
          </div>
        )}
        {collection && request ? (
          <RequestEditor
            key={previewRequest ? `preview-${request.id}` : request.id}
            collection={collection}
            request={request}
            parentSubCollection={previewRequest ? undefined : (parentSubCollection ?? undefined)}
            environments={previewRequest ? [] : appEnvironments}
            appMicroservices={appMicroservices}
            selectedEnvId={previewRequest ? undefined : (activeTab?.envId ?? wb.selectedEnvId)}
            onEnvChange={previewRequest ? () => {} : onEnvChange}
            onUpdateRequest={handleUpdateRequest}
            appGlobalAuthProfiles={appGlobalAuthProfiles}
            onSendToHarness={previewRequest ? undefined : onSendToHarness}
            isInHarness={!previewRequest && !!request && !!harnessRequestIds?.has(request.id)}
            activeSubTab={previewRequest ? undefined : (activeTab?.activeSubTab ?? 'params')}
            responseSubTab={previewRequest ? undefined : (activeTab?.responseSubTab ?? 'preview')}
            inputMode={previewRequest ? undefined : (activeTab?.inputMode ?? 'builder')}
            activeHistoryId={previewRequest ? undefined : (activeTab?.activeHistoryId ?? null)}
            onActiveSubTabChange={previewRequest ? undefined : handleActiveSubTabChange}
            onResponseSubTabChange={previewRequest ? undefined : handleResponseSubTabChange}
            onInputModeChange={previewRequest ? undefined : handleInputModeChange}
            onActiveHistoryIdChange={previewRequest ? undefined : handleActiveHistoryIdChange}
          />
        ) : (
          <div className="req-empty-state">
            <div className="req-empty-icon">&#128269;</div>
            <h3>No Request Selected</h3>
            <p>
              {wb.collections.length === 0
                ? 'Create a collection to get started. Right-click in the sidebar.'
                : 'Select a request from the sidebar, or right-click to create one.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
