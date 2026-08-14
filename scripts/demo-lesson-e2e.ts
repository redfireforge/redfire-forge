#!/usr/bin/env node
/**
 * Resolve a demo lesson touch path/id to the relevant Playwright E2E command.
 *
 *   npx tsx scripts/demo-lesson-e2e.ts grpc-first-call
 *   npx tsx scripts/demo-lesson-e2e.ts packages/demo-hub/src/lessons/protocols/graphql-mutations.ts
 */
import { spawnSync } from 'node:child_process';

const NPM_E2E: Record<string, string> = {
  'graphql-first-query': 'test:e2e:demo:gql1',
  'graphql-variables': 'test:e2e:demo:gql2',
  'graphql-schema-exploration': 'test:e2e:demo:gql3',
  'graphql-auth-headers': 'test:e2e:demo:gql4',
  'graphql-https-tls': 'test:e2e:demo:gql5',
  'graphql-mutations': 'test:e2e:demo:gql6',
  'graphql-subscriptions': 'test:e2e:demo:gql7',
  'graphql-query-builder': 'test:e2e:demo:gql8',
  'graphql-collections-history': 'test:e2e:demo:gql9',
  'graphql-export-share': 'test:e2e:demo:gql10',
  'graphql-performance-tracing': 'test:e2e:demo:gql11',
  'graphql-schema-diff': 'test:e2e:demo:gql12',
  'graphql-mock-server': 'test:e2e:demo:gql13',
  'graphql-multi-tab': 'test:e2e:demo:gql14',
  'graphql-batch-execution': 'test:e2e:demo:gql15',
  'graphql-workflow-integration': 'test:e2e:demo:gql16',
  'graphql-workflow-runner': 'test:e2e:demo:gql17',
  'graphql-workflow-mutation': 'test:e2e:demo:gql18',
  'graphql-workflow-subscription': 'test:e2e:demo:gql19',
  'graphql-workspace-isolation': 'test:e2e:demo:gql110',
  'grpc-first-call': 'test:e2e:demo:grpc1',
  // API Mock curriculum v2 — entries land as each lesson ships (AM-01 … AM-24).
  'am-01-studio-tour': 'test:e2e:demo:am01',
  'api-mock-am01': 'test:e2e:demo:am01',
  'am-02-multi-server': 'test:e2e:demo:am02',
  'api-mock-am02': 'test:e2e:demo:am02',
  'am-03-rule-library': 'test:e2e:demo:am03',
  'api-mock-am03': 'test:e2e:demo:am03',
  'am-04-path-matching': 'test:e2e:demo:am04',
  'api-mock-am04': 'test:e2e:demo:am04',
  'am-05-request-predicates': 'test:e2e:demo:am05',
  'api-mock-am05': 'test:e2e:demo:am05',
  'am-06-body-matching': 'test:e2e:demo:am06',
  'api-mock-am06': 'test:e2e:demo:am06',
  'am-07-payload-formats': 'test:e2e:demo:am07',
  'api-mock-am07': 'test:e2e:demo:am07',
  'am-08-selection-policy': 'test:e2e:demo:am08',
  'api-mock-am08': 'test:e2e:demo:am08',
  'am-09-conflicts': 'test:e2e:demo:am09',
  'api-mock-am09': 'test:e2e:demo:am09',
  'am-10-response-content': 'test:e2e:demo:am10',
  'api-mock-am10': 'test:e2e:demo:am10',
  'am-11-templating': 'test:e2e:demo:am11',
  'api-mock-am11': 'test:e2e:demo:am11',
  'am-12-variants-sequence': 'test:e2e:demo:am12',
  'api-mock-am12': 'test:e2e:demo:am12',
  'am-13-stateful': 'test:e2e:demo:am13',
  'api-mock-am13': 'test:e2e:demo:am13',
  'am-14-timing-faults': 'test:e2e:demo:am14',
  'api-mock-am14': 'test:e2e:demo:am14',
  'am-15-import': 'test:e2e:demo:am15',
  'api-mock-am15': 'test:e2e:demo:am15',
  'am-16-export': 'test:e2e:demo:am16',
  'api-mock-am16': 'test:e2e:demo:am16',
  'am-17-proxy-record': 'test:e2e:demo:am17',
  'api-mock-am17': 'test:e2e:demo:am17',
  'am-18-journal': 'test:e2e:demo:am18',
  'api-mock-am18': 'test:e2e:demo:am18',
  'am-19-runtime-ops': 'test:e2e:demo:am19',
  'api-mock-am19': 'test:e2e:demo:am19',
  'am-20-tls-mtls': 'test:e2e:demo:am20',
  'api-mock-am20': 'test:e2e:demo:am20',
  'am-21-simulation-suite': 'test:e2e:demo:am21',
  'api-mock-am21': 'test:e2e:demo:am21',
  'am-22-workflow': 'test:e2e:demo:am22',
  'api-mock-am22': 'test:e2e:demo:am22',
  'am-23-harness-ci': 'test:e2e:demo:am23',
  'api-mock-am23': 'test:e2e:demo:am23',
  'am-24-capstone': 'test:e2e:demo:am24',
  'api-mock-am24': 'test:e2e:demo:am24',
};

const PLAYWRIGHT_E2E: Record<string, string[]> = {
  'ws-workflow-builder': [
    'playwright', 'test', '--project=demo-stepthrough',
    'e2e/demo-ws-workflow-builder.spec.ts', '--reporter=html', '--workers=1',
  ],
  'demo-hub-validate': [
    'playwright', 'test', 'e2e/demo-hub-validate.spec.ts',
    '--reporter=html', '--workers=1',
  ],
};

const HUB_CORE_E2E = 'demo-hub-validate';

function stemFromInput(input: string): string {
  const normalized = input.replace(/\\/g, '/');
  const leaf = normalized.split('/').pop() ?? input;
  return leaf
    .replace(/\.spec\.ts$/, '')
    .replace(/\.tsx$/, '')
    .replace(/\.ts$/, '');
}

function resolveE2e(input: string): { kind: 'npm' | 'playwright' | 'none'; value: string; hint?: string } {
  const stem = stemFromInput(input);

  if (NPM_E2E[stem]) {
    return { kind: 'npm', value: NPM_E2E[stem] };
  }

  const helperMatch = stem.match(/^lesson(\d+)-/);
  if (helperMatch) {
    const n = helperMatch[1]!;
    if (n === '110') return { kind: 'npm', value: 'test:e2e:demo:gql110' };
    const num = Number(n);
    if (num >= 1 && num <= 19) {
      return { kind: 'npm', value: `test:e2e:demo:gql${n}` };
    }
  }

  if (PLAYWRIGHT_E2E[stem]) {
    return { kind: 'playwright', value: PLAYWRIGHT_E2E[stem].join(' ') };
  }

  if (
    stem.startsWith('useDemo')
    || stem.startsWith('LiveDemo')
    || stem.startsWith('LessonPlayer')
    || stem.startsWith('DemoHub')
    || stem.startsWith('demoLiveGuard')
  ) {
    const cmd = PLAYWRIGHT_E2E[HUB_CORE_E2E]!;
    return { kind: 'playwright', value: cmd.join(' '), hint: 'demo hub core' };
  }

  if (stem.startsWith('demo-gql-')) {
    return {
      kind: 'none',
      value: '',
      hint: `E2E spec "${stem}" — run matching npm run test:e2e:demo:gql* script from package.json`,
    };
  }

  return {
    kind: 'none',
    value: '',
    hint: 'No dedicated step-through E2E — unit/scope coverage only unless you add a spec',
  };
}

const input = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const dryRun = process.argv.includes('--dry-run');

if (!input) {
  console.error('Usage: npx tsx scripts/demo-lesson-e2e.ts <lesson-id-or-path> [--dry-run]');
  process.exit(1);
}

const resolved = resolveE2e(input);

if (resolved.kind === 'none') {
  console.log(resolved.hint ?? 'No E2E mapped for this input.');
  process.exit(0);
}

if (resolved.hint) {
  console.log(`ℹ ${resolved.hint}`);
}

if (resolved.kind === 'npm') {
  console.log(`▶ npm run ${resolved.value}`);
  if (dryRun) process.exit(0);
  const result = spawnSync('npm', ['run', resolved.value], { stdio: 'inherit', shell: false });
  process.exit(result.status ?? 1);
}

console.log(`▶ ${resolved.value}`);
if (dryRun) process.exit(0);
const args = resolved.value.split(/\s+/);
const result = spawnSync('npx', args, { stdio: 'inherit', shell: false });
process.exit(result.status ?? 1);
