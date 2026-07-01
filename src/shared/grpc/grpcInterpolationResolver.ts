/**
 * Phase 9B — shared gRPC interpolation string resolver (Phase 9A grammar).
 */
import {
  getGrpcInterpolationTemplateState,
  inspectGrpcInterpolationTemplate,
  tokenizeGrpcInterpolation,
  type GrpcInterpolationInspectResult,
} from './grpcInterpolationGrammar';

export type GrpcInterpolationEnvMap = Readonly<Record<string, string>>;

export type GrpcInterpolationTemplateResolver = (template: string) => string;

export interface GrpcInterpolationResolveOptions {
  /** Throw on invalid template syntax instead of returning the original string. */
  strictSyntax?: boolean;
  /** Throw when any token name is missing from the env map. */
  requireFullyResolved?: boolean;
}

export interface GrpcInterpolationResolveResult {
  value: string;
  state: ReturnType<typeof getGrpcInterpolationTemplateState>;
  unresolvedTokenNames: string[];
}

function buildResolvedValue(
  inspected: Extract<GrpcInterpolationInspectResult, { ok: true }>,
  env: GrpcInterpolationEnvMap,
): { value: string; unresolvedTokenNames: string[] } {
  const unresolvedTokenNames: string[] = [];
  const value = inspected.segments
    .map((segment) => {
      if (segment.kind === 'literal') {
        return segment.value;
      }
      const resolved = env[segment.name];
      if (resolved === undefined) {
        unresolvedTokenNames.push(segment.name);
        return segment.raw;
      }
      return resolved;
    })
    .join('');
  return { value, unresolvedTokenNames };
}

/** Resolve a template string using Phase 9A grammar and a flat env map. */
export function resolveGrpcInterpolationTemplate(
  template: string,
  env: GrpcInterpolationEnvMap,
  options?: GrpcInterpolationResolveOptions,
): GrpcInterpolationResolveResult {
  const inspected = inspectGrpcInterpolationTemplate(template);
  if (!inspected.ok) {
    if (options?.strictSyntax) {
      throw inspected.error;
    }
    return {
      value: template,
      state: 'invalid_syntax',
      unresolvedTokenNames: [],
    };
  }
  if (!inspected.hasToken) {
    return {
      value: template,
      state: 'literal',
      unresolvedTokenNames: [],
    };
  }
  const { value, unresolvedTokenNames } = buildResolvedValue(inspected, env);
  if (options?.requireFullyResolved && unresolvedTokenNames.length > 0) {
    throw new Error(
      `Unresolved interpolation tokens: ${[...new Set(unresolvedTokenNames)].join(', ')}`,
    );
  }
  return {
    value,
    state: unresolvedTokenNames.length > 0 ? 'unresolved' : 'literal',
    unresolvedTokenNames,
  };
}

/** Factory used by harness/workflow/studio snapshot builders. */
export function createGrpcInterpolationTemplateResolver(
  env: GrpcInterpolationEnvMap,
  options?: GrpcInterpolationResolveOptions,
): GrpcInterpolationTemplateResolver {
  return (template) => resolveGrpcInterpolationTemplate(template, env, options).value;
}

/** Extract valid token names from a template (throws on invalid syntax). */
export function listGrpcInterpolationTokenNames(template: string): string[] {
  return tokenizeGrpcInterpolation(template)
    .filter((segment): segment is Extract<typeof segment, { kind: 'token' }> => segment.kind === 'token')
    .map((segment) => segment.name);
}
