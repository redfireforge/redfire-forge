import { describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { buildDescriptorSourceFingerprint } from '../../../shared/grpc/descriptorSourcePolicy';
import type { GrpcStudioTabState } from '../grpcStudioTypes';
import {
  buildDescriptorLoadFailureUpdates,
  buildDescriptorLoadSuccessUpdates,
  invalidateTabDescriptorConnectionContext,
  clearedDescriptorContextPatch,
  createInitialSessionState,
  patchTouchesConnection,
  pickFallbackActiveTabId,
  prepareGrpcTabPatchForConsumer,
  assertTabAuthExecuteReady,
  assertTabMetadataValid,
  assertTabTlsConfigValid,
  resolveExpandedServiceIdsAfterReflect,
  sanitizeDescriptorPatch,
  sanitizeTabPatch,
  tabConnectionResolutionFingerprint,
  tabHasPendingUnaryCall,
  withTargetConnectionSessionReset,
} from './grpcStudioSessionHelpers';

vi.mock('../../../shared/grpc/grpcTransportFacade', () => ({
  cancelGrpcUnary: vi.fn(() => Promise.resolve()),
}));

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

describe('grpcStudioSessionHelpers', () => {
  it('createInitialSessionState seeds one tab and descriptor', () => {
    const session = createInitialSessionState();
    expect(session.tabs).toHaveLength(1);
    expect(session.activeTabId).toBe(session.tabs[0]!.id);
    expect(session.tabDescriptors[session.activeTabId]?.sourceSelection.mode).toBe('auto');
    expect(session.tabDescriptors[session.activeTabId]?.driftState).toBe('none');
  });

  it('sanitizeDescriptorPatch deep-clones descriptor phase 3 fields', () => {
    const fingerprint = buildDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: 'abc',
    });
    const selection = { mode: 'auto' as const, autoPrecedence: ['reflection' as const] };
    const protoIngest = {
      source: 'proto_files' as const,
      protoFiles: [{ path: 'echo.proto', content: 'syntax = "proto3";' }],
      importPaths: ['shared'],
    };
    const patch = sanitizeDescriptorPatch({
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      sourceFingerprint: fingerprint,
      sourceSelection: selection,
      protoIngest,
    });
    expect(patch.descriptor).not.toBe(FIXTURE_DESCRIPTOR);
    expect(patch.lastKnownGoodDescriptor).not.toBe(FIXTURE_DESCRIPTOR);
    expect(patch.lastKnownGoodDescriptor).not.toBe(patch.descriptor);
    expect(patch.sourceFingerprint).not.toBe(fingerprint);
    expect(patch.sourceSelection?.autoPrecedence).not.toBe(selection.autoPrecedence);
    expect(patch.protoIngest).not.toBe(protoIngest);
    expect(patch.protoIngest?.protoFiles).not.toBe(protoIngest.protoFiles);
  });

  it('pickFallbackActiveTabId prefers left neighbor', () => {
    const tabs = [makeTab('a'), makeTab('b'), makeTab('c')];
    expect(pickFallbackActiveTabId(tabs, 'b')).toBe('a');
    expect(pickFallbackActiveTabId(tabs, 'a')).toBe('b');
  });

  it('patchTouchesConnection detects connection fields but not PEM-only tlsConfig edits', () => {
    expect(patchTouchesConnection({ title: 'x' })).toBe(false);
    expect(patchTouchesConnection({ target: 'localhost:50052' })).toBe(true);
    expect(patchTouchesConnection({ tlsMode: 'tls' })).toBe(true);
    expect(patchTouchesConnection({ tlsConfig: { serverCaPem: 'pem' } })).toBe(false);
  });

  it('withTargetConnectionSessionReset clears dot on tlsConfig edits without full invalidation', () => {
    const reset = withTargetConnectionSessionReset({
      tlsConfig: { serverCaPem: 'pem' },
    });
    expect(reset.targetConnection).toEqual({ state: 'idle' });

    const preserved = withTargetConnectionSessionReset({
      targetConnection: { state: 'connecting' },
    });
    expect(preserved.targetConnection).toEqual({ state: 'connecting' });
  });

  it('tabConnectionResolutionFingerprint is stable when only tlsConfig PEM changes (Phase 4B)', () => {
    const tab = makeTab('t1', { tlsMode: 'tls' });
    const env = {};
    const profiles: never[] = [];
    const defaults = { target: 'localhost:50051', tlsMode: 'disabled' as const };
    const before = tabConnectionResolutionFingerprint(tab, env, profiles, defaults);
    const after = tabConnectionResolutionFingerprint(
      { ...tab, tlsConfig: { serverCaPem: '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----' } },
      env,
      profiles,
      defaults,
    );
    expect(after).toBe(before);
  });

  it('sanitizeTabPatch clones nested objects and strips id', () => {
    const body = { message: 'hello' };
    const patch = sanitizeTabPatch({ id: 'ignored', body });
    expect(patch.body).not.toBe(body);
    expect(patch.body).toEqual(body);
    expect(patch).not.toHaveProperty('id');
  });

  it('prepareGrpcTabPatchForConsumer redacts secrets for history export', () => {
    const patch = prepareGrpcTabPatchForConsumer({
      auth: { type: 'bearer', bearerToken: 'persist-me-not' },
      lastResult: {
        status: 0,
        statusMessage: 'OK',
        durationMs: 1,
        headers: { authorization: 'Bearer persist-me-not-token' },
        body: {},
      },
    }, 'call_history');
    expect(patch.auth?.bearerToken).toBe('[REDACTED]');
    expect(patch.lastResult?.headers?.authorization).toBe('[REDACTED]');
  });

  it('buildDescriptorLoadFailureUpdates sanitizes error messages', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    const { descriptorPatch } = buildDescriptorLoadFailureUpdates(
      session,
      tabId,
      'Bearer super-secret-token-value failed',
    );
    expect(descriptorPatch.errorMessage).not.toContain('super-secret-token-value');
    expect(descriptorPatch.errorMessage).toContain('[REDACTED]');
  });

  it('clearedDescriptorContextPatch resets execute and stream state', () => {
    const patch = clearedDescriptorContextPatch();
    expect(patch.lifecycle).toBe('idle');
    expect(patch.streamLifecycle).toBe('idle');
    expect(patch.activeRequestId).toBeUndefined();
  });

  it('invalidateTabDescriptorConnectionContext bumps generation without clearing results (Phase 9C)', () => {
    const descriptorLoadGenerationRef = { current: { tab1: 2 } };
    const patch = invalidateTabDescriptorConnectionContext('tab1', descriptorLoadGenerationRef);
    expect(patch).toEqual({});
    expect(descriptorLoadGenerationRef.current.tab1).toBe(3);
  });

  it('resolveExpandedServiceIdsAfterReflect preserves expansion on same key', () => {
    const expanded = resolveExpandedServiceIdsAfterReflect(
      FIXTURE_DESCRIPTOR.key,
      FIXTURE_DESCRIPTOR,
      [FIXTURE_DESCRIPTOR.services[0]!.fullName, 'unknown.service'],
    );
    expect(expanded).toEqual([FIXTURE_DESCRIPTOR.services[0]!.fullName]);
  });

  it('resolveExpandedServiceIdsAfterReflect expands all on key change', () => {
    const expanded = resolveExpandedServiceIdsAfterReflect(
      'old-key',
      FIXTURE_DESCRIPTOR,
      ['old.service'],
    );
    expect(expanded).toEqual(FIXTURE_DESCRIPTOR.services.map((s) => s.fullName));
  });

  it('tabConnectionResolutionFingerprint is stable for valid target', () => {
    const tab = makeTab('t1');
    const env = {};
    const profiles = [];
    const defaults = { defaultTarget: 'localhost:50051', defaultTlsMode: 'plaintext' as const };
    const fp1 = tabConnectionResolutionFingerprint(tab, env, profiles, defaults);
    const fp2 = tabConnectionResolutionFingerprint(tab, env, profiles, defaults);
    expect(fp1).toBe(fp2);
    expect(fp1.startsWith('valid:')).toBe(true);
  });

  it('tabHasPendingUnaryCall checks lifecycle and in-flight ref', () => {
    const ref = { current: {} as Record<string, string> };
    const tab = makeTab('t1', { lifecycle: 'idle' });
    expect(tabHasPendingUnaryCall(tab, 't1', ref)).toBe(false);
    ref.current['t1'] = 'req-1';
    expect(tabHasPendingUnaryCall(tab, 't1', ref)).toBe(true);
  });

  it('buildDescriptorLoadSuccessUpdates preserves draft on blocking drift', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = makeTab(tabId, {
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };

    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'descriptor-without-echo',
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.filter((entry) => entry.name !== 'Echo'),
      }],
    };

    const { descriptorPatch, tabPatch } = buildDescriptorLoadSuccessUpdates(
      tabId,
      session,
      nextDescriptor,
    );

    expect(descriptorPatch.driftState).toBe('blocking');
    expect(descriptorPatch.suggestedRebinds?.length).toBeGreaterThan(0);
    expect(descriptorPatch.driftStaleMethod?.name).toBe('Echo');
    expect(tabPatch.body).toBeUndefined();
    expect(tabPatch.service).toBeUndefined();
    expect(tabPatch.method).toBeUndefined();
    expect(tabPatch.lifecycle).toBe('idle');
  });

  it('buildDescriptorLoadSuccessUpdates sets warning drift without clearing body', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = makeTab(tabId, {
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
    };

    const nextDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'descriptor-empty-echo-request',
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: FIXTURE_DESCRIPTOR.services[0]!.methods.map((entry) => (
          entry.name === 'Echo'
            ? {
              ...entry,
              requestSchema: {
                ...entry.requestSchema,
                fields: [],
              },
            }
            : entry
        )),
      }],
    };

    const { descriptorPatch, tabPatch } = buildDescriptorLoadSuccessUpdates(
      tabId,
      session,
      nextDescriptor,
    );

    expect(descriptorPatch.driftState).toBe('warning');
    expect(descriptorPatch.driftIssues?.some((issue) => issue.kind === 'field_removed')).toBe(true);
    expect(descriptorPatch.driftBaselineRequestSchema?.fields.length).toBeGreaterThan(0);
    expect(descriptorPatch.driftStaleMethod).toBeUndefined();
    expect(tabPatch.body).toBeUndefined();
  });

  it('buildDescriptorLoadFailureUpdates clears drift when no descriptor is preserved', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      driftState: 'blocking',
      driftMessage: 'Method missing',
      driftStaleMethod: FIXTURE_DESCRIPTOR.services[0]!.methods[0],
    };

    const { descriptorPatch, tabPatch } = buildDescriptorLoadFailureUpdates(
      session,
      tabId,
      'Reflection failed',
    );

    expect(descriptorPatch.driftState).toBe('none');
    expect(descriptorPatch.driftStaleMethod).toBeUndefined();
    expect(tabPatch?.service).toBeUndefined();
  });

  it('buildDescriptorLoadSuccessUpdates clears stale drift when refresh resolves drift', () => {
    const session = createInitialSessionState();
    const tabId = session.activeTabId;
    session.tabs[0] = makeTab(tabId, {
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      descriptorKey: FIXTURE_DESCRIPTOR.key,
    });
    session.tabDescriptors[tabId] = {
      ...session.tabDescriptors[tabId]!,
      descriptor: FIXTURE_DESCRIPTOR,
      lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
      loadState: 'loaded',
      driftState: 'blocking',
      driftStaleMethod: FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo'),
    };

    const { descriptorPatch } = buildDescriptorLoadSuccessUpdates(
      tabId,
      session,
      FIXTURE_DESCRIPTOR,
    );

    expect(descriptorPatch.driftState).toBe('none');
    expect(descriptorPatch.driftStaleMethod).toBeUndefined();
    expect(descriptorPatch.driftBaselineRequestSchema).toBeUndefined();
  });

  it('assertTabTlsConfigValid rejects mtls without client cert/key (Phase 4B)', () => {
    const resolution = {
      target: 'localhost:50051',
      tlsMode: 'mtls' as const,
      targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' as const },
    };
    expect(() => assertTabTlsConfigValid(resolution, {})).toThrow(/clientCertPem/i);
  });

  it('assertTabAuthExecuteReady allows oauth2 when shape is valid (Phase 4D)', () => {
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
      auth: {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'id',
          clientSecret: 'secret',
        },
      },
    })).not.toThrow();
  });

  it('assertTabMetadataValid rejects invalid metadata keys', () => {
    expect(() => assertTabMetadataValid({
      id: 't1',
      title: 't1',
      target: 'localhost:50051',
      body: {},
      metadata: { 'bad key': 'x' },
      timeoutMs: 30000,
      requestMode: 'form',
      lifecycle: 'idle',
      streamLifecycle: 'idle',
      streamMessages: [],
      lastSequence: 0,
      streamPendingBodies: [],
    })).toThrow(/Invalid|metadata|key/i);
  });
});
