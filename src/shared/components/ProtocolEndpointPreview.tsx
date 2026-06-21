import { useMemo } from 'react';
import type { EndpointRowStatus } from '../../features/environments/utils/protocolEndpointUtils';
import { computeStudioEndpointPreview } from '../utils/studioEndpointPreview';

export interface ProtocolEndpointPreviewProps {
  draftUrl: string;
  envVarMap?: Record<string, string>;
  protocolRowStatus?: EndpointRowStatus;
  testId?: string;
  className?: string;
}

export function ProtocolEndpointPreview({
  draftUrl,
  envVarMap = {},
  protocolRowStatus,
  testId = 'protocol-endpoint-preview',
  className = '',
}: ProtocolEndpointPreviewProps) {
  const preview = useMemo(
    () => computeStudioEndpointPreview(draftUrl, envVarMap, protocolRowStatus),
    [draftUrl, envVarMap, protocolRowStatus],
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
