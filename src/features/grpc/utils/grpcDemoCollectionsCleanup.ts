/**
 * Demo Hub gRPC collections hygiene.
 * Removes saved-request artifacts that accumulate across repeated lesson runs.
 */
import { runGrpcCollectionMutation } from '../data/grpcCollectionRepository';

export interface GrpcDemoCollectionsPurgeResult {
  savedRequestsRemoved: number;
  collectionsTouched: number;
}

export interface GrpcDemoEmptyCollectionsPurgeResult {
  collectionsRemoved: number;
}

/**
 * Clear all saved requests from every gRPC collection.
 * Collections themselves are preserved so user-created folders remain visible.
 */
export async function purgeGrpcDemoSavedRequests(): Promise<GrpcDemoCollectionsPurgeResult> {
  let savedRequestsRemoved = 0;
  let collectionsTouched = 0;

  await runGrpcCollectionMutation((base) => {
    const next = structuredClone(base);
    const now = new Date().toISOString();
    let changed = false;

    next.collections = next.collections.map((collection) => {
      if (collection.savedRequests.length === 0) {
        return collection;
      }
      savedRequestsRemoved += collection.savedRequests.length;
      collectionsTouched += 1;
      changed = true;
      return {
        ...collection,
        savedRequests: [],
        updatedAt: now,
      };
    });

    if (changed) {
      next.updatedAt = now;
    }

    return {
      store: changed ? next : base,
      result: undefined,
    };
  });

  return {
    savedRequestsRemoved,
    collectionsTouched,
  };
}

/**
 * Remove empty collection shells created by demo lessons.
 * Only removes collections whose names match the provided list.
 */
export async function purgeEmptyGrpcDemoCollectionsByName(
  collectionNames: readonly string[],
): Promise<GrpcDemoEmptyCollectionsPurgeResult> {
  const targets = new Set(
    collectionNames
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  );
  if (targets.size === 0) return { collectionsRemoved: 0 };

  let collectionsRemoved = 0;

  await runGrpcCollectionMutation((base) => {
    const next = structuredClone(base);
    const before = next.collections.length;
    next.collections = next.collections.filter((collection) => (
      !(collection.savedRequests.length === 0 && targets.has(collection.name.trim()))
    ));
    collectionsRemoved = before - next.collections.length;
    if (collectionsRemoved === 0) {
      return { store: base, result: undefined };
    }
    next.updatedAt = new Date().toISOString();
    return { store: next, result: undefined };
  });

  return { collectionsRemoved };
}
