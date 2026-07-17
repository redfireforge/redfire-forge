#!/usr/bin/env node
/**
 * Verifies Standard (VITE_ENABLE_DEMO_HUB=false) production build does not load
 * demo-hub lesson/runtime code at runtime. Orphan async chunks on disk are OK.
 *
 * Usage: node scripts/audit-prod-demo-bundle.mjs
 * Prerequisite: npm run build:prod (runs automatically if dist/ missing)
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

const DEMO_NEEDLE = [
  'useDemoHub',
  'LiveDemo',
  'DemoHub',
  'demo-player',
  'packages/demo-hub',
  'purgeGqlDemoEphemeralStorage',
  'graphql-lesson-helpers',
  'LessonPlayer',
  'DomainSelector',
];

const ORPHAN_CHUNK_PREFIXES = [
  'DemoShellHost-',
  'gql-demo-',
];

/** Allowed in modulepreload — stub API only, no lesson tree */
const ALLOWED_PRELOAD_SUBSTRINGS = ['demoHubRuntimeRef-'];

function humanKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fileSize(path) {
  return statSync(path).size;
}

function grepFile(path, needles) {
  const text = readFileSync(path, 'utf8');
  return needles.filter((n) => text.includes(n));
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.log('dist/ missing — running npm run build:prod …');
  execSync('npm run build:prod', { cwd: ROOT, stdio: 'inherit' });
}

const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
const entryMatch = indexHtml.match(/src="(\/assets\/index-[^"]+\.js)"/);
if (!entryMatch) {
  console.error('FAIL: could not find main entry in dist/index.html');
  process.exit(1);
}

const entryJs = join(DIST, entryMatch[1].replace(/^\//, ''));
const preloads = [...indexHtml.matchAll(/href="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);

console.log('=== RedfireForge Standard build — demo bundle audit ===\n');
console.log(`Entry: ${entryMatch[1]} (${humanKb(fileSize(entryJs))})`);
console.log(`Modulepreloads: ${preloads.length}`);

const entryHits = grepFile(entryJs, DEMO_NEEDLE);
if (entryHits.length > 0) {
  console.error('\nFAIL: main entry bundle contains demo strings:', entryHits.join(', '));
  process.exit(1);
}
console.log('\n✓ Main entry has no demo-hub runtime strings');

const loadedJs = new Set([entryMatch[1], ...preloads]);
const orphanDemoChunks = [];
let orphanDemoBytes = 0;

for (const name of readdirSync(ASSETS)) {
  if (!name.endsWith('.js')) continue;
  const isOrphanCandidate = ORPHAN_CHUNK_PREFIXES.some((p) => name.startsWith(p));
  if (!isOrphanCandidate) continue;
  const path = `/assets/${name}`;
  const size = fileSize(join(ASSETS, name));
  if (!loadedJs.has(path)) {
    orphanDemoChunks.push({ name, size });
    orphanDemoBytes += size;
  }
}

console.log('\n--- Orphan demo-related chunks (on disk, not in index.html) ---');
if (orphanDemoChunks.length === 0) {
  console.log('(none)');
} else {
  for (const { name, size } of orphanDemoChunks.sort((a, b) => b.size - a.size)) {
    console.log(`  ${name}  ${humanKb(size)}`);
  }
  console.log(`  Total orphan: ${humanKb(orphanDemoBytes)} (not downloaded unless dynamically imported)`);
}

const preloadDemo = preloads.filter((p) => {
  if (ALLOWED_PRELOAD_SUBSTRINGS.some((s) => p.includes(s))) return false;
  return ORPHAN_CHUNK_PREFIXES.some((prefix) => p.includes(prefix.replace(/-$/, '')));
});
if (preloadDemo.length > 0) {
  console.error('\nFAIL: index.html modulepreloads demo chunks:', preloadDemo.join(', '));
  process.exit(1);
}

// demoHubRuntimeRef stub is acceptable if tiny and contains no lesson code
const runtimePreload = preloads.find((p) => p.includes('demoHubRuntimeRef'));
if (runtimePreload) {
  const rtPath = join(DIST, runtimePreload.replace(/^\//, ''));
  const rtHits = grepFile(rtPath, ['useDemoHub', 'LessonPlayer', 'graphql-lesson']);
  console.log(`\n--- demoHubRuntimeRef preload (${humanKb(fileSize(rtPath))}) ---`);
  if (rtHits.length > 0) {
    console.error('FAIL: demoHubRuntimeRef chunk contains lesson code:', rtHits.join(', '));
    process.exit(1);
  }
  console.log('✓ Stub-only runtime ref (no lesson tree)');
}

console.log('\n=== PASS: Standard build does not load demo-hub at startup ===');
console.log('Note: orphan DemoShellHost chunk may remain on disk; verify it is not referenced from entry.');
