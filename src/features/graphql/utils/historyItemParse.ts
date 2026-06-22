/** Shared parsing/formatting for GraphQL history item payloads (preview + compare). */
import type { GraphqlHistoryItem } from '../../../shared/types/graphql';

export const HISTORY_TRUNCATION_SUFFIX = '\n__TRUNCATED__';

export interface HistoryPreviewData {
  isTruncated: boolean;
  queryText: string;
  variablesText: string | null;
  responseBodyText: string;
  httpStatus: number | null;
  hasGraphqlErrors: boolean;
}

export function isHistoryResponseTruncated(raw: string): boolean {
  return raw.includes('__TRUNCATED__');
}

export function stripHistoryTruncationMarker(raw: string): string {
  return raw.replace(/\n__TRUNCATED__$/, '');
}

export function parseHistoryResponseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(stripHistoryTruncationMarker(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseHistoryVariablesObject(raw: string | undefined): Record<string, unknown> {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === '{}') return {};
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function formatHistoryVariablesText(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === '{}') return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
}

export function extractHistoryDataObject(payload: Record<string, unknown> | null): Record<string, unknown> {
  if (!payload || payload.data === undefined) return {};
  const data = payload.data;
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return {};
}

/** Short label for compare slots — includes `data.user.name` when present. */
export function historyEntrySummary(item: GraphqlHistoryItem): string {
  const opName = item.operation.name ?? '(anonymous)';
  const payload = parseHistoryResponseJson(item.response);
  const name = (payload?.data as { user?: { name?: string } } | undefined)?.user?.name;
  if (typeof name === 'string' && name.length > 0) return `${opName} · ${name}`;
  return opName;
}

export function buildHistoryPreviewData(item: GraphqlHistoryItem): HistoryPreviewData {
  const isTruncated = isHistoryResponseTruncated(item.response);
  const raw = isTruncated ? stripHistoryTruncationMarker(item.response) : item.response;

  let httpStatus: number | null = null;
  let hasGraphqlErrors = false;
  let responseBodyText = raw;

  const parsed = parseHistoryResponseJson(item.response);
  if (parsed) {
    httpStatus = typeof parsed.httpStatus === 'number' ? parsed.httpStatus : null;
    hasGraphqlErrors = Array.isArray(parsed.errors) && parsed.errors.length > 0;
    const body: Record<string, unknown> = {};
    if (parsed.data !== undefined) body.data = parsed.data;
    if (hasGraphqlErrors) body.errors = parsed.errors;
    if (parsed.extensions !== undefined) body.extensions = parsed.extensions;
    responseBodyText = Object.keys(body).length > 0
      ? JSON.stringify(body, null, 2)
      : JSON.stringify(parsed, null, 2);
  }

  return {
    isTruncated,
    queryText: item.operation.query.trim(),
    variablesText: formatHistoryVariablesText(item.operation.variables),
    responseBodyText,
    httpStatus,
    hasGraphqlErrors,
  };
}
