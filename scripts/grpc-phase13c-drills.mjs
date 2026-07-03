#!/usr/bin/env node

/**
 * Phase 13C failure drill harness for gRPC routes.
 * Verifies common failure paths return controlled envelopes/status codes
 * (no route-level regressions to unexpected 5xx behavior).
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13c-drills.json';

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    outPath: DEFAULT_OUT_PATH,
    requireLive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const [flag, inlineValue] = raw.split('=');
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
      case '--timeout-ms':
        args.timeoutMs = Number.parseInt(value, 10);
        break;
      case '--out':
        if (value) args.outPath = value;
        break;
      case '--require-live':
        args.requireLive = true;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }

  return args;
}

async function requestJson({ method, url, timeoutMs, body }) {
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

function ensureEnvelopeCode(result, expectedCode) {
  return result.json
    && result.json.ok === false
    && result.json.error
    && result.json.error.code === expectedCode;
}

function base(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

const DRILLS = [
  {
    id: 'invalid_request_reflect_array_body',
    description: 'POST /api/grpc/reflect with array body should return GRPC_INVALID_REQUEST (400)',
    async run(args) {
      const result = await requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/reflect'),
        timeoutMs: args.timeoutMs,
        body: [],
      });
      const passed = result.status === 400 && ensureEnvelopeCode(result, 'GRPC_INVALID_REQUEST');
      return {
        passed,
        expected: 'HTTP 400 + error.code=GRPC_INVALID_REQUEST',
        actual: `HTTP ${result.status} + error.code=${result.json?.error?.code ?? 'n/a'}`,
        result,
      };
    },
  },
  {
    id: 'stream_send_unknown_stream_not_found',
    description: 'POST /api/grpc/stream/:id/send on missing stream should return GRPC_REQUEST_NOT_FOUND (404)',
    async run(args) {
      const result = await requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/stream/phase13c-missing-stream/send?tabId=phase13c-drill'),
        timeoutMs: args.timeoutMs,
        body: { body: { message: 'phase13c' } },
      });
      const passed = result.status === 404 && ensureEnvelopeCode(result, 'GRPC_REQUEST_NOT_FOUND');
      return {
        passed,
        expected: 'HTTP 404 + error.code=GRPC_REQUEST_NOT_FOUND',
        actual: `HTTP ${result.status} + error.code=${result.json?.error?.code ?? 'n/a'}`,
        result,
      };
    },
  },
  {
    id: 'status_unreachable_target_controlled_error',
    description: 'GET /api/grpc/status against unreachable target should return a controlled envelope (reachable=false or GRPC_UNREACHABLE)',
    async run(args) {
      const result = await requestJson({
        method: 'GET',
        url: base(
          args.baseUrl,
          '/api/grpc/status?address=127.0.0.1:1&tlsMode=disabled&timeoutMs=600',
        ),
        timeoutMs: args.timeoutMs,
      });
      const successUnreachable = result.status === 200
        && result.json?.ok === true
        && result.json?.data?.reachable === false;
      const errorUnreachable = result.status === 503
        && ensureEnvelopeCode(result, 'GRPC_UNREACHABLE');
      const passed = successUnreachable || errorUnreachable;
      return {
        passed,
        expected: 'HTTP 200 + data.reachable=false OR HTTP 503 + error.code=GRPC_UNREACHABLE',
        actual: `HTTP ${result.status} + ok=${result.json?.ok ?? 'n/a'} + reachable=${result.json?.data?.reachable ?? 'n/a'} + error.code=${result.json?.error?.code ?? 'n/a'}`,
        result,
      };
    },
  },
  {
    id: 'lookup_descriptor_missing_not_found',
    description: 'POST /api/grpc/descriptor/lookup with unknown key should return controlled descriptor error',
    async run(args) {
      const result = await requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/descriptor/lookup'),
        timeoutMs: args.timeoutMs,
        body: { descriptorKey: 'phase13c-missing-descriptor-key' },
      });
      const isNotFound = result.status === 404 && ensureEnvelopeCode(result, 'GRPC_REQUEST_NOT_FOUND');
      const isInvalidDescriptor = result.status === 400 && ensureEnvelopeCode(result, 'GRPC_INVALID_DESCRIPTOR');
      const passed = isNotFound || isInvalidDescriptor;
      return {
        passed,
        expected: 'HTTP 404 + error.code=GRPC_REQUEST_NOT_FOUND OR HTTP 400 + error.code=GRPC_INVALID_DESCRIPTOR',
        actual: `HTTP ${result.status} + error.code=${result.json?.error?.code ?? 'n/a'}`,
        result,
      };
    },
  },
  {
    id: 'k8s_start_invalid_request_body',
    description: 'POST /api/grpc/k8s-port-forward/start with array body should return GRPC_INVALID_REQUEST (400)',
    async run(args) {
      const result = await requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/k8s-port-forward/start'),
        timeoutMs: args.timeoutMs,
        body: [],
      });
      const passed = result.status === 400 && ensureEnvelopeCode(result, 'GRPC_INVALID_REQUEST');
      return {
        passed,
        expected: 'HTTP 400 + error.code=GRPC_INVALID_REQUEST',
        actual: `HTTP ${result.status} + error.code=${result.json?.error?.code ?? 'n/a'}`,
        result,
      };
    },
  },
  {
    id: 'k8s_stop_invalid_request_body',
    description: 'POST /api/grpc/k8s-port-forward/stop with array body should return GRPC_INVALID_REQUEST (400)',
    async run(args) {
      const result = await requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/k8s-port-forward/stop'),
        timeoutMs: args.timeoutMs,
        body: [],
      });
      const passed = result.status === 400 && ensureEnvelopeCode(result, 'GRPC_INVALID_REQUEST');
      return {
        passed,
        expected: 'HTTP 400 + error.code=GRPC_INVALID_REQUEST',
        actual: `HTTP ${result.status} + error.code=${result.json?.error?.code ?? 'n/a'}`,
        result,
      };
    },
  },
];

async function checkServerLive(args) {
  const result = await requestJson({
    method: 'GET',
    url: base(args.baseUrl, '/api/grpc/describe/usage'),
    timeoutMs: args.timeoutMs,
  });
  return result.ok && result.status === 200 && result.json?.ok === true;
}

async function ensureDirectoryFor(filePath) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeReport(filePath, report) {
  const fs = await import('node:fs/promises');
  await ensureDirectoryFor(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const live = await checkServerLive(args);

  const report = {
    kind: 'grpc_phase13c_failure_drills',
    capturedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    timeoutMs: args.timeoutMs,
    live,
    totals: {
      total: DRILLS.length,
      passed: 0,
      failed: 0,
    },
    drills: [],
  };

  if (!live && args.requireLive) {
    await writeReport(args.outPath, report);
    console.error('[grpc-phase13c] Server is not reachable for drills.');
    console.error(`[grpc-phase13c] Report written: ${args.outPath}`);
    process.exit(1);
  }

  for (const drill of DRILLS) {
    const outcome = await drill.run(args);
    report.drills.push({
      id: drill.id,
      description: drill.description,
      passed: outcome.passed,
      expected: outcome.expected,
      actual: outcome.actual,
      elapsedMs: outcome.result.elapsedMs,
      status: outcome.result.status,
      errorCode: outcome.result.json?.error?.code ?? null,
      errorMessage: outcome.result.json?.error?.message ?? outcome.result.error ?? null,
    });
    if (outcome.passed) {
      report.totals.passed += 1;
      console.log(`[grpc-phase13c] PASS ${drill.id}`);
    } else {
      report.totals.failed += 1;
      console.error(`[grpc-phase13c] FAIL ${drill.id}: ${outcome.actual}`);
    }
  }

  await writeReport(args.outPath, report);
  console.log(`[grpc-phase13c] Drill report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    process.exit(1);
  }

  console.log('[grpc-phase13c] All failure drills passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13c] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
