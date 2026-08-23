import { describe, expect, it } from 'vitest';
import { GRPC_STREAM_MESSAGE_CAP } from '@shared/grpc/contracts';
import { appendGrpcStreamLogEntry, countGrpcStreamDirections, grpcStreamEventToLogEntry } from './grpcStreamLogUtils';

describe('grpcStreamLogUtils', () => {
  it('appends entries with monotonic sequence', () => {
    const first = appendGrpcStreamLogEntry([], {
      sequence: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      direction: 'inbound',
      data: { message: 'a' },
    }, 0);
    expect(first?.lastSequence).toBe(1);
    expect(first?.messages).toHaveLength(1);

    const dup = appendGrpcStreamLogEntry(first!.messages, {
      sequence: 1,
      timestamp: '2026-01-01T00:00:00.001Z',
      direction: 'inbound',
      data: { message: 'dup' },
    }, first!.lastSequence);
    expect(dup).toBeNull();
  });

  it('trims log to GRPC_STREAM_MESSAGE_CAP', () => {
    let messages: import('../../../shared/grpc/contracts').GrpcStreamLogEntry[] = [];
    let lastSequence = 0;
    for (let i = 1; i <= GRPC_STREAM_MESSAGE_CAP + 5; i += 1) {
      const result = appendGrpcStreamLogEntry(messages, {
        sequence: i,
        timestamp: '2026-01-01T00:00:00.000Z',
        direction: 'inbound',
        data: { n: i },
      }, lastSequence);
      messages = result!.messages;
      lastSequence = result!.lastSequence;
    }
    expect(messages).toHaveLength(GRPC_STREAM_MESSAGE_CAP);
    expect(messages[0]?.sequence).toBe(6);
  });

  it('grpcStreamEventToLogEntry maps grpc-message events only', () => {
    expect(grpcStreamEventToLogEntry({
      type: 'grpc-end',
      sequence: 1,
      timestamp: '2026-01-01T00:00:00.000Z',
      status: 0,
    })).toBeNull();

    expect(grpcStreamEventToLogEntry({
      type: 'grpc-message',
      sequence: 2,
      timestamp: '2026-01-01T00:00:00.000Z',
    })).toBeNull();

    const entry = grpcStreamEventToLogEntry({
      type: 'grpc-message',
      sequence: 3,
      timestamp: '2026-01-01T00:00:00.000Z',
      direction: 'outbound',
      data: { message: 'hi' },
    });
    expect(entry).toEqual({
      sequence: 3,
      timestamp: '2026-01-01T00:00:00.000Z',
      direction: 'outbound',
      data: { message: 'hi' },
    });
  });

  it('grpcStreamEventToLogEntry rejects grpc-message events without direction or data independently', () => {
    expect(grpcStreamEventToLogEntry({
      type: 'grpc-message',
      sequence: 4,
      timestamp: '2026-01-01T00:00:00.000Z',
      direction: 'inbound',
    })).toBeNull();

    expect(grpcStreamEventToLogEntry({
      type: 'grpc-message',
      sequence: 5,
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { message: 'missing direction' },
    })).toBeNull();
  });

  it('countGrpcStreamDirections tallies inbound and outbound rows', () => {
    const counts = countGrpcStreamDirections([
      { sequence: 1, timestamp: 't', direction: 'inbound', data: {} },
      { sequence: 2, timestamp: 't', direction: 'outbound', data: {} },
      { sequence: 3, timestamp: 't', direction: 'inbound', data: {} },
    ]);
    expect(counts).toEqual({ inbound: 2, outbound: 1 });
  });

  it('countGrpcStreamDirections treats non-inbound rows as outbound', () => {
    const counts = countGrpcStreamDirections([
      { sequence: 1, timestamp: 't', direction: 'outbound', data: {} },
      { sequence: 2, timestamp: 't', direction: 'outbound', data: {} },
    ]);
    expect(counts).toEqual({ inbound: 0, outbound: 2 });
  });
});
