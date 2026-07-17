/**
 * Phase 8F / 9B — data-source body-column interpolation for gRPC harness scenarios.
 */
import type { GrpcHarnessCallActionConfig } from '../types/grpc-harness';
import {
  createGrpcInterpolationTemplateResolver,
} from './grpcInterpolationResolver';
import {
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
} from './grpcInterpolationDeepResolver';
import { mapGrpcHarnessAssertionsTemplateStrings } from './grpcHarnessAssertionTemplates';

/** Shared body-column substitution using Phase 9B resolver (escape-aware). */
export function substituteGrpcHarnessTemplateVars(
  template: string,
  vars: Record<string, string>,
): string {
  return createGrpcInterpolationTemplateResolver(vars)(template);
}

/** Deep-interpolate string leaves in JSON-like harness bodies and sendMessages entries. */
export function substituteGrpcHarnessJsonValue(
  value: unknown,
  vars: Record<string, string>,
): unknown {
  return resolveGrpcInterpolationJsonValue(
    value,
    createGrpcInterpolationTemplateResolver(vars),
  );
}

/** Apply data-source body column variables to a grpcCallAction config. */
export function interpolateGrpcHarnessCallAction(
  config: GrpcHarnessCallActionConfig | undefined,
  vars: Record<string, string>,
  hasBodyVars: boolean,
): GrpcHarnessCallActionConfig | undefined {
  if (!config || !hasBodyVars) return config;

  const resolveTemplate = createGrpcInterpolationTemplateResolver(vars);

  return {
    ...config,
    target: resolveTemplate(config.target),
    connectionId: config.connectionId !== undefined
      ? resolveTemplate(config.connectionId)
      : undefined,
    body: config.body !== undefined
      ? resolveGrpcInterpolationJsonValue(config.body, resolveTemplate) as Record<string, unknown>
      : undefined,
    metadata: config.metadata !== undefined
      ? resolveGrpcInterpolationMetadata(config.metadata, resolveTemplate)
      : undefined,
    sendMessages: config.sendMessages?.map(
      (message) => resolveGrpcInterpolationJsonValue(message, resolveTemplate) as Record<string, unknown>,
    ),
    assertions: mapGrpcHarnessAssertionsTemplateStrings(
      config.assertions,
      resolveTemplate,
    ),
  };
}
