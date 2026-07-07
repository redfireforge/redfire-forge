import { describe, expect, it } from 'vitest';
import { prefixedRandomId, randomBase36Id } from './randomId';

describe('randomBase36Id', () => {
  it('returns requested length', () => {
    expect(randomBase36Id(8)).toHaveLength(8);
  });

  it('uses lowercase base36 characters', () => {
    expect(randomBase36Id(10)).toMatch(/^[a-z0-9]{10}$/);
  });
});

describe('prefixedRandomId', () => {
  it('prepends prefix and random suffix', () => {
    const id = prefixedRandomId('test-');
    expect(id).toMatch(/^test-[a-z0-9]{8}$/);
  });
});
