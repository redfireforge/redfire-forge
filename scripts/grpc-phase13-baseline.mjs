#!/usr/bin/env node

/**
 * Phase 13A baseline harness for gRPC Studio control-plane route latency.
 * Captures route timing snapshots and optionally enforces SLO thresholds.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_SAMPLES = 12;
const DEFAULT_PROBE_SAMPLES = 3;
const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13a-baseline.json';

const FIXTURE_ECHO_PROTO = `syntax = "proto3";

package echo;

message EchoRequest {
  string message = 1;
}

message EchoResponse {
  string message = 1;
}

service EchoService {
  rpc Echo(EchoRequest) returns (EchoResponse);
  rpc ClientStream(stream EchoRequest) returns (EchoResponse);
}
`;

const ROUTES = [
  {
    id: 'describe_usage',
    method: 'GET',
    path: '/api/grpc/describe/usage',
  },
  {
    id: 'k8s_status',
    method: 'GET',
    path: '/api/grpc/k8s-port-forward/status?scopeId=phase13a-baseline',
  },
];

function parseIntegerArg(value) {
  if (!/^[+-]?\d+$/.test(value)) return Number.NaN;
  return Number.parseInt(value, 10);
}

function parseNumberArg(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number(trimmed);
}

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    samples: DEFAULT_SAMPLES,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    outPath: DEFAULT_OUT_PATH,
    maxP95Ms: undefined,
    maxAvgMs: undefined,
    maxErrorRate: undefined,
    probeGrpcTarget: undefined,
    probeSamples: DEFAULT_PROBE_SAMPLES,
    requireDataPlane: false,
    requireLive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const equalsIndex = raw.indexOf('=');
    const flag = equalsIndex >= 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex >= 0 ? raw.slice(equalsIndex + 1) : undefined;
    const nextValue = argv[index + 1];
    const hasSeparateValue = inlineValue == null && nextValue != null && !nextValue.startsWith('--');
    const value = inlineValue ?? (hasSeparateValue ? nextValue : '');
    if (hasSeparateValue) {
      index += 1;
    }
    switch (flag) {
      case '--base-url':
        if (value) args.baseUrl = value;
        break;
      case '--samples':
        args.samples = parseIntegerArg(value);
        break;
      case '--timeout-ms':
        args.timeoutMs = parseIntegerArg(value);
        break;
      case '--out':
        if (value) args.outPath = value;
        break;
      case '--max-p95-ms':
        args.maxP95Ms = parseNumberArg(value);
        break;
      case '--max-avg-ms':
        args.maxAvgMs = parseNumberArg(value);
        break;
      case '--max-error-rate':
        args.maxErrorRate = parseNumberArg(value);
        break;
      case '--probe-grpc-target':
        if (value) args.probeGrpcTarget = value;
        break;
      case '--probe-samples':
        args.probeSamples = parseIntegerArg(value);
        break;
      case '--require-data-plane':
        args.requireDataPlane = true;
        break;
      case '--require-live':
        args.requireLive = true;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(args.samples) || args.samples <= 0) {
    throw new Error('--samples must be a positive integer');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  if (!Number.isFinite(args.probeSamples) || args.probeSamples <= 0) {
    throw new Error('--probe-samples must be a positive integer');
  }
  if (args.maxP95Ms != null && (!Number.isFinite(args.maxP95Ms) || args.maxP95Ms <= 0)) {
    throw new Error('--max-p95-ms must be a positive number');
  }
  if (args.maxAvgMs != null && (!Number.isFinite(args.maxAvgMs) || args.maxAvgMs <= 0)) {
    throw new Error('--max-avg-ms must be a positive number');
  }
  if (args.maxErrorRate != null && (!Number.isFinite(args.maxErrorRate) || args.maxErrorRate < 0 || args.maxErrorRate > 1)) {
    throw new Error('--max-error-rate must be a number between 0 and 1');
  }

  return args;
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  const safeIndex = Math.max(0, Math.min(sortedValues.length - 1, index));
  return sortedValues[safeIndex];
}

function summarize(samples, totalErrors) {
  if (!samples.length) {
    return {
      count: 0,
      avgMs: 0,
      minMs: 0,
      maxMs: 0,
      p95Ms: 0,
      errorRate: totalErrors > 0 ? 1 : 0,
    };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((acc, value) => acc + value, 0);
  return {
    count: samples.length,
    avgMs: Math.round((sum / samples.length) * 100) / 100,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    p95Ms: percentile(sorted, 95),
    errorRate: Math.round((totalErrors / (samples.length + totalErrors)) * 10000) / 10000,
  };
}

async function requestWithTiming({ method, url, timeoutMs, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const endedAt = performance.now();
    const elapsedMs = Math.round((endedAt - startedAt) * 100) / 100;
    let json;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs,
      json,
    };
  } catch (error) {
    const endedAt = performance.now();
    const elapsedMs = Math.round((endedAt - startedAt) * 100) / 100;
    return {
      ok: false,
      status: 0,
      elapsedMs,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRoutePerfSnapshot(baseUrl, timeoutMs) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/grpc/perf/snapshot`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      return {
        ok: false,
        error: `HTTP ${response.status}`,
      };
    }
    const body = await response.json();
    if (!body || body.ok !== true || typeof body.data !== 'object') {
      return {
        ok: false,
        error: 'Invalid perf snapshot payload',
      };
    }
    return {
      ok: true,
      data: body.data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function collectRouteMetrics(baseUrl, route, samples, timeoutMs) {
  const url = `${baseUrl.replace(/\/$/, '')}${route.path}`;
  const timings = [];
  const errors = [];

  for (let i = 0; i < samples; i += 1) {
    const result = await requestWithTiming({ method: 'GET', url, timeoutMs });
    if (result.ok) {
      timings.push(result.elapsedMs);
    } else {
      errors.push({
        status: result.status,
        message: result.error ?? `HTTP ${result.status}`,
      });
    }
  }

  return {
    routeId: route.id,
    method: route.method,
    path: route.path,
    summary: summarize(timings, errors.length),
    errors,
  };
}

async function bootstrapDescriptorForDataPlane(baseUrl, timeoutMs) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/grpc/describe`;
  const result = await requestWithTiming({
    method: 'POST',
    url,
    timeoutMs,
    body: {
      source: 'proto_files',
      protoRoots: [
        {
          id: 'root-default',
          mountPath: 'root',
          files: [
            {
              path: 'echo.proto',
              content: FIXTURE_ECHO_PROTO,
            },
          ],
        },
      ],
    },
  });
  if (!result.ok || result.json?.ok !== true || typeof result.json?.data?.key !== 'string') {
    return {
      ok: false,
      error: result.error ?? (result.status ? `Describe failed (HTTP ${result.status})` : 'Describe failed'),
    };
  }
  return {
    ok: true,
    descriptorKey: result.json.data.key,
  };
}

async function collectUnaryProbeMetrics(baseUrl, targetAddress, descriptorKey, samples, timeoutMs) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/grpc/call`;
  const timings = [];
  const errors = [];

  for (let i = 0; i < samples; i += 1) {
    const requestId = `phase13b-unary-${Date.now()}-${i}`;
    const result = await requestWithTiming({
      method: 'POST',
      url,
      timeoutMs,
      body: {
        callType: 'unary',
        requestId,
        target: { address: targetAddress, tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: `phase13b-${i}` },
        metadata: {},
        timeoutMs,
        descriptorKey,
      },
    });
    if (result.ok && result.json?.ok === true) {
      timings.push(result.elapsedMs);
    } else {
      errors.push({
        status: result.status,
        message: result.json?.error?.message ?? result.error ?? `HTTP ${result.status}`,
      });
    }
  }

  return {
    routeId: 'data_unary_call',
    method: 'POST',
    path: '/api/grpc/call',
    summary: summarize(timings, errors.length),
    errors,
  };
}

async function collectClientStreamLifecycleMetrics(baseUrl, targetAddress, descriptorKey, samples, timeoutMs) {
  const tabId = 'phase13b-probe';
  const startUrl = `${baseUrl.replace(/\/$/, '')}/api/grpc/stream/start?tabId=${encodeURIComponent(tabId)}`;
  const timings = [];
  const errors = [];

  for (let i = 0; i < samples; i += 1) {
    const requestId = `phase13b-stream-${Date.now()}-${i}`;
    const startedAt = performance.now();
    const start = await requestWithTiming({
      method: 'POST',
      url: startUrl,
      timeoutMs,
      body: {
        callType: 'client_streaming',
        requestId,
        target: { address: targetAddress, tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'ClientStream',
        body: { message: '' },
        timeoutMs,
        descriptorKey,
      },
    });

    const streamId = start.json?.data?.streamId;
    if (!start.ok || start.json?.ok !== true || typeof streamId !== 'string') {
      errors.push({
        status: start.status,
        message: start.json?.error?.message ?? start.error ?? `stream/start failed (HTTP ${start.status})`,
      });
      continue;
    }

    const send = await requestWithTiming({
      method: 'POST',
      url: `${baseUrl.replace(/\/$/, '')}/api/grpc/stream/${encodeURIComponent(streamId)}/send?tabId=${encodeURIComponent(tabId)}`,
      timeoutMs,
      body: {
        body: { message: `phase13b-${i}` },
      },
    });
    if (!send.ok || send.json?.ok !== true) {
      errors.push({
        status: send.status,
        message: send.json?.error?.message ?? send.error ?? `stream/send failed (HTTP ${send.status})`,
      });
      continue;
    }

    const end = await requestWithTiming({
      method: 'POST',
      url: `${baseUrl.replace(/\/$/, '')}/api/grpc/stream/${encodeURIComponent(streamId)}/end?tabId=${encodeURIComponent(tabId)}`,
      timeoutMs,
    });
    if (!end.ok || end.json?.ok !== true) {
      errors.push({
        status: end.status,
        message: end.json?.error?.message ?? end.error ?? `stream/end failed (HTTP ${end.status})`,
      });
      continue;
    }

    const endedAt = performance.now();
    timings.push(Math.round((endedAt - startedAt) * 100) / 100);
  }

  return {
    routeId: 'data_stream_lifecycle',
    method: 'POST',
    path: '/api/grpc/stream/*',
    summary: summarize(timings, errors.length),
    errors,
  };
}

async function collectDataPlaneProbe(baseUrl, targetAddress, samples, timeoutMs) {
  if (!targetAddress) {
    return {
      enabled: false,
      targetAddress: null,
      samples,
      routes: [],
      skippedReason: 'No probe target configured (set --probe-grpc-target=host:port).',
    };
  }

  const descriptor = await bootstrapDescriptorForDataPlane(baseUrl, timeoutMs);
  if (!descriptor.ok) {
    return {
      enabled: true,
      targetAddress,
      samples,
      descriptorKey: null,
      routes: [],
      bootstrapError: descriptor.error,
    };
  }

  const [unary, streamLifecycle] = await Promise.all([
    collectUnaryProbeMetrics(baseUrl, targetAddress, descriptor.descriptorKey, samples, timeoutMs),
    collectClientStreamLifecycleMetrics(baseUrl, targetAddress, descriptor.descriptorKey, samples, timeoutMs),
  ]);

  return {
    enabled: true,
    targetAddress,
    samples,
    descriptorKey: descriptor.descriptorKey,
    routes: [unary, streamLifecycle],
  };
}

function evaluateThresholds(report, thresholds) {
  const failures = [];
  for (const route of report.routes) {
    const label = `${route.routeId} (${route.path})`;
    if (thresholds.maxP95Ms != null && route.summary.p95Ms > thresholds.maxP95Ms) {
      failures.push(`${label}: p95 ${route.summary.p95Ms}ms > ${thresholds.maxP95Ms}ms`);
    }
    if (thresholds.maxAvgMs != null && route.summary.avgMs > thresholds.maxAvgMs) {
      failures.push(`${label}: avg ${route.summary.avgMs}ms > ${thresholds.maxAvgMs}ms`);
    }
    if (thresholds.maxErrorRate != null && route.summary.errorRate > thresholds.maxErrorRate) {
      failures.push(`${label}: errorRate ${route.summary.errorRate} > ${thresholds.maxErrorRate}`);
    }
  }
  return failures;
}

async function ensureDirectoryFor(filePath) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function writeReport(filePath, report) {
  const fs = await import('node:fs/promises');
  await ensureDirectoryFor(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  const routes = [];
  for (const route of ROUTES) {
    // Keep route probes serialized to avoid noisy local contention during baseline capture.
    const metrics = await collectRouteMetrics(args.baseUrl, route, args.samples, args.timeoutMs);
    routes.push(metrics);
  }

  const totalProbes = routes.reduce((acc, route) => acc + route.summary.count + route.errors.length, 0);
  const successfulProbes = routes.reduce((acc, route) => acc + route.summary.count, 0);
  const failedProbes = totalProbes - successfulProbes;

  const report = {
    kind: 'grpc_phase13a_control_plane_baseline',
    capturedAt: new Date().toISOString(),
    startedAt,
    baseUrl: args.baseUrl,
    samplesPerRoute: args.samples,
    timeoutMs: args.timeoutMs,
    thresholds: {
      maxP95Ms: args.maxP95Ms ?? null,
      maxAvgMs: args.maxAvgMs ?? null,
      maxErrorRate: args.maxErrorRate ?? null,
    },
    totals: {
      totalProbes,
      successfulProbes,
      failedProbes,
      successRate: totalProbes > 0 ? Math.round((successfulProbes / totalProbes) * 10000) / 10000 : 0,
    },
    routes,
    routePerformanceSnapshot: null,
    routePerformanceSnapshotError: null,
    dataPlaneProbe: null,
  };

  report.dataPlaneProbe = await collectDataPlaneProbe(
    args.baseUrl,
    args.probeGrpcTarget,
    args.probeSamples,
    args.timeoutMs,
  );

  const perfSnapshot = await fetchRoutePerfSnapshot(args.baseUrl, args.timeoutMs);
  if (perfSnapshot.ok) {
    report.routePerformanceSnapshot = perfSnapshot.data;
  } else {
    report.routePerformanceSnapshotError = perfSnapshot.error;
  }

  await writeReport(args.outPath, report);

  const liveUnavailable = successfulProbes === 0;
  if (liveUnavailable && args.requireLive) {
    console.error('[grpc-phase13] No successful probes. Is the server running?');
    console.error(`[grpc-phase13] Report written: ${args.outPath}`);
    process.exit(1);
  }

  const thresholdFailures = evaluateThresholds(report, {
    maxP95Ms: args.maxP95Ms,
    maxAvgMs: args.maxAvgMs,
    maxErrorRate: args.maxErrorRate,
  });

  if (args.requireDataPlane) {
    const probe = report.dataPlaneProbe;
    if (!probe || probe.enabled !== true) {
      thresholdFailures.push('Data-plane probe required but no --probe-grpc-target was provided.');
    } else if (probe.bootstrapError) {
      thresholdFailures.push(`Data-plane descriptor bootstrap failed: ${probe.bootstrapError}`);
    } else if (!Array.isArray(probe.routes) || probe.routes.length === 0) {
      thresholdFailures.push('Data-plane probe required but no probe routes were executed.');
    } else {
      for (const route of probe.routes) {
        if (route.summary.count === 0 || route.summary.errorRate > 0) {
          thresholdFailures.push(
            `${route.routeId} (${route.path}) data-plane probe failed (count=${route.summary.count}, errorRate=${route.summary.errorRate}).`,
          );
        }
      }
    }
  }

  console.log(`[grpc-phase13] Baseline report written: ${args.outPath}`);
  if (liveUnavailable) {
    console.warn('[grpc-phase13] Warning: no successful probes captured. Threshold checks skipped.');
    return;
  }

  if (thresholdFailures.length > 0) {
    for (const failure of thresholdFailures) {
      console.error(`[grpc-phase13] SLO gate failed: ${failure}`);
    }
    process.exit(1);
  }

  console.log('[grpc-phase13] SLO gate passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
