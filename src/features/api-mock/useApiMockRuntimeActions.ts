import { useCallback } from 'react';
import type { ApiMockServerDefinitionV1 } from '@shared/api-mock/contracts';
import { apiMockControlClient } from './apiMockControlClient';
import { parsePortOwnerServerId } from './apiMockPageHelpers';
import type { RuntimeInfo } from './apiMockStudioFactory';

interface UseApiMockRuntimeActionsOptions {
  getServers: () => ApiMockServerDefinitionV1[];
  patchRuntime: (id: string, patch: Partial<RuntimeInfo>) => void;
  setLiveMessage: (message: string) => void;
}

export function useApiMockRuntimeActions({
  getServers,
  patchRuntime,
  setLiveMessage,
}: UseApiMockRuntimeActionsOptions) {
  const handleStart = useCallback(async (server: ApiMockServerDefinitionV1) => {
    const workspace = getServers();
    const latest = workspace.find(s => s.id === server.id) ?? server;
    patchRuntime(latest.id, { status: 'starting', error: undefined });
    let res = await apiMockControlClient.start(latest);
    // If a closed tab left an orphan listener on this port, stop it and retry once.
    if (!res.ok && res.error.code === 'MOCK_PORT_OWNED') {
      const ownerId = parsePortOwnerServerId(res.error.message);
      if (ownerId && ownerId !== latest.id && !workspace.some(s => s.id === ownerId)) {
        await apiMockControlClient.stop(ownerId);
        res = await apiMockControlClient.start(latest);
      }
    }
    if (res.ok) {
      patchRuntime(latest.id, { status: 'running', generation: res.data.generation, error: undefined, appliedJson: JSON.stringify(latest) });
      setLiveMessage(`Server started on port ${res.data.port}.`);
    } else {
      patchRuntime(latest.id, { status: 'error', error: `${res.error.title}: ${res.error.message}` });
      setLiveMessage(`${res.error.title}. ${res.error.message}`);
    }
  }, [getServers, patchRuntime, setLiveMessage]);

  const handleStop = useCallback(async (server: ApiMockServerDefinitionV1) => {
    patchRuntime(server.id, { status: 'draining' });
    const res = await apiMockControlClient.stop(server.id);
    if (res.ok) {
      patchRuntime(server.id, { status: 'stopped', error: undefined });
      setLiveMessage('Server stopped.');
    } else {
      patchRuntime(server.id, { status: 'error', error: `${res.error.title}: ${res.error.message}` });
    }
  }, [patchRuntime, setLiveMessage]);

  const handleApply = useCallback(async (server: ApiMockServerDefinitionV1) => {
    const latest = getServers().find(s => s.id === server.id) ?? server;
    patchRuntime(latest.id, { status: 'applying' });
    const res = await apiMockControlClient.commit(latest);
    if (res.ok) {
      patchRuntime(latest.id, { status: 'running', generation: res.data.generation, error: undefined, appliedJson: JSON.stringify(latest) });
      setLiveMessage(`Applied generation ${res.data.generation}.`);
    } else {
      patchRuntime(latest.id, { status: 'running', error: `${res.error.title}: ${res.error.message}` });
    }
  }, [getServers, patchRuntime, setLiveMessage]);

  const handleRestart = useCallback(async (server: ApiMockServerDefinitionV1) => {
    const latest = getServers().find(s => s.id === server.id) ?? server;
    patchRuntime(latest.id, { status: 'starting' });
    const res = await apiMockControlClient.restart(latest);
    if (res.ok) {
      patchRuntime(latest.id, { status: 'running', generation: res.data.generation, error: undefined, appliedJson: JSON.stringify(latest) });
    } else {
      patchRuntime(latest.id, { status: 'error', error: `${res.error.title}: ${res.error.message}` });
    }
  }, [getServers, patchRuntime]);

  return { handleStart, handleStop, handleApply, handleRestart };
}