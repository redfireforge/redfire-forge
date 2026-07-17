/**
 * Coverage gaps — grpcReplayTemplateCompatibility.ts (Phase 9F).
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  applyGrpcCallHistoryTemplateContext,
  buildGrpcSavedRequestTemplateSource,
  grpcReplayTargetMatchesEnvResolution,
} from './grpcReplayTemplateCompatibility';

describe('grpcReplayTemplateCompatibility coverage gaps', () => {
  it('buildGrpcSavedRequestTemplateSource returns undefined when tab context is empty', () => {
    expect(buildGrpcSavedRequestTemplateSource({})).toBeUndefined();
    expect(buildGrpcSavedRequestTemplateSource(undefined)).toBeUndefined();
  });

  it('buildGrpcSavedRequestTemplateSource accepts connectionId-only context', () => {
    const source = buildGrpcSavedRequestTemplateSource({ connectionId: 'profile-staging' });
    expect(source?.connectionId).toBe('profile-staging');
  });

  it('applyGrpcCallHistoryTemplateContext keeps snapshot when rawTarget has no tokens', () => {
    const snapshot = {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };
    const applied = applyGrpcCallHistoryTemplateContext(snapshot, {
      rawTarget: 'localhost:50051',
    });
    expect(applied.snapshot.target.address).toBe('localhost:50051');
  });

  it('grpcReplayTargetMatchesEnvResolution handles empty saved target', () => {
    const replaySnapshot = {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: '', tlsMode: 'disabled' as const },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };
    expect(grpcReplayTargetMatchesEnvResolution({
      savedTarget: '',
      replaySnapshot,
      envVarMap: {},
    })).toBe(true);
  });

  it('grpcReplayTargetMatchesEnvResolution compares literal saved targets', () => {
    const replaySnapshot = {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };
    expect(grpcReplayTargetMatchesEnvResolution({
      savedTarget: 'localhost:50051',
      replaySnapshot,
      envVarMap: {},
    })).toBe(true);
    expect(grpcReplayTargetMatchesEnvResolution({
      savedTarget: 'other:50051',
      replaySnapshot,
      envVarMap: {},
    })).toBe(false);
  });
});
