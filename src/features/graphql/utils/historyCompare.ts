/** Field-level comparison of two GraphQL history entries (variables + response data). */
import type { GraphqlHistoryItem } from '@shared/types/graphql';
import {
  extractHistoryDataObject,
  parseHistoryResponseJson,
  parseHistoryVariablesObject,
} from './historyItemParse';

export interface HistoryCompareFieldRow {
  path: string;
  valueA: string;
  valueB: string;
  same: boolean;
}

export interface HistoryCompareResult {
  nameA: string;
  nameB: string;
  variablesRows: HistoryCompareFieldRow[];
  responseRows: HistoryCompareFieldRow[];
  querySame: boolean;
}

function stringifyValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): { path: string; value: unknown }[] {
  const rows: { path: string; value: unknown }[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenObject(value as Record<string, unknown>, path));
    } else {
      rows.push({ path, value });
    }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

function buildFieldRows(
  flatA: { path: string; value: unknown }[],
  flatB: { path: string; value: unknown }[],
): HistoryCompareFieldRow[] {
  const mapA = new Map(flatA.map((r) => [r.path, r.value]));
  const mapB = new Map(flatB.map((r) => [r.path, r.value]));
  const paths = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();
  return paths.map((path) => {
    const valueA = stringifyValue(mapA.get(path));
    const valueB = stringifyValue(mapB.get(path));
    return { path, valueA, valueB, same: valueA === valueB };
  });
}

/** Compare two history items — variables JSON and `data` response fields. */
export function compareHistoryItems(
  itemA: GraphqlHistoryItem,
  itemB: GraphqlHistoryItem,
): HistoryCompareResult {
  const varsA = parseHistoryVariablesObject(itemA.operation.variables);
  const varsB = parseHistoryVariablesObject(itemB.operation.variables);
  const dataA = extractHistoryDataObject(parseHistoryResponseJson(itemA.response));
  const dataB = extractHistoryDataObject(parseHistoryResponseJson(itemB.response));

  return {
    nameA: itemA.operation.name ?? 'Anonymous',
    nameB: itemB.operation.name ?? 'Anonymous',
    variablesRows: buildFieldRows(flattenObject(varsA), flattenObject(varsB)),
    responseRows: buildFieldRows(flattenObject(dataA), flattenObject(dataB)),
    querySame: itemA.operation.query.trim() === itemB.operation.query.trim(),
  };
}

/** Client-side history search — name, query, variables, and response body. */
export function filterHistoryItems(
  items: GraphqlHistoryItem[],
  query: string,
): GraphqlHistoryItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items;
  const lower = trimmed.toLowerCase();
  return items.filter((item) => {
    const opName = item.operation.name?.toLowerCase() ?? '';
    const queryText = item.operation.query.toLowerCase();
    const vars = (item.operation.variables ?? '').toLowerCase();
    const response = item.response.toLowerCase();
    return (
      opName.includes(lower)
      || queryText.includes(lower)
      || vars.includes(lower)
      || response.includes(lower)
    );
  });
}
