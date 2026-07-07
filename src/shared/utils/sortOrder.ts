export type WithSortOrder = {
  sortOrder: number;
};

export type WithPinnedSortOrder = WithSortOrder & {
  isPinned?: boolean;
};

export function compareBySortOrder<T extends WithSortOrder>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder;
}

export function sortBySortOrder<T extends WithSortOrder>(items: readonly T[]): T[] {
  return [...items].sort(compareBySortOrder);
}

export function compareByPinnedThenSortOrder<T extends WithPinnedSortOrder>(a: T, b: T): number {
  const aPinned = Boolean(a.isPinned);
  const bPinned = Boolean(b.isPinned);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  return a.sortOrder - b.sortOrder;
}

export function sortByPinnedThenSortOrder<T extends WithPinnedSortOrder>(items: readonly T[]): T[] {
  return [...items].sort(compareByPinnedThenSortOrder);
}