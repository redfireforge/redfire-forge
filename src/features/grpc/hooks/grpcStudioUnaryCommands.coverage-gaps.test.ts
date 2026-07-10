/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from '../../../shared/grpc/contracts';
import * as grpcApiClient from '../../../shared/grpc/grpcApiClient';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
  FIXTURE_UNARY_CALL_RESULT,
} from '../../../shared/grpc/contractFixtures';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
} from '../grpcStudioTypes';
import * as callHistoryCapture from '../utils/grpcStudioCallHistoryCapture';
import * as streamHelpers from './grpcStreamSessionHelpers';
import * as transportRouter from '../../../shared/grpc/grpcBrowserTransportRouter';
import * as transportFacade from '../../../shared/grpc/grpcTransportFacade';
import { buildBrowserTransportGrpcApiError } from '../../../shared/grpc/grpcBrowserTransportErrorMapper';
import { isGrpcExpressFallbackOffered } from '../../../shared/grpc/grpcTransportFallback';
import { createInitialSessionState } from './grpcStudioSessionHelpers';
import {
  createCancelUnaryCallHandler,
  createExecuteUnaryCallHandler,
  createPrepareExecuteSnapshotHandler,
} from './grpcStudioUnaryCommands';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import { getGrpcStudioMockRuntimeRegistry } from '../utils/grpcStudioAdvancedCommands';

vi.mock('../../../shared/grpc/grpcApiClient', async () => {
  const actual = await vi.importActual<typeof grpcApiClient>('../../../shared/grpc/grpcApiClient');
  return {
    ...actual,
    postGrpcCall: vi.fn(),
    deleteGrpcCall: vi.fn(),
  };
});

vi.mock('../utils/grpcStudioCallHistoryCapture', () => ({
  captureGrpcCallHistoryFromOutcome: vi.fn(),
}));

vi.mock('./grpcStreamSessionHelpers', async () => {
  const actual = await vi.importActual<typeof streamHelpers>('./grpcStreamSessionHelpers');
  return {
    ...actual,
    abortTabActiveStream: vi.fn(),
  };
});

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
    globalAuthProfiles: [],
    defaultAuthProfileId: null,
    pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    workspaceDefaults: { target: 'workspace:50051', tlsMode: 'disabled' },
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
    setSession: vi.fn((updater: typeof sessionRef.current | ((prev: typeof sessionRef.current) => typeof sessionRef.current)) => {
      sessionRef.current = typeof updater === 'function'
        ? updater(sessionRef.current)
        : updater;
    }),
    callGenerationRef: { current: {} as Record<string, number> },
    streamGenerationRef: { current: {} as Record<string, number> },
    streamDisposeRef: { current: {} as Record<string, () => void> },
    inFlightCallRef: { current: {} as Record<string, string> },
  };
}

function configureUnaryTab(session: ReturnType<typeof createInitialSessionState>) {
  const tabId = session.activeTabId;
  session.tabs[0] = createGrpcStudioTab({
    id: tabId,
    target: 'localhost:50051',
    service: 'echo.EchoService',
    method: 'Echo',
    body: { message: 'hello' },
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
  });
  session.tabDescriptors[tabId] = {
    ...createEmptyTabDescriptorState(),
    descriptor: FIXTURE_DESCRIPTOR,
    loadState: 'loaded',
  };
  return tabId;
}

describe('grpcStudioUnaryCommands coverage gaps', () => {
  beforeEach(() => {
    vi.mocked(grpcApiClient.postGrpcCall).mockReset();
    vi.mocked(grpcApiClient.deleteGrpcCall).mockReset();
    vi.mocked(callHistoryCapture.captureGrpcCallHistoryFromOutcome).mockReset();
    vi.mocked(streamHelpers.abortTabActiveStream).mockReset();
    vi.mocked(grpcApiClient.deleteGrpcCall).mockResolvedValue(undefined);
  });

  it('prepareExecuteSnapshot throws for missing tabs and blocking drift', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    expect(() => prepare('missing-tab', 'req-1')).toThrow(/Tab not found/i);

    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      driftState: 'blocking',
      driftMessage: 'Schema drift blocks execute',
    };
    expect(() => prepare(tabId, 'req-2')).toThrow(/Schema drift blocks execute/i);

    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      driftState: undefined,
      loadState: 'loading',
    };
    expect(() => prepare(tabId, 'req-3')).toThrow(/still loading/i);
  });

  it('prepareExecuteSnapshot builds snapshot with overrides', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    const snapshot = prepare(tabId, 'req-4', { body: { message: 'override' } });
    expect(snapshot.callType).toBe('unary');
    expect(snapshot.body).toEqual({ message: 'override' });
  });

  it('prepareExecuteSnapshot binds interpolationEnv with profile variable precedence (Phase 9C)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      target: '{{grpcHost}}',
      connectionId: 'p1',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = { grpcHost: 'env:50051' };
    ctx.profiles = [{
      id: 'p1',
      name: 'Profile',
      target: '{{grpcHost}}',
      tlsMode: 'disabled',
      variables: { grpcHost: 'profile:50051' },
    }];
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    const snapshot = prepare(tabId, 'req-env-bind');
    expect(snapshot.interpolationEnv?.env.grpcHost).toBe('profile:50051');
    expect(snapshot.target.address).toBe('profile:50051');
  });

  it('prepareExecuteSnapshot deep-interpolates body metadata and auth (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      body: { message: '{{greeting}}', nested: { tag: '{{envName}}' } },
      metadata: { 'x-env': '{{envName}}' },
      auth: { type: 'bearer', bearerToken: '{{token}}' },
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = {
      greeting: 'hello',
      envName: 'dev',
      token: 'abc123',
    };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    const snapshot = prepare(tabId, 'req-deep');
    expect(snapshot.body).toEqual({ message: 'hello', nested: { tag: 'dev' } });
    expect(snapshot.metadata).toEqual({ 'x-env': 'dev' });
    expect(snapshot.auth?.bearerToken).toBe('abc123');
  });

  it('prepareExecuteSnapshot deep-interpolates execute overrides (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = { greeting: 'from-override' };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    const snapshot = prepare(tabId, 'req-override-template', {
      body: { message: '{{greeting}}' },
    });
    expect(snapshot.body).toEqual({ message: 'from-override' });
  });

  it('prepareExecuteSnapshot rejects unresolved body templates (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    expect(() => prepare(tabId, 'req-unresolved-body', {
      body: { message: '{{missing}}' },
    })).toThrow(/unresolved template variables/i);
  });

  it('prepareExecuteSnapshot fails on invalid target before TLS and body interpolation (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      target: '{{missingHost}}',
      body: { message: '{{missingBody}}' },
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: 'not-a-valid-pem' },
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = {};
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    expect(() => prepare(tabId, 'req-target-before-tls')).toThrow(/target|unresolved|Resolve/i);
    expect(() => prepare(tabId, 'req-target-before-tls')).not.toThrow(/missingBody|PEM|TLS configuration/i);
  });

  it('prepareExecuteSnapshot fails on invalid target before body interpolation (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      target: '{{missingHost}}',
      body: { message: '{{missingBody}}' },
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = {};
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    expect(() => prepare(tabId, 'req-target-first')).toThrow(/target|unresolved|Resolve/i);
    expect(() => prepare(tabId, 'req-target-first')).not.toThrow(/missingBody/i);
  });

  it('prepareExecuteSnapshot deep-interpolates metadata overrides (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = { envName: 'dev' };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    const snapshot = prepare(tabId, 'req-meta-override', {
      metadata: { 'x-env': '{{envName}}' },
    });
    expect(snapshot.metadata).toEqual({ 'x-env': 'dev' });
  });

  it('prepareExecuteSnapshot applies tab envVarOverrides to body interpolation (Phase 9C/9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      body: { message: '{{greeting}}' },
      envVarOverrides: { greeting: 'from-tab-override' },
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = { greeting: 'from-env' };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    const snapshot = prepare(tabId, 'req-tab-override');
    expect(snapshot.body).toEqual({ message: 'from-tab-override' });
    expect(snapshot.interpolationEnv?.env.greeting).toBe('from-tab-override');
  });

  it('prepareExecuteSnapshot blocks missing grpcHost with validation error (Phase 9H)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      target: '{{grpcHost}}',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = { greeting: 'hello' };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    expect(() => prepare(tabId, 'req-missing-host')).toThrow(/grpcHost|Resolve|Environment Manager/i);
  });

  it('prepareExecuteSnapshot rejects cyclic env variables (Phase 9E)', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      target: '{{grpcHost}}',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.envVarMap = {
      grpcHost: '{{apiHost}}',
      apiHost: '{{grpcHost}}',
    };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    expect(() => prepare(tabId, 'req-cycle')).toThrow(/Circular variable reference/);
  });

  it('cancelUnaryCall no-ops without pending calls', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const onCancelInFlight = vi.fn();

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core, onCancelInFlight)('missing-tab');
    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core, onCancelInFlight)(tabId);

    expect(onCancelInFlight).not.toHaveBeenCalled();
    expect(grpcApiClient.deleteGrpcCall).not.toHaveBeenCalled();
  });

  it('cancelUnaryCall marks tab cancelled and notifies server', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      lifecycle: 'calling',
      activeRequestId: 'req-cancel',
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'req-cancel';
    const onCancelInFlight = vi.fn();

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core, onCancelInFlight)(tabId);

    expect(onCancelInFlight).toHaveBeenCalledWith(tabId, 'req-cancel');
    expect(grpcApiClient.deleteGrpcCall).toHaveBeenCalledWith('req-cancel', tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('cancelled');
  });

  it('cancelUnaryCall skips tabs already in success lifecycle', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      lifecycle: 'success',
      activeRequestId: 'req-done',
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'req-done';

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
  });

  it('cancelUnaryCall swallows deleteGrpcCall failures', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      lifecycle: 'calling',
      activeRequestId: 'req-cancel',
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'req-cancel';
    vi.mocked(grpcApiClient.deleteGrpcCall).mockRejectedValue(new Error('network'));

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('cancelled');
  });

  it('executeUnaryCall no-ops when tab is already calling', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = { ...session.tabs[0]!, lifecycle: 'calling' };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(grpcApiClient.postGrpcCall).not.toHaveBeenCalled();
  });

  it('executeUnaryCall aborts active streams before sending', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockResolvedValue({
      ok: true,
      op: 'call',
      data: FIXTURE_UNARY_CALL_RESULT,
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(streamHelpers.abortTabActiveStream).toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.streamLifecycle).toBe('idle');
    expect(grpcApiClient.postGrpcCall).toHaveBeenCalled();
  });

  it('executeUnaryCall surfaces prepare validation failures', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = { ...session.tabs[0]!, service: '', method: '' };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
  });

  it('executeUnaryCall rejects non-unary method bindings', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      service: 'echo.EchoService',
      method: 'ServerStream',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.message).toMatch(/not available for server_streaming/i);
  });

  it('executeUnaryCall completes successfully and captures history', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockResolvedValue({
      ok: true,
      op: 'call',
      data: FIXTURE_UNARY_CALL_RESULT,
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
    expect(sessionRef.current.tabs[0]?.lastResult).toEqual({
      ...FIXTURE_UNARY_CALL_RESULT,
      transportUsed: 'express',
    });
    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        result: {
          ...FIXTURE_UNARY_CALL_RESULT,
          transportUsed: 'express',
        },
      }),
    );
  });

  it('executeUnaryCall marks cancelled lifecycle for server-cancelled calls', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockRejectedValue(
      new GrpcApiClientError('call', 'cancelled', { code: GRPC_ERROR_CODES.CANCELLED }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('cancelled');
  });

  it('executeUnaryCall captures API failures and ignores stale results', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockImplementation(async () => {
      core.callGenerationRef.current[tabId] = 99;
      throw new GrpcApiClientError('call', 'refused', { code: GRPC_ERROR_CODES.CALL_FAILED });
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).not.toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.lifecycle).not.toBe('error');
  });

  it('executeUnaryCall records generic failures when postGrpcCall rejects', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockRejectedValue('broken pipe');

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Unary call failed' }),
      }),
    );
  });

  it('prepareExecuteSnapshot uses default drift message when driftMessage is absent', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      driftState: 'blocking',
      driftMessage: undefined,
    };
    const sessionRef = { current: session };
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), makeCore(sessionRef));

    expect(() => prepare(tabId, 'req-drift')).toThrow(/Resolve blocking schema drift/i);
  });

  it('cancelUnaryCall skips stale request ids during session update', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      lifecycle: 'calling',
      activeRequestId: 'current-req',
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'current-req';
    core.setSession = vi.fn((updater) => {
      sessionRef.current.tabs[0] = {
        ...sessionRef.current.tabs[0]!,
        activeRequestId: 'new-req',
      };
      sessionRef.current = typeof updater === 'function'
        ? updater(sessionRef.current)
        : updater;
    });

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('calling');
  });

  it('executeUnaryCall no-ops when inFlightCallRef already holds a request id', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'existing-req';
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(grpcApiClient.postGrpcCall).not.toHaveBeenCalled();
  });

  it('executeUnaryCall ignores errors after tab was cancelled locally', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockImplementation(async () => {
      sessionRef.current.tabs[0] = {
        ...sessionRef.current.tabs[0]!,
        lifecycle: 'cancelled',
      };
      throw new GrpcApiClientError('call', 'failed', { code: GRPC_ERROR_CODES.CALL_FAILED });
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('cancelled');
    expect(sessionRef.current.tabs[0]?.lastError).toBeUndefined();
  });

  it('executeUnaryCall ignores API errors when request id changed mid-flight', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockImplementation(async () => {
      core.inFlightCallRef.current[tabId] = 'other-request';
      throw new GrpcApiClientError('call', 'failed', { code: GRPC_ERROR_CODES.CALL_FAILED });
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('calling');
    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).not.toHaveBeenCalled();
  });

  it('executeUnaryCall uses fallback request id when crypto is unavailable', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    vi.mocked(grpcApiClient.postGrpcCall).mockResolvedValue({
      ok: true,
      op: 'call',
      data: FIXTURE_UNARY_CALL_RESULT,
      meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
    expect(grpcApiClient.postGrpcCall).toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
  });

  it('executeUnaryCall ignores late responses when request id changed', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.mocked(grpcApiClient.postGrpcCall).mockImplementation(async () => {
      core.inFlightCallRef.current[tabId] = 'other-request';
      return {
        ok: true,
        op: 'call',
        data: FIXTURE_UNARY_CALL_RESULT,
        meta: { requestId: 'req-1', timestamp: '2026-01-01T00:00:00.000Z' },
      };
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('calling');
  });

  it('executeUnaryCall surfaces non-Error prepare failures with default message', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = vi.fn(() => {
      throw 'prepare exploded';
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lastError?.message).toBe('Cannot execute unary call');
  });

  it('executeUnaryCall surfaces non-Error transport dispatch failures', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      transportMode: 'grpc-web',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    const dispatchSpy = vi.spyOn(transportRouter, 'assertGrpcTransportDispatchReady').mockImplementation(() => {
      throw 'dispatch unavailable';
    });

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    dispatchSpy.mockRestore();
    expect(sessionRef.current.tabs[0]?.lastError?.message).toBe('Transport dispatch is not available');
  });

  it('executeUnaryCall offers browser express fallback for grpc-web transport failures', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      transportMode: 'grpc-web',
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.spyOn(transportFacade, 'invokeGrpcUnary').mockRejectedValue(
      buildBrowserTransportGrpcApiError('call', 'cors', { transportMode: 'grpc-web' }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(isGrpcExpressFallbackOffered(sessionRef.current.tabs[0]?.lastError)).toBe(true);
  });

  it('executeUnaryCall preserves generic GrpcApiClientError body on express tab', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    vi.spyOn(transportFacade, 'invokeGrpcUnary').mockRejectedValue(
      new GrpcApiClientError('call', 'refused', { code: GRPC_ERROR_CODES.CALL_FAILED }),
    );

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(sessionRef.current.tabs[0]?.lastError?.message).toBe('refused');
    expect(isGrpcExpressFallbackOffered(sessionRef.current.tabs[0]?.lastError)).toBe(false);
  });

  it('cancelUnaryCall skips session commit when tab row disappears', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      lifecycle: 'calling',
      activeRequestId: 'req-vanish',
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'req-vanish';
    core.setSession = vi.fn((updater) => {
      sessionRef.current = { ...sessionRef.current, tabs: [] };
      sessionRef.current = typeof updater === 'function'
        ? updater(sessionRef.current)
        : updater;
    });

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core)(tabId);

    expect(sessionRef.current.tabs).toHaveLength(0);
  });

  it('cancelUnaryCall skips session commit when lifecycle is idle without request id', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      lifecycle: 'calling',
      activeRequestId: undefined,
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.setSession = vi.fn((updater) => {
      sessionRef.current.tabs[0] = {
        ...sessionRef.current.tabs[0]!,
        lifecycle: 'idle',
      };
      sessionRef.current = typeof updater === 'function'
        ? updater(sessionRef.current)
        : updater;
    });

    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core)(tabId);

    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('idle');
  });

  it('prepareExecuteSnapshot binds workspace defaults into interpolation env', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      target: '{{grpcHost}}',
    };
    const sessionRef = { current: session };
    const ctx = {
      ...makeRuntime(sessionRef),
      envVarMap: { grpcHost: 'localhost:50051' },
      workspaceDefaults: { grpcHost: 'workspace-host:50051' },
    };
    const core = makeCore(sessionRef);
    const snapshot = createPrepareExecuteSnapshotHandler(ctx, core)(tabId, 'req-workspace');
    expect(snapshot.target.address).toBe('localhost:50051');
  });

  it('executeUnaryCall passes express fallback reason from prior tab error', async () => {
    const invokeSpy = vi.spyOn(transportFacade, 'invokeGrpcUnary').mockResolvedValue({
      ok: true,
      data: FIXTURE_UNARY_CALL_RESULT,
    } as never);
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      transportMode: 'express',
      lastError: {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'Express proxy unavailable',
        details: { fallbackReason: 'proxy_down', expressFallbackOffered: true },
      },
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), core);
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(invokeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackReason: 'proxy_down' }),
    );
    invokeSpy.mockRestore();
  });

  it('executeUnaryCall surfaces transport dispatch readiness failures', async () => {
    vi.spyOn(transportRouter, 'assertGrpcTransportDispatchReady').mockImplementation(() => {
      throw new Error('Browser transport unavailable');
    });
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), core);
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.message).toMatch(/Browser transport unavailable/i);
    vi.restoreAllMocks();
  });

  it('executeUnaryCall ignores prepare failures when call generation becomes stale', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = vi.fn(() => {
      core.callGenerationRef.current[tabId] = 99;
      throw new Error('prepare failed late');
    });
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('calling');
  });

  it('executeUnaryCall rejects non-unary snapshots returned from prepare', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = vi.fn((_tabId: string, requestId: string) => ({
      tabId,
      requestId,
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'server_streaming' as const,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: 'ServerStream',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'express' as const,
    }));
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
  });

  it('executeUnaryCall maps generic thrown values to stream-style error bodies', async () => {
    const invokeSpy = vi.spyOn(transportFacade, 'invokeGrpcUnary').mockRejectedValue('plain failure');
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), core);
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(sessionRef.current.tabs[0]?.lastError?.message).toBe('Unary call failed');
    invokeSpy.mockRestore();
  });

  it('executeUnaryCall ignores late success when request id changed mid-flight', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), core);
    const invokeSpy = vi.spyOn(transportFacade, 'invokeGrpcUnary').mockImplementation(async () => {
      core.inFlightCallRef.current[tabId] = 'other-request';
      return { ok: true, data: FIXTURE_UNARY_CALL_RESULT } as never;
    });
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('calling');
    expect(sessionRef.current.tabs[0]?.lastResult).toBeUndefined();
    invokeSpy.mockRestore();
  });

  it('executeUnaryCall maps tauri unreachable failures to express fallback bodies', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = { ...session.tabs[0]!, transportMode: 'tauri' };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = vi.fn((_tabId: string, requestId: string) => ({
      tabId,
      requestId,
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: FIXTURE_UNARY_CALL_REQUEST.body,
      metadata: FIXTURE_UNARY_CALL_REQUEST.metadata,
      timeoutMs: FIXTURE_UNARY_CALL_REQUEST.timeoutMs,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      transportMode: 'tauri' as const,
    }));
    const invokeSpy = vi.spyOn(transportFacade, 'invokeGrpcUnary').mockRejectedValue(
      new GrpcApiClientError('call', 'Native channel unavailable', {
        code: GRPC_ERROR_CODES.UNREACHABLE,
        category: 'unreachable',
      }),
    );
    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);
    invokeSpy.mockRestore();
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('error');
    expect(isGrpcExpressFallbackOffered(sessionRef.current.tabs[0]?.lastError)).toBe(true);
  });

  it('executeUnaryCall uses express fallback reason from lastError message when details omit it', async () => {
    const invokeSpy = vi.spyOn(transportFacade, 'invokeGrpcUnary').mockResolvedValue({
      ok: true,
      data: FIXTURE_UNARY_CALL_RESULT,
    } as never);
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      transportMode: 'express',
      lastError: {
        code: GRPC_ERROR_CODES.CALL_FAILED,
        category: 'call_failed',
        message: 'Proxy unavailable',
        details: { expressFallbackOffered: true },
      },
    };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), core);
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(invokeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackReason: 'Proxy unavailable' }),
    );
    invokeSpy.mockRestore();
  });

  it('executeUnaryCall surfaces non-Error transport dispatch failures with default text', async () => {
    vi.spyOn(transportRouter, 'assertGrpcTransportDispatchReady').mockImplementation(() => {
      throw 'dispatch string failure';
    });
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(makeRuntime(sessionRef), core);
    await createExecuteUnaryCallHandler(makeRuntime(sessionRef), core, prepare)(tabId);
    expect(sessionRef.current.tabs[0]?.lastError?.message).toBe('Transport dispatch is not available');
    vi.restoreAllMocks();
  });

  it('executeUnaryCall intercepts through the browser mock runtime registry', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    const core = makeCore(sessionRef);
    const prepare = createPrepareExecuteSnapshotHandler(ctx, core);
    const registry = getGrpcStudioMockRuntimeRegistry();
    registry.startTab(tabId, {
      connectionId: 'conn-mock',
      ruleSet: {
        rules: [{
          id: 'echo',
          name: 'Echo',
          enabled: true,
          priority: 1,
          predicate: { kind: 'method_equals', method: 'Echo' },
          response: { statusCode: 0, message: 'mocked', body: { message: 'mocked' } },
        }],
      },
    });
    const invokeSpy = vi.spyOn(transportFacade, 'invokeGrpcUnary');

    await createExecuteUnaryCallHandler(ctx, core, prepare)(tabId);

    expect(invokeSpy).not.toHaveBeenCalled();
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('success');
    expect(sessionRef.current.tabs[0]?.lastResult?.body).toEqual({ message: 'mocked' });
    expect(callHistoryCapture.captureGrpcCallHistoryFromOutcome).toHaveBeenCalled();
    registry.remove(tabId, { force: true });
    invokeSpy.mockRestore();
  });

  it('prepareExecuteSnapshot throws when resolved auth has an issue', () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    session.tabs[0] = {
      ...session.tabs[0]!,
      auth: { type: 'inherit' },
    };
    const sessionRef = { current: session };
    const ctx = makeRuntime(sessionRef);
    ctx.defaultAuthProfileId = 'missing-profile';
    ctx.globalAuthProfiles = [];
    const prepare = createPrepareExecuteSnapshotHandler(ctx, makeCore(sessionRef));

    expect(() => prepare(tabId, 'req-auth-issue')).toThrow(/auth|profile|inherit/i);
  });

  it('cancelUnaryCall leaves unrelated tabs unchanged in session commit', async () => {
    const session = createInitialSessionState();
    const tabId = configureUnaryTab(session);
    const otherTab = createGrpcStudioTab({ id: 'tab-other', title: 'Other' });
    session.tabs.push(otherTab);
    session.tabs[0] = { ...session.tabs[0]!, lifecycle: 'calling', activeRequestId: 'req-cancel-other' };
    const sessionRef = { current: session };
    const core = makeCore(sessionRef);
    core.inFlightCallRef.current[tabId] = 'req-cancel-other';
    await createCancelUnaryCallHandler(makeRuntime(sessionRef), core)(tabId);
    expect(sessionRef.current.tabs[0]?.lifecycle).toBe('cancelled');
    expect(sessionRef.current.tabs[1]?.lifecycle).not.toBe('cancelled');
  });
});
