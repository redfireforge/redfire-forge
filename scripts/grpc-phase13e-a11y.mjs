#!/usr/bin/env node

/**
 * Phase 13E static accessibility + virtualization checks.
 * This complements runtime drill gates with deterministic source-level assertions.
 */

const DEFAULT_OUT_PATH = 'artifacts/grpc-phase13e-a11y.json';

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

async function readText(filePath) {
  const fs = await import('node:fs/promises');
  return fs.readFile(filePath, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const panelPath = 'src/features/grpc/components/GrpcSchemaDiffPanel.tsx';
  const cssPath = 'src/styles/grpc-studio.css';

  const [panelText, cssText] = await Promise.all([
    readText(panelPath),
    readText(cssPath),
  ]);

  const checks = [
    {
      id: 'schema_diff_list_has_role_list',
      passed: panelText.includes('role="list"'),
      detail: 'Schema diff list uses role=list',
    },
    {
      id: 'schema_diff_rows_have_listitem_role',
      passed: panelText.includes('role="listitem"'),
      detail: 'Schema diff rows expose role=listitem',
    },
    {
      id: 'schema_diff_status_live_region',
      passed: panelText.includes('aria-live="polite"') && panelText.includes('role="status"'),
      detail: 'Status region announces updates for assistive tech',
    },
    {
      id: 'schema_diff_virtualization_threshold_defined',
      passed: panelText.includes('SCHEMA_DIFF_VIRTUALIZATION_THRESHOLD'),
      detail: 'Virtualization threshold constant exists',
    },
    {
      id: 'schema_diff_virtualized_list_class_used',
      passed: panelText.includes('grpc-advanced-diff-list--virtual'),
      detail: 'Schema diff panel toggles virtualized list class',
    },
    {
      id: 'schema_diff_virtualized_list_style_defined',
      passed: cssText.includes('.grpc-advanced-diff-list--virtual'),
      detail: 'Virtualized list class has CSS definition',
    },
  ];

  const report = {
    kind: 'grpc_phase13e_a11y_checks',
    capturedAt: new Date().toISOString(),
    totals: {
      total: checks.length,
      passed: checks.filter((check) => check.passed).length,
      failed: checks.filter((check) => !check.passed).length,
    },
    checks,
  };

  await writeReport(args.outPath, report);
  console.log(`[grpc-phase13e] A11y report written: ${args.outPath}`);

  if (report.totals.failed > 0) {
    for (const check of checks.filter((item) => !item.passed)) {
      console.error(`[grpc-phase13e] FAIL ${check.id}: ${check.detail}`);
    }
    process.exit(1);
  }

  console.log('[grpc-phase13e] All a11y/virtualization checks passed.');
}

main().catch((error) => {
  console.error('[grpc-phase13e] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
