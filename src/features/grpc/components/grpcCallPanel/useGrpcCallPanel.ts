import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { GRPC_PROTO_HYBRID_EDITOR_ENABLED } from '../../../../config/features';
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
import { buildHybridNavigatorPaths } from '../grpcProtoHybridNavigatorPaths';
import {
  buildGrpcStreamLogExportFilename,
  buildGrpcStreamLogExportPayload,
  downloadGrpcStreamLogExport,
} from '../../utils/grpcStreamLogExport';
import { isGrpcLifecycleInFlight } from '../../grpcStudioTypes';
import {
  createGrpcProtoHybridInitialState,
  isGrpcProtoHybridEnabledForMethod,
  reduceGrpcProtoHybridState,
  type GrpcProtoHybridEvent,
} from '../../utils/grpcProtoHybridState';
import { emitGrpcHybridTelemetry } from '../../utils/grpcHybridTelemetry';
import { hasGrpcProtoHybridApplyBlockingState } from '../../utils/grpcProtoHybridValidation';
import { hashTabId, schemaComplexityBucket, stringifyUnknown } from './grpcCallPanelHelpers';
import type { GrpcCallPanelProps, GrpcMobileStage } from './grpcCallPanelTypes';

export type UploadedFileEntry = { id: string; name: string; size: number; file: File };

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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileEntry[]>([]);
  const [hybridState, setHybridState] = useState(() => createGrpcProtoHybridInitialState(tab.id, tab.body));
  const [hybridCloseConfirmVisible, setHybridCloseConfirmVisible] = useState(false);

  const hasMethod = !!method && !!serviceFullName;
  const hybridComposerTabsEnabled = GRPC_PROTO_HYBRID_EDITOR_ENABLED;
  const hybridEditorEnabled = hybridComposerTabsEnabled && isGrpcProtoHybridEnabledForMethod(method);
  const hybridTelemetryPayload = useMemo(() => {
    const methodIdentifier = hasMethod ? `${serviceFullName}/${method!.name}` : 'unknown';
    const fieldCount = method?.requestSchema?.fields?.length ?? 0;
    return {
      tabIdHash: hashTabId(tab.id),
      methodIdentifier,
      schemaComplexity: schemaComplexityBucket(fieldCount),
    };
  }, [hasMethod, method, serviceFullName, tab.id]);
  const methodIdentity = hasMethod ? `${serviceFullName}/${method!.name}` : '';
  const hybridNavigatorPaths = useMemo(
    () => (method ? buildHybridNavigatorPaths(method.requestSchema) : []),
    [method],
  );
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
  const lastHybridWarningCountRef = useRef<number | null>(null);
  const lastSendBlockHintRef = useRef<string | null>(null);
  const lastHybridPatchedBodyRef = useRef<string | null>(null);

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
    setHybridState(createGrpcProtoHybridInitialState(tab.id, tab.body));
  }, [hybridComposerTabsEnabled, tab, tab.id, tab.body, tab.requestMode]);

  useEffect(() => {
    if (!hybridEditorEnabled) {
      setHybridState((previous) => {
        const tabChanged = previous.tabId !== tab.id;
        const requestChanged = stringifyUnknown(previous.requestDraft) !== stringifyUnknown(tab.body);
        if (!tabChanged && !requestChanged && !previous.modal.isOpen) {
          return previous;
        }
        return createGrpcProtoHybridInitialState(tab.id, tab.body);
      });
      setHybridCloseConfirmVisible((visible) => (visible ? false : visible));
      return;
    }
    setHybridState((previous) => {
      const tabChanged = previous.tabId !== tab.id;
      if (!tabChanged) {
        return previous;
      }
      return createGrpcProtoHybridInitialState(tab.id, tab.body);
    });
  }, [hybridEditorEnabled, tab.body, tab.id]);

  useEffect(() => {
    if (!hybridState.modal.isOpen) {
      setHybridCloseConfirmVisible(false);
    }
  }, [hybridState.modal.isOpen]);

  useEffect(() => {
    if (!hybridEditorEnabled) return;
    const draftSig = stringifyUnknown(hybridState.requestDraft);
    const tabSig = stringifyUnknown(tab.body);
    if (draftSig === tabSig) {
      lastHybridPatchedBodyRef.current = null;
      return;
    }
    if (lastHybridPatchedBodyRef.current === draftSig) {
      return;
    }
    lastHybridPatchedBodyRef.current = draftSig;
    onPatch({
      body: hybridState.requestDraft as Record<string, unknown>,
      requestMode: 'json',
    });
  }, [hybridEditorEnabled, hybridState.requestDraft, onPatch, tab.body]);

  const applyHybridEvent = useCallback((event: GrpcProtoHybridEvent) => {
    setHybridState((previous) => reduceGrpcProtoHybridState(previous, event));
  }, []);

  useEffect(() => {
    if (!hybridEditorEnabled || !method) return;
    if (hybridNavigatorPaths.length === 0) return;
    const selectedPath = hybridState.navigator.selectedPath;
    if (selectedPath && hybridNavigatorPaths.includes(selectedPath)) return;
    applyHybridEvent({ type: 'NAVIGATOR_SELECT_PATH', path: hybridNavigatorPaths[0]! });
  }, [
    applyHybridEvent,
    hybridEditorEnabled,
    hybridNavigatorPaths,
    hybridState.navigator.selectedPath,
    method,
  ]);

  const applyHybridEventWithHooks = useCallback((event: GrpcProtoHybridEvent) => {
    if (event.type === 'FULL_FORM_OPEN' && !hybridState.modal.isOpen) {
      emitGrpcHybridTelemetry('grpc_editor_modal_opened', hybridTelemetryPayload);
    }
    if (
      event.type === 'FULL_FORM_APPLY'
      && hybridState.modal.isOpen
      && hybridState.modal.workingDraft !== null
      && !hasGrpcProtoHybridApplyBlockingState(hybridState.validation.summary, hybridState.modal.jsonError)
    ) {
      setJsonDraft(serializeGrpcBodyJson((hybridState.modal.workingDraft ?? {}) as Record<string, unknown>));
      setJsonError(null);
      emitGrpcHybridTelemetry('grpc_editor_modal_applied', hybridTelemetryPayload);
    }
    if (event.type === 'FULL_FORM_DISCARD' && hybridState.modal.isOpen) {
      emitGrpcHybridTelemetry('grpc_editor_modal_discarded', hybridTelemetryPayload);
    }
    if (event.type === 'NAVIGATOR_SELECT_PATH' && event.path !== hybridState.navigator.selectedPath) {
      emitGrpcHybridTelemetry('grpc_editor_selected_path_changed', hybridTelemetryPayload);
    }

    let restorePath: string | null = null;
    if (event.type === 'FULL_FORM_APPLY' || event.type === 'FULL_FORM_DISCARD' || event.type === 'FULL_FORM_CLOSE') {
      restorePath = hybridState.modal.openContext?.selectedPath ?? null;
    }

    applyHybridEvent(event);

    if (restorePath) {
      applyHybridEvent({ type: 'NAVIGATOR_SELECT_PATH', path: restorePath });
    }
  }, [
    applyHybridEvent,
    hybridState.modal.isOpen,
    hybridState.modal.jsonError,
    hybridState.modal.openContext?.selectedPath,
    hybridState.modal.workingDraft,
    hybridState.navigator.selectedPath,
    hybridState.validation.summary,
    hybridTelemetryPayload,
  ]);

  const requestHybridClose = useCallback(() => {
    if (!hybridState.modal.isOpen) return;
    if (hybridState.modal.dirty) {
      setHybridCloseConfirmVisible(true);
      emitGrpcHybridTelemetry('grpc_editor_modal_close_prompted', hybridTelemetryPayload);
      return;
    }
    applyHybridEventWithHooks({ type: 'FULL_FORM_CLOSE' });
  }, [applyHybridEventWithHooks, hybridState.modal.dirty, hybridState.modal.isOpen, hybridTelemetryPayload]);

  const handleHybridCloseKeepEditing = useCallback(() => {
    setHybridCloseConfirmVisible(false);
    emitGrpcHybridTelemetry('grpc_editor_modal_close_cancelled', hybridTelemetryPayload);
  }, [hybridTelemetryPayload]);

  const handleHybridCloseDiscard = useCallback(() => {
    setHybridCloseConfirmVisible(false);
    applyHybridEventWithHooks({ type: 'FULL_FORM_DISCARD' });
  }, [applyHybridEventWithHooks]);

  const handleHybridNavigatorSelectPath = useCallback((path: string) => {
    applyHybridEventWithHooks({ type: 'NAVIGATOR_SELECT_PATH', path });
  }, [applyHybridEventWithHooks]);

  const handleOpenHybridWorkspace = useCallback(() => {
    if (method) {
      const parsed = applyJsonTextToSchema(jsonDraft, method.requestSchema, { messageTypes });
      if (parsed.ok) {
        applyHybridEvent({ type: 'FOCUS_EDIT_PATCH', nextDraft: parsed.body });
        onPatch({ body: parsed.body, requestMode: 'json' });
        setJsonError(null);
      } else {
        setJsonError(parsed.error);
      }
    }

    applyHybridEventWithHooks({
      type: 'FULL_FORM_OPEN',
      openContext: {
        selectedPath: hybridState.navigator.selectedPath,
        navigatorScrollTop: 0,
        focusPaneScrollTop: 0,
      },
    });
  }, [
    applyHybridEvent,
    applyHybridEventWithHooks,
    hybridState.navigator.selectedPath,
    jsonDraft,
    messageTypes,
    method,
    onPatch,
  ]);

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

  const handleFilesPicked = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setUploadedFiles((prior) => ([
      ...prior,
      ...files.map((file, index) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        file,
      })),
    ]));
  };

  const handleRemoveUploadedFile = (fileId: string) => {
    setUploadedFiles((prior) => prior.filter((file) => file.id !== fileId));
  };

  const handleClearUploadedFiles = () => {
    setUploadedFiles([]);
  };

  const applyFileDataToBody = useCallback(async (): Promise<Record<string, unknown> | null> => {
    if (uploadedFiles.length === 0) return null;
    const bodyWithFiles = { ...tab.body };
    const bytesFields = uploadedFiles.filter((f) => f.file.type.includes('octet-stream') || /\.(bin|pb|proto)$/.test(f.name));
    if (bytesFields.length === 0) return null;
    for (let i = 0; i < bytesFields.length && i < 1; i++) {
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) ?? '');
        reader.readAsDataURL(bytesFields[i]!.file);
      });
      const base64 = fileData.split(',')[1] ?? '';
      const firstBytesFieldKey = Object.keys(bodyWithFiles).find((key) => typeof bodyWithFiles[key] === 'string' && bodyWithFiles[key] === '');
      if (firstBytesFieldKey) {
        bodyWithFiles[firstBytesFieldKey] = base64;
      }
    }
    return bodyWithFiles;
  }, [tab.body, uploadedFiles]);

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
    if (!hasMethod) return null;
    if (!targetValid) {
      return 'Set a valid target endpoint before sending.';
    }
    if (!tlsValid) {
      return 'Fix TLS configuration in the connection panel before sending.';
    }
    if (allowSendWithoutOAuth2 && hasTypedOAuth2Input) {
      return 'OAuth2 is incomplete. Send will run without OAuth2 until token URL, client ID, and client secret are set.';
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

  useEffect(() => {
    if (!hybridEditorEnabled || !hasMethod) {
      lastHybridWarningCountRef.current = null;
      return;
    }
    const warningCount = hybridState.validation.summary.warnings;
    if (lastHybridWarningCountRef.current === warningCount) return;
    lastHybridWarningCountRef.current = warningCount;
    emitGrpcHybridTelemetry('grpc_editor_validation_warning_count', hybridTelemetryPayload, {
      warningCount,
    });
  }, [
    hasMethod,
    hybridEditorEnabled,
    hybridState.validation.summary.warnings,
    hybridTelemetryPayload,
  ]);

  useEffect(() => {
    if (!hybridEditorEnabled || !hasMethod) {
      lastSendBlockHintRef.current = null;
      return;
    }
    if (!sendBlockHint) {
      lastSendBlockHintRef.current = null;
      return;
    }
    if (lastSendBlockHintRef.current === sendBlockHint) return;
    lastSendBlockHintRef.current = sendBlockHint;
    emitGrpcHybridTelemetry('grpc_editor_send_blocked_error', hybridTelemetryPayload, {
      reason: sendBlockHint,
    });
  }, [hasMethod, hybridEditorEnabled, hybridTelemetryPayload, sendBlockHint]);

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
