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
