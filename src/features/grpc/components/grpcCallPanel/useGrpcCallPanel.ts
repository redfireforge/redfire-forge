import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isGrpcStreamLifecycleInFlight } from '../../../../shared/grpc/streamLifecycle';
import {
  applyJsonTextToSchema,
  serializeGrpcBodyJson,
} from '../../utils/grpcBodyComposer';
import {
  isStreamReadyMethod,
  isStreamingLayoutCallType,
  isUnaryReadyMethod,
  resolveGrpcStudioLayoutCallType,
} from '../../utils/grpcExplorerUtils';
import { countGrpcStreamDirections } from '../../utils/grpcStreamLogUtils';
import {
  persistComposerTab,
  resolveInitialComposerTab,
  type GrpcComposerTab,
} from '../../utils/grpcComposerTabState';
import { validateGrpcMetadataEntries, metadataEntriesFromRecord } from '../../utils/grpcMetadataEditor';
import { buildGrpcAuthPreviewWithProfiles } from '../../utils/grpcAuthProfileResolve';
import { useGrpcStudioHints } from '../../hooks/useGrpcStudioHints';
import { shouldShowPermissionDeniedHint, shouldShowSpringHealthHint } from '../../utils/grpcSpringHints';
import { formatGrpcBrowserTransportFailureHint, formatGrpcTlsFailureHint } from '../../utils/grpcResponseUtils';
import {
  buildGrpcStreamLogExportFilename,
  buildGrpcStreamLogExportPayload,
  downloadGrpcStreamLogExport,
} from '../../utils/grpcStreamLogExport';
import { isGrpcLifecycleInFlight } from '../../grpcStudioTypes';
import { resolveGrpcSendBlockHint } from './grpcCallPanelSendState';
import { useGrpcUploadedFiles } from './useGrpcUploadedFiles';
import {
  resolveGrpcProtoHybridEditorEnabled,
  useGrpcProtoHybridEditor,
} from './useGrpcProtoHybridEditor';
import type { GrpcCallPanelProps, GrpcMobileStage } from './grpcCallPanelTypes';

export function useGrpcCallPanel({
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
  globalAuthProfiles = [],
  defaultAuthProfileId = null,
  authTabFocusRequest,
}: GrpcCallPanelProps) {
  const { isDismissed, dismiss } = useGrpcStudioHints();
  const [composerTab, setComposerTab] = useState<GrpcComposerTab>(() => {
    return resolveInitialComposerTab(tab);
  });
  const [mobileStage, setMobileStage] = useState<GrpcMobileStage>('request');
  const [jsonDraft, setJsonDraft] = useState(() => serializeGrpcBodyJson(tab.body));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [formValid, setFormValid] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [metadataEditorValid, setMetadataEditorValid] = useState(true);
  const [metadataSwitchError, setMetadataSwitchError] = useState<string | null>(null);
  const [pendingSendInFlight, setPendingSendInFlight] = useState(false);
  const {
    uploadedFiles,
    handleFilesPicked,
    handleRemoveUploadedFile,
    handleClearUploadedFiles,
    applyFileDataToBody,
  } = useGrpcUploadedFiles(tab.body);

  const hasMethod = !!method && !!serviceFullName;
  const hybridEditorEnabled = resolveGrpcProtoHybridEditorEnabled(method);
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
  const authState = useMemo(
    () => buildGrpcAuthPreviewWithProfiles(tab.metadata, tab.auth, globalAuthProfiles, defaultAuthProfileId),
    [defaultAuthProfileId, globalAuthProfiles, tab.auth, tab.metadata],
  );
  const effectiveAuth = authState.resolvedAuth;
  const authPreview = authState.preview;
  const authReady = authPreview.ok;
  const allowSendWithoutOAuth2 = effectiveAuth?.type === 'oauth2' && !authReady;
  const hasTypedOAuth2Input = Boolean(
    effectiveAuth?.type === 'oauth2'
      && (
        effectiveAuth.oauth2?.tokenUrl?.trim()
        || effectiveAuth.oauth2?.clientId?.trim()
        || effectiveAuth.oauth2?.clientSecret?.trim()
        || effectiveAuth.oauth2?.scope?.trim()
      ),
  );
  const metadataReady = composerTab === 'metadata'
    ? metadataEditorValid
    : persistedMetadataValidation.valid;

  const offTabJsonValidation = useMemo(() => {
    if (!method || tab.requestMode !== 'json') {
      return { ok: true as const, error: null as string | null };
    }
    const parsed = applyJsonTextToSchema(serializeGrpcBodyJson(tab.body), method.requestSchema, {
      enforceWideIntegralStringLiterals: false,
      messageTypes,
    });
    return parsed.ok
      ? { ok: true as const, error: null }
      : { ok: false as const, error: parsed.error };
  }, [messageTypes, method, tab.body, tab.requestMode]);

  const prevMethodIdentityRef = useRef('');
  const lastPrimaryComposerTabRef = useRef<Exclude<GrpcComposerTab, 'metadata' | 'auth'>>(
    'form',
  );
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const prevTabIdRef = useRef(tab.id);
  const lastAuthTabFocusRequestRef = useRef<number | null>(null);

  useEffect(() => {
    persistComposerTab(tab.id, composerTab);
  }, [composerTab, tab.id]);

  useEffect(() => {
    if (prevTabIdRef.current === tab.id) return;
    prevTabIdRef.current = tab.id;
    setComposerTab(resolveInitialComposerTab(tab));
    setJsonDraft(serializeGrpcBodyJson(tab.body));
    setJsonError(null);
    setFormError(null);
    setMetadataSwitchError(null);
  }, [tab, tab.id, tab.body, tab.requestMode]);

  useEffect(() => {
    if (composerTab === 'metadata') {
      setMobileStage('metadata');
      return;
    }
    if (composerTab === 'auth') {
      setMobileStage('auth');
      return;
    }

    lastPrimaryComposerTabRef.current = composerTab;
    setMobileStage((current) => (current === 'response' ? current : 'request'));
  }, [composerTab]);

  useEffect(() => {
    if (!methodIdentity) {
      prevMethodIdentityRef.current = '';
      return;
    }

    if (prevMethodIdentityRef.current === methodIdentity) {
      return;
    }

    prevMethodIdentityRef.current = methodIdentity;
    const activeTab = tabRef.current;

    setJsonDraft(serializeGrpcBodyJson(activeTab.body));
    setJsonError(null);
    setFormError(null);
    setFormValid(true);
    setMetadataEditorValid(true);
    setMetadataSwitchError(null);
    setComposerTab('form');
  }, [hybridEditorEnabled, methodIdentity]);

  useEffect(() => {
    if (composerTab === 'form' && tab.requestMode === 'form') {
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

    if (nextTab === 'auth') {
      setComposerTab('auth');
      return;
    }

    if (composerTab === 'form' && nextTab !== 'form' && !formValid) {
      setFormError('Fix nested message JSON errors before switching tabs');
    }

    if (composerTab === 'metadata' && nextTab !== 'metadata' && !metadataEditorValid) {
      setMetadataSwitchError('Fix metadata validation errors before switching tabs');
    }

    if (composerTab === 'form' && nextTab !== 'form' && method) {
      const parsed = applyJsonTextToSchema(jsonDraft, method.requestSchema, { messageTypes });
      if (!parsed.ok) {
        setJsonError(parsed.error);
      } else {
        onPatch({ body: parsed.body, requestMode: 'json' });
        setJsonError(null);
      }
    } else if (nextTab === 'form') {
      setFormError(null);
      setMetadataSwitchError(null);
      onPatch({ requestMode: 'json' });
    } else if (nextTab === 'metadata') {
      setMetadataSwitchError(null);
    }

    setComposerTab(nextTab);
  }, [composerTab, formValid, jsonDraft, messageTypes, metadataEditorValid, method, onPatch]);

  const switchMobileStage = useCallback((nextStage: GrpcMobileStage) => {
    if (nextStage === 'response') {
      setMobileStage('response');
      return;
    }
    if (nextStage === 'metadata') {
      switchComposerTab('metadata');
      return;
    }
    if (nextStage === 'auth') {
      switchComposerTab('auth');
      return;
    }

    if (composerTab === 'metadata' || composerTab === 'auth') {
      switchComposerTab(lastPrimaryComposerTabRef.current);
      return;
    }

    setMobileStage('request');
  }, [composerTab, switchComposerTab]);

  useEffect(() => {
    const currentRequest = authTabFocusRequest ?? 0;
    const previousRequest = lastAuthTabFocusRequestRef.current;
    const shouldFocusAuth = previousRequest === null
      ? currentRequest > 0
      : currentRequest > previousRequest;
    if (shouldFocusAuth) {
      switchComposerTab('auth');
    }
    lastAuthTabFocusRequestRef.current = currentRequest;
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

  const resolveBodyOverrides = useCallback((): import('../../grpcStudioTypes').GrpcExecuteOverrides | undefined => {
    if (!method) return undefined;
    const isJsonSurface = composerTab === 'form';
    const needsJsonResolve = tab.requestMode === 'json' || isJsonSurface;
    if (!needsJsonResolve) return undefined;

    const draft = isJsonSurface ? jsonDraft : serializeGrpcBodyJson(tab.body);
    const parsed = applyJsonTextToSchema(draft, method.requestSchema, {
      enforceWideIntegralStringLiterals: isJsonSurface,
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

  const handlePrimaryAction = useCallback(async () => {
    const isJsonSurface = composerTab === 'form';
    let overrides = resolveBodyOverrides();
    if (overrides === undefined && method && (tab.requestMode === 'json' || isJsonSurface)) {
      return;
    }

    const bodyWithFiles = await applyFileDataToBody();
    if (bodyWithFiles) {
      overrides = { ...overrides, body: bodyWithFiles };
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
    applyFileDataToBody,
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
    const isJsonSurface = composerTab === 'form';
    const overrides = resolveBodyOverrides();
    if (overrides === undefined && method && (tab.requestMode === 'json' || isJsonSurface)) {
      return;
    }
    onSendStreamMessage?.(overrides);
  }, [composerTab, method, onSendStreamMessage, resolveBodyOverrides, tab.requestMode]);

  const handleEnqueueStreamMessage = useCallback(() => {
    const isJsonSurface = composerTab === 'form';
    const overrides = resolveBodyOverrides();
    if (overrides === undefined && method && (tab.requestMode === 'json' || isJsonSurface)) {
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
  const jsonSurfaceActive = composerTab === 'form';
  const composerFormReady = composerTab !== 'form' || hybridEditorEnabled || formValid;
  const composerJsonReady = tab.requestMode === 'json'
    ? (jsonSurfaceActive ? !jsonError : offTabJsonValidation.ok)
    : !jsonSurfaceActive || !jsonError;
  const validationReady = composerFormReady
    && composerJsonReady
    && metadataReady
    && (authReady || allowSendWithoutOAuth2)
    && tlsValid;

  const sendBlockHint = useMemo(() => {
    return resolveGrpcSendBlockHint({
      hasMethod,
      targetValid,
      tlsValid,
      allowSendWithoutOAuth2,
      hasTypedOAuth2Input,
      authReady,
      authIssueMessage: authPreview.issues[0]?.message,
      authErrorMessage: authPreview.errorMessage,
      metadataReady,
      metadataValidationMessage: persistedMetadataValidation.message,
      composerFormReady,
      composerJsonReady,
      formError,
      jsonError,
      offTabJsonValidationError: offTabJsonValidation.error,
    });
  }, [
    authPreview.errorMessage,
    authPreview.issues,
    authReady,
    hasTypedOAuth2Input,
    allowSendWithoutOAuth2,
    composerFormReady,
    composerJsonReady,
    formError,
    hasMethod,
    jsonError,
    metadataReady,
    offTabJsonValidation.error,
    persistedMetadataValidation.message,
    targetValid,
    tlsValid,
  ]);

  const {
    hybridState,
    hybridCloseConfirmVisible,
    requestHybridClose,
    handleHybridCloseKeepEditing,
    handleHybridCloseDiscard,
    handleHybridNavigatorSelectPath,
    handleOpenHybridWorkspace,
    applyHybridEventWithHooks,
  } = useGrpcProtoHybridEditor({
    tab,
    method,
    messageTypes,
    serviceFullName,
    hasMethod,
    hybridEditorEnabled,
    jsonDraft,
    setJsonDraft,
    setJsonError,
    onPatch,
    sendBlockHint,
  });

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

  return {
    tab,
    method,
    messageTypes,
    descriptorSource,
    serviceFullName,
    targetAddress,
    disabled,
    onPatch,
    onCancelUnary,
    onRemovePendingStreamMessage,
    onEndStream,
    onClearStreamLog,
    onRetryUnaryWithExpress,
    onRetryStreamWithExpress,
    onUnmaskAuthSecretField,
    onClearAuthSecretField,
    globalAuthProfiles,
    defaultAuthProfileId,
    dismiss,
    composerTab,
    mobileStage,
    jsonDraft,
    jsonError,
    formError,
    metadataSwitchError,
    pendingSendInFlight,
    uploadedFiles,
    hybridState,
    hybridCloseConfirmVisible,
    hasMethod,
    hybridEditorEnabled,
    methodIdentity,
    layoutCallType,
    isStreamingLayout,
    unaryReady,
    streamReady,
    streamActive,
    streamCounts,
    effectiveAuth,
    authPreview,
    validationReady,
    sendBlockHint,
    isUnaryInFlight,
    primaryLabel,
    primaryDisabled,
    showHealthHint,
    showStreamPermissionHint,
    streamTlsHint,
    streamBrowserTransportHint,
    switchComposerTab,
    switchMobileStage,
    handleJsonChange,
    handleTimeoutChange,
    handleFilesPicked,
    handleRemoveUploadedFile,
    handleClearUploadedFiles,
    handlePrimaryAction,
    handleSendStreamMessage,
    handleEnqueueStreamMessage,
    handleSendAllPendingStreamMessages,
    handleExportStreamLog,
    requestHybridClose,
    handleHybridCloseKeepEditing,
    handleHybridCloseDiscard,
    handleHybridNavigatorSelectPath,
    handleOpenHybridWorkspace,
    applyHybridEventWithHooks,
    setFormValid,
    setMetadataEditorValid,
  };
}

export type UseGrpcCallPanelReturn = ReturnType<typeof useGrpcCallPanel>;
