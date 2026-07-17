/**
 * Shared assertion template mapping for gRPC harness data-source + snapshot resolution.
 */
import type { GrpcHarnessAssertion } from '../types/grpc-harness';

export type GrpcHarnessStringTemplateMapper = (template: string) => string;

/** Map string template fields on a single harness assertion. */
export function mapGrpcHarnessAssertionTemplateStrings(
  assertion: GrpcHarnessAssertion,
  map: GrpcHarnessStringTemplateMapper,
): GrpcHarnessAssertion {
  if ('grpcTrailer' in assertion && assertion.equals !== undefined) {
    return {
      ...assertion,
      equals: map(assertion.equals),
    };
  }

  if ('grpcField' in assertion) {
    const next = { ...assertion };
    if (typeof next.equals === 'string') {
      next.equals = map(next.equals);
    }
    if (typeof next.contains === 'string') {
      next.contains = map(next.contains);
    }
    return next;
  }

  if ('grpcNumericField' in assertion) {
    if (typeof assertion.value === 'string') {
      return {
        ...assertion,
        value: map(assertion.value),
      };
    }
    return assertion;
  }

  if ('grpcStreamField' in assertion) {
    const next = { ...assertion };
    if (typeof next.equals === 'string') {
      next.equals = map(next.equals);
    }
    if (typeof next.contains === 'string') {
      next.contains = map(next.contains);
    }
    return next;
  }

  return assertion;
}

/** Map string template fields on all harness assertions. */
export function mapGrpcHarnessAssertionsTemplateStrings(
  assertions: GrpcHarnessAssertion[] | undefined,
  map: GrpcHarnessStringTemplateMapper,
): GrpcHarnessAssertion[] | undefined {
  if (!assertions?.length) return assertions;
  return assertions.map((assertion) => mapGrpcHarnessAssertionTemplateStrings(assertion, map));
}
