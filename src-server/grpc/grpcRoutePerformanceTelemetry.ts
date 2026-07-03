interface GrpcRoutePerformanceStats {
  routeId: string;
  count: number;
  errors: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  errorRate: number;
  lastStatusCode: number | null;
  lastUpdatedAt: number | null;
}

export interface GrpcRoutePerformanceSnapshot {
  totalRequests: number;
  totalErrors: number;
  recordedRouteCount: number;
  lastUpdatedAt: number | null;
  routes: GrpcRoutePerformanceStats[];
}

interface RouteTelemetryBucket {
  durationsMs: number[];
  errors: number;
  lastStatusCode: number | null;
  lastUpdatedAt: number | null;
}

const routeBuckets = new Map<string, RouteTelemetryBucket>();

function getOrCreateBucket(routeId: string): RouteTelemetryBucket {
  const existing = routeBuckets.get(routeId);
  if (existing) {
    return existing;
  }
  const created: RouteTelemetryBucket = {
    durationsMs: [],
    errors: 0,
    lastStatusCode: null,
    lastUpdatedAt: null,
  };
  routeBuckets.set(routeId, created);
  return created;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0] ?? 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const safeIndex = Math.max(0, Math.min(sortedValues.length - 1, index));
  return sortedValues[safeIndex] ?? 0;
}

function summarizeRoute(routeId: string, bucket: RouteTelemetryBucket): GrpcRoutePerformanceStats {
  const count = bucket.durationsMs.length;
  const sorted = [...bucket.durationsMs].sort((a, b) => a - b);
  const sum = bucket.durationsMs.reduce((acc, value) => acc + value, 0);
  return {
    routeId,
    count,
    errors: bucket.errors,
    avgMs: count > 0 ? round2(sum / count) : 0,
    p95Ms: count > 0 ? percentile(sorted, 95) : 0,
    minMs: count > 0 ? sorted[0] ?? 0 : 0,
    maxMs: count > 0 ? sorted[count - 1] ?? 0 : 0,
    errorRate: count > 0 ? round2(bucket.errors / count) : 0,
    lastStatusCode: bucket.lastStatusCode,
    lastUpdatedAt: bucket.lastUpdatedAt,
  };
}

export function recordGrpcRoutePerformance(input: {
  routeId: string;
  durationMs: number;
  statusCode: number;
}): void {
  const bucket = getOrCreateBucket(input.routeId);
  const durationMs = Number.isFinite(input.durationMs) && input.durationMs >= 0
    ? round2(input.durationMs)
    : 0;
  bucket.durationsMs.push(durationMs);
  if (input.statusCode >= 400) {
    bucket.errors += 1;
  }
  bucket.lastStatusCode = input.statusCode;
  bucket.lastUpdatedAt = Date.now();
}

export function getGrpcRoutePerformanceSnapshot(): GrpcRoutePerformanceSnapshot {
  let totalRequests = 0;
  let totalErrors = 0;
  let lastUpdatedAt: number | null = null;
  const routes: GrpcRoutePerformanceStats[] = [];

  for (const [routeId, bucket] of routeBuckets.entries()) {
    const summary = summarizeRoute(routeId, bucket);
    totalRequests += summary.count;
    totalErrors += summary.errors;
    if (summary.lastUpdatedAt != null) {
      lastUpdatedAt = Math.max(lastUpdatedAt ?? summary.lastUpdatedAt, summary.lastUpdatedAt);
    }
    routes.push(summary);
  }

  routes.sort((a, b) => a.routeId.localeCompare(b.routeId));

  return {
    totalRequests,
    totalErrors,
    recordedRouteCount: routes.length,
    lastUpdatedAt,
    routes,
  };
}

export function resetGrpcRoutePerformanceTelemetry(): void {
  routeBuckets.clear();
}
