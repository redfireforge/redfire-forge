/**
 * Extracted assertion case handlers from evaluateAssertions() in validator.ts.
 * Each handler evaluates a single assertion type and returns failures.
 */
import type { Assertion, FailureDetail, ComparisonOperator } from '@shared/types';
import { getByPath } from '@shared/utils/jsonPath';
import { parseJsonOrRaw } from '@shared/utils/helpers';
import { evaluateFieldOperator } from './fieldOperatorEvaluation';
import { resolveDate, toDayString, truncateToUnit } from './validatorDateHelpers';
import { matchesStatusPattern, findHeader, evaluateHeaderOp, getJsonTypeName } from './validatorHttpHelpers';
import { deepSubsetMatch } from './validatorSubsetMatch';
import { wrapCustomExprDollarPaths, isTruthy } from './validatorCustomExpression';
import { evaluateExpression, formatExpressionResult } from '../features/workflow/utils/expressionEvaluator';
import type { AssertionContext } from './validator';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

let _ajvInstance: Ajv | null = null;
function getAjv(): Ajv {
  if (!_ajvInstance) {
    _ajvInstance = new Ajv({ allErrors: true, strict: false });
    addFormats(_ajvInstance);
  }
  return _ajvInstance;
}

export function compare(actual: number, op: ComparisonOperator, expected: number): boolean {
  switch (op) {
    case '=': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    default: return false;
  }
}

export function formatOp(op: ComparisonOperator): string {
  return ({ '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' })[op] ?? op;
}

function buildFailure(path: string, expected: string, actual: string): FailureDetail[] {
  return [{ path, expected, actual }];
}

function stringifyAssertionValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function getSerializedContextBody(ctx: AssertionContext): string {
  return ctx.rawBody ?? (typeof ctx.responseBody === 'string' ? ctx.responseBody : JSON.stringify(ctx.responseBody));
}

function resolveKafkaContextField(name: string, ctx: AssertionContext): unknown {
  switch (name) {
    case 'body':
      return getSerializedContextBody(ctx);
    case 'key':
      return ctx.kafkaContext?.key;
    case 'partition':
      return ctx.kafkaContext?.partition;
    case 'offset':
      return ctx.kafkaContext?.offset;
    case 'topic':
      return ctx.kafkaContext?.topic;
    default:
      if (name.startsWith('header.')) {
        return findHeader(ctx.responseHeaders, name.slice('header.'.length));
      }
      return undefined;
  }
}

function resolveWsContextField(name: string, ctx: AssertionContext): unknown {
  switch (name) {
    case 'body':
      return getSerializedContextBody(ctx);
    case 'type':
      return ctx.wsContext?.frameType;
    case 'protocol':
      return ctx.wsContext?.protocol;
    case 'connectionId':
      return ctx.wsContext?.connectionId;
    case 'latencyMs':
      return ctx.wsContext?.latencyMs;
    case 'size':
      return ctx.wsContext?.messageSize;
    case 'url':
      return ctx.wsContext?.url;
    default:
      if (name.startsWith('header.')) {
        return findHeader(ctx.responseHeaders, name.slice('header.'.length));
      }
      return undefined;
  }
}

export function handleStatus(a: Extract<Assertion, { type: 'status' }>, ctx: AssertionContext): FailureDetail[] {
  if (!matchesStatusPattern(ctx.httpStatus, a.expected)) {
    return buildFailure('(status)', a.expected, String(ctx.httpStatus));
  }
  return [];
}

export function handleResponseTime(a: Extract<Assertion, { type: 'responseTime' }>, ctx: AssertionContext): FailureDetail[] {
  if (ctx.responseTimeMs > a.maxMs) {
    return buildFailure('(responseTime)', `≤ ${a.maxMs}ms`, `${ctx.responseTimeMs}ms`);
  }
  return [];
}

export function handleHeader(a: Extract<Assertion, { type: 'header' }>, ctx: AssertionContext): FailureDetail[] {
  const headerVal = findHeader(ctx.responseHeaders, a.name);
  const opResult = evaluateHeaderOp(headerVal, a.operator, a.value);
  if (!opResult.pass) {
    return buildFailure(`(header:${a.name})`, opResult.expected, opResult.actual);
  }
  return [];
}

export function handleRegex(a: Extract<Assertion, { type: 'regex' }>, ctx: AssertionContext): FailureDetail[] {
  const val = getByPath(ctx.responseBody, a.jsonPath);
  const str = stringifyAssertionValue(val);
  try {
    const re = new RegExp(a.pattern);
    if (!re.test(str)) {
      return buildFailure(
        `(regex:${a.jsonPath})`,
        `matches /${a.pattern}/`,
        str.length > 200 ? str.slice(0, 200) + '…' : str,
      );
    }
  } catch {
    return buildFailure(`(regex:${a.jsonPath})`, `valid regex /${a.pattern}/`, 'invalid regex pattern');
  }
  return [];
}

export function handleArrayLength(a: Extract<Assertion, { type: 'arrayLength' }>, ctx: AssertionContext): FailureDetail[] {
  const arr = getByPath(ctx.responseBody, a.jsonPath);
  if (!Array.isArray(arr)) {
    return buildFailure(
      `(arrayLength:${a.jsonPath})`,
      `array with length ${formatOp(a.operator)} ${a.value}`,
      arr === undefined ? 'undefined' : `not an array (${typeof arr})`,
    );
  }
  if (!compare(arr.length, a.operator, a.value)) {
    return buildFailure(`(arrayLength:${a.jsonPath})`, `length ${formatOp(a.operator)} ${a.value}`, `length ${arr.length}`);
  }
  return [];
}

export function handleNumeric(a: Extract<Assertion, { type: 'numeric' }>, ctx: AssertionContext): FailureDetail[] {
  const raw = getByPath(ctx.responseBody, a.jsonPath);
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (raw === undefined) {
    return buildFailure(`(numeric:${a.jsonPath})`, `numeric value ${formatOp(a.operator)} ${a.value}`, 'undefined');
  }
  if (isNaN(num)) {
    return buildFailure(`(numeric:${a.jsonPath})`, `numeric value ${formatOp(a.operator)} ${a.value}`, `not a number: ${JSON.stringify(raw)}`);
  }
  if (!compare(num, a.operator, a.value)) {
    return buildFailure(`(numeric:${a.jsonPath})`, `${formatOp(a.operator)} ${a.value}`, String(num));
  }
  return [];
}

export function handleDate(a: Extract<Assertion, { type: 'date' }>, ctx: AssertionContext): FailureDetail[] {
  const rawDate = getByPath(ctx.responseBody, a.jsonPath);
  const dayStr = toDayString(rawDate);
  if (rawDate === undefined) {
    return buildFailure(`(date:${a.jsonPath})`, `date ${formatOp(a.operator)} ${resolveDate(a.reference)}`, 'undefined');
  }
  if (dayStr === null) {
    return buildFailure(`(date:${a.jsonPath})`, `date ${formatOp(a.operator)} ${resolveDate(a.reference)}`, `not a date: ${JSON.stringify(rawDate)}`);
  }
  const refStr = resolveDate(a.reference);
  const cmp = dayStr.localeCompare(refStr);
  if (!compare(cmp, a.operator, 0)) {
    return buildFailure(`(date:${a.jsonPath})`, `${formatOp(a.operator)} ${refStr}`, dayStr);
  }
  return [];
}

export function handleDatePrecise(a: Extract<Assertion, { type: 'datePrecise' }>, ctx: AssertionContext): FailureDetail[] {
  const rawDp = getByPath(ctx.responseBody, a.jsonPath);
  if (rawDp === undefined) {
    return buildFailure(`(datePrecise:${a.jsonPath})`, `date ${formatOp(a.operator)} ${a.reference} (${a.precision})`, 'undefined');
  }
  const actualDate = new Date(String(rawDp));
  const refDate = new Date(a.reference);
  if (isNaN(actualDate.getTime())) {
    return buildFailure(`(datePrecise:${a.jsonPath})`, 'valid date', `invalid date: ${String(rawDp)}`);
  }
  if (isNaN(refDate.getTime())) {
    return buildFailure(`(datePrecise:${a.jsonPath})`, 'valid reference date', `invalid reference: ${a.reference}`);
  }
  const truncActual = truncateToUnit(actualDate, a.precision);
  const truncRef = truncateToUnit(refDate, a.precision);
  if (!compare(truncActual, a.operator, truncRef)) {
    return buildFailure(`(datePrecise:${a.jsonPath})`, `date ${formatOp(a.operator)} ${a.reference} (precision: ${a.precision})`, String(rawDp));
  }
  return [];
}

export function handleTypeCheck(a: Extract<Assertion, { type: 'typeCheck' }>, ctx: AssertionContext): FailureDetail[] {
  const tcVal = getByPath(ctx.responseBody, a.jsonPath);
  if (tcVal === undefined) {
    return buildFailure(`(typeCheck:${a.jsonPath})`, `type ${a.expectedType}`, 'path not found');
  }
  const actualType = getJsonTypeName(tcVal);
  if (actualType !== a.expectedType) {
    return buildFailure(`(typeCheck:${a.jsonPath})`, `type ${a.expectedType}`, `type ${actualType}`);
  }
  return [];
}

export function handleExistence(a: Extract<Assertion, { type: 'existence' }>, ctx: AssertionContext): FailureDetail[] {
  const exVal = getByPath(ctx.responseBody, a.jsonPath);
  const found = exVal !== undefined;
  if (found !== a.expectExists) {
    return buildFailure(
      `(existence:${a.jsonPath})`,
      a.expectExists ? 'field exists' : 'field does not exist',
      found ? 'field exists' : 'field not found',
    );
  }
  return [];
}

export function handleArrayContains(a: Extract<Assertion, { type: 'arrayContains' }>, ctx: AssertionContext): FailureDetail[] {
  const acArr = getByPath(ctx.responseBody, a.jsonPath);
  if (!Array.isArray(acArr)) {
    return [{ path: `(arrayContains:${a.jsonPath})`, expected: `array containing value`, actual: acArr === undefined ? 'undefined' : `not an array (${typeof acArr})` }];
  }
  const parsedValue: unknown = parseJsonOrRaw(a.value);
  const itemMatches = (item: unknown): boolean => {
    if (typeof parsedValue === 'object' && parsedValue !== null) {
      return deepSubsetMatch(item, parsedValue).match;
    }
    return item === parsedValue || JSON.stringify(item) === JSON.stringify(parsedValue);
  };
  switch (a.mode) {
    case 'any': {
      if (!acArr.some(itemMatches)) {
        return [{ path: `(arrayContains:${a.jsonPath})`, expected: `array contains ${a.value}`, actual: `no matching item in ${acArr.length} items` }];
      }
      break;
    }
    case 'all': {
      const failCount = acArr.filter(item => !itemMatches(item)).length;
      if (failCount > 0) {
        return [{ path: `(arrayContains:${a.jsonPath})`, expected: `all ${acArr.length} items match ${a.value}`, actual: `${failCount} of ${acArr.length} items did not match` }];
      }
      break;
    }
    case 'only': {
      const parsedArr = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
      const unmatched = parsedArr.filter(exp => !acArr.some(act => deepSubsetMatch(act, exp).match));
      const extras = acArr.filter(act => !parsedArr.some(exp => deepSubsetMatch(act, exp).match));
      if (unmatched.length > 0 || extras.length > 0) {
        const parts: string[] = [];
        if (unmatched.length > 0) parts.push(`missing: ${JSON.stringify(unmatched)}`);
        if (extras.length > 0) parts.push(`extras: ${JSON.stringify(extras)}`);
        return [{ path: `(arrayContains:${a.jsonPath})`, expected: `exactly ${parsedArr.length} items (unordered)`, actual: parts.join('; ') }];
      }
      break;
    }
    case 'none': {
      const matchIdx = acArr.findIndex(itemMatches);
      if (matchIdx >= 0) {
        return [{ path: `(arrayContains:${a.jsonPath})`, expected: `no items match ${a.value}`, actual: `item at index ${matchIdx} matched` }];
      }
      break;
    }
  }
  return [];
}

export function handleEach(a: Extract<Assertion, { type: 'each' }>, ctx: AssertionContext): FailureDetail[] {
  const eachArr = getByPath(ctx.responseBody, a.jsonPath);
  if (!Array.isArray(eachArr)) {
    return [{ path: `(each:${a.jsonPath})`, expected: `array where every element satisfies condition`, actual: eachArr === undefined ? 'undefined' : `not an array (${typeof eachArr})` }];
  }
  const eachFailures: string[] = [];
  for (let idx = 0; idx < eachArr.length; idx++) {
    const elem = eachArr[idx];
    const fieldVal = a.fieldPath ? getByPath(elem, a.fieldPath) : elem;
    const result = evaluateFieldOperator(fieldVal, a.operator, a.value, a.value ?? '');
    if (!result.pass) {
      eachFailures.push(`[${idx}]${a.fieldPath ? '.' + a.fieldPath : ''}: expected ${result.expected}, got ${result.actual}`);
    }
  }
  if (eachFailures.length > 0) {
    const summary = eachFailures.length <= 3
      ? eachFailures.join('; ')
      : `${eachFailures.slice(0, 3).join('; ')} … and ${eachFailures.length - 3} more`;
    return [{
      path: `(each:${a.jsonPath})`,
      expected: `all ${eachArr.length} items: ${a.fieldPath ? a.fieldPath + ' ' : ''}${a.operator}${a.value ? ' ' + a.value : ''}`,
      actual: `${eachFailures.length} of ${eachArr.length} failed — ${summary}`,
    }];
  }
  return [];
}

export function handleContainsSubset(a: Extract<Assertion, { type: 'containsSubset' }>, ctx: AssertionContext): FailureDetail[] {
  const csVal = getByPath(ctx.responseBody, a.jsonPath);
  if (csVal === undefined) {
    return [{ path: `(containsSubset:${a.jsonPath})`, expected: `contains subset ${a.expected}`, actual: 'undefined' }];
  }
  let parsedExpected: unknown;
  try { parsedExpected = JSON.parse(a.expected); } catch {
    return [{ path: `(containsSubset:${a.jsonPath})`, expected: `valid JSON subset`, actual: 'invalid JSON in expected' }];
  }
  const subResult = deepSubsetMatch(csVal, parsedExpected);
  if (!subResult.match) {
    return [{ path: `(containsSubset:${a.jsonPath}${subResult.path ? '.' + subResult.path : ''})`, expected: subResult.expected ?? a.expected, actual: subResult.actual ?? JSON.stringify(csVal) }];
  }
  return [];
}

export function handleJsonSchema(a: Extract<Assertion, { type: 'jsonSchema' }>, ctx: AssertionContext, assertionIndex: number): FailureDetail[] {
  try {
    const schema = JSON.parse(a.schema);
    const ajv = getAjv();
    const validate = ajv.compile(schema);
    const valid = validate(ctx.responseBody);
    if (!valid && validate.errors) {
      const failures: FailureDetail[] = [];
      for (const err of validate.errors.slice(0, 10)) {
        failures.push({
          path: `(jsonSchema#${assertionIndex}:${err.instancePath || '/'})`,
          expected: err.message ?? 'schema validation',
          actual: `violation at ${err.instancePath || '/'}: ${err.keyword}`,
        });
      }
      ajv.removeSchema();
      return failures;
    }
    ajv.removeSchema();
  } catch (e) {
    return [{ path: `(jsonSchema#${assertionIndex})`, expected: 'valid JSON Schema', actual: e instanceof Error ? e.message : 'invalid schema' }];
  }
  return [];
}

export function handleBodySize(a: Extract<Assertion, { type: 'bodySize' }>, ctx: AssertionContext): FailureDetail[] {
  const raw = ctx.rawBody ?? (ctx.responseBody != null ? JSON.stringify(ctx.responseBody) : '');
  const sizeBytes = new TextEncoder().encode(raw).length;
  const divisor = a.unit === 'kb' ? 1024 : a.unit === 'mb' ? 1024 * 1024 : 1;
  const actualSize = sizeBytes / divisor;
  const threshold = a.value;
  if (!compare(actualSize, a.operator, threshold)) {
    const unitLabel = a.unit === 'bytes' ? 'B' : a.unit.toUpperCase();
    return buildFailure('(bodySize)', `body size ${formatOp(a.operator)} ${threshold} ${unitLabel}`, `${Math.round(actualSize * 100) / 100} ${unitLabel}`);
  }
  return [];
}

export function handleKafkaField(a: Extract<Assertion, { type: 'kafkaField' }>, ctx: AssertionContext): FailureDetail[] {
  const kTarget = a.target;
  const kafkaRaw = resolveKafkaContextField(kTarget.slice('kafka.'.length), ctx);
  const kafkaFieldVal = kafkaRaw === undefined ? undefined : typeof kafkaRaw === 'string' ? kafkaRaw : String(kafkaRaw);
  const kOpResult = evaluateHeaderOp(kafkaFieldVal, a.operator, a.value);
  if (!kOpResult.pass) {
    return buildFailure(`(kafkaField:${kTarget})`, kOpResult.expected, kOpResult.actual);
  }
  return [];
}

export function handleWsField(a: Extract<Assertion, { type: 'wsField' }>, ctx: AssertionContext): FailureDetail[] {
  const wTarget = a.target;
  let wsFieldVal: string | undefined;
  if (wTarget.startsWith('ws.$.')) {
    const jsonPathExpr = '$.' + wTarget.slice('ws.$.'.length);
    const jpVal = getByPath(ctx.responseBody, jsonPathExpr);
    wsFieldVal = jpVal === undefined ? undefined : stringifyAssertionValue(jpVal);
  } else {
    const wsRaw = resolveWsContextField(wTarget.slice('ws.'.length), ctx);
    wsFieldVal = wsRaw === undefined ? undefined : typeof wsRaw === 'string' ? wsRaw : String(wsRaw);
  }
  const wsOpResult = evaluateHeaderOp(wsFieldVal, a.operator, a.value);
  if (!wsOpResult.pass) {
    return buildFailure(`(wsField:${wTarget})`, wsOpResult.expected, wsOpResult.actual);
  }
  return [];
}

export function handleWsNumericField(a: Extract<Assertion, { type: 'wsNumericField' }>, ctx: AssertionContext): FailureDetail[] {
  const wnTarget = a.target;
  let numericVal: number | undefined;
  if (wnTarget === 'ws.latencyMs') {
    numericVal = ctx.wsContext?.latencyMs;
  } else if (wnTarget === 'ws.size') {
    numericVal = ctx.wsContext?.messageSize;
  }
  if (numericVal === undefined) {
    return [{ path: `(wsNumericField:${wnTarget})`, expected: `numeric value ${formatOp(a.operator)} ${a.value}`, actual: 'undefined' }];
  }
  if (!compare(numericVal, a.operator, a.value)) {
    return [{ path: `(wsNumericField:${wnTarget})`, expected: `${formatOp(a.operator)} ${a.value}`, actual: String(numericVal) }];
  }
  return [];
}

/** Resolve a variable name to a value from the assertion context. Used by custom assertions. */
function resolveVariable(name: string, ctx: AssertionContext): unknown {
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
  if (name.startsWith('kafka.')) {
    return resolveKafkaContextField(name.slice('kafka.'.length), ctx);
  }
  if (name.startsWith('ws.')) {
    return resolveWsContextField(name.slice('ws.'.length), ctx);
  }
  return undefined;
}

export function handleCustom(a: Extract<Assertion, { type: 'custom' }>, ctx: AssertionContext, negPrefix: string): FailureDetail[] {
  const expr = a.expression?.trim();
  if (!expr) {
    return [{ path: '(custom)', expected: `${negPrefix}custom predicate to evaluate`, actual: 'empty expression' }];
  }
  try {
    const processed = wrapCustomExprDollarPaths(expr);
    const result = evaluateExpression(processed, { resolveVariable: (name: string) => resolveVariable(name, ctx) });
    if (result.error) {
      return [{ path: '(custom)', expected: `${negPrefix}expression to evaluate without error`, actual: `expression error: ${result.error}` }];
    }
    const v = result.value;
    const passed = isTruthy(v);
    if (!passed) {
      const desc = a.description ? ` (${a.description})` : '';
      return [{ path: '(custom)', expected: `${negPrefix}custom predicate to pass${desc}`, actual: formatExpressionResult(result.value) }];
    }
  } catch (e) {
    return [{ path: '(custom)', expected: `${negPrefix}expression to evaluate`, actual: `runtime error: ${e instanceof Error ? e.message : String(e)}` }];
  }
  return [];
}
