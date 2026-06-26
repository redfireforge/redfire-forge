#!/usr/bin/env node
/** Replace CSS variables in lesson concept SVG diagrams with fixed dark-theme hex (GQL-3 bar). */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
    'packages/demo-hub/src/lessons/protocols/graphql-auth-headers.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-https-tls.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-mutations.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-subscriptions.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-collections-history.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-query-builder.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-export-share.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-performance-tracing.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-schema-diff.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-mock-server.ts',
    'packages/demo-hub/src/lessons/protocols/graphql-workflow-integration.ts',
  ];

const REPS = [
  [/color-mix\(in srgb, var\(--primary\) 15%, var\(--surface\)\)/g, '#243044'],
  [/color-mix\(in srgb, var\(--primary\) 12%, var\(--surface\)\)/g, '#1f3048'],
  [/color-mix\(in srgb, var\(--primary\) 10%, var\(--surface\)\)/g, '#1a2740'],
  [/color-mix\(in srgb, var\(--primary\) 8%, var\(--surface\)\)/g, '#152238'],
  [/color-mix\(in srgb, var\(--primary\) 4%, var\(--bg\)\)/g, '#101a28'],
  [/color-mix\(in srgb, var\(--primary\) 50%, var\(--surface\)\)/g, '#1f4a8a'],
  [/color-mix\(in srgb, #28c840 15%, var\(--surface\)\)/g, '#1a3324'],
  [/color-mix\(in srgb, #28c840 10%, var\(--surface\)\)/g, '#1a3028'],
  [/color-mix\(in srgb, #28c840 8%, var\(--surface\)\)/g, '#192e26'],
  [/color-mix\(in srgb, #28c840 20%, var\(--surface\)\)/g, '#1e3a2a'],
  [/color-mix\(in srgb, #f59e0b 12%, var\(--surface\)\)/g, '#2d2a1a'],
  [/color-mix\(in srgb, #a78bfa 12%, var\(--surface\)\)/g, '#2a1f3d'],
  [/color-mix\(in srgb, #a78bfa 10%, var\(--surface\)\)/g, '#281f38'],
  [/color-mix\(in srgb, #a78bfa 20%, var\(--surface\)\)/g, '#2e2245'],
  [/color-mix\(in srgb, #7c3aed 20%, var\(--surface\)\)/g, '#2a1f42'],
  [/color-mix\(in srgb, #7c3aed 15%, var\(--surface\)\)/g, '#271e3d'],
  [/color-mix\(in srgb, #7c3aed 12%, var\(--surface\)\)/g, '#251c38'],
  [/color-mix\(in srgb, #ef4444 15%, var\(--surface\)\)/g, '#3a1f1f'],
  [/color-mix\(in srgb, #ef4444 10%, var\(--surface\)\)/g, '#321c1c'],
  [/var\(--surface-hover\)/g, '#2d3a4d'],
  [/var\(--text-muted\)/g, '#a8b8cc'],
  [/var\(--surface\)/g, '#1e293b'],
  [/var\(--border\)/g, '#3b4a60'],
  [/var\(--primary\)/g, '#3b82f6'],
  [/var\(--text\)/g, '#f1f5f9'],
  [/var\(--bg\)/g, '#0f172a'],
];

let failed = 0;
for (const f of FILES) {
  if (!existsSync(f)) {
    console.warn('skip missing', f);
    continue;
  }
  let s = readFileSync(f, 'utf8');
  const start = s.indexOf('diagram: `<svg');
  if (start < 0) {
    console.warn('no diagram', f);
    continue;
  }
  const end = s.indexOf('</svg>`', start);
  if (end < 0) {
    console.warn('no diagram end', f);
    continue;
  }
  let diagram = s.slice(start, end + 7);
  for (const [re, sub] of REPS) diagram = diagram.replace(re, sub);
  if (diagram.includes('var(--')) {
    console.error('remaining CSS vars in', f);
    failed++;
  }
  s = s.slice(0, start) + diagram + s.slice(end + 7);
  writeFileSync(f, s);
  console.log('updated', f);
}
process.exit(failed > 0 ? 1 : 0);
