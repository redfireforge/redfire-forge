/**
 * Phase 6D — server-stream untilExpression evaluator.
 */
import { getByPath, stripJsonPathPrefix } from '../../../shared/utils/jsonPath';

const UNTIL_EXPRESSION_PATTERN = /^(\$[\w.[\]*]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/;

function parseExpectedValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function compareValues(
  actual: unknown,
  expected: string | number | boolean,
  operator: string,
): boolean {
  if (operator === '==') {
    if (typeof expected === 'number' && typeof actual === 'string' && actual.trim() !== '') {
      const numeric = Number(actual);
      if (!Number.isNaN(numeric)) return numeric === expected;
    }
    return String(actual ?? '') === String(expected);
  }
  if (operator === '!=') {
    return !compareValues(actual, expected, '==');
  }
  const left = typeof actual === 'number' ? actual : Number(actual);
  const right = typeof expected === 'number' ? expected : Number(expected);
  if (Number.isNaN(left) || Number.isNaN(right)) return false;
  switch (operator) {
    case '>': return left > right;
    case '<': return left < right;
    case '>=': return left >= right;
    case '<=': return left <= right;
    default: return false;
  }
}

/** Returns true when the untilExpression matches the inbound stream message payload. */
export function evaluateGrpcStreamUntilExpression(
  expression: string,
  messageData: Record<string, unknown>,
): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return false;
  const match = UNTIL_EXPRESSION_PATTERN.exec(trimmed);
  if (!match) return false;
  const [, jsonPath, operator, rawExpected] = match;
  const path = stripJsonPathPrefix(jsonPath);
  const actual = getByPath(messageData, path);
  const expected = parseExpectedValue(rawExpected);
  return compareValues(actual, expected, operator);
}
