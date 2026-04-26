#!/usr/bin/env node
/**
 * Bulk import path updater for codebase restructuring.
 * Usage: node scripts/fix-imports.mjs <mapping-file.json>
 *
 * mapping-file.json: { "src/old/path.ts": "src/new/path.ts", ... }
 *
 * Scans all .ts/.tsx files in src/, src-server/, cli/ and rewrites
 * relative imports whose resolved target matches an old path to point
 * at the new path instead.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, relative, join, extname } from 'path';

const root = resolve(import.meta.dirname, '..');

// Read mapping
const mappingFile = process.argv[2];
if (!mappingFile) { console.error('Usage: node scripts/fix-imports.mjs <mapping.json>'); process.exit(1); }
const rawMapping = JSON.parse(readFileSync(mappingFile, 'utf8'));

// Normalize mapping: strip extensions, make absolute
const mapping = {};
for (const [oldP, newP] of Object.entries(rawMapping)) {
  const oldAbs = resolve(root, oldP).replace(/\.(tsx?|jsx?)$/, '');
  const newAbs = resolve(root, newP).replace(/\.(tsx?|jsx?)$/, '');
  mapping[oldAbs] = newAbs;
}

// Collect all source files
function collectFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-cli' || entry === 'dist-server' || entry === 'coverage') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) { collectFiles(full, out); }
    else if (/\.(tsx?|jsx?)$/.test(entry)) { out.push(full); }
  }
  return out;
}

const srcFiles = [
  ...collectFiles(join(root, 'src')),
  ...collectFiles(join(root, 'src-server')),
  ...collectFiles(join(root, 'cli')),
];

// Also check e2e if exists
try { srcFiles.push(...collectFiles(join(root, 'e2e'))); } catch {}

const importRe = /((?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"])([^'"]+)(['"])/g;
const dynamicImportRe = /(import\(\s*['"])([^'"]+)(['"]\s*\))/g;
const viMockRe = /(vi\.mock\(\s*['"])([^'"]+)(['"])/g;
const viDoMockRe = /(vi\.doMock\(\s*['"])([^'"]+)(['"])/g;

let totalChanges = 0;

for (const file of srcFiles) {
  const fileDir = dirname(file);
  let content = readFileSync(file, 'utf8');
  let changed = false;

  function replacer(_match, prefix, specifier, suffix) {
    // Only handle relative imports
    if (!specifier.startsWith('.')) return _match;

    // Resolve the import target
    const resolved = resolve(fileDir, specifier).replace(/\.(tsx?|jsx?)$/, '');

    if (mapping[resolved]) {
      // Compute new relative path
      let newRel = relative(fileDir, mapping[resolved]);
      if (!newRel.startsWith('.')) newRel = './' + newRel;
      // Use forward slashes
      newRel = newRel.replace(/\\/g, '/');
      if (newRel !== specifier) {
        changed = true;
        return prefix + newRel + suffix;
      }
    }
    return _match;
  }

  content = content.replace(importRe, replacer);
  content = content.replace(dynamicImportRe, replacer);
  content = content.replace(viMockRe, replacer);
  content = content.replace(viDoMockRe, replacer);

  if (changed) {
    writeFileSync(file, content, 'utf8');
    totalChanges++;
    console.log(`  Updated: ${relative(root, file)}`);
  }
}

console.log(`\nDone. ${totalChanges} files updated.`);
