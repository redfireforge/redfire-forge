import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { applyRouteDelete, restoreDeletedRouteInList, type DeletedRouteSnapshot } from './apiMockPageHelpers';
import { ApiMockUndoToast } from './components/ApiMockUndoToast';

interface Args {
  servers: ApiMockServerDefinitionV1[];
  activeServerId: string | undefined;
  activeServer: ApiMockServerDefinitionV1 | undefined;
  selectedRouteId: string | undefined;
  handleUpdateServer: (id: string, patch: Partial<ApiMockServerDefinitionV1>) => void;
  setSelectedRouteId: Dispatch<SetStateAction<string | undefined>>;
  setLiveMessage: (message: string) => void;
  setActiveServerId: Dispatch<SetStateAction<string | undefined>>;
}

/**
 * Confirmed route-delete undo: snapshot, 5s toast, restore onto the origin server.
 */
export function useApiMockRouteUndo({
  servers,
  activeServerId,
  activeServer,
  selectedRouteId,
  handleUpdateServer,
  setSelectedRouteId,
  setLiveMessage,
  setActiveServerId,
}: Args): { handleDeleteRoute: (routeId: string) => void; undoToast: ReactNode } {
  const [routeUndo, setRouteUndo] = useState<DeletedRouteSnapshot | null>(null);
  const inFlightRef = useRef(false);
  const serversRef = useRef(servers);
  serversRef.current = servers;

  useEffect(() => {
    if (routeUndo && !servers.some(s => s.id === routeUndo.serverId)) setRouteUndo(null);
  }, [servers, routeUndo]);

  const handleDeleteRoute = useCallback((routeId: string) => {
    const snapshot = applyRouteDelete(
      activeServerId, activeServer, selectedRouteId, routeId,
      handleUpdateServer, setSelectedRouteId, setLiveMessage,
    );
    if (snapshot) {
      inFlightRef.current = false;
      setRouteUndo(snapshot);
    }
  }, [activeServerId, activeServer, selectedRouteId, handleUpdateServer, setSelectedRouteId, setLiveMessage]);

  const handleUndoRouteDelete = useCallback(() => {
    if (!routeUndo || inFlightRef.current) return;
    inFlightRef.current = true;
    const ok = restoreDeletedRouteInList(
      serversRef.current, routeUndo, handleUpdateServer, setSelectedRouteId, setLiveMessage,
    );
    if (ok) setActiveServerId(routeUndo.serverId);
    else setLiveMessage('Could not restore the deleted rule.');
    setRouteUndo(null);
  }, [routeUndo, handleUpdateServer, setSelectedRouteId, setLiveMessage, setActiveServerId]);

  const undoToast = routeUndo ? (
    <ApiMockUndoToast
      label={routeUndo.route.name}
      undoKey={routeUndo.route.id}
      onUndo={handleUndoRouteDelete}
      onDismiss={() => setRouteUndo(null)}
    />
  ) : null;

  return { handleDeleteRoute, undoToast };
}
