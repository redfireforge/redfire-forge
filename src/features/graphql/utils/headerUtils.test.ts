/**
 * headerUtils.test.ts — unit tests for makeHeaderId.
 */

import { describe, it, expect } from 'vitest';
import { makeHeaderId } from './headerUtils';

describe('makeHeaderId', () => {
  it('returns a string starting with gql-hdr-', () => {
    expect(makeHeaderId()).toMatch(/^gql-hdr-\d+$/);
  });

  it('generates unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => makeHeaderId()));
    expect(ids.size).toBe(50);
  });

  it('IDs are always strings', () => {
    for (let i = 0; i < 5; i++) {
      expect(typeof makeHeaderId()).toBe('string');
    }
  });

  it('produces monotonically increasing numeric suffixes', () => {
    const a = Number(makeHeaderId().replace('gql-hdr-', ''));
    const b = Number(makeHeaderId().replace('gql-hdr-', ''));
    expect(b).toBeGreaterThan(a);
  });
});
