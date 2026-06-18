/**
 * multipartParser.test.ts
 *
 * Unit tests for applyPatch and parseMultipartMixed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyPatch, parseMultipartMixed } from './multipartParser';

// ─── applyPatch ───────────────────────────────────────────────────────────────

describe('applyPatch', () => {
  it('returns data directly when path is empty', () => {
    expect(applyPatch({ a: 1 }, [], { b: 2 })).toEqual({ b: 2 });
  });

  it('patches a top-level object key', () => {
    const base = { a: 1, b: 2 };
    const result = applyPatch(base, ['a'], 99);
    expect(result).toEqual({ a: 99, b: 2 });
  });

  it('patches a nested object key', () => {
    const base = { user: { name: 'Alice', age: 30 } };
    const result = applyPatch(base, ['user', 'name'], 'Bob');
    expect(result).toEqual({ user: { name: 'Bob', age: 30 } });
  });

  it('patches an array element by index', () => {
    const base = [1, 2, 3];
    const result = applyPatch(base, [1], 99);
    expect(result).toEqual([1, 99, 3]);
  });

  it('patches a nested array element', () => {
    const base = { orders: [{ id: 1 }, { id: 2 }] };
    const result = applyPatch(base, ['orders', 1, 'id'], 42);
    expect(result).toEqual({ orders: [{ id: 1 }, { id: 42 }] });
  });

  it('returns base unchanged when path key is number but base is not an array', () => {
    const base = { a: 1 };
    const result = applyPatch(base, [0], 'x');
    expect(result).toBe(base);
  });

  it('returns base unchanged when path key is string but base is not an object', () => {
    const base = 'not-an-object';
    const result = applyPatch(base, ['key'], 'x');
    expect(result).toBe(base);
  });

  it('returns base unchanged when path key is string but base is an array', () => {
    const base = [1, 2, 3];
    const result = applyPatch(base, ['key'], 'x');
    expect(result).toBe(base);
  });

  it('returns base unchanged when path key is string but base is null', () => {
    const result = applyPatch(null, ['key'], 'x');
    expect(result).toBeNull();
  });

  it('does not mutate the original base', () => {
    const base = { a: 1, b: { c: 2 } };
    const result = applyPatch(base, ['b', 'c'], 99);
    expect(base.b.c).toBe(2); // original unchanged
    expect((result as typeof base).b.c).toBe(99);
  });
});

// ─── parseMultipartMixed ──────────────────────────────────────────────────────

// Helper to build an async iterator that yields Part objects
function makeAsyncParts(parts: Array<{ json: boolean; body: unknown }>): AsyncIterable<{ json: boolean; body: unknown }> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const part of parts) yield part;
    },
  };
}

vi.mock('meros/browser', () => ({
  meros: vi.fn(),
}));

import { meros } from 'meros/browser';
const mockMeros = vi.mocked(meros);

describe('parseMultipartMixed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when meros returns the Response (not multipart)', async () => {
    const fakeResponse = {} as Response; // no Symbol.asyncIterator
    mockMeros.mockResolvedValue(fakeResponse as never);

    const onChunk = vi.fn();
    await parseMultipartMixed(fakeResponse, onChunk);
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('calls onChunk with the initial chunk', async () => {
    const parts = [
      { json: true, body: { data: { user: { id: 1 } }, hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'initial', patchIndex: 0, hasNext: false }),
    );
  });

  it('stops streaming when hasNext=false', async () => {
    const parts = [
      { json: true, body: { data: { a: 1 }, hasNext: false } },
      { json: true, body: { incremental: [{ path: ['a'], data: 99 }], hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    // Only the first chunk processed (hasNext:false ends loop after first)
    expect(onChunk).toHaveBeenCalledTimes(1);
  });

  it('applies incremental patches from subsequent chunks', async () => {
    const parts = [
      { json: true, body: { data: { user: { name: 'Alice' } }, hasNext: true } },
      { json: true, body: { incremental: [{ path: ['user', 'age'], data: 30 }], hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(2);
    const secondCall = onChunk.mock.calls[1][0];
    expect(secondCall.type).toBe('patch');
    expect(secondCall.patchIndex).toBe(1);
    expect((secondCall.merged as Record<string, unknown>).user).toEqual({ name: 'Alice', age: 30 });
  });

  it('skips non-JSON parts', async () => {
    const parts = [
      { json: false, body: '--boundary--' },
      { json: true, body: { data: { x: 1 }, hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0].type).toBe('initial');
  });

  it('skips null body parts', async () => {
    const parts = [
      { json: true, body: null },
      { json: true, body: { data: { x: 1 }, hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    // null body is skipped, next part becomes the initial chunk
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk.mock.calls[0][0].type).toBe('initial');
  });

  it('includes errors from the initial chunk', async () => {
    const errors = [{ message: 'Not found' }];
    const parts = [
      { json: true, body: { data: null, errors, hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    expect(onChunk.mock.calls[0][0].errors).toEqual(errors);
  });

  it('handles incremental chunk without path (defaults to empty path)', async () => {
    const parts = [
      { json: true, body: { data: { a: 1 }, hasNext: true } },
      { json: true, body: { incremental: [{ data: { b: 2 } }], hasNext: false } },
    ];
    mockMeros.mockResolvedValue(makeAsyncParts(parts) as never);

    const onChunk = vi.fn();
    await parseMultipartMixed({} as Response, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(2);
    // Empty path means data replaces merged entirely
    const secondCall = onChunk.mock.calls[1][0];
    expect(secondCall.merged).toEqual({ b: 2 });
  });
});
