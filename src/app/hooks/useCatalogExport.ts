import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { CatalogEntry, CatalogEndpoint, SavedEndpointValues } from '../../features/catalog/types/catalog';
import { buildCatalogExport } from '../../features/catalog/utils/catalogExport';
import { mergeExportIntoCollections, isCollectionEmpty, separateFoldersForMerge } from '../../features/catalog/utils/versionMerge';
import type { SendToRequestsPayload } from '../../features/catalog/components/CatalogSendToRequestsModal';
import type { UseCatalogReturn } from '../../features/catalog/hooks/useCatalog';
import type { UseRequestsReturn } from '../../features/requests/hooks/useRequests';
import { loadCatalogEndpointValues } from '../../shared/utils/storage';
import type { Tab } from '../utils/appTabUtils';

export type UseCatalogExportParams = {
  wb: UseRequestsReturn;
  catalog: UseCatalogReturn;
  setActiveTab: Dispatch<SetStateAction<Tab>>;
};

/**
 * Shared logic for exporting a catalog entry into the requests workbench.
 * Used by both handleSendToReqConfirm and handleInlineExportConfirm.
 */
function applyExportToWorkbench(
  payload: SendToRequestsPayload,
  entry: CatalogEntry,
  wb: UseRequestsReturn,
) {
  let groupId: string | undefined;
  if (payload.newGroupName) {
    groupId = wb.addGroup(payload.newGroupName);
  } else if (payload.targetGroupId) {
    groupId = payload.targetGroupId;
  }

  const currentVersion = entry.versions.find(v => v.id === entry.currentVersionId);
  const existingWbEnvNames = new Map(wb.environments.map(e => [e.name, e.id]));
  const versionLabel = currentVersion?.version ?? '';

  const { collection, newEnvironments } = buildCatalogExport(payload, {
    servers: entry.servers ?? [],
    microserviceId: entry.microserviceId,
    versionLabel,
    existingWbEnvNames,
    groupId,
    catalogEntryName: entry.name,
    catalogEntryId: entry.id,
  });

  const { updates, newCollection, existingCollectionId } = mergeExportIntoCollections(
    collection, wb.collections, versionLabel, entry.id,
  );
  for (const u of updates) wb.updateRequest(u.collectionId, u.requestId, u.patch);

  if (newEnvironments.length > 0) wb.addEnvironments(newEnvironments);

  if (!isCollectionEmpty(newCollection)) {
    if (existingCollectionId) {
      const existingCol = wb.collections.find(c => c.id === existingCollectionId);
      const existingFolders = existingCol?.folders ?? [];
      const { requestsToAddToExisting, trulyNewFolders } = separateFoldersForMerge(
        newCollection.folders ?? [], existingFolders
      );
      for (const { folderId, requests } of requestsToAddToExisting) {
        wb.importRequests(existingCollectionId, folderId, requests);
      }
      for (const folder of trulyNewFolders) {
        wb.importFolder(existingCollectionId, folder);
      }
    } else {
      wb.importCollection(newCollection);
    }
  }
}

export function useCatalogExport({ wb, catalog, setActiveTab }: UseCatalogExportParams) {
  const [sendToReqEntry, setSendToReqEntry] = useState<CatalogEntry | undefined>();
  const [sendToReqEpValues, setSendToReqEpValues] = useState<Record<string, SavedEndpointValues>>({});
  const [sendToReqSingleEndpoint, setSendToReqSingleEndpoint] = useState<
    { endpoint: CatalogEndpoint; savedValues?: SavedEndpointValues } | undefined
  >();
  const [inlineExportEpValues, setInlineExportEpValues] = useState<Record<string, SavedEndpointValues>>({});

  useEffect(() => {
    if (sendToReqEntry) {
      loadCatalogEndpointValues(sendToReqEntry.id).then(setSendToReqEpValues);
    } else {
      setSendToReqEpValues({});
    }
  }, [sendToReqEntry]);

  useEffect(() => {
    const selId = catalog.selectedEntry?.id;
    if (selId) {
      loadCatalogEndpointValues(selId).then(setInlineExportEpValues);
    } else {
      setInlineExportEpValues({});
    }
  }, [catalog.selectedEntry?.id]);

  const handleSendToRequests = useCallback((entry: CatalogEntry) => {
    setSendToReqSingleEndpoint(undefined);
    setSendToReqEntry(entry);
  }, []);

  const handleExportSingleEndpoint = useCallback((entry: CatalogEntry, endpoint: CatalogEndpoint, savedValues?: SavedEndpointValues) => {
    setSendToReqSingleEndpoint({ endpoint, savedValues });
    setSendToReqEpValues(savedValues ? { [endpoint.id]: savedValues } : {});
    setSendToReqEntry(entry);
  }, []);

  const handleSendToReqConfirm = useCallback((payload: SendToRequestsPayload) => {
    if (sendToReqEntry) {
      catalog.updateEntry(sendToReqEntry.id, { customEndpointNames: payload.customNames });
      applyExportToWorkbench(payload, sendToReqEntry, wb);
    }
    setSendToReqEntry(undefined);
    setActiveTab('requests');
  }, [wb, sendToReqEntry, catalog, setActiveTab]);

  const handleInlineExportConfirm = useCallback((payload: SendToRequestsPayload) => {
    const entry = catalog.selectedEntry;
    if (!entry) return;

    catalog.updateEntry(entry.id, { customEndpointNames: payload.customNames });
    applyExportToWorkbench(payload, entry, wb);
    setActiveTab('requests');
  }, [wb, catalog, setActiveTab]);

  return {
    sendToReqEntry,
    setSendToReqEntry,
    sendToReqEpValues,
    sendToReqSingleEndpoint,
    setSendToReqSingleEndpoint,
    inlineExportEpValues,
    handleSendToRequests,
    handleExportSingleEndpoint,
    handleSendToReqConfirm,
    handleInlineExportConfirm,
  };
}
