/* ── Pattern Library ────────────────────────────────── */

export interface PatternEntry {
  name: string;
  pattern: string;
  description: string;
  category: string;
}

export const PATTERN_LIBRARY: PatternEntry[] = [
  // Text
  { name: 'Contains text',        pattern: '',                      description: 'Matches if the value contains the given text (fill in after selecting)',  category: 'Text' },
  { name: 'Starts with',          pattern: '^',                     description: 'Value starts with a prefix (append your text)',                           category: 'Text' },
  { name: 'Ends with',            pattern: '$',                     description: 'Value ends with a suffix (prepend your text before $)',                    category: 'Text' },
  { name: 'Exact match',          pattern: '^your_value$',          description: 'Exact string equality',                                                   category: 'Text' },
  { name: 'Not empty',            pattern: '.+',                    description: 'At least one character',                                                  category: 'Text' },
  // Identifiers
  { name: 'UUID v4',              pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', description: 'Standard UUID v4 format', category: 'Identifiers' },
  { name: 'Numeric ID',           pattern: '^\\d+$',                description: 'Integer-only ID',                                                        category: 'Identifiers' },
  { name: 'Alphanumeric code',    pattern: '^[A-Za-z0-9]+$',       description: 'Letters and digits only',                                                 category: 'Identifiers' },
  // Formats
  { name: 'Email address',        pattern: '^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$', description: 'Basic email format',                                       category: 'Formats' },
  { name: 'URL (http/https)',     pattern: '^https?://',            description: 'Starts with http:// or https://',                                         category: 'Formats' },
  { name: 'ISO date (YYYY-MM-DD)',pattern: '^\\d{4}-\\d{2}-\\d{2}', description: 'Date in ISO format',                                                     category: 'Formats' },
  { name: 'ISO datetime',         pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}', description: 'ISO 8601 datetime',                                        category: 'Formats' },
  { name: 'Phone (US)',           pattern: '^\\+?1?[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$', description: 'US phone number',                    category: 'Formats' },
  // Numbers
  { name: 'Positive integer',     pattern: '^[1-9]\\d*$',          description: 'Greater than zero, no decimals',                                          category: 'Numbers' },
  { name: 'Decimal number',       pattern: '^-?\\d+\\.\\d+$',      description: 'Has decimal point',                                                       category: 'Numbers' },
  { name: 'Boolean (true/false)', pattern: '^(true|false)$',        description: 'Literal true or false',                                                   category: 'Numbers' },
  // Arrays (serialized)
  { name: 'Array contains value', pattern: '',                      description: 'Checks if serialized array contains text (fill in value)',                 category: 'Arrays' },
  { name: 'Array is non-empty',   pattern: '^\\[.+\\]$',           description: 'Serialized array with at least one element',                              category: 'Arrays' },
];

/* ── Value resolver ─────────────────────────────────── */

export interface MatchResult {
  valid: boolean;
  matches: boolean;
  matchDetails?: RegExpMatchArray | null;
  error?: string;
}

export function testPattern(pattern: string, value: string): MatchResult {
  if (!pattern) return { valid: true, matches: false };
  try {
    const re = new RegExp(pattern);
    const matches = re.test(value);
    const matchDetails = value.match(re);
    return { valid: true, matches, matchDetails };
  } catch (e) {
    return { valid: false, matches: false, error: e instanceof Error ? e.message : 'Invalid regex' };
  }
}

export function resolveValue(json: string, path: string): string | undefined {
  if (!json || !path) return undefined;
  try {
    const obj = JSON.parse(json);
    const normalized = path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1');
    const parts = normalized.split('.').filter(Boolean);
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    if (current === undefined) return undefined;
    return typeof current === 'string' ? current : JSON.stringify(current);
  } catch {
    return undefined;
  }
}
