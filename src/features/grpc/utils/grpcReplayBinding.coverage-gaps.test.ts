import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
} from '../../../shared/grpc/contractFixtures';
import { createGrpcSavedRequestFromSnapshot } from '../../../shared/grpc/grpcSavedRequest';
import { createGrpcStudioTab } from '../grpcStudioTypes';
import { createDefaultDescriptorSourceSelection } from '../../../shared/grpc/descriptorSourcePolicy';
import {
  analyzeReplaySchemaDrift,
  applyGrpcReplaySafeFallbackBody,
  resolveBaselineDescriptorForReplay,
  resolveEffectiveReplayBaseline,
  resolveGrpcReplayBinding,
} from './grpcReplayBinding';

const TS = '2026-06-29T12:00:00.000Z';

describe('grpcReplayBinding coverage gaps', () => {
  it('resolveBaselineDescriptorForReplay returns undefined when tab state is missing', () => {
    expect(resolveBaselineDescriptorForReplay(undefined, FIXTURE_DESCRIPTOR_KEY)).toBeUndefined();
  });

  it('resolveBaselineDescriptorForReplay falls back to current descriptor', () => {
    const resolved = resolveBaselineDescriptorForReplay(
      {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        expandedServiceIds: [],
        sourceSelection: createDefaultDescriptorSourceSelection(),
        driftState: 'none',
      },
      FIXTURE_DESCRIPTOR_KEY,
    );
    expect(resolved?.key).toBe(FIXTURE_DESCRIPTOR_KEY);
  });

  it('resolveBaselineDescriptorForReplay returns undefined when keys do not match', () => {
    const resolved = resolveBaselineDescriptorForReplay(
      {
        loadState: 'loaded',
        descriptor: FIXTURE_DESCRIPTOR,
        lastKnownGoodDescriptor: FIXTURE_DESCRIPTOR,
        expandedServiceIds: [],
        sourceSelection: createDefaultDescriptorSourceSelection(),
        driftState: 'none',
      },
      'other-descriptor-key',
    );
    expect(resolved).toBeUndefined();
  });

  it('resolveGrpcReplayBinding blocks when currentDescriptor omitted but saved has method binding', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: tab.id,
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS },
    );

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-no-desc',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    });

    expect(result.drift.state).toBe('blocking');
    expect(result.drift.message).toContain('Load a schema');
    expect(result.safeFallbackApplied).toBe(false);
  });

  it('applyGrpcReplaySafeFallbackBody returns clone when method missing on warning', () => {
    const body = { message: 'hello' };
    const emptyDescriptor = {
      ...FIXTURE_DESCRIPTOR,
      services: [],
    };
    const result = applyGrpcReplaySafeFallbackBody(
      body,
      {
        state: 'warning',
        message: 'warn',
        issues: [],
        suggestedRebinds: [],
      },
      emptyDescriptor,
      'echo.EchoService',
      'Echo',
    );
    expect(result).toEqual(body);
    expect(result).not.toBe(body);
  });

  it('analyzeReplaySchemaDrift returns none when body matches schema without baseline', () => {
    const drift = analyzeReplaySchemaDrift({
      currentDescriptor: FIXTURE_DESCRIPTOR,
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hello' },
    });
    expect(drift.state).toBe('none');
  });

  it('resolveEffectiveReplayBaseline returns undefined when no sources match', () => {
    expect(resolveEffectiveReplayBaseline({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      baselineDescriptor: { ...FIXTURE_DESCRIPTOR, key: 'wrong-key' },
    })).toBeUndefined();
  });

  it('resolveGrpcReplayBinding blocks when loaded descriptor key mismatches saved request', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      tlsMode: 'disabled',
      auth: { type: 'none' },
    });
    const saved = createGrpcSavedRequestFromSnapshot(
      {
        tabId: tab.id,
        requestId: 'req-1',
        capturedAt: TS,
        callType: 'unary',
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'hello' },
        metadata: {},
        timeoutMs: 30_000,
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      },
      { id: 'sr-1', revisionId: 'rev-1', updatedAt: TS },
    );

    const result = resolveGrpcReplayBinding({
      saved,
      tab,
      requestId: 'replay-key-mismatch-gap',
      envVarMap: {},
      profiles: [],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
      currentDescriptor: { ...FIXTURE_DESCRIPTOR, key: 'other-key' },
    });

    expect(result.drift.state).toBe('blocking');
  });
});
