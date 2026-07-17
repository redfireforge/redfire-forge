/**
 * Phase 11K — emit RPC stats events from existing execute capture points.
 */
import type { GrpcCallResult, GrpcErrorBody, GrpcCallType, GrpcTabExecuteSnapshot } from '../../../shared/grpc/contracts';
import type { GrpcLoadTestRunSummaryExport } from '../../../shared/grpc/grpcLoadTestMetrics';
import { recordGrpcRpcStatsEvent, recordGrpcRpcStatsEvents, type GrpcRpcStatsEvent } from '../../../shared/grpc/grpcRpcSessionStats';

function extractGrpcStatusFromError(error: GrpcErrorBody): number {
  const details = error.details;
  if (details && typeof details === 'object') {
    const grpcStatus = (details as { grpcStatus?: unknown }).grpcStatus;
    if (typeof grpcStatus === 'number' && Number.isFinite(grpcStatus)) {
      return grpcStatus;
    }
  }
  return 2;
}

function resolveGrpcStatusFromOutcome(result?: GrpcCallResult, error?: GrpcErrorBody): number {
  if (result) {
    return result.status ?? 0;
  }
  if (error) {
    return extractGrpcStatusFromError(error);
  }
  return 0;
}

function resolveDurationFromOutcome(
  result?: GrpcCallResult,
  streamTiming?: { startedAt?: string; endedAt?: string },
): number {
  if (result?.durationMs != null && result.durationMs > 0) {
    return Math.max(0, result.durationMs);
  }
  if (streamTiming?.startedAt) {
    const endMs = streamTiming.endedAt
      ? new Date(streamTiming.endedAt).getTime()
      : Date.now();
    const startMs = new Date(streamTiming.startedAt).getTime();
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return Math.max(0, endMs - startMs);
    }
  }
  return Math.max(0, result?.durationMs ?? 0);
}

export function buildGrpcRpcStatsEventFromOutcome(input: {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallResult;
  error?: GrpcErrorBody;
  source: 'unary' | 'stream_terminal';
  recordedAt?: string;
  streamTiming?: { startedAt?: string; endedAt?: string };
}) {
  return {
    tabId: input.snapshot.tabId,
    service: input.snapshot.service,
    method: input.snapshot.method,
    callType: input.snapshot.callType,
    grpcStatus: resolveGrpcStatusFromOutcome(input.result, input.error),
    durationMs: resolveDurationFromOutcome(input.result, input.streamTiming),
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    source: input.source,
  } as const;
}

/** Fire-and-forget stats capture parallel to call history. */
export function captureGrpcRpcStatsFromOutcome(input: {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallResult;
  error?: GrpcErrorBody;
  source?: 'unary' | 'stream_terminal';
  streamTiming?: { startedAt?: string; endedAt?: string };
}): void {
  try {
    recordGrpcRpcStatsEvent(buildGrpcRpcStatsEventFromOutcome({
      snapshot: input.snapshot,
      result: input.result,
      error: input.error,
      source: input.source ?? 'unary',
      streamTiming: input.streamTiming,
    }));
  } catch {
    /* stats are best-effort */
  }
}

export function captureGrpcRpcStatsFromStreamTerminal(
  tab: {
    lastExecuteSnapshot?: GrpcTabExecuteSnapshot;
    streamError?: GrpcErrorBody;
    streamStartedAt?: string;
    streamEndedAt?: string;
  },
  overrides?: {
    error?: GrpcErrorBody;
    result?: GrpcCallResult;
  },
): void {
  if (!tab.lastExecuteSnapshot) return;
  const streamTiming = tab.streamStartedAt
    ? { startedAt: tab.streamStartedAt, endedAt: tab.streamEndedAt }
    : undefined;
  captureGrpcRpcStatsFromOutcome({
    snapshot: tab.lastExecuteSnapshot,
    error: overrides?.error ?? tab.streamError,
    result: overrides?.result,
    source: 'stream_terminal',
    streamTiming,
  });
}

function resolveLoadTestAttemptStatus(attempt: { ok: boolean; statusCode?: number }): number {
  if (attempt.statusCode != null && attempt.statusCode !== 0) {
    return attempt.statusCode;
  }
  return attempt.ok ? 0 : 2;
}

export function captureGrpcRpcStatsFromLoadTestSummary(
  tabId: string,
  summary: GrpcLoadTestRunSummaryExport,
  source: { service: string; method: string; callType: GrpcCallType },
): void {
  const events: GrpcRpcStatsEvent[] = [];
  for (const attempt of summary.attempts) {
    if (attempt.warmup) {
      continue;
    }
    events.push({
      tabId,
      service: source.service,
      method: source.method,
      callType: source.callType,
      grpcStatus: resolveLoadTestAttemptStatus(attempt),
      durationMs: Math.max(0, attempt.durationMs),
      recordedAt: attempt.finishedAt,
      source: 'load_test',
    });
  }
  try {
    recordGrpcRpcStatsEvents(events);
  } catch {
    /* stats are best-effort */
  }
}
