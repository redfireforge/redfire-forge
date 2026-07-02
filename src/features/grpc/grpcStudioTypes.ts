/**
 * gRPC Studio — client-side tab state and lifecycle (Phase 1A).
 */
import type { GrpcK8sPortForwardSession } from './utils/grpcK8sPortForward';
import {
  GRPC_DEFAULT_CALL_TIMEOUT_MS,
  normalizeGrpcMetadata,
  type GrpcAuthConfig,
  type GrpcCallRequest,
  type GrpcCallType,
  type GrpcCallResult,
  type GrpcDescriptor,
  type GrpcDescriptorDriftState,
  type GrpcDescriptorSourceFingerprint,
  type GrpcDescriptorSourceSelection,
  type GrpcErrorBody,
  type GrpcMessageSchema,
  type GrpcMethodInfo,
  type GrpcStreamLogEntry,
  type GrpcStreamStartRequest,
  type GrpcStreamingCallType,
  type GrpcStudioTab,
  type GrpcTabExecuteSnapshot,
  type GrpcTarget,
  type GrpcTargetConnectionSession,
  type GrpcTlsConfig,
  type GrpcTlsMode,
} from '../../shared/grpc/contracts';
import type { GrpcCompressionConfig } from '../../shared/grpc/contracts';
import { prepareGrpcCallMetadata } from '../../shared/grpc/grpcCompressionPolicy';
import type { GrpcGrpcurlExportContext } from './utils/grpcGrpcurlTypes';
import { createDefaultDescriptorSourceSelection, normalizeDescriptorSourceSelection, resolveDescriptorSourceFingerprint } from '../../shared/grpc/descriptorSourcePolicy';
import { hasGrpcStreamTransportBinding } from '../../shared/grpc/grpcTransportFallback';
import { isGrpcStreamLifecycleInFlight } from '../../shared/grpc/streamLifecycle';
import {
  type GrpcTransportMode,
} from '../../shared/grpc/grpcTransportTabRouting';
import {
  captureGrpcTransportExecuteSnapshotFields,
  defaultGrpcStudioTransportModeForPlatform,
  type GrpcStudioTransportMode,
} from '../../shared/grpc/grpcWebTransportContracts';
import {
  createInitialStreamLifecycleState,
  type GrpcStreamLifecycle,
} from '../../shared/grpc/streamLifecycle';
import {
  resolutionToGrpcTarget,
  type GrpcTabConnectionResolution,
} from './utils/resolveGrpcTabConnection';
import type { GrpcMaskedSecretFields } from './utils/grpcSecretFieldUi';
import { validateResolvedGrpcTargetAddress, withGrpcTargetValidationMessage } from '../../shared/grpc/targetValidation';

export type GrpcRequestLifecycle =
  | 'idle'
  | 'connecting'
  | 'calling'
  | 'success'
  | 'error'
  | 'cancelled';

export type GrpcRequestMode = 'form' | 'json';

/** Optional body/metadata overrides applied at Send click (avoids React batching stale tab state). */
export type GrpcExecuteOverrides = Partial<Pick<GrpcStudioTabState, 'body' | 'metadata' | 'timeoutMs'>>;

export type GrpcDescriptorLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Tab-scoped proto / protoset ingest draft (Phase 3B). */
export interface GrpcTabProtoIngestState {
  source: 'proto_files' | 'protoset' | 'url_proto' | 'bsr';
  protoFiles: Array<{ path: string; content: string; sizeBytes?: number }>;
  importPaths: string[];
  protosetBase64?: string;
  protosetFileName?: string;
  url?: string;
  bsrModule?: string;
  bsrVersion?: string;
  bsrDigest?: string;
  bsrToken?: string;
}

import type {
  GrpcSchemaDriftIssue,
  GrpcSchemaDriftRebindSuggestion,
} from './utils/grpcSchemaDrift';

/** Per-tab descriptor cache and explorer UI state (Phase 1E + Phase 3A source policy). */
export interface GrpcTabDescriptorState {
  loadState: GrpcDescriptorLoadState;
  descriptor?: GrpcDescriptor;
  errorMessage?: string;
  expandedServiceIds: string[];
  sourceSelection: GrpcDescriptorSourceSelection;
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
  driftState: GrpcDescriptorDriftState;
  driftMessage?: string;
  driftIssues?: GrpcSchemaDriftIssue[];
  suggestedRebinds?: GrpcSchemaDriftRebindSuggestion[];
  /** Snapshot of the removed method schema for draft editing during blocking drift. */
  driftStaleMethod?: GrpcMethodInfo;
  /** Request schema before refresh — used to re-check warning drift after body edits. */
  driftBaselineRequestSchema?: GrpcMessageSchema;
  /** Preserved on failed refresh — full swap semantics in Phase 3F. */
  lastKnownGoodDescriptor?: GrpcDescriptor;
  /** Phase 3B — last proto/protoset upload draft for Manage Schemas. */
  protoIngest?: GrpcTabProtoIngestState;
}

export function createDefaultProtoIngestState(): GrpcTabProtoIngestState {
  return {
    source: 'proto_files',
    protoFiles: [],
    importPaths: [],
  };
}

export function createEmptyTabDescriptorState(): GrpcTabDescriptorState {
  return {
    loadState: 'idle',
    expandedServiceIds: [],
    sourceSelection: createDefaultDescriptorSourceSelection(),
    driftState: 'none',
  };
}

/** Reset descriptor cache on target change while keeping tab-scoped proto ingest draft. */
export function createTabDescriptorStateAfterConnectionInvalidation(
  prior?: GrpcTabDescriptorState,
): GrpcTabDescriptorState {
  const next = createEmptyTabDescriptorState();
  if (prior?.protoIngest) {
    next.protoIngest = structuredClone(prior.protoIngest);
  }
  return next;
}

/**
 * When replay/import changes connection but keeps the same descriptorKey, preserve the
 * loaded schema so service/method binding stays usable until the user re-reflects.
 */
export function createTabDescriptorStateAfterReplayConnectionChange(
  prior: GrpcTabDescriptorState | undefined,
  patchDescriptorKey?: string,
): GrpcTabDescriptorState {
  const base = createTabDescriptorStateAfterConnectionInvalidation(prior);
  const key = patchDescriptorKey?.trim();
  if (!key || !prior?.descriptor || prior.descriptor.key !== key) {
    return base;
  }
  return {
    ...base,
    loadState: prior.loadState === 'loading' ? 'idle' : prior.loadState,
    descriptor: structuredClone(prior.descriptor),
    sourceFingerprint: prior.sourceFingerprint
      ? structuredClone(prior.sourceFingerprint)
      : undefined,
    sourceSelection: structuredClone(prior.sourceSelection),
    expandedServiceIds: [...prior.expandedServiceIds],
    lastKnownGoodDescriptor: prior.lastKnownGoodDescriptor
      ? structuredClone(prior.lastKnownGoodDescriptor)
      : undefined,
  };
}

export function duplicateTabDescriptorState(source: GrpcTabDescriptorState): GrpcTabDescriptorState {
  if (source.loadState === 'loading') {
    const next = createEmptyTabDescriptorState();
    if (source.protoIngest) {
      next.protoIngest = structuredClone(source.protoIngest);
    }
    return next;
  }
  const resolvedFingerprint = resolveDescriptorSourceFingerprint(
    source.descriptor ?? source.lastKnownGoodDescriptor,
    source.sourceFingerprint,
  );
  return {
    loadState: source.loadState,
    descriptor: source.descriptor ? structuredClone(source.descriptor) : undefined,
    errorMessage: source.errorMessage,
    expandedServiceIds: [...source.expandedServiceIds],
    sourceSelection: normalizeDescriptorSourceSelectionForTab(source.sourceSelection),
    sourceFingerprint: resolvedFingerprint
      ? structuredClone(resolvedFingerprint)
      : undefined,
    driftState: source.driftState,
    driftMessage: source.driftMessage,
    driftIssues: source.driftIssues ? structuredClone(source.driftIssues) : undefined,
    suggestedRebinds: source.suggestedRebinds ? structuredClone(source.suggestedRebinds) : undefined,
    driftStaleMethod: source.driftStaleMethod
      ? structuredClone(source.driftStaleMethod)
      : undefined,
    driftBaselineRequestSchema: source.driftBaselineRequestSchema
      ? structuredClone(source.driftBaselineRequestSchema)
      : undefined,
    lastKnownGoodDescriptor: source.lastKnownGoodDescriptor
      ? structuredClone(source.lastKnownGoodDescriptor)
      : undefined,
    protoIngest: source.protoIngest
      ? structuredClone(source.protoIngest)
      : undefined,
  };
}

function normalizeDescriptorSourceSelectionForTab(
  selection: GrpcDescriptorSourceSelection,
): GrpcDescriptorSourceSelection {
  return normalizeDescriptorSourceSelection(selection);
}

/** Immutable snapshot captured when Execute is clicked (tab-scoped). */
export type { GrpcTabExecuteSnapshot } from '../../shared/grpc/contracts';

export type { GrpcStreamLifecycle, GrpcStreamLogEntry };

/** Reset all per-tab stream session fields to idle defaults (Phase 2A). */
export function clearedGrpcStreamSessionPatch(): Pick<
  GrpcStudioTabState,
  | 'streamLifecycle'
  | 'activeStreamId'
  | 'streamRequestId'
  | 'streamMessages'
  | 'streamStartedAt'
  | 'streamEndedAt'
  | 'streamError'
  | 'lastSequence'
  | 'streamPendingBodies'
> {
  const streamDefaults = createInitialStreamLifecycleState();
  return {
    streamLifecycle: streamDefaults.streamLifecycle,
    activeStreamId: undefined,
    streamRequestId: undefined,
    streamMessages: [],
    streamStartedAt: undefined,
    streamEndedAt: undefined,
    streamError: undefined,
    lastSequence: streamDefaults.lastSequence,
    streamPendingBodies: [],
  };
}

export type { GrpcStudioTransportMode } from '../../shared/grpc/grpcWebTransportContracts';

/** @deprecated Use GrpcStudioTransportMode from grpcWebTransportContracts — alias for Phase 7 routing subset. */
export type GrpcLegacyTransportMode = GrpcTransportMode;

export function resolveGrpcStudioTabTransportMode(tab: GrpcStudioTabState): GrpcStudioTransportMode {
  return tab.transportMode ?? defaultGrpcStudioTransportModeForPlatform();
}

export function canChangeGrpcTabTransportMode(tab: GrpcStudioTabState): boolean {
  if (hasGrpcStreamTransportBinding(tab.id)) {
    return false;
  }
  if (isGrpcStreamLifecycleInFlight(tab.streamLifecycle) || !!tab.activeStreamId) {
    return false;
  }
  if (isGrpcLifecycleInFlight(tab.lifecycle) || !!tab.activeRequestId) {
    return false;
  }
  return true;
}

export interface GrpcStudioTabState {
  id: string;
  title: string;
  target: string;
  /** When unset, inherit from linked profile or page defaults. */
  tlsMode?: GrpcTlsMode;
  /** Tab-scoped TLS PEM material (Phase 4B; vault persistence in 4E). */
  tlsConfig?: GrpcTlsConfig;
  /** Phase 4G — vault-hydrated secrets shown write-only until edited or cleared. */
  maskedSecretFields?: GrpcMaskedSecretFields;
  connectionId?: string;
  /** Phase 9C — per-tab env overrides (highest precedence for interpolation). */
  envVarOverrides?: Record<string, string>;
  descriptorKey?: string;
  service?: string;
  method?: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  timeoutMs: number;
  /** Phase 4J-D — per-call compression via grpc-encoding metadata. */
  compression?: GrpcCompressionConfig;
  requestMode: GrpcRequestMode;
  lifecycle: GrpcRequestLifecycle;
  activeRequestId?: string;
  lastResult?: GrpcCallResult;
  lastError?: GrpcErrorBody;
  lastExecuteSnapshot?: GrpcTabExecuteSnapshot;
  auth?: GrpcAuthConfig;
  /** Phase 2 — stream session state (per tab). */
  streamLifecycle: GrpcStreamLifecycle;
  activeStreamId?: string;
  streamRequestId?: string;
  streamMessages: GrpcStreamLogEntry[];
  streamStartedAt?: string;
  streamEndedAt?: string;
  streamError?: GrpcErrorBody;
  lastSequence: number;
  /** Outbound messages queued before send (client/bidi). */
  streamPendingBodies: Record<string, unknown>[];
  /** Phase 5F/5G — grpcurl import path hints for export round-trip (never PEM content). */
  grpcurlExportContext?: GrpcGrpcurlExportContext;
  /** Phase 7F — per-tab transport selection (express vs tauri native). */
  transportMode?: GrpcStudioTransportMode;
  /** Phase 1 — Connect/Disconnect probe session (not a persistent gRPC channel). */
  targetConnection?: GrpcTargetConnectionSession;
  /** Phase 4J-D — K8s port-forward workflow state (manual kubectl; target apply on Start). */
  k8sPortForward?: GrpcK8sPortForwardSession;
  /** Phase 2 — layout gallery when no method selected (does not override proto callType). */
  layoutPreviewCallType?: GrpcCallType;
}

let _grpcTabCounter = 0;

/** @deprecated Gap-filling title/id logic replaced the counter; kept for test imports. */
export function resetGrpcTabCounterForTests(): void {
  _grpcTabCounter = 0;
}

const DEFAULT_TAB_TITLE_PATTERN = /^Tab (\d+)$/;

/** Lowest unused `Tab N` title among existing tabs (fills gaps after close). */
export function nextDefaultGrpcTabTitle(existingTabs: GrpcStudioTabState[]): string {
  const usedNumbers = new Set<number>();
  for (const tab of existingTabs) {
    const match = DEFAULT_TAB_TITLE_PATTERN.exec(tab.title.trim());
    if (match) {
      usedNumbers.add(Number(match[1]));
    }
  }
  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }
  return `Tab ${candidate}`;
}

/** Lowest unused `grpc-tab-N` id (stable under React Strict Mode double-init). */
export function nextGrpcTabId(existingTabs: GrpcStudioTabState[]): string {
  const usedIds = new Set(existingTabs.map((tab) => tab.id));
  let candidate = 1;
  while (usedIds.has(`grpc-tab-${candidate}`)) {
    candidate += 1;
  }
  return `grpc-tab-${candidate}`;
}

export function createGrpcStudioTab(
  overrides: Partial<GrpcStudioTabState> = {},
  existingTabs: GrpcStudioTabState[] = [],
): GrpcStudioTabState {
  _grpcTabCounter += 1;
  const id = overrides.id ?? nextGrpcTabId(existingTabs);
  return {
    id,
    title: overrides.title ?? nextDefaultGrpcTabTitle(existingTabs),
    target: overrides.target ?? '',
    tlsMode: overrides.tlsMode,
    tlsConfig: overrides.tlsConfig,
    maskedSecretFields: overrides.maskedSecretFields,
    connectionId: overrides.connectionId,
    descriptorKey: overrides.descriptorKey,
    service: overrides.service,
    method: overrides.method,
    body: overrides.body ?? {},
    metadata: overrides.metadata ?? {},
    timeoutMs: overrides.timeoutMs ?? GRPC_DEFAULT_CALL_TIMEOUT_MS,
    compression: overrides.compression,
    requestMode: overrides.requestMode ?? 'form',
    lifecycle: overrides.lifecycle ?? 'idle',
    activeRequestId: overrides.activeRequestId,
    lastResult: overrides.lastResult,
    lastError: overrides.lastError,
    lastExecuteSnapshot: overrides.lastExecuteSnapshot,
    auth: overrides.auth,
    transportMode: overrides.transportMode ?? defaultGrpcStudioTransportModeForPlatform(),
    layoutPreviewCallType: overrides.layoutPreviewCallType ?? 'unary',
    ...clearedGrpcStreamSessionPatch(),
    ...overrides,
  };
}

export function duplicateGrpcStudioTab(
  tab: GrpcStudioTabState,
  existingTabs: GrpcStudioTabState[] = [],
): GrpcStudioTabState {
  const copiedMessages = structuredClone(tab.streamMessages);
  return createGrpcStudioTab({
    title: `${tab.title} (copy)`,
    target: tab.target,
    tlsMode: tab.tlsMode,
    tlsConfig: tab.tlsConfig ? structuredClone(tab.tlsConfig) : undefined,
    maskedSecretFields: tab.maskedSecretFields
      ? structuredClone(tab.maskedSecretFields)
      : undefined,
    connectionId: tab.connectionId,
    descriptorKey: tab.descriptorKey,
    service: tab.service,
    method: tab.method,
    body: structuredClone(tab.body),
    metadata: { ...tab.metadata },
    timeoutMs: tab.timeoutMs,
    compression: tab.compression ? structuredClone(tab.compression) : undefined,
    requestMode: tab.requestMode,
    lifecycle: 'idle',
    auth: tab.auth ? structuredClone(tab.auth) : undefined,
    grpcurlExportContext: tab.grpcurlExportContext
      ? structuredClone(tab.grpcurlExportContext)
      : undefined,
    transportMode: tab.transportMode,
    layoutPreviewCallType: tab.layoutPreviewCallType,
    k8sPortForward: tab.k8sPortForward
      ? {
        config: structuredClone(tab.k8sPortForward.config),
        active: false,
      }
      : undefined,
    ...clearedGrpcStreamSessionPatch(),
    streamMessages: copiedMessages,
  }, existingTabs);
}

export function captureGrpcTabExecuteSnapshot(
  tab: GrpcStudioTabState,
  requestId: string,
  resolvedTarget: GrpcTarget,
  callType: GrpcCallType,
  options?: {
    sourceFingerprint?: GrpcDescriptorSourceFingerprint;
    interpolationEnv?: GrpcTabExecuteSnapshot['interpolationEnv'];
  },
): GrpcTabExecuteSnapshot {
  if (!tab.descriptorKey?.trim()) {
    throw new Error('descriptorKey is required before executing a call');
  }
  if (!tab.service?.trim() || !tab.method?.trim()) {
    throw new Error('service and method must be selected before executing');
  }

  const targetCheck = withGrpcTargetValidationMessage(
    validateResolvedGrpcTargetAddress(resolvedTarget.address),
  );
  if (!targetCheck.valid) {
    throw new Error(targetCheck.reason);
  }

  return {
    tabId: tab.id,
    requestId,
    capturedAt: new Date().toISOString(),
    callType,
    target: {
      ...structuredClone(resolvedTarget),
      address: targetCheck.normalized,
    },
    service: tab.service,
    method: tab.method,
    body: structuredClone(tab.body),
    metadata: normalizeGrpcMetadata(tab.metadata),
    timeoutMs: tab.timeoutMs,
    compression: tab.compression ? structuredClone(tab.compression) : undefined,
    descriptorKey: tab.descriptorKey,
    sourceFingerprint: options?.sourceFingerprint
      ? structuredClone(options.sourceFingerprint)
      : undefined,
    auth: tab.auth ? structuredClone(tab.auth) : undefined,
    interpolationEnv: options?.interpolationEnv
      ? structuredClone(options.interpolationEnv)
      : undefined,
    ...captureGrpcTransportExecuteSnapshotFields(
      tab.transportMode ?? defaultGrpcStudioTransportModeForPlatform(),
    ),
  };
}

export function isGrpcLifecycleInFlight(lifecycle: GrpcRequestLifecycle): boolean {
  return lifecycle === 'connecting' || lifecycle === 'calling';
}

export function isGrpcLifecycleTerminal(lifecycle: GrpcRequestLifecycle): boolean {
  return lifecycle === 'success' || lifecycle === 'error' || lifecycle === 'cancelled';
}

export function captureGrpcTabExecuteSnapshotFromResolution(
  tab: GrpcStudioTabState,
  requestId: string,
  resolution: GrpcTabConnectionResolution,
  callType: GrpcCallType = 'unary',
  options?: {
    sourceFingerprint?: GrpcDescriptorSourceFingerprint;
    interpolationEnv?: GrpcTabExecuteSnapshot['interpolationEnv'];
  },
): GrpcTabExecuteSnapshot {
  if (!resolution.targetValidation.valid) {
    throw new Error(resolution.targetValidation.reason);
  }
  return captureGrpcTabExecuteSnapshot(
    tab,
    requestId,
    resolutionToGrpcTarget(resolution, tab.tlsConfig),
    callType,
    options,
  );
}

export function snapshotToUnaryCallRequest(snapshot: GrpcTabExecuteSnapshot): GrpcCallRequest {
  if (snapshot.callType !== 'unary') {
    throw new Error('snapshotToUnaryCallRequest requires a unary snapshot');
  }
  return {
    callType: 'unary',
    requestId: snapshot.requestId,
    target: snapshot.target,
    service: snapshot.service,
    method: snapshot.method,
    body: structuredClone(snapshot.body),
    metadata: prepareGrpcCallMetadata(snapshot.metadata, snapshot.auth, snapshot.compression),
    auth: snapshot.auth ? structuredClone(snapshot.auth) : undefined,
    timeoutMs: snapshot.timeoutMs,
    descriptorKey: snapshot.descriptorKey,
  };
}

export function snapshotToStreamStartRequest(
  snapshot: GrpcTabExecuteSnapshot,
): GrpcStreamStartRequest {
  if (
    snapshot.callType !== 'server_streaming'
    && snapshot.callType !== 'client_streaming'
    && snapshot.callType !== 'bidi_streaming'
  ) {
    throw new Error('snapshotToStreamStartRequest requires a streaming snapshot');
  }
  return {
    callType: snapshot.callType as GrpcStreamingCallType,
    requestId: snapshot.requestId,
    target: snapshot.target,
    service: snapshot.service,
    method: snapshot.method,
    body: structuredClone(snapshot.body),
    metadata: prepareGrpcCallMetadata(snapshot.metadata, snapshot.auth, snapshot.compression),
    auth: snapshot.auth ? structuredClone(snapshot.auth) : undefined,
    timeoutMs: snapshot.timeoutMs,
    descriptorKey: snapshot.descriptorKey,
  };
}

export function toPersistedGrpcStudioTab(tab: GrpcStudioTabState): GrpcStudioTab {
  return {
    id: tab.id,
    title: tab.title,
    target: tab.target || undefined,
    connectionId: tab.connectionId,
    service: tab.service,
    method: tab.method,
  };
}
