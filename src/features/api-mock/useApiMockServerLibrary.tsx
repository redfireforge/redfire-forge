import { useCallback, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import type { ConfirmOptions } from '../../app/hooks/useConfirmDialog';
import {
  deleteServersFromLibrary,
  formatDeleteServersMessage,
  formatDeletedServersMessage,
  formatOpenedFromLibraryMessage,
  formatParkedMessage,
  formatRestoredServersMessage,
  openServerTab,
  parkServerTabs,
  restoreDeletedServers,
  selectOpenServers,
  snapshotDeletedServers,
  DELETE_SERVER_CONFIRM_OPTIONS,
  type DeletedServerSnapshot,
} from './apiMockServerLibrary';
import {
  formatStopAndCloseMessage,
  formatTabLimitMessage,
  STOP_AND_CLOSE_CONFIRM_OPTIONS,
  TAB_LIMIT_CONFIRM_OPTIONS,
} from './apiMockPageHelpers';
import { ApiMockUndoToast } from './components/ApiMockUndoToast';

interface Args {
  servers: ApiMockServerDefinitionV1[];
  setServers: Dispatch<SetStateAction<ApiMockServerDefinitionV1[]>>;
  activeServerId: string | undefined;
  setActiveServerId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedRouteId: Dispatch<SetStateAction<string | undefined>>;
  setLiveMessage: (message: string) => void;
  confirm: (message: string, onConfirm: () => void, detail?: string, options?: ConfirmOptions) => void;
  /** True while a listener is running/starting for this server. */
  isLive: (serverId: string) => boolean;
  /** Stop the companion/native listener before the tab goes away. */
  stopServer: (serverId: string) => Promise<void>;
  /** Drop cached runtime status for servers that no longer have a tab. */
  forgetRuntime: (serverIds: string[]) => void;
}

export interface ApiMockServerLibraryApi {
  openTabIds: string[];
  setOpenTabIds: Dispatch<SetStateAction<string[]>>;
  openServers: ApiMockServerDefinitionV1[];
  parkedCount: number;
  /** Close (park) tabs — definitions stay in the library. */
  handleCloseServers: (ids: string[]) => void;
  handleCloseServer: (id: string) => void;
  handleOpenFromLibrary: (id: string) => void;
  handleDeleteServers: (ids: string[]) => void;
  handleDeleteServer: (id: string) => void;
  /** Add a freshly created/duplicated/imported server to the tab bar. */
  trackOpenedServer: (id: string, afterId?: string) => void;
  serverUndoToast: ReactNode;
}

/**
 * Two-layer tab model: `servers` is the saved library, `openTabIds` is the
 * subset shown as tabs. Closing a tab parks the definition; only an explicit,
 * confirmed delete removes it (undoable for 5 seconds).
 */
export function useApiMockServerLibrary({
  servers,
  setServers,
  activeServerId,
  setActiveServerId,
  setSelectedRouteId,
  setLiveMessage,
  confirm,
  isLive,
  stopServer,
  forgetRuntime,
}: Args): ApiMockServerLibraryApi {
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  const [serverUndo, setServerUndo] = useState<DeletedServerSnapshot | null>(null);

  // Handlers run after awaited stop() calls — always read state through the ref.
  const stateRef = useRef({ servers, openTabIds, activeServerId });
  stateRef.current = { servers, openTabIds, activeServerId };

  const openServers = useMemo(() => selectOpenServers(servers, openTabIds), [servers, openTabIds]);
  const parkedCount = servers.length - openServers.length;

  const resolveTargets = useCallback((ids: string[]): ApiMockServerDefinitionV1[] => {
    const unique = [...new Set(ids)];
    return unique
      .map(id => stateRef.current.servers.find(s => s.id === id))
      .filter((s): s is ApiMockServerDefinitionV1 => Boolean(s));
  }, []);

  const stopAll = useCallback(async (ids: string[]) => {
    for (const id of ids) await stopServer(id);
  }, [stopServer]);

  // ── Close (park) ──────────────────────────────────────────────────
  const finalizeParkServers = useCallback((targets: ApiMockServerDefinitionV1[]) => {
    const ids = targets.map(t => t.id);
    const { openTabIds: currentTabs, activeServerId: currentActive } = stateRef.current;
    const next = parkServerTabs(currentTabs, currentActive, ids);
    setOpenTabIds(next.openTabIds);
    setActiveServerId(next.activeServerId);
    if (next.activeServerId !== currentActive) setSelectedRouteId(undefined);
    forgetRuntime(ids);
    setLiveMessage(formatParkedMessage(targets.map(t => t.name)));
  }, [setActiveServerId, setSelectedRouteId, forgetRuntime, setLiveMessage]);

  const handleCloseServers = useCallback((ids: string[]) => {
    const targets = resolveTargets(ids);
    if (targets.length === 0) return;
    const run = async () => {
      await stopAll(targets.map(t => t.id));
      finalizeParkServers(targets);
    };
    if (targets.some(s => isLive(s.id))) {
      confirm(
        formatStopAndCloseMessage(targets.map(s => s.name)),
        () => { void run(); },
        undefined,
        STOP_AND_CLOSE_CONFIRM_OPTIONS,
      );
      return;
    }
    void run();
  }, [resolveTargets, stopAll, finalizeParkServers, isLive, confirm]);

  const handleCloseServer = useCallback((id: string) => handleCloseServers([id]), [handleCloseServers]);

  // ── Open from the library ─────────────────────────────────────────
  const trackOpenedServer = useCallback((id: string, afterId?: string) => {
    setOpenTabIds(prev => {
      if (prev.includes(id)) return prev;
      const at = afterId ? prev.indexOf(afterId) : -1;
      if (at < 0) return [...prev, id];
      const next = [...prev];
      next.splice(at + 1, 0, id);
      return next;
    });
  }, []);

  const handleOpenFromLibrary = useCallback((id: string) => {
    const server = stateRef.current.servers.find(s => s.id === id);
    if (!server) return;
    const result = openServerTab(stateRef.current.openTabIds, id);
    if (result.atLimit) {
      confirm(formatTabLimitMessage(), () => {}, undefined, TAB_LIMIT_CONFIRM_OPTIONS);
      return;
    }
    const alreadyOpen = result.openTabIds === stateRef.current.openTabIds;
    setOpenTabIds(result.openTabIds);
    setActiveServerId(result.activeServerId);
    if (!alreadyOpen) setSelectedRouteId(undefined);
    setLiveMessage(alreadyOpen ? `Switched to ${server.name}.` : formatOpenedFromLibraryMessage(server.name));
  }, [confirm, setActiveServerId, setSelectedRouteId, setLiveMessage]);

  // ── Delete (destructive, undoable) ────────────────────────────────
  const finalizeDeleteServers = useCallback((targets: ApiMockServerDefinitionV1[]) => {
    const ids = targets.map(t => t.id);
    const current = stateRef.current;
    const snapshot = snapshotDeletedServers(current.servers, current.openTabIds, current.activeServerId, ids);
    const next = deleteServersFromLibrary(current.servers, current.openTabIds, current.activeServerId, ids);
    setServers(next.servers);
    setOpenTabIds(next.openTabIds);
    setActiveServerId(next.activeServerId);
    if (next.activeServerId !== current.activeServerId) setSelectedRouteId(undefined);
    forgetRuntime(ids);
    setServerUndo(snapshot);
    setLiveMessage(formatDeletedServersMessage(targets.map(t => t.name)));
  }, [setServers, setActiveServerId, setSelectedRouteId, forgetRuntime, setLiveMessage]);

  const handleDeleteServers = useCallback((ids: string[]) => {
    const targets = resolveTargets(ids);
    if (targets.length === 0) return;
    confirm(
      formatDeleteServersMessage(targets),
      () => {
        void (async () => {
          await stopAll(targets.map(t => t.id));
          finalizeDeleteServers(targets);
        })();
      },
      undefined,
      DELETE_SERVER_CONFIRM_OPTIONS,
    );
  }, [resolveTargets, confirm, stopAll, finalizeDeleteServers]);

  const handleDeleteServer = useCallback((id: string) => handleDeleteServers([id]), [handleDeleteServers]);

  const handleUndoDelete = useCallback(() => {
    if (!serverUndo) return;
    const current = stateRef.current;
    const restored = restoreDeletedServers(current.servers, current.openTabIds, serverUndo);
    setServers(restored.servers);
    setOpenTabIds(restored.openTabIds);
    setActiveServerId(restored.activeServerId);
    setLiveMessage(formatRestoredServersMessage(serverUndo.entries.map(e => e.server.name)));
    setServerUndo(null);
  }, [serverUndo, setServers, setActiveServerId, setLiveMessage]);

  const undoLabel = serverUndo && serverUndo.entries.length === 1
    ? serverUndo.entries[0].server.name
    : `${serverUndo?.entries.length ?? 0} mock servers`;

  const serverUndoToast = serverUndo && serverUndo.entries.length > 0 ? (
    <ApiMockUndoToast
      label={undoLabel}
      undoKey={serverUndo.entries.map(e => e.server.id).join(',')}
      onUndo={handleUndoDelete}
      onDismiss={() => setServerUndo(null)}
    />
  ) : null;

  return {
    openTabIds,
    setOpenTabIds,
    openServers,
    parkedCount,
    handleCloseServers,
    handleCloseServer,
    handleOpenFromLibrary,
    handleDeleteServers,
    handleDeleteServer,
    trackOpenedServer,
    serverUndoToast,
  };
}
