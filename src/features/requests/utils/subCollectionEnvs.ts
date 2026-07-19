import type { RequestCollection, RequestFolder, Microservice } from '../../../shared/types';

export interface NamedEnv {
  id: string;
  name: string;
}

export interface SubColEnvOption {
  id: string;
  name: string;
}

/**
 * Resolve the per-environment base URLs configured for a multi-env collection, keyed by
 * **Settings environment ID**.
 *
 * - **Linked microservice** → the microservice's per-env base URLs (mapped by env name to the
 *   Settings env, mirroring `RequestEditor.resolvedColBaseUrls`).
 * - **None (manual)** → the collection's own `baseUrls`.
 * - **Non-multi-env collections** → empty (no per-env hostnames).
 */
export function resolveCollectionBaseUrls(
  collection: RequestCollection,
  environments: NamedEnv[],
  microservices: Microservice[] | undefined,
): Record<string, string> {
  if (collection.mode !== 'multi-env') return {};

  if (collection.microserviceId) {
    const svc = microservices?.find(s => s.id === collection.microserviceId);
    if (!svc) return {};
    const knownEnvs = [...environments, ...(svc.customEnvs ?? [])];
    const mapped: Record<string, string> = {};
    for (const [svcEnvId, url] of Object.entries(svc.baseUrls)) {
      if (!url) continue;
      const svcEnv = knownEnvs.find(e => e.id === svcEnvId);
      if (!svcEnv) continue;
      const env = environments.find(e => e.name === svcEnv.name);
      if (env) mapped[env.id] = url;
    }
    return mapped;
  }

  return collection.baseUrls ?? {};
}

/**
 * Environment IDs already bound to a sibling sub-collection at a given tree level. Used to enforce
 * **one sub-collection per environment**. Falls back to a name match for legacy sub-collections
 * that predate explicit `selectedEnvId`.
 */
export function usedSubColEnvIds(
  siblings: RequestFolder[],
  environments: NamedEnv[],
  excludeFolderId?: string,
): Set<string> {
  const used = new Set<string>();
  for (const f of siblings) {
    if (!f.isSubCollection) continue;
    if (excludeFolderId && f.id === excludeFolderId) continue;
    if (f.selectedEnvId) {
      used.add(f.selectedEnvId);
      continue;
    }
    const matched = environments.find(e => e.name.toLowerCase() === f.name.toLowerCase());
    if (matched) used.add(matched.id);
  }
  return used;
}

/** Flatten every sub-collection folder in a collection (any depth). */
export function collectSubCollections(folders: RequestFolder[]): RequestFolder[] {
  const out: RequestFolder[] = [];
  for (const f of folders) {
    if (f.isSubCollection) out.push(f);
    if (f.folders?.length) out.push(...collectSubCollections(f.folders));
  }
  return out;
}

/**
 * Env IDs bound to any sub-collection in the whole collection (used by the edit modal to enforce
 * one-per-env), optionally excluding the folder currently being edited.
 */
export function usedEnvIdsInCollection(
  collection: RequestCollection,
  environments: NamedEnv[],
  excludeFolderId?: string,
): Set<string> {
  return usedSubColEnvIds(collectSubCollections(collection.folders ?? []), environments, excludeFolderId);
}

/**
 * Compute the environments eligible for a **new** sub-collection under `collection` at the tree
 * level whose sibling folders are `siblings`:
 *
 * - Eligible = Settings envs that have a configured base URL for the collection
 *   (`resolveCollectionBaseUrls`).
 * - Minus envs already used by a sibling sub-collection (one-per-env).
 *
 * Order follows `environments`.
 */
export function computeEligibleSubColEnvs(
  collection: RequestCollection,
  siblings: RequestFolder[],
  environments: NamedEnv[],
  microservices: Microservice[] | undefined,
): SubColEnvOption[] {
  if (collection.mode !== 'multi-env') return [];
  const resolved = resolveCollectionBaseUrls(collection, environments, microservices);
  const used = usedSubColEnvIds(siblings, environments);
  return environments
    .filter(e => resolved[e.id] && !used.has(e.id))
    .map(e => ({ id: e.id, name: e.name }));
}
