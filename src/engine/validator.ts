import type { ValidationConfig, FailureDetail, ExpectedField, Assertion, ComparisonOperator } from '../shared/types';
import { getByPath } from '../shared/utils/jsonPath';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { evaluateFieldOperator } from './fieldOperatorEvaluation';
import { deepCompare } from './deepCompare';
import { evaluateExpression, formatExpressionResult } from '../features/workflow/utils/expressionEvaluator';
import { resolveDate, toDayString, truncateToUnit } from './validatorDateHelpers';
import { matchesStatusPattern, findHeader, evaluateHeaderOp, getJsonTypeName } from './validatorHttpHelpers';
import { deepSubsetMatch } from './validatorSubsetMatch';
import { wrapCustomExprDollarPaths, isTruthy } from './validatorCustomExpression';
export type { FieldEvalResult } from './fieldOperatorEvaluation';

// Re-export canonical path engine for backward compatibility
export { getByPath } from '../shared/utils/jsonPath';
// Re-export field operator evaluation for backward compatibility
export { evaluateFieldOperator } from './fieldOperatorEvaluation';
export { resolveDate, toDayString, truncateToUnit } from './validatorDateHelpers';
export { matchesStatusPattern, getJsonTypeName } from './validatorHttpHelpers';
export { deepSubsetMatch } from './validatorSubsetMatch';
export { wrapCustomExprDollarPaths } from './validatorCustomExpression';

let _ajvInstance: Ajv | null = null;
function getAjv(): Ajv {
  if (!_ajvInstance) {
    _ajvInstance = new Ajv({ allErrors: true, strict: false });
    addFormats(_ajvInstance);
  }
  return _ajvInstance;
}




function validateFields(fields: ExpectedField[], responseBody: unknown): FailureDetail[] {
  const failures: FailureDetail[] = [];
  for (const field of fields) {
    const actualValue = getByPath(responseBody, field.jsonPath);
    const negated = !!field.negate;
    const negPrefix = negated ? 'NOT ' : '';

    if (field.operator) {
      const result = evaluateFieldOperator(actualValue, field.operator, field.operatorValue, field.expectedValue);
      const pass = negated ? !result.pass : result.pass;
      if (!pass) {
        failures.push({ path: field.jsonPath, expected: `${negPrefix}${result.expected}`, actual: result.actual });
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
    const matched = actualStr === expectedStr;
    const pass = negated ? !matched : matched;
    if (pass) {
      continue;
    }
    failures.push({
      path: field.jsonPath,
      expected: negated ? `NOT equals ${field.expectedValue}` : field.expectedValue,
      actual: actualStr ?? 'undefined',
    });
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
export function validateFieldsUnordered(fields: ExpectedField[], responseBody: unknown): FailureDetail[] {
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
        negate: !!f.negate,
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

        for (const { suffix, expectedValue, originalPath, operator, operatorValue, negate } of fieldSuffixes) {
          const candidatePath = baseIndex + suffix;
          const actualValue = getByPath(responseBody, candidatePath);

          let fieldPassed: boolean;
          let actualDisplay: string;

          if (operator) {
            const result = evaluateFieldOperator(actualValue, operator, operatorValue, expectedValue);
            fieldPassed = negate ? !result.pass : result.pass;
            actualDisplay = result.actual;
          } else {
            const actualStr = JSON.stringify(actualValue);
            let expectedStr: string;
            try {
              expectedStr = JSON.stringify(JSON.parse(expectedValue));
            } catch {
              expectedStr = JSON.stringify(expectedValue);
            }
            const matched = actualStr === expectedStr;
            fieldPassed = negate ? !matched : matched;
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

export function formatOp(op: ComparisonOperator): string {
  const map: Record<ComparisonOperator, string> = {
    '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤',
  };
  return map[op];
}

export interface AssertionContext {
  httpStatus: number;
  responseTimeMs: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  rawBody?: string;
}

export function evaluateAssertions(
  assertions: Assertion[],
  ctx: AssertionContext,
): { failures: FailureDetail[]; statusAsserted: boolean } {
  const failures: FailureDetail[] = [];
  let statusAsserted = false;

  for (let _ai = 0; _ai < assertions.length; _ai++) {
    const a = assertions[_ai];
    const negated = !!a.negate;
    const negPrefix = negated ? 'NOT ' : '';
    const assertionFailures: FailureDetail[] = [];
    switch (a.type) {
      case 'status': {
        statusAsserted = true;
        if (!matchesStatusPattern(ctx.httpStatus, a.expected)) {
          assertionFailures.push({
            path: '(status)',
            expected: a.expected,
            actual: String(ctx.httpStatus),
          });
        }
        break;
      }
      case 'responseTime': {
        if (ctx.responseTimeMs > a.maxMs) {
          assertionFailures.push({
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
          assertionFailures.push({
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
            assertionFailures.push({
              path: `(regex:${a.jsonPath})`,
              expected: `matches /${a.pattern}/`,
              actual: str.length > 200 ? str.slice(0, 200) + '…' : str,
            });
          }
        } catch {
          assertionFailures.push({
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
          assertionFailures.push({
            path: `(arrayLength:${a.jsonPath})`,
            expected: `array with length ${formatOp(a.operator)} ${a.value}`,
            actual: arr === undefined ? 'undefined' : `not an array (${typeof arr})`,
          });
        } else if (!compare(arr.length, a.operator, a.value)) {
          assertionFailures.push({
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
          assertionFailures.push({
            path: `(numeric:${a.jsonPath})`,
            expected: `numeric value ${formatOp(a.operator)} ${a.value}`,
            actual: 'undefined',
          });
        } else if (isNaN(num)) {
          assertionFailures.push({
            path: `(numeric:${a.jsonPath})`,
            expected: `numeric value ${formatOp(a.operator)} ${a.value}`,
            actual: `not a number: ${JSON.stringify(raw)}`,
          });
        } else if (!compare(num, a.operator, a.value)) {
          assertionFailures.push({
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
          assertionFailures.push({
            path: `(date:${a.jsonPath})`,
            expected: `date ${formatOp(a.operator)} ${resolveDate(a.reference)}`,
            actual: 'undefined',
          });
        } else if (dayStr === null) {
          assertionFailures.push({
            path: `(date:${a.jsonPath})`,
            expected: `date ${formatOp(a.operator)} ${resolveDate(a.reference)}`,
            actual: `not a date: ${JSON.stringify(rawDate)}`,
          });
        } else {
          const refStr = resolveDate(a.reference);
          const cmp = dayStr.localeCompare(refStr);
          if (!compare(cmp, a.operator, 0)) {
            assertionFailures.push({
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
          assertionFailures.push({
            path: `(typeCheck:${a.jsonPath})`,
            expected: `type ${a.expectedType}`,
            actual: 'path not found',
          });
        } else {
          const actualType = getJsonTypeName(tcVal);
          if (actualType !== a.expectedType) {
            assertionFailures.push({
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
          assertionFailures.push({
            path: `(existence:${a.jsonPath})`,
            expected: a.expectExists ? 'field exists' : 'field does not exist',
            actual: found ? 'field exists' : 'field not found',
          });
        }
        break;
      }
      case 'arrayContains': {
        const acArr = getByPath(ctx.responseBody, a.jsonPath);
        if (!Array.isArray(acArr)) {
          assertionFailures.push({
            path: `(arrayContains:${a.jsonPath})`,
            expected: `array containing value`,
            actual: acArr === undefined ? 'undefined' : `not an array (${typeof acArr})`,
          });
          break;
        }
        let parsedValue: unknown;
        try { parsedValue = JSON.parse(a.value); } catch { parsedValue = a.value; }
        const itemMatches = (item: unknown): boolean => {
          if (typeof parsedValue === 'object' && parsedValue !== null) {
            return deepSubsetMatch(item, parsedValue).match;
          }
          return item === parsedValue || JSON.stringify(item) === JSON.stringify(parsedValue);
        };
        switch (a.mode) {
          case 'any': {
            if (!acArr.some(itemMatches)) {
              assertionFailures.push({
                path: `(arrayContains:${a.jsonPath})`,
                expected: `array contains ${a.value}`,
                actual: `no matching item in ${acArr.length} items`,
              });
            }
            break;
          }
          case 'all': {
            const failCount = acArr.filter(item => !itemMatches(item)).length;
            if (failCount > 0) {
              assertionFailures.push({
                path: `(arrayContains:${a.jsonPath})`,
                expected: `all ${acArr.length} items match ${a.value}`,
                actual: `${failCount} of ${acArr.length} items did not match`,
              });
            }
            break;
          }
          case 'only': {
            const parsedArr = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
            const unmatched = parsedArr.filter(exp =>
              !acArr.some(act => deepSubsetMatch(act, exp).match),
            );
            const extras = acArr.filter(act =>
              !parsedArr.some(exp => deepSubsetMatch(act, exp).match),
            );
            if (unmatched.length > 0 || extras.length > 0) {
              const parts: string[] = [];
              if (unmatched.length > 0) parts.push(`missing: ${JSON.stringify(unmatched)}`);
              if (extras.length > 0) parts.push(`extras: ${JSON.stringify(extras)}`);
              assertionFailures.push({
                path: `(arrayContains:${a.jsonPath})`,
                expected: `exactly ${parsedArr.length} items (unordered)`,
                actual: parts.join('; '),
              });
            }
            break;
          }
          case 'none': {
            const matchIdx = acArr.findIndex(itemMatches);
            if (matchIdx >= 0) {
              assertionFailures.push({
                path: `(arrayContains:${a.jsonPath})`,
                expected: `no items match ${a.value}`,
                actual: `item at index ${matchIdx} matched`,
              });
            }
            break;
          }
        }
        break;
      }
      case 'each': {
        const eachArr = getByPath(ctx.responseBody, a.jsonPath);
        if (!Array.isArray(eachArr)) {
          assertionFailures.push({
            path: `(each:${a.jsonPath})`,
            expected: `array where every element satisfies condition`,
            actual: eachArr === undefined ? 'undefined' : `not an array (${typeof eachArr})`,
          });
          break;
        }
        const eachFailures: string[] = [];
        for (let idx = 0; idx < eachArr.length; idx++) {
          const elem = eachArr[idx];
          const fieldVal = a.fieldPath
            ? getByPath(elem, a.fieldPath)
            : elem;
          const result = evaluateFieldOperator(
            fieldVal, a.operator, a.value, a.value ?? '',
          );
          if (!result.pass) {
            eachFailures.push(`[${idx}]${a.fieldPath ? '.' + a.fieldPath : ''}: expected ${result.expected}, got ${result.actual}`);
          }
        }
        if (eachFailures.length > 0) {
          const summary = eachFailures.length <= 3
            ? eachFailures.join('; ')
            : `${eachFailures.slice(0, 3).join('; ')} … and ${eachFailures.length - 3} more`;
          assertionFailures.push({
            path: `(each:${a.jsonPath})`,
            expected: `all ${eachArr.length} items: ${a.fieldPath ? a.fieldPath + ' ' : ''}${a.operator}${a.value ? ' ' + a.value : ''}`,
            actual: `${eachFailures.length} of ${eachArr.length} failed — ${summary}`,
          });
        }
        break;
      }
      case 'containsSubset': {
        const csVal = getByPath(ctx.responseBody, a.jsonPath);
        if (csVal === undefined) {
          assertionFailures.push({
            path: `(containsSubset:${a.jsonPath})`,
            expected: `contains subset ${a.expected}`,
            actual: 'undefined',
          });
          break;
        }
        let parsedExpected: unknown;
        try { parsedExpected = JSON.parse(a.expected); } catch {
          assertionFailures.push({
            path: `(containsSubset:${a.jsonPath})`,
            expected: `valid JSON subset`,
            actual: 'invalid JSON in expected',
          });
          break;
        }
        const subResult = deepSubsetMatch(csVal, parsedExpected);
        if (!subResult.match) {
          assertionFailures.push({
            path: `(containsSubset:${a.jsonPath}${subResult.path ? '.' + subResult.path : ''})`,
            expected: subResult.expected ?? a.expected,
            actual: subResult.actual ?? JSON.stringify(csVal),
          });
        }
        break;
      }

      case 'jsonSchema': {
        try {
          const schema = JSON.parse(a.schema);
          const ajv = getAjv();
          const validate = ajv.compile(schema);
          const valid = validate(ctx.responseBody);
          if (!valid && validate.errors) {
            for (const err of validate.errors.slice(0, 10)) {
              assertionFailures.push({
                path: `(jsonSchema#${_ai}:${err.instancePath || '/'})`,
                expected: err.message ?? 'schema validation',
                actual: `violation at ${err.instancePath || '/'}: ${err.keyword}`,
              });
            }
          }
          ajv.removeSchema();
        } catch (e) {
          assertionFailures.push({
            path: `(jsonSchema#${_ai})`,
            expected: 'valid JSON Schema',
            actual: e instanceof Error ? e.message : 'invalid schema',
          });
        }
        break;
      }

      case 'bodySize': {
        const raw = ctx.rawBody ?? (ctx.responseBody != null ? JSON.stringify(ctx.responseBody) : '');
        const sizeBytes = new TextEncoder().encode(raw).length;
        const divisor = a.unit === 'kb' ? 1024 : a.unit === 'mb' ? 1024 * 1024 : 1;
        const actualSize = sizeBytes / divisor;
        const threshold = a.value;
        if (!compare(actualSize, a.operator, threshold)) {
          const unitLabel = a.unit === 'bytes' ? 'B' : a.unit.toUpperCase();
          assertionFailures.push({
            path: '(bodySize)',
            expected: `body size ${formatOp(a.operator)} ${threshold} ${unitLabel}`,
            actual: `${Math.round(actualSize * 100) / 100} ${unitLabel}`,
          });
        }
        break;
      }

      case 'datePrecise': {
        const rawDp = getByPath(ctx.responseBody, a.jsonPath);
        if (rawDp === undefined) {
          assertionFailures.push({
            path: `(datePrecise:${a.jsonPath})`,
            expected: `date ${formatOp(a.operator)} ${a.reference} (${a.precision})`,
            actual: 'undefined',
          });
          break;
        }
        const actualDate = new Date(String(rawDp));
        const refDate = new Date(a.reference);
        if (isNaN(actualDate.getTime())) {
          assertionFailures.push({
            path: `(datePrecise:${a.jsonPath})`,
            expected: `valid date`,
            actual: `invalid date: ${String(rawDp)}`,
          });
          break;
        }
        if (isNaN(refDate.getTime())) {
          assertionFailures.push({
            path: `(datePrecise:${a.jsonPath})`,
            expected: `valid reference date`,
            actual: `invalid reference: ${a.reference}`,
          });
          break;
        }
        const truncActual = truncateToUnit(actualDate, a.precision);
        const truncRef = truncateToUnit(refDate, a.precision);
        if (!compare(truncActual, a.operator, truncRef)) {
          assertionFailures.push({
            path: `(datePrecise:${a.jsonPath})`,
            expected: `date ${formatOp(a.operator)} ${a.reference} (precision: ${a.precision})`,
            actual: String(rawDp),
          });
        }
        break;
      }

      case 'custom': {
        const expr = a.expression?.trim();
        if (!expr) {
          assertionFailures.push({
            path: '(custom)',
            expected: `${negPrefix}custom predicate to evaluate`,
            actual: 'empty expression',
          });
          break;
        }

        const resolveVariable = (name: string): unknown => {
          if (name === '$.body' || name === '$') return ctx.responseBody;
          if (name === '$.status') return ctx.httpStatus;
          if (name === '$.responseTime') return ctx.responseTimeMs;
          if (name === '$.headers') return ctx.responseHeaders;
          if (name === '$.rawBody') return ctx.rawBody ?? '';
          if (name.startsWith('$.body.')) {
            return getByPath(ctx.responseBody, '$.' + name.slice('$.body.'.length));
          }
          if (name.startsWith('$.headers.')) {
            const headerName = name.slice('$.headers.'.length);
            return findHeader(ctx.responseHeaders, headerName);
          }
          if (name.startsWith('$.')) {
            return getByPath(ctx.responseBody, name);
          }
          return undefined;
        };

        try {
          const processed = wrapCustomExprDollarPaths(expr);
          const result = evaluateExpression(processed, { resolveVariable });
          if (result.error) {
            assertionFailures.push({
              path: '(custom)',
              expected: `${negPrefix}expression to evaluate without error`,
              actual: `expression error: ${result.error}`,
            });
          } else {
            const v = result.value;
            const passed = isTruthy(v);
            if (!passed) {
              const desc = a.description ? ` (${a.description})` : '';
              assertionFailures.push({
                path: '(custom)',
                expected: `${negPrefix}custom predicate to pass${desc}`,
                actual: formatExpressionResult(result.value),
              });
            }
          }
        } catch (e) {
          assertionFailures.push({
            path: '(custom)',
            expected: `${negPrefix}expression to evaluate`,
            actual: `runtime error: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
        break;
      }
    }

    if (negated) {
      const configErrors = assertionFailures.filter(f =>
        f.actual === 'invalid regex pattern' ||
        f.actual === 'invalid JSON in expected' ||
        f.actual === 'empty expression' ||
        f.actual.startsWith('expression error:') ||
        f.actual.startsWith('runtime error:') ||
        f.actual.startsWith('invalid date:') ||
        f.actual.startsWith('invalid reference:') ||
        (f.expected === 'valid JSON Schema' || f.expected === 'valid JSON subset'),
      );
      if (configErrors.length > 0) {
        failures.push(...configErrors);
      } else if (assertionFailures.length === 0) {
        failures.push({
          path: `(${a.type})`,
          expected: `${negPrefix}(assertion to fail)`,
          actual: 'assertion passed (negated → fail)',
        });
      }
    } else {
      failures.push(...assertionFailures);
    }
  }

  return { failures, statusAsserted };
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
