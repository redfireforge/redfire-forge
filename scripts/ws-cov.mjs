#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const specs = process.argv.slice(2);
if (!specs.length) {
  console.error('Usage: node scripts/ws-cov.mjs include|test [...]');
  process.exit(1);
}

for (let i = 0; i < specs.length; i += 2) {
  const inc = specs[i];
  const test = specs[i + 1];
  const base = inc.split('/').pop();
  execSync(
    `npx vitest run --coverage --coverage.reporter=json --coverage.include="${inc}" "${test}"`,
    { stdio: 'pipe' },
  );
  const cov = JSON.parse(readFileSync('./coverage/coverage-final.json', 'utf8'));
  const key = Object.keys(cov).find((k) => k.includes(base));
  if (!key) {
    console.log(`${base}: NOT IN COV`);
    continue;
  }
  const e = cov[key];
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '100.0');
  const st = Object.values(e.s);
  const br = [];
  Object.keys(e.b).forEach((id) => e.b[id].forEach((c) => br.push(c > 0 ? 1 : 0)));
  const fn = Object.values(e.f);
  const stmt = pct(st.filter((v) => v > 0).length, st.length);
  const brPct = pct(br.filter((v) => v).length, br.length);
  const fnPct = pct(fn.filter((v) => v > 0).length, fn.length);
  const min = Math.min(Number(stmt), Number(brPct), Number(fnPct));
  console.log(`${base}: stmt=${stmt}% br=${brPct}% fn=${fnPct}% min=${min}%`);
  Object.keys(e.f).forEach((id) => {
    if (e.f[id] === 0) console.log(`  FN: ${e.fnMap[id].name} L${e.fnMap[id].loc.start.line}`);
  });
  let n = 0;
  Object.keys(e.b).forEach((id) => {
    e.b[id].forEach((c, idx) => {
      if (c === 0 && n < 10) {
        console.log(`  BR: ${e.branchMap[id].type} L${e.branchMap[id].loc.start.line} idx=${idx}`);
        n++;
      }
    });
  });
  if (n >= 10) console.log('  ... more branches');
}
