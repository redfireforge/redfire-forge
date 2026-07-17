/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  GRPC_STUDIO_HINTS_STORAGE_KEY,
  persistDismissedGrpcStudioHints,
  readDismissedGrpcStudioHints,
  shouldShowPermissionDeniedHint,
  shouldShowSpringHealthHint,
} from './grpcSpringHints';

describe('grpcSpringHints (Phase 4G)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows health hint only for health.v1.Health Check/Watch', () => {
    expect(shouldShowSpringHealthHint('health.v1.Health', 'Check')).toBe(true);
    expect(shouldShowSpringHealthHint('health.v1.Health', 'Watch')).toBe(true);
    expect(shouldShowSpringHealthHint('health.v1.Health', 'List')).toBe(false);
    expect(shouldShowSpringHealthHint('echo.EchoService', 'Echo')).toBe(false);
  });

  it('shows permission denied hint only for status 7', () => {
    expect(shouldShowPermissionDeniedHint({ unaryStatus: 7 })).toBe(true);
    expect(shouldShowPermissionDeniedHint({ unaryStatus: 16 })).toBe(false);
    expect(shouldShowPermissionDeniedHint({
      lastError: { code: 'GRPC_ERROR', category: 'unknown', message: 'denied', details: { grpcStatus: 7 } },
    })).toBe(true);
    expect(shouldShowPermissionDeniedHint({
      lastError: { code: 'GRPC_ERROR', category: 'unknown', message: 'auth', details: { grpcStatus: 16 } },
    })).toBe(false);
  });

  it('persists dismissed hints in localStorage', () => {
    persistDismissedGrpcStudioHints(new Set(['spring_health_actuator']));
    expect(readDismissedGrpcStudioHints()).toEqual(new Set(['spring_health_actuator']));
    expect(localStorage.getItem(GRPC_STUDIO_HINTS_STORAGE_KEY)).toContain('spring_health_actuator');
  });
});
