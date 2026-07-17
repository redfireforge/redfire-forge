#!/usr/bin/env node

/**
 * Post-GA P3-A — long-duration soak gate.
 *
 * Runs deterministic mixed probes over a configurable duration and emits
 * a machine-readable artifact with trend and threshold checks.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  computeGrowthMb,
  evaluateSoakChecks,
  summarizeLatencies,
} from '../src/shared/grpc/grpcSoakGateLib.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_DURATION_MIN = 30;
const DEFAULT_INTERVAL_SEC = 30;
const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_TARGET = '127.0.0.1:50051';
const DEFAULT_OUT_PATH = 'artifacts/grpc-soak-gate.json';

const DEFAULT_MAX_AVG_MS = 450;
const DEFAULT_MAX_P95_MS = 900;
const DEFAULT_MAX_ERROR_RATE = 0.03;
const DEFAULT_MAX_MEMORY_GROWTH_MB = 256;
const DEFAULT_MAX_HEAP_GROWTH_MB = 192;
const DEFAULT_MAX_STREAM_LEAK = 0;

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

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    durationMin: DEFAULT_DURATION_MIN,
    intervalSec: DEFAULT_INTERVAL_SEC,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    targetAddress: DEFAULT_TARGET,
    outPath: DEFAULT_OUT_PATH,
    maxAvgMs: DEFAULT_MAX_AVG_MS,
    maxP95Ms: DEFAULT_MAX_P95_MS,
    maxErrorRate: DEFAULT_MAX_ERROR_RATE,
    maxMemoryGrowthMb: DEFAULT_MAX_MEMORY_GROWTH_MB,
    maxHeapGrowthMb: DEFAULT_MAX_HEAP_GROWTH_MB,
    maxStreamLeak: DEFAULT_MAX_STREAM_LEAK,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith('--')) continue;

    const equalsIndex = raw.indexOf('=');
    const flag = equalsIndex >= 0 ? raw.slice(0, equalsIndex) : raw;
    const inlineValue = equalsIndex >= 0 ? raw.slice(equalsIndex + 1) : undefined;
    const nextValue = argv[i + 1];
    const hasSeparateValue = inlineValue == null && nextValue != null && !nextValue.startsWith('--');
    const value = inlineValue ?? (hasSeparateValue ? nextValue : '');
    if (hasSeparateValue) i += 1;

    if (flag === '--base-url' && value) args.baseUrl = value;
    if (flag === '--duration-min' && value) args.durationMin = parseNumberArg(value);
    if (flag === '--interval-sec' && value) args.intervalSec = parseNumberArg(value);
    if (flag === '--timeout-ms' && value) args.timeoutMs = parseIntegerArg(value);
    if (flag === '--target' && value) args.targetAddress = value;
    if (flag === '--out' && value) args.outPath = value;
    if (flag === '--max-avg-ms' && value) args.maxAvgMs = parseNumberArg(value);
    if (flag === '--max-p95-ms' && value) args.maxP95Ms = parseNumberArg(value);
    if (flag === '--max-error-rate' && value) args.maxErrorRate = parseNumberArg(value);
    if (flag === '--max-memory-growth-mb' && value) args.maxMemoryGrowthMb = parseNumberArg(value);
    if (flag === '--max-heap-growth-mb' && value) args.maxHeapGrowthMb = parseNumberArg(value);
    if (flag === '--max-stream-leak' && value) args.maxStreamLeak = parseIntegerArg(value);
  }

  if (!Number.isFinite(args.durationMin) || args.durationMin <= 0) {
    throw new Error('--duration-min must be a positive number');
  }
  if (!Number.isFinite(args.intervalSec) || args.intervalSec <= 0) {
    throw new Error('--interval-sec must be a positive number');
  }
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  if (!Number.isFinite(args.maxAvgMs) || args.maxAvgMs <= 0) {
    throw new Error('--max-avg-ms must be a positive number');
  }
  if (!Number.isFinite(args.maxP95Ms) || args.maxP95Ms <= 0) {
    throw new Error('--max-p95-ms must be a positive number');
  }
  if (!Number.isFinite(args.maxErrorRate) || args.maxErrorRate < 0 || args.maxErrorRate > 1) {
    throw new Error('--max-error-rate must be between 0 and 1');
  }
  if (!Number.isFinite(args.maxMemoryGrowthMb) || args.maxMemoryGrowthMb < 0) {
    throw new Error('--max-memory-growth-mb must be a non-negative number');
  }
  if (!Number.isFinite(args.maxHeapGrowthMb) || args.maxHeapGrowthMb < 0) {
    throw new Error('--max-heap-growth-mb must be a non-negative number');
  }
  if (!Number.isFinite(args.maxStreamLeak) || args.maxStreamLeak < 0) {
    throw new Error('--max-stream-leak must be a non-negative integer');
  }

  return args;
}

function toBaseUrl(baseUrl) {
  return baseUrl.replace(/\/$/, '');
}

async function requestWithTiming({ url, method, timeoutMs, body }) {
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

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      json,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Math.round((performance.now() - startedAt) * 100) / 100,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function isGrpcEnvelopeSuccess(result) {
  return result.ok && result.json?.ok === true;
}

function makeProbeRecorder() {
  return {
    opLatencies: [],
    operationsTotal: 0,
    operationsFailed: 0,
    failures: [],
    streamStarted: 0,
    streamEnded: 0,
    streamCancelled: 0,
  };
}

function recordProbe(recorder, probeId, result, isSuccess) {
  recorder.operationsTotal += 1;
  if (isSuccess) {
    recorder.opLatencies.push(result.elapsedMs);
    return;
  }

  recorder.operationsFailed += 1;
  recorder.failures.push({
    probeId,
    status: result.status,
    message: result.json?.error?.message ?? result.error ?? `HTTP ${result.status}`,
  });
}

async function bootstrapDescriptor(baseUrl, timeoutMs) {
  const result = await requestWithTiming({
    method: 'POST',
    url: `${toBaseUrl(baseUrl)}/api/grpc/describe`,
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

  if (!isGrpcEnvelopeSuccess(result) || typeof result.json?.data?.key !== 'string') {
    return {
      ok: false,
      error: result.json?.error?.message ?? result.error ?? `Describe failed (HTTP ${result.status})`,
    };
  }

  return {
    ok: true,
    descriptorKey: result.json.data.key,
  };
}

async function runUnaryProbe(baseUrl, timeoutMs, targetAddress, descriptorKey, sequence) {
  const requestId = `grpc-soak-unary-${Date.now()}-${sequence}`;
  return requestWithTiming({
    method: 'POST',
    url: `${toBaseUrl(baseUrl)}/api/grpc/call`,
    timeoutMs,
    body: {
      callType: 'unary',
      requestId,
      target: { address: targetAddress, tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'Echo',
      body: { message: `soak-unary-${sequence}` },
      metadata: {},
      timeoutMs,
      descriptorKey,
    },
  });
}

async function runClientStreamProbe(baseUrl, timeoutMs, targetAddress, descriptorKey, sequence, recorder) {
  const tabId = 'grpc-soak-gate';
  const requestId = `grpc-soak-stream-${Date.now()}-${sequence}`;
  const startRes = await requestWithTiming({
    method: 'POST',
    url: `${toBaseUrl(baseUrl)}/api/grpc/stream/start?tabId=${encodeURIComponent(tabId)}`,
    timeoutMs,
    body: {
      callType: 'client_streaming',
      requestId,
      target: { address: targetAddress, tlsMode: 'disabled' },
      service: 'echo.EchoService',
      method: 'ClientStream',
      body: { message: `seed-${sequence}` },
      metadata: {},
      timeoutMs,
      descriptorKey,
    },
  });

  const started = isGrpcEnvelopeSuccess(startRes) && typeof startRes.json?.data?.streamId === 'string';
  if (!started) {
    return {
      ok: false,
      phase: 'start',
      result: startRes,
    };
  }

  recorder.streamStarted += 1;
  const streamId = startRes.json.data.streamId;

  const sendRes = await requestWithTiming({
    method: 'POST',
    url: `${toBaseUrl(baseUrl)}/api/grpc/stream/${encodeURIComponent(streamId)}/send?tabId=${encodeURIComponent(tabId)}`,
    timeoutMs,
    body: { body: { message: `payload-${sequence}` } },
  });

  if (!isGrpcEnvelopeSuccess(sendRes)) {
    await requestWithTiming({
      method: 'DELETE',
      url: `${toBaseUrl(baseUrl)}/api/grpc/stream/${encodeURIComponent(streamId)}?tabId=${encodeURIComponent(tabId)}`,
      timeoutMs,
    });
    recorder.streamCancelled += 1;
    return {
      ok: false,
      phase: 'send',
      result: sendRes,
    };
  }

  const endRes = await requestWithTiming({
    method: 'POST',
    url: `${toBaseUrl(baseUrl)}/api/grpc/stream/${encodeURIComponent(streamId)}/end?tabId=${encodeURIComponent(tabId)}`,
    timeoutMs,
  });

  if (!isGrpcEnvelopeSuccess(endRes)) {
    await requestWithTiming({
      method: 'DELETE',
      url: `${toBaseUrl(baseUrl)}/api/grpc/stream/${encodeURIComponent(streamId)}?tabId=${encodeURIComponent(tabId)}`,
      timeoutMs,
    });
    recorder.streamCancelled += 1;
    return {
      ok: false,
      phase: 'end',
      result: endRes,
    };
  }

  recorder.streamEnded += 1;

  return {
    ok: true,
    result: {
      ok: true,
      status: 200,
      elapsedMs: startRes.elapsedMs + sendRes.elapsedMs + endRes.elapsedMs,
      json: { ok: true },
    },
  };
}

async function collectControlPlaneSnapshots(baseUrl, timeoutMs, recorder, perfSamples) {
  const usageRes = await requestWithTiming({
    method: 'GET',
    url: `${toBaseUrl(baseUrl)}/api/grpc/describe/usage`,
    timeoutMs,
  });
  recordProbe(recorder, 'describe_usage', usageRes, usageRes.ok && usageRes.json?.ok === true);

  const perfRes = await requestWithTiming({
    method: 'GET',
    url: `${toBaseUrl(baseUrl)}/api/grpc/perf/snapshot`,
    timeoutMs,
  });
  const perfOk = perfRes.ok && perfRes.json?.ok === true && typeof perfRes.json?.data?.totalRequests === 'number';
  recordProbe(recorder, 'perf_snapshot', perfRes, perfOk);
  if (perfOk) {
    perfSamples.push({
      at: Date.now(),
      totalRequests: perfRes.json.data.totalRequests,
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeReport(outPath, report) {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recorder = makeProbeRecorder();

  const boot = await bootstrapDescriptor(args.baseUrl, args.timeoutMs);
  if (!boot.ok) {
    const report = {
      kind: 'grpc_soak_gate',
      capturedAt: new Date().toISOString(),
      totals: { total: 1, passed: 0, failed: 1 },
      checks: [
        {
          id: 'descriptor_bootstrap',
          passed: false,
          detail: 'Failed to bootstrap descriptor for soak probes',
          meta: { error: boot.error },
        },
      ],
    };
    await writeReport(args.outPath, report);
    console.error(`[grpc-soak-gate] FAIL descriptor bootstrap: ${boot.error}`);
    process.exit(1);
  }

  const startUsage = process.memoryUsage();
  const memorySamples = [{
    at: Date.now(),
    rss: startUsage.rss,
    heapUsed: startUsage.heapUsed,
  }];
  const perfSamples = [];

  const startedAt = Date.now();
  const endAt = startedAt + args.durationMin * 60 * 1000;
  let iteration = 0;

  while (Date.now() < endAt) {
    iteration += 1;

    await collectControlPlaneSnapshots(args.baseUrl, args.timeoutMs, recorder, perfSamples);

    const unaryRes = await runUnaryProbe(
      args.baseUrl,
      args.timeoutMs,
      args.targetAddress,
      boot.descriptorKey,
      iteration,
    );
    recordProbe(recorder, 'unary_call', unaryRes, isGrpcEnvelopeSuccess(unaryRes));

    const streamProbe = await runClientStreamProbe(
      args.baseUrl,
      args.timeoutMs,
      args.targetAddress,
      boot.descriptorKey,
      iteration,
      recorder,
    );
    recordProbe(
      recorder,
      `client_stream_${streamProbe.phase ?? 'lifecycle'}`,
      streamProbe.result,
      streamProbe.ok,
    );

    const usage = process.memoryUsage();
    memorySamples.push({
      at: Date.now(),
      rss: usage.rss,
      heapUsed: usage.heapUsed,
    });

    const remainingMs = endAt - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(args.intervalSec * 1000, remainingMs));
  }

  const endedAt = Date.now();
  const endUsage = process.memoryUsage();
  memorySamples.push({
    at: endedAt,
    rss: endUsage.rss,
    heapUsed: endUsage.heapUsed,
  });

  const latencySummary = summarizeLatencies(recorder.opLatencies);
  const errorRate = recorder.operationsTotal === 0
    ? 1
    : Math.round((recorder.operationsFailed / recorder.operationsTotal) * 10000) / 10000;

  const rssGrowthMb = computeGrowthMb(startUsage.rss, endUsage.rss);
  const heapGrowthMb = computeGrowthMb(startUsage.heapUsed, endUsage.heapUsed);

  const peakRssMb = Math.max(...memorySamples.map((sample) => sample.rss)) / (1024 * 1024);
  const peakHeapMb = Math.max(...memorySamples.map((sample) => sample.heapUsed)) / (1024 * 1024);

  const evaluated = evaluateSoakChecks({
    latencySummary,
    errorRate,
    memoryGrowth: rssGrowthMb,
    heapGrowth: heapGrowthMb,
    streamStarted: recorder.streamStarted,
    streamEnded: recorder.streamEnded,
    streamCancelled: recorder.streamCancelled,
    perfSamples,
    maxAvgMs: args.maxAvgMs,
    maxP95Ms: args.maxP95Ms,
    maxErrorRate: args.maxErrorRate,
    maxMemoryGrowthMb: args.maxMemoryGrowthMb,
    maxHeapGrowthMb: args.maxHeapGrowthMb,
    maxStreamLeak: args.maxStreamLeak,
  });

  const checks = [
    {
      id: 'soak_duration_completed',
      passed: (endedAt - startedAt) >= (args.durationMin * 60 * 1000 * 0.95),
      detail: 'Executed requested soak duration window',
      meta: {
        requestedDurationMin: args.durationMin,
        observedDurationMin: Math.round(((endedAt - startedAt) / 60000) * 100) / 100,
      },
    },
    ...evaluated.checks,
  ];

  const report = {
    kind: 'grpc_soak_gate',
    capturedAt: new Date().toISOString(),
    inputs: {
      baseUrl: args.baseUrl,
      targetAddress: args.targetAddress,
      durationMin: args.durationMin,
      intervalSec: args.intervalSec,
      timeoutMs: args.timeoutMs,
      thresholds: {
        maxAvgMs: args.maxAvgMs,
        maxP95Ms: args.maxP95Ms,
        maxErrorRate: args.maxErrorRate,
        maxMemoryGrowthMb: args.maxMemoryGrowthMb,
        maxHeapGrowthMb: args.maxHeapGrowthMb,
        maxStreamLeak: args.maxStreamLeak,
      },
    },
    probeSummary: {
      iterations: iteration,
      operationsTotal: recorder.operationsTotal,
      operationsFailed: recorder.operationsFailed,
      errorRate,
      streamStarted: recorder.streamStarted,
      streamEnded: recorder.streamEnded,
      streamCancelled: recorder.streamCancelled,
      unresolvedStreams: evaluated.unresolvedStreams,
      latencySummary,
      failures: recorder.failures.slice(0, 30),
    },
    memorySummary: {
      rssGrowthMb,
      heapGrowthMb,
      peakRssMb: Math.round(peakRssMb * 100) / 100,
      peakHeapMb: Math.round(peakHeapMb * 100) / 100,
      sampleCount: memorySamples.length,
    },
    perfSummary: {
      sampleCount: perfSamples.length,
      startTotalRequests: perfSamples[0]?.totalRequests ?? null,
      endTotalRequests: perfSamples[perfSamples.length - 1]?.totalRequests ?? null,
    },
    totals: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    checks,
  };

  await writeReport(args.outPath, report);
  console.log(`[grpc-soak-gate] report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    for (const check of checks.filter((item) => !item.passed)) {
      console.error(`[grpc-soak-gate] FAIL ${check.id}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log('[grpc-soak-gate] Soak checks passed.');
}

main().catch((error) => {
  console.error('[grpc-soak-gate] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
