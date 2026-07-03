#!/usr/bin/env node

/**
 * Phase 13D recovery and graceful degradation drills.
 * Induce controlled failures, then verify service recovers immediately
 * and key control-plane routes remain healthy.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_TIMEOUT_MS = 3500;
const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13d-recovery.json';

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
    if (hasSeparateValue) index += 1;

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

function base(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
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

function isControlledError(result, expectedStatuses, expectedCodes) {
  return expectedStatuses.includes(result.status)
    && result.json?.ok === false
    && expectedCodes.includes(result.json?.error?.code);
}

async function verifyRecoveryProbe(args) {
  const result = await requestJson({
    method: 'GET',
    url: base(args.baseUrl, '/api/grpc/describe/usage'),
    timeoutMs: args.timeoutMs,
  });
  const passed = result.status === 200 && result.json?.ok === true;
  return {
    passed,
    result,
  };
}

const SCENARIOS = [
  {
    id: 'recover_after_invalid_reflect_request',
    description: 'Service remains healthy after invalid reflect payload',
    async failStep(args) {
      return requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/reflect'),
        timeoutMs: args.timeoutMs,
        body: [],
      });
    },
    validateFail(result) {
      return isControlledError(result, [400], ['GRPC_INVALID_REQUEST']);
    },
    expectedFail: 'HTTP 400 + error.code=GRPC_INVALID_REQUEST',
  },
  {
    id: 'recover_after_missing_stream_send',
    description: 'Service remains healthy after stream send on missing stream id',
    async failStep(args) {
      return requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/stream/phase13d-missing/send?tabId=phase13d-drill'),
        timeoutMs: args.timeoutMs,
        body: { body: { message: 'phase13d' } },
      });
    },
    validateFail(result) {
      return isControlledError(result, [404], ['GRPC_REQUEST_NOT_FOUND']);
    },
    expectedFail: 'HTTP 404 + error.code=GRPC_REQUEST_NOT_FOUND',
  },
  {
    id: 'recover_after_unreachable_status_probe',
    description: 'Service remains healthy after unreachable status probe',
    async failStep(args) {
      return requestJson({
        method: 'GET',
        url: base(args.baseUrl, '/api/grpc/status?address=127.0.0.1:1&tlsMode=disabled&timeoutMs=600'),
        timeoutMs: args.timeoutMs,
      });
    },
    validateFail(result) {
      const asSuccessEnvelope = result.status === 200 && result.json?.ok === true && result.json?.data?.reachable === false;
      const asErrorEnvelope = isControlledError(result, [503], ['GRPC_UNREACHABLE']);
      return asSuccessEnvelope || asErrorEnvelope;
    },
    expectedFail: 'HTTP 200 + data.reachable=false OR HTTP 503 + error.code=GRPC_UNREACHABLE',
  },
  {
    id: 'recover_after_invalid_call_payload',
    description: 'Service remains healthy after invalid /api/grpc/call payload',
    async failStep(args) {
      return requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/call'),
        timeoutMs: args.timeoutMs,
        body: [],
      });
    },
    validateFail(result) {
      return isControlledError(result, [400], ['GRPC_INVALID_REQUEST']);
    },
    expectedFail: 'HTTP 400 + error.code=GRPC_INVALID_REQUEST',
  },
  {
    id: 'recover_after_missing_descriptor_lookup',
    description: 'Service remains healthy after lookup_descriptor unknown key',
    async failStep(args) {
      return requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/descriptor/lookup'),
        timeoutMs: args.timeoutMs,
        body: { descriptorKey: 'phase13d-missing-descriptor-key' },
      });
    },
    validateFail(result) {
      const notFound = isControlledError(result, [404], ['GRPC_REQUEST_NOT_FOUND']);
      const invalidDescriptor = isControlledError(result, [400], ['GRPC_INVALID_DESCRIPTOR']);
      return notFound || invalidDescriptor;
    },
    expectedFail: 'HTTP 404 + GRPC_REQUEST_NOT_FOUND OR HTTP 400 + GRPC_INVALID_DESCRIPTOR',
  },
  {
    id: 'recover_after_invalid_k8s_start_payload',
    description: 'Service remains healthy after invalid k8s port-forward start payload',
    async failStep(args) {
      return requestJson({
        method: 'POST',
        url: base(args.baseUrl, '/api/grpc/k8s-port-forward/start'),
        timeoutMs: args.timeoutMs,
        body: [],
      });
    },
    validateFail(result) {
      return isControlledError(result, [400], ['GRPC_INVALID_REQUEST']);
    },
    expectedFail: 'HTTP 400 + error.code=GRPC_INVALID_REQUEST',
  },
];

async function checkServerLive(args) {
  const probe = await verifyRecoveryProbe(args);
  return probe.passed;
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
    kind: 'grpc_phase13d_recovery_drills',
    capturedAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    timeoutMs: args.timeoutMs,
    live,
    totals: {
      total: SCENARIOS.length,
      passed: 0,
      failed: 0,
    },
    scenarios: [],
  };

  if (!live && args.requireLive) {
    await writeReport(args.outPath, report);
    console.error('[grpc-phase13d] Server is not reachable for recovery drills.');
    console.error(`[grpc-phase13d] Report written: ${args.outPath}`);
    process.exit(1);
  }

  for (const scenario of SCENARIOS) {
    const failResult = await scenario.failStep(args);
    const failPassed = scenario.validateFail(failResult);
    const recoveryProbe = await verifyRecoveryProbe(args);
    const passed = failPassed && recoveryProbe.passed;

    report.scenarios.push({
      id: scenario.id,
      description: scenario.description,
      passed,
      expectedFailure: scenario.expectedFail,
      actualFailure: `HTTP ${failResult.status} + ok=${failResult.json?.ok ?? 'n/a'} + error.code=${failResult.json?.error?.code ?? 'n/a'} + reachable=${failResult.json?.data?.reachable ?? 'n/a'}`,
      recoveryExpected: 'HTTP 200 + ok=true on /api/grpc/describe/usage',
      recoveryActual: `HTTP ${recoveryProbe.result.status} + ok=${recoveryProbe.result.json?.ok ?? 'n/a'}`,
      failureElapsedMs: failResult.elapsedMs,
      recoveryElapsedMs: recoveryProbe.result.elapsedMs,
    });

    if (passed) {
      report.totals.passed += 1;
      console.log(`[grpc-phase13d] PASS ${scenario.id}`);
    } else {
      report.totals.failed += 1;
      console.error(`[grpc-phase13d] FAIL ${scenario.id}`);
    }
  }

  await writeReport(args.outPath, report);
  console.log(`[grpc-phase13d] Recovery drill report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    process.exit(1);
  }

  console.log('[grpc-phase13d] All recovery drills passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13d] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
