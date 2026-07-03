#!/usr/bin/env node

/**
 * Phase 13I final GA sign-off checks.
 * Aggregates upstream Phase 13 artifacts and CI wiring checks into one report.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';

const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13i-ga-signoff.json';
const DEFAULT_MAX_ARTIFACT_AGE_DAYS = 14;

function parseArgs(argv) {
  const args = {
    outPath: DEFAULT_OUT_PATH,
    maxArtifactAgeDays: DEFAULT_MAX_ARTIFACT_AGE_DAYS,
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
    if (flag === '--max-artifact-age-days' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) args.maxArtifactAgeDays = parsed;
    }
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

function normalizeNeeds(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function addCheck(checks, id, passed, detail, meta) {
  checks.push({ id, passed, detail, ...(meta ? { meta } : {}) });
}

function daysSince(isoTimestamp) {
  const at = Date.parse(isoTimestamp);
  if (!Number.isFinite(at)) return Number.POSITIVE_INFINITY;
  return (Date.now() - at) / (1000 * 60 * 60 * 24);
}

function isReportPassing(report) {
  const failed = Number(report?.totals?.failed);
  return Number.isFinite(failed) && failed === 0;
}

async function evaluateArtifact(checks, options) {
  const { id, label, candidates, maxArtifactAgeDays } = options;

  const resolved = [];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      resolved.push(candidate);
    } catch {
      // continue
    }
  }

  if (resolved.length === 0) {
    addCheck(checks, `${id}_artifact_present`, false, `${label} artifact exists`, { candidates });
    addCheck(checks, `${id}_artifact_passed`, false, `${label} artifact reports zero failures`, {
      selectedArtifact: null,
    });
    addCheck(checks, `${id}_artifact_fresh`, false, `${label} artifact is recent`, {
      maxArtifactAgeDays,
      capturedAt: null,
    });
    return;
  }

  const selectedArtifact = resolved[0];
  const payloadText = await fs.readFile(selectedArtifact, 'utf8');
  const payload = JSON.parse(payloadText);
  const capturedAt = typeof payload?.capturedAt === 'string' ? payload.capturedAt : null;
  const ageDays = capturedAt ? daysSince(capturedAt) : Number.POSITIVE_INFINITY;

  addCheck(checks, `${id}_artifact_present`, true, `${label} artifact exists`, {
    selectedArtifact,
    candidates,
  });

  addCheck(checks, `${id}_artifact_passed`, isReportPassing(payload), `${label} artifact reports zero failures`, {
    selectedArtifact,
    failed: payload?.totals?.failed ?? null,
    total: payload?.totals?.total ?? null,
    passed: payload?.totals?.passed ?? null,
  });

  addCheck(checks, `${id}_artifact_fresh`, Number.isFinite(ageDays) && ageDays <= maxArtifactAgeDays, `${label} artifact is recent`, {
    selectedArtifact,
    capturedAt,
    ageDays: Number.isFinite(ageDays) ? Math.round(ageDays * 100) / 100 : null,
    maxArtifactAgeDays,
  });
}

async function evaluateCiChain(checks) {
  const ciPath = '.github/workflows/ci.yml';
  const ciText = await fs.readFile(ciPath, 'utf8');
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
    'grpc-phase13i-ga-signoff',
  ];

  const missingJobs = phaseJobs.filter((jobId) => !jobs[jobId]);
  addCheck(
    checks,
    'ci_has_phase13_jobs_through_13i',
    missingJobs.length === 0,
    'CI workflow defines Phase 13 jobs through 13I',
    { missingJobs },
  );

  const nonPrJobs = phaseJobs.filter((jobId) => {
    const condition = String(jobs[jobId]?.if ?? '');
    return !condition.includes("github.event_name == 'pull_request'");
  });
  addCheck(
    checks,
    'ci_phase13_jobs_include_pr_guard',
    nonPrJobs.length === 0,
    'All Phase 13 jobs include pull_request event guard',
    { nonPrJobs },
  );

  const expectedNeeds = [
    ['grpc-phase13b-slo', 'grpc-phase13a-slo'],
    ['grpc-phase13c-drills', 'grpc-phase13b-slo'],
    ['grpc-phase13d-recovery', 'grpc-phase13c-drills'],
    ['grpc-phase13e-a11y', 'grpc-phase13d-recovery'],
    ['grpc-phase13f-observability', 'grpc-phase13e-a11y'],
    ['grpc-phase13h-rollback', 'grpc-phase13f-observability'],
    ['grpc-phase13i-ga-signoff', 'grpc-phase13h-rollback'],
  ];
  const missingNeeds = [];
  for (const [jobId, dependency] of expectedNeeds) {
    const needs = normalizeNeeds(jobs[jobId]?.needs);
    if (!needs.includes(dependency)) {
      missingNeeds.push({ jobId, dependency, actualNeeds: needs });
    }
  }
  addCheck(
    checks,
    'ci_phase13_needs_chain_is_ordered',
    missingNeeds.length === 0,
    'Phase 13 CI dependency chain preserves A->...->H->I order',
    { missingNeeds },
  );
}

async function evaluateNpmScripts(checks) {
  const packageText = await fs.readFile('package.json', 'utf8');
  const pkg = JSON.parse(packageText);
  const scripts = pkg?.scripts ?? {};

  const requiredScripts = [
    'grpc:phase13a:gate',
    'grpc:phase13b:gate',
    'grpc:phase13c:gate',
    'grpc:phase13d:gate',
    'grpc:phase13e:gate',
    'grpc:phase13f:gate',
    'grpc:phase13h:gate',
    'grpc:phase13i:gate',
  ];
  const missingScripts = requiredScripts.filter((scriptName) => typeof scripts[scriptName] !== 'string');

  addCheck(
    checks,
    'npm_phase13_gate_scripts_present',
    missingScripts.length === 0,
    'package.json exposes gate scripts for Phase 13A..13I checkpoints',
    { missingScripts },
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [];

  await evaluateNpmScripts(checks);
  await evaluateCiChain(checks);

  const artifactTargets = [
    {
      id: 'phase13c',
      label: 'Phase 13C failure drills',
      candidates: [
        'artifacts/grpc-phase13c-drills.validation.json',
        'artifacts/grpc-phase13c-drills.json',
      ],
    },
    {
      id: 'phase13d',
      label: 'Phase 13D recovery drills',
      candidates: [
        'artifacts/grpc-phase13d-recovery.validation.json',
        'artifacts/grpc-phase13d-recovery.json',
      ],
    },
    {
      id: 'phase13e',
      label: 'Phase 13E accessibility gate',
      candidates: ['artifacts/grpc-phase13e-a11y.json'],
    },
    {
      id: 'phase13f',
      label: 'Phase 13F observability gate',
      candidates: ['artifacts/grpc-phase13f-observability.json'],
    },
    {
      id: 'phase13h',
      label: 'Phase 13H rollback drill gate',
      candidates: ['artifacts/grpc-phase13h-rollback-drill.json'],
    },
  ];

  for (const target of artifactTargets) {
    await evaluateArtifact(checks, {
      ...target,
      maxArtifactAgeDays: args.maxArtifactAgeDays,
    });
  }

  const report = {
    kind: 'grpc_phase13i_ga_signoff',
    capturedAt: new Date().toISOString(),
    inputs: {
      maxArtifactAgeDays: args.maxArtifactAgeDays,
    },
    totals: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    checks,
  };

  await writeReport(args.outPath, report);
  console.log(`[grpc-phase13i] GA sign-off report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    for (const check of checks.filter((item) => !item.passed)) {
      console.error(`[grpc-phase13i] FAIL ${check.id}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log('[grpc-phase13i] Final GA sign-off checks passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13i] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});