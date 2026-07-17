/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { mergeGrpcMockListenerLogs } from './grpcMockListenerLogMerge';

describe('mergeGrpcMockListenerLogs', () => {
  it('returns previous when incoming is empty', () => {
    const previous = [{ id: 1, method: 'Echo', status: 'ok' }];
    expect(mergeGrpcMockListenerLogs(previous, [])).toBe(previous);
  });

  it('dedupes by id and caps history', () => {
    const previous = [{ id: 1, method: 'A', status: 'ok' }];
    const incoming = [
      { id: 1, method: 'A-updated', status: 'ok' },
      { id: 2, method: 'B', status: 'ok' },
    ];
    const merged = mergeGrpcMockListenerLogs(previous, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.find((e) => e.id === 1)?.method).toBe('A-updated');
  });
});
