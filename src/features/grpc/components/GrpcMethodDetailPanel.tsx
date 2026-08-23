import { useMemo } from 'react';
import type { GrpcMethodInfo } from '@shared/grpc/contracts';
import {
  findGrpcMethod,
  formatGrpcCallTypeLabel,
  isStreamReadyMethod,
  isUnaryReadyMethod,
  serviceExplorerShortName,
} from '../utils/grpcExplorerUtils';

export interface GrpcMethodDetailPanelProps {
  descriptor?: import('../../../shared/grpc/contracts').GrpcDescriptor;
  selectedService?: string;
  selectedMethod?: string;
  staleMethod?: GrpcMethodInfo;
}

export function GrpcMethodDetailPanel({
  descriptor,
  selectedService,
  selectedMethod,
  staleMethod,
}: GrpcMethodDetailPanelProps) {
  const method: GrpcMethodInfo | undefined = useMemo(() => {
    if (!selectedService || !selectedMethod) return undefined;
    if (descriptor) {
      const resolved = findGrpcMethod(descriptor, selectedService, selectedMethod);
      if (resolved) return resolved;
    }
    return staleMethod;
  }, [descriptor, selectedService, selectedMethod, staleMethod]);

  const hasStaleSelection = !!selectedService && !!selectedMethod && !method;

  if (!method) {
    return (
      <section className="grpc-method-detail grpc-method-detail--empty" data-testid="grpc-method-detail">
        <h3 className="grpc-method-detail-title">Method</h3>
        {hasStaleSelection ? (
          <p className="grpc-method-detail-empty grpc-method-detail-empty--stale" data-testid="grpc-method-detail-stale">
            Selected method is not in the refreshed schema. Use the drift banner to rebind or pick another method.
          </p>
        ) : (
          <p className="grpc-method-detail-empty" data-testid="grpc-method-detail-empty">
            Select a method from the service tree to inspect its request and response types.
          </p>
        )}
      </section>
    );
  }

  const unaryReady = isUnaryReadyMethod(method);
  const streamReady = isStreamReadyMethod(method);
  const serviceLabel = selectedService ? serviceExplorerShortName(selectedService) : '';

  return (
    <section className="grpc-method-detail grpc-method-detail--compact" data-testid="grpc-method-detail">
      <header className="grpc-method-detail-header">
        <div className="grpc-method-detail-summary" data-testid="grpc-method-detail-heading">
          <span className="grpc-method-detail-name" data-testid="grpc-call-method-name">
            {serviceLabel} / <strong>{method.name}</strong>
          </span>
          <span className="grpc-method-detail-summary-sep" aria-hidden="true"> · </span>
          <span className="grpc-method-detail-rpc-meta">
            {formatGrpcCallTypeLabel(method.callType)} RPC
            <span className="grpc-method-detail-subtitle-sep"> · </span>
            <span className="grpc-method-detail-type-pair" data-testid="grpc-method-detail-request-type">
              {method.requestTypeName}
            </span>
            <span className="grpc-method-detail-subtitle-sep"> → </span>
            <span className="grpc-method-detail-type-pair" data-testid="grpc-method-detail-response-type">
              {method.responseTypeName}
            </span>
          </span>
        </div>
        <span
          className={`grpc-method-detail-badge${unaryReady ? ' grpc-method-detail-badge--ready' : ''}`}
          data-testid="grpc-method-call-type"
        >
          {formatGrpcCallTypeLabel(method.callType)}
        </span>
      </header>

      <div className="grpc-method-detail-meta" data-testid="grpc-method-detail-meta">
        <span className="grpc-method-detail-meta-service" data-testid="grpc-method-detail-service">
          {selectedService}
        </span>
        <span className="grpc-method-detail-meta-sep" aria-hidden="true">·</span>
        <span className="grpc-method-detail-meta-fields" data-testid="grpc-method-detail-field-count">
          {method.requestSchema.fields.length} request field{method.requestSchema.fields.length === 1 ? '' : 's'}
        </span>
        {streamReady ? (
          <>
            <span className="grpc-method-detail-meta-sep" aria-hidden="true">·</span>
            <span
              className="grpc-method-detail-hint grpc-method-detail-hint--ready"
              data-testid="grpc-method-streaming-ready"
            >
              Streaming-ready
            </span>
          </>
        ) : null}
        {unaryReady && !streamReady ? (
          <>
            <span className="grpc-method-detail-meta-sep" aria-hidden="true">·</span>
            <span
              className="grpc-method-detail-hint grpc-method-detail-hint--ready"
              data-testid="grpc-method-unary-ready"
            >
              Ready to send
            </span>
          </>
        ) : null}
      </div>

      {method.docComment && (
        <p className="grpc-method-detail-doc">{method.docComment}</p>
      )}
    </section>
  );
}
