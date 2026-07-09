import { describe, expect, it } from 'vitest';
import {
  compareByPinnedThenSortOrder,
  compareBySortOrder,
  sortByPinnedThenSortOrder,
  sortBySortOrder,
} from './sortOrder';

describe('sortOrder helpers', () => {
  it('sortBySortOrder returns ascending sortOrder without mutating input', () => {
    const input = [
      { id: 'b', sortOrder: 2 },
      { id: 'a', sortOrder: 1 },
      { id: 'c', sortOrder: 3 },
    ];

    const output = sortBySortOrder(input);

    expect(output.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(input.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('sortByPinnedThenSortOrder prioritizes pinned entries', () => {
    const input = [
      { id: 'c', isPinned: false, sortOrder: 0 },
      { id: 'a', isPinned: true, sortOrder: 5 },
      { id: 'b', isPinned: true, sortOrder: 2 },
    ];

    const output = sortByPinnedThenSortOrder(input);

    expect(output.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('compare helpers expose stable comparator behavior', () => {
    expect(compareBySortOrder({ sortOrder: 1 }, { sortOrder: 2 })).toBeLessThan(0);
    expect(compareByPinnedThenSortOrder(
      { isPinned: true, sortOrder: 99 },
      { isPinned: false, sortOrder: 1 },
    )).toBeLessThan(0);
  });

  it('compareByPinnedThenSortOrder falls back to sortOrder when pin state matches', () => {
    expect(compareByPinnedThenSortOrder(
      { isPinned: false, sortOrder: 4 },
      { isPinned: false, sortOrder: 9 },
    )).toBeLessThan(0);

    // Undefined pin state is treated as unpinned.
    expect(compareByPinnedThenSortOrder(
      { sortOrder: 10 },
      { isPinned: false, sortOrder: 3 },
    )).toBeGreaterThan(0);

    expect(compareByPinnedThenSortOrder(
      { isPinned: false, sortOrder: 1 },
      { isPinned: true, sortOrder: 99 },
    )).toBeGreaterThan(0);
  });
});
