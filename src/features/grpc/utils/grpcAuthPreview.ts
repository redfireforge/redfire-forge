/**
 * Phase 4C — auth merge preview and execute-readiness for Studio UI.
 */
import type { GrpcAuthConfig, GrpcAuthMetadataConflict } from '../../../shared/grpc/contracts';
import {
  buildGrpcOAuth2PreviewMetadata,
  mergeGrpcExecuteMetadata,
  validateGrpcAuthForExecute,
  type GrpcAuthValidationIssue,
} from '../../../shared/grpc/grpcAuthPolicy';
import { sanitizeGrpcErrorMessage } from '../../../shared/grpc/grpcRedaction';
import { isGrpcSecretMetadataKey } from '../../../shared/grpc/grpcSecretPolicy';

export interface GrpcAuthPreviewResult {
  ok: boolean;
  issues: GrpcAuthValidationIssue[];
  conflicts: GrpcAuthMetadataConflict[];
  previewEntries: Array<{ key: string; value: string }>;
  errorMessage?: string;
}

function maskPreviewValue(key: string, value: string): string {
  if (isGrpcSecretMetadataKey(key)) {
    return value.trim() ? '••••••' : '';
  }
  return value;
}

/** Live auth merge preview for the Auth panel. */
export function previewGrpcAuthMerge(
  manualMetadata: Record<string, string>,
  auth: GrpcAuthConfig | undefined,
): GrpcAuthPreviewResult {
  const issues = validateGrpcAuthForExecute(auth);
  if (auth?.type === 'oauth2') {
    const preview = buildGrpcOAuth2PreviewMetadata(manualMetadata, auth);
    if (!preview.ok) {
      return {
        ok: false,
        issues,
        conflicts: [],
        previewEntries: [],
        errorMessage: issues.length === 0 ? sanitizeGrpcErrorMessage(preview.error) : undefined,
      };
    }
    const previewEntries = Object.entries(preview.metadata)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => ({
        key,
        value: maskPreviewValue(key, value),
      }));
    return {
      ok: issues.length === 0,
      issues,
      conflicts: preview.conflicts,
      previewEntries,
    };
  }

  const merged = mergeGrpcExecuteMetadata(manualMetadata, auth);

  if (!merged.ok) {
    return {
      ok: false,
      issues,
      conflicts: [],
      previewEntries: [],
      errorMessage: issues.length === 0 ? sanitizeGrpcErrorMessage(merged.error) : undefined,
    };
  }

  const previewEntries = Object.entries(merged.metadata)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      value: maskPreviewValue(key, value),
    }));

  return {
    ok: issues.length === 0 && merged.ok,
    issues,
    conflicts: merged.conflicts,
    previewEntries,
  };
}

export function isGrpcAuthExecuteReady(auth: GrpcAuthConfig | undefined): boolean {
  return validateGrpcAuthForExecute(auth).length === 0;
}
