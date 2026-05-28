/**
 * SharedDsFetchAdapter — MapperAdapter<SharedDsFetchOutput>
 *
 * Purpose-built adapter for the Shared Data Source "Populate from API" flow.
 * Delegates to the shared `createBaseApiPopulateAdapter` factory.
 */

import type { DataSource, SharedDataSourceFetchConfig } from '../../../types';
import {
  createBaseApiPopulateAdapter,
  type ApiPopulateOutput,
  type ApiPopulateAdapter,
} from './baseApiPopulateAdapter';

// ─── Output type (re-export for backward compat) ─────────

export type SharedDsFetchOutput = ApiPopulateOutput;

// ─── Options ──────────────────────────────────────────────

export interface SharedDsFetchAdapterOptions {
  /** Existing data source (for column matching and baseline row values). */
  dataSource: DataSource;
  /** The fetch configuration driving the request. Used for adapter title/label context. */
  fetchConfig?: SharedDataSourceFetchConfig;
  /** Pre-fetched response JSON (set after the fetch step). */
  responseJson?: unknown;
  /** Which array path is selected (e.g. 'results' or '$'). */
  selectedArrayPath?: string;
  /** Append vs replace mode for rows. Default: 'append'. */
  mode?: 'append' | 'replace';
  /**
   * Live-fetch callback: returns the full parsed JSON response.
   * The adapter stores the full response internally for serialize to extract rows.
   */
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Helpers ──────────────────────────────────────────────

function buildAdapterTitle(fetchConfig?: SharedDataSourceFetchConfig): string {
  if (!fetchConfig?.url) return 'Shared DS API → Data Source';
  try {
    const u = new URL(fetchConfig.url, 'http://x');
    return `${fetchConfig.method ?? 'GET'} ${u.pathname} → Data Source`;
  } catch {
    return `${fetchConfig.method ?? 'GET'} API → Data Source`;
  }
}

// ─── Adapter Factory ──────────────────────────────────────

export function createSharedDsFetchAdapter(
  opts: SharedDsFetchAdapterOptions,
): ApiPopulateAdapter<SharedDsFetchOutput> {
  return createBaseApiPopulateAdapter<SharedDsFetchOutput>(
    {
      contextId: 'shared-ds-fetch',
      sourceId: 'shared-ds-response',
      sourceLabel: 'Shared DS API Response',
      title: buildAdapterTitle(opts.fetchConfig),
      deserializeIdPrefix: 'sdf-',
    },
    opts,
  );
}
