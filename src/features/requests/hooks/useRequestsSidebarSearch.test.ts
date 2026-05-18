/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RequestCollection, RequestFolder, RequestItem } from '../../../shared/types';
import { useRequestsSidebarSearch } from './useRequestsSidebarSearch';

function makeReq(overrides: Partial<RequestItem> = {}): RequestItem {
  return {
    id: 'req-default',
    name: 'Request',
    method: 'GET',
    url: '/api',
    headers: [],
    body: '',
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeDirectCol(
  id: string,
  name: string,
  opts?: {
    requests?: RequestItem[];
    folders?: RequestFolder[];
    groupId?: string;
  },
): RequestCollection {
  const { requests = [], folders, groupId } = opts ?? {};
  return {
    id,
    name,
    mode: 'direct',
    requests,
    ...(folders !== undefined ? { folders } : {}),
    ...(groupId !== undefined ? { groupId } : {}),
  };
}

function makeGroupCol(id: string, name: string, opts?: { groupId?: string }): RequestCollection {
  const { groupId } = opts ?? {};
  return {
    id,
    name,
    mode: 'group',
    requests: [],
    ...(groupId !== undefined ? { groupId } : {}),
  };
}

describe('useRequestsSidebarSearch', () => {
  it('starts with empty search and exposes searchLower trimmed from search', () => {
    const { result } = renderHook(() =>
      useRequestsSidebarSearch([makeDirectCol('c1', 'Coll', { requests: [makeReq()] })]),
    );
    expect(result.current.search).toBe('');
    expect(result.current.searchLower).toBe('');

    act(() => result.current.setSearch('  TOKEN  '));
    expect(result.current.search).toBe('  TOKEN  ');
    expect(result.current.searchLower).toBe('token');
  });

  describe('filteredCollections memo', () => {
    it('lists only roots (no groupId) and passes through all roots when search is empty', () => {
      const child = makeDirectCol('child', 'Child', {
        requests: [],
        groupId: 'parent',
      });
      const parent = makeDirectCol('parent', 'Parent', {
        requests: [makeReq({ id: 'r1', name: 'Ping' })],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([parent, child]));

      expect(result.current.filteredCollections).toEqual([parent]);
    });

    it('updates when collections prop changes', () => {
      const initial = makeDirectCol('a', 'Alpha');
      const { result, rerender } = renderHook(({ cols }: { cols: RequestCollection[] }) => useRequestsSidebarSearch(cols), {
        initialProps: { cols: [initial] },
      });
      expect(result.current.filteredCollections).toHaveLength(1);

      rerender({
        cols: [initial, makeDirectCol('b', 'Beta')],
      });
      expect(result.current.filteredCollections.map((c) => c.id)).toEqual(['a', 'b']);
    });

    it('reflects whitespace-only search as empty filter (shows all roots)', () => {
      const c = makeDirectCol('root', 'Root', {
        requests: [makeReq({ name: 'X' })],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([c]));

      act(() => result.current.setSearch('   \t'));
      expect(result.current.searchLower).toBe('');
      expect(result.current.filteredCollections).toHaveLength(1);
    });

    it('filters out non-matching direct collections', () => {
      const alpha = makeDirectCol('a', 'Alpha', {
        requests: [makeReq({ name: 'a1', url: '/a' })],
      });
      const beta = makeDirectCol('b', 'Beta', {
        requests: [makeReq({ name: 'b1', url: '/b', id: 'b1' })],
      });

      const { result } = renderHook(() => useRequestsSidebarSearch([alpha, beta]));
      act(() => result.current.setSearch('ALPHA'));

      expect(result.current.filteredCollections.map((x) => x.id)).toEqual(['a']);
    });

    it('filters group roots via groupMatchesSearch', () => {
      const grp = makeGroupCol('g1', 'Services');
      const leaf = makeDirectCol('leaf', 'Leaf', {
        groupId: 'g1',
        requests: [makeReq({ id: 'l1', name: 'Echo', url: '/echo' })],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([grp, leaf]));

      act(() => result.current.setSearch('ECHO'));
      expect(result.current.filteredCollections.map((x) => x.id)).toEqual(['g1']);
    });

    it('shows group root when a member leaf matches (child not in filtered roots)', () => {
      const grp = makeGroupCol('g1', 'ParentGroup');
      const leaf = makeDirectCol('leaf', 'Irrelevant', {
        groupId: 'g1',
        requests: [makeReq({ id: 'l1', name: 'needle', url: '/x' })],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([grp, leaf]));

      act(() => result.current.setSearch('needle'));
      expect(result.current.filteredCollections.map((x) => x.id)).toEqual(['g1']);
    });

    it('removes roots with no subtree match for active search', () => {
      const only = makeDirectCol('solo', 'Solo', {
        requests: [makeReq({ name: 'zzz' })],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([only]));

      act(() => result.current.setSearch('nomatchhere'));
      expect(result.current.filteredCollections).toHaveLength(0);
    });
  });

  describe('matchesSearch', () => {
    const col = makeDirectCol('c1', 'Payment API', {
      folders: [],
    });

    it('returns true when searchLower is empty', () => {
      const { result } = renderHook(() => useRequestsSidebarSearch([col]));
      expect(result.current.matchesSearch(col, [], [])).toBe(true);
      expect(result.current.matchesSearch(col, undefined, [])).toBe(true);
    });

    it('matches collection name case-insensitively', () => {
      const { result } = renderHook(() => useRequestsSidebarSearch([col]));
      act(() => result.current.setSearch('PAY'));
      expect(result.current.matchesSearch(col, [], [])).toBe(true);
    });

    it('matches flat requests by name, method, or url before folders', () => {
      const { result } = renderHook(() =>
        useRequestsSidebarSearch([
          makeDirectCol('x', 'X', {
            folders: [{ id: 'f', name: 'ignore', requests: [], folders: [] }],
            requests: [
              makeReq({ id: '1', name: 'nope', method: 'GET', url: 'https://ex.com/users' }),
            ],
          }),
        ]),
      );
      act(() => result.current.setSearch('users'));

      expect(
        result.current.matchesSearch(makeDirectCol('x', 'X', {}), [{ id: 'f', name: 'ignore', requests: [], folders: [] }], [
          makeReq({ id: '1', name: 'nope', method: 'GET', url: 'https://ex.com/users' }),
        ]),
      ).toBe(true);
    });

    it('falls back to recursive folder traversal', () => {
      const nestedFolders: RequestFolder[] = [
        {
          id: 'outer',
          name: 'outer',
          requests: [],
          folders: [
            {
              id: 'inner',
              name: 'inner-vault',
              requests: [],
            },
          ],
        },
      ];
      const { result } = renderHook(() =>
        useRequestsSidebarSearch([makeDirectCol('c', 'C', { requests: [], folders: nestedFolders })]),
      );
      act(() => result.current.setSearch('vault'));
      expect(result.current.matchesSearch(makeDirectCol('c', 'C', {}), nestedFolders, [])).toBe(true);
    });

    it('matches a request buried in nested folders', () => {
      const folders: RequestFolder[] = [
        {
          id: 'depth1',
          name: 'layer1',
          requests: [],
          folders: [{ id: 'depth2', name: 'layer2', requests: [makeReq({ id: 'r', name: 'deep-hit', url: '/', method: 'POST' })] }],
        },
      ];
      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders })]));

      act(() => result.current.setSearch('deep'));
      expect(result.current.matchesSearch(makeDirectCol('c', 'C'), folders, [])).toBe(true);
    });

    it('returns false when nothing matches', () => {
      const folders: RequestFolder[] = [{ id: 'f1', name: 'empty', requests: [] }];
      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'Bare', { folders })]));

      act(() => result.current.setSearch('zz'));
      expect(
        result.current.matchesSearch(
          makeDirectCol('c', 'Bare'),
          folders,
          [makeReq({ name: 'a', url: '/a', method: 'GET', id: 'a' })],
        ),
      ).toBe(false);
    });

    it('matches request method substring', () => {
      const { result } = renderHook(() => useRequestsSidebarSearch([col]));
      act(() => result.current.setSearch('pos')); // POST
      expect(result.current.matchesSearch(col, [], [makeReq({ id: '1', name: 'n', url: '/', method: 'POST' })])).toBe(
        true,
      );
    });
  });

  describe('folderMatchesSearch', () => {
    const emptyFolder = (): RequestFolder => ({ id: 'e', name: 'empty-folder', requests: [] });

    it('returns true when searchLower is empty', () => {
      const { result } = renderHook(() =>
        useRequestsSidebarSearch([
          makeDirectCol('x', 'X', {
            folders: [emptyFolder()],
          }),
        ]),
      );
      expect(result.current.folderMatchesSearch(emptyFolder())).toBe(true);
    });

    it('matches folder name', () => {
      const folder: RequestFolder = { id: 'f', name: 'Accounts', requests: [] };
      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders: [folder] })]));

      act(() => result.current.setSearch('acco'));
      expect(result.current.folderMatchesSearch(folder)).toBe(true);
    });

    it('matches immediate folder.requests by URL when name and method do not match substring', () => {
      const folder: RequestFolder = {
        id: 'f',
        name: 'F',
        requests: [
          makeReq({
            id: 'r',
            name: 'Other',
            method: 'GET',
            url: 'https://api.example/obscure/needle-path',
          }),
        ],
      };
      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders: [folder] })]));

      act(() => result.current.setSearch('needle-path'));
      expect(result.current.folderMatchesSearch(folder)).toBe(true);
    });

    it('matches a request directly on the folder', () => {
      const folder: RequestFolder = {
        id: 'f',
        name: 'F',
        requests: [makeReq({ id: 'r', name: 'find-me', url: '/', method: 'GET' })],
      };
      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders: [folder] })]));

      act(() => result.current.setSearch('FIND'));
      expect(result.current.folderMatchesSearch(folder)).toBe(true);
    });

    it('recursively matches nested subfolders', () => {
      const child: RequestFolder = { id: 'ch', name: 'child-slot', requests: [] };
      const parent: RequestFolder = { id: 'p', name: 'parent', requests: [], folders: [child] };

      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders: [parent] })]));

      act(() => result.current.setSearch('slot'));
      expect(result.current.folderMatchesSearch(parent)).toBe(true);
    });

    it('matches nested folder request via checkFolders', () => {
      const nested: RequestFolder = {
        id: 'nested',
        name: 'nested',
        requests: [makeReq({ id: 'x', name: 'leaf', url: '/z', method: 'DELETE' })],
      };
      const top: RequestFolder = { id: 'top', name: 'top', requests: [], folders: [nested] };

      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders: [top] })]));

      act(() => result.current.setSearch('delete'));
      expect(result.current.folderMatchesSearch(top)).toBe(true);
    });

    it('returns false when subtree has no match', () => {
      const folder: RequestFolder = {
        id: 'outer',
        name: 'Outer',
        requests: [],
        folders: [{ id: 'inner', name: 'Inner', requests: [] }],
      };
      const { result } = renderHook(() => useRequestsSidebarSearch([makeDirectCol('c', 'C', { folders: [folder] })]));

      act(() => result.current.setSearch('zzz'));
      expect(result.current.folderMatchesSearch(folder)).toBe(false);
    });
  });

  describe('requestMatchesSearch', () => {
    const req = makeReq({
      id: 'r',
      name: 'Create User',
      method: 'PUT',
      url: 'https://api.example/v1/create',
    });

    it('returns true when searchLower is empty', () => {
      const { result } = renderHook(() => useRequestsSidebarSearch([]));
      expect(result.current.requestMatchesSearch(req)).toBe(true);
    });

    it('matches name / method / url case-insensitively', () => {
      const { result } = renderHook(() => useRequestsSidebarSearch([]));

      act(() => result.current.setSearch('USER'));
      expect(result.current.requestMatchesSearch(req)).toBe(true);

      act(() => result.current.setSearch('put'));
      expect(result.current.requestMatchesSearch(req)).toBe(true);

      act(() => result.current.setSearch('CREATE'));
      expect(result.current.requestMatchesSearch(req)).toBe(true);
    });

    it('returns false when no field matches', () => {
      const { result } = renderHook(() => useRequestsSidebarSearch([]));
      act(() => result.current.setSearch('nope'));

      expect(result.current.requestMatchesSearch(req)).toBe(false);
    });
  });

  describe('groupMatchesSearch', () => {
    it('returns true when searchLower is empty', () => {
      const group = makeGroupCol('g', 'Grp');
      const { result } = renderHook(() => useRequestsSidebarSearch([group]));

      expect(result.current.groupMatchesSearch(group)).toBe(true);
    });

    it('matches group name alone', () => {
      const group = makeGroupCol('root-g', 'Product Suite');
      const leaf = makeDirectCol('leaf', 'Hidden', {
        groupId: 'root-g',
        requests: [],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([group, leaf]));

      act(() => result.current.setSearch('suite'));
      expect(result.current.groupMatchesSearch(group)).toBe(true);
    });

    it('matches when a leaf collection under the group has a matching root request', () => {
      const group = makeGroupCol('g', 'Grp');
      const leaf = makeDirectCol('leaf', 'Svc', {
        groupId: 'g',
        requests: [makeReq({ id: '1', name: 'Health', url: '/health', method: 'GET' })],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([group, leaf]));

      act(() => result.current.setSearch('health'));
      expect(result.current.groupMatchesSearch(group)).toBe(true);
    });

    it('matches via nested subgroup (checkGroup recursion)', () => {
      const root = makeGroupCol('root', 'Tenant');
      const mid = makeGroupCol('mid', 'Backend', { groupId: 'root' });
      const leaf = makeDirectCol('leaf', 'Orders', {
        groupId: 'mid',
        requests: [makeReq({ id: 'o1', name: 'Place', url: '/orders/placement', method: 'POST' })],
      });

      const { result } = renderHook(() => useRequestsSidebarSearch([root, mid, leaf]));

      act(() => result.current.setSearch('PLACE'));
      expect(result.current.groupMatchesSearch(root)).toBe(true);

      act(() => result.current.setSearch('tenant'));
      expect(result.current.groupMatchesSearch(root)).toBe(true);
    });

    it('nested group child name match triggers ancestor groupMatchesSearch', () => {
      const root = makeGroupCol('root', 'Outer');
      const inner = makeGroupCol('mid', 'SpecialArea', { groupId: 'root' });
      const leaf = makeDirectCol('leaf', 'LeafOnly', {
        groupId: 'mid',
        requests: [],
      });
      const { result } = renderHook(() => useRequestsSidebarSearch([root, inner, leaf]));

      act(() => result.current.setSearch('special'));
      expect(result.current.groupMatchesSearch(root)).toBe(true);
    });

    it('matches requests in a multi-env child via matchesSearch limb (non-group mode)', () => {
      const group = makeGroupCol('root', 'APIs');
      const envCol = {
        ...makeDirectCol('m1', 'MultiCol', {
          groupId: 'root',
          requests: [makeReq({ id: 'q', name: 'Query', url: '/search', method: 'GET' })],
        }),
        mode: 'multi-env' as const,
      };

      const { result } = renderHook(() => useRequestsSidebarSearch([group, envCol]));

      act(() => result.current.setSearch('SEARCH'));
      expect(result.current.groupMatchesSearch(group)).toBe(true);

      act(() => result.current.setSearch('SEARCH'));
      expect(result.current.filteredCollections.map((x) => x.id)).toEqual(['root']);
    });

    it('still matches when sibling subgroup has no hits but leaf sibling does', () => {
      const root = makeGroupCol('root', 'Svc');
      const deadBranch = makeGroupCol('dead', 'EmptyBranch', { groupId: 'root' });
      const deadLeaf = makeDirectCol('dead-leaf', 'NoMatch', {
        groupId: 'dead',
        requests: [makeReq({ id: 'd', name: 'x', url: '/x', method: 'GET' })],
      });
      const goodLeaf = makeDirectCol('good', 'Svc', {
        groupId: 'root',
        requests: [makeReq({ id: 'g', name: 'recovery', url: '/r', method: 'POST' })],
      });

      const { result } = renderHook(() => useRequestsSidebarSearch([root, deadBranch, deadLeaf, goodLeaf]));

      act(() => result.current.setSearch('recovery'));
      expect(result.current.groupMatchesSearch(root)).toBe(true);
    });

    it('returns false when no descendant matches', () => {
      const group = makeGroupCol('g', 'Grp');
      const leaf = makeDirectCol('leaf', 'Leaf', {
        groupId: 'g',
        requests: [makeReq({ id: '1', name: 'A', url: '/a', method: 'GET' })],
      });

      const { result } = renderHook(() => useRequestsSidebarSearch([group, leaf]));

      act(() => result.current.setSearch('zzz'));
      expect(result.current.groupMatchesSearch(group)).toBe(false);
    });
  });
});
