import { useMemo } from 'react';
import type { GrpcMethodInfo } from '../../../shared/grpc/contracts';
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
    <section className="grpc-method-detail" data-testid="grpc-method-detail">
      <header className="grpc-method-detail-header">
        <div className="grpc-method-detail-primary">
          <h3 className="grpc-method-detail-title" data-testid="grpc-method-detail-heading">
            {serviceLabel} / <strong>{method.name}</strong>
          </h3>
          <p className="grpc-method-detail-subtitle">
            {formatGrpcCallTypeLabel(method.callType)} RPC
            <span className="grpc-method-detail-subtitle-sep"> · </span>
            <span className="grpc-method-detail-type-pair" data-testid="grpc-method-detail-request-type">
              {method.requestTypeName}
            </span>
            <span className="grpc-method-detail-subtitle-sep"> → </span>
            <span className="grpc-method-detail-type-pair" data-testid="grpc-method-detail-response-type">
              {method.responseTypeName}
            </span>
          </p>
        </div>
        <span
          className={`grpc-method-detail-badge${unaryReady ? ' grpc-method-detail-badge--ready' : ''}`}
          data-testid="grpc-method-call-type"
        >
          {formatGrpcCallTypeLabel(method.callType)}
        </span>
      </header>

      <dl className="grpc-method-detail-list">
        <div className="grpc-method-detail-row">
          <dt>Service</dt>
          <dd data-testid="grpc-method-detail-service">{selectedService}</dd>
        </div>
        <div className="grpc-method-detail-row">
          <dt>Request fields</dt>
          <dd data-testid="grpc-method-detail-field-count">{method.requestSchema.fields.length}</dd>
        </div>
      </dl>

      {method.docComment && (
        <p className="grpc-method-detail-doc">{method.docComment}</p>
      )}

      {unaryReady ? (
        <p className="grpc-method-detail-hint grpc-method-detail-hint--ready" data-testid="grpc-method-unary-ready">
          Unary-ready — request body seeded for Phase 1F composer.
        </p>
      ) : streamReady ? (
        <p className="grpc-method-detail-hint grpc-method-detail-hint--ready" data-testid="grpc-method-streaming-ready">
          Streaming-ready — compose the request, then Start Stream (Send message / End stream for client and bidi).
        </p>
      ) : null}
    </section>
  );
}
