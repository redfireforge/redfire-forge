import { describe, expect, it, vi } from 'vitest';
import {
  appendGrpcStreamPendingBody,
  GRPC_STREAM_PENDING_QUEUE_CAP,
  previewGrpcStreamPendingBody,
  removeGrpcStreamPendingBodyAtIndex,
} from './grpcStreamPendingQueue';

describe('grpcStreamPendingQueue coverage gaps', () => {
  it('previewGrpcStreamPendingBody keeps short JSON intact', () => {
    expect(previewGrpcStreamPendingBody({ ok: true })).toBe('{"ok":true}');
  });

  it('previewGrpcStreamPendingBody truncates long JSON and handles stringify failures', () => {
    const long = { payload: 'x'.repeat(60) };
    expect(previewGrpcStreamPendingBody(long).endsWith('…')).toBe(true);

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('cycle');
    });
    expect(previewGrpcStreamPendingBody(circular)).toContain('[object Object]');
    vi.restoreAllMocks();
  });

  it('appendGrpcStreamPendingBody trims queue to cap', () => {
    const queue = Array.from({ length: GRPC_STREAM_PENDING_QUEUE_CAP }, (_, i) => ({ i }));
    const next = appendGrpcStreamPendingBody(queue, { fresh: true });
    expect(next).toHaveLength(GRPC_STREAM_PENDING_QUEUE_CAP);
    expect(next.at(-1)).toEqual({ fresh: true });
    expect(next[0]).toEqual({ i: 1 });
  });

  it('removeGrpcStreamPendingBodyAtIndex ignores invalid indexes', () => {
    const queue = [{ a: 1 }, { b: 2 }];
    expect(removeGrpcStreamPendingBodyAtIndex(queue, -1)).toBe(queue);
    expect(removeGrpcStreamPendingBodyAtIndex(queue, 99)).toBe(queue);
    expect(removeGrpcStreamPendingBodyAtIndex(queue, 0)).toEqual([{ b: 2 }]);
  });
});
