/**
 * Coverage gaps — grpcStudioExecuteInterpolation.ts (Phase 9H/9I).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  assertGrpcStudioExecuteFieldsReady,
  resolveGrpcStudioStreamMessageBodyForSend,
  resolveGrpcStudioTabFieldsForExecute,
} from './grpcStudioExecuteInterpolation';
import { createGrpcInterpolationEnvSnapshotFromMap } from './grpcInterpolationEnvSnapshot';
import * as grpcAuthPolicy from './grpcAuthPolicy';

describe('grpcStudioExecuteInterpolation coverage gaps', () => {
  it('resolveGrpcStudioTabFieldsForExecute handles tabs without auth config', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      { body: { message: 'plain' }, metadata: {} },
      {},
    );
    expect(resolved.auth).toBeUndefined();
    expect(resolved.body).toEqual({ message: 'plain' });
  });

  it('assertGrpcStudioExecuteFieldsReady throws on invalid metadata keys', () => {
    expect(() => assertGrpcStudioExecuteFieldsReady({
      body: {},
      metadata: { 'bad key with spaces': 'value' },
    })).toThrow();
  });

  it('resolveGrpcStudioTabFieldsForExecute falls back to no auth for incomplete oauth2', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      {
        body: { message: 'plain' },
        metadata: {},
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: '',
            clientId: '',
            clientSecret: '',
            scope: '',
          },
        },
      },
      {},
    );

    expect(resolved.auth).toBeUndefined();
  });

  it('drops oauth2 when only tokenUrl is present', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      {
        body: {},
        metadata: {},
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example/token',
            clientId: '',
            clientSecret: '',
            scope: '',
          },
        },
      },
      {},
    );
    expect(resolved.auth).toBeUndefined();
  });

  it('drops oauth2 when tokenUrl and clientId are present but secret is missing', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      {
        body: {},
        metadata: {},
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example/token',
            clientId: 'client-id',
            clientSecret: '   ',
            scope: '',
          },
        },
      },
      {},
    );
    expect(resolved.auth).toBeUndefined();
  });

  it('assertGrpcStudioExecuteFieldsReady throws on invalid auth configuration', () => {
    expect(() => assertGrpcStudioExecuteFieldsReady({
      body: {},
      metadata: {},
      auth: { type: 'bearer', bearerToken: '   ' },
    })).toThrow(/Bearer token is required/i);
  });

  it('assertGrpcStudioExecuteFieldsReady uses fallback when auth issue message is missing', () => {
    const spy = vi.spyOn(grpcAuthPolicy, 'validateGrpcAuthForExecute').mockReturnValue([
      { field: 'auth', code: 'INVALID_REQUEST', message: undefined as unknown as string },
    ]);
    try {
      expect(() => assertGrpcStudioExecuteFieldsReady({
        body: {},
        metadata: {},
        auth: { type: 'bearer', bearerToken: 'token' },
      })).toThrow('Invalid auth configuration');
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps complete oauth2 auth after execute interpolation', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      {
        body: {},
        metadata: {},
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example/token',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            scope: 'openid',
          },
        },
      },
      {},
    );
    expect(resolved.auth?.type).toBe('oauth2');
    expect(resolved.auth?.oauth2?.clientId).toBe('client-id');
  });

  it('rejects unresolved metadata templates at execute time', () => {
    expect(() => resolveGrpcStudioTabFieldsForExecute(
      {
        body: {},
        metadata: { authorization: 'Bearer {{missingToken}}' },
      },
      {},
    )).toThrow(/unresolved|template|missingToken/i);
  });

  it('resolveGrpcStudioStreamMessageBodyForSend requires an execute snapshot env', () => {
    expect(() => resolveGrpcStudioStreamMessageBodyForSend({ message: 'x' }, undefined))
      .toThrow(/active execute snapshot/i);
  });

  it('resolveGrpcStudioStreamMessageBodyForSend accepts literal body with empty interpolation env', () => {
    expect(() => resolveGrpcStudioStreamMessageBodyForSend(
      { message: 'x' },
      createGrpcInterpolationEnvSnapshotFromMap({}),
    )).not.toThrow();
  });

  it('resolveGrpcStudioTabFieldsForExecute accepts tabs without body metadata defaults', () => {
    const resolved = resolveGrpcStudioTabFieldsForExecute(
      { metadata: {} } as { body: Record<string, unknown>; metadata: Record<string, string> },
      {},
    );
    expect(resolved.body).toEqual({});
  });

  it('resolveGrpcStudioStreamMessageBodyForSend accepts undefined body input', () => {
    const env = createGrpcInterpolationEnvSnapshotFromMap({});
    const resolved = resolveGrpcStudioStreamMessageBodyForSend(
      undefined as unknown as Record<string, unknown>,
      env,
    );
    expect(resolved).toEqual({});
  });
});
