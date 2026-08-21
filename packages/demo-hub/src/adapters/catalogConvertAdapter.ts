/**
 * Catalog adapter — stable bridge surface for Catalog demo lessons (CAT-*).
 * Wraps the imperative `window.__demo*` catalog functions mounted by the App
 * shell hook `useDemoCatalogBridge` so lessons never touch product internals.
 */
import { getDemoBridgeWindow } from './bridgeWindow';

/**
 * Seed a Swagger 2.0 spec as a Catalog entry (idempotent by display name).
 * Resolves the entry id, or `null` when the bridge is absent / parsing failed.
 */
export async function seedSwagger2CatalogEntry(name: string, rawSpec: string): Promise<string | null> {
  const fn = getDemoBridgeWindow().__demoSeedCatalogSwagger2;
  if (!fn) return null;
  return fn(name, rawSpec);
}

/**
 * Seed any OpenAPI / Swagger spec as a Catalog entry (idempotent by name).
 * The bridge uses `parseOpenApiSpec` internally, so this works for OpenAPI 3.x
 * as well as Swagger 2.0 — the bridge function name is a historical artifact.
 */
export async function seedCatalogEntry(name: string, rawSpec: string): Promise<string | null> {
  return seedSwagger2CatalogEntry(name, rawSpec);
}

/** Remove a Catalog entry by display name (demo cleanup). No-op when absent. */
export function deleteCatalogEntryByName(name: string): void {
  getDemoBridgeWindow().__demoDeleteCatalogByName?.(name);
}

/** Select a Catalog entry by display name. Returns false when the bridge/entry is absent. */
export function selectCatalogEntryByName(name: string): boolean {
  return getDemoBridgeWindow().__demoSelectCatalogByName?.(name) ?? false;
}

/** Add a new version to an existing Catalog entry (by name). Returns true on success. */
export async function addVersionByName(name: string, rawSpec: string): Promise<boolean> {
  const fn = getDemoBridgeWindow().__demoAddVersionByName;
  if (!fn) return false;
  return fn(name, rawSpec);
}

/** Look up a Catalog entry by display name. Returns the entry object or null. */
export function getCatalogEntryByName(name: string): Record<string, unknown> | null {
  return getDemoBridgeWindow().__demoGetCatalogEntryByName?.(name) ?? null;
}

/**
 * Quietly publish a Catalog endpoint for Workflow Designer (data-layer only).
 * Returns false when the bridge/entry/endpoint is absent.
 */
export function publishCatalogEndpointByName(
  entryName: string,
  method: string,
  path: string,
): boolean {
  return getDemoBridgeWindow().__demoPublishCatalogEndpoint?.(entryName, method, path) ?? false;
}

/** True once the Catalog store has hydrated from storage. */
export function isCatalogLoaded(): boolean {
  return getDemoBridgeWindow().__demoCatalogLoaded === true;
}

/**
 * Delete all request collections whose name matches exactly (case-insensitive).
 * Used by CAT-* lesson cleanup to remove orphaned exported collections.
 * Returns the number deleted, or 0 when the bridge is absent.
 */
export function deleteCollectionsByName(name: string): number {
  return getDemoBridgeWindow().__demoDeleteCollectionsByName?.(name) ?? 0;
}

export interface DemoSeedRequestItem {
  id?: string;
  name: string;
  method: string;
  url: string;
  body?: string;
}

/** Quiet seed of a Requests collection (idempotent by name). Returns the collection id. */
export function seedRequestCollection(name: string, requests: DemoSeedRequestItem[]): string | null {
  const fn = getDemoBridgeWindow().__demoSeedRequestCollection;
  if (!fn) return null;
  return fn(name, requests);
}

/** Remove all workflow preview endpoints from storage (demo cleanup). */
export async function clearAllWorkflowPreviews(): Promise<void> {
  await getDemoBridgeWindow().__demoClearAllWorkflowPreviews?.();
}
