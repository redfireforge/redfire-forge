#!/usr/bin/env tsx
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import libCoverage from 'istanbul-lib-coverage';

const BATCH_DIR = 'coverage/batches';
const OUT = 'coverage/coverage-final.json';

if (!existsSync(BATCH_DIR)) {
  console.error(`❌ No batch coverage directory: ${BATCH_DIR}`);
  process.exit(1);
}

const map = libCoverage.createCoverageMap({});

for (const batch of readdirSync(BATCH_DIR, { withFileTypes: true })) {
  if (!batch.isDirectory()) continue;
  const path = `${BATCH_DIR}/${batch.name}/coverage-final.json`;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    map.merge(libCoverage.createCoverageMap(raw));
  } catch {
    console.warn(`⚠ skipped missing batch coverage: ${path}`);
  }
}

if (map.files().length === 0) {
  console.error('❌ No batch coverage maps found to merge');
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify(map.toJSON(), null, 2));
console.log(`✅ Merged ${map.files().length} file(s) into ${OUT}`);
