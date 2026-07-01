import { describe, expect, it } from 'vitest';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  createGrpcSavedRequestFromSnapshot,
  defaultGrpcSavedRequestName,
  isGrpcRedactedPersistValue,
  mergeAuthForReplay,
  mergeTlsConfigForReplay,
  redactGrpcSavedRequestForPersist,
  redactGrpcSavedRequestMetadataForPersist,
  resolveSavedRequestTargetForPersist,
} from './grpcSavedRequest';

describe('grpcSavedRequest coverage gaps', () => {
  it('isGrpcRedactedPersistValue recognizes all redacted markers', () => {
    expect(isGrpcRedactedPersistValue(GRPC_REDACTED_PLACEHOLDER)).toBe(true);
    expect(isGrpcRedactedPersistValue('[REDACTED_PEM]')).toBe(true);
    expect(isGrpcRedactedPersistValue('[REDACTED]')).toBe(true);
    expect(isGrpcRedactedPersistValue('live-token')).toBe(false);
    expect(isGrpcRedactedPersistValue(undefined)).toBe(false);
  });

  it('redactGrpcSavedRequestMetadataForPersist handles undefined metadata', () => {
    expect(redactGrpcSavedRequestMetadataForPersist(undefined)).toEqual({});
  });

  it('mergeAuthForReplay returns tab auth when saved auth is none', () => {
    expect(mergeAuthForReplay(undefined, { type: 'bearer', bearerToken: 'tab' })).toEqual({
      type: 'bearer',
      bearerToken: 'tab',
    });
    expect(mergeAuthForReplay({ type: 'none' }, { type: 'none' })).toEqual({ type: 'none' });
  });

  it('mergeAuthForReplay merges basic, api_key, and oauth2 secrets from tab', () => {
    expect(mergeAuthForReplay(
      { type: 'basic', basicUsername: 'saved', basicPassword: GRPC_REDACTED_PLACEHOLDER },
      { type: 'basic', basicUsername: 'tab', basicPassword: 'tab-pass' },
    )).toEqual({ type: 'basic', basicUsername: 'saved', basicPassword: 'tab-pass' });

    expect(mergeAuthForReplay(
      { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: GRPC_REDACTED_PLACEHOLDER },
      { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'tab-key' },
    )).toEqual({ type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'tab-key' });

    expect(mergeAuthForReplay(
      {
        type: 'oauth2',
        oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: GRPC_REDACTED_PLACEHOLDER },
      },
      {
        type: 'oauth2',
        oauth2: { tokenUrl: 'u2', clientId: 'id2', clientSecret: 'tab-secret', scope: 'read' },
      },
    )).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'u',
        clientId: 'id',
        clientSecret: 'tab-secret',
        scope: 'read',
      },
    });
  });

  it('mergeAuthForReplay keeps saved oauth2 when oauth2 block missing on saved side', () => {
    expect(mergeAuthForReplay(
      { type: 'oauth2', oauth2: undefined },
      { type: 'oauth2', oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'tab' } },
    )).toEqual({ type: 'oauth2', oauth2: undefined });
  });

  it('mergeTlsConfigForReplay uses saved literal PEM when tab has none', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nSAVED\n-----END CERTIFICATE-----';
    expect(mergeTlsConfigForReplay({ serverCaPem: pem }, undefined)).toEqual({
      serverCaPem: pem,
      clientCertPem: undefined,
      clientKeyPem: undefined,
      serverNameOverride: undefined,
    });
  });

  it('mergeAuthForReplay uses tab auth when saved bearer token is empty and types differ', () => {
    expect(mergeAuthForReplay(
      { type: 'bearer', bearerToken: '' },
      { type: 'basic', basicUsername: 'u', basicPassword: 'pw' },
    )).toEqual({ type: 'basic', basicUsername: 'u', basicPassword: 'pw' });
  });

  it('mergeAuthForReplay covers vault-secret detection for each auth type mismatch', () => {
    expect(mergeAuthForReplay(
      { type: 'basic', basicUsername: 'u', basicPassword: GRPC_REDACTED_PLACEHOLDER },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');

    expect(mergeAuthForReplay(
      { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: GRPC_REDACTED_PLACEHOLDER },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');

    expect(mergeAuthForReplay(
      { type: 'oauth2', oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: GRPC_REDACTED_PLACEHOLDER } },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');

    expect(mergeAuthForReplay(
      { type: 'oauth2', oauth2: undefined },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');
  });

  it('mergeAuthForReplay returns undefined when both saved and tab auth are absent', () => {
    expect(mergeAuthForReplay(undefined, undefined)).toBeUndefined();
  });

  it('redactGrpcSavedRequestMetadataForPersist redacts secret metadata keys without auth', () => {
    const metadata = redactGrpcSavedRequestMetadataForPersist({
      'x-api-key': 'secret-value',
      'x-trace': '1',
    });
    expect(metadata['x-api-key']).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(metadata['x-trace']).toBe('1');
  });

  it('redactGrpcSavedRequestMetadataForPersist redacts auth header keys when auth builds headers', () => {
    const metadata = redactGrpcSavedRequestMetadataForPersist(
      { authorization: 'Bearer live', 'x-trace': '1' },
      { type: 'bearer', bearerToken: 'live' },
    );
    expect(metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(metadata['x-trace']).toBe('1');
  });

  it('mergeAuthForReplay keeps saved bearer token when not redacted', () => {
    expect(mergeAuthForReplay(
      { type: 'bearer', bearerToken: 'saved' },
      { type: 'bearer', bearerToken: 'tab' },
    )).toEqual({ type: 'bearer', bearerToken: 'saved' });
  });

  it('mergeAuthForReplay returns saved auth when tab type differs but vault not needed', () => {
    expect(mergeAuthForReplay(
      { type: 'bearer', bearerToken: 'saved-token' },
      { type: 'basic', basicUsername: 'u', basicPassword: 'pw' },
    )).toEqual({ type: 'bearer', bearerToken: 'saved-token' });
  });

  it('mergeTlsConfigForReplay prefers tab serverNameOverride over saved', () => {
    expect(mergeTlsConfigForReplay(
      { serverNameOverride: 'saved.local' },
      { serverNameOverride: 'tab.local', serverCaPem: 'tab-ca' },
    )).toEqual({
      serverCaPem: 'tab-ca',
      clientCertPem: undefined,
      clientKeyPem: undefined,
      serverNameOverride: 'tab.local',
    });
  });

  it('mergeTlsConfigForReplay returns undefined when no PEM or override remain', () => {
    expect(mergeTlsConfigForReplay(undefined, undefined)).toBeUndefined();
    expect(mergeTlsConfigForReplay(
      { serverCaPem: GRPC_REDACTED_PLACEHOLDER },
      undefined,
    )).toBeUndefined();
  });

  it('createGrpcSavedRequestFromSnapshot redacts secrets at persist boundary', () => {
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-key',
        body: { message: 'hi' },
        metadata: { authorization: 'Bearer live' },
        timeoutMs: 5000,
        auth: { type: 'bearer', bearerToken: 'live-token' },
      },
      { id: 'req-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      { connectionId: 'conn-1' },
    );
    expect(saved.connectionId).toBe('conn-1');
    expect(saved.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(saved.metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('redactGrpcSavedRequestForPersist clones body and redacts nested auth/tls', () => {
    const redacted = redactGrpcSavedRequestForPersist({
      id: 'req-1',
      name: 'Echo / Echo',
      revisionId: 'rev-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      callType: 'unary',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: 'desc-key',
      body: { message: 'secret-body' },
      metadata: { 'x-api-key': 'secret' },
      timeoutMs: 5000,
      auth: { type: 'bearer', bearerToken: 'tok' },
      tlsConfig: { serverCaPem: 'pem' },
    });
    expect(redacted.body).toEqual({ message: 'secret-body' });
    expect(redacted.body).not.toBe({ message: 'secret-body' });
    expect(redacted.auth?.bearerToken).toBe(GRPC_REDACTED_PLACEHOLDER);
    expect(redacted.tlsConfig?.serverCaPem).toBe('[REDACTED_PEM]');
  });

  it('mergeAuthForReplay hydrates redacted bearer token from tab', () => {
    expect(mergeAuthForReplay(
      { type: 'bearer', bearerToken: GRPC_REDACTED_PLACEHOLDER },
      { type: 'bearer', bearerToken: 'tab-token' },
    )).toEqual({ type: 'bearer', bearerToken: 'tab-token' });
  });

  it('mergeTlsConfigForReplay merges client cert and key from tab vault', () => {
    expect(mergeTlsConfigForReplay(
      { clientCertPem: GRPC_REDACTED_PLACEHOLDER, clientKeyPem: GRPC_REDACTED_PLACEHOLDER },
      { clientCertPem: 'tab-cert', clientKeyPem: 'tab-key' },
    )).toEqual({
      serverCaPem: undefined,
      clientCertPem: 'tab-cert',
      clientKeyPem: 'tab-key',
      serverNameOverride: undefined,
    });
  });

  it('mergeAuthForReplay returns tab auth when saved auth is none and tab has bearer', () => {
    expect(mergeAuthForReplay({ type: 'none' }, { type: 'bearer', bearerToken: 'tab' })).toEqual({
      type: 'bearer',
      bearerToken: 'tab',
    });
  });

  it('redactGrpcSavedRequestMetadataForPersist keeps literal values when auth build fails', () => {
    const metadata = redactGrpcSavedRequestMetadataForPersist(
      { authorization: 'Bearer live', 'x-trace': '1' },
      { type: 'bearer', bearerToken: '' },
    );
    expect(metadata['x-trace']).toBe('1');
    expect(metadata.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
  });

  it('resolveSavedRequestTargetForPersist prefers raw tab target over resolved snapshot address', () => {
    expect(resolveSavedRequestTargetForPersist(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: '127.0.0.1:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 5000,
        descriptorKey: 'desc-key',
      },
      { rawTarget: 'localhost:50051' },
    )).toBe('localhost:50051');
  });

  it('resolveSavedRequestTargetForPersist keeps env template targets', () => {
    expect(resolveSavedRequestTargetForPersist(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: '127.0.0.1:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 5000,
        descriptorKey: 'desc-key',
      },
      { connectionId: 'conn-1', rawTarget: '{{grpcHost}}:50051' },
    )).toBe('{{grpcHost}}:50051');
  });

  it('mergeAuthForReplay returns saved auth for matching unknown auth type branches', () => {
    const exotic = { type: 'custom', bearerToken: 'saved' } as unknown as import('./contracts').GrpcAuthConfig;
    expect(mergeAuthForReplay(exotic, exotic)).toEqual(exotic);
  });

  it('mergeAuthForReplay keeps saved auth when exotic type does not need tab vault secrets', () => {
    const exotic = { type: 'custom', bearerToken: 'saved' } as unknown as import('./contracts').GrpcAuthConfig;
    expect(mergeAuthForReplay(exotic, { type: 'bearer', bearerToken: 'tab' })).toEqual(exotic);
  });

  it('resolveSavedRequestTargetForPersist omits target when only connectionId is bound', () => {
    expect(resolveSavedRequestTargetForPersist(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: '127.0.0.1:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: {},
        metadata: {},
        timeoutMs: 5000,
        descriptorKey: 'desc-key',
      },
      { connectionId: 'conn-1' },
    )).toBeUndefined();
  });

  it('defaultGrpcSavedRequestName falls back for blank service and method', () => {
    expect(defaultGrpcSavedRequestName('', '')).toBe('UnknownService/UnknownMethod');
    expect(defaultGrpcSavedRequestName(' echo ', ' Echo ')).toBe('echo/Echo');
  });

  it('mergeAuthForReplay fills missing basic and api_key fields from tab auth', () => {
    expect(mergeAuthForReplay(
      { type: 'basic', basicPassword: 'saved-pw' },
      { type: 'basic', basicUsername: 'tab-user', basicPassword: 'tab-pw' },
    )).toEqual({ type: 'basic', basicUsername: 'tab-user', basicPassword: 'saved-pw' });

    expect(mergeAuthForReplay(
      { type: 'api_key', apiKeyValue: 'saved-key' },
      { type: 'api_key', apiKeyName: 'tab-name', apiKeyValue: 'tab-key' },
    )).toEqual({ type: 'api_key', apiKeyName: 'tab-name', apiKeyValue: 'saved-key' });
  });

  it('mergeAuthForReplay merges oauth2 clientSecret and scope fallbacks from tab', () => {
    expect(mergeAuthForReplay(
      {
        type: 'oauth2',
        oauth2: { tokenUrl: 'saved-url', clientId: 'saved-id', clientSecret: 'saved-secret' },
      },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'tab-url',
          clientId: 'tab-id',
          clientSecret: 'tab-secret',
          scope: 'read write',
        },
      },
    )).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'saved-url',
        clientId: 'saved-id',
        clientSecret: 'saved-secret',
        scope: 'read write',
      },
    });

    expect(mergeAuthForReplay(
      {
        type: 'oauth2',
        oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: '' },
      },
      {
        type: 'oauth2',
        oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'tab-secret' },
      },
    )).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'u',
        clientId: 'id',
        clientSecret: 'tab-secret',
      },
    });
  });

  it('mergeAuthForReplay returns saved auth when tab auth is absent', () => {
    expect(mergeAuthForReplay({ type: 'bearer', bearerToken: 'saved' }, undefined)).toEqual({
      type: 'bearer',
      bearerToken: 'saved',
    });
    expect(mergeAuthForReplay(
      { type: 'basic', basicPassword: GRPC_REDACTED_PLACEHOLDER },
      undefined,
    )).toEqual({ type: 'basic', basicPassword: GRPC_REDACTED_PLACEHOLDER });
  });

  it('mergeAuthForReplay uses tab auth when saved secrets are empty for mismatched types', () => {
    expect(mergeAuthForReplay(
      { type: 'basic', basicUsername: 'u', basicPassword: '' },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');

    expect(mergeAuthForReplay(
      { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: '' },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');

    expect(mergeAuthForReplay(
      { type: 'oauth2', oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: '' } },
      { type: 'bearer', bearerToken: 'tab' },
    )?.type).toBe('bearer');
  });

  it('mergeAuthForReplay falls back to tab bearer token when saved token is undefined', () => {
    expect(mergeAuthForReplay(
      { type: 'bearer' },
      { type: 'bearer', bearerToken: 'tab-token' },
    )).toEqual({ type: 'bearer', bearerToken: 'tab-token' });
  });

  it('createGrpcSavedRequestFromSnapshot uses default name and createdAt fallback', () => {
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        descriptorKey: 'desc-key',
        body: { message: 'hi' },
        metadata: {},
        timeoutMs: 5000,
      },
      { id: 'req-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
    );
    expect(saved.name).toBe('echo.EchoService/Echo');
    expect(saved.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
