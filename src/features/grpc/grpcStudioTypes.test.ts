import { describe, expect, it } from 'vitest';
import {
  captureGrpcTabExecuteSnapshot,
  captureGrpcTabExecuteSnapshotFromResolution,
  clearedGrpcStreamSessionPatch,
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  createDefaultProtoIngestState,
  createTabDescriptorStateAfterConnectionInvalidation,
  createTabDescriptorStateAfterReplayConnectionChange,
  duplicateGrpcStudioTab,
  duplicateTabDescriptorState,
  isGrpcLifecycleInFlight,
  isGrpcLifecycleTerminal,
  nextDefaultGrpcTabTitle,
  nextGrpcTabId,
  normalizeProtoIngestState,
  resetGrpcTabCounterForTests,
  snapshotToStreamStartRequest,
  snapshotToUnaryCallRequest,
  toPersistedGrpcStudioTab,
} from './grpcStudioTypes';
import {
  FIXTURE_BIDI_STREAM_START_REQUEST,
  FIXTURE_CLIENT_STREAM_START_REQUEST,
  FIXTURE_DESCRIPTOR,
  FIXTURE_SERVER_STREAM_START_REQUEST,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../shared/grpc/contractFixtures';
import {
  validateGrpcStreamStartRequest,
  validatePhase1UnaryCallRequest,
} from '../../shared/grpc/requestValidation';
import { buildDefaultGrpcBody } from './utils/buildDefaultGrpcBody';
import { resolveGrpcTabConnection } from './utils/resolveGrpcTabConnection';
import { createDefaultDescriptorSourceSelection } from '../../shared/grpc/descriptorSourcePolicy';

describe('grpcStudioTypes (Phase 1A + 2A stream state)', () => {
  it('duplicateTabDescriptorState resets loading state instead of copying in-flight reflect', () => {
    const loading = {
      loadState: 'loading' as const,
      expandedServiceIds: ['svc.A'],
    };
    expect(duplicateTabDescriptorState(loading)).toEqual(createEmptyTabDescriptorState());
  });

  it('duplicateTabDescriptorState deep-copies lastKnownGoodDescriptor and fingerprint', () => {
    const fingerprint = {
      source: 'reflection' as const,
      sourceRef: 'localhost:50051',
      contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
    };
    const loaded = {
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      sourceFingerprint: fingerprint,
      expandedServiceIds: [],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.lastKnownGoodDescriptor).toEqual(FIXTURE_DESCRIPTOR);
    expect(copy.lastKnownGoodDescriptor).not.toBe(loaded.lastKnownGoodDescriptor);
    expect(copy.sourceFingerprint).toEqual(fingerprint);
    expect(copy.sourceFingerprint).not.toBe(fingerprint);
  });

  it('duplicateTabDescriptorState copies error state with preserved descriptor', () => {
    const loaded = {
      loadState: 'error' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      errorMessage: 'reflection failed',
      expandedServiceIds: ['echo.EchoService'],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.loadState).toBe('error');
    expect(copy.errorMessage).toBe('reflection failed');
    expect(copy.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(copy.sourceFingerprint?.contentSha256).toBe(FIXTURE_DESCRIPTOR.contentSha256);
  });

  it('duplicateTabDescriptorState derives fingerprint from descriptor when tab field is missing', () => {
    const { sourceFingerprint: _ignored, ...descriptorWithoutFingerprint } = FIXTURE_DESCRIPTOR;
    const loaded = {
      loadState: 'loaded' as const,
      descriptor: descriptorWithoutFingerprint,
      expandedServiceIds: [],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.sourceFingerprint?.contentSha256).toBe(FIXTURE_DESCRIPTOR.contentSha256);
  });

  it('duplicateTabDescriptorState normalizes partial source selection on copy', () => {
    const loaded = {
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      expandedServiceIds: [],
      sourceSelection: { mode: 'auto' as const },
      driftState: 'none' as const,
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.sourceSelection.autoPrecedence).toEqual([
      'reflection',
      'proto_files',
      'protoset',
      'bsr',
      'url_proto',
    ]);
    expect(copy.sourceSelection.autoPrecedence).not.toBe(loaded.sourceSelection.autoPrecedence);
  });

  it('duplicateTabDescriptorState deep-copies loaded descriptor', () => {
    const loaded = {
      loadState: 'loaded' as const,
      descriptor: { key: 'desc-1', source: 'reflection' as const, services: [] },
      expandedServiceIds: ['svc.A'],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.loadState).toBe('loaded');
    expect(copy.descriptor).toEqual(loaded.descriptor);
    expect(copy.descriptor).not.toBe(loaded.descriptor);
    expect(copy.sourceSelection.mode).toBe('auto');
  });

  it('createEmptyTabDescriptorState includes Phase 3A source defaults', () => {
    const state = createEmptyTabDescriptorState();
    expect(state.sourceSelection.mode).toBe('auto');
    expect(state.driftState).toBe('none');
  });

  it('normalizeProtoIngestState fills missing protoRoots from legacy persisted drafts', () => {
    const normalized = normalizeProtoIngestState({
      source: 'protoset',
      importPaths: ['shared'],
    } as ReturnType<typeof createDefaultProtoIngestState>);
    expect(normalized.protoRoots).toEqual([
      { id: 'root-default', mountPath: 'root', files: [] },
    ]);
    expect(normalized.importPaths).toEqual(['shared']);
  });

  it('createTabDescriptorStateAfterConnectionInvalidation preserves proto ingest draft', () => {
    const prior = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      protoIngest: {
        ...createDefaultProtoIngestState(),
        protoRoots: [{ id: 'root-default', mountPath: 'root', files: [{ path: 'echo.proto', content: 'syntax = "proto3";' }] }],
      },
    };
    const reset = createTabDescriptorStateAfterConnectionInvalidation(prior);
    expect(reset.loadState).toBe('idle');
    expect(reset.descriptor).toBeUndefined();
    expect(reset.protoIngest?.protoRoots[0]?.files[0]?.path).toBe('echo.proto');
    expect(reset.protoIngest).not.toBe(prior.protoIngest);
  });

  it('createTabDescriptorStateAfterReplayConnectionChange preserves descriptor when key matches', () => {
    const prior = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      sourceFingerprint: {
        source: 'reflection' as const,
        sourceRef: 'localhost:50051',
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
      },
      expandedServiceIds: ['echo.EchoService'],
    };
    const preserved = createTabDescriptorStateAfterReplayConnectionChange(
      prior,
      FIXTURE_DESCRIPTOR.key,
    );
    expect(preserved.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
    expect(preserved.loadState).toBe('loaded');
    expect(preserved.descriptor).not.toBe(prior.descriptor);
    expect(preserved.expandedServiceIds).toEqual(['echo.EchoService']);
  });

  it('createTabDescriptorStateAfterReplayConnectionChange clears descriptor when key differs', () => {
    const prior = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
    };
    const reset = createTabDescriptorStateAfterReplayConnectionChange(prior, 'other-key');
    expect(reset.descriptor).toBeUndefined();
    expect(reset.loadState).toBe('idle');
  });

  it('duplicateTabDescriptorState deep-copies proto ingest draft', () => {
    const loaded = {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      protoIngest: {
        ...createDefaultProtoIngestState(),
        importPaths: ['shared'],
      },
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.protoIngest?.importPaths).toEqual(['shared']);
    expect(copy.protoIngest).not.toBe(loaded.protoIngest);
  });

  it('captureGrpcTabExecuteSnapshot stores optional source fingerprint', () => {
    resetGrpcTabCounterForTests();
    const tab = createGrpcStudioTab({
      descriptorKey: 'reflection:localhost:50051:abc',
      service: 'echo.EchoService',
      method: 'Echo',
    });
    const fingerprint = {
      source: 'reflection' as const,
      sourceRef: 'localhost:50051',
      contentSha256: 'abc',
    };
    const snapshot = captureGrpcTabExecuteSnapshot(
      tab,
      'req-1',
      { address: 'localhost:50051', tlsMode: 'disabled' },
      'unary',
      { sourceFingerprint: fingerprint },
    );
    expect(snapshot.sourceFingerprint).toEqual(fingerprint);
    expect(snapshot.sourceFingerprint).not.toBe(fingerprint);
  });

  it('creates tabs with idle lifecycle and stream defaults', () => {
    resetGrpcTabCounterForTests();
    const tab = createGrpcStudioTab({ target: 'localhost:50051' });

    expect(tab.lifecycle).toBe('idle');
    expect(tab.timeoutMs).toBe(30_000);
    expect(tab.body).toEqual({});
    expect(tab.metadata).toEqual({});
    expect(tab.streamLifecycle).toBe('idle');
    expect(tab.streamMessages).toEqual([]);
    expect(tab.lastSequence).toBe(0);
    expect(tab.streamPendingBodies).toEqual([]);
  });

  it('duplicates tab state by value with a new id', () => {
    resetGrpcTabCounterForTests();
    const source = createGrpcStudioTab({
      target: 'localhost:9090',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      metadata: { trace: '1' },
      lifecycle: 'success',
      activeRequestId: 'req-old',
    });

    const copy = duplicateGrpcStudioTab(source, [source]);

    expect(copy.id).not.toBe(source.id);
    expect(copy.target).toBe(source.target);
    expect(copy.body).toEqual({ message: 'hi' });
    expect(copy.body).not.toBe(source.body);
    expect(copy.metadata).toEqual({ trace: '1' });
    expect(copy.lifecycle).toBe('idle');
    expect(copy.activeRequestId).toBeUndefined();
  });

  it('duplicate tab copies maskedSecretFields for write-only secret UX (Phase 4G)', () => {
    const source = createGrpcStudioTab({
      tlsConfig: { serverCaPem: 'stored-pem' },
      maskedSecretFields: { tls: { serverCaPem: true } },
      auth: { type: 'bearer', bearerToken: 'tok' },
    });
    source.maskedSecretFields = {
      ...source.maskedSecretFields,
      auth: { bearerToken: true },
    };

    const copy = duplicateGrpcStudioTab(source, [source]);

    expect(copy.maskedSecretFields).toEqual({
      tls: { serverCaPem: true },
      auth: { bearerToken: true },
    });
    expect(copy.maskedSecretFields).not.toBe(source.maskedSecretFields);
  });

  it('clearedGrpcStreamSessionPatch resets all stream fields to idle defaults', () => {
    expect(clearedGrpcStreamSessionPatch()).toEqual({
      streamLifecycle: 'idle',
      activeStreamId: undefined,
      streamRequestId: undefined,
      streamMessages: [],
      streamStartedAt: undefined,
      streamEndedAt: undefined,
      streamError: undefined,
      lastSequence: 0,
      streamPendingBodies: [],
    });
  });

  it('duplicate tab resets all stream session state', () => {
    const source = createGrpcStudioTab({
      streamLifecycle: 'streaming',
      activeStreamId: 'stream-1',
      streamRequestId: 'req-stream',
      streamStartedAt: '2026-06-29T00:00:00.000Z',
      streamEndedAt: '2026-06-29T00:00:01.000Z',
      streamError: { code: 'GRPC_CALL_FAILED', category: 'call_failed', message: 'boom' },
      streamMessages: [{
        sequence: 1,
        timestamp: '2026-06-29T00:00:00.000Z',
        direction: 'inbound',
        data: { message: 'hi' },
      }],
      lastSequence: 3,
      streamPendingBodies: [{ message: 'queued' }],
    });

    const copy = duplicateGrpcStudioTab(source, [source]);
    expect(copy.streamLifecycle).toBe('idle');
    expect(copy.activeStreamId).toBeUndefined();
    expect(copy.streamRequestId).toBeUndefined();
    expect(copy.streamStartedAt).toBeUndefined();
    expect(copy.streamEndedAt).toBeUndefined();
    expect(copy.streamError).toBeUndefined();
    expect(copy.streamMessages).toEqual([{
      sequence: 1,
      timestamp: '2026-06-29T00:00:00.000Z',
      direction: 'inbound',
      data: { message: 'hi' },
    }]);
    expect(copy.lastSequence).toBe(0);
    expect(copy.streamPendingBodies).toEqual([]);
  });

  it('captures immutable execute snapshot from active tab', () => {
    const tab = createGrpcStudioTab({
      id: 'tab-1',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'snap' },
      metadata: { 'X-Trace': 'abc' },
    });

    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-99', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    expect(snapshot.tabId).toBe('tab-1');
    expect(snapshot.requestId).toBe('req-99');
    expect(snapshot.callType).toBe('unary');
    expect(snapshot.body).toEqual({ message: 'snap' });
    expect(snapshot.target.address).toBe('localhost:50051');
    expect(snapshot.metadata).toEqual({ 'x-trace': 'abc' });
  });

  it('captureGrpcTabExecuteSnapshot freezes transportMode and schema version (Phase 10A)', () => {
    const tab = createGrpcStudioTab({
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      transportMode: 'spring-servlet',
    });

    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-transport', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    expect(snapshot.transportMode).toBe('spring-servlet');
    expect(snapshot.transportSchemaVersion).toBe(1);
  });

  it('rejects execute snapshot when descriptor or method missing', () => {
    const tab = createGrpcStudioTab({ target: 'localhost:50051' });
    const target = { address: 'localhost:50051', tlsMode: 'disabled' as const };

    expect(() => captureGrpcTabExecuteSnapshot(tab, 'req-1', target, 'unary')).toThrow(/descriptorKey/);

    tab.descriptorKey = 'desc-1';
    expect(() => captureGrpcTabExecuteSnapshot(tab, 'req-1', target, 'unary')).toThrow(/service and method/);
  });

  it('tracks in-flight lifecycle states', () => {
    expect(isGrpcLifecycleInFlight('idle')).toBe(false);
    expect(isGrpcLifecycleInFlight('connecting')).toBe(true);
    expect(isGrpcLifecycleInFlight('calling')).toBe(true);
    expect(isGrpcLifecycleInFlight('success')).toBe(false);
    expect(isGrpcLifecycleTerminal('success')).toBe(true);
    expect(isGrpcLifecycleTerminal('error')).toBe(true);
    expect(isGrpcLifecycleTerminal('cancelled')).toBe(true);
    expect(isGrpcLifecycleTerminal('idle')).toBe(false);
  });

  it('captures snapshot from tab connection resolution', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      target: 'localhost:50051',
    });
    const resolution = resolveGrpcTabConnection(
      tab,
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );

    const snapshot = captureGrpcTabExecuteSnapshotFromResolution(tab, 'req-res', resolution);
    expect(snapshot.target.address).toBe('localhost:50051');
    expect(snapshot.requestId).toBe('req-res');
    expect(snapshot.callType).toBe('unary');
  });

  it('captureGrpcTabExecuteSnapshotFromResolution includes normalized tlsConfig (Phase 4B)', () => {
    const cert = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;
    // 50443 is the TLS-capable loopback fixture — 50051 is plaintext-only and
    // prepareGrpcTarget coerces sticky TLS to disabled for that port.
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      target: 'localhost:50443',
      tlsMode: 'tls',
      tlsConfig: {
        serverCaPem: `  ${cert}  `,
        serverNameOverride: ' grpc.local ',
      },
    });
    const resolution = resolveGrpcTabConnection(
      tab,
      [],
      { target: 'localhost:50443', tlsMode: 'disabled' },
    );

    const snapshot = captureGrpcTabExecuteSnapshotFromResolution(tab, 'req-tls', resolution);
    expect(snapshot.target.tlsMode).toBe('tls');
    expect(snapshot.target.tlsConfig?.serverCaPem).toBe(cert);
    expect(snapshot.target.tlsConfig?.serverNameOverride).toBe('grpc.local');
  });

  it('rejects snapshot capture from unresolved env target resolution', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      target: '{{grpcHost}}',
    });
    const resolution = resolveGrpcTabConnection(
      tab,
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );

    expect(() => captureGrpcTabExecuteSnapshotFromResolution(tab, 'req-x', resolution)).toThrow(
      /grpcHost.*not configured/i,
    );
  });

  it('duplicate tab does not copy transient execution state', () => {
    const source = createGrpcStudioTab({
      lifecycle: 'success',
      activeRequestId: 'req-old',
      lastResult: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        durationMs: 1,
      },
    });

    const copy = duplicateGrpcStudioTab(source, [source]);
    expect(copy.lastResult).toBeUndefined();
    expect(copy.lastError).toBeUndefined();
    expect(copy.lastExecuteSnapshot).toBeUndefined();
  });

  it('execute snapshot stays immutable when tab state changes afterward', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'snap' },
      metadata: { 'X-Trace': 'abc' },
    });

    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-99', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    tab.body = { message: 'mutated' };
    tab.metadata = { 'x-other': 'new' };

    expect(snapshot.body).toEqual({ message: 'snap' });
    expect(snapshot.metadata).toEqual({ 'x-trace': 'abc' });
  });

  it('omits empty metadata from unary call request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    });

    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-1', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    expect(snapshotToUnaryCallRequest(snapshot).metadata).toBeUndefined();
  });

  it('converts execute snapshot to unary call request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'snap' },
      auth: { type: 'bearer', bearerToken: 'token-1' },
      metadata: { 'X-Trace': 'abc' },
    });

    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-99', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    const request = snapshotToUnaryCallRequest(snapshot);
    expect(request.callType).toBe('unary');
    expect(request.requestId).toBe('req-99');
    expect(request.auth?.bearerToken).toBe('token-1');
    expect(request.metadata).toEqual({
      'x-trace': 'abc',
      authorization: 'Bearer token-1',
    });
    expect(request).toMatchObject({
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
    });
  });

  it('merges compression headers into unary call request metadata (Phase 4J-D)', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      compression: { enabled: true, algorithm: 'gzip' },
    });

    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-compress', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    expect(snapshot.compression).toEqual({ enabled: true, algorithm: 'gzip' });
    expect(snapshotToUnaryCallRequest(snapshot).metadata).toEqual({
      'grpc-encoding': 'gzip',
      'grpc-accept-encoding': 'gzip,identity',
    });
  });

  it('throws on execute when auth conflicts with manual authorization metadata', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      auth: { type: 'bearer', bearerToken: 'panel-token' },
      metadata: { authorization: 'Bearer manual-token' },
    });
    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-auth', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');
    expect(() => snapshotToUnaryCallRequest(snapshot)).toThrow(/auth metadata conflicts/i);
  });

  it('throws on execute when auth conflicts with manual metadata', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      auth: { type: 'bearer', bearerToken: 'panel-token' },
      metadata: { authorization: 'Bearer manual-token' },
    });
    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-auth-strict', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');
    expect(() => snapshotToUnaryCallRequest(snapshot)).toThrow(/auth metadata conflicts/i);
  });

  it('converts oauth2 execute snapshot without client-side metadata merge (Phase 4D)', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
          scope: 'grpc.read',
        },
      },
      metadata: { 'x-trace': 'abc' },
    });
    const snapshot = captureGrpcTabExecuteSnapshot(tab, 'req-oauth', {
      address: 'localhost:50051',
      tlsMode: 'disabled',
    }, 'unary');

    const unary = snapshotToUnaryCallRequest(snapshot);
    expect(unary.metadata).toEqual({ 'x-trace': 'abc' });
    expect(unary.auth).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        scope: 'grpc.read',
      },
    });
    expect(unary.metadata?.authorization).toBeUndefined();

    const streamTab = createGrpcStudioTab({
      descriptorKey: FIXTURE_SERVER_STREAM_START_REQUEST.descriptorKey,
      service: FIXTURE_SERVER_STREAM_START_REQUEST.service,
      method: FIXTURE_SERVER_STREAM_START_REQUEST.method,
      auth: tab.auth,
      metadata: tab.metadata,
    });
    const streamSnapshot = captureGrpcTabExecuteSnapshot(
      streamTab,
      'req-oauth-stream',
      { address: 'localhost:50051', tlsMode: 'disabled' },
      'server_streaming',
    );
    const stream = snapshotToStreamStartRequest(streamSnapshot);
    expect(stream.metadata).toEqual({ 'x-trace': 'abc' });
    expect(stream.auth?.type).toBe('oauth2');
  });

  it('converts streaming snapshot to stream start request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_SERVER_STREAM_START_REQUEST.descriptorKey,
      service: FIXTURE_SERVER_STREAM_START_REQUEST.service,
      method: FIXTURE_SERVER_STREAM_START_REQUEST.method,
      body: FIXTURE_SERVER_STREAM_START_REQUEST.body,
      timeoutMs: FIXTURE_SERVER_STREAM_START_REQUEST.timeoutMs,
    });

    const snapshot = captureGrpcTabExecuteSnapshot(
      tab,
      FIXTURE_SERVER_STREAM_START_REQUEST.requestId,
      FIXTURE_SERVER_STREAM_START_REQUEST.target,
      'server_streaming',
    );

    const request = snapshotToStreamStartRequest(snapshot);
    expect(request).toEqual(FIXTURE_SERVER_STREAM_START_REQUEST);
    expect(validateGrpcStreamStartRequest(request)).toEqual([]);
  });

  it('converts client and bidi streaming snapshots to stream start requests', () => {
    for (const fixture of [
      FIXTURE_CLIENT_STREAM_START_REQUEST,
      FIXTURE_BIDI_STREAM_START_REQUEST,
    ]) {
      const tab = createGrpcStudioTab({
        descriptorKey: fixture.descriptorKey,
        service: fixture.service,
        method: fixture.method,
        body: fixture.body,
        timeoutMs: fixture.timeoutMs,
      });
      const snapshot = captureGrpcTabExecuteSnapshot(
        tab,
        fixture.requestId,
        fixture.target,
        fixture.callType,
      );
      expect(snapshotToStreamStartRequest(snapshot)).toEqual(fixture);
    }
  });

  it('buildDefaultGrpcBody produces StreamRequest defaults for ServerStream schema', () => {
    const serverStream = FIXTURE_DESCRIPTOR.services[0]!.methods.find(
      (entry) => entry.name === 'ServerStream',
    )!;
    expect(buildDefaultGrpcBody(serverStream.requestSchema)).toEqual({
      message: '',
      repeat_count: 0,
      interval_ms: 0,
    });
  });

  it('rejects unary conversion from streaming execute snapshot', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_SERVER_STREAM_START_REQUEST.descriptorKey,
      service: FIXTURE_SERVER_STREAM_START_REQUEST.service,
      method: FIXTURE_SERVER_STREAM_START_REQUEST.method,
    });
    const snapshot = captureGrpcTabExecuteSnapshot(
      tab,
      FIXTURE_SERVER_STREAM_START_REQUEST.requestId,
      FIXTURE_SERVER_STREAM_START_REQUEST.target,
      'server_streaming',
    );
    expect(() => snapshotToUnaryCallRequest(snapshot)).toThrow(/unary snapshot/);
  });

  it('round-trips tab snapshot into FIXTURE-equivalent unary call request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_UNARY_CALL_REQUEST.descriptorKey,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: FIXTURE_UNARY_CALL_REQUEST.body,
      metadata: { 'X-Request-Id': 'demo-1' },
      timeoutMs: FIXTURE_UNARY_CALL_REQUEST.timeoutMs,
    });

    const snapshot = captureGrpcTabExecuteSnapshot(
      tab,
      FIXTURE_UNARY_CALL_REQUEST.requestId,
      FIXTURE_UNARY_CALL_REQUEST.target,
      'unary',
    );
    const request = snapshotToUnaryCallRequest(snapshot);

    expect(request).toEqual(FIXTURE_UNARY_CALL_REQUEST);
    expect(validatePhase1UnaryCallRequest(request)).toEqual([]);
  });

  it('normalizes whitespace in resolved target when capturing snapshot', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      target: '  localhost:50051  ',
    });
    const resolution = resolveGrpcTabConnection(
      tab,
      [],
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );

    const snapshot = captureGrpcTabExecuteSnapshotFromResolution(tab, 'req-ws', resolution);
    expect(snapshot.target.address).toBe('localhost:50051');
  });

  it('rejects snapshot capture with invalid manual target', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    });

    expect(() =>
      captureGrpcTabExecuteSnapshot(tab, 'req-bad', {
        address: '{{grpcHost}}',
        tlsMode: 'disabled',
      }, 'unary'),
    ).toThrow(/grpcHost.*not configured/i);
  });

  it('persists lightweight tab identity', () => {
    const tab = createGrpcStudioTab({
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
    });

    expect(toPersistedGrpcStudioTab(tab)).toEqual({
      id: tab.id,
      title: tab.title,
      target: 'localhost:50051',
      connectionId: undefined,
      service: 'echo.EchoService',
      method: 'Echo',
    });
  });
});

describe('grpc studio tab naming', () => {
  it('assigns Tab 1 then Tab 2 from existing tabs', () => {
    const tab1 = createGrpcStudioTab({}, []);
    const tab2 = createGrpcStudioTab({}, [tab1]);
    expect(tab1.title).toBe('Tab 1');
    expect(tab2.title).toBe('Tab 2');
    expect(nextGrpcTabId([tab1])).toBe('grpc-tab-2');
  });

  it('fills lowest gap after a tab is closed', () => {
    const tab1 = createGrpcStudioTab({ id: 'grpc-tab-1', title: 'Tab 1' });
    const tab3 = createGrpcStudioTab({ id: 'grpc-tab-3', title: 'Tab 3' }, [tab1]);
    expect(nextDefaultGrpcTabTitle([tab1, tab3])).toBe('Tab 2');
    expect(nextGrpcTabId([tab1, tab3])).toBe('grpc-tab-2');
  });

  it('does not skip numbers after discarded strict-mode init', () => {
    createGrpcStudioTab({}, []);
    const tab1 = createGrpcStudioTab({}, []);
    expect(tab1.title).toBe('Tab 1');
    expect(createGrpcStudioTab({}, [tab1]).title).toBe('Tab 2');
  });
});
