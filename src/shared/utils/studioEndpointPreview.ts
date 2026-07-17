import type { EndpointRowStatus } from '../../features/environments/utils/protocolEndpointUtils';
import { hasUnresolvedVars, resolveEnvVars } from '../../features/websocket/wsMessageUtils';

export type StudioPreviewStatus = 'explicit' | 'fallback' | 'unresolved';

export interface StudioEndpointPreviewState {
  resolvedUrl: string;
  status: StudioPreviewStatus;
  statusSymbol: '✓' | '⚠' | '✗';
  visible: boolean;
}

function statusSymbolFor(status: StudioPreviewStatus): '✓' | '⚠' | '✗' {
  switch (status) {
    case 'explicit': return '✓';
    case 'fallback': return '⚠';
    case 'unresolved': return '✗';
  }
}

function rowStatusToPreviewStatus(
  rowStatus: EndpointRowStatus | undefined,
  hasUnresolved: boolean,
): StudioPreviewStatus {
  if (hasUnresolved) return 'unresolved';
  if (!rowStatus) return 'unresolved';
  switch (rowStatus) {
    case 'explicit':
      return 'explicit';
    case 'fallback':
      return 'fallback';
    default:
      return 'unresolved';
  }
}

/** Shared preview payload builder for protocol studios and gRPC Phase 9B preview. */
export function buildStudioEndpointPreviewState(
  trimmed: string,
  resolvedUrl: string,
  protocolRowStatus: EndpointRowStatus | undefined,
  hasUnresolved: boolean,
  options?: { hasTemplates?: boolean },
): StudioEndpointPreviewState {
  const hasTemplates = options?.hasTemplates ?? trimmed.includes('{{');
  const status = rowStatusToPreviewStatus(protocolRowStatus, hasUnresolved);
  const visible = trimmed.length > 0 && (hasTemplates || (!!resolvedUrl && resolvedUrl !== trimmed));

  return {
    resolvedUrl: resolvedUrl || trimmed,
    status,
    statusSymbol: statusSymbolFor(status),
    visible,
  };
}

/**
 * Compute inline resolved-endpoint preview for protocol studios.
 * Shows when the draft contains {{vars}} or resolves to a different URL.
 */
export function computeStudioEndpointPreview(
  draftUrl: string,
  envVarMap: Record<string, string>,
  protocolRowStatus?: EndpointRowStatus,
): StudioEndpointPreviewState {
  const trimmed = draftUrl.trim();
  const resolvedUrl = trimmed ? resolveEnvVars(trimmed, envVarMap) : '';
  const hasTemplates = trimmed.includes('{{');
  const hasUnresolved = hasTemplates && (resolvedUrl ? hasUnresolvedVars(resolvedUrl) : true);

  return buildStudioEndpointPreviewState(
    trimmed,
    resolvedUrl,
    protocolRowStatus,
    hasUnresolved,
  );
}
