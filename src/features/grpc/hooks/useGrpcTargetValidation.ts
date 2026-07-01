import { useMemo } from 'react';
import type { GrpcTlsMode } from '../../../shared/grpc/contracts';
import {
  getGrpcInterpolationTemplateState,
  hasUnresolvedGrpcInterpolationTokens,
} from '../../../shared/grpc/grpcInterpolationGrammar';
import { createGrpcInterpolationTemplateResolver } from '../../../shared/grpc/grpcInterpolationResolver';
import { mergeGrpcTabInterpolationEnv } from '../../../shared/grpc/grpcInterpolationPrecedence';
import type { GrpcConnectionProfile, GrpcTabConnectionPageDefaults } from '../utils/resolveGrpcTabConnection';
import {
  resolveGrpcConnectionTargetTemplate,
  validateGrpcCanonicalEnvTokensForConnection,
  validateGrpcCanonicalEnvTokensForTarget,
} from '../../../shared/grpc/grpcCanonicalEnvValidation';
import {
  detectGrpcInterpolationEnvCycle,
  validateGrpcInterpolationEnvCycles,
} from '../../../shared/grpc/grpcInterpolationCycleDetector';
import {
  buildSafeGrpcInterpolationDiagnosticPayload,
  sanitizeGrpcInterpolationDiagnosticMessage,
  type GrpcInterpolationDiagnosticPayload,
} from '../../../shared/grpc/grpcInterpolationDiagnostics';
import { GRPC_INTERPOLATION_ERROR_CODES } from '../../../shared/grpc/grpcInterpolationConstants';
import type { GrpcInterpolationValidationIssue } from '../../../shared/grpc/grpcInterpolationConstants';
import {
  validateGrpcTargetAddress,
  validateResolvedGrpcTargetAddress,
  withGrpcTargetValidationMessage,
  grpcTargetValidationMessage,
} from '../../../shared/grpc/targetValidation';
import { buildUnresolvedGrpcTargetFailure } from '../../../shared/grpc/grpcTargetValidationCatalog';

function buildReadyMessage(
  usingFallback: boolean,
  normalized: string | undefined,
  draftTarget: string,
  tlsMode: GrpcTlsMode,
): string {
  const tlsLabel = tlsMode === 'mtls' ? 'mTLS' : tlsMode === 'tls' ? 'TLS' : 'Plaintext';
  const transportNote = tlsMode === 'disabled'
    ? 'Plaintext transport (no TLS).'
    : `${tlsLabel} transport enabled for call, stream, and reflection.`;
  if (usingFallback) {
    return `Ready — using environment default (${normalized ?? draftTarget}). ${transportNote}`;
  }
  return `Ready — ${transportNote}`;
}

function sanitizeMessage(
  message: string,
  env: Readonly<Record<string, string>>,
): string {
  return sanitizeGrpcInterpolationDiagnosticMessage(message, { env });
}

function buildDiagnostic(
  issue: GrpcInterpolationValidationIssue,
  env: Readonly<Record<string, string>>,
): GrpcInterpolationDiagnosticPayload {
  const cyclePath = issue.code === GRPC_INTERPOLATION_ERROR_CODES.CYCLE
    ? detectGrpcInterpolationEnvCycle(env)?.path
    : undefined;
  return buildSafeGrpcInterpolationDiagnosticPayload(issue, { env, cyclePath });
}

export interface UseGrpcTargetValidationOptions {
  target: string;
  fallbackTarget?: string;
  envVarMap: Record<string, string>;
  tlsMode?: GrpcTlsMode;
  profiles?: GrpcConnectionProfile[];
  connectionId?: string;
  tabOverrides?: Record<string, string>;
  /** Page defaults for tab → profile → page target precedence (Phase 1A). */
  pageDefaults?: GrpcTabConnectionPageDefaults;
}

export interface GrpcTargetValidationResult {
  usingFallback: boolean;
  draftTarget: string;
  resolvedTarget: string;
  ok: boolean;
  message: string;
  normalized?: string;
  kind?: 'host_port' | 'in_process';
  readyMessage: string;
  showSecondaryHint: boolean;
  /** Phase 9G — secret-safe diagnostic payload for error banner. */
  diagnostic?: GrpcInterpolationDiagnosticPayload;
  /** Phase 9G — structured issue when validation fails. */
  issue?: GrpcInterpolationValidationIssue;
  /** Phase 9G — merged interpolation env (for secret-safe preview redaction). */
  interpolationEnv: Record<string, string>;
}

export function useGrpcTargetValidation({
  target,
  fallbackTarget = '',
  envVarMap,
  tlsMode = 'disabled',
  profiles = [],
  connectionId,
  tabOverrides,
  pageDefaults,
}: UseGrpcTargetValidationOptions): GrpcTargetValidationResult {
  const connectionDefaults = useMemo(
    (): GrpcTabConnectionPageDefaults => pageDefaults ?? {
      target: fallbackTarget,
      tlsMode,
    },
    [pageDefaults, fallbackTarget, tlsMode],
  );
  const usesConnectionPrecedence = Boolean(
    pageDefaults || connectionId || profiles.length > 0,
  );
  const draftTarget = usesConnectionPrecedence
    ? resolveGrpcConnectionTargetTemplate(
      { target, connectionId, tlsMode },
      profiles,
      connectionDefaults,
    )
    : (target.trim() || fallbackTarget.trim());
  const usingFallback = !target.trim() && !!draftTarget.trim() && draftTarget !== target.trim();

  const mergedEnv = useMemo(
    () => mergeGrpcTabInterpolationEnv({
      activeEnvironment: envVarMap,
      profiles,
      connectionId,
      tabOverrides,
    }),
    [envVarMap, profiles, connectionId, tabOverrides],
  );

  const resolveTemplate = useMemo(
    () => createGrpcInterpolationTemplateResolver(mergedEnv),
    [mergedEnv],
  );

  const resolvedTarget = useMemo(
    () => resolveTemplate(draftTarget),
    [draftTarget, resolveTemplate],
  );

  const validation = useMemo(() => {
    if (!draftTarget) {
      const issue: GrpcInterpolationValidationIssue = {
        field: 'target',
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        message: 'Target address is required',
      };
      return {
        ok: false as const,
        message: sanitizeMessage(issue.message, mergedEnv),
        issue,
      };
    }
    if (getGrpcInterpolationTemplateState(draftTarget) === 'invalid_syntax') {
      const issue: GrpcInterpolationValidationIssue = {
        field: 'target',
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX,
        message: 'Invalid interpolation syntax in target address',
        context: 'target',
      };
      return {
        ok: false as const,
        message: sanitizeMessage(issue.message, mergedEnv),
        issue,
      };
    }

    const cycleIssue = validateGrpcInterpolationEnvCycles(mergedEnv);
    if (cycleIssue) {
      return {
        ok: false as const,
        message: sanitizeMessage(cycleIssue.message, mergedEnv),
        issue: cycleIssue,
      };
    }

    const canonicalIssues = usesConnectionPrecedence
      ? validateGrpcCanonicalEnvTokensForConnection(
        mergedEnv,
        { target, connectionId, tlsMode },
        profiles,
        connectionDefaults,
      )
      : validateGrpcCanonicalEnvTokensForTarget(mergedEnv, draftTarget);
    if (canonicalIssues.length > 0) {
      const issue = canonicalIssues[0]!;
      return {
        ok: false as const,
        message: sanitizeMessage(issue.message, mergedEnv),
        issue,
      };
    }

    if (hasUnresolvedGrpcInterpolationTokens(resolvedTarget)) {
      const unresolved = buildUnresolvedGrpcTargetFailure(resolvedTarget);
      const message = grpcTargetValidationMessage({
        valid: false,
        reason: unresolved.reason,
        hint: unresolved.hint,
      });
      const issue: GrpcInterpolationValidationIssue = {
        field: 'target',
        code: unresolved.code,
        message,
        context: 'target',
      };
      return {
        ok: false as const,
        message: sanitizeMessage(message, mergedEnv),
        issue,
      };
    }
    const result = withGrpcTargetValidationMessage(
      validateResolvedGrpcTargetAddress(resolvedTarget),
    );
    if (!result.valid) {
      const issue: GrpcInterpolationValidationIssue = {
        field: 'target',
        code: GRPC_INTERPOLATION_ERROR_CODES.INVALID_TARGET,
        message: result.reason,
        context: 'target',
      };
      return {
        ok: false as const,
        message: sanitizeMessage(result.reason, mergedEnv),
        issue,
      };
    }
    return { ok: true as const, normalized: result.normalized, kind: result.kind };
  }, [
    connectionDefaults,
    connectionId,
    draftTarget,
    mergedEnv,
    profiles,
    resolvedTarget,
    target,
    tlsMode,
    usesConnectionPrecedence,
  ]);

  const syntaxCheck = validateGrpcTargetAddress(resolvedTarget);
  const showSyntaxHint = draftTarget && hasUnresolvedGrpcInterpolationTokens(resolvedTarget)
    ? validateGrpcTargetAddress(draftTarget)
    : syntaxCheck;

  const readyMessage = buildReadyMessage(
    usingFallback,
    validation.ok ? validation.normalized : undefined,
    draftTarget,
    tlsMode,
  );

  const showSecondaryHint = !validation.ok
    && !hasUnresolvedGrpcInterpolationTokens(resolvedTarget)
    && !showSyntaxHint.valid
    && !!draftTarget;

  const diagnostic = validation.ok || !validation.issue
    ? undefined
    : buildDiagnostic(validation.issue, mergedEnv);

  return {
    usingFallback,
    draftTarget,
    resolvedTarget,
    ok: validation.ok,
    message: validation.ok ? readyMessage : validation.message,
    normalized: validation.ok ? validation.normalized : undefined,
    kind: validation.ok ? validation.kind : undefined,
    readyMessage,
    showSecondaryHint,
    diagnostic,
    issue: validation.ok ? undefined : validation.issue,
    interpolationEnv: mergedEnv,
  };
}
