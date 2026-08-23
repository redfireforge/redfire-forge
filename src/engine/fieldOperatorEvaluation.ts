import type { FieldOperator } from '@shared/types';

export interface FieldEvalResult {
  pass: boolean;
  expected: string;
  actual: string;
}

export function toNumber(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    if (val.trim() === '') return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

export function stringify(val: unknown): string {
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val;
  try {
    const serialized = JSON.stringify(val);
    if (serialized === undefined) return String(val);
    return serialized;
  } catch {
    return String(val);
  }
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseListItems(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return raw.split(',').map(s => stripQuotes(s.trim()));
  } catch {
    return raw.split(',').map(s => stripQuotes(s.trim()));
  }
}

export function evaluateFieldOperator(
  actualValue: unknown,
  operator: FieldOperator,
  operatorValue: string | undefined,
  expectedValue: string,
): FieldEvalResult {
  const actual = stringify(actualValue);

  switch (operator) {
    case 'equals': {
      let actualStr: string;
      try { actualStr = JSON.stringify(actualValue); } catch { actualStr = String(actualValue); }
      const rawExpected = operatorValue ?? expectedValue;
      let expectedStr: string;
      try {
        expectedStr = JSON.stringify(JSON.parse(rawExpected));
      } catch {
        expectedStr = JSON.stringify(rawExpected);
      }
      return { pass: actualStr === expectedStr, expected: `equals ${rawExpected}`, actual: actualStr ?? 'undefined' };
    }

    case 'not_equals': {
      let actualStr: string;
      try { actualStr = JSON.stringify(actualValue); } catch { actualStr = String(actualValue); }
      const rawExpected = operatorValue ?? expectedValue;
      let expectedStr: string;
      try {
        expectedStr = JSON.stringify(JSON.parse(rawExpected));
      } catch {
        expectedStr = JSON.stringify(rawExpected);
      }
      return { pass: actualStr !== expectedStr, expected: `not equals ${rawExpected}`, actual: actualStr ?? 'undefined' };
    }

    case 'greater_than': {
      const a = toNumber(actualValue);
      const b = toNumber(operatorValue ?? expectedValue);
      if (a === null || b === null) return { pass: false, expected: `> ${operatorValue ?? expectedValue}`, actual };
      return { pass: a > b, expected: `> ${b}`, actual: String(a) };
    }

    case 'greater_than_or_equal': {
      const a = toNumber(actualValue);
      const b = toNumber(operatorValue ?? expectedValue);
      if (a === null || b === null) return { pass: false, expected: `>= ${operatorValue ?? expectedValue}`, actual };
      return { pass: a >= b, expected: `>= ${b}`, actual: String(a) };
    }

    case 'less_than': {
      const a = toNumber(actualValue);
      const b = toNumber(operatorValue ?? expectedValue);
      if (a === null || b === null) return { pass: false, expected: `< ${operatorValue ?? expectedValue}`, actual };
      return { pass: a < b, expected: `< ${b}`, actual: String(a) };
    }

    case 'less_than_or_equal': {
      const a = toNumber(actualValue);
      const b = toNumber(operatorValue ?? expectedValue);
      if (a === null || b === null) return { pass: false, expected: `<= ${operatorValue ?? expectedValue}`, actual };
      return { pass: a <= b, expected: `<= ${b}`, actual: String(a) };
    }

    case 'contains': {
      const target = operatorValue ?? expectedValue;
      const str = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue) ?? '';
      return { pass: str.includes(target), expected: `contains "${target}"`, actual };
    }

    case 'not_contains': {
      const target = operatorValue ?? expectedValue;
      const str = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue) ?? '';
      return { pass: !str.includes(target), expected: `not contains "${target}"`, actual };
    }

    case 'starts_with': {
      const target = operatorValue ?? expectedValue;
      const str = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue) ?? '';
      return { pass: str.startsWith(target), expected: `starts with "${target}"`, actual };
    }

    case 'ends_with': {
      const target = operatorValue ?? expectedValue;
      const str = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue) ?? '';
      return { pass: str.endsWith(target), expected: `ends with "${target}"`, actual };
    }

    case 'regex': {
      const pattern = operatorValue ?? expectedValue;
      if (!pattern) {
        return { pass: false, expected: 'non-empty regex pattern', actual: 'empty pattern' };
      }
      const str = typeof actualValue === 'string' ? actualValue : JSON.stringify(actualValue) ?? '';
      try {
        const re = new RegExp(pattern);
        return { pass: re.test(str), expected: `matches /${pattern}/`, actual };
      } catch {
        return { pass: false, expected: `valid regex /${pattern}/`, actual: 'invalid regex pattern' };
      }
    }

    case 'is_true':
      return { pass: actualValue === true || actualValue === 'true', expected: 'is true', actual };

    case 'is_false':
      return { pass: actualValue === false || actualValue === 'false', expected: 'is false', actual };

    case 'is_null':
      return { pass: actualValue === null, expected: 'is null', actual };

    case 'is_not_null':
      return { pass: actualValue !== null && actualValue !== undefined, expected: 'is not null', actual };

    case 'is_empty': {
      const empty =
        actualValue === '' ||
        actualValue === null ||
        actualValue === undefined ||
        (Array.isArray(actualValue) && actualValue.length === 0) ||
        (typeof actualValue === 'object' && actualValue !== null && Object.keys(actualValue).length === 0);
      return { pass: empty, expected: 'is empty', actual };
    }

    case 'is_not_empty': {
      const notEmpty =
        actualValue !== '' &&
        actualValue !== null &&
        actualValue !== undefined &&
        !(Array.isArray(actualValue) && actualValue.length === 0) &&
        !(typeof actualValue === 'object' && actualValue !== null && Object.keys(actualValue).length === 0);
      return { pass: notEmpty, expected: 'is not empty', actual };
    }

    case 'exists':
      return { pass: actualValue !== undefined, expected: 'exists', actual };

    case 'not_exists':
      return { pass: actualValue === undefined, expected: 'not exists', actual };

    case 'is_type': {
      const expectedType = (operatorValue ?? expectedValue ?? '').toLowerCase();
      let actualType: string;
      if (actualValue === null) actualType = 'null';
      else if (Array.isArray(actualValue)) actualType = 'array';
      else actualType = typeof actualValue;
      return { pass: actualType === expectedType, expected: `is type ${expectedType}`, actual: `type: ${actualType}` };
    }

    case 'in': {
      const raw = operatorValue ?? expectedValue ?? '';
      const items = parseListItems(raw);
      const stringified = items.map(i => JSON.stringify(i));
      const actualStr = JSON.stringify(actualValue);
      return { pass: stringified.includes(actualStr), expected: `in [${items.map(i => JSON.stringify(i)).join(', ')}]`, actual };
    }

    case 'not_in': {
      const raw = operatorValue ?? expectedValue ?? '';
      const items = parseListItems(raw);
      const stringified = items.map(i => JSON.stringify(i));
      const actualStr = JSON.stringify(actualValue);
      return { pass: !stringified.includes(actualStr), expected: `not in [${items.map(i => JSON.stringify(i)).join(', ')}]`, actual };
    }

    case 'between': {
      const raw = operatorValue ?? expectedValue ?? '';
      const parts = raw.includes(',') ? raw.split(',').map(s => s.trim()) : raw.trim().split(/\s+/);
      const lo = Number(parts[0]);
      const hi = Number(parts[1]);
      const a = toNumber(actualValue);
      if (a === null || isNaN(lo) || isNaN(hi)) return { pass: false, expected: `between ${lo} and ${hi}`, actual };
      return { pass: a >= lo && a <= hi, expected: `between ${lo} and ${hi}`, actual: String(a) };
    }

    case 'close_to': {
      const raw = operatorValue ?? expectedValue ?? '';
      const parts = raw.includes(',') ? raw.split(',').map(s => s.trim()) : raw.trim().split(/\s+/);
      const target = Number(parts[0]);
      const tolerance = parts.length > 1 ? Number(parts[1]) : 0.01;
      const a = toNumber(actualValue);
      if (a === null || isNaN(target)) return { pass: false, expected: `close to ${target} ±${tolerance}`, actual };
      return { pass: Math.abs(a - target) <= tolerance, expected: `close to ${target} ±${tolerance}`, actual: String(a) };
    }

    default:
      return { pass: false, expected: `operator "${operator}"`, actual: 'unknown operator' };
  }
}
