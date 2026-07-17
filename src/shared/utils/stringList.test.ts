import { describe, expect, it } from 'vitest';
import { parseCommaSeparatedList } from './stringList';

describe('parseCommaSeparatedList', () => {
  it('parses and trims comma-separated values', () => {
    expect(parseCommaSeparatedList('a, b,  c')).toEqual(['a', 'b', 'c']);
  });

  it('drops empty entries', () => {
    expect(parseCommaSeparatedList('a, , ,b,')).toEqual(['a', 'b']);
  });
});
