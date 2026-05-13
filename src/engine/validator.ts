import type { ValidationConfig, FailureDetail, ExpectedField, Assertion, ComparisonOperator, DateReference, FieldOperator, JsonTypeName } from '../shared/types';
import { getByPath } from '../shared/utils/jsonPath';

// Re-export canonical path engine for backward compatibility
export { getByPath } from '../shared/utils/jsonPath';

function deepCompare(
  expected: unknown,
  actual: unknown,
  currentPath: string,
  failures: FailureDetail[]
): void {
  if (expected === actual) return;

  if (expected == null || actual == null || typeof expected !== typeof actual) {
    failures.push({
      path: currentPath || '(root)',
      expected: JSON.stringify(expected),
      actual: JSON.stringify(actual),
    });
    return;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      failures.push({
        path: currentPath,
        expected: 'array',
        actual: typeof actual,
      });
      return;
    }
    const maxLen = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxLen; i++) {
      deepCompare(
        expected[i],
        actual[i],
        `${currentPath}[${i}]`,
        failures
      );
    }
    return;
  }

  if (typeof expected === 'object') {
    const expObj = expected as Record<string, unknown>;
    const actObj = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(expObj), ...Object.keys(actObj)]);
    for (const key of allKeys) {
      deepCompare(
        expObj[key],
        actObj[key],
        currentPath ? `${currentPath}.${key}` : key,
        failures
      );
    }
    return;
  }

  // Primitive mismatch
  failures.push({
    path: currentPath || '(root)',
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  });
}

interface FieldEvalResult {
  pass: boolean;
  expected: string;
  actual: string;
}

function toNumber(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

function stringify(val: unknown): string {
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
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
      const actualStr = JSON.stringify(actualValue);
      let expectedStr: string;
      try {
        expectedStr = JSON.stringify(JSON.parse(expectedValue));
      } catch {
        expectedStr = JSON.stringify(expectedValue);
      }
      return { pass: actualStr === expectedStr, expected: `equals ${expectedValue}`, actual: actualStr ?? 'undefined' };
    }

    case 'not_equals': {
      const actualStr = JSON.stringify(actualValue);
      let expectedStr: string;
      try {
        expectedStr = JSON.stringify(JSON.parse(expectedValue));
      } catch {
        expectedStr = JSON.stringify(expectedValue);
      }
      return { pass: actualStr !== expectedStr, expected: `not equals ${expectedValue}`, actual: actualStr ?? 'undefined' };
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
      const str = typeof actualValue === 'string' ? actualValue : '';
      return { pass: str.startsWith(target), expected: `starts with "${target}"`, actual };
    }

    case 'ends_with': {
      const target = operatorValue ?? expectedValue;
      const str = typeof actualValue === 'string' ? actualValue : '';
      return { pass: str.endsWith(target), expected: `ends with "${target}"`, actual };
    }

    case 'regex': {
      const pattern = operatorValue ?? expectedValue;
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
      const expectedType = (operatorValue ?? expectedValue).toLowerCase();
      let actualType: string;
      if (actualValue === null) actualType = 'null';
      else if (Array.isArray(actualValue)) actualType = 'array';
      else actualType = typeof actualValue;
      return { pass: actualType === expectedType, expected: `is type ${expectedType}`, actual: `type: ${actualType}` };
    }

    case 'in': {
      const raw = operatorValue ?? expectedValue;
      let items: unknown[];
      try {
        items = JSON.parse(raw);
        if (!Array.isArray(items)) items = raw.split(',').map(s => s.trim());
      } catch {
        items = raw.split(',').map(s => s.trim());
      }
      const stringified = items.map(i => JSON.stringify(i));
      const actualStr = JSON.stringify(actualValue);
      return { pass: stringified.includes(actualStr), expected: `in [${items.map(i => JSON.stringify(i)).join(', ')}]`, actual };
    }

    case 'not_in': {
      const raw = operatorValue ?? expectedValue;
      let items: unknown[];
      try {
        items = JSON.parse(raw);
        if (!Array.isArray(items)) items = raw.split(',').map(s => s.trim());
      } catch {
        items = raw.split(',').map(s => s.trim());
      }
      const stringified = items.map(i => JSON.stringify(i));
      const actualStr = JSON.stringify(actualValue);
      return { pass: !stringified.includes(actualStr), expected: `not in [${items.map(i => JSON.stringify(i)).join(', ')}]`, actual };
    }

    case 'between': {
      const raw = operatorValue ?? expectedValue;
      const parts = raw.split(',').map(s => s.trim());
      const lo = Number(parts[0]);
      const hi = Number(parts[1]);
      const a = toNumber(actualValue);
      if (a === null || isNaN(lo) || isNaN(hi)) return { pass: false, expected: `between ${lo} and ${hi}`, actual };
      return { pass: a >= lo && a <= hi, expected: `between ${lo} and ${hi}`, actual: String(a) };
    }

    case 'close_to': {
      const raw = operatorValue ?? expectedValue;
      const parts = raw.split(',').map(s => s.trim());
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

function validateFields(fields: ExpectedField[], responseBody: unknown): FailureDetail[] {
  const failures: FailureDetail[] = [];
  for (const field of fields) {
    const actualValue = getByPath(responseBody, field.jsonPath);

    if (field.operator) {
      const result = evaluateFieldOperator(actualValue, field.operator, field.operatorValue, field.expectedValue);
      if (!result.pass) {
        failures.push({ path: field.jsonPath, expected: result.expected, actual: result.actual });
      }
      continue;
    }

    const actualStr = JSON.stringify(actualValue);
    let expectedStr: string;
    try {
      expectedStr = JSON.stringify(JSON.parse(field.expectedValue));
    } catch {
      expectedStr = JSON.stringify(field.expectedValue);
    }
    if (actualStr !== expectedStr) {
      failures.push({
        path: field.jsonPath,
        expected: field.expectedValue,
        actual: actualStr ?? 'undefined',
      });
    }
  }
  return failures;
}

/**
 * Unordered array validation: for paths containing array indices like
 * `offers[1].offerName`, check if the expected value exists at ANY
 * index in the same array. Groups fields into "row sets" by their
 * array-independent pattern, then searches for matching rows.
 *
 * Example: expected `offers[0].name = "A"` and `offers[0].code = "X"`
 * will match if ANY offers[i] has both name="A" AND code="X".
 */
function validateFieldsUnordered(fields: ExpectedField[], responseBody: unknown): FailureDetail[] {
  // Identify array index pattern: replace [N] with [*]
  const indexPattern = /\[(\d+)\]/g;

  // Group fields by their row prefix (e.g., "offers[0]") 
  const rowGroups = new Map<string, ExpectedField[]>();
  const nonArrayFields: ExpectedField[] = [];

  for (const field of fields) {
    const match = field.jsonPath.match(/^(.*\[\d+\])/);
    if (match) {
      const rowPrefix = match[1];
      if (!rowGroups.has(rowPrefix)) rowGroups.set(rowPrefix, []);
      rowGroups.get(rowPrefix)!.push(field);
    } else {
      nonArrayFields.push(field);
    }
  }

  const failures: FailureDetail[] = [];

  // Validate non-array fields normally (exact path match)
  failures.push(...validateFields(nonArrayFields, responseBody));

  // Group row prefixes by their array pattern (e.g., "offers[*]")
  // so offers[0] and offers[1] belong to the same array group
  const arrayGroups = new Map<string, Map<string, ExpectedField[]>>();
  for (const [rowPrefix, rowFields] of rowGroups) {
    const pattern = rowPrefix.replace(indexPattern, '[*]');
    if (!arrayGroups.has(pattern)) arrayGroups.set(pattern, new Map());
    arrayGroups.get(pattern)!.set(rowPrefix, rowFields);
  }

  for (const [pattern, rowMap] of arrayGroups) {
    // Find the array path and discover all available indices in response
    const arrayPath = pattern.replace(/\[\*\]$/, '');
    const responseArray = arrayPath ? getByPath(responseBody, arrayPath) : responseBody;
    const arrayLen = Array.isArray(responseArray) ? responseArray.length : 0;

    if (arrayLen === 0) {
      // Array not found, report all fields as failures
      for (const rowFields of rowMap.values()) {
        failures.push(...validateFields(rowFields, responseBody));
      }
      continue;
    }

    // For each expected row, try to find a matching row at any index
    const usedIndices = new Set<number>();

    for (const [rowPrefix, rowFields] of rowMap) {
      const fieldSuffixes = rowFields.map((f) => ({
        suffix: f.jsonPath.slice(rowPrefix.length),
        expectedValue: f.expectedValue,
        originalPath: f.jsonPath,
        operator: f.operator,
        operatorValue: f.operatorValue,
      }));

      let matchedIndex = -1;
      let bestPartialIndex = -1;
      let bestPartialCount = 0;
      let bestPartialMismatches: { originalPath: string; expectedValue: string; actualValue: string }[] = [];
      let bestPartialMatches: { suffix: string; value: string }[] = [];

      for (let i = 0; i < arrayLen; i++) {
        if (usedIndices.has(i)) continue;

        const baseIndex = rowPrefix.replace(indexPattern, `[${i}]`);
        let allMatch = true;
        let matchCount = 0;
        const mismatches: { originalPath: string; expectedValue: string; actualValue: string }[] = [];
        const matches: { suffix: string; value: string }[] = [];

        for (const { suffix, expectedValue, originalPath, operator, operatorValue } of fieldSuffixes) {
          const candidatePath = baseIndex + suffix;
          const actualValue = getByPath(responseBody, candidatePath);

          let fieldPassed: boolean;
          let actualDisplay: string;

          if (operator) {
            const result = evaluateFieldOperator(actualValue, operator, operatorValue, expectedValue);
            fieldPassed = result.pass;
            actualDisplay = result.actual;
          } else {
            const actualStr = JSON.stringify(actualValue);
            let expectedStr: string;
            try {
              expectedStr = JSON.stringify(JSON.parse(expectedValue));
            } catch {
              expectedStr = JSON.stringify(expectedValue);
            }
            fieldPassed = actualStr === expectedStr;
            actualDisplay = actualStr ?? 'undefined';
          }

          if (!fieldPassed) {
            allMatch = false;
            mismatches.push({ originalPath, expectedValue, actualValue: actualDisplay });
          } else {
            matchCount++;
            matches.push({ suffix: suffix.replace(/^\./, ''), value: expectedValue });
          }
        }

        if (allMatch) {
          matchedIndex = i;
          break;
        }

        if (matchCount > bestPartialCount) {
          bestPartialCount = matchCount;
          bestPartialIndex = i;
          bestPartialMismatches = mismatches;
          bestPartialMatches = matches;
        }
      }

      if (matchedIndex >= 0) {
        usedIndices.add(matchedIndex);
      } else if (bestPartialIndex >= 0 && bestPartialCount > 0) {
        const matchedContext = bestPartialMatches.map(m => `${m.suffix}=${m.value}`).join(', ');
        for (const m of bestPartialMismatches) {
          const actual = m.actualValue === 'undefined' ? 'undefined' : m.actualValue.replace(/^"|"$/g, '');
          failures.push({
            path: m.originalPath,
            expected: m.expectedValue,
            actual: `${actual} (matched by ${matchedContext} at [${bestPartialIndex}])`,
          });
        }
      } else {
        for (const { originalPath, expectedValue } of fieldSuffixes) {
          failures.push({
            path: originalPath,
            expected: expectedValue,
            actual: `no matching item found in array`,
          });
        }
      }
    }
  }

  return failures;
}

/**
 * When all paths fail, try common remapping strategies:
 * 1. Strip a common prefix (e.g., "offers[0].x" → "[0].x" if response root is array)
 * 2. Add a prefix (e.g., "[0].x" → "data[0].x" if response has wrapper key)
 * 3. Unwrap nested key (e.g., "x" → "data.x" or "result.x")
 */
function tryRemapPaths(fields: ExpectedField[], responseBody: unknown, unordered: boolean): FailureDetail[] | null {
  if (responseBody == null || typeof responseBody !== 'object') return null;
  const doValidate = unordered ? validateFieldsUnordered : validateFields;

  // Strategy 1: paths have a wrapper key like "offers[0].x" but response is an array
  // → strip the first path segment
  if (Array.isArray(responseBody)) {
    const firstPath = fields[0]?.jsonPath || '';
    const firstSegment = firstPath.split(/[[.]/)[0];
    if (firstSegment && fields.every((f) => f.jsonPath.startsWith(firstSegment))) {
      const stripped = fields.map((f) => ({
        ...f,
        jsonPath: f.jsonPath.slice(firstSegment.length).replace(/^\./, ''),
      }));
      const result = doValidate(stripped, responseBody);
      if (result.length === 0 || !result.every((f) => f.actual === 'undefined' || f.actual === undefined)) {
        return result;
      }
    }
  }

  // Strategy 2: paths start with "[0]" but response wraps array in a key
  // → try each root key as prefix
  if (!Array.isArray(responseBody)) {
    const rootObj = responseBody as Record<string, unknown>;
    for (const key of Object.keys(rootObj)) {
      const val = rootObj[key];
      if (val != null && typeof val === 'object') {
        const prefixed = fields.map((f) => ({
          ...f,
          jsonPath: `${key}.${f.jsonPath}`.replace(/\.\[/g, '['),
        }));
        const result = doValidate(prefixed, responseBody);
        if (result.length === 0 || !result.every((f) => f.actual === 'undefined' || f.actual === undefined)) {
          return result;
        }

        // Also try resolving directly against the nested value
        const direct = doValidate(fields, val);
        if (direct.length === 0 || !direct.every((f) => f.actual === 'undefined' || f.actual === undefined)) {
          return direct;
        }
      }
    }
  }

  return null;
}

export function compare(a: number, op: ComparisonOperator, b: number): boolean {
  switch (op) {
    case '=':  return a === b;
    case '!=': return a !== b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '<':  return a < b;
    case '<=': return a <= b;
  }
}

export function resolveDate(ref: DateReference): string {
  if (ref.kind === 'fixed') return ref.iso.slice(0, 10);
  const now = new Date();
  if (ref.timezone === 'utc') {
    return now.toISOString().slice(0, 10);
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDayString(val: unknown): string | null {
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (typeof val === 'number') {
    return new Date(val).toISOString().slice(0, 10);
  }
  return null;
}

export function formatOp(op: ComparisonOperator): string {
  const map: Record<ComparisonOperator, string> = {
    '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤',
  };
  return map[op];
}

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

export interface AssertionContext {
  httpStatus: number;
  responseTimeMs: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
}

export function evaluateAssertions(
  assertions: Assertion[],
  ctx: AssertionContext,
): { failures: FailureDetail[]; statusAsserted: boolean } {
  const failures: FailureDetail[] = [];
  let statusAsserted = false;

  for (const a of assertions) {
    switch (a.type) {
      case 'status': {
        statusAsserted = true;
        if (!matchesStatusPattern(ctx.httpStatus, a.expected)) {
          failures.push({
            path: '(status)',
            expected: a.expected,
            actual: String(ctx.httpStatus),
          });
        }
        break;
      }
      case 'responseTime': {
        if (ctx.responseTimeMs > a.maxMs) {
          failures.push({
            path: '(responseTime)',
            expected: `≤ ${a.maxMs}ms`,
            actual: `${ctx.responseTimeMs}ms`,
          });
        }
        break;
      }
      case 'header': {
        const headerVal = findHeader(ctx.responseHeaders, a.name);
        const opResult = evaluateHeaderOp(headerVal, a.operator, a.value);
        if (!opResult.pass) {
          failures.push({
            path: `(header:${a.name})`,
            expected: opResult.expected,
            actual: opResult.actual,
          });
        }
        break;
      }
      case 'regex': {
        const val = getByPath(ctx.responseBody, a.jsonPath);
        const str = val === undefined ? 'undefined' : typeof val === 'string' ? val : JSON.stringify(val);
        try {
          const re = new RegExp(a.pattern);
          if (!re.test(str)) {
            failures.push({
              path: `(regex:${a.jsonPath})`,
              expected: `matches /${a.pattern}/`,
              actual: str.length > 200 ? str.slice(0, 200) + '…' : str,
            });
          }
        } catch {
          failures.push({
            path: `(regex:${a.jsonPath})`,
            expected: `valid regex /${a.pattern}/`,
            actual: 'invalid regex pattern',
          });
        }
        break;
      }
      case 'arrayLength': {
        const arr = getByPath(ctx.responseBody, a.jsonPath);
        if (!Array.isArray(arr)) {
          failures.push({
            path: `(arrayLength:${a.jsonPath})`,
            expected: `array with length ${formatOp(a.operator)} ${a.value}`,
            actual: arr === undefined ? 'undefined' : `not an array (${typeof arr})`,
          });
        } else if (!compare(arr.length, a.operator, a.value)) {
          failures.push({
            path: `(arrayLength:${a.jsonPath})`,
            expected: `length ${formatOp(a.operator)} ${a.value}`,
            actual: `length ${arr.length}`,
          });
        }
        break;
      }
      case 'numeric': {
        const raw = getByPath(ctx.responseBody, a.jsonPath);
        const num = typeof raw === 'number' ? raw : Number(raw);
        if (raw === undefined) {
          failures.push({
            path: `(numeric:${a.jsonPath})`,
            expected: `numeric value ${formatOp(a.operator)} ${a.value}`,
            actual: 'undefined',
          });
        } else if (isNaN(num)) {
          failures.push({
            path: `(numeric:${a.jsonPath})`,
            expected: `numeric value ${formatOp(a.operator)} ${a.value}`,
            actual: `not a number: ${JSON.stringify(raw)}`,
          });
        } else if (!compare(num, a.operator, a.value)) {
          failures.push({
            path: `(numeric:${a.jsonPath})`,
            expected: `${formatOp(a.operator)} ${a.value}`,
            actual: String(num),
          });
        }
        break;
      }
      case 'date': {
        const rawDate = getByPath(ctx.responseBody, a.jsonPath);
        const dayStr = toDayString(rawDate);
        if (rawDate === undefined) {
          failures.push({
            path: `(date:${a.jsonPath})`,
            expected: `date ${formatOp(a.operator)} ${resolveDate(a.reference)}`,
            actual: 'undefined',
          });
        } else if (dayStr === null) {
          failures.push({
            path: `(date:${a.jsonPath})`,
            expected: `date ${formatOp(a.operator)} ${resolveDate(a.reference)}`,
            actual: `not a date: ${JSON.stringify(rawDate)}`,
          });
        } else {
          const refStr = resolveDate(a.reference);
          const cmp = dayStr.localeCompare(refStr);
          if (!compare(cmp, a.operator, 0)) {
            failures.push({
              path: `(date:${a.jsonPath})`,
              expected: `${formatOp(a.operator)} ${refStr}`,
              actual: dayStr,
            });
          }
        }
        break;
      }
      case 'typeCheck': {
        const tcVal = getByPath(ctx.responseBody, a.jsonPath);
        if (tcVal === undefined) {
          failures.push({
            path: `(typeCheck:${a.jsonPath})`,
            expected: `type ${a.expectedType}`,
            actual: 'path not found',
          });
        } else {
          const actualType = getJsonTypeName(tcVal);
          if (actualType !== a.expectedType) {
            failures.push({
              path: `(typeCheck:${a.jsonPath})`,
              expected: `type ${a.expectedType}`,
              actual: `type ${actualType}`,
            });
          }
        }
        break;
      }
      case 'existence': {
        const exVal = getByPath(ctx.responseBody, a.jsonPath);
        const found = exVal !== undefined;
        if (found !== a.expectExists) {
          failures.push({
            path: `(existence:${a.jsonPath})`,
            expected: a.expectExists ? 'field exists' : 'field does not exist',
            actual: found ? 'field exists' : 'field not found',
          });
        }
        break;
      }
    }
  }

  return { failures, statusAsserted };
}

export function getJsonTypeName(val: unknown): JsonTypeName {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'object') return t as JsonTypeName;
  return 'string';
}

function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function evaluateHeaderOp(
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

export function validate(
  config: ValidationConfig,
  responseBody: unknown
): FailureDetail[] {
  if (config.mode === 'none') return [];

  if (config.mode === 'full') {
    if (!config.expectedJson) return [];
    let expectedObj: unknown;
    try {
      expectedObj = JSON.parse(config.expectedJson);
    } catch {
      return [{ path: '(parse)', expected: 'valid JSON', actual: 'parse error in expected JSON' }];
    }
    const failures: FailureDetail[] = [];
    deepCompare(expectedObj, responseBody, '', failures);
    return failures;
  }

  // selective
  if (!config.expectedFields || config.expectedFields.length === 0) return [];

  const fields = config.expectedFields;
  let failures: FailureDetail[];

  if (config.unorderedArrays) {
    failures = validateFieldsUnordered(fields, responseBody);
  } else {
    failures = validateFields(fields, responseBody);
  }

  // If ALL fields resolved to undefined, try smart path remapping
  if (failures.length > 0 && failures.every((f) => f.actual === 'undefined' || f.actual === undefined)) {
    const remapped = tryRemapPaths(fields, responseBody, !!config.unorderedArrays);
    if (remapped) {
      failures = remapped;
    }
  }

  return failures;
}
