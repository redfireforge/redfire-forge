#!/usr/bin/env tsx
/**
 * Merge incoming Istanbul coverage into an existing map.
 * Per-statement/branch/function hits use MAX(base, incoming) so later partial
 * batches cannot downgrade coverage for files they only import transitively.
 *
 * Usage: tsx scripts/merge-coverage-map-into.ts <target.json> <incoming.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

type HitMap = Record<string, number>;
type BranchMap = Record<string, number[]>;

interface FileCov {
  path?: string;
  statementMap?: Record<string, unknown>;
  fnMap?: Record<string, unknown>;
  branchMap?: Record<string, unknown>;
  s?: HitMap;
  f?: HitMap;
  b?: BranchMap;
}

function maxHitMap(base: HitMap = {}, incoming: HitMap = {}): HitMap {
  const out: HitMap = { ...base };
  for (const [id, hits] of Object.entries(incoming)) {
    out[id] = Math.max(base[id] ?? 0, hits);
  }
  return out;
}

function maxBranchMap(base: BranchMap = {}, incoming: BranchMap = {}): BranchMap {
  const out: BranchMap = { ...base };
  for (const [id, hits] of Object.entries(incoming)) {
    const prev = base[id] ?? [];
    out[id] = hits.map((h, i) => Math.max(prev[i] ?? 0, h));
  }
  return out;
}

function mergeFileCov(base: FileCov, incoming: FileCov): FileCov {
  return {
    ...base,
    ...incoming,
    statementMap: { ...base.statementMap, ...incoming.statementMap },
    fnMap: { ...base.fnMap, ...incoming.fnMap },
    branchMap: { ...base.branchMap, ...incoming.branchMap },
    s: maxHitMap(base.s, incoming.s),
    f: maxHitMap(base.f, incoming.f),
    b: maxBranchMap(base.b, incoming.b),
  };
}

const [target, incomingPath] = process.argv.slice(2);
if (!target || !incomingPath) {
  console.error('Usage: tsx scripts/merge-coverage-map-into.ts <target.json> <incoming.json>');
  process.exit(1);
}

let store: Record<string, FileCov> = {};
try {
  store = JSON.parse(readFileSync(target, 'utf8')) as Record<string, FileCov>;
} catch {
  // target missing — incoming seeds the store
}

const incoming = JSON.parse(readFileSync(incomingPath, 'utf8')) as Record<string, FileCov>;
for (const [file, incCov] of Object.entries(incoming)) {
  const baseCov = store[file];
  store[file] = baseCov ? mergeFileCov(baseCov, incCov) : incCov;
}

writeFileSync(target, JSON.stringify(store, null, 2));
console.log(`✅ Merged ${Object.keys(store).length} file(s) into ${target}`);
