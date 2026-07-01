import { describe, expect, it } from 'vitest';
import type { GrpcTauriEvent } from './grpcTauriContracts';
import {
  GrpcTauriEventSequenceBuffer,
  normalizeGrpcTauriEvent,
  shouldAcceptGrpcTauriEventForStream,
} from './grpcTauriEventAdapter';

function makeEvent(overrides: Partial<GrpcTauriEvent> = {}): GrpcTauriEvent {
  return {
    schemaVersion: 1,
    type: 'grpc-message',
    streamId: 'stream-1',
    requestId: 'req-1',
    tabId: 'tab-a',
    sequence: 1,
    timestamp: '2026-06-30T00:00:00.000Z',
    data: { message: 'hello' },
    ...overrides,
  };
}

describe('grpcTauriEventAdapter', () => {
  it('normalizes grpcStatus fields to GrpcStreamEvent status fields', () => {
    const normalized = normalizeGrpcTauriEvent(makeEvent({
      type: 'grpc-end',
      grpcStatus: 0,
      grpcStatusMessage: 'OK',
    }));
    expect(normalized?.status).toBe(0);
    expect(normalized?.statusMessage).toBe('OK');
  });

  it('maps direction field onto GrpcStreamEvent', () => {
    const normalized = normalizeGrpcTauriEvent(makeEvent({
      direction: 'outbound',
    }));
    expect(normalized?.direction).toBe('outbound');
  });

  it('returns null for schema version mismatch', () => {
    expect(normalizeGrpcTauriEvent(makeEvent({ schemaVersion: 999 }))).toBeNull();
  });

  it('rejects cross-tab and cross-stream events', () => {
    expect(shouldAcceptGrpcTauriEventForStream(makeEvent(), 'stream-1', 'tab-a', 0)).toBe(true);
    expect(shouldAcceptGrpcTauriEventForStream(makeEvent({ streamId: 'other' }), 'stream-1', 'tab-a', 0)).toBe(false);
    expect(shouldAcceptGrpcTauriEventForStream(makeEvent({ tabId: 'other' }), 'stream-1', 'tab-a', 0)).toBe(false);
  });

  it('rejects mismatched requestId when expectedRequestId is provided', () => {
    expect(shouldAcceptGrpcTauriEventForStream(makeEvent(), 'stream-1', 'tab-a', 0, 'req-1')).toBe(true);
    expect(shouldAcceptGrpcTauriEventForStream(makeEvent({ requestId: 'req-other' }), 'stream-1', 'tab-a', 0, 'req-1')).toBe(false);
  });

  it('deduplicates duplicate sequence numbers', () => {
    expect(shouldAcceptGrpcTauriEventForStream(makeEvent({ sequence: 1 }), 'stream-1', 'tab-a', 1)).toBe(false);
  });

  it('buffers and releases out-of-order events in sequence', () => {
    const buffer = new GrpcTauriEventSequenceBuffer(0);
    const first = normalizeGrpcTauriEvent(makeEvent({ sequence: 2 }))!;
    const second = normalizeGrpcTauriEvent(makeEvent({ sequence: 1 }))!;

    expect(buffer.accept(second)).toEqual([second]);
    expect(buffer.accept(first)).toEqual([first]);
    expect(buffer.getLastSequence()).toBe(2);
  });
});
