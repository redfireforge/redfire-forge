import { describe, expect, it } from 'vitest';
import {
  canChangeGrpcTabTransportMode,
  captureGrpcTabExecuteSnapshotFromResolution,
  clearedGrpcStreamSessionPatch,
  createDefaultProtoIngestState,
  createGrpcStudioTab,
  createTabDescriptorStateAfterConnectionInvalidation,
  createTabDescriptorStateAfterReplayConnectionChange,
  duplicateGrpcStudioTab,
  duplicateTabDescriptorState,
  isGrpcLifecycleInFlight,
  isGrpcLifecycleTerminal,
  nextDefaultGrpcTabTitle,
  nextGrpcTabId,
  resolveGrpcStudioTabTransportMode,
  snapshotToStreamStartRequest,
  snapshotToUnaryCallRequest,
  toPersistedGrpcStudioTab,
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

  it('snapshotToUnaryCallRequest and lifecycle helpers cover unary/stream guards', () => {
    const tab = createGrpcStudioTab({
      descriptorKey: 'desc-1',
      service: 'echo.EchoService',
      method: 'Echo',
    });
    const unarySnapshot = {
      tabId: tab.id,
      requestId: 'req-1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      callType: 'unary' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: 'hi' },
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    };
    expect(snapshotToUnaryCallRequest(unarySnapshot).callType).toBe('unary');
    expect(isGrpcLifecycleInFlight('calling')).toBe(true);
    expect(isGrpcLifecycleTerminal('success')).toBe(true);
    expect(toPersistedGrpcStudioTab(tab).id).toBe(tab.id);
  });

  it('createTabDescriptorStateAfterConnectionInvalidation resets descriptor state', () => {
    const prior = {
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      expandedServiceIds: ['echo.EchoService'],
      sourceSelection: createDefaultDescriptorSourceSelection(),
      driftState: 'none' as const,
    };
    const reset = createTabDescriptorStateAfterConnectionInvalidation(prior);
    expect(reset.loadState).toBe('idle');
    expect(reset.descriptor).toBeUndefined();
  });

  it('duplicateGrpcStudioTab clones stream messages and transport mode', () => {
    const tab = createGrpcStudioTab({
      title: 'Echo',
      target: 'localhost:50051',
      streamMessages: [{ sequence: 1, timestamp: '2026-01-01T00:00:00.000Z', direction: 'inbound', data: { id: 1 } }],
      transportMode: 'tauri_native',
    });
    const copy = duplicateGrpcStudioTab(tab, [tab]);
    expect(copy.title).toBe('Echo (copy)');
    expect(copy.streamMessages).toEqual(tab.streamMessages);
    expect(copy.streamMessages).not.toBe(tab.streamMessages);
    expect(copy.transportMode).toBe('tauri_native');
  });

  it('nextDefaultGrpcTabTitle and nextGrpcTabId fill numeric gaps', () => {
    const tabs = [
      createGrpcStudioTab({ id: 'grpc-tab-1', title: 'Tab 1' }),
      createGrpcStudioTab({ id: 'grpc-tab-3', title: 'Tab 3' }),
    ];
    expect(nextDefaultGrpcTabTitle(tabs)).toBe('Tab 2');
    expect(nextGrpcTabId(tabs)).toBe('grpc-tab-2');
  });

  it('canChangeGrpcTabTransportMode blocks in-flight unary and stream sessions', () => {
    const idle = createGrpcStudioTab({ lifecycle: 'idle', streamLifecycle: 'idle' });
    expect(canChangeGrpcTabTransportMode(idle)).toBe(true);
    expect(canChangeGrpcTabTransportMode({ ...idle, lifecycle: 'calling', activeRequestId: 'req-1' })).toBe(false);
    expect(canChangeGrpcTabTransportMode({ ...idle, streamLifecycle: 'streaming', activeStreamId: 's-1' })).toBe(false);
  });

  it('resolveGrpcStudioTabTransportMode falls back to platform default', () => {
    const tab = createGrpcStudioTab();
    expect(resolveGrpcStudioTabTransportMode({ ...tab, transportMode: 'express' })).toBe('express');
    expect(resolveGrpcStudioTabTransportMode({ ...tab, transportMode: undefined })).toBeTruthy();
  });

  it('captureGrpcTabExecuteSnapshotFromResolution throws when target validation fails', () => {
    const tab = createGrpcStudioTab({ target: 'not-a-valid-target!!!' });
    expect(() => captureGrpcTabExecuteSnapshotFromResolution(
      tab,
      'req-1',
      {
        target: 'bad',
        tlsMode: 'disabled',
        targetValidation: { valid: false, reason: 'bad target', normalized: '' },
      },
      'unary',
    )).toThrow(/bad target/i);
  });

  it('clearedGrpcStreamSessionPatch and stream snapshot conversion cover streaming paths', () => {
    expect(clearedGrpcStreamSessionPatch().streamMessages).toEqual([]);
    const tab = createGrpcStudioTab({ descriptorKey: 'desc-1', service: 'echo.EchoService', method: 'Echo' });
    const snapshot = {
      tabId: tab.id,
      requestId: 'req-1',
      capturedAt: '2026-06-29T00:00:00.000Z',
      callType: 'server_streaming' as const,
      target: { address: 'localhost:50051', tlsMode: 'disabled' as const },
      service: 'echo.EchoService',
      method: 'Echo',
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: 'desc-1',
    };
    expect(snapshotToStreamStartRequest(snapshot).callType).toBe('server_streaming');
    expect(isGrpcLifecycleTerminal('cancelled')).toBe(true);
    expect(isGrpcLifecycleInFlight('connecting')).toBe(true);
  });
});
