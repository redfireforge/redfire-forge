import type { GraphqlEnvironment, GraphqlHistoryItem, RfResponseContext } from '@shared/types/graphql';

/** Default name for Save-to-Collection when operation metadata is sparse. */
export function resolveSaveToCollectionDefaultName(operation: {
  name?: string;
  operationType?: string;
}): string {
  return operation.name ?? operation.operationType ?? 'Unnamed operation';
}

/** Parse the most recent history entry into RF response context for collection export. */
export function parseLatestHistoryRfResponse(
  items: GraphqlHistoryItem[],
): RfResponseContext | undefined {
  const last = items[0];
  if (!last) return undefined;
  try {
    const parsed = JSON.parse(last.response) as {
      data?: unknown;
      errors?: Array<{ message: string }>;
      httpStatus?: number;
      httpHeaders?: Record<string, string>;
    };
    return {
      httpStatus: parsed.httpStatus ?? 200,
      httpHeaders: parsed.httpHeaders ?? {},
      data: parsed.data,
      errors: parsed.errors,
      latencyMs: last.latencyMs,
    };
  } catch {
    return undefined;
  }
}

/** Snapshot enabled environment variables for collection metadata. */
export function buildGraphqlEnvSnapshot(
  activeEnvironment: GraphqlEnvironment | null | undefined,
): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (const v of (activeEnvironment?.variables ?? [])) {
    if (v.enabled && v.key.trim()) snapshot[v.key.trim()] = v.value;
  }
  return snapshot;
}
