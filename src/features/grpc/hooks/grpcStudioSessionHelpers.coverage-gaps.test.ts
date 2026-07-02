import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/grpc/grpcTransportFacade', () => ({
  cancelGrpcUnary: vi.fn(() => Promise.resolve()),
}));

import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { cancelGrpcUnary } from '../../../shared/grpc/grpcTransportFacade';
import * as grpcMetadataEditor from '../utils/grpcMetadataEditor';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import {
  abortTabPendingUnaryCall,
  assertTabAuthExecuteReady,
  assertTabMetadataValid,
  assertTabTlsConfigValid,
  bindTabInterpolationEnvForExecute,
  buildDescriptorLoadFailureUpdates,
  buildDescriptorLoadSuccessUpdates,
  clearedDescriptorContextPatch,
  clearedMethodBindingPatch,
  clearedSchemaDriftPatch,
  clearedStaleMethodSelectionPatch,
  createGrpcTabInterpolationEnvSnapshot,
  createInitialSessionState,
  invalidateTabConnectionContext,
  invalidateTabDescriptorConnectionContext,
  patchShouldResetTargetConnectionSession,
  patchTouchesConnection,
  pickFallbackActiveTabId,
  prepareGrpcTabPatchForConsumer,
  releaseCompletedGrpcCall,
  rememberTabConnectionFingerprint,
  resolveExpandedServiceIdsAfterReflect,
  resolveTabAbortRequestId,
  resolveTabConnectionWithEnv,
  assertTabConnectionCanonicalEnvValid,
  sanitizeDescriptorPatch,
  sanitizeTabPatch,
  tabConnectionResolutionFingerprint,
  tabHasPendingUnaryCall,
  withTargetConnectionSessionReset,
} from './grpcStudioSessionHelpers';

function makeTab(id: string, overrides: Partial<GrpcStudioTabState> = {}): GrpcStudioTabState {
  return {
    id,
    title: id,
    target: 'localhost:50051',
    tlsMode: 'plaintext',
    lifecycle: 'idle',
    streamLifecycle: 'idle',
    streamMessages: [],
    lastSequence: 0,
    body: {},
    metadata: {},
    requestMode: 'form',
    ...overrides,
  } as GrpcStudioTabState;
}

describe('grpcStudioSessionHelpers coverage gaps', () => {
  it('resolveTabConnectionWithEnv resolves env vars and validates target', () => {
    const tab = makeTab('t1', { target: '{{grpcHost}}' });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      { grpcHost: 'localhost:50051' },
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(resolution.target).toBe('localhost:50051');
    expect(resolution.targetValidation.valid).toBe(true);
  });

  it('resolveTabConnectionWithEnv merges profile variables for linked connection', () => {
    const tab = makeTab('t1', { target: '{{grpcHost}}', connectionId: 'p1' });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      { grpcHost: 'env:50051' },
      [{
        id: 'p1',
        name: 'Profile',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
        variables: { grpcHost: 'profile:50051' },
      }],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(resolution.target).toBe('profile:50051');
  });

  it('resolveTabConnectionWithEnv rejects invalid canonical grpcHost before interpolation (Phase 9D)', () => {
    const tab = makeTab('t1', { target: '{{grpcHost}}', connectionId: 'p1' });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      { grpcHost: 'http://bad:50051' },
      [{
        id: 'p1',
        name: 'Profile',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
      }],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(resolution.targetValidation.valid).toBe(false);
    if (!resolution.targetValidation.valid) {
      expect(resolution.targetValidation.reason).toContain('Environment Manager');
      expect(resolution.target).toBe('{{grpcHost}}');
    }
  });

  it('resolveTabConnectionWithEnv rejects cyclic env variables (Phase 9E)', () => {
    const tab = makeTab('t1', { target: '{{grpcHost}}' });
    const resolution = resolveTabConnectionWithEnv(
      tab,
      { grpcHost: '{{apiHost}}', apiHost: '{{grpcHost}}' },
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(resolution.targetValidation.valid).toBe(false);
    if (!resolution.targetValidation.valid) {
      expect(resolution.targetValidation.reason).toMatch(/Circular variable reference/);
      expect(resolution.target).toBe('{{grpcHost}}');
    }
  });

  it('bindTabInterpolationEnvForExecute rejects invalid canonical grpcHost (Phase 9D)', () => {
    const tab = makeTab('t1', { target: '{{grpcHost}}', connectionId: 'p1' });
    expect(() => bindTabInterpolationEnvForExecute(
      tab,
      { grpcHost: 'http://bad:50051' },
      [{
        id: 'p1',
        name: 'Profile',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
      }],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    )).toThrow(/Environment Manager/);
  });

  it('bindTabInterpolationEnvForExecute rejects cyclic env variables (Phase 9E)', () => {
    const tab = makeTab('t1', { target: '{{grpcHost}}' });
    expect(() => bindTabInterpolationEnvForExecute(
      tab,
      { grpcHost: '{{apiHost}}', apiHost: '{{grpcHost}}' },
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    )).toThrow(/Circular variable reference/);
  });

  it('assertTabConnectionCanonicalEnvValid skips unreferenced invalid grpcHost', () => {
    const tab = makeTab('t1', { target: 'localhost:50051' });
    expect(() => assertTabConnectionCanonicalEnvValid(
      tab,
      { grpcHost: 'http://bad:50051' },
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    )).not.toThrow();
  });

  it('pickFallbackActiveTabId returns empty string for empty tab list', () => {
    expect(pickFallbackActiveTabId([], 'missing')).toBe('');
  });

  it('pickFallbackActiveTabId prefers previous tab when closing a later tab', () => {
    const tabs = [makeTab('t1'), makeTab('t2'), makeTab('t3')];
    expect(pickFallbackActiveTabId(tabs, 't3')).toBe('t2');
    expect(pickFallbackActiveTabId(tabs, 't1')).toBe('t2');
  });

  it('clearedMethodBindingPatch and clearedStaleMethodSelectionPatch reset binding fields', () => {
    expect(clearedMethodBindingPatch()).toMatchObject({
      descriptorKey: undefined,
      service: undefined,
      method: undefined,
      body: {},
      requestMode: 'form',
    });
    expect(clearedStaleMethodSelectionPatch()).toMatchObject({
      lifecycle: 'idle',
      streamLifecycle: 'idle',
    });
  });

  it('tabConnectionResolutionFingerprint marks invalid targets', () => {
    const tab = makeTab('t1', { target: '{{unresolved}}' });
    const fp = tabConnectionResolutionFingerprint(tab, {}, [], { target: 'localhost:50051', tlsMode: 'disabled' });
    expect(fp.startsWith('invalid:')).toBe(true);
  });

  it('rememberTabConnectionFingerprint stores fingerprint in ref', () => {
    const ref = { current: {} as Record<string, string> };
    const tab = makeTab('t1');
    rememberTabConnectionFingerprint(ref, tab, {}, [], { target: 'localhost:50051', tlsMode: 'disabled' });
    expect(ref.current['t1']).toMatch(/^valid:/);
  });

  it('sanitizeDescriptorPatch clones drift-related nested fields', () => {
    const issue = { kind: 'field_removed' as const, path: 'message', severity: 'warning' as const };
    const rebind = { service: 'echo.EchoService', method: 'Echo', score: 1 };
    const staleMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
    const patch = sanitizeDescriptorPatch({
      driftIssues: [issue],
      suggestedRebinds: [rebind],
      driftStaleMethod: staleMethod,
      driftBaselineRequestSchema: staleMethod.requestSchema,
    });
    expect(patch.driftIssues).not.toBe([issue]);
    expect(patch.suggestedRebinds).not.toBe([rebind]);
    expect(patch.driftStaleMethod).not.toBe(staleMethod);
    expect(patch.driftBaselineRequestSchema).not.toBe(staleMethod.requestSchema);
  });

  it('sanitizeTabPatch clones execution, auth, tls, and stream fields', () => {
    const lastResult = { callType: 'unary' as const, status: 0, statusMessage: 'OK', headers: {}, trailers: {}, durationMs: 1 };
    const lastError = { code: 'GRPC_CALL_FAILED', category: 'call_failed' as const, message: 'boom' };
    const lastExecuteSnapshot = { tabId: 't1', requestId: 'r1', capturedAt: 't', callType: 'unary' as const, target: { address: 'localhost:50051', tlsMode: 'disabled' as const }, service: 's', method: 'm', body: {}, metadata: {}, timeoutMs: 30_000, descriptorKey: 'd' };
    const auth = { type: 'bearer' as const, bearerToken: 'tok' };
    const streamMessages = [{ sequence: 1, timestamp: 't', direction: 'inbound' as const, data: {} }];
    const patch = sanitizeTabPatch({
      id: 'strip-me',
      body: { message: 'hi' },
      metadata: { trace: '1' },
      lastResult,
      lastError,
      lastExecuteSnapshot,
      auth,
      tlsConfig: { serverCaPem: 'pem' },
      streamMessages,
    });
    expect(patch).not.toHaveProperty('id');
    expect(patch.lastResult).not.toBe(lastResult);
    expect(patch.lastError).not.toBe(lastError);
    expect(patch.lastExecuteSnapshot).not.toBe(lastExecuteSnapshot);
    expect(patch.auth).not.toBe(auth);
    expect(patch.streamMessages).not.toBe(streamMessages);
  });

  it('abortTabPendingUnaryCall notifies and clears in-flight ref', () => {
    const inFlightCallRef = { current: { 't1': 'req-1' } };
    const onAbort = vi.fn();
    const tab = makeTab('t1', { lifecycle: 'calling', activeRequestId: 'req-1' });
    const requestId = abortTabPendingUnaryCall('t1', tab, inFlightCallRef, onAbort);
    expect(requestId).toBe('req-1');
    expect(onAbort).toHaveBeenCalledWith('t1', 'req-1');
    expect(inFlightCallRef.current['t1']).toBeUndefined();
    expect(cancelGrpcUnary).toHaveBeenCalledWith('req-1', 't1', { transportMode: 'express' });
  });

  it('abortTabPendingUnaryCall returns undefined when no pending call', () => {
    const inFlightCallRef = { current: {} as Record<string, string> };
    expect(abortTabPendingUnaryCall('t1', makeTab('t1'), inFlightCallRef)).toBeUndefined();
  });

  it('resolveTabAbortRequestId prefers activeRequestId then in-flight ref', () => {
    const ref = { current: { t1: 'ref-req' } };
    expect(resolveTabAbortRequestId(makeTab('t1', { activeRequestId: 'active-req' }), 't1', ref)).toBe('active-req');
    expect(resolveTabAbortRequestId(makeTab('t1'), 't1', ref)).toBe('ref-req');
  });

  it('releaseCompletedGrpcCall invokes cancelGrpcUnary with optional transport mode', () => {
    releaseCompletedGrpcCall('req-done', 't1', { transportMode: 'express' });
    expect(cancelGrpcUnary).toHaveBeenCalledWith('req-done', 't1', { transportMode: 'express' });
  });

  it('assertTabAuthExecuteReady throws for invalid bearer auth', () => {
    expect(() => assertTabAuthExecuteReady({
      id: 't1',
      title: 't1',
      target: 'localhost:50051',
      body: {},
      metadata: {},
      timeoutMs: 30000,
      requestMode: 'form',
      lifecycle: 'idle',
      streamLifecycle: 'idle',
      streamMessages: [],
      lastSequence: 0,
      streamPendingBodies: [],
      auth: { type: 'bearer' },
    } as GrpcStudioTabState)).toThrow(/auth|token|Invalid/i);
  });

  it('abortTabPendingUnaryCall skips notify when request id is missing', () => {
    const inFlightCallRef = { current: { t1: 'req-1' } };
    const onAbort = vi.fn();
    const tab = makeTab('t1', { lifecycle: 'calling' });
    delete tab.activeRequestId;
    const requestId = abortTabPendingUnaryCall('t1', tab, inFlightCallRef, onAbort);
    expect(requestId).toBe('req-1');
    expect(onAbort).toHaveBeenCalledWith('t1', 'req-1');
  });

  it('abortTabPendingUnaryCall returns undefined when no request id resolved', () => {
    vi.mocked(cancelGrpcUnary).mockClear();
    const inFlightCallRef = { current: {} as Record<string, string> };
    const tab = makeTab('t1', { lifecycle: 'calling' });
    expect(abortTabPendingUnaryCall('t1', tab, inFlightCallRef)).toBeUndefined();
    expect(cancelGrpcUnary).not.toHaveBeenCalled();
  });

  it('assertTabTlsConfigValid uses default message when issue message missing', () => {
    const resolution = {
      target: 'localhost:50051',
      tlsMode: 'mtls' as const,
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' as const },
    };
    expect(() => assertTabTlsConfigValid(resolution, undefined)).toThrow(/Invalid TLS configuration|clientCertPem/i);
  });

  it('invalidateTabConnectionContext clears idle tab without pending calls', () => {
    const descriptorLoadGenerationRef = { current: {} as Record<string, number> };
    const callGenerationRef = { current: {} as Record<string, number> };
    const streamGenerationRef = { current: {} as Record<string, number> };
    const inFlightCallRef = { current: {} as Record<string, string> };
    const streamDisposeRef = { current: {} as Record<string, () => void> };
    const patch = invalidateTabConnectionContext(
      't1',
      makeTab('t1'),
      descriptorLoadGenerationRef,
      callGenerationRef,
      streamGenerationRef,
      inFlightCallRef,
      streamDisposeRef,
    );
    expect(patch.lifecycle).toBe('idle');
    expect(descriptorLoadGenerationRef.current['t1']).toBe(1);
  });

  it('assertTabMetadataValid falls back to default message', () => {
    vi.spyOn(grpcMetadataEditor, 'validateGrpcMetadataEntries').mockReturnValue({
      valid: false,
      message: undefined,
    });
    expect(() => assertTabMetadataValid(makeTab('t1'))).toThrow('Invalid metadata');
  });

  it('buildDescriptorLoadSuccessUpdates applies sourceSelectionPatch', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    const { descriptorPatch } = buildDescriptorLoadSuccessUpdates(
      tabId,
      session,
      FIXTURE_DESCRIPTOR,
      { sourceSelectionPatch: { mode: 'manual', activeSource: 'protoset' } },
    );
    expect(descriptorPatch.sourceSelection?.mode).toBe('manual');
    expect(descriptorPatch.sourceSelection?.activeSource).toBe('protoset');
  });

  it('buildDescriptorLoadFailureUpdates preserves descriptor without tab patch', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };
    const { tabPatch } = buildDescriptorLoadFailureUpdates(session, tabId, 'load failed');
    expect(tabPatch).toBeUndefined();
  });

  it('invalidateTabConnectionContext aborts unary and stream work then clears context', () => {
    const tab = makeTab('t1', {
      lifecycle: 'calling',
      activeRequestId: 'req-1',
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
    });
    const descriptorLoadGenerationRef = { current: {} as Record<string, number> };
    const callGenerationRef = { current: {} as Record<string, number> };
    const streamGenerationRef = { current: {} as Record<string, number> };
    const inFlightCallRef = { current: { t1: 'req-1' } };
    const streamDisposeRef = { current: { t1: vi.fn() } };
    const onAbort = vi.fn();

    const patch = invalidateTabConnectionContext(
      't1',
      tab,
      descriptorLoadGenerationRef,
      callGenerationRef,
      streamGenerationRef,
      inFlightCallRef,
      streamDisposeRef,
      onAbort,
    );

    expect(onAbort).toHaveBeenCalledWith('t1', 'req-1');
    expect(descriptorLoadGenerationRef.current['t1']).toBe(1);
    expect(callGenerationRef.current['t1']).toBe(1);
    expect(patch.lifecycle).toBe('idle');
    expect(patch.streamLifecycle).toBe('idle');
  });

  it('resolveExpandedServiceIdsAfterReflect expands all services on descriptor key change', () => {
    const expanded = resolveExpandedServiceIdsAfterReflect('old-key', FIXTURE_DESCRIPTOR, ['stale.Service']);
    expect(expanded).toEqual(FIXTURE_DESCRIPTOR.services.map((service) => service.fullName));
  });

  it('resolveExpandedServiceIdsAfterReflect filters stale expanded ids for same descriptor key', () => {
    const serviceName = FIXTURE_DESCRIPTOR.services[0]!.fullName;
    const expanded = resolveExpandedServiceIdsAfterReflect(
      FIXTURE_DESCRIPTOR.key,
      FIXTURE_DESCRIPTOR,
      [serviceName, 'missing.Service'],
    );
    expect(expanded).toEqual([serviceName]);
  });

  it('patchTouchesConnection and patchShouldResetTargetConnectionSession detect transport edits', () => {
    expect(patchTouchesConnection({ target: 'localhost:50052' })).toBe(true);
    expect(patchTouchesConnection({ body: {} })).toBe(false);
    expect(patchShouldResetTargetConnectionSession({ tlsConfig: { serverCaPem: 'pem' } })).toBe(true);
    expect(withTargetConnectionSessionReset({ target: 'localhost:50052' })).toMatchObject({
      targetConnection: { state: 'idle' },
    });
    expect(withTargetConnectionSessionReset({ targetConnection: { state: 'connected' } })).toEqual({
      targetConnection: { state: 'connected' },
    });
  });

  it('sanitizeDescriptorPatch clones descriptor, proto ingest, and source selection arrays', () => {
    const descriptor = structuredClone(FIXTURE_DESCRIPTOR);
    const patch = sanitizeDescriptorPatch({
      descriptor,
      protoIngest: { files: [{ path: 'a.proto', content: 'syntax = "proto3";' }] },
      sourceSelection: { mode: 'auto', activeSource: 'reflection', autoPrecedence: ['reflection', 'protoset'] },
    });
    expect(patch.descriptor).not.toBe(descriptor);
    expect(patch.protoIngest).toBeDefined();
    expect(patch.sourceSelection?.autoPrecedence).toEqual(['reflection', 'protoset']);
  });

  it('sanitizeTabPatch clones k8s port-forward session and clears undefined tls config', () => {
    const patch = sanitizeTabPatch({
      tlsConfig: undefined,
      k8sPortForward: {
        active: true,
        config: {
          namespace: 'default',
          targetType: 'service',
          name: 'echo',
          remotePort: 50051,
          localPort: 50051,
          context: '',
        },
      },
    });
    expect(patch.tlsConfig).toBeUndefined();
    expect(patch.k8sPortForward?.config.name).toBe('echo');
  });

  it('prepareGrpcTabPatchForConsumer redacts auth secrets for export consumer', () => {
    const patch = prepareGrpcTabPatchForConsumer({
      auth: { type: 'bearer', bearerToken: 'super-secret-token-value' },
    }, 'export');
    expect(patch.auth).toBeDefined();
    expect((patch.auth as { bearerToken?: string }).bearerToken).not.toBe('super-secret-token-value');
  });

  it('tabHasPendingUnaryCall detects in-flight lifecycle and ref entries', () => {
    const ref = { current: { t1: 'req-1' } };
    expect(tabHasPendingUnaryCall(makeTab('t1', { lifecycle: 'calling' }), 't1', ref)).toBe(true);
    expect(tabHasPendingUnaryCall(makeTab('t1'), 't1', { current: {} })).toBe(false);
  });

  it('createGrpcTabInterpolationEnvSnapshot captures optional timestamp', () => {
    const snapshot = createGrpcTabInterpolationEnvSnapshot(
      makeTab('t1'),
      { grpcHost: 'localhost:50051' },
      [],
      undefined,
      '2026-07-01T00:00:00.000Z',
    );
    expect(snapshot.capturedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('clearedDescriptorContextPatch and clearedSchemaDriftPatch reset descriptor context', () => {
    expect(clearedDescriptorContextPatch()).toMatchObject({
      descriptorKey: undefined,
      lifecycle: 'idle',
      streamLifecycle: 'idle',
    });
    expect(clearedSchemaDriftPatch()).toMatchObject({ driftState: 'none' });
  });

  it('buildDescriptorLoadFailureUpdates clears tab context when no descriptor is preserved', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    const { tabPatch, descriptorPatch } = buildDescriptorLoadFailureUpdates(session, tabId, 'load failed');
    expect(tabPatch).toMatchObject({ lifecycle: 'idle' });
    expect(descriptorPatch.descriptor).toBeUndefined();
  });

  it('invalidateTabDescriptorConnectionContext bumps descriptor generation only', () => {
    const ref = { current: {} as Record<string, number> };
    expect(invalidateTabDescriptorConnectionContext('t1', ref)).toEqual({});
    expect(ref.current['t1']).toBe(1);
  });

  it('bindTabInterpolationEnvForExecute returns env snapshot when canonical tokens are valid', () => {
    const tab = makeTab('t1', { target: 'localhost:50051' });
    const snapshot = bindTabInterpolationEnvForExecute(
      tab,
      {},
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );
    expect(snapshot.env).toBeDefined();
  });
});
