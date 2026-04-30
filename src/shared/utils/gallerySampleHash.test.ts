import { describe, it, expect } from 'vitest';
import { gallerySampleHash } from './gallerySampleHash';

describe('gallerySampleHash', () => {
  it('returns a string', () => {
    expect(typeof gallerySampleHash({ a: 1 })).toBe('string');
  });

  it('returns consistent hash for same input', () => {
    const obj = { id: 'test', name: 'hello', items: [1, 2, 3] };
    expect(gallerySampleHash(obj)).toBe(gallerySampleHash(obj));
  });

  it('returns different hashes for different inputs', () => {
    expect(gallerySampleHash({ a: 1 })).not.toBe(gallerySampleHash({ a: 2 }));
  });

  it('handles string input', () => {
    expect(typeof gallerySampleHash('hello world')).toBe('string');
  });

  it('handles null input', () => {
    expect(typeof gallerySampleHash(null)).toBe('string');
  });

  it('handles array input', () => {
    expect(typeof gallerySampleHash([1, 2, 3])).toBe('string');
  });

  it('handles empty object', () => {
    expect(typeof gallerySampleHash({})).toBe('string');
  });

  it('produces different hashes for objects differing by one key', () => {
    const a = { name: 'foo', count: 1 };
    const b = { name: 'foo', count: 2 };
    expect(gallerySampleHash(a)).not.toBe(gallerySampleHash(b));
  });
});
