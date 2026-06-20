/**
 * @vitest-environment jsdom
 *
 * Tests for useGraphqlCollectionRun hook.
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/authUtils', () => ({
  buildAuthHeaders: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
}));

vi.mock('../utils/envUtils', () => ({
  resolveVars: vi.fn((val: string) => val),
}));

import { useGraphqlCollectionRun } from './useGraphqlCollectionRun';
import { buildAuthHeaders } from '../utils/authUtils';
import { resolveVars } from '../utils/envUtils';
import type { GraphqlCollectionItem, GraphqlCollection, GraphqlEnvironment } from '../../../shared/types/graphql';

const makeItem = (
  id: string,
  opts: Partial<GraphqlCollectionItem> = {},
): GraphqlCollectionItem => ({
  id,
  collectionId: 'col1',
  operation: { id, query: `query { ${id} }`, variables: '', operationType: 'query' },
  sortOrder: opts.sortOrder ?? 0,
  isPinned: opts.isPinned ?? false,
  folderId: opts.folderId ?? null,
  tags: [],
  ...opts,
});

const makeCollection = (id = 'col1'): GraphqlCollection => ({
  id,
  name: 'Test Collection',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const makeRunner = () => ({
  run: vi.fn(async () => {}),
  state: 'idle' as const,
  results: [],
  stop: vi.fn(),
  reset: vi.fn(),
  progress: null,
});

const makeEnv = (): GraphqlEnvironment => ({
  id: 'env1',
  name: 'Test Env',
  variables: [
    { key: 'BASE_URL', value: 'https://api.example.com', enabled: true },
    { key: 'disabled', value: 'nope', enabled: false },
    { key: '  ', value: 'blank-key', enabled: true },
  ],
});

describe('useGraphqlCollectionRun', () => {
  let runner: ReturnType<typeof makeRunner>;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = makeRunner();
    vi.mocked(buildAuthHeaders).mockReturnValue({ Authorization: 'Bearer test-token' });
    vi.mocked(resolveVars).mockImplementation((val: string) => val);
  });

  const baseArgs = (overrides = {}) => ({
    collectionTrees: [
      {
        collection: makeCollection('col1'),
        items: [makeItem('item1'), makeItem('item2')],
        folders: [],
      },
    ],
    endpoint: 'https://api.example.com/graphql',
    activeEnvironment: null as GraphqlEnvironment | null,
    activeTabHeaders: {},
    auth: null,
    runner,
    updateVariables: vi.fn(),
    onSetRunnerCollectionId: vi.fn(),
    onSetBottomTab: vi.fn(),
    onItemExecuted: vi.fn(),
    ...overrides,
  });

  it('does nothing when collection not found', () => {
    const args = baseArgs();
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('nonexistent');
    expect(args.onSetBottomTab).not.toHaveBeenCalled();
    expect(runner.run).not.toHaveBeenCalled();
  });

  it('sets runner collection id and bottom tab', async () => {
    const args = baseArgs();
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(args.onSetRunnerCollectionId).toHaveBeenCalledWith('col1');
      expect(args.onSetBottomTab).toHaveBeenCalledWith('runner');
    });
  });

  it('calls runner.run with all root items in sort order', async () => {
    const item1 = makeItem('a', { sortOrder: 2 });
    const item2 = makeItem('b', { sortOrder: 0 });
    const item3 = makeItem('c', { sortOrder: 1 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [item1, item2, item3],
          folders: [],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('places pinned items first', async () => {
    const pinned = makeItem('pinned', { sortOrder: 10, isPinned: true });
    const normal = makeItem('normal', { sortOrder: 0, isPinned: false });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [normal, pinned],
          folders: [],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items[0].id).toBe('pinned');
    expect(items[1].id).toBe('normal');
  });

  it('runs only the override item when itemOverride is provided', async () => {
    const override = makeItem('override');
    const args = baseArgs();
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1', undefined, override);
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('override');
  });

  it('collects folder items when folderId is provided', async () => {
    const item1 = makeItem('f-item1', { folderId: 'folder1', sortOrder: 0 });
    const item2 = makeItem('f-item2', { folderId: 'folder1', sortOrder: 1 });
    const rootItem = makeItem('root', { folderId: null, sortOrder: 0 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [rootItem, item1, item2],
          folders: [{ id: 'folder1', parentId: null, sortOrder: 0 }],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1', 'folder1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items.map((i) => i.id)).toEqual(['f-item1', 'f-item2']);
  });

  it('builds env vars snapshot from active environment (only enabled with non-blank keys)', async () => {
    const env = makeEnv();
    const args = baseArgs({ activeEnvironment: env });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { envVars } = runner.run.mock.calls[0][0] as { envVars: Record<string, string> };
    expect(envVars).toEqual({ BASE_URL: 'https://api.example.com' });
  });

  it('merges auth headers and tab headers', async () => {
    vi.mocked(buildAuthHeaders).mockReturnValue({ Authorization: 'Bearer tok' });
    const args = baseArgs({ activeTabHeaders: { 'X-Custom': 'val' } });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { headers } = runner.run.mock.calls[0][0] as { headers: Record<string, string> };
    expect(headers).toMatchObject({ Authorization: 'Bearer tok', 'X-Custom': 'val' });
  });

  it('onEnvUpdate creates new variable when key does not exist', async () => {
    const env = makeEnv();
    const updateVariables = vi.fn();
    const args = baseArgs({ activeEnvironment: env, updateVariables });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { onEnvUpdate } = runner.run.mock.calls[0][0] as { onEnvUpdate: (k: string, v: string) => void };
    onEnvUpdate('NEW_VAR', 'new-value');
    expect(updateVariables).toHaveBeenCalledWith(
      'env1',
      expect.arrayContaining([expect.objectContaining({ key: 'NEW_VAR', value: 'new-value', enabled: true })]),
    );
  });

  it('onEnvUpdate updates existing variable', async () => {
    const env = makeEnv();
    const updateVariables = vi.fn();
    const args = baseArgs({ activeEnvironment: env, updateVariables });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { onEnvUpdate } = runner.run.mock.calls[0][0] as { onEnvUpdate: (k: string, v: string) => void };
    onEnvUpdate('BASE_URL', 'https://new.example.com');
    expect(updateVariables).toHaveBeenCalledWith(
      'env1',
      expect.arrayContaining([expect.objectContaining({ key: 'BASE_URL', value: 'https://new.example.com' })]),
    );
  });

  it('onEnvUpdate does nothing when no active environment', async () => {
    const updateVariables = vi.fn();
    const args = baseArgs({ activeEnvironment: null, updateVariables });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { onEnvUpdate } = runner.run.mock.calls[0][0] as { onEnvUpdate: (k: string, v: string) => void };
    onEnvUpdate('KEY', 'value');
    expect(updateVariables).not.toHaveBeenCalled();
  });

  it('resolves endpoint via resolveVars', async () => {
    vi.mocked(resolveVars).mockImplementation((v, _env) => v === '{{EP}}/gql' ? 'https://resolved.com/gql' : v);
    const args = baseArgs({ endpoint: '{{EP}}/gql' });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { endpoint } = runner.run.mock.calls[0][0] as { endpoint: string };
    expect(endpoint).toBe('https://resolved.com/gql');
  });

  it('includes nested folder items recursively', async () => {
    const rootItem = makeItem('root', { folderId: null, sortOrder: 0 });
    const folderItem = makeItem('folder-item', { folderId: 'f1', sortOrder: 0 });
    const subFolderItem = makeItem('sub-item', { folderId: 'f2', sortOrder: 0 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [rootItem, folderItem, subFolderItem],
          folders: [
            { id: 'f1', parentId: null, sortOrder: 0 },
            { id: 'f2', parentId: 'f1', sortOrder: 0 },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    const ids = items.map((i) => i.id);
    expect(ids).toContain('root');
    expect(ids).toContain('folder-item');
    expect(ids).toContain('sub-item');
  });

  it('collects nested subfolder items when folderId targets parent folder', async () => {
    const parentItem = makeItem('parent-item', { folderId: 'f1', sortOrder: 0 });
    const childItem = makeItem('child-item', { folderId: 'f2', sortOrder: 0 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [parentItem, childItem],
          folders: [
            { id: 'f1', parentId: null, sortOrder: 0 },
            { id: 'f2', parentId: 'f1', sortOrder: 0 },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1', 'f1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items.map((i) => i.id)).toEqual(['parent-item', 'child-item']);
  });

  it('includes root folder items when running full collection', async () => {
    const rootItem = makeItem('root', { folderId: null, sortOrder: 0 });
    const folderItem = makeItem('in-folder', { folderId: 'f1', sortOrder: 0 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [rootItem, folderItem],
          folders: [{ id: 'f1', parentId: null, sortOrder: 0 }],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items.map((i) => i.id)).toEqual(['root', 'in-folder']);
  });

  it('swallows runner.run rejection without throwing', async () => {
    runner.run.mockRejectedValueOnce(new Error('run failed'));
    const args = baseArgs();
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    expect(() => result.current.handleRunCollection('col1')).not.toThrow();
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
  });

  it('sorts sibling subfolders by sortOrder when collecting folder items', async () => {
    const itemA = makeItem('item-a', { folderId: 'f2', sortOrder: 0 });
    const itemB = makeItem('item-b', { folderId: 'f3', sortOrder: 0 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [itemA, itemB],
          folders: [
            { id: 'f1', parentId: null, sortOrder: 0 },
            { id: 'f3', parentId: 'f1', sortOrder: 1 },
            { id: 'f2', parentId: 'f1', sortOrder: 0 },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1', 'f1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items.map((i) => i.id)).toEqual(['item-a', 'item-b']);
  });

  it('sorts root folders by sortOrder when running full collection', async () => {
    const item1 = makeItem('in-f2', { folderId: 'f2', sortOrder: 0 });
    const item2 = makeItem('in-f3', { folderId: 'f3', sortOrder: 0 });
    const args = baseArgs({
      collectionTrees: [
        {
          collection: makeCollection('col1'),
          items: [item1, item2],
          folders: [
            { id: 'f2', parentId: null, sortOrder: 1 },
            { id: 'f3', parentId: null, sortOrder: 0 },
          ],
        },
      ],
    });
    const { result } = renderHook(() => useGraphqlCollectionRun(args));
    result.current.handleRunCollection('col1');
    await vi.waitFor(() => {
      expect(runner.run).toHaveBeenCalledTimes(1);
    });
    const { items } = runner.run.mock.calls[0][0] as { items: GraphqlCollectionItem[] };
    expect(items.map((i) => i.id)).toEqual(['in-f3', 'in-f2']);
  });
});
