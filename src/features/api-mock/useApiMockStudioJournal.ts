import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { ApiMockServerDefinitionV1, ApiMockTransactionV1 } from '../../shared/api-mock/contracts';
import { mergeRecordedDraftsIntoRoutes } from '../../shared/api-mock/proxyRecording';
import { apiMockControlClient } from './apiMockControlClient';
import type { ScenarioStateSnapshot } from './apiMockControlClient';
import { mergeRuntimeInfo } from './apiMockPageHelpers';
import type { RuntimeInfo } from './apiMockStudioFactory';
import type { ApiMockWorkspaceSnapshot } from './useApiMockStudioPersistence';

export function useApiMockStudioJournal(opts: {
  activeServerId?: string;
  activeStatus?: RuntimeInfo['status'];
  latestRef: MutableRefObject<ApiMockWorkspaceSnapshot>;
  setTransactions: Dispatch<SetStateAction<ApiMockTransactionV1[]>>;
  setScenarioState: Dispatch<SetStateAction<ScenarioStateSnapshot | null>>;
  setRuntime: Dispatch<SetStateAction<Record<string, RuntimeInfo>>>;
  setServers: Dispatch<SetStateAction<ApiMockServerDefinitionV1[]>>;
  setLiveMessage: Dispatch<SetStateAction<string>>;
}): void {
  const {
    activeServerId, activeStatus, latestRef,
    setTransactions, setScenarioState, setRuntime, setServers, setLiveMessage,
  } = opts;

  useEffect(() => {
    setTransactions([]);
    setScenarioState(null);
  }, [activeServerId, setTransactions, setScenarioState]);

  useEffect(() => {
    if (!activeServerId || activeStatus !== 'running') return;
    let cancelled = false;
    const poll = async () => {
      const [txRes, stRes, draftRes] = await Promise.all([
        apiMockControlClient.transactions(activeServerId),
        apiMockControlClient.state(activeServerId),
        apiMockControlClient.recordedDrafts(activeServerId),
      ]);
      if (cancelled) return;
      // Listener gone (wipe, crash, lesson import) — stop polling so Chrome is not
      // flooded with /state and /transactions 404s every 1.5s.
      if (!stRes.ok && !stRes.error.retry) {
        setRuntime(prev => mergeRuntimeInfo(prev, activeServerId, { status: 'stopped', error: undefined }));
        return;
      }
      if (txRes.ok) setTransactions([...txRes.data.transactions].reverse());
      if (stRes.ok) setScenarioState(stRes.data);
      if (draftRes.ok && draftRes.data.drafts.length > 0) {
        const drafts = draftRes.data.drafts;
        const current = latestRef.current.servers.find(s => s.id === activeServerId);
        if (current) {
          const merged = mergeRecordedDraftsIntoRoutes(current.routes, drafts);
          if (merged.added > 0) {
            setServers(prev => prev.map(s => (
              s.id === activeServerId
                ? { ...s, routes: merged.routes, updatedAt: new Date().toISOString() }
                : s
            )));
            setLiveMessage(`Recorded ${merged.added} proxied exchange(s) as inactive draft routes.`);
          }
        }
        void apiMockControlClient.ackRecordedDrafts(activeServerId, drafts.map(d => d.id));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeServerId, activeStatus, latestRef, setTransactions, setScenarioState, setRuntime, setServers, setLiveMessage]);
}
