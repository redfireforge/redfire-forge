/**
 * PopulateFromApiAdapter — MapperAdapter<PopulateOutput>
 *
 * Bridges the Data Mapper to the "Populate from API" flow.
 * Source: single 'api-response' source built from fetched API response JSON.
 * Target: data source column definitions with name, type, and mapping.
 *
 * Delegates to the shared `createBaseApiPopulateAdapter` factory.
 */

import type { DataSource } from '../../../types';
import {
  createBaseApiPopulateAdapter,
  type ApiPopulateOutput,
  type ApiPopulateAdapter,
} from './baseApiPopulateAdapter';

// ─── Output type (re-export for backward compat) ─────────

export type PopulateOutput = ApiPopulateOutput;

// ─── Options ──────────────────────────────────────────────

export interface PopulateFromApiAdapterOptions {
  /** Existing data source (for column matching and baseline row values). */
  dataSource: DataSource;
  /** Pre-fetched response JSON (set after the fetch step). */
  responseJson?: unknown;
  /** Which array path is selected (e.g. 'results' or '$'). */
  selectedArrayPath?: string;
  /** Append vs replace mode for rows. Default: 'append'. */
  mode?: 'append' | 'replace';
  /**
   * Live-fetch callback: returns the full parsed JSON response.
   * The adapter will detect arrays, select the best one, and return
   * the first item as the source sample for the tree view.
   * The full response is stored internally for `serialize` to extract rows.
   */
  fetchSampleData?: () => Promise<unknown>;
}

// ─── Adapter Factory ──────────────────────────────────────

export function createPopulateFromApiAdapter(
  opts: PopulateFromApiAdapterOptions,
): ApiPopulateAdapter<PopulateOutput> {
  return createBaseApiPopulateAdapter<PopulateOutput>(
    {
      contextId: 'populate-from-api',
      sourceId: 'api-response',
      sourceLabel: 'API Response',
      title: 'API Response → Data Source',
      deserializeIdPrefix: 'pop-',
    },
    opts,
  );
}
