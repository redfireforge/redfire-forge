/**
 * Value-based type inference for smart auto-mapping.
 *
 * Analyzes sample data values (not just field names) to detect semantic data
 * types like email, phone, URL, date, UUID, currency, etc. Used to improve
 * auto-map accuracy when field names don't match but value shapes do.
 */

export type SemanticType =
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'uuid'
  | 'currency'
  | 'ipAddress'
  | 'boolean'
  | 'integer'
  | 'decimal'
  | 'percentage'
  | 'zipCode'
  | 'countryCode'
  | 'hex'
  | 'unknown';

interface PatternRule {
  type: SemanticType;
  pattern: RegExp;
  priority: number;
}

const PATTERN_RULES: PatternRule[] = [
  { type: 'uuid', pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, priority: 100 },
  { type: 'email', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, priority: 95 },
  { type: 'url', pattern: /^https?:\/\/.+/i, priority: 90 },
  { type: 'ipAddress', pattern: /^(?:\d{1,3}\.){3}\d{1,3}$/, priority: 90 },
  { type: 'zipCode', pattern: /^\d{5}(-\d{4})?$/, priority: 82 },
  { type: 'date', pattern: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/, priority: 80 },
  { type: 'date', pattern: /^\d{2}\/\d{2}\/\d{4}$/, priority: 70 },
  { type: 'currency', pattern: /^[$€£¥₹]\s?[\d,]+(\.\d{1,2})?$/, priority: 85 },
  { type: 'currency', pattern: /^[\d,]+(\.\d{1,2})?\s?[$€£¥₹]$/, priority: 85 },
  { type: 'percentage', pattern: /^-?\d+(\.\d+)?%$/, priority: 80 },
  { type: 'phone', pattern: /^[+]?[\d\s().-]{7,20}$/, priority: 75 },
  { type: 'countryCode', pattern: /^[A-Z]{2,3}$/, priority: 40 },
  { type: 'hex', pattern: /^#[0-9a-f]{3,8}$/i, priority: 50 },
  { type: 'hex', pattern: /^0x[0-9a-f]+$/i, priority: 50 },
];

/**
 * Infer a semantic type from a sample string value.
 * Returns the highest-priority matching pattern, or 'unknown'.
 */
export function inferSemanticType(value: unknown): SemanticType {
  if (value == null) return 'unknown';

  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return 'integer';
    return 'decimal';
  }

  const str = String(value).trim();
  if (str === '') return 'unknown';

  if (str === 'true' || str === 'false') return 'boolean';

  let bestType: SemanticType = 'unknown';
  let bestPriority = -1;

  for (const rule of PATTERN_RULES) {
    if (rule.priority > bestPriority && rule.pattern.test(str)) {
      bestType = rule.type;
      bestPriority = rule.priority;
    }
  }

  if (bestType === 'unknown') {
    const num = Number(str);
    if (!isNaN(num) && str !== '') {
      return Number.isInteger(num) ? 'integer' : 'decimal';
    }
  }

  return bestType;
}

/**
 * Given two leaf-field values, check if their inferred semantic types match.
 * Returns the shared semantic type if they match, or null if they don't.
 */
export function semanticTypesMatch(sourceValue: unknown, targetValue: unknown): SemanticType | null {
  const sourceType = inferSemanticType(sourceValue);
  const targetType = inferSemanticType(targetValue);
  if (sourceType === 'unknown' || targetType === 'unknown') return null;
  return sourceType === targetType ? sourceType : null;
}

/**
 * Build a map from leaf path → inferred semantic type for all leaves in a
 * flat key-value object. Skips nested objects and arrays.
 */
export function inferFieldSemanticTypes(data: unknown): Map<string, SemanticType> {
  const result = new Map<string, SemanticType>();
  if (data == null || typeof data !== 'object') return result;

  const MAX_DEPTH = 20;
  const seen = new WeakSet<object>();

  const walk = (obj: Record<string, unknown>, prefix: string, depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        if (seen.has(value as object)) continue;
        seen.add(value as object);
        walk(value as Record<string, unknown>, path, depth + 1);
      } else {
        const sType = inferSemanticType(value);
        if (sType !== 'unknown') {
          result.set(path, sType);
        }
      }
    }
  };

  seen.add(data as object);
  walk(data as Record<string, unknown>, '', 0);
  return result;
}
