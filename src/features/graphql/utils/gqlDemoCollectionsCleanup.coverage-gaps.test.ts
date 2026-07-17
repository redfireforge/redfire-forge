/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dispatchGqlCollectionsReload,
  dispatchGqlHistoryReload,
  gqlDemoHistoryConnectionIds,
  purgeGqlLesson9CollectionArtifacts,
  purgeGqlLesson9DemoHistory,
  purgeGqlLesson9WorkspaceArtifacts,
  GQL9_OVERFLOW_COLLECTION_NAME,
} from './gqlDemoCollectionsCleanup';

vi.mock('../../../shared/utils/idbGraphqlHistory', () => ({
  idbLoadHistory: vi.fn(async () => [{ id: 'h1' }]),
  idbClearHistory: vi.fn(async () => {}),
}));

vi.mock('../../../shared/utils/idbGraphqlCollections', () => ({
  idbLoadCollections: vi.fn(async () => [
    { id: 'c1', name: 'Lesson 8 Collection' },
    { id: 'c2', name: GQL9_OVERFLOW_COLLECTION_NAME },
    { id: 'c3', name: 'Other' },
  ]),
  idbLoadItems: vi.fn(async (colId: string) => {
    if (colId === 'c1') return [{ id: 'i1', name: 'Health Check' }];
    if (colId === 'c2') return [{ id: 'i2', name: 'Health Check' }];
    if (colId === 'c3') return [{ id: 'i3', name: 'Health Check' }];
    return [];
  }),
  idbDeleteCollection: vi.fn(async () => {}),
  idbDeleteItem: vi.fn(async () => {}),
}));

import { idbClearHistory, idbLoadHistory } from '../../../shared/utils/idbGraphqlHistory';
import { idbDeleteCollection, idbDeleteItem } from '../../../shared/utils/idbGraphqlCollections';

describe('gqlDemoCollectionsCleanup — coverage gaps', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('gqlDemoHistoryConnectionIds includes canonical and template variants', () => {
    const ids = gqlDemoHistoryConnectionIds();
    expect(ids).toContain('http://localhost:4010/graphql');
    expect(ids).toContain('{{graphqlUrl}}');
  });

  it('dispatchGqlCollectionsReload and dispatchGqlHistoryReload fire events', () => {
    const colHandler = vi.fn();
    const histHandler = vi.fn();
    window.addEventListener('gql-collections-reload', colHandler);
    window.addEventListener('gql-history-reload', histHandler);
    dispatchGqlCollectionsReload();
    dispatchGqlHistoryReload();
    expect(colHandler).toHaveBeenCalled();
    expect(histHandler).toHaveBeenCalled();
    window.removeEventListener('gql-collections-reload', colHandler);
    window.removeEventListener('gql-history-reload', histHandler);
  });

  it('purgeGqlLesson9CollectionArtifacts removes lesson items from mixed collections', async () => {
    const { idbLoadCollections, idbLoadItems } = await import('../../../shared/utils/idbGraphqlCollections');
    vi.mocked(idbLoadCollections).mockResolvedValueOnce([
      { id: 'mix', name: 'Mixed Collection' },
    ] as never);
    vi.mocked(idbLoadItems).mockResolvedValueOnce([
      { id: 'i-lesson', name: 'Health Check' },
      { id: 'i-keep', name: 'Custom Query' },
    ] as never);
    const result = await purgeGqlLesson9CollectionArtifacts();
    expect(result.itemsRemoved).toBe(1);
    expect(idbDeleteItem).toHaveBeenCalledWith('i-lesson');
    expect(idbDeleteCollection).not.toHaveBeenCalledWith('mix');
  });

  it('purgeGqlLesson9CollectionArtifacts deletes overflow collection when only lesson items remain', async () => {
    const { idbLoadCollections, idbLoadItems } = await import('../../../shared/utils/idbGraphqlCollections');
    vi.mocked(idbLoadCollections).mockResolvedValueOnce([
      { id: 'overflow', name: GQL9_OVERFLOW_COLLECTION_NAME },
    ] as never);
    vi.mocked(idbLoadItems).mockResolvedValueOnce([
      { id: 'i1', name: 'Health Check' },
    ] as never);
    const result = await purgeGqlLesson9CollectionArtifacts();
    expect(result.collectionsRemoved).toBe(1);
    expect(idbDeleteCollection).toHaveBeenCalledWith('overflow');
  });

  it('purgeGqlLesson9CollectionArtifacts removes lesson collections and overflow', async () => {
    const result = await purgeGqlLesson9CollectionArtifacts();
    expect(result.collectionsRemoved).toBeGreaterThanOrEqual(2);
    expect(idbDeleteCollection).toHaveBeenCalled();
    expect(idbDeleteItem).toHaveBeenCalled();
  });

  it('purgeGqlLesson9DemoHistory clears demo endpoint history', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([{ id: 'h1' } as never, { id: 'h2' } as never]);
    const removed = await purgeGqlLesson9DemoHistory();
    expect(removed).toBeGreaterThan(0);
    expect(idbClearHistory).toHaveBeenCalled();
  });

  it('purgeGqlLesson9DemoHistory skips empty history buckets', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([]);
    expect(await purgeGqlLesson9DemoHistory()).toBe(0);
  });

  it('dispatch helpers no-op when window is undefined', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error test stub
    delete globalThis.window;
    expect(() => dispatchGqlCollectionsReload()).not.toThrow();
    expect(() => dispatchGqlHistoryReload()).not.toThrow();
    globalThis.window = originalWindow;
  });

  it('purgeGqlLesson9WorkspaceArtifacts combines collection and history purge', async () => {
    const result = await purgeGqlLesson9WorkspaceArtifacts();
    expect(result).toMatchObject({
      collectionsRemoved: expect.any(Number),
      itemsRemoved: expect.any(Number),
      historyEntriesRemoved: expect.any(Number),
    });
  });
});
