import type { ValidationConfig, FailureDetail, ExpectedField, Assertion } from '../types';

const STAR = '__PATH_STAR__';

/** Tokenize a JSONPath-style path after the optional `$.` prefix (supports `key`, `[n]`, `[*]`). */
function tokenizeJsonPath(normalized: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = normalized.trim();
  while (i < s.length) {
    if (s[i] === '.') {
      i++;
      continue;
    }
    if (s[i] === '[') {
      const end = s.indexOf(']', i);
      if (end === -1) break;
      const inner = s.slice(i + 1, end).trim();
      tokens.push(inner === '*' ? STAR : inner);
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] !== '.' && s[j] !== '[') j++;
    if (j > i) tokens.push(s.slice(i, j));
    i = j;
  }
  return tokens;
}

function walkPath(obj: unknown, tokens: string[], idx: number): unknown {
  if (idx >= tokens.length) return obj;
  const t = tokens[idx];
  if (t === STAR) {
    if (!Array.isArray(obj)) return undefined;
    if (idx === tokens.length - 1) return obj;
    return obj.map((el) => walkPath(el, tokens, idx + 1));
  }
  // Support .length on arrays (returns count)
  if (t === 'length' && Array.isArray(obj)) {
    return walkPath(obj.length, tokens, idx + 1);
  }
  if (obj == null || typeof obj !== 'object') return undefined;
  const key = /^\d+$/.test(t) ? Number(t) : t;
  let next: unknown;
  if (Array.isArray(obj)) {
    next = typeof key === 'number' ? obj[key] : undefined;
  } else {
    next = (obj as Record<string, unknown>)[String(key)];
  }
  return walkPath(next, tokens, idx + 1);
}

/**
 * Resolve a JSONPath-style expression (`$.a.b`, `a[0].x`, `$.items[*].id`).
 * `[*]` walks every array element at that segment and returns an array of nested results.
 */
export function getByPath(obj: unknown, path: string): unknown {
  const normalized = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  if (!normalized.trim()) return obj;
  const tokens = tokenizeJsonPath(normalized);
  if (tokens.length === 0) return obj;
  return walkPath(obj, tokens, 0);
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
    }
  }

  return { failures, statusAsserted };
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
