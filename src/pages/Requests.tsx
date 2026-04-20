import { useCallback, useMemo } from 'react';
import type { GlobalAuthProfile, Microservice, Environment, RequestItem } from '../types';
import type { UseRequestsReturn } from '../hooks/useRequests';
import RequestEditor from '../components/requests/RequestEditor';
import { findAncestorSubCollection } from '../utils/requestTree';

interface Props {
  wb: UseRequestsReturn;
  appGlobalAuthProfiles: GlobalAuthProfile[];
  appMicroservices: Microservice[];
  appEnvironments: Environment[];
}

export default function Requests({ wb, appGlobalAuthProfiles, appMicroservices, appEnvironments }: Props) {
  const handleUpdateRequest = useCallback((reqPatch: Partial<RequestItem>) => {
    if (wb.selectedCollection && wb.selectedRequest) {
      wb.updateRequest(wb.selectedCollection.id, wb.selectedRequest.id, reqPatch);
    }
  }, [wb]);

  const parentSubCollection = useMemo(() => {
    if (!wb.selectedCollection || !wb.selectedRequest) return null;
    return findAncestorSubCollection(wb.selectedCollection.folders ?? [], wb.selectedRequest.id);
  }, [wb.selectedCollection, wb.selectedRequest]);

  if (!wb.loaded) {
    return <div className="req-loading">Loading Requests...</div>;
  }

  return (
    <div className="req-container req-no-sidebar">
      <div className="req-main">
        {wb.selectedCollection && wb.selectedRequest ? (
          <RequestEditor
            collection={wb.selectedCollection}
            request={wb.selectedRequest}
            parentSubCollection={parentSubCollection ?? undefined}
            environments={wb.environments}
            appMicroservices={appMicroservices}
            appEnvironments={appEnvironments}
            selectedEnvId={wb.selectedEnvId}
            onEnvChange={wb.setSelectedEnvId}
            onUpdateRequest={handleUpdateRequest}
            appGlobalAuthProfiles={appGlobalAuthProfiles}
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
