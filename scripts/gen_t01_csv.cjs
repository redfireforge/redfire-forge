const fs = require('fs');
const path = require('path');

const allRows = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../_t01_all.json'), 'utf8'));
console.log(`Total rows from DB: ${allRows.length}`);

const buckets = {};
const seen = new Set();

for (const row of allRows) {
  if (seen.has(row.vin_nbr)) continue;
  seen.add(row.vin_nbr);
  const key = `${row.country}-${row.acct_type}`;
  if (!buckets[key]) buckets[key] = [];
  buckets[key].push(row);
}

console.log('Buckets:');
for (const [k, v] of Object.entries(buckets)) {
  console.log(`  ${k}: ${v.length}`);
}

const quotas = [
  { key: 'US-DD', max: 10 },
  { key: 'US-FL', max: 10 },
  { key: 'US-BN', max: 5 },
  { key: 'CA-PN', max: 10 },
  { key: 'CA-FL', max: 3 },
  { key: 'CA-BN', max: 2 },
  { key: 'CA-RN', max: 2 },
  { key: 'MX-PN', max: 10 },
  { key: 'MX-FL', max: 5 },
  { key: 'MX-RN', max: 2 },
  { key: 'US-CV', max: 1 },
  { key: 'US-PN', max: 100 },
];

const selected = [];
const usedVins = new Set();

for (const { key, max } of quotas) {
  const rows = buckets[key] || [];
  let count = 0;
  for (const r of rows) {
    if (selected.length >= 100) break;
    if (count >= max) break;
    if (usedVins.has(r.vin_nbr)) continue;
    usedVins.add(r.vin_nbr);
    selected.push(r);
    count++;
  }
}

console.log(`Selected: ${selected.length}`);

let maxOffers = 0;
const parsed = selected.map(row => {
  const p = JSON.parse(row.payload);
  const offers = p.offers || [];
  if (offers.length > maxOffers) maxOffers = offers.length;
  return { row, p, offers };
});

console.log(`Max offers across all rows: ${maxOffers}`);

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

for (const { row, p, offers } of parsed) {
  const vin = row.vin_nbr;
  const enrollmentType = p.enrollmentType || '';
  const country = p.country || '';
  const channel = p.channel || '';
  const accountType = p.accountType || '';

  const nameLabel = `${enrollmentType}-${country}-${accountType}-${vin}`;
  const vals = [nameLabel, vin, channel, enrollmentType, country, accountType, ''];

  for (let i = 0; i < maxOffers; i++) {
    vals.push(offers[i]?.associatedOfferingCode || '');
    vals.push(offers[i]?.offerName || '');
  }

  csvLines.push(vals.map(esc).join(','));
}

const out = path.resolve(__dirname, '../sample_t01_100.csv');
fs.writeFileSync(out, csvLines.join('\n') + '\n', 'utf8');

const stats = {};
for (const { p } of parsed) {
  const key = `${p.country}-${p.accountType}`;
  stats[key] = (stats[key] || 0) + 1;
}
console.log(`Wrote ${selected.length} rows to ${out}`);
console.log('Distribution:', JSON.stringify(stats, null, 2));
