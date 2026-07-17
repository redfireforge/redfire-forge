/**
 * Phase 9B — gRPC Studio target preview using shared interpolation resolver.
 */
import type { EndpointRowStatus } from '../../features/environments/utils/protocolEndpointUtils';
import {
  buildStudioEndpointPreviewState,
  type StudioEndpointPreviewState,
} from '../utils/studioEndpointPreview';
import {
  getGrpcInterpolationTemplateState,
  hasUnresolvedGrpcInterpolationTokens,
} from './grpcInterpolationGrammar';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';

function grpcTargetPreviewHasUnresolved(
  draftTarget: string,
  resolvedTarget: string,
): boolean {
  const draftState = getGrpcInterpolationTemplateState(draftTarget);
  if (draftState === 'invalid_syntax') {
    return true;
  }
  if (!resolvedTarget) {
    return true;
  }
  return hasUnresolvedGrpcInterpolationTokens(resolvedTarget);
}

/** Resolved-endpoint preview for gRPC Studio header (Phase 9B grammar). */
export function resolveGrpcStudioEndpointPreviewDraft(
  tabTarget: string,
  connectionTemplateTarget: string,
): string {
  const trimmedTab = tabTarget.trim();
  if (trimmedTab) {
    return trimmedTab;
  }
  const trimmedConnection = connectionTemplateTarget.trim();
  if (trimmedConnection) {
    return trimmedConnection;
  }
  return '{{grpcHost}}';
}

/** Resolved-endpoint preview for gRPC Studio header (Phase 9B grammar). */
export function computeGrpcStudioTargetPreview(
  draftTarget: string,
  envVarMap: Record<string, string>,
  protocolRowStatus?: EndpointRowStatus,
): StudioEndpointPreviewState {
  const trimmed = draftTarget.trim();
  const resolvedUrl = trimmed
    ? createGrpcInterpolationTemplateResolver(envVarMap)(trimmed)
    : '';
  const templateState = getGrpcInterpolationTemplateState(trimmed);
  const hasTemplates = templateState !== 'literal';
  const hasUnresolved = hasTemplates
    && grpcTargetPreviewHasUnresolved(trimmed, resolvedUrl);

  return buildStudioEndpointPreviewState(
    trimmed,
    resolvedUrl,
    protocolRowStatus,
    hasUnresolved,
    { hasTemplates },
  );
}
