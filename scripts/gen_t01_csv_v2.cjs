const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../_t01_raw.json'), 'utf8'));
console.log(`Total raw rows: ${raw.length}`);

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

console.log(`Unique VINs with offers: ${rows.length}`);

// Bucket by country-accountType for diversity
const buckets = {};
for (const r of rows) {
  const key = `${r.country}-${r.accountType}`;
  if (!buckets[key]) buckets[key] = [];
  buckets[key].push(r);
}

console.log('Buckets:');
for (const [k, v] of Object.entries(buckets)) {
  console.log(`  ${k}: ${v.length}`);
}

// Pick diverse set, up to 100
const quotas = [
  { key: 'US-PN', max: 30 },
  { key: 'US-FL', max: 15 },
  { key: 'US-DD', max: 10 },
  { key: 'US-BN', max: 5 },
  { key: 'CA-PN', max: 10 },
  { key: 'CA-FL', max: 5 },
  { key: 'CA-BN', max: 3 },
  { key: 'CA-RN', max: 2 },
  { key: 'MX-PN', max: 10 },
  { key: 'MX-FL', max: 5 },
  { key: 'MX-RN', max: 2 },
  { key: 'US-CV', max: 3 },
];

const selected = [];
const usedVins = new Set();

for (const { key, max } of quotas) {
  const pool = buckets[key] || [];
  let count = 0;
  for (const r of pool) {
    if (selected.length >= 100) break;
    if (count >= max) break;
    if (usedVins.has(r.vin)) continue;
    usedVins.add(r.vin);
    selected.push(r);
    count++;
  }
}

// Fill remaining slots from any bucket
if (selected.length < 100) {
  for (const r of rows) {
    if (selected.length >= 100) break;
    if (usedVins.has(r.vin)) continue;
    usedVins.add(r.vin);
    selected.push(r);
  }
}

console.log(`Selected: ${selected.length}`);

// Determine max offers across all rows
let maxOffers = 0;
for (const r of selected) {
  if (r.offers.length > maxOffers) maxOffers = r.offers.length;
}
console.log(`Max offers: ${maxOffers}`);

// Build CSV
const baseHeader = [
  'name',
  'path:vin',
  'param:channel',
  'param:enrollmentType',
  'param:country',
  'param:accountType',
  'param:vehicleUsageCode',
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
  urlPattern: 'https://sales-product-autoassign.apps.gmna.test.cvca.atmosdt.gm.com/sales/product/autoassign/v1/vehicles/management/{{vin}}/onboarding/vehiclePurchaseOffers',
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

const out = path.resolve(__dirname, '../sample_t01_100.csv');
fs.writeFileSync(out, csvLines.join('\n') + '\n', 'utf8');

const stats = {};
for (const r of selected) {
  const key = `${r.country}-${r.accountType}`;
  stats[key] = (stats[key] || 0) + 1;
}
console.log(`\nWrote ${selected.length} rows to ${out}`);
console.log('Distribution:', JSON.stringify(stats, null, 2));
