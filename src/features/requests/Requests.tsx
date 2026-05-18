import { useCallback, useMemo } from 'react';
import type { GlobalAuthProfile, Microservice, Environment, RequestItem, RequestCollection } from '../../shared/types';
import type { UseRequestsReturn } from './hooks/useRequests';
import RequestEditor from './components/RequestEditor';
import { findAncestorSubCollection } from './utils/requestTree';

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
}

export default function Requests({ wb, appGlobalAuthProfiles, appMicroservices, appEnvironments, previewRequest, onClearPreview, onImportPreview, onSendToHarness, harnessRequestIds }: Props) {
  const handleUpdateRequest = useCallback((reqPatch: Partial<RequestItem>) => {
    if (previewRequest) return; // preview is read-only
    if (wb.selectedCollection && wb.selectedRequest) {
      wb.updateRequest(wb.selectedCollection.id, wb.selectedRequest.id, reqPatch);
    }
  }, [wb, previewRequest]);

  const parentSubCollection = useMemo(() => {
    if (previewRequest) return null;
    if (!wb.selectedCollection || !wb.selectedRequest) return null;
    return findAncestorSubCollection(wb.selectedCollection.folders ?? [], wb.selectedRequest.id);
  }, [wb.selectedCollection, wb.selectedRequest, previewRequest]);

  if (!wb.loaded) {
    return <div className="req-loading">Loading Requests...</div>;
  }

  const collection = previewRequest ? previewRequest.collection : wb.selectedCollection;
  const request = previewRequest ? previewRequest.request : wb.selectedRequest;

  return (
    <div className="req-container req-no-sidebar">
      <div className="req-main">
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
            collection={collection}
            request={request}
            parentSubCollection={previewRequest ? undefined : (parentSubCollection ?? undefined)}
            environments={previewRequest ? [] : wb.environments}
            appMicroservices={appMicroservices}
            appEnvironments={appEnvironments}
            selectedEnvId={previewRequest ? undefined : wb.selectedEnvId}
            onEnvChange={previewRequest ? () => {} : wb.setSelectedEnvId}
            onUpdateRequest={handleUpdateRequest}
            appGlobalAuthProfiles={appGlobalAuthProfiles}
            onSendToHarness={previewRequest ? undefined : onSendToHarness}
            isInHarness={!previewRequest && !!request && !!harnessRequestIds?.has(request.id)}
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
