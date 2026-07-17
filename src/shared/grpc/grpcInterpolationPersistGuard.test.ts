/**
 * Phase 9F — template persistence guard unit tests.
 */
import { describe, expect, it } from 'vitest';
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import { GrpcInterpolationError } from './grpcInterpolationError';
import {
  assertGrpcHarnessCallActionTemplatePersistSafe,
  assertGrpcSavedRequestTemplatePersistSafe,
  collectGrpcSavedRequestPersistViolations,
  hasGrpcInterpolationTemplateReference,
  resolveGrpcPersistStringField,
  sanitizeGrpcHarnessCallActionForTemplatePersist,
  prepareGrpcHarnessCallActionDefinitionSnapshot,
  sanitizeGrpcSavedRequestForTemplatePersist,
} from './grpcInterpolationPersistGuard';
import type { GrpcHarnessCallActionConfig } from '../types/grpc-harness';
import type { GrpcSavedRequest } from './grpcSavedRequest';

function makeSaved(overrides: Partial<GrpcSavedRequest> = {}): GrpcSavedRequest {
  return {
    id: 'sr-1',
    name: 'Echo / Echo',
    revisionId: 'rev-1',
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

describe('grpcInterpolationPersistGuard (Phase 9F)', () => {
  it('hasGrpcInterpolationTemplateReference uses Phase 9A grammar', () => {
    expect(hasGrpcInterpolationTemplateReference('{{grpcHost}}')).toBe(true);
    expect(hasGrpcInterpolationTemplateReference('\\{{literal}}')).toBe(false);
    expect(hasGrpcInterpolationTemplateReference('localhost:50051')).toBe(false);
  });

  it('resolveGrpcPersistStringField prefers template source with tokens', () => {
    expect(resolveGrpcPersistStringField('{{grpcHost}}', 'localhost:50051')).toBe('{{grpcHost}}');
  });

  it('resolveGrpcPersistStringField prefers explicit tab literal over snapshot template', () => {
    expect(resolveGrpcPersistStringField('localhost:50051', '{{grpcHost}}')).toBe('localhost:50051');
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist keeps literal auth when tab overrides template', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        target: '{{grpcHost}}',
        auth: { type: 'bearer', bearerToken: '{{apiToken}}' },
      }),
      {
        target: 'localhost:50051',
        auth: { type: 'bearer', bearerToken: 'literal-token' },
        interpolationEnv: { grpcHost: 'localhost:50051', apiToken: 'literal-token' },
      },
    );
    expect(sanitized.target).toBe('localhost:50051');
    expect(sanitized.auth).toEqual({ type: 'bearer', bearerToken: 'literal-token' });
  });

  it('detects resolved target leak against interpolation env', () => {
    const violations = collectGrpcSavedRequestPersistViolations(
      makeSaved({ target: 'localhost:50051' }),
      {
        target: '{{grpcHost}}',
        interpolationEnv: { grpcHost: 'localhost:50051' },
      },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.code).toBe(GRPC_INTERPOLATION_ERROR_CODES.SERIALIZATION);
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist keeps literal metadata when tab overrides template', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        metadata: { 'x-trace': '{{traceId}}' },
      }),
      {
        metadata: { 'x-trace': 'trace-literal-9' },
        interpolationEnv: { traceId: 'trace-literal-9' },
      },
    );
    expect(sanitized.metadata['x-trace']).toBe('trace-literal-9');
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist restores template target and body', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({
        target: 'localhost:50051',
        body: { message: 'hello' },
        metadata: { 'x-trace': 'trace-9' },
      }),
      {
        target: '{{grpcHost}}',
        body: { message: '{{greeting}}' },
        metadata: { 'x-trace': '{{traceId}}' },
        interpolationEnv: { grpcHost: 'localhost:50051', greeting: 'hello', traceId: 'trace-9' },
      },
    );
    expect(sanitized.target).toBe('{{grpcHost}}');
    expect(sanitized.body).toEqual({ message: '{{greeting}}' });
    expect(sanitized.metadata['x-trace']).toBe('{{traceId}}');
  });

  it('assertGrpcSavedRequestTemplatePersistSafe throws GrpcInterpolationError on leak', () => {
    expect(() => assertGrpcSavedRequestTemplatePersistSafe(
      makeSaved({ target: 'localhost:50051' }),
      {
        target: '{{grpcHost}}',
        interpolationEnv: { grpcHost: 'localhost:50051' },
      },
    )).toThrow(GrpcInterpolationError);
  });

  it('sanitizeGrpcSavedRequestForTemplatePersist clears target for profile-only binding', () => {
    const sanitized = sanitizeGrpcSavedRequestForTemplatePersist(
      makeSaved({ target: 'localhost:50051' }),
      { connectionId: 'profile-staging' },
    );
    expect(sanitized.target).toBeUndefined();
    expect(sanitized.connectionId).toBe('profile-staging');
  });

  it('prepareGrpcHarnessCallActionDefinitionSnapshot clears profile-only resolved target', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      connectionId: 'profile-staging',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    };
    const snapshot = prepareGrpcHarnessCallActionDefinitionSnapshot(action);
    expect(snapshot.target).toBe('');
    expect(snapshot.connectionId).toBe('profile-staging');
  });

  it('sanitizeGrpcHarnessCallActionForTemplatePersist restores harness target template', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    };
    const sanitized = sanitizeGrpcHarnessCallActionForTemplatePersist(action, {
      target: '{{grpcHost}}',
      body: { message: '{{greeting}}' },
      interpolationEnv: { grpcHost: 'localhost:50051', greeting: 'hello' },
    });
    expect(sanitized.target).toBe('{{grpcHost}}');
    expect(sanitized.body).toEqual({ message: '{{greeting}}' });
  });

  it('sanitizeGrpcHarnessCallActionForTemplatePersist clears target for profile-only binding', () => {
    const action: GrpcHarnessCallActionConfig = {
      callType: 'unary',
      target: 'localhost:50051',
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    };
    const sanitized = sanitizeGrpcHarnessCallActionForTemplatePersist(action, {
      connectionId: 'profile-staging',
    });
    expect(sanitized.target).toBe('');
    expect(sanitized.connectionId).toBe('profile-staging');
  });

  it('assertGrpcHarnessCallActionTemplatePersistSafe rejects resolved harness target leak', () => {
    expect(() => assertGrpcHarnessCallActionTemplatePersistSafe(
      {
        callType: 'unary',
        target: 'localhost:50051',
        descriptorKey: 'desc-1',
        service: 'echo.EchoService',
        method: 'Echo',
      },
      {
        target: '{{grpcHost}}',
        interpolationEnv: { grpcHost: 'localhost:50051' },
      },
    )).toThrow(GrpcInterpolationError);
  });

  it('allows literal targets when template source has no tokens', () => {
    expect(collectGrpcSavedRequestPersistViolations(
      makeSaved({ target: 'localhost:50051' }),
      { target: 'localhost:50051' },
    )).toEqual([]);
  });

  it('does not flag intentional literal override when env resolution differs', () => {
    expect(collectGrpcSavedRequestPersistViolations(
      makeSaved({ target: 'other-host:50051' }),
      {
        target: '{{grpcHost}}',
        interpolationEnv: { grpcHost: 'localhost:50051' },
      },
    )).toEqual([]);
  });
});
