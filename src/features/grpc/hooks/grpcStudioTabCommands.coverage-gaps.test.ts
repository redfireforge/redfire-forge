/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import {
  createAbortTabInFlightCallsHandler,
  createAddTabHandler,
  createCloseTabHandler,
  createCloseOtherTabsHandler,
  createCloseTabsToRightHandler,
  createDismissSchemaDriftHandler,
  createDuplicateTabHandler,
  createPruneSchemaDriftBodyHandler,
  createReorderTabHandler,
  createRebindSchemaDriftMethodHandler,
  createRenameTabHandler,
  createResolveTabConnectionHandler,
  createSelectMethodHandler,
  createSelectTabHandler,
  createToggleServiceExpandedHandler,
} from './grpcStudioTabCommands';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import {
  GRPC_DEFAULT_CALL_TIMEOUT_MS,
  GRPC_DEFAULT_STREAM_CALL_TIMEOUT_MS,
} from '../../../shared/grpc/contracts';

vi.mock('../utils/grpcTabSecretVault', () => ({
  clearTabSessionVaultSecrets: vi.fn().mockResolvedValue(undefined),
  copyTabVaultSecrets: vi.fn().mockResolvedValue(undefined),
}));

function makeRuntime(overrides: Partial<GrpcStudioRuntimeContext> = {}): GrpcStudioRuntimeContext {
  const session = createInitialSessionState();
  const sessionRef = { current: session };
  const tabsRef = { current: session.tabs };
  const updateTab = vi.fn();
  const patchTabDescriptor = vi.fn();
  const commitSession = (next: typeof session) => {
    sessionRef.current = next;
    tabsRef.current = next.tabs;
    return next;
  };

  return {
    sessionRef,
    tabsRef,
    setSession: vi.fn((updater) => {
      sessionRef.current = typeof updater === 'function' ? updater(sessionRef.current) : updater;
      tabsRef.current = sessionRef.current.tabs;
    }),
    commitSession,
    descriptorLoadGenerationRef: { current: {} },
    callGenerationRef: { current: {} },
    streamGenerationRef: { current: {} },
    streamDisposeRef: { current: {} },
    inFlightCallRef: { current: {} },
    tabConnectionFingerprintRef: { current: {} },
    fireCancelInFlight: vi.fn(),
    envVarMap: {},
    profiles: [{ id: 'p1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' }],
    pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    maxTabs: 5,
    updateTab,
    patchTabDescriptor,
    ...overrides,
  };
}

function makeCore(ctx: GrpcStudioRuntimeContext) {
  return {
    sessionRef: ctx.sessionRef,
    setSession: ctx.setSession,
    commitSession: ctx.commitSession,
    streamDisposeRef: ctx.streamDisposeRef,
    callGenerationRef: ctx.callGenerationRef,
    streamGenerationRef: ctx.streamGenerationRef,
    inFlightCallRef: ctx.inFlightCallRef,
    descriptorLoadGenerationRef: ctx.descriptorLoadGenerationRef,
    tabConnectionFingerprintRef: ctx.tabConnectionFingerprintRef,
  };
}

describe('grpcStudioTabCommands coverage gaps', () => {
  it('addTab creates a new tab when under maxTabs', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createAddTabHandler(ctx, core)();
    expect(ctx.sessionRef.current.tabs.length).toBe(2);
  });

  it('selectTab switches active tab when target exists', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    ctx.sessionRef.current = {
      ...ctx.sessionRef.current,
      tabs: [first, second],
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
      },
    };

    createSelectTabHandler(core)(second.id);
    expect(ctx.sessionRef.current.activeTabId).toBe(second.id);
  });

  it('selectTab no-ops for unknown tab id', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const active = ctx.sessionRef.current.activeTabId;
    createSelectTabHandler(core)('missing-tab');
    expect(ctx.sessionRef.current.activeTabId).toBe(active);
  });

  it('duplicateTab clones tab state when under maxTabs', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const sourceId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[sourceId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };

    createDuplicateTabHandler(ctx, core)(sourceId);
    expect(ctx.sessionRef.current.tabs.length).toBe(2);
    expect(ctx.sessionRef.current.activeTabId).not.toBe(sourceId);
  });

  it('closeTab no-ops when only one tab remains', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createCloseTabHandler(ctx, core)(ctx.sessionRef.current.activeTabId);
    expect(ctx.sessionRef.current.tabs.length).toBe(1);
  });

  it('closeTab no-ops when tab id is unknown', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    ctx.sessionRef.current = {
      tabs: [first, second],
      activeTabId: second.id,
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
      },
    };

    createCloseTabHandler(ctx, core)('missing-tab');
    expect(ctx.sessionRef.current.tabs.length).toBe(2);
  });

  it('selectMethod rebinds body when drift warning is active', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'warning',
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'drift-body', stale: true },
      }),
    }];

    createSelectMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'Echo');
    expect(ctx.updateTab).toHaveBeenCalledWith(
      tabId,
      expect.objectContaining({ body: { message: 'drift-body' } }),
      expect.any(Object),
    );
  });

  it('selectMethod no-ops when method is not found in descriptor', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };

    createSelectMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'UnknownMethod');
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('pruneSchemaDriftBody syncs body to active method schema', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello', stale: 'remove-me' },
      }),
    }];

    createPruneSchemaDriftBodyHandler(ctx)(tabId);
    expect(ctx.updateTab).toHaveBeenCalledWith(
      tabId,
      { body: { message: 'hello' } },
      expect.objectContaining({ descriptorPatch: expect.any(Object) }),
    );
  });

  it('rebindSchemaDriftMethod switches method and clears stream session', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-1',
      }),
    }];

    createRebindSchemaDriftMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'Echo');
    expect(ctx.updateTab).toHaveBeenCalledWith(
      tabId,
      expect.objectContaining({
        service: 'echo.EchoService',
        method: 'Echo',
        streamLifecycle: 'idle',
        activeStreamId: undefined,
      }),
      expect.any(Object),
    );
  });

  it('resolveTabConnection returns env-aware resolution for existing tab', () => {
    const ctx = makeRuntime({ envVarMap: { GRPC_HOST: 'localhost:50051' } });
    const tabId = ctx.sessionRef.current.activeTabId;
    const resolution = createResolveTabConnectionHandler(ctx)(tabId);
    expect(resolution.target).toBe('localhost:50051');
  });

  it('resolveTabConnection throws when the tab id is missing', () => {
    const ctx = makeRuntime();
    expect(() => createResolveTabConnectionHandler(ctx)('missing-tab')).toThrow('Tab not found: missing-tab');
  });

  it('abortTabInFlightCalls no-ops for missing tab', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createAbortTabInFlightCallsHandler(ctx, core)('missing-tab');
    expect(ctx.fireCancelInFlight).not.toHaveBeenCalled();
  });

  it('toggleServiceExpanded no-ops for unknown tab', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createToggleServiceExpandedHandler(core)('missing-tab', 'echo.EchoService');
    expect(ctx.sessionRef.current.tabDescriptors['missing-tab']).toBeUndefined();
  });

  it('toggleServiceExpanded initializes descriptor when missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    delete ctx.sessionRef.current.tabDescriptors[tabId];

    createToggleServiceExpandedHandler(core)(tabId, 'echo.EchoService');
    expect(ctx.sessionRef.current.tabDescriptors[tabId]?.expandedServiceIds).toEqual(['echo.EchoService']);
  });

  it('duplicateTab no-ops when source tab is missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createDuplicateTabHandler(ctx, core)('missing-tab');
    expect(ctx.sessionRef.current.tabs.length).toBe(1);
  });

  it('duplicateTab uses empty descriptor when source descriptor is missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const sourceId = ctx.sessionRef.current.activeTabId;
    delete ctx.sessionRef.current.tabDescriptors[sourceId];

    createDuplicateTabHandler(ctx, core)(sourceId);
    const newTabId = ctx.sessionRef.current.activeTabId;
    expect(ctx.sessionRef.current.tabs.length).toBe(2);
    expect(ctx.sessionRef.current.tabDescriptors[newTabId]).toEqual(createEmptyTabDescriptorState());
  });

  it('closeTab keeps active tab when closing a background tab', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    ctx.sessionRef.current = {
      tabs: [first, second],
      activeTabId: first.id,
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
      },
    };

    createCloseTabHandler(ctx, core)(second.id);
    expect(ctx.sessionRef.current.tabs.length).toBe(1);
    expect(ctx.sessionRef.current.activeTabId).toBe(first.id);
  });

  it('closeOtherTabs closes every tab except the keeper', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    const third = createGrpcStudioTab({}, [first, second]);
    ctx.sessionRef.current = {
      tabs: [first, second, third],
      activeTabId: first.id,
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
        [third.id]: createEmptyTabDescriptorState(),
      },
    };

    const closeTab = vi.fn();
    createCloseOtherTabsHandler(core, closeTab)(first.id);

    expect(closeTab).toHaveBeenCalledWith(second.id);
    expect(closeTab).toHaveBeenCalledWith(third.id);
  });

  it('closeTabsToRight only closes tabs after the selected one', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    const third = createGrpcStudioTab({}, [first, second]);
    ctx.sessionRef.current = {
      tabs: [first, second, third],
      activeTabId: first.id,
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
        [third.id]: createEmptyTabDescriptorState(),
      },
    };

    const closeTab = vi.fn();
    createCloseTabsToRightHandler(core, closeTab)(second.id);

    expect(closeTab).toHaveBeenCalledTimes(1);
    expect(closeTab).toHaveBeenCalledWith(third.id);
  });

  it('closeTabsToRight no-ops for unknown tab id', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const closeTab = vi.fn();

    createCloseTabsToRightHandler(core, closeTab)('missing-tab');
    expect(closeTab).not.toHaveBeenCalled();
  });

  it('reorderTab reorders valid indices and ignores invalid indices', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    const third = createGrpcStudioTab({}, [first, second]);
    ctx.sessionRef.current = {
      tabs: [first, second, third],
      activeTabId: first.id,
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
        [third.id]: createEmptyTabDescriptorState(),
      },
    };

    createReorderTabHandler(core)(0, 2);
    expect(ctx.sessionRef.current.tabs.map((tab) => tab.id)).toEqual([second.id, third.id, first.id]);

    const afterValid = ctx.sessionRef.current.tabs.map((tab) => tab.id);
    createReorderTabHandler(core)(-1, 1);
    createReorderTabHandler(core)(1, 9);
    expect(ctx.sessionRef.current.tabs.map((tab) => tab.id)).toEqual(afterValid);
  });

  it('selectMethod aborts active stream before switching methods', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    const dispose = vi.fn();
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'Echo',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-1',
      }),
    }];
    core.streamDisposeRef.current[tabId] = dispose;

    createSelectMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'ServerStream');
    expect(dispose).toHaveBeenCalled();
    expect(ctx.updateTab).toHaveBeenCalled();
  });

  it('selectMethod bumps timeout to stream default when choosing a streaming method from base default', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        timeoutMs: GRPC_DEFAULT_CALL_TIMEOUT_MS,
      }),
    }];

    createSelectMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'ServerStream');
    expect(ctx.updateTab).toHaveBeenCalledWith(
      tabId,
      expect.objectContaining({ timeoutMs: GRPC_DEFAULT_STREAM_CALL_TIMEOUT_MS }),
      expect.any(Object),
    );
  });

  it('selectMethod preserves custom timeout when choosing a streaming method', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    const customTimeoutMs = 45_000;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        timeoutMs: customTimeoutMs,
      }),
    }];

    createSelectMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'ServerStream');
    expect(ctx.updateTab).toHaveBeenCalledWith(
      tabId,
      expect.objectContaining({ timeoutMs: customTimeoutMs }),
      expect.any(Object),
    );
  });

  it('pruneSchemaDriftBody no-ops when method cannot be resolved', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'MissingMethod',
      }),
    }];

    createPruneSchemaDriftBodyHandler(ctx)(tabId);
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('rebindSchemaDriftMethod no-ops when target method is unknown', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'Echo',
      }),
    }];

    createRebindSchemaDriftMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'MissingMethod');
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('renameTab updates trimmed title', () => {
    const ctx = makeRuntime();
    createRenameTabHandler(ctx)(ctx.sessionRef.current.activeTabId, '  Renamed Tab  ');
    expect(ctx.updateTab).toHaveBeenCalledWith(
      ctx.sessionRef.current.activeTabId,
      { title: 'Renamed Tab' },
    );
  });

  it('renameTab no-ops when title trims to empty', () => {
    const ctx = makeRuntime();
    createRenameTabHandler(ctx)(ctx.sessionRef.current.activeTabId, '   ');
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('dismissSchemaDrift only clears warning drift', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      driftState: 'blocking',
    };
    createDismissSchemaDriftHandler(ctx)(tabId);
    expect(ctx.patchTabDescriptor).not.toHaveBeenCalled();

    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      driftState: 'warning',
    };
    createDismissSchemaDriftHandler(ctx)(tabId);
    expect(ctx.patchTabDescriptor).toHaveBeenCalled();
  });

  it('abortTabInFlightCalls bumps generation and cancels unary/stream', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    const dispose = vi.fn();
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({
        id: tabId,
        service: 'echo.EchoService',
        method: 'Echo',
        lifecycle: 'calling',
        activeRequestId: 'req-1',
        streamLifecycle: 'streaming',
        activeStreamId: 'stream-1',
      }),
    }];
    core.streamDisposeRef.current[tabId] = dispose;
    core.inFlightCallRef.current[tabId] = 'req-1';

    createAbortTabInFlightCallsHandler(ctx, core)(tabId);

    expect(ctx.fireCancelInFlight).toHaveBeenCalledWith(tabId, 'req-1');
    expect(dispose).toHaveBeenCalled();
    expect(core.callGenerationRef.current[tabId]).toBe(1);
  });

  it('selectTab no-ops when selecting the already active tab', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const active = ctx.sessionRef.current.activeTabId;
    createSelectTabHandler(core)(active);
    expect(ctx.sessionRef.current.activeTabId).toBe(active);
  });

  it('addTab respects max tab limit', () => {
    const ctx = makeRuntime({ maxTabs: 1 });
    const core = makeCore(ctx);
    createAddTabHandler(ctx, core)();
    expect(ctx.sessionRef.current.tabs).toHaveLength(1);
  });

  it('duplicateTab respects max tab limit', () => {
    const ctx = makeRuntime({ maxTabs: 1 });
    const core = makeCore(ctx);
    createDuplicateTabHandler(ctx, core)(ctx.sessionRef.current.activeTabId);
    expect(ctx.sessionRef.current.tabs).toHaveLength(1);
  });

  it('pruneSchemaDriftBody no-ops when tab service or method is missing', () => {
    const ctx = makeRuntime();
    const tabId = ctx.sessionRef.current.activeTabId;
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };
    ctx.sessionRef.current.tabs = [{
      ...createGrpcStudioTab({ id: tabId, service: '', method: '' }),
    }];
    createPruneSchemaDriftBodyHandler(ctx)(tabId);
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('closeTab aborts in-flight unary and active stream state', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const first = ctx.sessionRef.current.tabs[0]!;
    const second = createGrpcStudioTab({}, ctx.sessionRef.current.tabs);
    ctx.sessionRef.current = {
      tabs: [
        first,
        {
          ...second,
          lifecycle: 'calling',
          activeRequestId: 'req-1',
          activeStreamId: 'stream-1',
          streamLifecycle: 'streaming',
        },
      ],
      activeTabId: second.id,
      tabDescriptors: {
        [first.id]: createEmptyTabDescriptorState(),
        [second.id]: createEmptyTabDescriptorState(),
      },
    };

    createCloseTabHandler(ctx, core)(second.id);
    expect(ctx.fireCancelInFlight).toHaveBeenCalledWith(second.id, 'req-1');
    expect(ctx.sessionRef.current.tabs).toHaveLength(1);
    expect(ctx.sessionRef.current.activeTabId).toBe(first.id);
  });

  it('toggleServiceExpanded adds and removes service ids for an open tab', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = ctx.sessionRef.current.activeTabId;
    const toggle = createToggleServiceExpandedHandler(core);

    toggle(tabId, 'echo.EchoService');
    expect(ctx.sessionRef.current.tabDescriptors[tabId]?.expandedServiceIds).toContain('echo.EchoService');

    toggle(tabId, 'echo.EchoService');
    expect(ctx.sessionRef.current.tabDescriptors[tabId]?.expandedServiceIds ?? []).not.toContain('echo.EchoService');
  });

  it('dismissSchemaDrift no-ops when descriptor state is missing', () => {
    const ctx = makeRuntime();
    createDismissSchemaDriftHandler(ctx)('missing-tab');
    expect(ctx.patchTabDescriptor).not.toHaveBeenCalled();
  });

  it('selectMethod updates tab without aborting when tab row is missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = 'ghost-tab';
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };

    createSelectMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'Echo');
    expect(ctx.updateTab).toHaveBeenCalled();
    expect(ctx.fireCancelInFlight).not.toHaveBeenCalled();
  });

  it('selectMethod no-ops when descriptor state is missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createSelectMethodHandler(ctx, core)(ctx.sessionRef.current.activeTabId, 'echo.EchoService', 'Echo');
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('rebindSchemaDriftMethod no-ops when tab row is missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    const tabId = 'ghost-tab';
    ctx.sessionRef.current.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
    };

    createRebindSchemaDriftMethodHandler(ctx, core)(tabId, 'echo.EchoService', 'Echo');
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });

  it('rebindSchemaDriftMethod no-ops when descriptor state is missing', () => {
    const ctx = makeRuntime();
    const core = makeCore(ctx);
    createRebindSchemaDriftMethodHandler(ctx, core)(ctx.sessionRef.current.activeTabId, 'echo.EchoService', 'Echo');
    expect(ctx.updateTab).not.toHaveBeenCalled();
  });
});
