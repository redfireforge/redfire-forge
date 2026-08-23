/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as grpcApiClient from '@shared/grpc/grpcApiClient';
import * as streamHelpers from '../grpcStreamSessionHelpers';
import { createInitialSessionState } from '../grpcStudioSessionHelpers';
import {createPrepareExecuteSnapshotHandler,
} from '../grpcStudioUnaryCommands';
import {
  configureUnaryTab,
  makeCore,
  makeRuntime,
  setupGrpcStudioUnaryCommandsCoverageGapsTest,
} from './grpcStudioUnaryCommandsCoverageGaps.testHelpers';

vi.mock('../../../../shared/grpc/grpcApiClient', async () => {
  const actual = await vi.importActual<typeof grpcApiClient>('../../../../shared/grpc/grpcApiClient');
  return {
    ...actual,
    postGrpcCall: vi.fn(),
    deleteGrpcCall: vi.fn(),
  };
});

vi.mock('../../utils/grpcStudioCallHistoryCapture', () => ({
  captureGrpcCallHistoryFromOutcome: vi.fn(),
}));

vi.mock('../grpcStreamSessionHelpers', async () => {
  const actual = await vi.importActual<typeof streamHelpers>('../grpcStreamSessionHelpers');
  return {
    ...actual,
    abortTabActiveStream: vi.fn(),
  };
});


describe('grpcStudioUnaryCommands coverage gaps — prepare snapshot', () => {
  beforeEach(() => {
    setupGrpcStudioUnaryCommandsCoverageGapsTest();
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

});
