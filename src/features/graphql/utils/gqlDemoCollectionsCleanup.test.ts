/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../shared/utils/idbGraphqlCollections', () => ({
  idbLoadCollections: vi.fn(),
  idbLoadItems: vi.fn(),
  idbDeleteCollection: vi.fn(),
  idbDeleteItem: vi.fn(),
}));

vi.mock('../../../shared/utils/idbGraphqlHistory', () => ({
  idbLoadHistory: vi.fn(),
  idbClearHistory: vi.fn(),
}));

import {
  idbDeleteCollection,
  idbDeleteItem,
  idbLoadCollections,
  idbLoadItems,
} from '@shared/utils/idbGraphqlCollections';
import { idbClearHistory, idbLoadHistory } from '@shared/utils/idbGraphqlHistory';
import {
  GQL_COLLECTIONS_RELOAD_EVENT,
  GQL_HISTORY_RELOAD_EVENT,
  purgeGqlLesson9CollectionArtifacts,
  purgeGqlLesson9DemoHistory,
  purgeGqlLesson9WorkspaceArtifacts,
} from './gqlDemoCollectionsCleanup';

describe('gqlDemoCollectionsCleanup', () => {
  beforeEach(() => {
    resetAllMocks();
    vi.mocked(idbLoadCollections).mockResolvedValue([]);
    vi.mocked(idbLoadHistory).mockResolvedValue([]);
  });

  it('purgeGqlLesson9CollectionArtifacts removes lesson items and empty New Collection', async () => {
    vi.mocked(idbLoadCollections).mockResolvedValue([
      { id: 'col-new', name: 'New Collection', variables: {}, createdAt: 0 },
      { id: 'col-lesson', name: 'Lesson 8 Collection', variables: {}, createdAt: 0 },
    ]);
    vi.mocked(idbLoadItems).mockImplementation(async (collectionId) => {
      if (collectionId === 'col-new') {
        return [
          { id: 'i1', collectionId, name: 'Health Check', sortOrder: 0, isPinned: false, tags: [], createdAt: 0, updatedAt: 0, operation: {} as never },
          { id: 'i2', collectionId, name: 'Health Check', sortOrder: 1, isPinned: false, tags: [], createdAt: 0, updatedAt: 0, operation: {} as never },
        ];
      }
      return [
        { id: 'i3', collectionId, name: 'Lesson 8 Health', sortOrder: 0, isPinned: false, tags: [], createdAt: 0, updatedAt: 0, operation: {} as never },
      ];
    });

    const result = await purgeGqlLesson9CollectionArtifacts();

    expect(idbDeleteItem).toHaveBeenCalledTimes(2);
    expect(idbDeleteCollection).toHaveBeenCalledWith('col-new');
    expect(idbDeleteCollection).toHaveBeenCalledWith('col-lesson');
    expect(result.itemsRemoved).toBe(3);
    expect(result.collectionsRemoved).toBe(2);
  });

  it('purgeGqlLesson9CollectionArtifacts dispatches collections reload event', async () => {
    const handler = vi.fn();
    window.addEventListener(GQL_COLLECTIONS_RELOAD_EVENT, handler);
    await purgeGqlLesson9CollectionArtifacts();
    window.removeEventListener(GQL_COLLECTIONS_RELOAD_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('purgeGqlLesson9DemoHistory clears history for demo endpoints', async () => {
    vi.mocked(idbLoadHistory).mockResolvedValue([
      { id: 'h1', connectionId: 'http://127.0.0.1:4010/graphql' } as never,
    ]);

    const removed = await purgeGqlLesson9DemoHistory();

    expect(idbClearHistory).toHaveBeenCalled();
    expect(removed).toBeGreaterThan(0);
  });

  it('purgeGqlLesson9DemoHistory dispatches history reload event', async () => {
    const handler = vi.fn();
    window.addEventListener(GQL_HISTORY_RELOAD_EVENT, handler);
    await purgeGqlLesson9DemoHistory();
    window.removeEventListener(GQL_HISTORY_RELOAD_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('purgeGqlLesson9WorkspaceArtifacts combines collection and history purge', async () => {
    vi.mocked(idbLoadCollections).mockResolvedValue([
      { id: 'col-lesson', name: 'Lesson 8 Collection', variables: {}, createdAt: 0 },
    ]);
    vi.mocked(idbLoadItems).mockResolvedValue([
      { id: 'i1', collectionId: 'col-lesson', name: 'Lesson 8 Health', sortOrder: 0, isPinned: false, tags: [], createdAt: 0, updatedAt: 0, operation: {} as never },
    ]);
    vi.mocked(idbLoadHistory).mockResolvedValue([{ id: 'h1' } as never]);

    const result = await purgeGqlLesson9WorkspaceArtifacts();

    expect(result.collectionsRemoved).toBe(1);
    expect(result.itemsRemoved).toBe(1);
    expect(result.historyEntriesRemoved).toBeGreaterThan(0);
  });
});
