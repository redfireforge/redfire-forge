/**
 * Demo Hub GQL-9 (Collections & History) storage hygiene.
 * Removes lesson artifacts that accumulate in IndexedDB across repeated demo runs.
 */
import { idbClearHistory, idbLoadHistory } from '@shared/utils/idbGraphqlHistory';
import {
  idbDeleteCollection,
  idbDeleteItem,
  idbLoadCollections,
  idbLoadItems,
} from '@shared/utils/idbGraphqlCollections';
import { normalizeGraphqlEndpoint } from './graphqlEndpointUtils';

export const GQL_COLLECTIONS_RELOAD_EVENT = 'gql-collections-reload';
export const GQL_HISTORY_RELOAD_EVENT = 'gql-history-reload';

/** Saved operation names from GQL-9 Collections & History. */
export const GQL9_DEMO_ITEM_NAMES = ['Health Check', 'Lesson 8 Health'] as const;
/** Named collection from the import-restore step. */
export const GQL9_DEMO_COLLECTION_NAMES = ['Lesson 8 Collection'] as const;
/** Default name when the lesson clicks + without renaming. */
export const GQL9_OVERFLOW_COLLECTION_NAME = 'New Collection';

const GQL9_ITEM_NAME_SET = new Set<string>(GQL9_DEMO_ITEM_NAMES);
const GQL9_COLLECTION_NAME_SET = new Set<string>(GQL9_DEMO_COLLECTION_NAMES);

/** Loopback endpoint variants used as history connectionId in Studio. */
export function gqlDemoHistoryConnectionIds(): string[] {
  const canonical = normalizeGraphqlEndpoint('http://localhost:4010/graphql');
  return [...new Set([
    canonical,
    'http://localhost:4010/graphql',
    'http://127.0.0.1:4010/graphql',
    '{{graphqlUrl}}',
  ])];
}

export function dispatchGqlCollectionsReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_COLLECTIONS_RELOAD_EVENT));
  }
}

export function dispatchGqlHistoryReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_HISTORY_RELOAD_EVENT));
  }
}

export interface Gql9ArtifactPurgeResult {
  collectionsRemoved: number;
  itemsRemoved: number;
  historyEntriesRemoved: number;
}

function isGql9LessonItem(name: string): boolean {
  return GQL9_ITEM_NAME_SET.has(name);
}

/**
 * Delete GQL-9 lesson collection items and empty/lesson-only collections from IDB.
 * Safe to call before any GraphQL demo lesson (only touches known artifact names).
 */
export async function purgeGqlLesson9CollectionArtifacts(): Promise<Pick<Gql9ArtifactPurgeResult, 'collectionsRemoved' | 'itemsRemoved'>> {
  const collections = await idbLoadCollections();
  let collectionsRemoved = 0;
  let itemsRemoved = 0;

  for (const col of collections) {
    if (GQL9_COLLECTION_NAME_SET.has(col.name)) {
      const items = await idbLoadItems(col.id);
      await idbDeleteCollection(col.id);
      collectionsRemoved += 1;
      itemsRemoved += items.length;
      continue;
    }

    const items = await idbLoadItems(col.id);
    const lessonItems = items.filter((item) => isGql9LessonItem(item.name));
    for (const item of lessonItems) {
      await idbDeleteItem(item.id);
      itemsRemoved += 1;
    }

    const remainingCount = items.length - lessonItems.length;
    if (col.name === GQL9_OVERFLOW_COLLECTION_NAME && remainingCount === 0 && items.length > 0) {
      await idbDeleteCollection(col.id);
      collectionsRemoved += 1;
    }
  }

  dispatchGqlCollectionsReload();
  return { collectionsRemoved, itemsRemoved };
}

/** Clear execution history for demo GraphQL endpoints (GQL-9 health query log). */
export async function purgeGqlLesson9DemoHistory(): Promise<number> {
  let removed = 0;
  for (const connectionId of gqlDemoHistoryConnectionIds()) {
    const items = await idbLoadHistory(connectionId);
    if (items.length === 0) continue;
    await idbClearHistory(connectionId);
    removed += items.length;
  }
  dispatchGqlHistoryReload();
  return removed;
}

/** Full GQL-9 artifact purge — collections + history. */
export async function purgeGqlLesson9WorkspaceArtifacts(): Promise<Gql9ArtifactPurgeResult> {
  const { collectionsRemoved, itemsRemoved } = await purgeGqlLesson9CollectionArtifacts();
  const historyEntriesRemoved = await purgeGqlLesson9DemoHistory();
  return { collectionsRemoved, itemsRemoved, historyEntriesRemoved };
}
