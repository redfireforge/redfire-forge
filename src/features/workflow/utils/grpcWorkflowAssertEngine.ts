/**
 * Phase 6E — gRPC workflow assert engine (no network I/O).
 */
import type {
  GrpcWorkflowAssertion,
  GrpcWorkflowStepResult,
} from '../types/workflow/node-grpc';
import { resolveGrpcHarnessTrailerValue } from '../../../shared/grpc/grpcHarnessTrailerNormalize';
import { resolveGrpcAssertFieldValue } from './grpcWorkflowAssertPath';

export interface GrpcWorkflowAssertOutcome {
  passed: boolean;
  failures: string[];
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (typeof actual === 'number' && typeof expected === 'number') return actual === expected;
  if (typeof actual === 'string' && typeof expected === 'string') return actual === expected;
  if (typeof actual === 'boolean' && typeof expected === 'boolean') return actual === expected;
  return stableStringify(actual) === stableStringify(expected);
}

function valueContains(actual: unknown, expected: unknown): boolean {
  if (actual === undefined || actual === null) return false;
  if (typeof actual === 'string') {
    return actual.includes(String(expected ?? ''));
  }
  if (Array.isArray(actual)) {
    return actual.some((item) => valuesEqual(item, expected) || valueContains(item, expected));
  }
  if (typeof actual === 'object') {
    return stableStringify(actual).includes(stableStringify(expected));
  }
  return String(actual).includes(String(expected ?? ''));
}

function assertionKind(assertion: GrpcWorkflowAssertion): string {
  if ('grpcStatus' in assertion) return 'grpcStatus';
  if ('grpcField' in assertion) return 'grpcField';
  if ('grpcTrailer' in assertion) return 'grpcTrailer';
  if ('grpcDuration' in assertion) return 'grpcDuration';
  if ('grpcStreamLength' in assertion) return 'grpcStreamLength';
  return 'unknown';
}

function formatFailure(index: number, message: string): string {
  return `assertions[${index}]: ${message}`;
}

function evaluateAssertion(
  assertion: GrpcWorkflowAssertion,
  result: GrpcWorkflowStepResult,
  index: number,
): string | undefined {
  const kind = assertionKind(assertion);

  if (kind === 'grpcStatus') {
    const expected = (assertion as { grpcStatus: number }).grpcStatus;
    const actual = result.grpcStatus;
    if (actual !== expected) {
      return formatFailure(index, `grpcStatus expected ${expected}, got ${actual ?? 'undefined'}`);
    }
    return undefined;
  }

  if (kind === 'grpcField') {
    const fieldAssertion = assertion as {
      grpcField: string;
      equals?: unknown;
      contains?: unknown;
      exists?: boolean;
    };
    const actual = resolveGrpcAssertFieldValue(fieldAssertion.grpcField, result);
    if (fieldAssertion.exists !== undefined) {
      const exists = actual !== undefined && actual !== null;
      if (exists !== fieldAssertion.exists) {
        return formatFailure(
          index,
          `${fieldAssertion.grpcField} exists expected ${fieldAssertion.exists}, got ${exists}`,
        );
      }
      return undefined;
    }
    if (fieldAssertion.equals !== undefined) {
      if (!valuesEqual(actual, fieldAssertion.equals)) {
        return formatFailure(
          index,
          `${fieldAssertion.grpcField} equals expected ${stableStringify(fieldAssertion.equals)}, got ${stableStringify(actual)}`,
        );
      }
      return undefined;
    }
    if (fieldAssertion.contains !== undefined) {
      if (!valueContains(actual, fieldAssertion.contains)) {
        return formatFailure(
          index,
          `${fieldAssertion.grpcField} contains expected ${stableStringify(fieldAssertion.contains)}, got ${stableStringify(actual)}`,
        );
      }
      return undefined;
    }
    return formatFailure(index, `${fieldAssertion.grpcField} requires equals, contains, or exists`);
  }

  if (kind === 'grpcTrailer') {
    const trailerAssertion = assertion as {
      grpcTrailer: string;
      equals?: string;
      exists?: boolean;
    };
    const name = trailerAssertion.grpcTrailer.trim();
    const actual = resolveGrpcHarnessTrailerValue(result.trailers, name);
    if (trailerAssertion.exists !== undefined) {
      const exists = actual !== undefined;
      if (exists !== trailerAssertion.exists) {
        return formatFailure(
          index,
          `trailer "${name}" exists expected ${trailerAssertion.exists}, got ${exists}`,
        );
      }
      return undefined;
    }
    if (trailerAssertion.equals !== undefined) {
      if (actual !== trailerAssertion.equals) {
        return formatFailure(
          index,
          `trailer "${name}" equals expected "${trailerAssertion.equals}", got "${actual ?? ''}"`,
        );
      }
      return undefined;
    }
    return formatFailure(index, `trailer "${name}" requires equals or exists`);
  }

  if (kind === 'grpcDuration') {
    const duration = (assertion as { grpcDuration: { max?: number; min?: number } }).grpcDuration;
    const actual = result.durationMs;
    if (actual === undefined) {
      return formatFailure(index, 'grpcDuration requires durationMs on source step result');
    }
    if (duration.min !== undefined && actual < duration.min) {
      return formatFailure(index, `durationMs ${actual} is below min ${duration.min}`);
    }
    if (duration.max !== undefined && actual > duration.max) {
      return formatFailure(index, `durationMs ${actual} exceeds max ${duration.max}`);
    }
    return undefined;
  }

  if (kind === 'grpcStreamLength') {
    if (result.callType !== 'server_streaming') {
      return formatFailure(index, 'grpcStreamLength requires a server_streaming source step');
    }
    const lengthRule = (assertion as { grpcStreamLength: { equals?: number; min?: number; max?: number } }).grpcStreamLength;
    const actual = result.messages?.length ?? 0;
    if (lengthRule.equals !== undefined && actual !== lengthRule.equals) {
      return formatFailure(index, `stream length expected ${lengthRule.equals}, got ${actual}`);
    }
    if (lengthRule.min !== undefined && actual < lengthRule.min) {
      return formatFailure(index, `stream length ${actual} is below min ${lengthRule.min}`);
    }
    if (lengthRule.max !== undefined && actual > lengthRule.max) {
      return formatFailure(index, `stream length ${actual} exceeds max ${lengthRule.max}`);
    }
    return undefined;
  }

  return formatFailure(index, 'unsupported assertion kind');
}

/** Evaluate all assertions against a frozen upstream step result. */
export function evaluateGrpcWorkflowAssertions(
  result: GrpcWorkflowStepResult,
  assertions: GrpcWorkflowAssertion[],
): GrpcWorkflowAssertOutcome {
  const failures: string[] = [];
  assertions.forEach((assertion, index) => {
    const failure = evaluateAssertion(assertion, result, index);
    if (failure) failures.push(failure);
  });
  return { passed: failures.length === 0, failures };
}
