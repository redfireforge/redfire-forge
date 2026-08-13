/**
 * Curated Faker-style helpers for mock templates. Deterministic when `seed` is set.
 */
const FIRST = ['Ada', 'Grace', 'Linus', 'Niels', 'Alan', 'Barbara', 'Ken', 'Dorothy'];
const LAST = ['Lovelace', 'Hopper', 'Torvalds', 'Bohr', 'Turing', 'Liskov', 'Thompson', 'Vaughan'];
const CITIES = ['Austin', 'Boston', 'Seattle', 'Lisbon', 'Kyoto', 'Oslo', 'Nairobi', 'Recife'];
const WORDS = ['alpha', 'bravo', 'cipher', 'delta', 'echo', 'falcon', 'gamma', 'harbor'];
const PRODUCTS = ['widget', 'gasket', 'relay', 'sensor', 'module', 'adapter', 'fixture', 'probe'];

export const FAKER_HELPER_PATHS = [
  'person.firstName',
  'person.lastName',
  'person.fullName',
  'internet.email',
  'internet.userName',
  'location.city',
  'lorem.word',
  'lorem.sentence',
  'string.alphanumeric',
  'string.uuid',
  'number.int',
  'datatype.boolean',
  'commerce.product',
  'phone.number',
] as const;

export type FakerHelperPath = (typeof FAKER_HELPER_PATHS)[number];

function pick<T>(items: readonly T[], n: number): T {
  return items[Math.abs(n) % items.length];
}

function alphanum(n: number, len = 8): string {
  return digitsFrom(n, len, 'abcdefghijklmnopqrstuvwxyz0123456789');
}

function hexDigits(n: number, len: number): string {
  return digitsFrom(n, len, '0123456789abcdef');
}

function digitsFrom(n: number, len: number, alphabet: string): string {
  let out = '';
  let x = Math.abs(n) || 1;
  for (let i = 0; i < len; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    out += alphabet[x % alphabet.length];
  }
  return out;
}

/** Resolve `{{faker 'person.firstName'}}` (and aliases) using a numeric draw from the template seed. */
export function renderFakerHelper(path: string, draw: number): string {
  const key = path.trim().replace(/^faker\./, '') as FakerHelperPath;
  const first = pick(FIRST, draw);
  const last = pick(LAST, draw + 3);
  switch (key) {
    case 'person.firstName': return first;
    case 'person.lastName': return last;
    case 'person.fullName': return `${first} ${last}`;
    case 'internet.userName': return `${first.toLowerCase()}.${last.toLowerCase()}`;
    case 'internet.email': return `${first.toLowerCase()}.${last.toLowerCase()}@example.test`;
    case 'location.city': return pick(CITIES, draw);
    case 'lorem.word': return pick(WORDS, draw);
    case 'lorem.sentence': return `The ${pick(WORDS, draw)} ${pick(PRODUCTS, draw + 1)} holds.`;
    case 'string.alphanumeric': return alphanum(draw);
    case 'string.uuid': {
      const h = hexDigits(draw, 32);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
    }
    case 'number.int': return String(Math.abs(draw) % 10000);
    case 'datatype.boolean': return String((draw & 1) === 0);
    case 'commerce.product': return pick(PRODUCTS, draw);
    case 'phone.number': return `+1-555-01${String(Math.abs(draw) % 100).padStart(2, '0')}`;
    default: return '';
  }
}
