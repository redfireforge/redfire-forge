import type { JsonTypeName } from '@shared/types';

export function matchesStatusPattern(httpStatus: number, pattern: string): boolean {
  const p = pattern.trim();
  if (/^\d+$/.test(p)) return httpStatus === Number(p);
  if (/^\d+\s*-\s*\d+$/.test(p)) {
    const [lo, hi] = p.split('-').map(s => Number(s.trim()));
    return httpStatus >= lo && httpStatus <= hi;
  }
  if (/^\dxx$/i.test(p)) {
    const classDigit = Number(p[0]);
    return Math.floor(httpStatus / 100) === classDigit;
  }
  return p.split(',').some(s => matchesStatusPattern(httpStatus, s));
}

export function getJsonTypeName(val: unknown): JsonTypeName {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') return t as JsonTypeName;
  return 'string';
}

export function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

export function evaluateHeaderOp(
  headerVal: string | undefined,
  operator: string,
  expected?: string,
): { pass: boolean; expected: string; actual: string } {
  const actual = headerVal ?? '(not present)';
  switch (operator) {
    case 'exists':
      return { pass: headerVal !== undefined, expected: 'header exists', actual };
    case 'equals':
      return { pass: headerVal === expected, expected: expected ?? '', actual };
    case 'contains':
      return { pass: headerVal !== undefined && headerVal.includes(expected ?? ''), expected: `contains "${expected ?? ''}"`, actual };
    case 'regex': {
      try {
        const re = new RegExp(expected ?? '');
        return { pass: headerVal !== undefined && re.test(headerVal), expected: `matches /${expected}/`, actual };
      } catch {
        return { pass: false, expected: `valid regex /${expected}/`, actual: 'invalid regex pattern' };
      }
    }
    default:
      return { pass: false, expected: `operator "${operator}"`, actual: 'unknown operator' };
  }
}
