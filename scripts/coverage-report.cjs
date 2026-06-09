const cp = require('child_process');
const path = require('path');
const cwd = process.cwd();
const d = require(path.join(cwd, 'coverage-latest/coverage-summary.json'));
const bfRaw = cp.execSync('git diff develop --name-only --diff-filter=ACMR', { cwd }).toString().trim().split('\n');
const bfSrc = bfRaw.filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));

const files = [];
const cwdSlash = cwd + '/';
for (const k of Object.keys(d)) {
  if (k === 'total') continue;
  const rel = k.replace(cwdSlash, '');
  if (bfSrc.includes(rel)) {
    files.push({ file: rel, lines: d[k].lines.pct, branches: d[k].branches.pct, functions: d[k].functions.pct });
  }
}
files.sort((a, b) => a.lines - b.lines);

console.log('=== LOWEST 10 COVERAGE (branch files) ===');
files.slice(0, 10).forEach(f => console.log(`${String(f.lines.toFixed(1)).padStart(6)}% L | ${String(f.branches.toFixed(1)).padStart(6)}% B | ${String(f.functions.toFixed(1)).padStart(6)}% F  ${f.file}`));
console.log('');
console.log('=== HIGHEST 10 COVERAGE (branch files) ===');
files.slice(-10).reverse().forEach(f => console.log(`${String(f.lines.toFixed(1)).padStart(6)}% L | ${String(f.branches.toFixed(1)).padStart(6)}% B | ${String(f.functions.toFixed(1)).padStart(6)}% F  ${f.file}`));
console.log('');
const t = d.total;
console.log(`TOTAL: Lines=${t.lines.pct}%, Branches=${t.branches.pct}%, Functions=${t.functions.pct}%`);
console.log(`Branch files: ${files.length}, Below 90% lines: ${files.filter(f => f.lines < 90).length}`);
