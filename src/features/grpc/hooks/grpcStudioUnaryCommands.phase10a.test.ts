/**
 * Phase 10A — transport preflight wired in prepareExecuteSnapshot.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '@shared/grpc/contractFixtures';
import { createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import {
  createExecuteUnaryCallHandler,
  createPrepareExecuteSnapshotHandler,
} from './grpcStudioUnaryCommands';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import type { GrpcStudioSessionCore } from './useGrpcStudioSessionCore';
import * as transportFacade from '@shared/grpc/grpcTransportFacade';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock('../../../shared/grpc/grpcTransportFacade', async (importOriginal) => {
  const actual = await importOriginal<typeof transportFacade>();
  return {
    ...actual,
    invokeGrpcUnary: vi.fn(),
  };
});

import { isTauri } from '@shared/utils/platform';

function makePrepareHarness(
  transportMode: 'grpc-web' | 'spring-servlet' | 'express',
  method: 'ClientStream' | 'BidiStream' | 'Echo' | 'ServerStream',
) {
  const tab = createGrpcStudioTab({
    id: 'tab-preflight',
    target: 'localhost:50051',
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    service: 'echo.EchoService',
    method,
    transportMode,
  });

  const tabsRef = { current: [tab] };
  const sessionRef = {
    current: {
      tabs: [tab],
      tabDescriptors: {
        'tab-preflight': {
          loadState: 'loaded' as const,
          descriptor: FIXTURE_DESCRIPTOR,
          sourceFingerprint: FIXTURE_DESCRIPTOR.sourceFingerprint,
          driftState: 'none' as const,
        },
      },
    },
  };

  const ctx = {
    envVarMap: {},
    profiles: [],
    pageDefaults: {},
    updateTab: () => undefined,
  } as unknown as GrpcStudioRuntimeContext;

  const core = {
    tabsRef,
    sessionRef,
  } as unknown as GrpcStudioSessionCore;

  const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
  return { prepare, tabId: tab.id };
}

describe('createPrepareExecuteSnapshotHandler transport preflight (Phase 10A)', () => {
  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('blocks grpc-web client streaming before snapshot capture', () => {
    const { prepare, tabId } = makePrepareHarness('grpc-web', 'ClientStream');
    expect(() => prepare(tabId, 'req-blocked')).toThrow(/client streaming/i);
  });

  it('blocks spring-servlet bidi streaming before snapshot capture', () => {
    const { prepare, tabId } = makePrepareHarness('spring-servlet', 'BidiStream');
    expect(() => prepare(tabId, 'req-blocked')).toThrow(/bidirectional streaming/i);
  });

  it('allows grpc-web unary snapshot capture', () => {
    const { prepare, tabId } = makePrepareHarness('grpc-web', 'Echo');
    const snapshot = prepare(tabId, 'req-ok');
    expect(snapshot.transportMode).toBe('grpc-web');
    expect(snapshot.transportSchemaVersion).toBe(1);
  });

  it('allows grpc-web server streaming snapshot capture', () => {
    const { prepare, tabId } = makePrepareHarness('grpc-web', 'ServerStream');
    const snapshot = prepare(tabId, 'req-stream-ok');
    expect(snapshot.transportMode).toBe('grpc-web');
    expect(snapshot.callType).toBe('server_streaming');
  });

  it('allows grpc-web on desktop before snapshot capture', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const { prepare, tabId } = makePrepareHarness('grpc-web', 'Echo');
    const snapshot = prepare(tabId, 'req-desktop-ok');
    expect(snapshot.transportMode).toBe('grpc-web');
  });

  it('allows spring-servlet on desktop before snapshot capture', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    const { prepare, tabId } = makePrepareHarness('spring-servlet', 'Echo');
    const snapshot = prepare(tabId, 'req-desktop-ok');
    expect(snapshot.transportMode).toBe('spring-servlet');
  });

  it('allows express on web', () => {
    const { prepare, tabId } = makePrepareHarness('express', 'ClientStream');
    const snapshot = prepare(tabId, 'req-express');
    expect(snapshot.transportMode).toBe('express');
    expect(snapshot.callType).toBe('client_streaming');
  });
});

describe('createExecuteUnaryCallHandler transport dispatch guard (Phase 10A)', () => {
  beforeEach(() => {
    vi.mocked(transportFacade.invokeGrpcUnary).mockReset();
  });

  it('invokes spring-servlet unary through transport facade with snapshot transportMode (Phase 10D)', async () => {
    const session = createInitialSessionState();
    const tabId = 'tab-servlet-invoke';
    session.tabs = [createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      transportMode: 'spring-servlet',
    })];
    session.activeTabId = tabId;
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };

    const sessionRef = { current: session };
    const ctx = {
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      updateTab: vi.fn((id, patch) => {
        sessionRef.current = {
          ...sessionRef.current,
          tabs: sessionRef.current.tabs.map((tab) => (
            tab.id === id ? { ...tab, ...patch } : tab
          )),
        };
      }),
    } as unknown as GrpcStudioRuntimeContext;

    const core = {
      sessionRef,
      tabsRef: { current: sessionRef.current.tabs },
      commitSession: (next: typeof session) => next,
      setSession: vi.fn(),
      callGenerationRef: { current: {} as Record<string, number> },
      streamGenerationRef: { current: {} as Record<string, number> },
      streamDisposeRef: { current: {} as Record<string, () => void> },
      inFlightCallRef: { current: {} as Record<string, string> },
    } as unknown as GrpcStudioSessionCore;

    vi.mocked(transportFacade.invokeGrpcUnary).mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 1,
        transportUsed: 'spring-servlet',
      },
      meta: { requestId: 'req-1', timestamp: '2026-06-30T00:00:00.000Z' },
    });

    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(transportFacade.invokeGrpcUnary).toHaveBeenCalledWith(
      expect.objectContaining({ transportMode: 'spring-servlet' }),
    );
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
  });

  it('invokes grpc-web unary through transport facade with snapshot transportMode (Phase 10C)', async () => {
    const session = createInitialSessionState();
    const tabId = 'tab-grpc-web-invoke';
    session.tabs = [createGrpcStudioTab({
      id: tabId,
      target: 'localhost:50051',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      transportMode: 'grpc-web',
    })];
    session.activeTabId = tabId;
    session.tabDescriptors[tabId] = {
      ...createEmptyTabDescriptorState(),
      descriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };

    const sessionRef = { current: session };
    const ctx = {
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      updateTab: vi.fn((id, patch) => {
        sessionRef.current = {
          ...sessionRef.current,
          tabs: sessionRef.current.tabs.map((tab) => (
            tab.id === id ? { ...tab, ...patch } : tab
          )),
        };
      }),
    } as unknown as GrpcStudioRuntimeContext;

    const core = {
      sessionRef,
      tabsRef: { current: sessionRef.current.tabs },
      commitSession: (next: typeof session) => next,
      setSession: vi.fn(),
      callGenerationRef: { current: {} as Record<string, number> },
      streamGenerationRef: { current: {} as Record<string, number> },
      streamDisposeRef: { current: {} as Record<string, () => void> },
      inFlightCallRef: { current: {} as Record<string, string> },
    } as unknown as GrpcStudioSessionCore;

    vi.mocked(transportFacade.invokeGrpcUnary).mockResolvedValue({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'hello' },
        durationMs: 1,
        transportUsed: 'grpc-web',
      },
      meta: { requestId: 'req-1', timestamp: '2026-06-30T00:00:00.000Z' },
    });

    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(transportFacade.invokeGrpcUnary).toHaveBeenCalledWith(
      expect.objectContaining({ transportMode: 'grpc-web' }),
    );
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
  });
});
