import type { GlobalAuthProfile } from '../../../shared/types';
import type {
  GraphqlBatchResponseContext,
  GraphqlBatchResult,
  GraphqlError,
  GraphqlResponse,
} from '../../../shared/types/graphql';
import type { ConnectionProfile } from './connectionProfileStorage';
import {
  stampRequestHeaders,
  type AuthSentStampInput,
} from './graphqlExecutionResponseParsing';
import {
  findProfileById,
  resolveTabAuthSentSource,
  resolveTabConnection,
  type TabConnectionPageDefaults,
} from './tabConnectionResolution';
import type { GqlStudioTab } from './tabPersistence';

/** Wire-format batch operation result from POST /api/graphql/batch. */
export interface BatchProxyResultItem {
  data?: unknown;
  errors?: GraphqlError[];
  extensions?: Record<string, unknown>;
  _httpStatus?: number;
  _httpHeaders?: Record<string, string>;
  _latencyMs?: number;
}

export interface BatchOperationWireInput {
  query: string;
  variables?: unknown;
  operationName?: string;
  headers: Record<string, string>;
}

export interface BuildBatchGraphqlResultContext {
  profiles: ConnectionProfile[];
  pageDefaults: TabConnectionPageDefaults;
  globalAuthProfiles: GlobalAuthProfile[];
}

function readWireHttpHeaders(raw: BatchProxyResultItem): Record<string, string> {
  const headers = raw._httpHeaders;
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') out[key.toLowerCase()] = value;
  }
  return out;
}

function readWireLatencyMs(raw: BatchProxyResultItem): number {
  const latency = raw._latencyMs;
  return typeof latency === 'number' && Number.isFinite(latency) && latency >= 0 ? latency : 0;
}

function buildAuthSentStamp(
  tab: GqlStudioTab,
  profiles: ConnectionProfile[],
  pageDefaults: TabConnectionPageDefaults,
  globalAuthProfiles: GlobalAuthProfile[],
): AuthSentStampInput {
  const profile = findProfileById(profiles, tab.connectionId);
  const connection = resolveTabConnection(tab, profiles, pageDefaults);
  return {
    source: resolveTabAuthSentSource(tab, profile, pageDefaults.auth),
    storedAuth: connection.auth,
    globalAuthProfiles,
  };
}

function buildRequestBody(op: BatchOperationWireInput): Record<string, unknown> {
  const body: Record<string, unknown> = { query: op.query };
  if (op.variables !== undefined) body.variables = op.variables;
  if (op.operationName?.trim()) body.operationName = op.operationName.trim();
  return body;
}

export function buildBatchWireRequestBody(batchOperations: BatchOperationWireInput[]): unknown[] {
  return batchOperations.map((op) => buildRequestBody(op));
}

export function buildBatchResponseContext(
  index: number,
  batchUnsupported: boolean,
  batchOperations: BatchOperationWireInput[],
  proxyResults: BatchProxyResultItem[],
): GraphqlBatchResponseContext {
  const batchSize = batchOperations.length;
  const upstreamRequestCount = batchUnsupported ? batchSize : 1;
  const batchLatencyMs = batchUnsupported
    ? readWireLatencyMs(proxyResults[index] ?? {})
    : readWireLatencyMs(proxyResults[0] ?? {});

  return {
    batchIndex: index,
    batchSize,
    batchUnsupported,
    upstreamRequestCount,
    batchLatencyMs,
    wireRequestBody: batchUnsupported ? undefined : buildBatchWireRequestBody(batchOperations),
  };
}

/** Stamp batchContext on every tab response in a batch result (success, timeout, or network error). */
export function stampBatchContextOnBatchResult(
  batchResult: GraphqlBatchResult,
  batchOperations: BatchOperationWireInput[],
  proxyResults: BatchProxyResultItem[],
): GraphqlBatchResult {
  const wireResults = proxyResults.length > 0
    ? proxyResults
    : batchResult.results.map((entry) => ({
        _latencyMs: entry.response.latencyMs,
        _httpStatus: entry.response.httpStatus,
      }));

  return {
    ...batchResult,
    results: batchResult.results.map((entry, index) => ({
      ...entry,
      response: {
        ...entry.response,
        batchContext: buildBatchResponseContext(
          index,
          batchResult.batchUnsupported,
          batchOperations,
          wireResults,
        ),
      },
    })),
  };
}

/** Mirror single Execute outgoing headers (JSON POST + tab auth/custom headers). */
function buildOutgoingRequestHeaders(op: BatchOperationWireInput): Record<string, string> {
  const outgoing: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  for (const [key, value] of Object.entries(op.headers)) {
    if (typeof value === 'string') outgoing[key] = value;
  }
  return outgoing;
}

/** Build a full GraphqlResponse (Body/Headers/Metadata parity with single Execute). */
export function buildBatchOperationResponse(
  raw: BatchProxyResultItem,
  op: BatchOperationWireInput,
  tab: GqlStudioTab,
  ctx: BuildBatchGraphqlResultContext,
): GraphqlResponse {
  const httpStatus = typeof raw._httpStatus === 'number' ? raw._httpStatus : 200;
  const base: GraphqlResponse = {
    data: raw.data ?? null,
    errors: Array.isArray(raw.errors) ? raw.errors : undefined,
    extensions: raw.extensions && typeof raw.extensions === 'object' ? raw.extensions : undefined,
    httpStatus,
    httpHeaders: readWireHttpHeaders(raw),
    latencyMs: readWireLatencyMs(raw),
    timestamp: Date.now(),
  };

  return stampRequestHeaders(
    base,
    buildOutgoingRequestHeaders(op),
    buildAuthSentStamp(tab, ctx.profiles, ctx.pageDefaults, ctx.globalAuthProfiles),
    { method: 'POST', body: buildRequestBody(op) },
  );
}

export function buildBatchTimeoutOperationResponse(
  op: BatchOperationWireInput,
  tab: GqlStudioTab,
  ctx: BuildBatchGraphqlResultContext,
  message: string,
  options?: { httpStatus?: number; latencyMs?: number; partial?: BatchProxyResultItem },
): GraphqlResponse {
  if (options?.partial && options.partial._httpStatus !== 408) {
    return buildBatchOperationResponse(options.partial, op, tab, ctx);
  }

  const httpStatus = options?.httpStatus ?? 408;
  const base: GraphqlResponse = {
    data: null,
    errors: [{ message }],
    httpStatus,
    httpHeaders: options?.partial ? readWireHttpHeaders(options.partial) : {},
    latencyMs: options?.latencyMs ?? readWireLatencyMs(options?.partial ?? {}),
    timestamp: Date.now(),
  };

  return stampRequestHeaders(
    base,
    buildOutgoingRequestHeaders(op),
    buildAuthSentStamp(tab, ctx.profiles, ctx.pageDefaults, ctx.globalAuthProfiles),
    { method: 'POST', body: buildRequestBody(op) },
  );
}

export function buildBatchNetworkErrorResponse(
  op: BatchOperationWireInput,
  tab: GqlStudioTab,
  ctx: BuildBatchGraphqlResultContext,
  message: string,
): GraphqlResponse {
  const base: GraphqlResponse = {
    data: null,
    errors: [{ message }],
    httpStatus: 0,
    httpHeaders: {},
    latencyMs: 0,
    timestamp: Date.now(),
  };

  return stampRequestHeaders(
    base,
    buildOutgoingRequestHeaders(op),
    buildAuthSentStamp(tab, ctx.profiles, ctx.pageDefaults, ctx.globalAuthProfiles),
    { method: 'POST', body: buildRequestBody(op) },
  );
}

export function mapProxyResultsToGraphqlBatchResult(
  batchedTabs: GqlStudioTab[],
  batchOperations: BatchOperationWireInput[],
  proxyResults: BatchProxyResultItem[],
  batchUnsupported: boolean,
  ctx: BuildBatchGraphqlResultContext,
): GraphqlBatchResult {
  const base: GraphqlBatchResult = {
    batchUnsupported,
    results: proxyResults.map((raw, index) => {
      const op = batchOperations[index] ?? {
        query: batchedTabs[index]?.query ?? '',
        headers: {},
      };
      const response = buildBatchOperationResponse(raw, op, batchedTabs[index]!, ctx);
      return {
        index,
        operationName: batchedTabs[index]?.selectedOperation ?? batchedTabs[index]?.label,
        response,
      };
    }),
  };
  return stampBatchContextOnBatchResult(base, batchOperations, proxyResults);
}
