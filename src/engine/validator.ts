import type { ValidationConfig, FailureDetail, ExpectedField } from '../types';

export function getByPath(obj: unknown, path: string): unknown {
  const normalized = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  const parts = normalized.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

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

function validateFields(fields: ExpectedField[], responseBody: unknown): FailureDetail[] {
  const failures: FailureDetail[] = [];
  for (const field of fields) {
    const actualValue = getByPath(responseBody, field.jsonPath);
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

        for (const { suffix, expectedValue, originalPath } of fieldSuffixes) {
          const candidatePath = baseIndex + suffix;
          const actualValue = getByPath(responseBody, candidatePath);
          const actualStr = JSON.stringify(actualValue);
          let expectedStr: string;
          try {
            expectedStr = JSON.stringify(JSON.parse(expectedValue));
          } catch {
            expectedStr = JSON.stringify(expectedValue);
          }
          if (actualStr !== expectedStr) {
            allMatch = false;
            mismatches.push({ originalPath, expectedValue, actualValue: actualStr ?? 'undefined' });
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
    const firstSegment = firstPath.split(/[.\[]/)[0];
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
