/**
 * Phase 9F — replay template compatibility tests.
 */
import { describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { createGrpcStudioTab } from '@grpc/grpcStudioTypes';
import { createGrpcSavedRequestFromSnapshot } from './grpcSavedRequest';
import {
  assertGrpcReplayUsesFreshInterpolationEnv,
  assertGrpcSavedRequestPortable,
  applyGrpcCallHistoryTemplateContext,
  buildGrpcSavedRequestTemplateSource,
  grpcReplayTargetMatchesEnvResolution,
} from './grpcReplayTemplateCompatibility';
import { createGrpcInterpolationEnvSnapshot } from './grpcInterpolationEnvSnapshot';
import { resolveGrpcSavedRequestReplay } from '@grpc/utils/grpcReplayResolver';

describe('grpcReplayTemplateCompatibility (Phase 9F)', () => {
  it('buildGrpcSavedRequestTemplateSource captures tab template fields', () => {
    const source = buildGrpcSavedRequestTemplateSource({
      rawTarget: '{{grpcHost}}',
      rawBody: { message: '{{greeting}}' },
      rawMetadata: { 'x-trace': '{{traceId}}' },
      interpolationEnv: { grpcHost: 'localhost:50051' },
    });
    expect(source?.target).toBe('{{grpcHost}}');
    expect(source?.body).toEqual({ message: '{{greeting}}' });
    expect(source?.metadata).toEqual({ 'x-trace': '{{traceId}}' });
  });

  it('createGrpcSavedRequestFromSnapshot persists template target over resolved snapshot', () => {
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: 'tab-1',
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: { message: '{{greeting}}' },
        metadata: { 'x-trace': '{{traceId}}' },
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      {
        rawTarget: '{{grpcHost}}',
        rawBody: { message: '{{greeting}}' },
        rawMetadata: { 'x-trace': '{{traceId}}' },
        interpolationEnv: { grpcHost: 'localhost:50051' },
      },
    );
    expect(saved.target).toBe('{{grpcHost}}');
    expect(saved.body).toEqual({ message: '{{greeting}}' });
    assertGrpcSavedRequestPortable(saved);
  });

  it('replay re-resolves saved template target with current env', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      target: '{{grpcHost}}',
      tlsMode: 'disabled',
    });
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: tab.id,
        requestId: 'req-1',
        capturedAt: '2026-01-01T00:00:00.000Z',
        callType: 'unary',
        target: { address: 'old-host:50051', tlsMode: 'disabled' },
        service: FIXTURE_UNARY_CALL_REQUEST.service,
        method: FIXTURE_UNARY_CALL_REQUEST.method,
        body: {},
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      { rawTarget: '{{grpcHost}}' },
    );

    const first = resolveGrpcSavedRequestReplay({
      saved,
      tab,
      requestId: 'replay-1',
      envVarMap: { grpcHost: 'first-host:50051' },
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    });
    const second = resolveGrpcSavedRequestReplay({
      saved,
      tab,
      requestId: 'replay-2',
      envVarMap: { grpcHost: 'second-host:50051' },
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    });

    expect(first.target.address).toBe('first-host:50051');
    expect(second.target.address).toBe('second-host:50051');
    expect(grpcReplayTargetMatchesEnvResolution({
      savedTarget: saved.target,
      replaySnapshot: second,
      envVarMap: { grpcHost: 'second-host:50051' },
    })).toBe(true);
  });

  it('assertGrpcReplayUsesFreshInterpolationEnv accepts new snapshot binding', () => {
    const prior = createGrpcInterpolationEnvSnapshot({
      activeEnvironment: { grpcHost: 'old:50051' },
    }, { capturedAt: '2026-01-01T00:00:00.000Z' });
    const next = createGrpcInterpolationEnvSnapshot({
      activeEnvironment: { grpcHost: 'new:50051' },
    }, { capturedAt: '2026-01-01T00:00:01.000Z' });
    expect(() => assertGrpcReplayUsesFreshInterpolationEnv(prior, next)).not.toThrow();
  });

  it('assertGrpcReplayUsesFreshInterpolationEnv rejects missing interpolationEnv', () => {
    expect(() => assertGrpcReplayUsesFreshInterpolationEnv(undefined, undefined)).toThrow(
      /must include interpolationEnv/,
    );
  });

  it('assertGrpcReplayUsesFreshInterpolationEnv rejects reused env object', () => {
    const env = createGrpcInterpolationEnvSnapshot({
      activeEnvironment: { grpcHost: 'host:50051' },
    });
    expect(() => assertGrpcReplayUsesFreshInterpolationEnv(env, env)).toThrow(
      /stale interpolationEnv object/,
    );
  });

  it('applyGrpcCallHistoryTemplateContext stores template in snapshot and resolved in filterTarget', () => {
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
      rawTarget: '{{grpcHost}}',
      filterTarget: 'localhost:50051',
    });
    expect(applied.snapshot.target.address).toBe('{{grpcHost}}');
    expect(applied.filterTarget).toBe('localhost:50051');
  });

  it('grpcReplayTargetMatchesEnvResolution resolves template via Phase 9A grammar', () => {
    const replaySnapshot = {
      tabId: 'tab-1',
      requestId: 'req-1',
      capturedAt: '2026-01-01T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'resolved-host:50051', tlsMode: 'disabled' as const },
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    };
    expect(grpcReplayTargetMatchesEnvResolution({
      savedTarget: '{{grpcHost}}',
      replaySnapshot,
      envVarMap: { grpcHost: 'resolved-host:50051' },
    })).toBe(true);
    expect(grpcReplayTargetMatchesEnvResolution({
      savedTarget: '{{grpcHost}}',
      replaySnapshot,
      envVarMap: { grpcHost: 'other-host:50051' },
    })).toBe(false);
  });

  it('assertGrpcSavedRequestPortable rejects interpolationEnv on saved artifact', () => {
    expect(() => assertGrpcSavedRequestPortable({
      ...createGrpcSavedRequestFromSnapshot(
        {
          tabId: 'tab-1',
          requestId: 'req-1',
          capturedAt: '2026-01-01T00:00:00.000Z',
          callType: 'unary',
          target: { address: 'localhost:50051', tlsMode: 'disabled' },
          service: FIXTURE_UNARY_CALL_REQUEST.service,
          method: FIXTURE_UNARY_CALL_REQUEST.method,
          body: {},
          metadata: {},
          timeoutMs: 30_000,
          descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        },
        { id: 'sr-1', revisionId: 'rev-1', updatedAt: '2026-01-01T00:00:00.000Z' },
      ),
      interpolationEnv: { env: {}, fingerprint: 'x', capturedAt: 't', layerFingerprints: {} },
    } as never)).toThrow(/must not persist interpolationEnv/);
  });
});
