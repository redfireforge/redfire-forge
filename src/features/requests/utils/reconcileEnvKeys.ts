import type { RequestsData, RequestCollection, RequestFolder } from '../../../shared/types';

export interface EnvKeyReconcileResult {
  data: RequestsData;
  changed: boolean;
  /** Legacy env names that had no matching Settings environment and were dropped. */
  droppedNames: string[];
}

type NamedEnv = { id: string; name: string };

/**
 * One-time reconcile of Requests data from the legacy Requests-local `RequestEnv` ID space
 * to the Settings (`Environment`) ID space.
 *
 * Historically `RequestsData.environments` held a separate env registry with its own UUIDs, and
 * all per-env keys (`collection.baseUrls`, `collection.authPerEnv`, `folder.baseUrls`,
 * `folder.selectedEnvId`, `data.selectedEnvId`) were keyed by those legacy IDs. The app now keys
 * everything off Settings env IDs. This remaps every key by **name**:
 *   legacy id → legacy name (from `data.environments`) → Settings id (from `appEnvironments`).
 *
 * Keys whose legacy name has no matching Settings env are **dropped** (their names are returned
 * so the caller can surface a one-time notice). Keys not present in the legacy list are passed
 * through unchanged (already Settings IDs, or unknown), which makes this idempotent: after a run
 * `data.environments` is emptied, so a second run is a no-op.
 */
export function reconcileRequestsEnvKeys(
  data: RequestsData,
  appEnvironments: NamedEnv[],
): EnvKeyReconcileResult {
  const legacy = data.environments ?? [];
  if (legacy.length === 0) {
    return { data, changed: false, droppedNames: [] };
  }

  const oldIdToName = new Map(legacy.map(e => [e.id, e.name]));
  const nameToNewId = new Map(appEnvironments.map(e => [e.name.toLowerCase(), e.id]));
  const dropped = new Set<string>();

  /** Returns the remapped id, or null when the key should be dropped. */
  const remapId = (oldId: string): string | null => {
    const name = oldIdToName.get(oldId);
    if (name === undefined) return oldId; // not a legacy id → already Settings id (or unknown)
    const newId = nameToNewId.get(name.toLowerCase());
    if (newId) return newId;
    dropped.add(name);
    return null;
  };

  const remapRecord = <T,>(rec: Record<string, T> | undefined): Record<string, T> | undefined => {
    if (!rec) return rec;
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(rec)) {
      const nk = remapId(k);
      if (nk !== null) out[nk] = v;
    }
    return out;
  };

  const remapFolder = (f: RequestFolder): RequestFolder => {
    const next: RequestFolder = { ...f };
    next.baseUrls = remapRecord(f.baseUrls);
    if (f.selectedEnvId) {
      const nk = remapId(f.selectedEnvId);
      next.selectedEnvId = nk ?? undefined;
    }
    if (f.folders) next.folders = f.folders.map(remapFolder);
    return next;
  };

  const remapCollection = (c: RequestCollection): RequestCollection => {
    const next: RequestCollection = { ...c };
    next.baseUrls = remapRecord(c.baseUrls);
    next.authPerEnv = remapRecord(c.authPerEnv);
    if (c.folders) next.folders = c.folders.map(remapFolder);
    return next;
  };

  const collections = data.collections.map(remapCollection);

  let selectedEnvId = data.selectedEnvId;
  if (selectedEnvId) {
    const nk = remapId(selectedEnvId);
    selectedEnvId = nk ?? undefined;
  }

  return {
    data: { ...data, collections, selectedEnvId, environments: undefined },
    changed: true,
    droppedNames: [...dropped],
  };
}
