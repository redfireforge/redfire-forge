/**
 * Phase 5I — Kreya-style response snapshot baseline capture and diff.
 */
import type { GrpcCallResult } from '../../../shared/grpc/contracts';
import type { GrpcResponseSnapshotBaseline } from '../../../shared/grpc/grpcSavedRequest';

export type { GrpcResponseSnapshotBaseline };

export type GrpcResponseSnapshotMatchState = 'none' | 'match' | 'diff';

export type GrpcResponseSnapshotDiffChange = 'added' | 'removed' | 'changed';

export interface GrpcResponseSnapshotDiffEntry {
  path: string;
  change: GrpcResponseSnapshotDiffChange;
  baselineValue?: unknown;
  actualValue?: unknown;
}

export function captureGrpcResponseSnapshotBaseline(result: GrpcCallResult): GrpcResponseSnapshotBaseline {
  if (result.status !== 0) {
    throw new Error('Response snapshot baseline requires a successful unary response (gRPC status OK)');
  }
  return {
    capturedAt: new Date().toISOString(),
    grpcStatus: result.status,
    statusMessage: result.statusMessage,
    body: structuredClone(result.body ?? {}),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectJsonDiffs(
  baseline: unknown,
  actual: unknown,
  path: string,
  diffs: GrpcResponseSnapshotDiffEntry[],
): void {
  if (valuesEqual(baseline, actual)) return;

  if (Array.isArray(baseline) && Array.isArray(actual)) {
    const maxLen = Math.max(baseline.length, actual.length);
    for (let index = 0; index < maxLen; index += 1) {
      const childPath = `${path}[${index}]`;
      if (index >= baseline.length) {
        diffs.push({ path: childPath, change: 'added', actualValue: actual[index] });
      } else if (index >= actual.length) {
        diffs.push({ path: childPath, change: 'removed', baselineValue: baseline[index] });
      } else {
        collectJsonDiffs(baseline[index], actual[index], childPath, diffs);
      }
    }
    return;
  }

  if (isPlainObject(baseline) && isPlainObject(actual)) {
    const keys = new Set([...Object.keys(baseline), ...Object.keys(actual)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in baseline)) {
        diffs.push({ path: childPath, change: 'added', actualValue: actual[key] });
      } else if (!(key in actual)) {
        diffs.push({ path: childPath, change: 'removed', baselineValue: baseline[key] });
      } else {
        collectJsonDiffs(baseline[key], actual[key], childPath, diffs);
      }
    }
    return;
  }

  diffs.push({
    path: path || '(root)',
    change: 'changed',
    baselineValue: baseline,
    actualValue: actual,
  });
}

export function diffGrpcResponseSnapshotBodies(
  baselineBody: Record<string, unknown>,
  actualBody: Record<string, unknown>,
): GrpcResponseSnapshotDiffEntry[] {
  const diffs: GrpcResponseSnapshotDiffEntry[] = [];
  collectJsonDiffs(baselineBody, actualBody, '', diffs);
  return diffs;
}

export function compareGrpcResponseToBaseline(
  actual: GrpcCallResult | undefined,
  baseline: GrpcResponseSnapshotBaseline | undefined,
): {
  state: GrpcResponseSnapshotMatchState;
  diffs: GrpcResponseSnapshotDiffEntry[];
  statusMismatch: boolean;
} {
  if (!baseline) {
    return { state: 'none', diffs: [], statusMismatch: false };
  }
  if (!actual) {
    return { state: 'none', diffs: [], statusMismatch: false };
  }

  const statusMismatch = actual.status !== baseline.grpcStatus;
  const statusMessageMismatch = (actual.statusMessage ?? '') !== (baseline.statusMessage ?? '');
  const bodyDiffs = diffGrpcResponseSnapshotBodies(
    baseline.body,
    actual.body ?? {},
  );

  if (statusMismatch || statusMessageMismatch || bodyDiffs.length > 0) {
    const diffs = [...bodyDiffs];
    if (statusMessageMismatch) {
      diffs.unshift({
        path: 'statusMessage',
        change: 'changed',
        baselineValue: baseline.statusMessage ?? '',
        actualValue: actual.statusMessage ?? '',
      });
    }
    if (statusMismatch) {
      diffs.unshift({
        path: 'grpcStatus',
        change: 'changed',
        baselineValue: baseline.grpcStatus,
        actualValue: actual.status,
      });
    }
    return { state: 'diff', diffs, statusMismatch: statusMismatch || statusMessageMismatch };
  }

  return { state: 'match', diffs: [], statusMismatch: false };
}

export function savedRequestMatchesUnaryResult(
  saved: { service: string; method: string; callType: string },
  result: GrpcCallResult | undefined,
): boolean {
  return saved.callType === 'unary' && Boolean(result);
}

/** Active tab last unary OK result when service/method/descriptorKey match the saved request. */
export function resolveUnaryResultForSavedRequestComparison(
  saved: { service: string; method: string; callType: string; descriptorKey?: string } | null | undefined,
  tab: {
    lifecycle: string;
    service?: string;
    method?: string;
    descriptorKey?: string;
    lastResult?: GrpcCallResult;
  } | null | undefined,
): GrpcCallResult | undefined {
  if (!saved || saved.callType !== 'unary') return undefined;
  if (!tab || tab.lifecycle !== 'success' || !tab.lastResult) return undefined;
  if (tab.lastResult.callType !== 'unary' || tab.lastResult.status !== 0) return undefined;
  if (tab.service !== saved.service || tab.method !== saved.method) return undefined;
  if (saved.descriptorKey && tab.descriptorKey !== saved.descriptorKey) return undefined;
  return tab.lastResult;
}
