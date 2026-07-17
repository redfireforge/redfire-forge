/**
 * Phase 11K — in-memory per-tab RPC session statistics reducer.
 */
import type { GrpcCallType } from './contracts';
import { computePercentiles, round2 } from '../utils/percentiles';

export type GrpcRpcStatsEventSource = 'unary' | 'stream_terminal' | 'load_test';

export interface GrpcRpcStatsLatencyMs {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

export interface GrpcRpcMethodSessionStats {
  service: string;
  method: string;
  callType: GrpcCallType;
  calls: number;
  errors: number;
  statusDistribution: Record<string, number>;
  latencyMs: GrpcRpcStatsLatencyMs;
}

export interface GrpcRpcSessionStats {
  tabId: string;
  windowStartedAt: string;
  windowResetAt?: string;
  byMethodKey: Record<string, GrpcRpcMethodSessionStats>;
}

export interface GrpcRpcStatsEvent {
  tabId: string;
  service: string;
  method: string;
  callType: GrpcCallType;
  grpcStatus: number;
  durationMs: number;
  recordedAt: string;
  source: GrpcRpcStatsEventSource;
}

interface GrpcRpcMethodStatsAccumulator {
  service: string;
  method: string;
  callType: GrpcCallType;
  calls: number;
  errors: number;
  statusDistribution: Record<string, number>;
  durationSamples: number[];
}

export interface GrpcRpcSessionStatsAccumulator {
  tabId: string;
  windowStartedAt: string;
  windowResetAt?: string;
  byMethodKey: Record<string, GrpcRpcMethodStatsAccumulator>;
}

export const GRPC_RPC_STATS_UPDATED_EVENT = 'grpc-rpc-stats-updated';

const sessionAccumulators = new Map<string, GrpcRpcSessionStatsAccumulator>();

function dispatchStatsUpdated(tabId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GRPC_RPC_STATS_UPDATED_EVENT, { detail: { tabId } }));
  }
}

export function buildGrpcRpcMethodKey(service: string, method: string): string {
  return `${service}/${method}`;
}

export function isGrpcRpcStatsError(grpcStatus: number): boolean {
  return grpcStatus !== 0;
}

export function formatGrpcRpcStatusKey(grpcStatus: number): string {
  return String(grpcStatus);
}

function emptyLatency(): GrpcRpcStatsLatencyMs {
  return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
}

function rollupLatency(samples: number[]): GrpcRpcStatsLatencyMs {
  if (samples.length === 0) {
    return emptyLatency();
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const summary = computePercentiles(sorted);
  return {
    p50: round2(summary.p50),
    p95: round2(summary.p95),
    p99: round2(summary.p99),
    avg: round2(summary.mean),
    min: round2(summary.min),
    max: round2(summary.max),
  };
}

function rollupMethodStats(entry: GrpcRpcMethodStatsAccumulator): GrpcRpcMethodSessionStats {
  return {
    service: entry.service,
    method: entry.method,
    callType: entry.callType,
    calls: entry.calls,
    errors: entry.errors,
    statusDistribution: { ...entry.statusDistribution },
    latencyMs: rollupLatency(entry.durationSamples),
  };
}

export function createEmptyGrpcRpcSessionStats(tabId: string, resetAt?: string): GrpcRpcSessionStats {
  const now = resetAt ?? new Date().toISOString();
  return {
    tabId,
    windowStartedAt: now,
    windowResetAt: resetAt,
    byMethodKey: {},
  };
}

function ensureSessionAccumulator(tabId: string): GrpcRpcSessionStatsAccumulator {
  const existing = sessionAccumulators.get(tabId);
  if (existing) {
    return existing;
  }
  const created: GrpcRpcSessionStatsAccumulator = {
    tabId,
    windowStartedAt: new Date().toISOString(),
    byMethodKey: {},
  };
  sessionAccumulators.set(tabId, created);
  return created;
}

export function createGrpcRpcSessionStatsAccumulator(tabId: string): GrpcRpcSessionStatsAccumulator {
  return {
    tabId,
    windowStartedAt: new Date().toISOString(),
    byMethodKey: {},
  };
}

export function applyGrpcRpcStatsEvent(
  accumulator: GrpcRpcSessionStatsAccumulator,
  event: GrpcRpcStatsEvent,
): GrpcRpcSessionStatsAccumulator {
  applyEventToAccumulator(accumulator, event);
  return accumulator;
}

function applyEventToAccumulator(
  accumulator: GrpcRpcSessionStatsAccumulator,
  event: GrpcRpcStatsEvent,
): void {
  const methodKey = buildGrpcRpcMethodKey(event.service, event.method);
  const statusKey = formatGrpcRpcStatusKey(event.grpcStatus);
  const duration = Math.max(0, event.durationMs);
  const existing = accumulator.byMethodKey[methodKey];

  if (existing) {
    existing.calls += 1;
    if (isGrpcRpcStatsError(event.grpcStatus)) {
      existing.errors += 1;
    }
    existing.statusDistribution[statusKey] = (existing.statusDistribution[statusKey] ?? 0) + 1;
    existing.durationSamples.push(duration);
    return;
  }

  accumulator.byMethodKey[methodKey] = {
    service: event.service,
    method: event.method,
    callType: event.callType,
    calls: 1,
    errors: isGrpcRpcStatsError(event.grpcStatus) ? 1 : 0,
    statusDistribution: { [statusKey]: 1 },
    durationSamples: [duration],
  };
}

export function rollupGrpcRpcSessionStats(
  accumulator: GrpcRpcSessionStatsAccumulator,
): GrpcRpcSessionStats {
  const byMethodKey: Record<string, GrpcRpcMethodSessionStats> = {};
  for (const [methodKey, entry] of Object.entries(accumulator.byMethodKey)) {
    byMethodKey[methodKey] = rollupMethodStats(entry);
  }
  return {
    tabId: accumulator.tabId,
    windowStartedAt: accumulator.windowStartedAt,
    windowResetAt: accumulator.windowResetAt,
    byMethodKey,
  };
}

export function recordGrpcRpcStatsEvent(event: GrpcRpcStatsEvent): void {
  const accumulator = ensureSessionAccumulator(event.tabId);
  applyEventToAccumulator(accumulator, event);
  dispatchStatsUpdated(event.tabId);
}

/** Apply many events then dispatch once per touched tab (load-test fold). */
export function recordGrpcRpcStatsEvents(events: readonly GrpcRpcStatsEvent[]): void {
  if (events.length === 0) {
    return;
  }
  const touchedTabIds = new Set<string>();
  for (const event of events) {
    try {
      const accumulator = ensureSessionAccumulator(event.tabId);
      applyEventToAccumulator(accumulator, event);
      touchedTabIds.add(event.tabId);
    } catch {
      /* stats are best-effort */
    }
  }
  for (const tabId of touchedTabIds) {
    dispatchStatsUpdated(tabId);
  }
}

export function getGrpcRpcSessionStats(tabId: string): GrpcRpcSessionStats {
  const accumulator = sessionAccumulators.get(tabId);
  if (!accumulator) {
    return createEmptyGrpcRpcSessionStats(tabId);
  }
  return rollupGrpcRpcSessionStats(accumulator);
}

export function resetGrpcRpcSessionStats(tabId: string): void {
  const resetAt = new Date().toISOString();
  sessionAccumulators.set(tabId, {
    tabId,
    windowStartedAt: resetAt,
    windowResetAt: resetAt,
    byMethodKey: {},
  });
  dispatchStatsUpdated(tabId);
}

export function pruneGrpcRpcSessionStatsForTabs(keepTabIds: ReadonlySet<string>): void {
  for (const tabId of sessionAccumulators.keys()) {
    if (!keepTabIds.has(tabId)) {
      sessionAccumulators.delete(tabId);
    }
  }
}

export function clearGrpcRpcSessionStatsForTests(): void {
  sessionAccumulators.clear();
}

export interface GrpcRpcSessionSummary {
  totalCalls: number;
  totalErrors: number;
  successRatePercent: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export function summarizeGrpcRpcSessionStats(stats: GrpcRpcSessionStats): GrpcRpcSessionSummary {
  return summarizeGrpcRpcSessionAccumulator(
    sessionAccumulators.get(stats.tabId),
    stats,
  );
}

function emptyGrpcRpcSessionSummary(): GrpcRpcSessionSummary {
  return {
    totalCalls: 0,
    totalErrors: 0,
    successRatePercent: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
  };
}

function summarizeGrpcRpcSessionAccumulator(
  accumulator: GrpcRpcSessionStatsAccumulator | undefined,
  rolledUp?: GrpcRpcSessionStats,
): GrpcRpcSessionSummary {
  if (!accumulator && rolledUp) {
    const methods = Object.values(rolledUp.byMethodKey);
    const totalCalls = methods.reduce((sum, entry) => sum + entry.calls, 0);
    const totalErrors = methods.reduce((sum, entry) => sum + entry.errors, 0);
    const successCount = Math.max(0, totalCalls - totalErrors);
    const weightedLatencySum = methods.reduce(
      (sum, entry) => sum + entry.latencyMs.avg * entry.calls,
      0,
    );
    const avgLatencyMs = totalCalls === 0 ? 0 : round2(weightedLatencySum / totalCalls);
    const p95LatencyMs = methods.reduce(
      (max, entry) => Math.max(max, entry.latencyMs.p95),
      0,
    );
    return {
      totalCalls,
      totalErrors,
      successRatePercent: totalCalls === 0 ? 0 : round2((successCount / totalCalls) * 100),
      avgLatencyMs,
      p95LatencyMs: round2(p95LatencyMs),
    };
  }
  if (!accumulator) {
    return emptyGrpcRpcSessionSummary();
  }

  const methods = Object.values(accumulator.byMethodKey);
  const totalCalls = methods.reduce((sum, entry) => sum + entry.calls, 0);
  const totalErrors = methods.reduce((sum, entry) => sum + entry.errors, 0);
  const successCount = Math.max(0, totalCalls - totalErrors);
  const allSamples = methods.flatMap((entry) => entry.durationSamples);
  const latency = rollupLatency(allSamples);
  return {
    totalCalls,
    totalErrors,
    successRatePercent: totalCalls === 0 ? 0 : round2((successCount / totalCalls) * 100),
    avgLatencyMs: latency.avg,
    p95LatencyMs: latency.p95,
  };
}

/** Session summary from raw duration samples (accurate cross-method percentiles). */
export function getGrpcRpcSessionSummary(tabId: string): GrpcRpcSessionSummary {
  return summarizeGrpcRpcSessionAccumulator(sessionAccumulators.get(tabId));
}

export function listGrpcRpcMethodRows(
  stats: GrpcRpcSessionStats,
): GrpcRpcMethodSessionStats[] {
  return Object.entries(stats.byMethodKey)
    .map(([methodKey, row]) => ({ methodKey, row }))
    .sort((a, b) => a.methodKey.localeCompare(b.methodKey))
    .map(({ row }) => row);
}
