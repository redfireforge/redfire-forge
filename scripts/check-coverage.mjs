import { readFileSync } from 'fs';

const cov = JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8'));
const handlerKey = Object.keys(cov).find(
  (k) =>
    k.includes('correlation-handler') &&
    !k.includes('test') &&
    !k.includes('security') &&
    !k.includes('http') &&
    !k.includes('factory') &&
    !k.includes('store')
);

if (!handlerKey) {
  console.log('Key not found. Available keys:');
  Object.keys(cov)
    .filter((k) => k.includes('correlation'))
    .forEach((k) => console.log(' ', k));
  process.exit(0);
}

console.log('Handler key:', handlerKey);
const branchMap = cov[handlerKey].branchMap;
const branchCounts = cov[handlerKey].b;

// Show branches around lines 108-120
Object.entries(branchMap).forEach(([id, br]) => {
  const start = br.loc?.start?.line ?? br.locations?.[0]?.start?.line ?? 0;
  if (start >= 108 && start <= 120) {
    console.log(`Branch ${id} line ${start}:`, JSON.stringify(br.type), 'hits=', JSON.stringify(branchCounts[id]));
  }
});

// Show overall branch coverage for correlation-handler.ts
const totalBranches = Object.values(branchCounts).flat().length;
const coveredBranches = Object.values(branchCounts).flat().filter((h) => h > 0).length;
console.log(`\nBranch coverage: ${coveredBranches}/${totalBranches} = ${((coveredBranches / totalBranches) * 100).toFixed(1)}%`);
