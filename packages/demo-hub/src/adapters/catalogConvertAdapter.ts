/**
 * Catalog convert adapter — stable bridge surface for the Catalog convert lesson
 * (CAT / P4-E). Wraps the imperative `window.__demo*` catalog functions mounted by
 * the App shell hook `useDemoCatalogBridge` so lessons never touch product internals.
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

/** Remove a Catalog entry by display name (demo cleanup). No-op when absent. */
export function deleteCatalogEntryByName(name: string): void {
  getDemoBridgeWindow().__demoDeleteCatalogByName?.(name);
}

/** Select a Catalog entry by display name. Returns false when the bridge/entry is absent. */
export function selectCatalogEntryByName(name: string): boolean {
  return getDemoBridgeWindow().__demoSelectCatalogByName?.(name) ?? false;
}

/** True once the Catalog store has hydrated from storage. */
export function isCatalogLoaded(): boolean {
  return getDemoBridgeWindow().__demoCatalogLoaded === true;
}
