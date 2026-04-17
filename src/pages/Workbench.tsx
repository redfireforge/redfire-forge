import { useCallback, useMemo } from 'react';
import type { GlobalAuthProfile, WorkbenchRequest, WorkbenchFolder } from '../types';
import type { UseWorkbenchReturn } from '../hooks/useWorkbench';
import WorkbenchRequestEditor from '../components/workbench/WorkbenchRequestEditor';

function findAncestorSubCollection(folders: WorkbenchFolder[], reqId: string, ancestors: WorkbenchFolder[] = []): WorkbenchFolder | null {
  for (const f of folders) {
    const newAncestors = [...ancestors, f];
    if (f.requests.some(r => r.id === reqId)) {
      for (let i = newAncestors.length - 1; i >= 0; i--) {
        if (newAncestors[i].isSubCollection) return newAncestors[i];
      }
      return null;
    }
    const deep = findAncestorSubCollection(f.folders ?? [], reqId, newAncestors);
    if (deep) return deep;
  }
  return null;
}

interface Props {
  wb: UseWorkbenchReturn;
  appGlobalAuthProfiles: GlobalAuthProfile[];
}

export default function Workbench({ wb, appGlobalAuthProfiles }: Props) {
  const handleUpdateRequest = useCallback((reqPatch: Partial<WorkbenchRequest>) => {
    if (wb.selectedCollection && wb.selectedRequest) {
      wb.updateRequest(wb.selectedCollection.id, wb.selectedRequest.id, reqPatch);
    }
  }, [wb]);

  const parentSubCollection = useMemo(() => {
    if (!wb.selectedCollection || !wb.selectedRequest) return null;
    return findAncestorSubCollection(wb.selectedCollection.folders ?? [], wb.selectedRequest.id);
  }, [wb.selectedCollection, wb.selectedRequest]);

  if (!wb.loaded) {
    return <div className="wb-loading">Loading Workbench...</div>;
  }

  return (
    <div className="wb-container wb-no-sidebar">
      <div className="wb-main">
        {wb.selectedCollection && wb.selectedRequest ? (
          <WorkbenchRequestEditor
            collection={wb.selectedCollection}
            request={wb.selectedRequest}
            parentSubCollection={parentSubCollection ?? undefined}
            environments={wb.environments}
            selectedEnvId={wb.selectedEnvId}
            onEnvChange={wb.setSelectedEnvId}
            onUpdateRequest={handleUpdateRequest}
            appGlobalAuthProfiles={appGlobalAuthProfiles}
          />
        ) : (
          <div className="wb-empty-state">
            <div className="wb-empty-icon">&#128269;</div>
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
