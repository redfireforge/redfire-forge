/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  attachBatchResultMeta,
  collectIncomingHttpHeaders,
  parseResult,
} from './batchRouteHelpers.js';

describe('batchRouteHelpers coverage gaps', () => {
  it('collectIncomingHttpHeaders lowercases keys and joins array values', () => {
    const headers = collectIncomingHttpHeaders({
      'Content-Type': 'application/json',
      'Set-Cookie': ['a=1', 'b=2'],
      'X-Empty': undefined,
    });
    expect(headers['content-type']).toBe('application/json');
    expect(headers['set-cookie']).toBe('a=1, b=2');
    expect(headers['x-empty']).toBeUndefined();
  });

  it('attachBatchResultMeta skips headers when empty and rejects negative latency', () => {
    const withEmptyHeaders = attachBatchResultMeta({ data: null }, 200, { headers: {} });
    expect(withEmptyHeaders._httpHeaders).toBeUndefined();

    const withNegativeLatency = attachBatchResultMeta({ data: null }, 200, { latencyMs: -1 });
    expect(withNegativeLatency._latencyMs).toBeUndefined();
  });

  it('parseResult omits meta when latency is not finite', () => {
    const result = parseResult('{"data":null}', 200, { latencyMs: Number.NaN });
    expect(result._latencyMs).toBeUndefined();
  });
});
