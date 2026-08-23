/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { useWsDemoBridges } from './useWsDemoBridges';
import { MOCK_PORT_BASE } from './WebSocketStudioPage.helpers';
import type { WsConnectionTabInfo } from './WsConnectionTabBar';
import type { WsConnectionTabContentHandle } from './WsConnectionTabContent.types';
import type { ConnectionStateHint } from './WsConnectionTabBar';
import type { WsStudioLocation } from '@shared/websocket/types';

function buildTabRef(handle?: WsConnectionTabContentHandle): RefObject<WsConnectionTabContentHandle | null> {
  return { current: handle ?? null } as RefObject<WsConnectionTabContentHandle | null>;
}

function makeHarness(options?: {
  tabs?: WsConnectionTabInfo[];
  activeTabId?: string;
  tabUrls?: Record<string, string>;
  initialUrls?: Record<string, string>;
  mockPorts?: Record<string, number>;
  connectionStates?: Record<string, ConnectionStateHint>;
  tabHandles?: Record<string, WsConnectionTabContentHandle | undefined>;
}) {
  const tabsState: { value: WsConnectionTabInfo[] } = { value: options?.tabs ?? [] };
  const activeTabState: { value: string } = { value: options?.activeTabId ?? '' };
  const studioLocState: { value: Record<string, WsStudioLocation> } = { value: {} };
  const connectionState: { value: Record<string, ConnectionStateHint> } = {
    value: options?.connectionStates ?? {},
  };
  const mockPortsState: { value: Record<string, number> } = {
    value: options?.mockPorts ?? {},
  };

  const setTabs = vi.fn((updater: ((prev: WsConnectionTabInfo[]) => WsConnectionTabInfo[]) | WsConnectionTabInfo[]) => {
    tabsState.value = typeof updater === 'function' ? updater(tabsState.value) : updater;
  });

  const setActiveTabId = vi.fn((updater: ((prev: string) => string) | string) => {
    activeTabState.value = typeof updater === 'function' ? updater(activeTabState.value) : updater;
  });

  const setStudioLoc = vi.fn(
    (
      updater:
        | ((prev: Record<string, WsStudioLocation>) => Record<string, WsStudioLocation>)
        | Record<string, WsStudioLocation>,
    ) => {
      studioLocState.value = typeof updater === 'function' ? updater(studioLocState.value) : updater;
    },
  );

  const setConnectionStates = vi.fn(
    (
      updater:
        | ((prev: Record<string, ConnectionStateHint>) => Record<string, ConnectionStateHint>)
        | Record<string, ConnectionStateHint>,
    ) => {
      connectionState.value = typeof updater === 'function' ? updater(connectionState.value) : updater;
    },
  );

  const setMockPorts = vi.fn(
    (
      updater:
        | ((prev: Record<string, number>) => Record<string, number>)
        | Record<string, number>,
    ) => {
      mockPortsState.value = typeof updater === 'function' ? updater(mockPortsState.value) : updater;
    },
  );

  const profilesHook = {
    clearAllProfiles: vi.fn(async () => {}),
  };

  const templatesHook = {
    clearAllTemplates: vi.fn(async () => {}),
  };

  const renamedTabIdsRef = { current: new Set<string>() };
  const tabUrls = { current: { ...(options?.tabUrls ?? {}) } };
  const initialUrlsRef = { current: { ...(options?.initialUrls ?? {}) } };
  const mockPortsRef = { current: { ...(options?.mockPorts ?? {}) } };

  const tabsRef = {
    get current() {
      return tabsState.value;
    },
  } as RefObject<WsConnectionTabInfo[]>;

  const activeTabIdRef = {
    get current() {
      return activeTabState.value;
    },
  } as RefObject<string>;

  let genCounter = 0;
  const generateTabId = vi.fn(() => {
    genCounter += 1;
    return `gen-${genCounter}`;
  });

  const tabHandleMap = new Map<string, RefObject<WsConnectionTabContentHandle | null>>();
  for (const tab of tabsState.value) {
    tabHandleMap.set(tab.id, buildTabRef(options?.tabHandles?.[tab.id]));
  }

  const tabRefs = { current: tabHandleMap } as RefObject<Map<string, RefObject<WsConnectionTabContentHandle | null>>>;

  const debouncedSave = vi.fn();

  renderHook(() =>
    useWsDemoBridges({
      profilesHook: profilesHook as never,
      templatesHook: templatesHook as never,
      activeTabIdRef,
      tabsRef,
      tabRefs,
      renamedTabIdsRef,
      tabUrls,
      initialUrlsRef,
      mockPortsRef,
      setStudioLoc: setStudioLoc as never,
      setTabs: setTabs as never,
      setActiveTabId: setActiveTabId as never,
      setConnectionStates: setConnectionStates as never,
      setMockPorts: setMockPorts as never,
      debouncedSave,
      generateTabId,
    }),
  );

  return {
    profilesHook,
    templatesHook,
    tabsState,
    activeTabState,
    studioLocState,
    connectionState,
    mockPortsState,
    setTabs,
    setActiveTabId,
    setStudioLoc,
    setConnectionStates,
    setMockPorts,
    generateTabId,
    tabUrls,
    initialUrlsRef,
    mockPortsRef,
    debouncedSave,
    renamedTabIdsRef,
    tabRefs,
  };
}

describe('useWsDemoBridges', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { ...window });
  });

  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.__demoClearWsProfiles;
    delete w.__demoClearWsTemplates;
    delete w.__demoSeedWsConnectionTabs;
    delete w.__demoPrepareWsTlsLesson;
    delete w.__demoApplyWsTlsConfig;
    vi.unstubAllGlobals();
  });

  it('registers clear bridges and executes clear methods', async () => {
    const h = makeHarness();
    const w = window as unknown as Record<string, unknown>;

    expect(typeof w.__demoClearWsProfiles).toBe('function');
    expect(typeof w.__demoClearWsTemplates).toBe('function');

    await (w.__demoClearWsProfiles as () => Promise<void>)();
    await (w.__demoClearWsTemplates as () => Promise<void>)();

    expect(h.profilesHook.clearAllProfiles).toHaveBeenCalledOnce();
    expect(h.templatesHook.clearAllTemplates).toHaveBeenCalledOnce();
  });

  it('seed bridge returns false when labels are empty after trim', () => {
    makeHarness();
    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoSeedWsConnectionTabs as (labels: string[]) => boolean)(['  ', ''])).toBe(false);
  });

  it('seed bridge compacts labels, reuses and generates ids, and cleans stale url maps', () => {
    const h = makeHarness({
      tabs: [{ id: 't1', label: 'Old 1', url: 'ws://old-1' }],
      activeTabId: 't1',
      tabUrls: { t1: 'ws://old-1', stale: 'ws://stale' },
      initialUrls: { t1: 'ws://old-1', stale: 'ws://stale' },
      connectionStates: { t1: 'connected' },
    });
    const w = window as unknown as Record<string, unknown>;

    const ok = (w.__demoSeedWsConnectionTabs as (labels: string[]) => boolean)([
      ' Alpha ',
      '',
      'Beta',
    ]);

    expect(ok).toBe(true);
    expect(h.tabsState.value).toEqual([
      { id: 't1', label: 'Alpha', url: 'ws://old-1' },
      { id: 'gen-1', label: 'Beta', url: undefined },
    ]);
    expect(h.generateTabId).toHaveBeenCalledTimes(1);
    expect(h.renamedTabIdsRef.current.has('t1')).toBe(true);
    expect(h.renamedTabIdsRef.current.has('gen-1')).toBe(true);
    expect(h.activeTabState.value).toBe('t1');
    expect(h.connectionState.value).toEqual({
      t1: 'connected',
      'gen-1': 'disconnected',
    });
    expect(h.mockPortsState.value).toEqual({
      t1: MOCK_PORT_BASE,
      'gen-1': MOCK_PORT_BASE + 1,
    });
    expect(h.tabUrls.current).toEqual({ t1: 'ws://old-1' });
    expect(h.initialUrlsRef.current).toEqual({ t1: 'ws://old-1' });
    expect(h.debouncedSave).toHaveBeenCalledOnce();
  });

  it('prepare tls bridge returns false when no active tab id or no keep tab', () => {
    const hNoActive = makeHarness({ tabs: [{ id: 't1', label: 'A' }], activeTabId: '' });
    const w1 = window as unknown as Record<string, unknown>;
    expect((w1.__demoPrepareWsTlsLesson as () => boolean)()).toBe(false);

    const hNoTabs = makeHarness({ tabs: [], activeTabId: 'none' });
    const w2 = window as unknown as Record<string, unknown>;
    expect((w2.__demoPrepareWsTlsLesson as () => boolean)()).toBe(false);

    expect(hNoActive.debouncedSave).not.toHaveBeenCalled();
    expect(hNoTabs.debouncedSave).not.toHaveBeenCalled();
  });

  it('prepare tls bridge compacts to active tab, sets defaults, and calls tab handle', () => {
    const prepareForTlsLesson = vi.fn();
    const applyTlsConfig = vi.fn();

    const h = makeHarness({
      tabs: [
        { id: 'keep', label: 'Keep', url: 'ws://localhost:9876' },
        { id: 'drop', label: 'Drop', url: 'ws://localhost:9877' },
      ],
      activeTabId: 'keep',
      tabUrls: { keep: 'ws://localhost:9876', drop: 'ws://localhost:9877' },
      initialUrls: { keep: 'ws://localhost:9876', drop: 'ws://localhost:9877' },
      mockPorts: { drop: MOCK_PORT_BASE + 9 },
      tabHandles: {
        keep: {
          getConnectionState: () => 'disconnected',
          getUrl: () => 'ws://localhost:9876',
          getMessageCount: () => 0,
          getDraft: () => ({ url: 'ws://localhost:9876' } as never),
          prepareForTlsLesson,
          applyTlsConfig,
        },
      },
    });

    const w = window as unknown as Record<string, unknown>;
    const ok = (w.__demoPrepareWsTlsLesson as () => boolean)();

    expect(ok).toBe(true);
    expect(h.tabsState.value).toEqual([{ id: 'keep', label: 'Keep', url: 'ws://localhost:9876' }]);
    expect(h.activeTabState.value).toBe('keep');
    expect(h.studioLocState.value.keep).toEqual({ mode: 'client', leftTab: 'connect', rightTab: 'events' });
    expect(h.connectionState.value).toEqual({ keep: 'disconnected' });
    expect(h.mockPortsState.value).toEqual({ keep: MOCK_PORT_BASE });
    expect(h.mockPortsRef.current).toEqual({ keep: MOCK_PORT_BASE });
    expect(h.tabUrls.current).toEqual({ keep: 'ws://localhost:9876' });
    expect(h.initialUrlsRef.current).toEqual({ keep: 'ws://localhost:9876' });
    expect(prepareForTlsLesson).toHaveBeenCalledOnce();
    expect(h.debouncedSave).toHaveBeenCalledOnce();
  });

  it('prepare tls bridge returns false when active tab has no handle', () => {
    makeHarness({
      tabs: [{ id: 'keep', label: 'Keep' }],
      activeTabId: 'keep',
      tabHandles: { keep: undefined },
    });

    const w = window as unknown as Record<string, unknown>;
    expect((w.__demoPrepareWsTlsLesson as () => boolean)()).toBe(false);
  });

  it('apply tls bridge safely no-ops without active tab and applies patch with active handle', () => {
    const applyTlsConfig = vi.fn();
    const h = makeHarness({
      tabs: [{ id: 't1', label: 'Tab' }],
      activeTabId: 't1',
      tabHandles: {
        t1: {
          getConnectionState: () => 'disconnected',
          getUrl: () => 'ws://localhost:9876',
          getMessageCount: () => 0,
          getDraft: () => ({ url: 'ws://localhost:9876' } as never),
          prepareForTlsLesson: vi.fn(),
          applyTlsConfig,
        },
      },
    });

    const w = window as unknown as Record<string, unknown>;
    (w.__demoApplyWsTlsConfig as (patch: { rejectUnauthorized?: boolean }) => void)({
      rejectUnauthorized: false,
    });
    expect(applyTlsConfig).toHaveBeenCalledWith({ rejectUnauthorized: false });

    h.activeTabState.value = '';
    (w.__demoApplyWsTlsConfig as (patch: { rejectUnauthorized?: boolean }) => void)({
      rejectUnauthorized: true,
    });
    expect(applyTlsConfig).toHaveBeenCalledTimes(1);
  });
});
