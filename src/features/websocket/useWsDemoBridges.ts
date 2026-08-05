import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { UseWebSocketProfilesReturn } from '../../app/hooks/useWebSocketProfiles';
import type { UseWebSocketTemplatesReturn } from '../../app/hooks/useWebSocketTemplates';
import type { WsStudioLocation } from '../../shared/websocket/types';
import type { ConnectionStateHint, WsConnectionTabInfo } from './WsConnectionTabBar';
import type { WsConnectionTabContentHandle } from './WsConnectionTabContent.types';
import { MOCK_PORT_BASE } from './WebSocketStudioPage.helpers';

interface UseWsDemoBridgesArgs {
  profilesHook: UseWebSocketProfilesReturn;
  templatesHook: UseWebSocketTemplatesReturn;
  activeTabIdRef: RefObject<string>;
  tabsRef: RefObject<WsConnectionTabInfo[]>;
  tabRefs: RefObject<Map<string, RefObject<WsConnectionTabContentHandle | null>>>;
  renamedTabIdsRef: RefObject<Set<string>>;
  tabUrls: RefObject<Record<string, string>>;
  initialUrlsRef: RefObject<Record<string, string>>;
  mockPortsRef: RefObject<Record<string, number>>;
  setStudioLoc: Dispatch<SetStateAction<Record<string, WsStudioLocation>>>;
  setTabs: Dispatch<SetStateAction<WsConnectionTabInfo[]>>;
  setActiveTabId: Dispatch<SetStateAction<string>>;
  setConnectionStates: Dispatch<SetStateAction<Record<string, ConnectionStateHint>>>;
  setMockPorts: Dispatch<SetStateAction<Record<string, number>>>;
  debouncedSave: () => void;
  generateTabId: () => string;
}

export function useWsDemoBridges({
  profilesHook,
  templatesHook,
  activeTabIdRef,
  tabsRef,
  tabRefs,
  renamedTabIdsRef,
  tabUrls,
  initialUrlsRef,
  mockPortsRef,
  setStudioLoc,
  setTabs,
  setActiveTabId,
  setConnectionStates,
  setMockPorts,
  debouncedSave,
  generateTabId,
}: UseWsDemoBridgesArgs): void {
  useEffect(() => {
    const w = window as Window & {
      __demoClearWsProfiles?: () => Promise<void>;
      __demoClearWsTemplates?: () => Promise<void>;
      __demoSeedWsConnectionTabs?: (labels: string[]) => boolean;
      __demoPrepareWsTlsLesson?: () => boolean;
      __demoApplyWsTlsConfig?: (patch: {
        rejectUnauthorized?: boolean;
        caCert?: string;
        clientCert?: string;
        clientKey?: string;
      }) => void;
    };

    w.__demoClearWsProfiles = () => profilesHook.clearAllProfiles();
    w.__demoClearWsTemplates = () => templatesHook.clearAllTemplates();
    w.__demoSeedWsConnectionTabs = (labels: string[]) => {
      const clean = labels.map((l) => l.trim()).filter(Boolean).slice(0, 8);
      if (clean.length === 0) return false;
      setTabs((prev) => {
        const next: WsConnectionTabInfo[] = clean.map((label, i) => {
          const existing = prev[i];
          const id = existing?.id ?? generateTabId();
          renamedTabIdsRef.current.add(id);
          return { id, label, url: existing?.url };
        });
        const nextIds = new Set(next.map((t) => t.id));
        const ports: Record<string, number> = {};
        next.forEach((t, i) => {
          ports[t.id] = MOCK_PORT_BASE + i;
        });
        mockPortsRef.current = ports;
        setMockPorts(ports);
        setActiveTabId(next[0]!.id);
        setConnectionStates((curr) => {
          const out: Record<string, ConnectionStateHint> = {};
          for (const t of next) {
            out[t.id] = curr[t.id] ?? 'disconnected';
          }
          return out;
        });
        for (const id of Object.keys(tabUrls.current)) {
          if (!nextIds.has(id)) delete tabUrls.current[id];
        }
        for (const id of Object.keys(initialUrlsRef.current)) {
          if (!nextIds.has(id)) delete initialUrlsRef.current[id];
        }
        debouncedSave();
        return next;
      });
      return true;
    };

    w.__demoPrepareWsTlsLesson = () => {
      const id = activeTabIdRef.current;
      if (!id) return false;
      const keep = tabsRef.current.find((t) => t.id === id) ?? tabsRef.current[0];
      if (!keep) return false;
      const keepId = keep.id;

      setStudioLoc((prev) => ({
        ...prev,
        [keepId]: { mode: 'client', leftTab: 'connect', rightTab: 'events' },
      }));

      if (tabsRef.current.length > 1) {
        const nextIds = new Set([keepId]);
        for (const tid of Object.keys(tabUrls.current)) {
          if (!nextIds.has(tid)) delete tabUrls.current[tid];
        }
        for (const tid of Object.keys(initialUrlsRef.current)) {
          if (!nextIds.has(tid)) delete initialUrlsRef.current[tid];
        }
        setTabs([keep]);
        setActiveTabId(keepId);
        setConnectionStates((curr) => ({ [keepId]: curr[keepId] ?? 'disconnected' }));
        setMockPorts((ports) => {
          const nextPorts = { [keepId]: ports[keepId] ?? MOCK_PORT_BASE };
          mockPortsRef.current = nextPorts;
          return nextPorts;
        });
        debouncedSave();
      }

      const handle = tabRefs.current.get(keepId)?.current;
      handle?.prepareForTlsLesson();
      return !!handle;
    };

    w.__demoApplyWsTlsConfig = (patch) => {
      const id = activeTabIdRef.current;
      if (!id) return;
      tabRefs.current.get(id)?.current?.applyTlsConfig(patch);
    };

    return () => {
      delete w.__demoClearWsProfiles;
      delete w.__demoClearWsTemplates;
      delete w.__demoSeedWsConnectionTabs;
      delete w.__demoPrepareWsTlsLesson;
      delete w.__demoApplyWsTlsConfig;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
