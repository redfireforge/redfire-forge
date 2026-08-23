import { redactGrpcErrorBody } from '@shared/grpc/grpcRedaction';
import { isGrpcExpressFallbackOffered } from '@shared/grpc/grpcTransportFallback';
import { formatDescriptorSourceLabel } from '../../utils/grpcExplorerUtils';
import { GrpcSpringHintCard } from '../GrpcSpringHintCard';
import { GrpcResponsePanel } from '../GrpcResponsePanel';
import { GrpcStreamMessageLog } from '../GrpcStreamMessageLog';
import { GrpcStreamPendingQueuePanel } from '../GrpcStreamPendingQueuePanel';
import { GrpcStreamStatusBar } from '../GrpcStreamStatusBar';
import type { UseGrpcCallPanelReturn } from './useGrpcCallPanel';

type GrpcCallResponsePaneProps = Pick<
  UseGrpcCallPanelReturn,
  | 'isStreamingLayout'
  | 'layoutCallType'
  | 'tab'
  | 'streamCounts'
  | 'pendingSendInFlight'
  | 'validationReady'
  | 'disabled'
  | 'hasMethod'
  | 'method'
  | 'serviceFullName'
  | 'descriptorSource'
  | 'targetAddress'
  | 'effectiveAuth'
  | 'showStreamPermissionHint'
  | 'streamTlsHint'
  | 'streamBrowserTransportHint'
  | 'dismiss'
  | 'handleEnqueueStreamMessage'
  | 'handleSendAllPendingStreamMessages'
  | 'handleExportStreamLog'
  | 'onRemovePendingStreamMessage'
  | 'onEndStream'
  | 'onClearStreamLog'
  | 'onRetryStreamWithExpress'
  | 'onRetryUnaryWithExpress'
>;

function GrpcStreamResponseHints({
  showStreamPermissionHint,
  streamTlsHint,
  streamBrowserTransportHint,
  dismiss,
}: Pick<
  GrpcCallResponsePaneProps,
  'showStreamPermissionHint' | 'streamTlsHint' | 'streamBrowserTransportHint' | 'dismiss'
>) {
  if (!showStreamPermissionHint && !streamTlsHint && !streamBrowserTransportHint) return null;
  return (
    <div className="grpc-response-hints" data-testid="grpc-stream-response-hints">
      {streamBrowserTransportHint && (
        <p className="grpc-response-transport-hint" data-testid="grpc-stream-browser-transport-hint">
          {streamBrowserTransportHint}
        </p>
      )}
      {streamTlsHint && (
        <p className="grpc-response-transport-hint" data-testid="grpc-stream-tls-hint">
          {streamTlsHint}
        </p>
      )}
      {showStreamPermissionHint && (
        <GrpcSpringHintCard
          hintId="spring_permission_denied"
          onDismiss={() => dismiss('spring_permission_denied')}
        />
      )}
    </div>
  );
}

export function GrpcCallResponsePane({
  isStreamingLayout,
  layoutCallType,
  tab,
  streamCounts,
  pendingSendInFlight,
  validationReady,
  disabled,
  hasMethod,
  method,
  serviceFullName,
  descriptorSource,
  targetAddress,
  effectiveAuth,
  showStreamPermissionHint,
  streamTlsHint,
  streamBrowserTransportHint,
  dismiss,
  handleEnqueueStreamMessage,
  handleSendAllPendingStreamMessages,
  handleExportStreamLog,
  onRemovePendingStreamMessage,
  onEndStream,
  onClearStreamLog,
  onRetryStreamWithExpress,
  onRetryUnaryWithExpress,
}: GrpcCallResponsePaneProps) {
  if (isStreamingLayout) {
    const isClientStreaming = layoutCallType === 'client_streaming';
    return (
      <div
        className={`grpc-stream-panel${isClientStreaming ? ' grpc-stream-panel--client' : ''}${layoutCallType === 'bidi_streaming' ? ' grpc-stream-panel--bidi' : ''}`}
        data-testid="grpc-stream-panel"
      >
        <div className={`grpc-stream-panel__body${isClientStreaming ? ' grpc-stream-panel__body--client' : ''}`}>
          {isClientStreaming && (
            <GrpcStreamPendingQueuePanel
              pendingBodies={tab.streamPendingBodies}
              streamActive={tab.streamLifecycle === 'streaming'}
              clientWritesEnded={tab.streamLifecycle === 'ending'}
              sendAllInFlight={pendingSendInFlight}
              disabled={disabled}
              canCompose={validationReady}
              onAddToQueue={handleEnqueueStreamMessage}
              onRemoveAtIndex={(index) => onRemovePendingStreamMessage?.(index)}
              onSendAll={handleSendAllPendingStreamMessages}
              onEndStream={() => onEndStream?.()}
            />
          )}
          <div className="grpc-stream-panel__main">
            <GrpcStreamStatusBar
              lifecycle={tab.streamLifecycle}
              inboundCount={streamCounts.inbound}
              outboundCount={streamCounts.outbound}
              startedAt={tab.streamStartedAt}
              endedAt={tab.streamEndedAt}
              onClear={() => onClearStreamLog?.()}
              onExport={handleExportStreamLog}
              disabled={disabled}
            />
            <GrpcStreamMessageLog messages={tab.streamMessages} disabled={disabled} />
            {tab.streamError && (
              <div className="grpc-stream-error-block" data-testid="grpc-stream-error-block">
                <p className="grpc-stream-error" data-testid="grpc-stream-error" role="alert">
                  {redactGrpcErrorBody(tab.streamError).message}
                </p>
                {isGrpcExpressFallbackOffered(tab.streamError) && onRetryStreamWithExpress && (
                  <button
                    type="button"
                    className="grpc-retry-express-btn"
                    data-testid="grpc-stream-retry-express-btn"
                    disabled={disabled}
                    onClick={onRetryStreamWithExpress}
                  >
                    Retry with Express Proxy
                  </button>
                )}
              </div>
            )}
            <GrpcStreamResponseHints
              showStreamPermissionHint={showStreamPermissionHint}
              streamTlsHint={streamTlsHint}
              streamBrowserTransportHint={streamBrowserTransportHint}
              dismiss={dismiss}
            />
            {!hasMethod && (
              <p className="grpc-stream-layout-preview-hint" data-testid="grpc-stream-layout-preview-hint">
                Layout preview — select a matching method in the explorer to start a stream.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <GrpcResponsePanel
      lifecycle={tab.lifecycle}
      lastResult={tab.lastResult}
      lastError={tab.lastError}
      latencyHistoryMs={tab.latencyHistoryMs}
      method={method}
      serviceFullName={serviceFullName}
      descriptorSourceLabel={descriptorSource ? formatDescriptorSourceLabel(descriptorSource) : undefined}
      targetAddress={targetAddress}
      auth={effectiveAuth}
      disabled={disabled}
      onRetryWithExpress={onRetryUnaryWithExpress}
    />
  );
}
