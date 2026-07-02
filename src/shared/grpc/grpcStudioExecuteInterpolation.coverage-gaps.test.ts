/**
 * Coverage gaps — grpcStudioExecuteInterpolation.ts (Phase 9H/9I).
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcStudioExecuteFieldsReady,
  resolveGrpcStudioStreamMessageBodyForSend,
  resolveGrpcStudioTabFieldsForExecute,
} from './grpcStudioExecuteInterpolation';
import { createGrpcInterpolationEnvSnapshotFromMap } from './grpcInterpolationEnvSnapshot';

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

  it('assertGrpcStudioExecuteFieldsReady throws on invalid auth configuration', () => {
    expect(() => assertGrpcStudioExecuteFieldsReady({
      body: {},
      metadata: {},
      auth: { type: 'bearer', bearerToken: '   ' },
    })).toThrow(/Bearer token is required/i);
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
