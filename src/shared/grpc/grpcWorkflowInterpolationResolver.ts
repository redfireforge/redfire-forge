/**
 * Phase 9C — workflow template resolver bridging Phase 9A/9B grammar with VariableContext.
 */
import type { VariableContext } from '../../features/workflow/engine/variableContext';
import {
  inspectGrpcInterpolationTemplate,
  type GrpcInterpolationInspectResult,
} from './grpcInterpolationGrammar';
import type { GrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';

function resolveInspectedWithContext(
  inspected: Extract<GrpcInterpolationInspectResult, { ok: true }>,
  ctx: VariableContext,
  flatEnv?: Readonly<Record<string, string>>,
): string {
  return inspected.segments
    .map((segment) => {
      if (segment.kind === 'literal') {
        return segment.value;
      }
      const fromFlat = flatEnv?.[segment.name];
      if (fromFlat !== undefined) {
        return fromFlat;
      }
      return ctx.get(segment.name) ?? segment.raw;
    })
    .join('');
}

/**
 * Escape-aware resolver for workflow gRPC snapshots.
 * Uses Phase 9A grammar when valid; falls back to `VariableContext.resolve` for
 * node-scoped refs and `$expressions` outside the flat token grammar.
 */
export function createGrpcWorkflowInterpolationResolver(
  ctx: VariableContext,
  flatEnv?: Readonly<Record<string, string>>,
): GrpcInterpolationTemplateResolver {
  const flatResolver = flatEnv
    ? createGrpcInterpolationTemplateResolver(flatEnv)
    : undefined;

  return (template: string) => {
    const inspected = inspectGrpcInterpolationTemplate(template);
    if (!inspected.ok) {
      return ctx.resolve(template);
    }
    if (!inspected.hasToken) {
      return template;
    }
    if (flatResolver && inspected.segments.every(
      (segment) => segment.kind === 'literal'
        || (segment.kind === 'token' && flatEnv && segment.name in flatEnv),
    )) {
      return flatResolver(template);
    }
    return resolveInspectedWithContext(inspected, ctx, flatEnv);
  };
}
