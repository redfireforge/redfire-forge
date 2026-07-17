import { useMemo } from 'react';
import type { EndpointRowStatus } from '../../features/environments/utils/protocolEndpointUtils';
import {
  computeStudioEndpointPreview,
  type StudioEndpointPreviewState,
} from '../utils/studioEndpointPreview';

export interface ProtocolEndpointPreviewProps {
  draftUrl: string;
  envVarMap?: Record<string, string>;
  protocolRowStatus?: EndpointRowStatus;
  testId?: string;
  className?: string;
  /** Override default WS-style preview (gRPC Studio passes Phase 9B resolver preview). */
  computePreview?: (
    draftUrl: string,
    envVarMap: Record<string, string>,
    protocolRowStatus?: EndpointRowStatus,
  ) => StudioEndpointPreviewState;
}

export function ProtocolEndpointPreview({
  draftUrl,
  envVarMap = {},
  protocolRowStatus,
  testId = 'protocol-endpoint-preview',
  className = '',
  computePreview = computeStudioEndpointPreview,
}: ProtocolEndpointPreviewProps) {
  const preview = useMemo(
    () => computePreview(draftUrl, envVarMap, protocolRowStatus),
    [computePreview, draftUrl, envVarMap, protocolRowStatus],
  );

  if (!preview.visible) return null;

  return (
    <div
      className={`studio-endpoint-preview ${className}`.trim()}
      data-testid={testId}
      data-status={preview.status}
    >
      <span className="studio-endpoint-preview-label">→ Resolved:</span>
      <code className="studio-endpoint-preview-url">{preview.resolvedUrl}</code>
      <span
        className={`studio-endpoint-preview-status studio-endpoint-preview-status--${preview.status}`}
        aria-label={`Endpoint ${preview.status}`}
      >
        {preview.statusSymbol}
      </span>
    </div>
  );
}
