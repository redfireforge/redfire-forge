import { describe, expect, it } from 'vitest';
import { splitPathSegments } from './pathSegments';

describe('splitPathSegments', () => {
  it('returns non-empty segments only', () => {
    expect(splitPathSegments('/a//b/c/')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for blank path', () => {
    expect(splitPathSegments('')).toEqual([]);
  });
});
