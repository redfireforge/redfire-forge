/**
 * Phase 8B / 9B — template interpolation for gRPC harness snapshots.
 */
import type { GrpcHarnessAssertion, GrpcHarnessCollectConfig } from '../types/grpc-harness';
import {
  assertGrpcInterpolationAuthTemplatesResolved,
  assertGrpcInterpolationJsonTemplatesResolved,
  assertGrpcInterpolationMetadataNormalizeUnique,
  assertGrpcInterpolationTemplatesResolved,
  resolveGrpcInterpolationAuthConfig,
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
  type GrpcInterpolationTemplateResolver,
} from './grpcInterpolationDeepResolver';
import {
  mapGrpcHarnessAssertionTemplateStrings,
  mapGrpcHarnessAssertionsTemplateStrings,
} from './grpcHarnessAssertionTemplates';

export type GrpcHarnessTemplateResolver = GrpcInterpolationTemplateResolver;

export const resolveGrpcHarnessJsonValue = resolveGrpcInterpolationJsonValue;
export const resolveGrpcHarnessMetadata = resolveGrpcInterpolationMetadata;
export const resolveGrpcHarnessAuthConfig = resolveGrpcInterpolationAuthConfig;
export const assertGrpcHarnessTemplatesResolved = assertGrpcInterpolationTemplatesResolved;
export const assertGrpcHarnessJsonTemplatesResolved = assertGrpcInterpolationJsonTemplatesResolved;
export const assertGrpcHarnessMetadataNormalizeUnique = assertGrpcInterpolationMetadataNormalizeUnique;
export const assertGrpcHarnessAuthTemplatesResolved = assertGrpcInterpolationAuthTemplatesResolved;

export function resolveGrpcHarnessCollectConfig(
  collect: GrpcHarnessCollectConfig,
): GrpcHarnessCollectConfig {
  return {
    maxMessages: collect.maxMessages,
    maxDurationMs: collect.maxDurationMs,
  };
}

export function resolveGrpcHarnessSendMessages(
  sendMessages: Record<string, unknown>[] | undefined,
  resolveTemplate: GrpcHarnessTemplateResolver,
): Record<string, unknown>[] {
  if (!sendMessages?.length) return [];
  return sendMessages.map((message) =>
    resolveGrpcInterpolationJsonValue(message, resolveTemplate) as Record<string, unknown>,
  );
}

export function resolveGrpcHarnessAssertions(
  assertions: GrpcHarnessAssertion[] | undefined,
  resolveTemplate: GrpcHarnessTemplateResolver,
): GrpcHarnessAssertion[] | undefined {
  return mapGrpcHarnessAssertionsTemplateStrings(assertions, resolveTemplate);
}

function assertGrpcHarnessAssertionTemplatesResolved(
  assertion: GrpcHarnessAssertion,
  index: number,
): void {
  const label = `assertions[${index}]`;
  mapGrpcHarnessAssertionTemplateStrings(assertion, (value) => {
    assertGrpcInterpolationTemplatesResolved(label, value);
    return value;
  });
}

export function assertGrpcHarnessAssertionsTemplatesResolved(
  assertions: GrpcHarnessAssertion[] | undefined,
): void {
  if (!assertions?.length) return;
  assertions.forEach((assertion, index) => {
    assertGrpcHarnessAssertionTemplatesResolved(assertion, index);
  });
}
