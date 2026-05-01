#!/usr/bin/env node
/**
 * Post-restructure import path validator and fixer.
 * Scans all source files, resolves relative imports, checks if the target exists,
 * and attempts to find the correct path.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, relative, join, basename } from 'path';

const root = resolve(import.meta.dirname, '..');
const importRe = /((?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"])([^'"]+)(['"])/g;
const dynamicImportRe = /(import\(\s*['"])([^'"]+)(['"]\s*\))/g;
const viMockRe = /(vi\.mock\(\s*['"])([^'"]+)(['"])/g;

// Build a map of all .ts/.tsx files by their basename (without extension)
const allFiles = [];
function collectFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (['node_modules', 'dist', 'dist-cli', 'dist-server', 'coverage', '.git', 'src-tauri'].includes(entry)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) collectFiles(full);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith('.d.ts')) allFiles.push(full);
  }
}
collectFiles(join(root, 'src'));
collectFiles(join(root, 'src-server'));
collectFiles(join(root, 'e2e'));

// Map: basename (no ext) -> absolute paths
const filesByName = new Map();
for (const f of allFiles) {
  const name = basename(f).replace(/\.(tsx?|jsx?)$/, '');
  if (!filesByName.has(name)) filesByName.set(name, []);
  filesByName.get(name).push(f.replace(/\.(tsx?|jsx?)$/, ''));
}

function tryResolve(absPath) {
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
    if (existsSync(absPath + ext)) return true;
  }
  // Try as directory with index
  if (existsSync(join(absPath, 'index.ts')) || existsSync(join(absPath, 'index.tsx'))) return true;
  return false;
}

function findCorrectPath(fileDir, specifier) {
  const name = basename(specifier);
  const candidates = filesByName.get(name);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) {
    let rel = relative(fileDir, candidates[0]);
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel.replace(/\\/g, '/');
  }
  // Multiple candidates - pick the one closest to the original intent
  // Prefer the one that shares the most path segments with the original resolved path
  const origResolved = resolve(fileDir, specifier).replace(/\.(tsx?|jsx?)$/, '');
  let best = null;
  let bestScore = -1;
  for (const c of candidates) {
    const cParts = c.split('/');
    const oParts = origResolved.split('/');
    let score = 0;
    for (let i = 0; i < Math.min(cParts.length, oParts.length); i++) {
      if (cParts[i] === oParts[i]) score++;
      else break;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (best) {
    let rel = relative(fileDir, best);
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel.replace(/\\/g, '/');
  }
  return null;
}

let totalFixed = 0;

for (const file of allFiles) {
  const fileDir = dirname(file);
  let content = readFileSync(file, 'utf8');
  let changed = false;

  function replacer(_match, prefix, specifier, suffix) {
    if (!specifier.startsWith('.')) return _match;
    const resolved = resolve(fileDir, specifier);
    if (tryResolve(resolved)) return _match; // Already resolves fine

    const fix = findCorrectPath(fileDir, specifier);
    if (fix && fix !== specifier) {
      changed = true;
      return prefix + fix + suffix;
    }
    // Report unfixable
    console.log(`  UNFIXABLE: ${relative(root, file)}: ${specifier}`);
    return _match;
  }

  content = content.replace(importRe, replacer);
  content = content.replace(dynamicImportRe, replacer);
  content = content.replace(viMockRe, replacer);

  if (changed) {
    writeFileSync(file, content, 'utf8');
    totalFixed++;
    console.log(`  Fixed: ${relative(root, file)}`);
  }
}

console.log(`\nDone. ${totalFixed} files fixed.`);
