/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractGrpcStatusFromError,
  GRPC_STUDIO_HINTS_STORAGE_KEY,
  persistDismissedGrpcStudioHints,
  readDismissedGrpcStudioHints,
  shouldShowPermissionDeniedHint,
  shouldShowSpringHealthHint,
} from './grpcSpringHints';

describe('grpcSpringHints coverage gaps', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('shouldShowSpringHealthHint matches health Check and Watch methods only', () => {
    expect(shouldShowSpringHealthHint('health.v1.Health', 'Check')).toBe(true);
    expect(shouldShowSpringHealthHint('health.v1.Health', 'Watch')).toBe(true);
    expect(shouldShowSpringHealthHint('echo.EchoService', 'Echo')).toBe(false);
    expect(shouldShowSpringHealthHint(undefined, 'Check')).toBe(false);
  });

  it('extractGrpcStatusFromError reads grpcStatus from error details', () => {
    expect(extractGrpcStatusFromError({ details: { grpcStatus: 7 } })).toBe(7);
    expect(extractGrpcStatusFromError({ details: { grpcStatus: '7' } })).toBeUndefined();
    expect(extractGrpcStatusFromError(undefined)).toBeUndefined();
  });

  it('shouldShowPermissionDeniedHint checks unary, stream, and nested error bodies', () => {
    expect(shouldShowPermissionDeniedHint({ unaryStatus: 7 })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ streamStatus: 7 })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ lastError: { details: { grpcStatus: 7 } } })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ streamError: { details: { grpcStatus: 7 } } })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ unaryStatus: 16 })).toBe(false);
  });

  it('readDismissedGrpcStudioHints filters invalid ids and handles bad JSON', () => {
    localStorage.setItem(GRPC_STUDIO_HINTS_STORAGE_KEY, JSON.stringify([
      'spring_health_actuator',
      'invalid-id',
    ]));
    expect(readDismissedGrpcStudioHints()).toEqual(new Set(['spring_health_actuator']));
    localStorage.setItem(GRPC_STUDIO_HINTS_STORAGE_KEY, '{bad json');
    expect(readDismissedGrpcStudioHints()).toEqual(new Set());
    localStorage.setItem(GRPC_STUDIO_HINTS_STORAGE_KEY, JSON.stringify({ not: 'array' }));
    expect(readDismissedGrpcStudioHints()).toEqual(new Set());
  });

  it('persistDismissedGrpcStudioHints writes ids to localStorage', () => {
    persistDismissedGrpcStudioHints(new Set(['spring_permission_denied']));
    expect(JSON.parse(localStorage.getItem(GRPC_STUDIO_HINTS_STORAGE_KEY) ?? '[]')).toEqual([
      'spring_permission_denied',
    ]);
  });

  it('readDismissedGrpcStudioHints returns empty set when localStorage unavailable', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    expect(readDismissedGrpcStudioHints()).toEqual(new Set());
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  });
});
