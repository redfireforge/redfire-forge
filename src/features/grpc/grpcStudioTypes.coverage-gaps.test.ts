import { describe, expect, it } from 'vitest';
import {
  createDefaultProtoIngestState,
  createGrpcStudioTab,
  createTabDescriptorStateAfterReplayConnectionChange,
  duplicateTabDescriptorState,
  snapshotToStreamStartRequest,
} from './grpcStudioTypes';
import { FIXTURE_DESCRIPTOR } from '../../shared/grpc/contractFixtures';
import { createDefaultDescriptorSourceSelection } from '../../shared/grpc/descriptorSourcePolicy';

describe('grpcStudioTypes coverage gaps', () => {
  it('createTabDescriptorStateAfterReplayConnectionChange ignores blank descriptor keys', () => {
    const prior = {
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      expandedServiceIds: [],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const reset = createTabDescriptorStateAfterReplayConnectionChange(prior, '   ');
    expect(reset.descriptor).toBeUndefined();
    expect(reset.loadState).toBe('idle');
  });

  it('createTabDescriptorStateAfterReplayConnectionChange demotes loading state to idle on preserve', () => {
    const prior = {
      loadState: 'loading' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      expandedServiceIds: ['echo.EchoService'],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const preserved = createTabDescriptorStateAfterReplayConnectionChange(prior, FIXTURE_DESCRIPTOR.key);
    expect(preserved.loadState).toBe('idle');
    expect(preserved.descriptor?.key).toBe(FIXTURE_DESCRIPTOR.key);
  });

  it('duplicateTabDescriptorState copies drift artifacts when loaded', () => {
    const staleMethod = FIXTURE_DESCRIPTOR.services[0]!.methods[0]!;
    const loaded = {
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      expandedServiceIds: [],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'blocking' as const,
      driftMessage: 'Method removed',
      driftIssues: [{ kind: 'method_removed' as const, path: 'Echo', severity: 'blocking' as const }],
      suggestedRebinds: [{ service: 'echo.EchoService', method: 'Echo', score: 1 }],
      driftStaleMethod: staleMethod,
      driftBaselineRequestSchema: staleMethod.requestSchema,
    };
    const copy = duplicateTabDescriptorState(loaded);
    expect(copy.driftMessage).toBe('Method removed');
    expect(copy.driftIssues).not.toBe(loaded.driftIssues);
    expect(copy.driftStaleMethod?.name).toBe(staleMethod.name);
  });

  it('duplicateTabDescriptorState preserves proto ingest on loading reset', () => {
    const loading = {
      loadState: 'loading' as const,
      expandedServiceIds: [],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
      protoIngest: {
        ...createDefaultProtoIngestState(),
        url: 'https://example.com/echo.proto',
      },
    };
    const copy = duplicateTabDescriptorState(loading);
    expect(copy.loadState).toBe('idle');
    expect(copy.protoIngest?.url).toBe('https://example.com/echo.proto');
  });

  it('snapshotToStreamStartRequest rejects unary snapshots', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    });
    const snapshot = {
      tabId: tab.id,
      requestId: 'req-1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    };
    expect(() => snapshotToStreamStartRequest(snapshot)).toThrow(/streaming snapshot/);
  });
});
