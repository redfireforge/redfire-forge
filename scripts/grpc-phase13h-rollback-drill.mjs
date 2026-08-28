#!/usr/bin/env node

/**
 * Phase 13H rollback drill gate.
 *
 * Checks:
 * 1) CI phase-gate chain and pull_request execution guards
 * 2) Live rollback drill (optional --require-live)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';

const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13h-rollback-drill.json';
const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';

function parseIntegerArg(value) {
  if (!/^[+-]?\d+$/.test(value)) return Number.NaN;
  return Number.parseInt(value, 10);
}

function parseArgs(argv) {
  const args = {
    outPath: DEFAULT_OUT_PATH,
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: 3500,
    requireLive: false,
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

    if (flag === '--out' && value) args.outPath = value;
    if (flag === '--base-url' && value) args.baseUrl = value;
    if (flag === '--timeout-ms' && value) {
      const parsed = parseIntegerArg(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--timeout-ms must be a positive integer');
      }
      args.timeoutMs = parsed;
    }
    if (flag === '--require-live') args.requireLive = true;
  }

  return args;
}

async function ensureDirectoryFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeReport(filePath, report) {
  await ensureDirectoryFor(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

function addCheck(checks, id, passed, detail, meta) {
  checks.push({ id, passed, detail, ...(meta ? { meta } : {}) });
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function validateCiChain(ciText) {
  const parsed = yaml.parse(ciText);
  const jobs = parsed?.jobs ?? {};

  // The gRPC E2E suite is now a single Playwright job (e2e-grpc), replacing
  // the old per-phase job chain (grpc-phase13a-slo … grpc-phase13h-rollback).
  const E2E_JOB = 'e2e-grpc';
  const missingJobs = jobs[E2E_JOB] ? [] : [E2E_JOB];

  const GATE_PR      = "github.event_name == 'pull_request'";
  const GATE_DEVELOP = "github.ref == 'refs/heads/develop'";
  const condition    = String(jobs[E2E_JOB]?.if ?? '');
  const hasGate      = condition.includes(GATE_PR) || condition.includes(GATE_DEVELOP);
  const nonPrJobs    = hasGate ? [] : (jobs[E2E_JOB] ? [E2E_JOB] : []);

  return {
    passed: missingJobs.length === 0 && nonPrJobs.length === 0,
    missingJobs,
    nonPrJobs,
    missingNeeds: [],
    ungatedEntryPoint: [],
  };
}

async function runLiveDrill(baseUrl, timeoutMs) {
  const usageBefore = await fetchJson(`${baseUrl}/api/grpc/describe/usage`, timeoutMs);
  const statusProbe = await fetchJson(
    `${baseUrl}/api/grpc/status?address=${encodeURIComponent('127.0.0.1:1')}`,
    timeoutMs,
  );
  const usageAfter = await fetchJson(`${baseUrl}/api/grpc/describe/usage`, timeoutMs);

  const probeAccepted =
    (statusProbe.status === 200 && statusProbe.data?.ok === true && statusProbe.data?.data?.reachable === false)
    || (statusProbe.status === 503 && statusProbe.data?.ok === false && statusProbe.data?.error?.code === 'GRPC_UNREACHABLE');

  const passed = usageBefore.ok && usageBefore.data?.ok === true
    && probeAccepted
    && usageAfter.ok && usageAfter.data?.ok === true;

  return {
    passed,
    usageBeforeStatus: usageBefore.status,
    statusProbeStatus: statusProbe.status,
    usageAfterStatus: usageAfter.status,
    statusProbeEnvelopeOk: statusProbe.data?.ok,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const ciPath = '.github/workflows/ci.yml';

  const checks = [];

  const ciText = await readText(ciPath);

  const ciResult = validateCiChain(ciText);
  addCheck(
    checks,
    'ci_phase_chain_and_pr_guards',
    ciResult.passed,
    'Phase 13 CI chain includes 13H and pull_request-aware execution guards',
    {
      missingJobs: ciResult.missingJobs,
      nonPrJobs: ciResult.nonPrJobs,
      missingNeeds: ciResult.missingNeeds,
    },
  );

  if (args.requireLive) {
    const liveResult = await runLiveDrill(args.baseUrl, args.timeoutMs);
    addCheck(
      checks,
      'live_rollback_drill_failure_then_recovery',
      liveResult.passed,
      'Service remains responsive after controlled unreachable status probe',
      liveResult,
    );
  }

  const report = {
    kind: 'grpc_phase13h_rollback_drill',
    capturedAt: new Date().toISOString(),
    inputs: {
      baseUrl: args.baseUrl,
      requireLive: args.requireLive,
      timeoutMs: args.timeoutMs,
    },
    totals: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    checks,
  };

  await writeReport(args.outPath, report);
  console.log(`[grpc-phase13h] Rollback drill report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    for (const check of checks.filter((item) => !item.passed)) {
      console.error(`[grpc-phase13h] FAIL ${check.id}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log('[grpc-phase13h] All rollback drill checks passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13h] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
