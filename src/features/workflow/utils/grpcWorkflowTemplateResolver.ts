/**
 * Phase 6B / 9B — template interpolation for gRPC workflow snapshots.
 */
import type { GrpcServerStreamCollectConfig } from '../types/workflow/node-grpc';
import {
  assertGrpcInterpolationAuthTemplatesResolved,
  assertGrpcInterpolationJsonTemplatesResolved,
  assertGrpcInterpolationMetadataNormalizeUnique,
  assertGrpcInterpolationTemplatesResolved,
  resolveGrpcInterpolationAuthConfig,
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
  type GrpcInterpolationTemplateResolver,
} from '@shared/grpc/grpcInterpolationDeepResolver';

export type GrpcWorkflowTemplateResolver = GrpcInterpolationTemplateResolver;

export const resolveGrpcWorkflowTemplateString = (
  value: string,
  resolveTemplate: GrpcWorkflowTemplateResolver,
): string => resolveTemplate(value);

export const resolveGrpcWorkflowJsonValue = resolveGrpcInterpolationJsonValue;
export const resolveGrpcWorkflowMetadata = resolveGrpcInterpolationMetadata;
export const resolveGrpcWorkflowAuthConfig = resolveGrpcInterpolationAuthConfig;
export const assertGrpcWorkflowTemplatesResolved = assertGrpcInterpolationTemplatesResolved;
export const assertGrpcWorkflowJsonTemplatesResolved = assertGrpcInterpolationJsonTemplatesResolved;
export const assertGrpcWorkflowMetadataNormalizeUnique = assertGrpcInterpolationMetadataNormalizeUnique;
export const assertGrpcWorkflowAuthTemplatesResolved = assertGrpcInterpolationAuthTemplatesResolved;

export function resolveGrpcWorkflowCollectConfig(
  collect: GrpcServerStreamCollectConfig,
  resolveTemplate: GrpcWorkflowTemplateResolver,
): GrpcServerStreamCollectConfig {
  const untilExpression = collect.untilExpression?.trim();
  return {
    maxMessages: collect.maxMessages,
    maxDurationMs: collect.maxDurationMs,
    untilExpression: untilExpression ? resolveTemplate(untilExpression) : undefined,
  };
}
