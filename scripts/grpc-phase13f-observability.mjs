#!/usr/bin/env node

/**
 * Phase 13F observability taxonomy + redaction audit checks.
 * Deterministic static checks to keep telemetry route IDs and redaction primitives aligned.
 */

const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13f-observability.json';

function parseArgs(argv) {
  const args = {
    outPath: DEFAULT_OUT_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;

    const [flag, inlineValue] = raw.split('=');
    const nextValue = argv[index + 1];
    const hasSeparateValue = inlineValue == null && nextValue != null && !nextValue.startsWith('--');
    const value = inlineValue ?? (hasSeparateValue ? nextValue : '');
    if (hasSeparateValue) index += 1;

    if (flag === '--out' && value) {
      args.outPath = value;
    }
  }

  return args;
}

async function readText(filePath) {
  const fs = await import('node:fs/promises');
  return fs.readFile(filePath, 'utf8');
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

function uniq(values) {
  return [...new Set(values)];
}

function collectTaxonomyRouteIds(taxonomyText) {
  const ids = [];
  const regex = /routeId:\s*GRPC_ROUTE_IDS\.([A-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(taxonomyText)) != null) {
    ids.push(match[1]);
  }
  return uniq(ids);
}

function collectRouteIdConstants(taxonomyText) {
  const constants = [];
  const regex = /\b([A-Z][A-Z0-9_]+):\s*'[^']+'/g;
  let match;
  while ((match = regex.exec(taxonomyText)) != null) {
    constants.push(match[1]);
  }
  return uniq(constants);
}

function collectRouteUsageKeys(routesText) {
  const keys = [];
  const regex = /routeId:\s*GRPC_ROUTE_IDS\.([A-Z0-9_]+)/g;
  let match;
  while ((match = regex.exec(routesText)) != null) {
    keys.push(match[1]);
  }
  return uniq(keys);
}

function mainChecks({ routesText, taxonomyText, redactionText }) {
  const taxonomyIds = collectTaxonomyRouteIds(taxonomyText);
  const declaredRouteConstants = collectRouteIdConstants(taxonomyText);
  const routeUsageKeys = collectRouteUsageKeys(routesText);

  const checks = [
    {
      id: 'routes_use_taxonomy_constants_only',
      passed: !/routeId:\s*'[^']+'/.test(routesText),
      detail: 'gRPC routes should not use literal routeId strings in telemetry calls',
    },
    {
      id: 'route_usage_keys_exist_in_taxonomy',
      passed: routeUsageKeys.every((key) => declaredRouteConstants.includes(key)),
      detail: 'Every route telemetry key in grpc-routes.ts is declared in GRPC_ROUTE_IDS',
    },
    {
      id: 'taxonomy_covers_all_route_constants',
      passed: declaredRouteConstants.every((key) => taxonomyIds.includes(key)),
      detail: 'Every declared GRPC_ROUTE_IDS constant appears in GRPC_ROUTE_TAXONOMY',
    },
    {
      id: 'taxonomy_route_constants_are_used_in_routes',
      passed: taxonomyIds.every((key) => routeUsageKeys.includes(key)),
      detail: 'Every taxonomy route id is exercised by route performance logging in grpc-routes.ts',
    },
    {
      id: 'redaction_exports_cover_sensitive_surfaces',
      passed: [
        'redactGrpcMetadataForDisplay',
        'redactGrpcMetadataForExport',
        'redactGrpcAuthConfig',
        'redactGrpcTlsConfig',
        'sanitizeGrpcErrorMessage',
        'redactGrpcNestedValueForExport',
      ].every((symbol) => redactionText.includes(`function ${symbol}`)),
      detail: 'Required redaction functions exist for display/export/auth/TLS/error surfaces',
    },
    {
      id: 'redaction_patterns_cover_core_secrets',
      passed: [
        'PEM_IN_TEXT_PATTERN',
        'BEARER_IN_TEXT_PATTERN',
        'BASIC_IN_TEXT_PATTERN',
        'GRPC_REDACTED_PLACEHOLDER',
        'GRPC_REDACTED_PEM_PLACEHOLDER',
      ].every((token) => redactionText.includes(token)),
      detail: 'Core token and PEM sanitization markers are present in grpcRedaction.ts',
    },
  ];

  return {
    checks,
    stats: {
      declaredRouteConstants: declaredRouteConstants.length,
      taxonomyRouteIds: taxonomyIds.length,
      usedRouteIdsInRoutes: routeUsageKeys.length,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const routesPath = 'src-server/routes/grpc/grpc-routes.ts';
  const taxonomyPath = 'src-server/grpc/grpcObservabilityTaxonomy.ts';
  const redactionPath = 'src/shared/grpc/grpcRedaction.ts';

  const [routesText, taxonomyText, redactionText] = await Promise.all([
    readText(routesPath),
    readText(taxonomyPath),
    readText(redactionPath),
  ]);

  const outcome = mainChecks({ routesText, taxonomyText, redactionText });
  const checks = outcome.checks;

  const report = {
    kind: 'grpc_phase13f_observability_audit',
    capturedAt: new Date().toISOString(),
    totals: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    stats: outcome.stats,
    checks,
  };

  await writeReport(args.outPath, report);
  console.log(`[grpc-phase13f] Observability audit report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    for (const check of checks.filter((item) => !item.passed)) {
      console.error(`[grpc-phase13f] FAIL ${check.id}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log('[grpc-phase13f] Observability taxonomy and redaction audit checks passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13f] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
