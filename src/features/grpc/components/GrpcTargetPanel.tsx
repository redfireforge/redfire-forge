import { useEffect, useMemo, useState } from 'react';
import type { GrpcAuthConfig, GrpcTlsMode } from '../../../shared/grpc/contracts';
import {
  buildGrpcInterpolationTargetPreviewState,
  GRPC_INTERPOLATION_BANNER_STRIP_HINT,
  shouldShowGrpcInterpolationErrorBanner,
  type GrpcInterpolationPreviewViewMode,
} from '../../../shared/grpc/grpcInterpolationPreviewModel';
import {
  resolveGrpcInterpolationAuthConfig,
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
} from '../../../shared/grpc/grpcInterpolationDeepResolver';
import { sanitizeGrpcInterpolationDiagnosticMessage } from '../../../shared/grpc/grpcInterpolationDiagnostics';
import { createGrpcInterpolationTemplateResolver } from '../../../shared/grpc/grpcInterpolationResolver';
import { useGrpcTargetValidation } from '../hooks/useGrpcTargetValidation';
import { GrpcInterpolationErrorBanner } from './GrpcInterpolationErrorBanner';
import { GrpcInterpolationPreviewStrip } from './GrpcInterpolationPreviewStrip';

export interface GrpcTargetPanelProps {
  target: string;
  tlsMode?: GrpcTlsMode;
  /** Page/profile default used when tab target is empty (tab → profile → page precedence). */
  fallbackTarget?: string;
  envVarMap: Record<string, string>;
  workspaceDefaults?: Record<string, string>;
  profiles?: import('../utils/resolveGrpcTabConnection').GrpcConnectionProfile[];
  connectionId?: string;
  tabOverrides?: Record<string, string>;
  body?: Record<string, unknown>;
  metadata?: Record<string, string>;
  auth?: GrpcAuthConfig;
  /** Page defaults for tab → profile → page target precedence (Phase 1A). */
  pageDefaults?: import('../utils/resolveGrpcTabConnection').GrpcTabConnectionPageDefaults;
  /** When false, validation strip is hidden (connection bar owns target input). */
  showValidation?: boolean;
}

/**
 * Target validation feedback row below {@link GrpcConnectionBar} (Phase 4J-A, 9G preview UX).
 */
export function GrpcTargetPanel({
  target,
  tlsMode = 'disabled',
  fallbackTarget = '',
  envVarMap,
  workspaceDefaults,
  profiles = [],
  connectionId,
  tabOverrides,
  body,
  metadata,
  auth,
  pageDefaults,
  showValidation = true,
}: GrpcTargetPanelProps) {
  const [viewMode, setViewMode] = useState<GrpcInterpolationPreviewViewMode>('template');

  const validation = useGrpcTargetValidation({
    target,
    fallbackTarget,
    envVarMap,
    workspaceDefaults,
    tlsMode,
    profiles,
    connectionId,
    tabOverrides,
    pageDefaults,
  });

  useEffect(() => {
    setViewMode('template');
  }, [validation.draftTarget]);

  const previewState = useMemo(
    () => buildGrpcInterpolationTargetPreviewState({
      draftTarget: validation.draftTarget,
      resolvedTarget: validation.resolvedTarget,
      viewMode,
      ok: validation.ok,
      normalized: validation.normalized,
      issue: validation.issue,
      diagnostic: validation.diagnostic,
      env: validation.interpolationEnv,
    }),
    [
      validation.diagnostic,
      validation.draftTarget,
      validation.interpolationEnv,
      validation.issue,
      validation.normalized,
      validation.ok,
      validation.resolvedTarget,
      viewMode,
    ],
  );

  const showErrorBanner = shouldShowGrpcInterpolationErrorBanner(validation.diagnostic);
  const stripHintMessage = showErrorBanner
    ? GRPC_INTERPOLATION_BANNER_STRIP_HINT
    : validation.message;

  const resolvedPayloadPreview = useMemo(() => {
    if (viewMode !== 'resolved') {
      return undefined;
    }
    try {
      const resolveTemplate = createGrpcInterpolationTemplateResolver(validation.interpolationEnv);
      const resolvedBody = resolveGrpcInterpolationJsonValue(body ?? {}, resolveTemplate);
      const resolvedMetadata = resolveGrpcInterpolationMetadata(metadata ?? {}, resolveTemplate);
      const resolvedAuth = resolveGrpcInterpolationAuthConfig(auth, resolveTemplate) ?? { type: 'none' };
      const preview = JSON.stringify(
        {
          body: resolvedBody,
          metadata: resolvedMetadata,
          auth: resolvedAuth,
        },
        null,
        2,
      );
      return sanitizeGrpcInterpolationDiagnosticMessage(preview, {
        env: validation.interpolationEnv,
      });
    } catch {
      return undefined;
    }
  }, [viewMode, validation.interpolationEnv, body, metadata, auth]);

  if (!showValidation) {
    return null;
  }

  return (
    <div className="grpc-target-panel-stack" data-testid="grpc-target-panel-stack">
      {showErrorBanner && validation.diagnostic && (
        <GrpcInterpolationErrorBanner diagnostic={validation.diagnostic} />
      )}
      <div
        className={`grpc-target-validation-strip${validation.ok ? '' : ' grpc-target-validation-strip--invalid'}`}
        data-testid="grpc-target-validation-strip"
      >
        <div className="grpc-target-validation-strip__main">
          {validation.ok ? (
            <span
              className="grpc-target-status grpc-target-status--ok"
              data-testid="grpc-target-status-ok"
            >
              {validation.kind === 'in_process' ? 'In-process' : validation.normalized}
            </span>
          ) : (
            <span
              className="grpc-target-status grpc-target-status--error"
              data-testid="grpc-target-status-error"
            >
              Invalid
            </span>
          )}
          <p
            className="grpc-target-hint"
            id="grpc-target-validation"
            data-testid="grpc-target-validation"
          >
            {stripHintMessage}
          </p>
        </div>
        {previewState.showToggle && (
          <GrpcInterpolationPreviewStrip
            showToggle={previewState.showToggle}
            displayValue={previewState.displayValue}
            viewMode={viewMode}
            status={previewState.status}
            onViewModeChange={setViewMode}
          />
        )}
        {validation.showSecondaryHint && (
          <p className="grpc-target-hint grpc-target-hint--secondary">
            Accepted formats: `host:port`, `[ipv6]:port`, `in-process:&lt;name&gt;`
          </p>
        )}
        {resolvedPayloadPreview && (
          <div className="grpc-target-hint grpc-target-hint--secondary" data-testid="grpc-interpolation-payload-preview">
            <strong>Resolved payload preview (body/metadata/auth)</strong>
            <pre data-testid="grpc-interpolation-payload-preview-value">{resolvedPayloadPreview}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/** @internal Test helper — re-export validation hook for unit tests. */
// eslint-disable-next-line react-refresh/only-export-components
export { useGrpcTargetValidation };
