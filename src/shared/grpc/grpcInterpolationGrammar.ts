/**
 * Phase 9A — gRPC interpolation token grammar and escape rules.
 *
 * Token syntax: `{{varName}}` where varName matches `[A-Za-z_][A-Za-z0-9_]*`.
 * Escapes: `\{{` and `\}}` emit literal braces without starting/ending a token.
 */
import {
  GRPC_INTERPOLATION_ERROR_CODES,
  GRPC_INTERPOLATION_VAR_NAME_PATTERN,
  type GrpcInterpolationErrorCode,
} from './grpcInterpolationConstants';

export type GrpcInterpolationSegment =
  | { kind: 'literal'; value: string }
  | { kind: 'token'; name: string; raw: string };

export class GrpcInterpolationSyntaxError extends Error {
  readonly code: GrpcInterpolationErrorCode = GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX;

  constructor(message: string) {
    super(message);
    this.name = 'GrpcInterpolationSyntaxError';
  }
}

function readEscapedOpen(input: string, index: number): number | null {
  if (input[index] === '\\' && input[index + 1] === '{' && input[index + 2] === '{') {
    return index + 3;
  }
  return null;
}

function readEscapedClose(input: string, index: number): number | null {
  if (input[index] === '\\' && input[index + 1] === '}' && input[index + 2] === '}') {
    return index + 3;
  }
  return null;
}

/**
 * Split a template string into literal and token segments.
 * Throws `GrpcInterpolationSyntaxError` on unclosed `{{` or empty token names.
 */
export function tokenizeGrpcInterpolation(input: string): GrpcInterpolationSegment[] {
  const segments: GrpcInterpolationSegment[] = [];
  let literal = '';
  let i = 0;

  const flushLiteral = () => {
    if (literal.length > 0) {
      segments.push({ kind: 'literal', value: literal });
      literal = '';
    }
  };

  while (i < input.length) {
    const escapedOpen = readEscapedOpen(input, i);
    if (escapedOpen !== null) {
      literal += '{{';
      i = escapedOpen;
      continue;
    }

    const escapedClose = readEscapedClose(input, i);
    if (escapedClose !== null) {
      literal += '}}';
      i = escapedClose;
      continue;
    }

    if (input[i] === '{' && input[i + 1] === '{') {
      const closeIndex = input.indexOf('}}', i + 2);
      if (closeIndex === -1) {
        throw new GrpcInterpolationSyntaxError('Unclosed interpolation token: missing closing }}');
      }
      const inner = input.slice(i + 2, closeIndex).trim();
      if (!inner) {
        throw new GrpcInterpolationSyntaxError('Empty interpolation token name in {{}}');
      }
      if (!GRPC_INTERPOLATION_VAR_NAME_PATTERN.test(inner)) {
        throw new GrpcInterpolationSyntaxError(
          `Invalid interpolation token name "${inner}"; expected [A-Za-z_][A-Za-z0-9_]*`,
        );
      }
      flushLiteral();
      const raw = input.slice(i, closeIndex + 2);
      segments.push({ kind: 'token', name: inner, raw });
      i = closeIndex + 2;
      continue;
    }

    literal += input[i];
    i += 1;
  }

  flushLiteral();
  return segments;
}

/** Legacy `hasUnresolvedVars` regex from `wsMessageUtils` (no escape or name validation). */
export const LEGACY_UNRESOLVED_VAR_PATTERN = /\{\{[^}]+\}\}/;

export type GrpcInterpolationInspectResult =
  | { ok: true; segments: GrpcInterpolationSegment[]; hasToken: boolean }
  | { ok: false; error: GrpcInterpolationSyntaxError };

/** Non-throwing parse wrapper for validators and migration tooling. */
export function inspectGrpcInterpolationTemplate(input: string): GrpcInterpolationInspectResult {
  try {
    const segments = tokenizeGrpcInterpolation(input);
    return {
      ok: true,
      segments,
      hasToken: segments.some((segment) => segment.kind === 'token'),
    };
  } catch (error) {
    if (error instanceof GrpcInterpolationSyntaxError) {
      return { ok: false, error };
    }
    throw error;
  }
}

/** Returns true when the string contains at least one unescaped `{{token}}` segment. */
export function containsGrpcInterpolationToken(input: string): boolean {
  const inspected = inspectGrpcInterpolationTemplate(input);
  if (!inspected.ok) {
    throw inspected.error;
  }
  return inspected.hasToken;
}

/** Extract token names when syntax is valid; returns syntax error otherwise (non-throwing). */
export function extractGrpcInterpolationTokenNamesSafe(
  input: string,
): { ok: true; names: string[] } | { ok: false; error: GrpcInterpolationSyntaxError } {
  const inspected = inspectGrpcInterpolationTemplate(input);
  if (!inspected.ok) {
    return { ok: false, error: inspected.error };
  }
  return {
    ok: true,
    names: inspected.segments
      .filter((segment): segment is Extract<GrpcInterpolationSegment, { kind: 'token' }> =>
        segment.kind === 'token')
      .map((segment) => segment.name),
  };
}

/** Extract unescaped token names in source order (duplicates preserved). */
export function extractGrpcInterpolationTokenNames(input: string): string[] {
  return tokenizeGrpcInterpolation(input)
    .filter((segment): segment is Extract<GrpcInterpolationSegment, { kind: 'token' }> =>
      segment.kind === 'token')
    .map((segment) => segment.name);
}

/**
 * Returns true when any unescaped interpolation token remains in the string.
 * Invalid syntax is not treated as unresolved — use `inspectGrpcInterpolationTemplate` for validation.
 */
export function hasUnresolvedGrpcInterpolationTokens(input: string): boolean {
  const inspected = inspectGrpcInterpolationTemplate(input);
  return inspected.ok && inspected.hasToken;
}

/** Remove escape backslashes from `\{{` / `\}}` sequences for display-only previews. */
export function unescapeGrpcInterpolationLiterals(input: string): string {
  return input.replace(/\\(\{\{|\}\})/g, '$1');
}

/** Escape literal `{{` / `}}` substrings so they are not parsed as tokens. */
export function escapeGrpcInterpolationLiterals(input: string): string {
  return input.replace(/\{\{/g, '\\{{').replace(/\}\}/g, '\\}}');
}

/**
 * Phase 9A compatibility note: legacy harness/workflow code uses `hasUnresolvedVars`
 * from wsMessageUtils (no escape awareness, accepts invalid/empty token names).
 * Phase 9B will migrate callers to this grammar.
 */
export function legacyHasUnresolvedVarsDiffers(input: string): boolean {
  const legacyHas = LEGACY_UNRESOLVED_VAR_PATTERN.test(input);
  const inspected = inspectGrpcInterpolationTemplate(input);
  if (!inspected.ok) {
    return legacyHas || input.includes('{{');
  }
  return legacyHas !== inspected.hasToken;
}

/** 9B resolver entry state: literal string, valid unresolved tokens, or invalid syntax. */
export function getGrpcInterpolationTemplateState(
  input: string,
): 'literal' | 'unresolved' | 'invalid_syntax' {
  const inspected = inspectGrpcInterpolationTemplate(input);
  if (!inspected.ok) {
    return 'invalid_syntax';
  }
  return inspected.hasToken ? 'unresolved' : 'literal';
}
