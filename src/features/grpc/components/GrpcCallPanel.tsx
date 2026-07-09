import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GRPC_PROTO_HYBRID_EDITOR_ENABLED } from '../../../config/features';
import type { GlobalAuthProfile } from '../../../shared/types';
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
  isStreamReadyMethod,
  isStreamingLayoutCallType,
  isUnaryReadyMethod,
  resolveGrpcStudioLayoutCallType,
} from '../utils/grpcExplorerUtils';
import { countGrpcStreamDirections } from '../utils/grpcStreamLogUtils';
import {
  persistComposerTab,
  resolveInitialComposerTab,
  type GrpcComposerTab,
} from '../utils/grpcComposerTabState';
import { validateGrpcMetadataEntries, metadataEntriesFromRecord } from '../utils/grpcMetadataEditor';
import { buildGrpcAuthPreviewWithProfiles } from '../utils/grpcAuthProfileResolve';
import type { GrpcAuthSecretFieldKey } from '../utils/grpcSecretFieldUi';
import { pruneAuthMaskForConfig } from '../utils/grpcSecretFieldUi';
import { GrpcSpringHintCard } from './GrpcSpringHintCard';
import { useGrpcStudioHints } from '../hooks/useGrpcStudioHints';
import { shouldShowPermissionDeniedHint, shouldShowSpringHealthHint } from '../utils/grpcSpringHints';
import { formatGrpcBrowserTransportFailureHint, formatGrpcTlsFailureHint } from '../utils/grpcResponseUtils';
import { GrpcAuthPanel } from './GrpcAuthPanel';
import { GrpcMetadataEditor } from './GrpcMetadataEditor';
import { GrpcProtoFormBuilder } from './GrpcProtoFormBuilder';
import { buildHybridNavigatorPaths } from './grpcProtoHybridNavigatorPaths';
import { GrpcJsonCodeToolbar } from './GrpcJsonCodeToolbar';
import { GrpcHighlightedJsonTextarea } from './GrpcHighlightedJsonTextarea';
import { GrpcProtoHybridEditorModal } from './GrpcProtoHybridEditorModal';
import { GrpcResponsePanel } from './GrpcResponsePanel';
import { GrpcStreamRequestActionBar } from './GrpcStreamRequestActionBar';
import { GrpcStreamMessageLog } from './GrpcStreamMessageLog';
import { GrpcStreamPendingQueuePanel } from './GrpcStreamPendingQueuePanel';
import { GrpcStreamStatusBar } from './GrpcStreamStatusBar';
import {
  buildGrpcStreamLogExportFilename,
  buildGrpcStreamLogExportPayload,
  downloadGrpcStreamLogExport,
} from '../utils/grpcStreamLogExport';
import { isGrpcLifecycleInFlight } from '../grpcStudioTypes';
import {
  createGrpcProtoHybridInitialState,
  isGrpcProtoHybridEnabledForMethod,
  reduceGrpcProtoHybridState,
  type GrpcProtoHybridEvent,
} from '../utils/grpcProtoHybridState';
import { emitGrpcHybridTelemetry, type GrpcHybridSchemaComplexityBucket } from '../utils/grpcHybridTelemetry';
import { hasGrpcProtoHybridApplyBlockingState } from '../utils/grpcProtoHybridValidation';

export type { GrpcComposerTab } from '../utils/grpcComposerTabState';

type GrpcMobileStage = 'request' | 'response' | 'metadata' | 'auth';

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hashTabId(tabId: string): string {
  let hash = 0;
  for (let i = 0; i < tabId.length; i += 1) {
    hash = (hash * 31 + tabId.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

function schemaComplexityBucket(fieldCount: number): GrpcHybridSchemaComplexityBucket {
  if (fieldCount <= 20) return 'small';
  if (fieldCount <= 80) return 'medium';
  return 'large';
}

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
  globalAuthProfiles?: GlobalAuthProfile[];
  defaultAuthProfileId?: string | null;
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
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; name: string; size: number; file: File }>>([]);
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
      setHybridState(createGrpcProtoHybridInitialState(tab.id, tab.body));
      setHybridCloseConfirmVisible(false);
      return;
    }
    setHybridState((previous) => {
      const tabChanged = previous.tabId !== tab.id;
      const requestChanged = stringifyUnknown(previous.requestDraft) !== stringifyUnknown(tab.body);
      if (!tabChanged && (!requestChanged || previous.modal.isOpen)) {
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
    if (stringifyUnknown(hybridState.requestDraft) === stringifyUnknown(tab.body)) return;
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
      // Keep the compact JSON composer in sync with the applied modal draft.
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

    // Auth is orthogonal to request body/metadata — always reachable (connection bar + tab).
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

  const handleFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
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

  const resolveBodyOverrides = useCallback((): GrpcExecuteOverrides | undefined => {
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
              {renderStreamHints()}
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
  };

  return (
    <section className="grpc-call-panel" data-testid="grpc-call-panel">
      <div
        className={`grpc-call-send-bar${hasMethod ? '' : ' grpc-call-send-bar--placeholder'}`}
        data-testid="grpc-call-send-bar"
      >
        {!hasMethod && (
          <div className="grpc-call-method-empty">Select a method to compose a request.</div>
        )}
        {descriptorSource && (
          <span className="grpc-call-source" data-testid="grpc-call-source">
            {formatDescriptorSourceLabel(descriptorSource)}
          </span>
        )}
        <div className="grpc-call-send-bar-controls">
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
          <div className="grpc-call-inline-actions" data-testid="grpc-call-inline-actions">
            {hybridEditorEnabled && hasMethod && (
              <button
                type="button"
                className="grpc-call-full-form-btn"
                data-testid="grpc-open-full-form-editor-btn"
                disabled={disabled}
                onClick={handleOpenHybridWorkspace}
              >
                Open Full Form Editor
              </button>
            )}
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
        </div>
      </div>
      {sendBlockHint && (
        <p className="grpc-call-send-block-hint" data-testid="grpc-call-send-block-hint" role="alert">
          {sendBlockHint}
        </p>
      )}

      <div className="grpc-mobile-stage-tabs" data-testid="grpc-mobile-stage-tabs" role="tablist" aria-label="Mobile grpc panel stages">
        <button
          type="button"
          role="tab"
          aria-selected={mobileStage === 'request'}
          className={`grpc-mobile-stage-tab${mobileStage === 'request' ? ' grpc-mobile-stage-tab--active' : ''}`}
          data-testid="grpc-mobile-stage-request"
          onClick={() => switchMobileStage('request')}
        >
          Request
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileStage === 'response'}
          className={`grpc-mobile-stage-tab${mobileStage === 'response' ? ' grpc-mobile-stage-tab--active' : ''}`}
          data-testid="grpc-mobile-stage-response"
          onClick={() => switchMobileStage('response')}
        >
          Response
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileStage === 'metadata'}
          className={`grpc-mobile-stage-tab${mobileStage === 'metadata' ? ' grpc-mobile-stage-tab--active' : ''}`}
          data-testid="grpc-mobile-stage-metadata"
          onClick={() => switchMobileStage('metadata')}
        >
          Metadata
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileStage === 'auth'}
          className={`grpc-mobile-stage-tab${mobileStage === 'auth' ? ' grpc-mobile-stage-tab--active' : ''}`}
          data-testid="grpc-mobile-stage-auth"
          onClick={() => switchMobileStage('auth')}
        >
          Auth
        </button>
      </div>

      <div className={`grpc-call-split grpc-call-split--stage-${mobileStage}${isStreamingLayout ? ' grpc-call-split--streaming' : ''}${layoutCallType === 'client_streaming' ? ' grpc-call-split--client-streaming' : ''}`}>
        <div className="grpc-call-request-pane" data-testid="grpc-request-pane">
          <div className="grpc-call-panel-tabs" role="group" aria-label="Request composer">
            <button
              type="button"
              aria-pressed={composerTab === 'form'}
              className={`grpc-call-panel-tab${composerTab === 'form' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-form"
              onClick={() => switchComposerTab('form')}
            >
              Form Input
            </button>
            <button
              type="button"
              aria-pressed={composerTab === 'metadata'}
              className={`grpc-call-panel-tab${composerTab === 'metadata' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-metadata"
              onClick={() => switchComposerTab('metadata')}
            >
              Metadata
            </button>
            <button
              type="button"
              aria-pressed={composerTab === 'auth'}
              className={`grpc-call-panel-tab${composerTab === 'auth' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-auth"
              onClick={() => switchComposerTab('auth')}
            >
              Auth
            </button>
            <button
              type="button"
              aria-pressed={composerTab === 'files'}
              className={`grpc-call-panel-tab${composerTab === 'files' ? ' grpc-call-panel-tab--active' : ''}`}
              data-testid="grpc-request-tab-files"
              onClick={() => switchComposerTab('files')}
            >
              Files
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
                globalAuthProfiles={globalAuthProfiles}
                defaultAuthProfileId={defaultAuthProfileId}
                onChange={(auth) => onPatch({
                  auth,
                  maskedSecretFields: pruneAuthMaskForConfig(auth, tab.maskedSecretFields),
                })}
                onUnmaskSecretField={onUnmaskAuthSecretField}
                onClearSecretField={onClearAuthSecretField}
              />
            )}

            {hasMethod && composerTab === 'files' && (
              <div className="grpc-call-files-panel" data-testid="grpc-request-files-panel">
                <p className="grpc-call-files-hint">
                  Attach payload files for bytes-oriented fields. Uploaded files are staged per tab.
                </p>
                <label className="grpc-call-files-picker">
                  <span>Choose files</span>
                  <input
                    type="file"
                    multiple
                    data-testid="grpc-request-files-input"
                    onChange={handleFilesPicked}
                  />
                </label>
                {uploadedFiles.length > 0 ? (
                  <>
                    <div className="grpc-call-files-toolbar">
                      <span className="grpc-call-files-count" data-testid="grpc-request-files-count">
                        {uploadedFiles.length} selected
                      </span>
                      <button
                        type="button"
                        className="grpc-call-files-clear-btn"
                        data-testid="grpc-request-files-clear"
                        onClick={handleClearUploadedFiles}
                      >
                        Clear all
                      </button>
                    </div>
                    <ul className="grpc-call-files-list" data-testid="grpc-request-files-list">
                      {uploadedFiles.map((file, index) => (
                        <li key={file.id} className="grpc-call-files-list-item">
                          <span>{file.name} ({file.size} B)</span>
                          <button
                            type="button"
                            className="grpc-call-files-remove-btn"
                            data-testid={`grpc-request-files-remove-${index}`}
                            onClick={() => handleRemoveUploadedFile(file.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="grpc-call-panel-empty" data-testid="grpc-request-files-empty">
                    No files selected.
                  </p>
                )}
              </div>
            )}

            {hasMethod && composerTab === 'form' && (
              <div className="grpc-call-composer-scroll" data-testid="grpc-request-form-scroll">
                {formError && (
                  <p className="grpc-call-form-error" data-testid="grpc-request-form-error" role="alert">
                    {formError}
                  </p>
                )}
                {hybridEditorEnabled ? (
                  <div className="grpc-call-json-editor grpc-hybrid-json-compact" data-testid="grpc-request-json-compact">
                    <div className="grpc-call-json-editor-header">
                      <span className="grpc-call-json-editor-hint">
                        JSON-first composer. Open Full Form Editor for guided field editing.
                      </span>
                      <div className="grpc-call-json-editor-actions">
                        <button
                          type="button"
                          className="grpc-call-full-form-btn"
                          data-testid="grpc-open-full-form-editor-btn-inline"
                          disabled={disabled}
                          onClick={handleOpenHybridWorkspace}
                        >
                          Open Full Form Editor
                        </button>
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
                          testIdPrefix="grpc-request-json-hybrid"
                        />
                      </div>
                    </div>
                    <GrpcHighlightedJsonTextarea
                      value={jsonDraft}
                      disabled={disabled}
                      onChange={handleJsonChange}
                      testId="grpc-request-json"
                    />
                    {jsonError && (
                      <p className="grpc-call-json-error" data-testid="grpc-request-json-error" role="alert">
                        {jsonError}
                      </p>
                    )}
                  </div>
                ) : (
                  <GrpcProtoFormBuilder
                    key={methodIdentity}
                    schema={method!.requestSchema}
                    messageTypes={messageTypes}
                    body={tab.body}
                    disabled={disabled}
                    onValidityChange={setFormValid}
                    onChange={(body) => onPatch({ body, requestMode: 'form' })}
                  />
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

          {isStreamingLayout
            && hasMethod
            && (layoutCallType === 'client_streaming' || layoutCallType === 'bidi_streaming') && (
            <GrpcStreamRequestActionBar
              callType={layoutCallType}
              streamActive={tab.streamLifecycle === 'streaming'}
              clientWritesEnded={tab.streamLifecycle === 'ending'}
              disabled={disabled}
              canCompose={validationReady}
              sendAllInFlight={pendingSendInFlight}
              onSendMessage={handleSendStreamMessage}
              onEndStream={() => onEndStream?.()}
            />
          )}
        </div>

        <div className="grpc-call-response-shell" data-testid="grpc-response-shell">
          {renderResponsePane()}
        </div>
      </div>

      <div className="grpc-call-mobile-action-bar" data-testid="grpc-call-mobile-action-bar">
        {(unaryReady || streamReady) && (
          <button
            type="button"
            className="grpc-call-mobile-primary-btn"
            data-testid="grpc-mobile-primary-action"
            disabled={primaryDisabled}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </button>
        )}
        {isUnaryInFlight && (
          <button
            type="button"
            className="grpc-call-mobile-secondary-btn"
            data-testid="grpc-mobile-cancel-action"
            onClick={() => onCancelUnary?.()}
          >
            Cancel
          </button>
        )}
      </div>

      {hybridEditorEnabled && method && (
        <GrpcProtoHybridEditorModal
          open={hybridState.modal.isOpen}
          method={method}
          messageTypes={messageTypes}
          modalState={hybridState.modal}
          closeConfirmVisible={hybridCloseConfirmVisible}
          disabled={disabled}
          selectedPath={hybridState.navigator.selectedPath}
          onSelectPath={handleHybridNavigatorSelectPath}
          onEvent={applyHybridEventWithHooks}
          onClose={requestHybridClose}
          onConfirmCloseDiscard={handleHybridCloseDiscard}
          onCancelCloseDiscard={handleHybridCloseKeepEditing}
        />
      )}
    </section>
  );
}
