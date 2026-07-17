/**
 * Phase 8D — gRPC harness assertion engine (post-transport, no network I/O).
 */
import type { GrpcHarnessAssertion } from '../types/grpc-harness';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';
import type { GrpcHarnessAssertionResult } from '../types/grpc-harness-result';
import {
  resolveGrpcHarnessFieldValue,
  resolveGrpcHarnessStreamFieldValue,
  resolveGrpcHarnessStreamLength,
} from './grpcHarnessAssertPath';
import { compareGrpcHarnessNumericValues } from './grpcHarnessNumericCompare';
import { resolveGrpcHarnessTrailerValue } from './grpcHarnessTrailerNormalize';

export interface GrpcHarnessAssertOutcome {
  passed: boolean;
  failures: string[];
}

export interface GrpcHarnessAssertDetailedOutcome extends GrpcHarnessAssertOutcome {
  assertionResults: GrpcHarnessAssertionResult[];
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

/** Stable assertion name for harness result publication (Phase 8G). */
export function buildGrpcHarnessAssertionName(
  assertion: GrpcHarnessAssertion,
  index: number,
): string {
  const kind = assertionKind(assertion);
  if (kind === 'grpcStatus') return 'grpcStatus';
  if (kind === 'grpcField') {
    return `grpcField:${(assertion as { grpcField: string }).grpcField}`;
  }
  if (kind === 'grpcNumericField') {
    return `grpcNumericField:${(assertion as { grpcNumericField: string }).grpcNumericField}`;
  }
  if (kind === 'grpcStreamField') {
    const streamField = assertion as { grpcStreamField: string; index: number };
    return `grpcStreamField:${streamField.grpcStreamField}@${streamField.index}`;
  }
  if (kind === 'grpcTrailer') {
    return `grpcTrailer:${(assertion as { grpcTrailer: string }).grpcTrailer.trim().toLowerCase()}`;
  }
  if (kind === 'grpcDuration') return 'grpcDuration';
  if (kind === 'grpcStreamLength') return 'grpcStreamLength';
  return `${kind}[${index}]`;
}

function assertionKind(assertion: GrpcHarnessAssertion): string {
  if ('grpcStatus' in assertion) return 'grpcStatus';
  if ('grpcField' in assertion) return 'grpcField';
  if ('grpcNumericField' in assertion) return 'grpcNumericField';
  if ('grpcStreamField' in assertion) return 'grpcStreamField';
  if ('grpcTrailer' in assertion) return 'grpcTrailer';
  if ('grpcDuration' in assertion) return 'grpcDuration';
  if ('grpcStreamLength' in assertion) return 'grpcStreamLength';
  return 'unknown';
}

export function formatGrpcHarnessAssertionFailure(index: number, message: string): string {
  return `assertions[${index}]: ${message}`;
}

function evaluateAssertion(
  assertion: GrpcHarnessAssertion,
  outcome: GrpcHarnessCallOutcome,
  index: number,
): string | undefined {
  const kind = assertionKind(assertion);

  if (kind === 'grpcStatus') {
    const expected = (assertion as { grpcStatus: number }).grpcStatus;
    const actual = outcome.grpcStatus;
    if (actual !== expected) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `grpcStatus expected ${expected}, got ${actual ?? 'undefined'}`,
      );
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
    const actual = resolveGrpcHarnessFieldValue(fieldAssertion.grpcField, outcome);
    if (fieldAssertion.exists !== undefined) {
      const exists = actual !== undefined && actual !== null;
      if (exists !== fieldAssertion.exists) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `${fieldAssertion.grpcField} exists expected ${fieldAssertion.exists}, got ${exists}`,
        );
      }
      return undefined;
    }
    if (fieldAssertion.equals !== undefined) {
      if (!valuesEqual(actual, fieldAssertion.equals)) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `${fieldAssertion.grpcField} equals expected ${stableStringify(fieldAssertion.equals)}, got ${stableStringify(actual)}`,
        );
      }
      return undefined;
    }
    if (fieldAssertion.contains !== undefined) {
      if (!valueContains(actual, fieldAssertion.contains)) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `${fieldAssertion.grpcField} contains expected ${stableStringify(fieldAssertion.contains)}, got ${stableStringify(actual)}`,
        );
      }
      return undefined;
    }
    return formatGrpcHarnessAssertionFailure(
      index,
      `${fieldAssertion.grpcField} requires equals, contains, or exists`,
    );
  }

  if (kind === 'grpcNumericField') {
    const numeric = assertion as {
      grpcNumericField: string;
      operator: '==' | '!=' | '>' | '>=' | '<' | '<=';
      value: string | number;
    };
    const actual = resolveGrpcHarnessFieldValue(numeric.grpcNumericField, outcome);
    const comparison = compareGrpcHarnessNumericValues(actual, numeric.operator, numeric.value);
    if (!comparison.ok) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `${numeric.grpcNumericField} ${numeric.operator} expected ${comparison.expectedText}, got ${comparison.actualText}`,
      );
    }
    return undefined;
  }

  if (kind === 'grpcStreamField') {
    const streamField = assertion as {
      grpcStreamField: string;
      index: number;
      equals?: unknown;
      contains?: unknown;
      exists?: boolean;
    };
    if (
      outcome.callType !== 'server_streaming'
      && outcome.callType !== 'client_streaming'
      && outcome.callType !== 'bidi_streaming'
    ) {
      return formatGrpcHarnessAssertionFailure(
        index,
        'grpcStreamField requires a streaming callType',
      );
    }
    const messages = outcome.messages ?? [];
    if (streamField.index >= messages.length) {
      // When the message at the given index does not exist, the field also does not exist.
      // `exists: false` asserts the field should not be present — this is satisfied vacuously.
      if (streamField.exists === false) {
        return undefined;
      }
      return formatGrpcHarnessAssertionFailure(
        index,
        `messages[${streamField.index}] does not exist (stream length ${messages.length})`,
      );
    }
    const actual = resolveGrpcHarnessStreamFieldValue(
      streamField.grpcStreamField,
      streamField.index,
      outcome,
    );
    if (streamField.exists !== undefined) {
      const exists = actual !== undefined && actual !== null;
      if (exists !== streamField.exists) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `messages[${streamField.index}].${streamField.grpcStreamField} exists expected ${streamField.exists}, got ${exists}`,
        );
      }
      return undefined;
    }
    if (streamField.equals !== undefined) {
      if (!valuesEqual(actual, streamField.equals)) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `messages[${streamField.index}].${streamField.grpcStreamField} equals expected ${stableStringify(streamField.equals)}, got ${stableStringify(actual)}`,
        );
      }
      return undefined;
    }
    if (streamField.contains !== undefined) {
      if (!valueContains(actual, streamField.contains)) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `messages[${streamField.index}].${streamField.grpcStreamField} contains expected ${stableStringify(streamField.contains)}, got ${stableStringify(actual)}`,
        );
      }
      return undefined;
    }
    return formatGrpcHarnessAssertionFailure(
      index,
      `messages[${streamField.index}].${streamField.grpcStreamField} requires equals, contains, or exists`,
    );
  }

  if (kind === 'grpcTrailer') {
    const trailerAssertion = assertion as {
      grpcTrailer: string;
      equals?: string;
      exists?: boolean;
    };
    const name = trailerAssertion.grpcTrailer.trim();
    const actual = resolveGrpcHarnessTrailerValue(outcome.trailers, name);
    if (trailerAssertion.exists !== undefined) {
      const exists = actual !== undefined;
      if (exists !== trailerAssertion.exists) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `trailer "${name}" exists expected ${trailerAssertion.exists}, got ${exists}`,
        );
      }
      return undefined;
    }
    if (trailerAssertion.equals !== undefined) {
      if (actual !== trailerAssertion.equals) {
        return formatGrpcHarnessAssertionFailure(
          index,
          `trailer "${name}" equals expected "${trailerAssertion.equals}", got "${actual ?? ''}"`,
        );
      }
      return undefined;
    }
    return formatGrpcHarnessAssertionFailure(index, `trailer "${name}" requires equals or exists`);
  }

  if (kind === 'grpcDuration') {
    const duration = (assertion as { grpcDuration: { max?: number; min?: number } }).grpcDuration;
    const actual = outcome.durationMs;
    if (actual === undefined) {
      return formatGrpcHarnessAssertionFailure(index, 'grpcDuration requires durationMs on call outcome');
    }
    if (duration.min !== undefined && actual < duration.min) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `durationMs ${actual} is below min ${duration.min}`,
      );
    }
    if (duration.max !== undefined && actual > duration.max) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `durationMs ${actual} exceeds max ${duration.max}`,
      );
    }
    return undefined;
  }

  if (kind === 'grpcStreamLength') {
    if (
      outcome.callType !== 'server_streaming'
      && outcome.callType !== 'client_streaming'
      && outcome.callType !== 'bidi_streaming'
    ) {
      return formatGrpcHarnessAssertionFailure(
        index,
        'grpcStreamLength requires a streaming callType',
      );
    }
    const lengthRule = (assertion as {
      grpcStreamLength: { equals?: number; min?: number; max?: number };
    }).grpcStreamLength;
    const actual = resolveGrpcHarnessStreamLength(outcome);
    if (lengthRule.equals !== undefined && actual !== lengthRule.equals) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `stream length expected ${lengthRule.equals}, got ${actual}`,
      );
    }
    if (lengthRule.min !== undefined && actual < lengthRule.min) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `stream length ${actual} is below min ${lengthRule.min}`,
      );
    }
    if (lengthRule.max !== undefined && actual > lengthRule.max) {
      return formatGrpcHarnessAssertionFailure(
        index,
        `stream length ${actual} exceeds max ${lengthRule.max}`,
      );
    }
    return undefined;
  }

  return formatGrpcHarnessAssertionFailure(index, 'unsupported assertion kind');
}

/** Evaluate frozen harness assertions with per-assertion results (Phase 8G). */
export function evaluateGrpcHarnessAssertionsDetailed(
  outcome: GrpcHarnessCallOutcome,
  assertions: GrpcHarnessAssertion[],
): GrpcHarnessAssertDetailedOutcome {
  const failures: string[] = [];
  const assertionResults: GrpcHarnessAssertionResult[] = [];
  assertions.forEach((assertion, index) => {
    const failure = evaluateAssertion(assertion, outcome, index);
    const name = buildGrpcHarnessAssertionName(assertion, index);
    if (failure) {
      failures.push(failure);
      assertionResults.push({ name, passed: false, message: failure });
    } else {
      assertionResults.push({ name, passed: true });
    }
  });
  return { passed: failures.length === 0, failures, assertionResults };
}

/** Evaluate frozen harness assertions against a transport outcome. */
export function evaluateGrpcHarnessAssertions(
  outcome: GrpcHarnessCallOutcome,
  assertions: GrpcHarnessAssertion[],
): GrpcHarnessAssertOutcome {
  const detailed = evaluateGrpcHarnessAssertionsDetailed(outcome, assertions);
  return { passed: detailed.passed, failures: detailed.failures };
}
