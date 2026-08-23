import type { ValidationConfig, FailureDetail, ExpectedField, Assertion } from '@shared/types';
import { getByPath } from '@shared/utils/jsonPath';
import { evaluateFieldOperator } from './fieldOperatorEvaluation';
import { deepCompare } from './deepCompare';
import {
  handleStatus, handleResponseTime, handleHeader, handleRegex,
  handleArrayLength, handleNumeric, handleDate, handleDatePrecise,
  handleTypeCheck, handleExistence, handleArrayContains, handleEach,
  handleContainsSubset, handleJsonSchema, handleBodySize,
  handleKafkaField, handleWsField, handleWsNumericField, handleCustom,
} from './validatorAssertionHandlers';
export type { FieldEvalResult } from './fieldOperatorEvaluation';

// Re-export canonical path engine for backward compatibility
export { getByPath } from '@shared/utils/jsonPath';
// Re-export field operator evaluation for backward compatibility
export { evaluateFieldOperator } from './fieldOperatorEvaluation';
export { resolveDate, toDayString, truncateToUnit } from './validatorDateHelpers';
export { matchesStatusPattern, getJsonTypeName } from './validatorHttpHelpers';
export { deepSubsetMatch } from './validatorSubsetMatch';
export { wrapCustomExprDollarPaths } from './validatorCustomExpression';
export { compare, formatOp } from './validatorAssertionHandlers';

// AJV singleton moved to validatorAssertionHandlers.ts




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

// compare() and formatOp() moved to validatorAssertionHandlers.ts — re-exported above

export interface AssertionContext {
  httpStatus: number;
  responseTimeMs: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  rawBody?: string;
  /**
   * Kafka-specific field context for `kafkaField` assertion evaluation.
   * Populated by `kafkaExecution.ts` when building `ValidationInput`.
   */
  kafkaContext?: {
    key?: string;
    offset?: number;
    partition?: number;
    topic?: string;
  };
  /**
   * WebSocket-specific field context for `wsField` / `wsNumericField` assertion evaluation.
   * Populated by the WS execution layer when building `ValidationInput`.
   */
  wsContext?: {
    connectionId?: string;
    frameType?: 'text' | 'binary';
    protocol?: string;
    messageSize?: number;
    latencyMs?: number;
    url?: string;
  };
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
    let assertionFailures: FailureDetail[] = [];
    switch (a.type) {
      case 'status':
        statusAsserted = true;
        assertionFailures = handleStatus(a, ctx);
        break;
      case 'responseTime':
        assertionFailures = handleResponseTime(a, ctx);
        break;
      case 'header':
        assertionFailures = handleHeader(a, ctx);
        break;
      case 'regex':
        assertionFailures = handleRegex(a, ctx);
        break;
      case 'arrayLength':
        assertionFailures = handleArrayLength(a, ctx);
        break;
      case 'numeric':
        assertionFailures = handleNumeric(a, ctx);
        break;
      case 'date':
        assertionFailures = handleDate(a, ctx);
        break;
      case 'typeCheck':
        assertionFailures = handleTypeCheck(a, ctx);
        break;
      case 'existence':
        assertionFailures = handleExistence(a, ctx);
        break;
      case 'arrayContains':
        assertionFailures = handleArrayContains(a, ctx);
        break;
      case 'each':
        assertionFailures = handleEach(a, ctx);
        break;
      case 'containsSubset':
        assertionFailures = handleContainsSubset(a, ctx);
        break;
      case 'jsonSchema':
        assertionFailures = handleJsonSchema(a, ctx, _ai);
        break;
      case 'bodySize':
        assertionFailures = handleBodySize(a, ctx);
        break;
      case 'datePrecise':
        assertionFailures = handleDatePrecise(a, ctx);
        break;
      case 'kafkaField':
        assertionFailures = handleKafkaField(a, ctx);
        break;
      case 'wsField':
        assertionFailures = handleWsField(a, ctx);
        break;
      case 'wsNumericField':
        assertionFailures = handleWsNumericField(a, ctx);
        break;
      case 'custom':
        assertionFailures = handleCustom(a, ctx, negPrefix);
        break;
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
