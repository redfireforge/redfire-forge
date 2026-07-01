/**
 * Coverage gaps — grpcInterpolationPersistGuard.ts (Phase 9F).
 */
import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import { GrpcInterpolationError } from './grpcInterpolationError';
import {
  assertGrpcHarnessCallActionTemplatePersistSafe,
  buildGrpcHarnessCallActionDefinitionTemplateSource,
  collectGrpcHarnessCallActionPersistViolations,
  collectGrpcSavedRequestPersistViolations,
  prepareGrpcHarnessCallActionDefinitionSnapshot,
  resolveGrpcPersistStringField,
  sanitizeGrpcHarnessCallActionForTemplatePersist,
  sanitizeGrpcSavedRequestForTemplatePersist,
} from './grpcInterpolationPersistGuard';
import type { GrpcHarnessCallActionConfig } from '../types/grpc-harness';
import type { GrpcSavedRequest } from './grpcSavedRequest';

function makeSaved(overrides: Partial<GrpcSavedRequest> = {}): GrpcSavedRequest {
  return {
    id: 'sr-gap',
    name: 'Gap',
    revisionId: 'rev-gap',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    callType: 'unary',
    service: 'echo.EchoService',
    method: 'Echo',
    descriptorKey: 'desc-1',
    body: {},
    metadata: {},
    timeoutMs: 30_000,
    ...overrides,
  };
}

describe('grpcInterpolationPersistGuard coverage gaps', () => {
  it('resolveGrpcPersistStringField returns undefined for blank template source', () => {
    expect(resolveGrpcPersistStringField('   ', '{{grpcHost}}')).toBeUndefined();
    expect(resolveGrpcPersistStringField('', 'localhost:50051')).toBeUndefined();
    expect(resolveGrpcPersistStringField(undefined, '{{grpcHost}}')).toBe('{{grpcHost}}');
  });

  it('detects template leak without interpolation env map', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ target: 'localhost:50051' }),
      { target: '{{grpcHost}}' },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain('lost interpolation template tokens');
  });

  it('detects resolved literal leaks in nested JSON body fields', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ body: { message: 'hello', nested: { tag: 'dev' } } }),
      {
        body: { message: '{{greeting}}', nested: { tag: '{{envName}}' } },
        interpolationEnv: { greeting: 'hello', envName: 'dev' },
      },
    );
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some((v) => v.path.includes('body.message'))).toBe(true);
  });

  it('detects resolved literal leaks in JSON array body fields', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ body: { items: ['one', 'two'] } }),
      {
        body: { items: ['{{first}}', '{{second}}'] },
        interpolationEnv: { first: 'one', second: 'two' },
      },
    );
    expect(violations.some((v) => v.path.includes('body.items[0]'))).toBe(true);
  });

  it('detects auth template leaks for bearer, basic, api_key, and oauth2', () => {
    const bearer = collectGrpcSavedRequestPersistViolations(
      makeSaved({ auth: { type: 'bearer', bearerToken: 'resolved-token' } }),
      {
        auth: { type: 'bearer', bearerToken: '{{apiToken}}' },
        interpolationEnv: { apiToken: 'resolved-token' },
      },
    );
    expect(bearer.some((v) => v.path === 'auth.bearerToken')).toBe(true);

    const basic = collectGrpcSavedRequestPersistViolations(
      makeSaved({
        auth: { type: 'basic', basicUsername: 'user', basicPassword: 'pass' },
      }),
      {
        auth: { type: 'basic', basicUsername: '{{user}}', basicPassword: '{{pass}}' },
        interpolationEnv: { user: 'user', pass: 'pass' },
      },
    );
    expect(basic.some((v) => v.path === 'auth.basicPassword')).toBe(true);

    const apiKey = collectGrpcSavedRequestPersistViolations(
      makeSaved({
        auth: { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'secret' },
      }),
      {
        auth: { type: 'api_key', apiKeyName: '{{keyName}}', apiKeyValue: '{{keyValue}}' },
        interpolationEnv: { keyName: 'x-key', keyValue: 'secret' },
      },
    );
    expect(apiKey.some((v) => v.path === 'auth.apiKeyValue')).toBe(true);

    const oauth2 = collectGrpcSavedRequestPersistViolations(
      makeSaved({
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth/token',
            clientId: 'cid',
            clientSecret: 'csecret',
            scope: 'read',
          },
        },
      }),
      {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: '{{tokenUrl}}',
            clientId: '{{clientId}}',
            clientSecret: '{{clientSecret}}',
            scope: '{{scope}}',
          },
        },
        interpolationEnv: {
          tokenUrl: 'https://auth/token',
          clientId: 'cid',
          clientSecret: 'csecret',
          scope: 'read',
        },
      },
    );
    expect(oauth2.some((v) => v.path === 'auth.oauth2.clientSecret')).toBe(true);
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist restores all auth template fields', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://resolved/token',
            clientId: 'resolved-id',
            clientSecret: 'resolved-secret',
            scope: 'resolved-scope',
          },
        },
      }),
      {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: '{{tokenUrl}}',
            clientId: '{{clientId}}',
            clientSecret: '{{clientSecret}}',
            scope: '{{scope}}',
          },
        },
      },
    );
    expect(sanitized.auth).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: '{{tokenUrl}}',
        clientId: '{{clientId}}',
        clientSecret: '{{clientSecret}}',
        scope: '{{scope}}',
      },
    });
  });

  it('collectGrpcHarnessCallActionPersistViolations flags harness body and metadata leaks', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
      metadata: { 'x-trace': 'trace-9' },
    };
    const violations = collectGrpcHarnessCallActionPersistViolations(action, {
      body: { message: '{{greeting}}' },
      metadata: { 'x-trace': '{{traceId}}' },
      interpolationEnv: { greeting: 'hello', traceId: 'trace-9' },
    });
    expect(violations.some((v) => v.path === 'grpcCallAction.body.message')).toBe(true);
    expect(violations.some((v) => v.path === 'grpcCallAction.metadata.x-trace')).toBe(true);
  });

  it('sanitizeGrpcHarnessCallActionForTemplatePersist restores metadata and auth templates', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      metadata: { 'x-trace': 'trace-9' },
      auth: { type: 'bearer', bearerToken: 'resolved-token' },
    };
    const sanitized = sanitizeGrpcHarnessCallActionForTemplatePersist(action, {
      metadata: { 'x-trace': '{{traceId}}' },
      auth: { type: 'bearer', bearerToken: '{{apiToken}}' },
    });
    expect(sanitized.metadata).toEqual({ 'x-trace': '{{traceId}}' });
    expect(sanitized.auth).toEqual({ type: 'bearer', bearerToken: '{{apiToken}}' });
  });

  it('returns empty violations and passthrough sanitizers when template source is missing', () => {
    const saved = makeSaved({ target: 'localhost:50051' });
    expect(collectGrpcSavedRequestPersistViolations(saved)).toEqual([]);
    expect(sanitizeGrpcSavedRequestForTemplatePersist(saved)).toBe(saved);

    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    };
    expect(collectGrpcHarnessCallActionPersistViolations(action)).toEqual([]);
    expect(sanitizeGrpcHarnessCallActionForTemplatePersist(action)).toBe(action);
  });

  it('collectGrpcSavedRequestPersistViolations flags metadata template leaks', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ metadata: { 'x-trace': 'trace-9' } }),
      {
        metadata: { 'x-trace': '{{traceId}}' },
        interpolationEnv: { traceId: 'trace-9' },
      },
    );
    expect(violations.some((v) => v.path === 'metadata.x-trace')).toBe(true);
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist keeps persisted auth when template auth type differs', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({ auth: { type: 'none' } }),
      { auth: { type: 'bearer', bearerToken: '{{apiToken}}' } },
    );
    expect(sanitized.auth).toEqual({ type: 'none' });
  });

  it('restoreAuthTemplateFields returns persisted auth for unsupported template auth types', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({ auth: { type: 'none' } }),
      { auth: { type: 'none' } },
    );
    expect(sanitized.auth).toEqual({ type: 'none' });
  });

  it('sanitizeGrpcHarnessCallActionForTemplatePersist creates metadata map when action has none', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    };
    const sanitized = sanitizeGrpcHarnessCallActionForTemplatePersist(action, {
      metadata: { 'x-trace': '{{traceId}}' },
    });
    expect(sanitized.metadata).toEqual({ 'x-trace': '{{traceId}}' });
  });

  it('restoreAuthTemplateFields preserves persisted oauth2 when oauth2 payload is missing', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({ auth: { type: 'oauth2' } }),
      {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: '{{tokenUrl}}',
            clientId: '{{clientId}}',
            clientSecret: '{{clientSecret}}',
            scope: '{{scope}}',
          },
        },
      },
    );
    expect(sanitized.auth).toEqual({ type: 'oauth2' });
  });

  it('does not flag persisted values that still contain template tokens', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ target: '{{grpcHost}}' }),
      { target: '{{grpcHost}}' },
    );
    expect(violations).toEqual([]);
  });

  it('ignores metadata template entries when saved metadata key is missing', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ metadata: {} }),
      { metadata: { 'x-trace': '{{traceId}}' } },
    );
    expect(violations).toEqual([]);
  });

  it('collectAuthTemplateViolations ignores auth types without template fields', () => {
    expect(collectGrpcSavedRequestPersistViolations(
      makeSaved({ auth: { type: 'none' } }),
      { auth: { type: 'none' } },
    )).toEqual([]);
  });

  it('collectAuthTemplateViolations skips oauth2 when nested config is missing', () => {
    expect(collectGrpcSavedRequestPersistViolations(
      makeSaved({ auth: { type: 'oauth2' } }),
      {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: '{{tokenUrl}}',
            clientId: '{{clientId}}',
            clientSecret: '{{clientSecret}}',
            scope: '{{scope}}',
          },
        },
      },
    )).toEqual([]);
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist falls back to persisted auth fields when template values are blank', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        auth: {
          type: 'bearer',
          bearerToken: 'resolved-token',
        },
      }),
      { auth: { type: 'bearer', bearerToken: '   ' } },
    );
    expect(sanitized.auth).toEqual({ type: 'bearer', bearerToken: 'resolved-token' });
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist restores basic and api_key auth templates', () => {
    const basic = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        auth: { type: 'basic', basicUsername: 'user', basicPassword: 'pass' },
      }),
      {
        auth: {
          type: 'basic',
          basicUsername: '{{user}}',
          basicPassword: '{{pass}}',
        },
      },
    );
    expect(basic.auth).toEqual({
      type: 'basic',
      basicUsername: '{{user}}',
      basicPassword: '{{pass}}',
    });

    const apiKey = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        auth: { type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'secret' },
      }),
      {
        auth: {
          type: 'api_key',
          apiKeyName: '{{keyName}}',
          apiKeyValue: '{{keyValue}}',
        },
      },
    );
    expect(apiKey.auth).toEqual({
      type: 'api_key',
      apiKeyName: '{{keyName}}',
      apiKeyValue: '{{keyValue}}',
    });
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist keeps persisted oauth2 literals when template fields are blank', () => {
    const persisted = {
      type: 'oauth2' as const,
      oauth2: {
        tokenUrl: 'https://resolved/token',
        clientId: 'resolved-id',
        clientSecret: 'resolved-secret',
        scope: 'resolved-scope',
      },
    };
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({ auth: persisted }),
      {
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: ' ',
            clientId: ' ',
            clientSecret: ' ',
            scope: ' ',
          },
        },
      },
    );
    expect(sanitized.auth).toEqual(persisted);
  });

  it('sanitizeGrpcHarnessCallActionForTemplatePersist uses connectionId-only template source', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      connectionId: 'conn-1',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    };
    const sanitized = sanitizeGrpcHarnessCallActionForTemplatePersist(action, {
      connectionId: 'conn-1',
    });
    expect(sanitized.target).toBe('');
    expect(sanitized.connectionId).toBe('conn-1');
  });

  it('sanitizeGrpcHarnessCallActionForTemplatePersist replaces body from template source', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'resolved' },
    };
    const sanitized = sanitizeGrpcHarnessCallActionForTemplatePersist(action, {
      body: { message: '{{greeting}}' },
    });
    expect(sanitized.body).toEqual({ message: '{{greeting}}' });
  });

  it('buildGrpcHarnessCallActionDefinitionTemplateSource captures connection profile binding', () => {
    const source = buildGrpcHarnessCallActionDefinitionTemplateSource({
      callType: 'unary',
      connectionId: 'conn-1',
      target: '{{grpcHost}}',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: '{{greeting}}' },
      metadata: { 'x-trace': '{{traceId}}' },
      auth: { type: 'bearer', bearerToken: '{{token}}' },
    });
    expect(source).toEqual({
      connectionId: 'conn-1',
      target: '{{grpcHost}}',
      body: { message: '{{greeting}}' },
      metadata: { 'x-trace': '{{traceId}}' },
      auth: { type: 'bearer', bearerToken: '{{token}}' },
    });
  });

  it('buildGrpcHarnessCallActionDefinitionTemplateSource omits literal target without tokens', () => {
    const source = buildGrpcHarnessCallActionDefinitionTemplateSource({
      callType: 'unary',
      connectionId: 'conn-1',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    });
    expect(source.connectionId).toBe('conn-1');
    expect(source.target).toBeUndefined();
  });

  it('prepareGrpcHarnessCallActionDefinitionSnapshot clones action when no template fields exist', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    };
    const snapshot = prepareGrpcHarnessCallActionDefinitionSnapshot(action);
    expect(snapshot).toEqual(action);
    expect(snapshot).not.toBe(action);
  });

  it('prepareGrpcHarnessCallActionDefinitionSnapshot sanitizes templated harness actions', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'resolved:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    };
    const snapshot = prepareGrpcHarnessCallActionDefinitionSnapshot({
      ...action,
      target: '{{grpcHost}}',
      body: { message: '{{greeting}}' },
    });
    expect(snapshot.target).toBe('{{grpcHost}}');
    expect(snapshot.body).toEqual({ message: '{{greeting}}' });
  });

  it('assertGrpcHarnessCallActionTemplatePersistSafe throws GrpcInterpolationError on leak', () => {
    expect(() => assertGrpcHarnessCallActionTemplatePersistSafe(
      {
        callType: 'unary',
        target: 'localhost:50051',
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
      },
      {
        body: { message: '{{greeting}}' },
        interpolationEnv: { greeting: 'hello' },
      },
    )).toThrow(GrpcInterpolationError);
    try {
      assertGrpcHarnessCallActionTemplatePersistSafe(
        {
          callType: 'unary',
          target: 'localhost:50051',
          descriptorKey: 'desc-1',
          service: 'echo.EchoService',
          method: 'Echo',
          body: { message: 'hello' },
        },
        {
          body: { message: '{{greeting}}' },
          interpolationEnv: { greeting: 'hello' },
        },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(GrpcInterpolationError);
      expect((error as GrpcInterpolationError).code)
        .toBe(GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION);
    }
  });
});
