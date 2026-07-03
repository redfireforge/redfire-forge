#!/usr/bin/env node

/**
 * Phase 13H operational runbook + rollback drill gate.
 *
 * Checks:
 * 1) Runbook presence/required sections
 * 2) CI phase-gate chain and pull_request execution guards
 * 3) Live rollback drill (optional --require-live)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';

const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13h-rollback-drill.json';
const DEFAULT_BASE_URL = 'http://127.0.0.1:3001';

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

    const [flag, inlineValue] = raw.split('=');
    const nextValue = argv[i + 1];
    const hasSeparateValue = inlineValue == null && nextValue != null && !nextValue.startsWith('--');
    const value = inlineValue ?? (hasSeparateValue ? nextValue : '');
    if (hasSeparateValue) i += 1;

    if (flag === '--out' && value) args.outPath = value;
    if (flag === '--base-url' && value) args.baseUrl = value;
    if (flag === '--timeout-ms' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) args.timeoutMs = parsed;
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

function validateRunbookSections(runbookText) {
  const requiredHeadings = [
    '## Incident Triage',
    '## Rollback Decision Matrix',
    '## Immediate Rollback Procedure',
    '## Verification After Rollback',
    '## Artifact Checklist',
  ];

  const missing = requiredHeadings.filter((heading) => !runbookText.includes(heading));
  return {
    requiredCount: requiredHeadings.length,
    missing,
    passed: missing.length === 0,
  };
}

function validateCiChain(ciText) {
  const parsed = yaml.parse(ciText);
  const jobs = parsed?.jobs ?? {};

  const phaseJobs = [
    'grpc-phase13a-slo',
    'grpc-phase13b-slo',
    'grpc-phase13c-drills',
    'grpc-phase13d-recovery',
    'grpc-phase13e-a11y',
    'grpc-phase13f-observability',
    'grpc-phase13h-rollback',
  ];

  const missingJobs = phaseJobs.filter((jobId) => !jobs[jobId]);
  const nonPrJobs = phaseJobs.filter((jobId) => {
    const condition = String(jobs[jobId]?.if ?? '');
    return !condition.includes("github.event_name == 'pull_request'");
  });

  const dependencyChecks = [
    ['grpc-phase13b-slo', 'grpc-phase13a-slo'],
    ['grpc-phase13c-drills', 'grpc-phase13b-slo'],
    ['grpc-phase13d-recovery', 'grpc-phase13c-drills'],
    ['grpc-phase13e-a11y', 'grpc-phase13d-recovery'],
    ['grpc-phase13f-observability', 'grpc-phase13e-a11y'],
    ['grpc-phase13h-rollback', 'grpc-phase13f-observability'],
  ];

  const missingNeeds = [];
  for (const [jobId, needsJobId] of dependencyChecks) {
    const needsValue = jobs[jobId]?.needs;
    const normalized = Array.isArray(needsValue) ? needsValue : [needsValue].filter(Boolean);
    if (!normalized.includes(needsJobId)) {
      missingNeeds.push({ jobId, needsJobId, actual: normalized });
    }
  }

  return {
    passed: missingJobs.length === 0 && nonPrJobs.length === 0 && missingNeeds.length === 0,
    missingJobs,
    nonPrJobs,
    missingNeeds,
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

  const runbookPath = 'docs/guides/grpc-phase13h-operations-runbook.md';
  const ciPath = '.github/workflows/ci.yml';

  const checks = [];

  const [runbookText, ciText] = await Promise.all([
    readText(runbookPath),
    readText(ciPath),
  ]);

  const runbookResult = validateRunbookSections(runbookText);
  addCheck(
    checks,
    'runbook_required_sections_present',
    runbookResult.passed,
    'Phase 13H runbook contains mandatory operational and rollback sections',
    { missing: runbookResult.missing },
  );

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

  console.log('[grpc-phase13h] All operational runbook and rollback drill checks passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13h] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
