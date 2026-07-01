/**
 * Phase 9G — Studio interpolation preview state (template vs resolved).
 */
import {
  GRPC_INTERPOLATION_ERROR_CODES,
  type GrpcInterpolationValidationIssue,
} from './grpcInterpolationConstants';
import { getGrpcInterpolationTemplateState } from './grpcInterpolationGrammar';
import {
  buildSafeGrpcInterpolationDiagnosticPayload,
  sanitizeGrpcInterpolationDiagnosticMessage,
  type GrpcInterpolationDiagnosticPayload,
} from './grpcInterpolationDiagnostics';

export type GrpcInterpolationPreviewViewMode = 'template' | 'resolved';

export type GrpcInterpolationPreviewStatus = 'ready' | 'warning' | 'error';

export interface GrpcInterpolationPreviewState {
  showToggle: boolean;
  templateValue: string;
  resolvedValue: string;
  displayValue: string;
  viewMode: GrpcInterpolationPreviewViewMode;
  status: GrpcInterpolationPreviewStatus;
  diagnostic?: GrpcInterpolationDiagnosticPayload;
}

export interface BuildGrpcInterpolationTargetPreviewOptions {
  draftTarget: string;
  resolvedTarget: string;
  viewMode: GrpcInterpolationPreviewViewMode;
  ok: boolean;
  normalized?: string;
  issue?: GrpcInterpolationValidationIssue;
  /** Pre-built diagnostic (preferred — uses merged interpolation env from hook). */
  diagnostic?: GrpcInterpolationDiagnosticPayload;
  env?: Readonly<Record<string, string>>;
}

/** Whether the target strip should offer template ↔ resolved toggle. */
export function shouldShowGrpcInterpolationPreviewToggle(
  draftTarget: string,
  resolvedTarget: string,
): boolean {
  const draft = draftTarget.trim();
  if (!draft) {
    return false;
  }
  const templateState = getGrpcInterpolationTemplateState(draft);
  if (templateState === 'unresolved' || templateState === 'invalid_syntax') {
    return true;
  }
  const resolved = resolvedTarget.trim();
  return resolved.length > 0 && draft !== resolved;
}

export function resolveGrpcInterpolationPreviewDisplayValue(
  viewMode: GrpcInterpolationPreviewViewMode,
  draftTarget: string,
  resolvedTarget: string,
  normalized?: string,
  previewEnv?: Readonly<Record<string, string>>,
): string {
  let value: string;
  if (viewMode === 'template') {
    value = draftTarget.trim();
  } else if (okNormalizedTarget(normalized)) {
    value = normalized;
  } else {
    value = resolvedTarget.trim() || draftTarget.trim();
  }
  if (viewMode === 'resolved' && previewEnv) {
    return sanitizeGrpcInterpolationDiagnosticMessage(value, { env: previewEnv });
  }
  return value;
}

function okNormalizedTarget(normalized: string | undefined): normalized is string {
  return typeof normalized === 'string' && normalized.length > 0;
}

function classifyPreviewStatus(ok: boolean): GrpcInterpolationPreviewStatus {
  return ok ? 'ready' : 'error';
}

/** Build preview strip state for gRPC Studio target validation row. */
export function buildGrpcInterpolationTargetPreviewState(
  options: BuildGrpcInterpolationTargetPreviewOptions,
): GrpcInterpolationPreviewState {
  const draft = options.draftTarget.trim();
  const resolved = options.resolvedTarget.trim();
  const showToggle = shouldShowGrpcInterpolationPreviewToggle(draft, resolved);
  const diagnostic = options.diagnostic
    ?? (options.issue
      ? buildSafeGrpcInterpolationDiagnosticPayload(options.issue, { env: options.env })
      : undefined);
  const displayValue = resolveGrpcInterpolationPreviewDisplayValue(
    options.viewMode,
    draft,
    resolved,
    options.normalized,
    options.env,
  );
  const status = classifyPreviewStatus(options.ok);

  return {
    showToggle,
    templateValue: draft,
    resolvedValue: resolved,
    displayValue,
    viewMode: options.viewMode,
    status,
    diagnostic,
  };
}

/** Shorter strip hint when the dedicated interpolation error banner owns the details. */
export const GRPC_INTERPOLATION_BANNER_STRIP_HINT =
  'Connection blocked until the interpolation issue above is resolved.';

/** Cycle and missing-token failures warrant the dedicated error banner. */
export function shouldShowGrpcInterpolationErrorBanner(
  diagnostic: GrpcInterpolationDiagnosticPayload | undefined,
): boolean {
  if (!diagnostic) {
    return false;
  }
  return diagnostic.code === GRPC_INTERPOLATION_ERROR_CODES.CYCLE
    || diagnostic.code === GRPC_INTERPOLATION_ERROR_CODES.MISSING_TOKEN
    || diagnostic.code === GRPC_INTERPOLATION_ERROR_CODES.INVALID_SYNTAX;
}
