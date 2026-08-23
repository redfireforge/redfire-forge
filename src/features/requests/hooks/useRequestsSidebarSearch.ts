import { useCallback, useMemo, useState } from 'react';
import type { RequestCollection, RequestFolder } from '@shared/types';

export function useRequestsSidebarSearch(collections: RequestCollection[]) {
  const [search, setSearch] = useState('');

  const searchLower = useMemo(() => search.toLowerCase().trim(), [search]);

  const matchesSearch = useCallback(
    (
      col: RequestCollection,
      folders: RequestFolder[] | undefined,
      requests: { name: string; method: string; url: string }[],
    ): boolean => {
      if (!searchLower) return true;
      if (col.name.toLowerCase().includes(searchLower)) return true;
      if (
        requests.some(
          (r) =>
            r.name.toLowerCase().includes(searchLower) ||
            r.method.toLowerCase().includes(searchLower) ||
            r.url.toLowerCase().includes(searchLower),
        )
      )
        return true;
      const checkFolders = (flds?: RequestFolder[]): boolean => {
        if (!flds) return false;
        return flds.some(
          (f) =>
            f.name.toLowerCase().includes(searchLower) ||
            f.requests.some(
              (r) =>
                r.name.toLowerCase().includes(searchLower) ||
                r.method.toLowerCase().includes(searchLower) ||
                r.url.toLowerCase().includes(searchLower),
            ) ||
            checkFolders(f.folders),
        );
      };
      return checkFolders(folders);
    },
    [searchLower],
  );

  const folderMatchesSearch = useCallback(
    (folder: RequestFolder): boolean => {
      if (!searchLower) return true;
      if (folder.name.toLowerCase().includes(searchLower)) return true;
      if (
        folder.requests.some(
          (r) =>
            r.name.toLowerCase().includes(searchLower) ||
            r.method.toLowerCase().includes(searchLower) ||
            r.url.toLowerCase().includes(searchLower),
        )
      )
        return true;
      const checkFolders = (flds?: RequestFolder[]): boolean => {
        if (!flds) return false;
        return flds.some(
          (f) =>
            f.name.toLowerCase().includes(searchLower) ||
            f.requests.some(
              (r) =>
                r.name.toLowerCase().includes(searchLower) ||
                r.method.toLowerCase().includes(searchLower) ||
                r.url.toLowerCase().includes(searchLower),
            ) ||
            checkFolders(f.folders),
        );
      };
      return checkFolders(folder.folders);
    },
    [searchLower],
  );

  const requestMatchesSearch = useCallback(
    (r: { name: string; method: string; url: string }): boolean => {
      if (!searchLower) return true;
      return (
        r.name.toLowerCase().includes(searchLower) ||
        r.method.toLowerCase().includes(searchLower) ||
        r.url.toLowerCase().includes(searchLower)
      );
    },
    [searchLower],
  );

  const groupMatchesSearch = useCallback(
    (group: RequestCollection): boolean => {
      if (!searchLower) return true;
      if (group.name.toLowerCase().includes(searchLower)) return true;
      const children = collections.filter((c) => c.groupId === group.id);
      const checkGroup = (g: RequestCollection): boolean => {
        if (g.name.toLowerCase().includes(searchLower)) return true;
        const kids = collections.filter((c) => c.groupId === g.id);
        return kids.some((c) =>
          c.mode === 'group'
            ? checkGroup(c)
            : matchesSearch(c, c.folders, c.requests),
        );
      };
      return children.some((c) =>
        c.mode === 'group'
          ? checkGroup(c)
          : matchesSearch(c, c.folders, c.requests),
      );
    },
    [searchLower, collections, matchesSearch],
  );

  const filteredCollections = useMemo(() => {
    const roots = collections.filter((c) => (c.groupId ?? undefined) === undefined);
    if (!searchLower) return roots;
    return roots.filter((col) =>
      col.mode === 'group'
        ? groupMatchesSearch(col)
        : matchesSearch(col, col.folders, col.requests),
    );
  }, [collections, searchLower, groupMatchesSearch, matchesSearch]);

  return {
    search,
    setSearch,
    searchLower,
    matchesSearch,
    folderMatchesSearch,
    requestMatchesSearch,
    groupMatchesSearch,
    filteredCollections,
  };
}
