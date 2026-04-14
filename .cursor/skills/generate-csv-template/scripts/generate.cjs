/**
 * Reusable CSV template generator for RedfireForge.
 *
 * Usage:
 *   ENV=t01 COUNT=100 node generate.cjs
 *   ENV=p01 COUNT=50  node generate.cjs
 *   ENV=t01 COUNT=100 URL_PATTERN="https://custom.host/..." node generate.cjs
 *
 * Expects a JSON file at: <project>/_raw_<ENV>.json
 * Each element must have: { vin_nbr, payload (string JSON), created_timstm }
 *
 * Output: <project>/sample_<ENV>_<COUNT>.csv
 */
const fs = require('fs');
const path = require('path');

const ENV = process.env.ENV || 't01';
const COUNT = parseInt(process.env.COUNT || '100', 10);
const PROJECT = path.resolve(__dirname, '../../');

const URL_PATTERNS = {
  t01: 'https://sales-product-autoassign.apps.gmna.test.cvca.atmosdt.gm.com/sales/product/autoassign/v1/vehicles/management/{{vin}}/onboarding/vehiclePurchaseOffers',
  p01: 'https://sales-product-autoassign.apps.gmna.cvca.atmosdt.gm.com/sales/product/autoassign/v1/vehicles/management/{{vin}}/onboarding/vehiclePurchaseOffers',
};

const urlPattern = process.env.URL_PATTERN || URL_PATTERNS[ENV] || URL_PATTERNS.t01;

// ---------------------------------------------------------------------------
// 1. Load raw data
// ---------------------------------------------------------------------------
const rawPath = path.resolve(PROJECT, `_raw_${ENV}.json`);
if (!fs.existsSync(rawPath)) {
  console.error(`Missing input: ${rawPath}`);
  console.error(`Query the DB via MCP and save results to this file first.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
console.log(`Total raw rows from ${ENV}: ${raw.length}`);

// ---------------------------------------------------------------------------
// 2. Parse & deduplicate by VIN
// ---------------------------------------------------------------------------
const rows = [];
const seenVins = new Set();

for (const r of raw) {
  if (seenVins.has(r.vin_nbr)) continue;
  try {
    const p = JSON.parse(r.payload);
    const offers = p.offers || [];
    if (offers.length === 0) continue;
    if (!offers.some(o => o.associatedOfferingCode)) continue;
    seenVins.add(r.vin_nbr);
    rows.push({
      vin: r.vin_nbr,
      enrollmentType: p.enrollmentType || '',
      country: p.country || '',
      channel: p.channel || '',
      accountType: p.accountType || '',
      offers,
      ts: r.created_timstm,
    });
  } catch { /* skip bad JSON */ }
}

console.log(`Unique VINs with non-empty offers: ${rows.length}`);

// ---------------------------------------------------------------------------
// 3. Bucket by country-accountType for diversity
// ---------------------------------------------------------------------------
const buckets = {};
for (const r of rows) {
  const key = `${r.country}-${r.accountType}`;
  if (!buckets[key]) buckets[key] = [];
  buckets[key].push(r);
}

console.log('\nBuckets:');
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${k}: ${v.length}`);
}

// ---------------------------------------------------------------------------
// 4. Select diverse set
// ---------------------------------------------------------------------------
const DEFAULT_QUOTAS = [
  { key: 'US-PN', max: 30 }, { key: 'US-FL', max: 15 }, { key: 'US-DD', max: 10 },
  { key: 'US-BN', max: 5 },  { key: 'CA-PN', max: 10 }, { key: 'CA-FL', max: 5 },
  { key: 'CA-BN', max: 3 },  { key: 'CA-RN', max: 2 },  { key: 'MX-PN', max: 10 },
  { key: 'MX-FL', max: 5 },  { key: 'MX-RN', max: 2 },  { key: 'US-CV', max: 3 },
];

const selected = [];
const usedVins = new Set();

for (const { key, max } of DEFAULT_QUOTAS) {
  const pool = buckets[key] || [];
  let count = 0;
  for (const r of pool) {
    if (selected.length >= COUNT) break;
    if (count >= max) break;
    if (usedVins.has(r.vin)) continue;
    usedVins.add(r.vin);
    selected.push(r);
    count++;
  }
}

// Fill remaining from any bucket
if (selected.length < COUNT) {
  for (const r of rows) {
    if (selected.length >= COUNT) break;
    if (usedVins.has(r.vin)) continue;
    usedVins.add(r.vin);
    selected.push(r);
  }
}

console.log(`\nSelected: ${selected.length}`);

// ---------------------------------------------------------------------------
// 5. Determine max offers across all selected rows
// ---------------------------------------------------------------------------
let maxOffers = 0;
for (const r of selected) {
  if (r.offers.length > maxOffers) maxOffers = r.offers.length;
}
console.log(`Max offers per row: ${maxOffers}`);

// ---------------------------------------------------------------------------
// 6. Build CSV
// ---------------------------------------------------------------------------
const baseHeader = [
  'name', 'path:vin', 'param:channel', 'param:enrollmentType',
  'param:country', 'param:accountType', 'param:vehicleUsageCode',
];

const validateHeader = [];
for (let i = 0; i < maxOffers; i++) {
  validateHeader.push(`validate:$.offers[${i}].associatedOfferingCode`);
  validateHeader.push(`validate:$.offers[${i}].offerName`);
}

const header = [...baseHeader, ...validateHeader];

function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

const meta = {
  version: 1,
  method: 'GET',
  urlPattern,
  headers: [
    { key: 'Accept-Language', value: 'en-US' },
    { key: 'Content-Type', value: 'application/json' },
  ],
  body: '',
  auth: { type: 'inherit' },
  validationMode: 'selective',
  unorderedArrays: true,
  pathVariables: ['vin'],
};

const csvLines = [];
csvLines.push('#META:' + JSON.stringify(meta));
csvLines.push(header.map(esc).join(','));

for (const r of selected) {
  const nameLabel = `${r.enrollmentType}-${r.country}-${r.accountType}-${r.vin}`;
  const vals = [nameLabel, r.vin, r.channel, r.enrollmentType, r.country, r.accountType, ''];
  for (let i = 0; i < maxOffers; i++) {
    vals.push(r.offers[i]?.associatedOfferingCode || '');
    vals.push(r.offers[i]?.offerName || '');
  }
  csvLines.push(vals.map(esc).join(','));
}

const outFile = path.resolve(PROJECT, `sample_${ENV}_${COUNT}.csv`);
fs.writeFileSync(outFile, csvLines.join('\n') + '\n', 'utf8');

// ---------------------------------------------------------------------------
// 7. Print summary
// ---------------------------------------------------------------------------
const stats = {};
for (const r of selected) {
  const key = `${r.country}-${r.accountType}`;
  stats[key] = (stats[key] || 0) + 1;
}

console.log(`\nWrote ${selected.length} rows to ${outFile}`);
console.log('Distribution:', JSON.stringify(stats, null, 2));
