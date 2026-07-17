/**
 * Phase 8D/8E — numeric comparison for grpcNumericField assertions.
 */
export type GrpcHarnessNumericOperator = '==' | '!=' | '>' | '>=' | '<' | '<=';

export interface GrpcHarnessNumericCompareResult {
  ok: boolean;
  actualText: string;
  expectedText: string;
}

/** Protobuf int64 upper bound (string/BigInt safe). */
export const GRPC_INT64_MAX = 9223372036854775807n;
/** Protobuf int64 lower bound (string/BigInt safe). */
export const GRPC_INT64_MIN = -9223372036854775808n;
/** Protobuf uint64 upper bound (string/BigInt safe). */
export const GRPC_UINT64_MAX = 18446744073709551615n;

const INTEGER_TEXT = /^-?\d+$/;

function toCompareText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** JS `number` integers beyond 2^53−1 are not reliable for int64 assertions — use string digits. */
export function isUnsafeGrpcHarnessIntegerNumber(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && !Number.isSafeInteger(value);
}

function trimIntegerText(value: unknown): string {
  return toCompareText(value).trim();
}

function tryParseBigIntFromDigits(value: unknown): bigint | undefined {
  const text = trimIntegerText(value);
  if (!INTEGER_TEXT.test(text)) return undefined;
  try {
    return BigInt(text);
  } catch {
    return undefined;
  }
}

function compareOrdered(
  actual: number | bigint,
  expected: number | bigint,
  operator: GrpcHarnessNumericOperator,
): boolean {
  switch (operator) {
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return actual > expected;
    case '>=': return actual >= expected;
    case '<': return actual < expected;
    case '<=': return actual <= expected;
    default: return false;
  }
}

function compareAsDecimalStrings(
  actualText: string,
  expectedText: string,
  operator: GrpcHarnessNumericOperator,
): boolean {
  if (operator === '==') return actualText === expectedText;
  if (operator === '!=') return actualText !== expectedText;
  return false;
}

function compareUnsafeIntegerNumbers(
  actual: number,
  expected: number,
  operator: GrpcHarnessNumericOperator,
): boolean {
  if (operator === '==') return Object.is(actual, expected);
  if (operator === '!=') return !Object.is(actual, expected);
  return false;
}

/** Compare an actual field value against an assertion value with the given operator. */
export function compareGrpcHarnessNumericValues(
  actual: unknown,
  operator: GrpcHarnessNumericOperator,
  expected: string | number,
): GrpcHarnessNumericCompareResult {
  const actualText = trimIntegerText(actual);
  const expectedText = trimIntegerText(expected);
  const actualUnsafe = isUnsafeGrpcHarnessIntegerNumber(actual);
  const expectedUnsafe = isUnsafeGrpcHarnessIntegerNumber(expected);

  if (!actualUnsafe && !expectedUnsafe) {
    const actualBig = tryParseBigIntFromDigits(actual);
    const expectedBig = tryParseBigIntFromDigits(expected);
    if (actualBig !== undefined && expectedBig !== undefined) {
      return {
        ok: compareOrdered(actualBig, expectedBig, operator),
        actualText,
        expectedText,
      };
    }
  }

  if (actualUnsafe && expectedUnsafe) {
    return {
      ok: compareUnsafeIntegerNumbers(actual, expected, operator),
      actualText,
      expectedText,
    };
  }

  if (actualUnsafe) {
    return {
      ok: compareAsDecimalStrings(actualText, expectedText, operator),
      actualText,
      expectedText,
    };
  }

  if (expectedUnsafe) {
    // Unsafe IEEE integers are not BigInt-promoted — compare decimal digit text only.
    return {
      ok: compareAsDecimalStrings(actualText, expectedText, operator),
      actualText,
      expectedText,
    };
  }

  const actualNum = Number(actualText);
  const expectedNum = Number(expectedText);
  if (!Number.isFinite(actualNum) || !Number.isFinite(expectedNum)) {
    return {
      ok: compareAsDecimalStrings(actualText, expectedText, operator),
      actualText,
      expectedText,
    };
  }

  return {
    ok: compareOrdered(actualNum, expectedNum, operator),
    actualText,
    expectedText,
  };
}
