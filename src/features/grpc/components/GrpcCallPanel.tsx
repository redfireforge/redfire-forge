import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GrpcMessageSchema, GrpcMethodInfo } from '../../../shared/grpc/contracts';
import { redactGrpcErrorBody } from '../../../shared/grpc/grpcRedaction';
import { isGrpcExpressFallbackOffered } from '../../../shared/grpc/grpcTransportFallback';
import { isGrpcStreamLifecycleInFlight } from '../../../shared/grpc/streamLifecycle';
import type { GrpcStudioTabState, GrpcExecuteOverrides } from '../grpcStudioTypes';
import {
  applyJsonTextToSchema,
  serializeGrpcBodyJson,
} from '../utils/grpcBodyComposer';
import {
  formatDescriptorSourceLabel,
  formatGrpcCallTypeLabel,
  isStreamReadyMethod,
  isStreamingLayoutCallType,
  isUnaryReadyMethod,
  resolveGrpcStudioLayoutCallType,
  serviceExplorerShortName,
} from '../utils/grpcExplorerUtils';
import { countGrpcStreamDirections } from '../utils/grpcStreamLogUtils';
import { validateGrpcMetadataEntries, metadataEntriesFromRecord } from '../utils/grpcMetadataEditor';
import { previewGrpcAuthMerge } from '../utils/grpcAuthPreview';
import type { GrpcAuthSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { pruneAuthMaskForConfig } from '../utils/grpcSecretFieldUi';
import { GrpcSpringHintCard } from './GrpcSpringHintCard';
import { useGrpcStudioHints } from '../hooks/useGrpcStudioHints';
import { shouldShowPermissionDeniedHint, shouldShowSpringHealthHint } from '../utils/grpcSpringHints';
import { formatGrpcBrowserTransportFailureHint, formatGrpcTlsFailureHint } from '../utils/grpcResponseUtils';
import { GrpcAuthPanel } from './GrpcAuthPanel';
import { GrpcMetadataEditor } from './GrpcMetadataEditor';
import { GrpcProtoFormBuilder } from './GrpcProtoFormBuilder';
import { GrpcCallTypeSelectorRow } from './GrpcCallTypeSelectorRow';
import { GrpcJsonCodeToolbar } from './GrpcJsonCodeToolbar';
import { GrpcHighlightedJsonTextarea } from './GrpcHighlightedJsonTextarea';
import { GrpcResponsePanel } from './GrpcResponsePanel';
import { GrpcStreamComposePanel } from './GrpcStreamComposePanel';
import { GrpcStreamMessageLog } from './GrpcStreamMessageLog';
import { GrpcStreamPendingQueuePanel } from './GrpcStreamPendingQueuePanel';
import { GrpcStreamStatusBar } from './GrpcStreamStatusBar';
import {
  buildGrpcStreamLogExportFilename,
  buildGrpcStreamLogExportPayload,
  downloadGrpcStreamLogExport,
} from '../utils/grpcStreamLogExport';
import { isGrpcLifecycleInFlight } from '../grpcStudioTypes';

export type GrpcComposerTab = 'form' | 'json' | 'metadata' | 'auth';

export interface GrpcCallPanelProps {
  tab: GrpcStudioTabState;
  method?: GrpcMethodInfo;
  messageTypes?: GrpcMessageSchema[];
  descriptorSource?: import('../../../shared/grpc/contracts').GrpcDescriptor['source'];
  serviceFullName?: string;
  targetValid?: boolean;
  tlsValid?: boolean;
  targetAddress?: string;
  disabled?: boolean;
  /** Blocks Send/Start stream while still allowing request editing (schema drift). */
  executeBlocked?: boolean;
  descriptorLoading?: boolean;
  onPatch: (patch: Partial<GrpcStudioTabState>) => void;
  onSendUnary?: (overrides?: GrpcExecuteOverrides) => void;
  onCancelUnary?: () => void;
  onStartStream?: (overrides?: GrpcExecuteOverrides) => void;
  onCancelStream?: () => void;
  onSendStreamMessage?: (overrides?: GrpcExecuteOverrides) => void;
  onEnqueueStreamMessage?: (overrides?: GrpcExecuteOverrides) => void;
  onRemovePendingStreamMessage?: (index: number) => void;
  onSendAllPendingStreamMessages?: () => void | Promise<void>;
  onEndStream?: () => void;
  onClearStreamLog?: () => void;
  onRetryUnaryWithExpress?: () => void;
  onRetryStreamWithExpress?: () => void;
  onUnmaskAuthSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  onClearAuthSecretField?: (field: GrpcAuthSecretFieldKey) => void;
  /** Increment from connection bar to focus Auth tab (Phase 4J-A). */
  authTabFocusRequest?: number;
}

export function GrpcCallPanel({
  tab,
  method,
  messageTypes,
  descriptorSource,
  serviceFullName,
  targetValid = false,
  tlsValid = true,
  targetAddress,
  disabled = false,
  executeBlocked = false,
  descriptorLoading = false,
  onPatch,
  onSendUnary,
  onCancelUnary,
  onStartStream,
  onCancelStream,
  onSendStreamMessage,
  onEnqueueStreamMessage,
  onRemovePendingStreamMessage,
  onSendAllPendingStreamMessages,
  onEndStream,
  onClearStreamLog,
  onRetryUnaryWithExpress,
  onRetryStreamWithExpress,
  onUnmaskAuthSecretField,
  onClearAuthSecretField,
  authTabFocusRequest,
}: GrpcCallPanelProps) {
  const { isDismissed, dismiss } = useGrpcStudioHints();
  const [composerTab, setComposerTab] = useState<GrpcComposerTab>(() =>
    tab.requestMode === 'json' ? 'json' : 'form',
  );
  const [jsonDraft, setJsonDraft] = useState(() => serializeGrpcBodyJson(tab.body));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [formValid, setFormValid] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [metadataEditorValid, setMetadataEditorValid] = useState(true);
  const [metadataSwitchError, setMetadataSwitchError] = useState<string | null>(null);
  const [pendingSendInFlight, setPendingSendInFlight] = useState(false);

  const hasMethod = !!method && !!serviceFullName;
  const methodIdentity = hasMethod ? `${serviceFullName}/${method!.name}` : '';
  const layoutCallType = resolveGrpcStudioLayoutCallType(tab, method);
  const isStreamingLayout = isStreamingLayoutCallType(layoutCallType);
  const unaryReady = method ? isUnaryReadyMethod(method) : false;
  const streamReady = method ? isStreamReadyMethod(method) : false;
  const streamActive = isGrpcStreamLifecycleInFlight(tab.streamLifecycle);
  const streamCounts = useMemo(
    () => countGrpcStreamDirections(tab.streamMessages),
    [tab.streamMessages],
  );

  const persistedMetadataValidation = useMemo(
    () => validateGrpcMetadataEntries(metadataEntriesFromRecord(tab.metadata)),
    [tab.metadata],
  );
  const authPreview = useMemo(
    () => previewGrpcAuthMerge(tab.metadata, tab.auth),
    [tab.auth, tab.metadata],
  );
  const authReady = authPreview.ok;
  const metadataReady = composerTab === 'metadata'
    ? metadataEditorValid
    : persistedMetadataValidation.valid;

  const offTabJsonValidation = useMemo(() => {
    if (!method || tab.requestMode !== 'json' || composerTab === 'json') {
      return { ok: true as const, error: null as string | null };
    }
    const parsed = applyJsonTextToSchema(serializeGrpcBodyJson(tab.body), method.requestSchema, {
      enforceWideIntegralStringLiterals: false,
      messageTypes,
    });
    return parsed.ok
      ? { ok: true as const, error: null }
      : { ok: false as const, error: parsed.error };
  }, [composerTab, messageTypes, method, tab.body, tab.requestMode]);

  const prevMethodIdentityRef = useRef('');
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    if (!methodIdentity) {
      prevMethodIdentityRef.current = '';
      return;
    }

    if (prevMethodIdentityRef.current === methodIdentity) {
      return;
    }

    const methodChanged = prevMethodIdentityRef.current !== '';
    prevMethodIdentityRef.current = methodIdentity;
    const activeTab = tabRef.current;

    setJsonDraft(serializeGrpcBodyJson(activeTab.body));
    setJsonError(null);
    setFormError(null);
    setFormValid(true);
    setMetadataEditorValid(true);
    setMetadataSwitchError(null);
    setComposerTab(
      methodChanged ? 'form' : (activeTab.requestMode === 'json' ? 'json' : 'form'),
    );
  }, [methodIdentity]);

  useEffect(() => {
    if (composerTab === 'json' && tab.requestMode === 'form') {
      setJsonDraft(serializeGrpcBodyJson(tab.body));
      setJsonError(null);
    }
  }, [tab.body, tab.requestMode, composerTab]);

  useEffect(() => {
    if (formValid) {
      setFormError(null);
    }
  }, [formValid]);

  useEffect(() => {
    if (composerTab !== 'metadata') {
      setMetadataEditorValid(persistedMetadataValidation.valid);
      setMetadataSwitchError(null);
    }
  }, [composerTab, persistedMetadataValidation.valid]);

  const switchComposerTab = useCallback((nextTab: GrpcComposerTab) => {
    if (nextTab === composerTab) return;

    // Auth is orthogonal to request body/metadata — always reachable (connection bar + tab).
    if (nextTab === 'auth') {
      setComposerTab('auth');
      return;
    }

    if (composerTab === 'form' && nextTab !== 'form' && !formValid) {
      setFormError('Fix nested message JSON errors before switching tabs');
      return;
    }

    if (composerTab === 'metadata' && nextTab !== 'metadata' && !metadataEditorValid) {
      setMetadataSwitchError('Fix metadata validation errors before switching tabs');
      return;
    }

    if (composerTab === 'json' && nextTab !== 'json' && method) {
      const parsed = applyJsonTextToSchema(jsonDraft, method.requestSchema, { messageTypes });
      if (!parsed.ok) {
        setJsonError(parsed.error);
        return;
      }
      onPatch({ body: parsed.body, requestMode: nextTab === 'form' ? 'form' : tab.requestMode });
      setJsonError(null);
    } else if (nextTab === 'json') {
      setJsonDraft(serializeGrpcBodyJson(tab.body));
      setJsonError(null);
      setFormError(null);
      onPatch({ requestMode: 'json' });
    } else if (nextTab === 'form') {
      setFormError(null);
      setMetadataSwitchError(null);
      onPatch({ requestMode: 'form' });
    } else if (nextTab === 'metadata') {
      setMetadataSwitchError(null);
    }

    setComposerTab(nextTab);
  }, [composerTab, formValid, jsonDraft, messageTypes, metadataEditorValid, method, onPatch, tab.body, tab.requestMode]);

  useEffect(() => {
    if (authTabFocusRequest && authTabFocusRequest > 0) {
      switchComposerTab('auth');
    }
  }, [authTabFocusRequest, switchComposerTab]);

  const handleJsonChange = (text: string) => {
    setJsonDraft(text);
    if (!method) return;

    const parsed = applyJsonTextToSchema(text, method.requestSchema, { messageTypes });
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }
    setJsonError(null);
    onPatch({ body: parsed.body, requestMode: 'json' });
  };

  const handleTimeoutChange = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    onPatch({ timeoutMs: Math.round(parsed) });
  };

  const resolveBodyOverrides = useCallback((): GrpcExecuteOverrides | undefined => {
    if (!method) return undefined;
    const needsJsonResolve = composerTab === 'json' || tab.requestMode === 'json';
    if (!needsJsonResolve) return undefined;

    const draft = composerTab === 'json' ? jsonDraft : serializeGrpcBodyJson(tab.body);
    const parsed = applyJsonTextToSchema(draft, method.requestSchema, {
      enforceWideIntegralStringLiterals: composerTab === 'json',
      messageTypes,
    });
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return undefined;
    }
    setJsonError(null);
    onPatch({ body: parsed.body, requestMode: 'json' });
    return { body: parsed.body };
  }, [composerTab, jsonDraft, messageTypes, method, onPatch, tab.body, tab.requestMode]);

  const handlePrimaryAction = useCallback(() => {
    const overrides = resolveBodyOverrides();
    if (overrides === undefined && method && (composerTab === 'json' || tab.requestMode === 'json')) {
      return;
    }

    if (unaryReady) {
      onSendUnary?.(overrides);
      return;
    }

    if (streamReady) {
      if (streamActive) {
        onCancelStream?.();
      } else {
        onStartStream?.(overrides);
      }
    }
  }, [
    composerTab,
    method,
    onCancelStream,
    onSendUnary,
    onStartStream,
    resolveBodyOverrides,
    streamActive,
    streamReady,
    tab.requestMode,
    unaryReady,
  ]);

  const handleSendStreamMessage = useCallback(() => {
    const overrides = resolveBodyOverrides();
    if (overrides === undefined && method && (composerTab === 'json' || tab.requestMode === 'json')) {
      return;
    }
    onSendStreamMessage?.(overrides);
  }, [composerTab, method, onSendStreamMessage, resolveBodyOverrides, tab.requestMode]);

  const handleEnqueueStreamMessage = useCallback(() => {
    const overrides = resolveBodyOverrides();
    if (overrides === undefined && method && (composerTab === 'json' || tab.requestMode === 'json')) {
      return;
    }
    onEnqueueStreamMessage?.(overrides);
  }, [composerTab, method, onEnqueueStreamMessage, resolveBodyOverrides, tab.requestMode]);

  const handleSendAllPendingStreamMessages = useCallback(async () => {
    if (pendingSendInFlight || !onSendAllPendingStreamMessages) return;
    setPendingSendInFlight(true);
    try {
      await onSendAllPendingStreamMessages();
    } finally {
      setPendingSendInFlight(false);
    }
  }, [onSendAllPendingStreamMessages, pendingSendInFlight]);

  const handleExportStreamLog = useCallback(() => {
    const payload = buildGrpcStreamLogExportPayload({
      messages: tab.streamMessages,
      service: serviceFullName,
      method: method?.name,
      callType: layoutCallType,
      streamLifecycle: tab.streamLifecycle,
      startedAt: tab.streamStartedAt,
      endedAt: tab.streamEndedAt,
    });
    downloadGrpcStreamLogExport(
      payload,
      buildGrpcStreamLogExportFilename({ service: serviceFullName, method: method?.name }),
    );
  }, [
    layoutCallType,
    method?.name,
    serviceFullName,
    tab.streamEndedAt,
    tab.streamLifecycle,
    tab.streamMessages,
    tab.streamStartedAt,
  ]);

  const isUnaryInFlight = isGrpcLifecycleInFlight(tab.lifecycle);
  const composerFormReady = composerTab !== 'form' || formValid;
  const composerJsonReady = tab.requestMode === 'json'
    ? (composerTab === 'json' ? !jsonError : offTabJsonValidation.ok)
    : composerTab !== 'json' || !jsonError;
  const validationReady = composerFormReady && composerJsonReady && metadataReady && authReady && tlsValid;

  const sendBlockHint = useMemo(() => {
    if (!hasMethod) return null;
    if (!tlsValid) {
      return 'Fix TLS configuration in the connection panel before sending.';
    }
    if (!authReady) {
      return authPreview.issues[0]?.message
        ?? authPreview.errorMessage
        ?? 'Complete auth configuration before sending.';
    }
    if (!metadataReady) {
      return persistedMetadataValidation.message
        ?? 'Fix metadata validation errors before sending.';
    }
    if (!composerFormReady) {
      return formError ?? 'Fix form input errors before sending.';
    }
    if (!composerJsonReady) {
      return jsonError
        ?? offTabJsonValidation.error
        ?? 'Fix JSON request body errors before sending.';
    }
    return null;
  }, [
    authPreview.errorMessage,
    authPreview.issues,
    authReady,
    composerFormReady,
    composerJsonReady,
    formError,
    hasMethod,
    jsonError,
    metadataReady,
    offTabJsonValidation.error,
    persistedMetadataValidation.message,
    tlsValid,
  ]);

  const canSendUnary = hasMethod
    && unaryReady
    && targetValid
    && !disabled
    && !executeBlocked
    && !descriptorLoading
    && !isUnaryInFlight
    && !streamActive
    && validationReady;

  const canStartStream = hasMethod
    && streamReady
    && targetValid
    && !disabled
    && !executeBlocked
    && !descriptorLoading
    && !streamActive
    && !isUnaryInFlight
    && validationReady;

  const canCancelStream = streamActive && !executeBlocked;

  const primaryLabel = unaryReady
    ? (isUnaryInFlight ? 'Sending…' : '▶ Send Unary')
    : streamActive
      ? 'Cancel stream'
      : '▶ Start stream';

  const primaryDisabled = unaryReady ? !canSendUnary : streamActive ? !canCancelStream : !canStartStream;

  const showHealthHint = shouldShowSpringHealthHint(serviceFullName, method?.name)
    && !isDismissed('spring_health_actuator');

  const showStreamPermissionHint = shouldShowPermissionDeniedHint({ streamError: tab.streamError })
    && !isDismissed('spring_permission_denied');
  const streamTlsHint = formatGrpcTlsFailureHint(tab.streamError);
  const streamBrowserTransportHint = formatGrpcBrowserTransportFailureHint(tab.streamError);

  const renderStreamHints = () => {
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
  };

  const renderResponsePane = () => {
    if (isStreamingLayout) {
      const isClientStreaming = layoutCallType === 'client_streaming';
      const streamMethod = method?.callType ?? layoutCallType;
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
              {renderStreamHints()}
              {!hasMethod && (
                <p className="grpc-stream-layout-preview-hint" data-testid="grpc-stream-layout-preview-hint">
                  Layout preview — select a matching method in the explorer to start a stream.
                </p>
              )}
              <GrpcStreamComposePanel
                callType={streamMethod as 'client_streaming' | 'bidi_streaming' | 'server_streaming'}
                pendingCount={tab.streamPendingBodies.length}
                streamActive={tab.streamLifecycle === 'streaming'}
                clientWritesEnded={tab.streamLifecycle === 'ending'}
                disabled={disabled || !hasMethod}
                canCompose={validationReady}
                sendAllInFlight={pendingSendInFlight}
                onAddToQueue={isClientStreaming ? handleEnqueueStreamMessage : undefined}
                onSendMessage={handleSendStreamMessage}
                onEndStream={() => onEndStream?.()}
              />
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
        targetAddress={targetAddress}
        auth={tab.auth}
        disabled={disabled}
        onRetryWithExpress={onRetryUnaryWithExpress}
      />
    );
  };

  return (
    <section className="grpc-call-panel" data-testid="grpc-call-panel">
      <GrpcCallTypeSelectorRow
        activeCallType={layoutCallType}
        lockedCallType={method?.callType}
        disabled={disabled || streamActive}
        onSelectCallType={(callType) => onPatch({ layoutPreviewCallType: callType })}
      />
      <div className="grpc-call-send-bar" data-testid="grpc-call-send-bar">
        <div className="grpc-call-method-info">
          {hasMethod ? (
            <>
              <div className="grpc-call-method-name" data-testid="grpc-call-method-name">
                {serviceExplorerShortName(serviceFullName!)} / <strong>{method!.name}</strong>
              </div>
              <div className="grpc-call-method-type">
                {formatGrpcCallTypeLabel(method!.callType)} RPC
                <span className="grpc-call-method-type-sep"> · </span>
                <span className="grpc-call-method-types">
                  {method!.requestTypeName} → {method!.responseTypeName}
                </span>
              </div>
            </>
          ) : (
            <div className="grpc-call-method-empty">Select a method to compose a request.</div>
          )}
        </div>
        {descriptorSource && (
          <span className="grpc-call-source" data-testid="grpc-call-source">
            {formatDescriptorSourceLabel(descriptorSource)}
          </span>
        )}
        <label className="grpc-call-timeout">
          <span>Timeout</span>
          <input
            type="number"
            min={1}
            step={1000}
            className="grpc-call-timeout-input"
            data-testid="grpc-call-timeout-input"
            value={tab.timeoutMs}
            disabled={disabled || !hasMethod}
            onChange={(event) => handleTimeoutChange(event.target.value)}
          />
          <span className="grpc-call-timeout-unit">ms</span>
        </label>
        {unaryReady && (
          <button
            type="button"
            className="grpc-call-send-btn"
            data-testid="grpc-send-btn"
            disabled={primaryDisabled}
            aria-label="Send unary call"
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </button>
        )}
        {streamReady && (
          <button
            type="button"
            className="grpc-call-send-btn"
            data-testid={streamActive ? 'grpc-stream-cancel-btn' : 'grpc-stream-start-btn'}
            disabled={primaryDisabled}
            aria-label={streamActive ? 'Cancel stream' : 'Start stream'}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </button>
        )}
        {isUnaryInFlight && (
          <button
            type="button"
            className="grpc-call-cancel-btn"
            data-testid="grpc-cancel-btn"
            aria-label="Cancel unary call"
            onClick={() => onCancelUnary?.()}
          >
            Cancel
          </button>
        )}
      </div>
      {sendBlockHint && (
        <p className="grpc-call-send-block-hint" data-testid="grpc-call-send-block-hint" role="alert">
          {sendBlockHint}
        </p>
      )}

      <div className={`grpc-call-split${isStreamingLayout ? ' grpc-call-split--streaming' : ''}${layoutCallType === 'client_streaming' ? ' grpc-call-split--client-streaming' : ''}`}>
        <div className="grpc-call-request-pane">
          <div className="grpc-call-panel-tabs" role="group" aria-label="Request composer">
            <button
              type="button"
              aria-pressed={composerTab === 'form'}
              className={`grpc-call-panel-tab${composerTab === 'form' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-form"
              disabled={!hasMethod}
              onClick={() => switchComposerTab('form')}
            >
              Form Input
            </button>
            <button
              type="button"
              aria-pressed={composerTab === 'json'}
              className={`grpc-call-panel-tab${composerTab === 'json' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-json"
              disabled={!hasMethod}
              onClick={() => switchComposerTab('json')}
            >
              JSON
            </button>
            <button
              type="button"
              aria-pressed={composerTab === 'metadata'}
              className={`grpc-call-panel-tab${composerTab === 'metadata' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-metadata"
              disabled={!hasMethod}
              onClick={() => switchComposerTab('metadata')}
            >
              Metadata
            </button>
            <button
              type="button"
              aria-pressed={composerTab === 'auth'}
              className={`grpc-call-panel-tab${composerTab === 'auth' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-auth"
              disabled={disabled}
              onClick={() => switchComposerTab('auth')}
            >
              Auth
            </button>
          </div>

          <div className="grpc-call-panel-body">
            {showHealthHint && (
              <GrpcSpringHintCard
                hintId="spring_health_actuator"
                onDismiss={() => dismiss('spring_health_actuator')}
              />
            )}

            {!hasMethod && composerTab !== 'auth' && (
              <p className="grpc-call-panel-empty" data-testid="grpc-call-panel-empty">
                Reflect services and select a method to edit the request body.
              </p>
            )}

            {composerTab === 'auth' && (
              <GrpcAuthPanel
                auth={tab.auth}
                preview={authPreview}
                maskedSecretFields={tab.maskedSecretFields?.auth}
                disabled={disabled}
                onChange={(auth) => onPatch({
                  auth,
                  maskedSecretFields: pruneAuthMaskForConfig(auth, tab.maskedSecretFields),
                })}
                onUnmaskSecretField={onUnmaskAuthSecretField}
                onClearSecretField={onClearAuthSecretField}
              />
            )}

            {hasMethod && composerTab === 'form' && (
              <div className="grpc-call-composer-scroll" data-testid="grpc-request-form-scroll">
                {formError && (
                  <p className="grpc-call-form-error" data-testid="grpc-request-form-error" role="alert">
                    {formError}
                  </p>
                )}
                <GrpcProtoFormBuilder
                  key={methodIdentity}
                  schema={method!.requestSchema}
                  messageTypes={messageTypes}
                  body={tab.body}
                  disabled={disabled}
                  onValidityChange={setFormValid}
                  onChange={(body) => onPatch({ body, requestMode: 'form' })}
                />
              </div>
            )}

            {hasMethod && composerTab === 'json' && (
              <div className="grpc-call-json-editor">
                <div className="grpc-call-json-editor-header">
                  <span className="grpc-call-json-editor-hint">
                    Live JSON — edits sync back to form. Use quoted strings for int64/uint64 fields.
                  </span>
                  <GrpcJsonCodeToolbar
                    copyText={jsonDraft}
                    onPrettyFormat={() => {
                      if (!method) return;
                      try {
                        handleJsonChange(JSON.stringify(JSON.parse(jsonDraft), null, 2));
                      } catch {
                        // Keep draft when invalid JSON.
                      }
                    }}
                    prettyDisabled={!!jsonError}
                    testIdPrefix="grpc-request-json"
                  />
                </div>
                <GrpcHighlightedJsonTextarea
                  value={jsonDraft}
                  disabled={disabled}
                  testId="grpc-request-json"
                  onChange={handleJsonChange}
                />
                {jsonError && (
                  <p className="grpc-call-json-error" data-testid="grpc-request-json-error" role="alert">
                    {jsonError}
                  </p>
                )}
              </div>
            )}

            {hasMethod && composerTab === 'metadata' && (
              <>
                {metadataSwitchError && (
                  <p className="grpc-call-form-error" data-testid="grpc-request-metadata-error" role="alert">
                    {metadataSwitchError}
                  </p>
                )}
                <GrpcMetadataEditor
                  metadata={tab.metadata}
                  disabled={disabled}
                  onValidationChange={setMetadataEditorValid}
                  onChange={(metadata) => onPatch({ metadata })}
                />
              </>
            )}
          </div>
        </div>

        {renderResponsePane()}
      </div>
    </section>
  );
}
