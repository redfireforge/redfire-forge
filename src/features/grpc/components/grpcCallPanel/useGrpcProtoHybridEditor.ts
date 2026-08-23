import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GRPC_PROTO_HYBRID_EDITOR_ENABLED } from '../../../../config/features';
import type { GrpcMethodInfo, GrpcMessageSchema } from '@shared/grpc/contracts';
import type { GrpcStudioTabState } from '../../grpcStudioTypes';
import {
  applyJsonTextToSchema,
  serializeGrpcBodyJson,
} from '../../utils/grpcBodyComposer';
import { buildHybridNavigatorPaths } from '../grpcProtoHybridNavigatorPaths';
import {
  createGrpcProtoHybridInitialState,
  isGrpcProtoHybridEnabledForMethod,
  reduceGrpcProtoHybridState,
  type GrpcProtoHybridEvent,
} from '../../utils/grpcProtoHybridState';
import { emitGrpcHybridTelemetry } from '../../utils/grpcHybridTelemetry';
import { hasGrpcProtoHybridApplyBlockingState } from '../../utils/grpcProtoHybridValidation';
import { hashTabId, schemaComplexityBucket, stringifyUnknown } from './grpcCallPanelHelpers';

export interface UseGrpcProtoHybridEditorParams {
  tab: GrpcStudioTabState;
  method?: GrpcMethodInfo;
  messageTypes?: GrpcMessageSchema[];
  serviceFullName?: string;
  hasMethod: boolean;
  hybridEditorEnabled: boolean;
  jsonDraft: string;
  setJsonDraft: (draft: string) => void;
  setJsonError: (error: string | null) => void;
  onPatch: (patch: Partial<GrpcStudioTabState>) => void;
  sendBlockHint: string | null;
}

export function useGrpcProtoHybridEditor({
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
}: UseGrpcProtoHybridEditorParams) {
  const [hybridState, setHybridState] = useState(() => createGrpcProtoHybridInitialState(tab.id, tab.body));
  const [hybridCloseConfirmVisible, setHybridCloseConfirmVisible] = useState(false);

  const hybridTelemetryPayload = useMemo(() => {
    const methodIdentifier = hasMethod ? `${serviceFullName}/${method!.name}` : 'unknown';
    const fieldCount = method?.requestSchema?.fields?.length ?? 0;
    return {
      tabIdHash: hashTabId(tab.id),
      methodIdentifier,
      schemaComplexity: schemaComplexityBucket(fieldCount),
    };
  }, [hasMethod, method, serviceFullName, tab.id]);

  const hybridNavigatorPaths = useMemo(
    () => (method ? buildHybridNavigatorPaths(method.requestSchema) : []),
    [method],
  );

  const lastHybridWarningCountRef = useRef<number | null>(null);
  const lastSendBlockHintRef = useRef<string | null>(null);
  const lastHybridPatchedBodyRef = useRef<string | null>(null);

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
    setJsonDraft,
    setJsonError,
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
    setJsonError,
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

  return {
    hybridState,
    hybridCloseConfirmVisible,
    requestHybridClose,
    handleHybridCloseKeepEditing,
    handleHybridCloseDiscard,
    handleHybridNavigatorSelectPath,
    handleOpenHybridWorkspace,
    applyHybridEventWithHooks,
  };
}

export function resolveGrpcProtoHybridEditorEnabled(method?: GrpcMethodInfo): boolean {
  return GRPC_PROTO_HYBRID_EDITOR_ENABLED && isGrpcProtoHybridEnabledForMethod(method);
}
