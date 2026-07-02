// Legacy helper — prefer: npx tsx scripts/coverage-gap-lines.ts <file-substring>
const fs = require('fs');
const productPath = 'coverage/coverage-final.product.json';
const data = JSON.parse(fs.readFileSync(
  fs.existsSync(productPath) ? productPath : 'coverage/coverage-final.json',
  'utf8',
));
const target = process.argv[2] || 'graphRunner.ts';

for (const [file, info] of Object.entries(data)) {
  if (file.indexOf(target) === -1) continue;
  if (target === 'graphRunner.ts' && file.indexOf('Helpers') !== -1) continue;
  const uncov = [];
  for (const [id, counts] of Object.entries(info.b)) {
    counts.forEach((c, i) => {
      if (c === 0) uncov.push(info.branchMap[id].loc.start.line);
    });
  }
  uncov.sort((a, b) => a - b);
  const unique = [...new Set(uncov)];
  console.log('File:', file.slice(-60));
  console.log('Count:', uncov.length);
  console.log('Lines:', unique.join(', '));
}
