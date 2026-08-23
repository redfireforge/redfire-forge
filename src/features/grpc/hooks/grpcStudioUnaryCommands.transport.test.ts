/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from '@shared/grpc/contracts';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_RESULT,
} from '@shared/grpc/contractFixtures';
import {
  resetGrpcTabTransportRoutingForTests,
  syncGrpcTabTransportMode,
} from '@shared/grpc/grpcTransportFacade';
import { withGrpcExpressFallbackOffer } from '@shared/grpc/grpcTransportFallback';
import { buildBrowserTransportGrpcApiError } from '@shared/grpc/grpcBrowserTransportErrorMapper';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
} from '../grpcStudioTypes';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import {
  createExecuteUnaryCallHandler,
  createPrepareExecuteSnapshotHandler,
} from './grpcStudioUnaryCommands';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import * as transportFacade from '@shared/grpc/grpcTransportFacade';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../../../shared/grpc/grpcTransportFacade', async (importOriginal) => {
  const actual = await importOriginal<typeof transportFacade>();
  return {
    ...actual,
    invokeGrpcUnary: vi.fn(),
    cancelGrpcUnary: vi.fn(),
  };
});

import { isTauri } from '@shared/utils/platform';

function makeRuntime(sessionRef: { current: ReturnType<typeof createInitialSessionState> }): GrpcStudioRuntimeContext {
  const updateTab = vi.fn((tabId, patch) => {
    sessionRef.current = {
      ...sessionRef.current,
      tabs: sessionRef.current.tabs.map((tab) => (
        tab.id === tabId ? { ...tab, ...patch } : tab
      )),
    };
  });
  return {
    sessionRef,
    tabsRef: { current: sessionRef.current.tabs },
    setSession: vi.fn(),
    commitSession: (next) => next,
    descriptorLoadGenerationRef: { current: {} },
    callGenerationRef: { current: {} },
    streamGenerationRef: { current: {} },
    streamDisposeRef: { current: {} },
    inFlightCallRef: { current: {} },
    tabConnectionFingerprintRef: { current: {} },
    fireCancelInFlight: vi.fn(),
    envVarMap: {},
    profiles: [],
    pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    maxTabs: 8,
    updateTab,
    patchTabDescriptor: vi.fn(),
  };
}

function makeCore(sessionRef: { current: ReturnType<typeof createInitialSessionState> }) {
  return {
    sessionRef,
    tabsRef: { current: sessionRef.current.tabs },
    commitSession: (next: typeof sessionRef.current) => {
      sessionRef.current = next;
      return next;
    },
    setSession: vi.fn(),
    callGenerationRef: { current: {} as Record<string, number> },
    streamGenerationRef: { current: {} as Record<string, number> },
    streamDisposeRef: { current: {} as Record<string, () => void> },
    inFlightCallRef: { current: {} as Record<string, string> },
  };
}

describe('grpcStudioUnaryCommands transport fallback (Phase 7F)', () => {
  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  beforeEach(() => {
    resetGrpcTabTransportRoutingForTests();
    vi.mocked(transportFacade.invokeGrpcUnary).mockReset();
    vi.mocked(transportFacade.cancelGrpcUnary).mockReset();
    vi.mocked(transportFacade.cancelGrpcUnary).mockResolvedValue({
      ok: true,
      op: 'cancel',
      data: { requestId: 'req-1', cancelled: true },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });
  });

  it('offers express fallback after native preflight failure on tauri tab', async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'tauri',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'tauri');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockRejectedValue(
      new GrpcApiClientError('call', 'native invoke failed', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
      }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.details).toMatchObject({
      expressFallbackOffered: true,
      fallbackReason: 'native invoke failed',
    });
  });

  it('offers Express fallback when grpc-web browser transport fails with CORS (Phase 10E)', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'grpc-web',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'grpc-web');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockRejectedValue(
      buildBrowserTransportGrpcApiError('call', 'cors', { transportMode: 'grpc-web' }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.details).toMatchObject({
      browserTransportFailure: 'cors',
      expressFallbackOffered: true,
      transportAttempted: 'grpc-web',
    });
  });

  it('uses the transportMode override over stale tab state when retrying via Express (GRPC-19 regression)', async () => {
    // Reproduces the real "Retry with Express Proxy" click path: core.updateTab schedules a
    // React state update (batched, not synchronous), so the tab's own transportMode field can
    // still read the OLD browser-direct mode at the instant the retried call is prepared. The
    // explicit override must win so the retried call actually dispatches via Express.
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      // Stale — simulates the tab patch not having committed yet when retry re-fires the call.
      transportMode: 'grpc-web',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'grpc-web');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockResolvedValue({
      ok: true,
      op: 'call',
      data: FIXTURE_UNARY_CALL_RESULT,
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId, { transportMode: 'express' });

    expect(transportFacade.invokeGrpcUnary).toHaveBeenCalledWith(
      expect.objectContaining({ transportMode: 'express' }),
    );
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
  });

  it('offers Express fallback when spring-servlet browser transport fails with protocol_mismatch (Phase 10E)', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'spring-servlet',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'spring-servlet');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockRejectedValue(
      buildBrowserTransportGrpcApiError('call', 'protocol_mismatch', { transportMode: 'spring-servlet' }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.details).toMatchObject({
      browserTransportFailure: 'protocol_mismatch',
      expressFallbackOffered: true,
      transportAttempted: 'spring-servlet',
    });
  });

  it('offers Express fallback using tab transport when snapshot omits transportMode (Phase 10E)', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'grpc-web',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'grpc-web');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const basePrepare = createPrepareExecuteSnapshotHandler(ctx, core);
    const prepare = vi.fn((id: string, requestId: string, overrides?: Parameters<typeof basePrepare>[2]) => {
      const snapshot = basePrepare(id, requestId, overrides);
      const { transportMode: _removed, ...withoutMode } = snapshot;
      return withoutMode;
    });
    vi.mocked(transportFacade.invokeGrpcUnary).mockRejectedValue(
      buildBrowserTransportGrpcApiError('call', 'proxy_unreachable', { transportMode: 'grpc-web' }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.details).toMatchObject({
      browserTransportFailure: 'proxy_unreachable',
      expressFallbackOffered: true,
      transportAttempted: 'grpc-web',
    });
  });

  it('does not offer Express fallback for browser server_status failures (Phase 10E)', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'grpc-web',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'grpc-web');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockRejectedValue(
      buildBrowserTransportGrpcApiError('call', 'server_status', {
        transportMode: 'grpc-web',
        httpStatus: 503,
      }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lastError?.details).toMatchObject({
      browserTransportFailure: 'server_status',
    });
    expect(sessionRef.current.tabs[0]?.lastError?.details).not.toHaveProperty('expressFallbackOffered');
  });

  it('does not offer Express fallback for browser timeout failures (Phase 10E)', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'spring-servlet',
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'spring-servlet');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockRejectedValue(
      buildBrowserTransportGrpcApiError('call', 'timeout', { transportMode: 'spring-servlet' }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lastError?.details).toMatchObject({
      browserTransportFailure: 'timeout',
    });
    expect(sessionRef.current.tabs[0]?.lastError?.details).not.toHaveProperty('expressFallbackOffered');
  });

  it('forwards expressFallbackReason when retrying via express after native failure', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'express',
      lifecycle: 'idle',
      lastError: withGrpcExpressFallbackOffer(
        { code: GRPC_ERROR_CODES.UNREACHABLE, message: 'native invoke failed' },
        'native invoke failed',
      ),
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'express');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        ...FIXTURE_UNARY_CALL_RESULT,
        transportUsed: 'express',
        fallbackReason: 'native invoke failed',
      },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(transportFacade.invokeGrpcUnary).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackReason: 'native invoke failed',
        transportMode: 'express',
      }),
    );
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
  });

  it('forwards lastError message as expressFallbackReason when details omit fallbackReason', async () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'express',
      lifecycle: 'idle',
      lastError: {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        message: 'native invoke failed',
        details: { expressFallbackOffered: true },
      },
    });
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    syncGrpcTabTransportMode(tabId, 'express');
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(transportFacade.invokeGrpcUnary).mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        ...FIXTURE_UNARY_CALL_RESULT,
        transportUsed: 'express',
        fallbackReason: 'native invoke failed',
      },
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(transportFacade.invokeGrpcUnary).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackReason: 'native invoke failed' }),
    );
  });
});
