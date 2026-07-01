import type { MutableRefObject } from 'react';
import type { GrpcDescriptor, GrpcDescriptorSourceSelection } from '../../../shared/grpc/contracts';
import {
  createDefaultDescriptorSourceSelection,
  normalizeDescriptorSourceSelection,
  resolveDescriptorSourceFingerprint,
} from '../../../shared/grpc/descriptorSourcePolicy';
import { cancelGrpcUnary } from '../../../shared/grpc/grpcTransportFacade';
import type { GrpcStudioTransportMode } from '../../../shared/grpc/grpcWebTransportContracts';
import { validateGrpcAuthForExecute } from '../../../shared/grpc/grpcAuthPolicy';
import { validateGrpcTlsConfigContract } from '../../../shared/grpc/grpcTlsPolicy';
import { validateResolvedGrpcTargetAddress, withGrpcTargetValidationMessage } from '../../../shared/grpc/targetValidation';
import { createGrpcInterpolationTemplateResolver } from '../../../shared/grpc/grpcInterpolationResolver';
import {
  mergeGrpcTabInterpolationEnv,
  resolveGrpcTabInterpolationEnvLayers,
} from '../../../shared/grpc/grpcInterpolationPrecedence';
import {
  createGrpcInterpolationEnvSnapshot,
  type GrpcInterpolationEnvSnapshot,
} from '../../../shared/grpc/grpcInterpolationEnvSnapshot';
import {
  clearedGrpcStreamSessionPatch,
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  isGrpcLifecycleInFlight,
  resolveGrpcStudioTabTransportMode,
  type GrpcStudioTabState,
  type GrpcTabDescriptorState,
} from '../grpcStudioTypes';
import { resetTargetConnectionSession } from '../utils/grpcTargetConnection';
import { bumpGrpcTargetProbeGeneration } from '../utils/grpcTargetProbeGeneration';
import {
  analyzeGrpcSchemaDrift,
} from '../utils/grpcSchemaDrift';
import { findGrpcMethod } from '../utils/grpcExplorerUtils';
import {
  metadataEntriesFromRecord,
  validateGrpcMetadataEntries,
} from '../utils/grpcMetadataEditor';
import { sanitizeGrpcErrorMessage } from '../../../shared/grpc/grpcRedaction';
import {
  redactGrpcStudioPayloadForConsumer,
  type GrpcRedactableStudioPayload,
} from '../../../shared/grpc/grpcRedaction';
import type { GrpcRedactionConsumer } from '../../../shared/grpc/grpcSecretPolicy';
import {
  resolutionToGrpcTarget,
  resolveGrpcTabConnection,
  type GrpcConnectionProfile,
  type GrpcTabConnectionPageDefaults,
  type GrpcTabConnectionResolution,
} from '../utils/resolveGrpcTabConnection';
import { assertGrpcCanonicalEnvTokensValidForConnection, validateGrpcCanonicalEnvTokensForConnection } from '../../../shared/grpc/grpcCanonicalEnvValidation';
import { validateGrpcInterpolationEnvCycles } from '../../../shared/grpc/grpcInterpolationCycleDetector';
import { abortTabActiveStream, tabHasActiveStream } from './grpcStreamSessionHelpers';

export interface GrpcStudioSessionState {
  tabs: GrpcStudioTabState[];
  activeTabId: string;
  tabDescriptors: Record<string, GrpcTabDescriptorState>;
}

export type GrpcCallAbortNotifier = (tabId: string, requestId: string) => void;

export function createInitialSessionState(): GrpcStudioSessionState {
  const tab = createGrpcStudioTab();
  return {
    tabs: [tab],
    activeTabId: tab.id,
    tabDescriptors: { [tab.id]: createEmptyTabDescriptorState() },
  };
}

export function resolveTabConnectionWithEnv(
  tab: Pick<GrpcStudioTabState, 'target' | 'connectionId' | 'tlsMode' | 'envVarOverrides'>,
  activeEnvironment: Record<string, string>,
  profiles: GrpcConnectionProfile[],
  pageDefaults: GrpcTabConnectionPageDefaults,
  workspaceDefaults?: Record<string, string>,
): GrpcTabConnectionResolution {
  const mergedEnv = mergeGrpcTabInterpolationEnv({
    workspaceDefaults,
    activeEnvironment,
    profiles,
    connectionId: tab.connectionId,
    tabOverrides: tab.envVarOverrides,
  });
  const base = resolveGrpcTabConnection(tab, profiles, pageDefaults);
  const cycleIssue = validateGrpcInterpolationEnvCycles(mergedEnv);
  if (cycleIssue) {
    return {
      ...base,
      target: base.target,
      targetValidation: {
        valid: false,
        reason: cycleIssue.message,
        code: cycleIssue.code,
      },
    };
  }
  const canonicalIssues = validateGrpcCanonicalEnvTokensForConnection(
    mergedEnv,
    tab,
    profiles,
    pageDefaults,
  );
  if (canonicalIssues.length > 0) {
    const issue = canonicalIssues[0]!;
    return {
      ...base,
      target: base.target,
      targetValidation: {
        valid: false,
        reason: issue.message,
        code: issue.code,
      },
    };
  }
  const resolvedTarget = createGrpcInterpolationTemplateResolver(mergedEnv)(base.target);
  return {
    ...base,
    target: resolvedTarget,
    targetValidation: withGrpcTargetValidationMessage(
      validateResolvedGrpcTargetAddress(resolvedTarget),
    ),
  };
}

/** Phase 9C — bind immutable env snapshot for execute/replay at click time. */
export function createGrpcTabInterpolationEnvSnapshot(
  tab: Pick<GrpcStudioTabState, 'connectionId' | 'envVarOverrides'>,
  activeEnvironment: Record<string, string>,
  profiles: GrpcConnectionProfile[],
  workspaceDefaults?: Record<string, string>,
  capturedAt?: string,
): GrpcInterpolationEnvSnapshot {
  return createGrpcInterpolationEnvSnapshot(
    resolveGrpcTabInterpolationEnvLayers({
      workspaceDefaults,
      activeEnvironment,
      profiles,
      connectionId: tab.connectionId,
      tabOverrides: tab.envVarOverrides,
    }),
    capturedAt ? { capturedAt } : undefined,
  );
}

/** Phase 9D — reject invalid canonical env tokens referenced by the connection target template. */
export function assertTabConnectionCanonicalEnvValid(
  tab: Pick<GrpcStudioTabState, 'target' | 'connectionId' | 'tlsMode' | 'envVarOverrides'>,
  env: Readonly<Record<string, string>>,
  profiles: ReadonlyArray<GrpcConnectionProfile>,
  pageDefaults: GrpcTabConnectionPageDefaults,
): void {
  assertGrpcCanonicalEnvTokensValidForConnection(env, tab, profiles, pageDefaults);
}

/** Phase 9C/9D — snapshot env at execute time and assert canonical tokens before connect. */
export function bindTabInterpolationEnvForExecute(
  tab: Pick<GrpcStudioTabState, 'target' | 'connectionId' | 'tlsMode' | 'envVarOverrides'>,
  activeEnvironment: Record<string, string>,
  profiles: GrpcConnectionProfile[],
  pageDefaults: GrpcTabConnectionPageDefaults,
  workspaceDefaults?: Record<string, string>,
): GrpcInterpolationEnvSnapshot {
  const interpolationEnv = createGrpcTabInterpolationEnvSnapshot(
    tab,
    activeEnvironment,
    profiles,
    workspaceDefaults,
  );
  assertTabConnectionCanonicalEnvValid(tab, interpolationEnv.env, profiles, pageDefaults);
  return interpolationEnv;
}

export function pickFallbackActiveTabId(tabs: GrpcStudioTabState[], closingTabId: string): string {
  if (tabs.length === 0) return '';
  const index = tabs.findIndex((tab) => tab.id === closingTabId);
  const fallback = index > 0 ? tabs[index - 1]! : tabs[index + 1] ?? tabs[0]!;
  return fallback.id;
}

export function clearedMethodBindingPatch(): Partial<GrpcStudioTabState> {
  return {
    descriptorKey: undefined,
    service: undefined,
    method: undefined,
    body: {},
    requestMode: 'form',
  };
}

export function clearedDescriptorContextPatch(): Partial<GrpcStudioTabState> {
  return {
    ...clearedMethodBindingPatch(),
    lifecycle: 'idle',
    activeRequestId: undefined,
    lastResult: undefined,
    lastError: undefined,
    lastExecuteSnapshot: undefined,
    ...clearedGrpcStreamSessionPatch(),
  };
}

export function clearedStaleMethodSelectionPatch(): Partial<GrpcStudioTabState> {
  return {
    service: undefined,
    method: undefined,
    body: {},
    requestMode: 'form',
    lifecycle: 'idle',
    activeRequestId: undefined,
    lastResult: undefined,
    lastError: undefined,
    lastExecuteSnapshot: undefined,
    ...clearedGrpcStreamSessionPatch(),
  };
}

export function resolveExpandedServiceIdsAfterReflect(
  previousKey: string | undefined,
  descriptor: GrpcDescriptor,
  currentExpanded: string[],
): string[] {
  const validNames = new Set(descriptor.services.map((service) => service.fullName));
  if (previousKey === descriptor.key) {
    return currentExpanded.filter((id) => validNames.has(id));
  }
  return descriptor.services.map((service) => service.fullName);
}

export function clearedSchemaDriftPatch(): Pick<
  GrpcTabDescriptorState,
  | 'driftState'
  | 'driftMessage'
  | 'driftIssues'
  | 'suggestedRebinds'
  | 'driftStaleMethod'
  | 'driftBaselineRequestSchema'
> {
  return {
    driftState: 'none',
    driftMessage: undefined,
    driftIssues: undefined,
    suggestedRebinds: undefined,
    driftStaleMethod: undefined,
    driftBaselineRequestSchema: undefined,
  };
}

export function buildDescriptorLoadSuccessUpdates(
  tabId: string,
  session: GrpcStudioSessionState,
  descriptor: GrpcDescriptor,
  options?: { sourceSelectionPatch?: Partial<GrpcDescriptorSourceSelection> },
): {
  descriptorPatch: Partial<GrpcTabDescriptorState>;
  tabPatch: Partial<GrpcStudioTabState>;
} {
  const tab = session.tabs.find((entry) => entry.id === tabId);
  const currentDescriptorState = session.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
  const previousKey = tab?.descriptorKey;
  const previousDescriptor = currentDescriptorState.descriptor
    ?? currentDescriptorState.lastKnownGoodDescriptor;

  const drift = analyzeGrpcSchemaDrift({
    previousDescriptor,
    nextDescriptor: descriptor,
    service: tab?.service,
    method: tab?.method,
    body: tab?.body ?? {},
  });

  const previousMethod = previousDescriptor && tab?.service && tab?.method
    ? findGrpcMethod(previousDescriptor, tab.service, tab.method)
    : undefined;

  const driftStaleMethod = drift.state === 'blocking' && previousMethod
    ? previousMethod
    : undefined;

  const driftBaselineRequestSchema = drift.state === 'warning' && previousMethod
    ? previousMethod.requestSchema
    : undefined;

  const descriptorPatch: Partial<GrpcTabDescriptorState> = {
    loadState: 'loaded',
    descriptor,
    sourceFingerprint: resolveDescriptorSourceFingerprint(descriptor),
    lastKnownGoodDescriptor: descriptor,
    driftState: drift.state,
    driftMessage: drift.message || undefined,
    driftIssues: drift.issues.length > 0 ? drift.issues : undefined,
    suggestedRebinds: drift.suggestedRebinds.length > 0 ? drift.suggestedRebinds : undefined,
    driftStaleMethod,
    driftBaselineRequestSchema,
    errorMessage: undefined,
    expandedServiceIds: resolveExpandedServiceIdsAfterReflect(
      previousKey,
      descriptor,
      currentDescriptorState.expandedServiceIds,
    ),
  };

  if (options?.sourceSelectionPatch) {
    descriptorPatch.sourceSelection = normalizeDescriptorSourceSelection({
      ...(currentDescriptorState.sourceSelection ?? createDefaultDescriptorSourceSelection()),
      ...options.sourceSelectionPatch,
    });
  }

  const tabPatch: Partial<GrpcStudioTabState> = { descriptorKey: descriptor.key };

  if (drift.state !== 'none') {
    Object.assign(tabPatch, {
      lifecycle: 'idle',
      activeRequestId: undefined,
      lastResult: undefined,
      lastError: undefined,
      lastExecuteSnapshot: undefined,
      ...clearedGrpcStreamSessionPatch(),
    });
  }

  return { descriptorPatch, tabPatch };
}

export function buildDescriptorLoadFailureUpdates(
  session: GrpcStudioSessionState,
  tabId: string,
  message: string,
): {
  descriptorPatch: Partial<GrpcTabDescriptorState>;
  tabPatch: Partial<GrpcStudioTabState> | undefined;
} {
  const prior = session.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
  const preserved = prior.lastKnownGoodDescriptor ?? prior.descriptor;
  return {
    descriptorPatch: {
      loadState: 'error',
      errorMessage: sanitizeGrpcErrorMessage(message),
      descriptor: preserved,
      lastKnownGoodDescriptor: preserved,
      sourceFingerprint: resolveDescriptorSourceFingerprint(preserved, prior.sourceFingerprint),
      expandedServiceIds: preserved ? prior.expandedServiceIds : [],
      ...(preserved ? {} : clearedSchemaDriftPatch()),
    },
    tabPatch: preserved ? undefined : clearedDescriptorContextPatch(),
  };
}

export function tabConnectionResolutionFingerprint(
  tab: GrpcStudioTabState,
  envVarMap: Record<string, string>,
  profiles: GrpcConnectionProfile[],
  pageDefaults: GrpcTabConnectionPageDefaults,
): string {
  const resolution = resolveTabConnectionWithEnv(tab, envVarMap, profiles, pageDefaults);
  if (!resolution.targetValidation.valid) {
    return `invalid:${resolution.target}|${resolution.tlsMode}`;
  }
  const grpcTarget = resolutionToGrpcTarget(resolution, tab.tlsConfig);
  return `valid:${grpcTarget.address}|${grpcTarget.tlsMode}`;
}

export function rememberTabConnectionFingerprint(
  fingerprintRef: MutableRefObject<Record<string, string>>,
  tab: GrpcStudioTabState,
  envVarMap: Record<string, string>,
  profiles: GrpcConnectionProfile[],
  pageDefaults: GrpcTabConnectionPageDefaults,
): void {
  fingerprintRef.current[tab.id] = tabConnectionResolutionFingerprint(
    tab,
    envVarMap,
    profiles,
    pageDefaults,
  );
}

export function patchTouchesConnection(patch: Partial<GrpcStudioTabState>): boolean {
  return patch.target !== undefined
    || patch.connectionId !== undefined
    || patch.tlsMode !== undefined
    || patch.envVarOverrides !== undefined;
}

/** Reset Connect dot when transport inputs change without full descriptor invalidation (e.g. TLS PEM edits). */
export function patchShouldResetTargetConnectionSession(
  patch: Partial<GrpcStudioTabState>,
): boolean {
  return patch.target !== undefined
    || patch.connectionId !== undefined
    || patch.tlsMode !== undefined
    || patch.tlsConfig !== undefined;
}

export function withTargetConnectionSessionReset(
  patch: Partial<GrpcStudioTabState>,
): Partial<GrpcStudioTabState> {
  if (patch.targetConnection !== undefined) return patch;
  if (!patchShouldResetTargetConnectionSession(patch)) return patch;
  return { ...patch, targetConnection: resetTargetConnectionSession() };
}

export function sanitizeDescriptorPatch(
  patch: Partial<GrpcTabDescriptorState>,
): Partial<GrpcTabDescriptorState> {
  const next = { ...patch };
  if (next.descriptor !== undefined) {
    next.descriptor = structuredClone(next.descriptor);
  }
  if (next.lastKnownGoodDescriptor !== undefined) {
    next.lastKnownGoodDescriptor = structuredClone(next.lastKnownGoodDescriptor);
  }
  if (next.sourceFingerprint !== undefined) {
    next.sourceFingerprint = structuredClone(next.sourceFingerprint);
  }
  if (next.sourceSelection !== undefined) {
    next.sourceSelection = {
      ...next.sourceSelection,
      autoPrecedence: next.sourceSelection.autoPrecedence
        ? [...next.sourceSelection.autoPrecedence]
        : undefined,
    };
  }
  if (next.protoIngest !== undefined) {
    next.protoIngest = structuredClone(next.protoIngest);
  }
  if (next.driftIssues !== undefined) {
    next.driftIssues = structuredClone(next.driftIssues);
  }
  if (next.suggestedRebinds !== undefined) {
    next.suggestedRebinds = structuredClone(next.suggestedRebinds);
  }
  if (next.driftStaleMethod !== undefined) {
    next.driftStaleMethod = structuredClone(next.driftStaleMethod);
  }
  if (next.driftBaselineRequestSchema !== undefined) {
    next.driftBaselineRequestSchema = structuredClone(next.driftBaselineRequestSchema);
  }
  return next;
}

export function sanitizeTabPatch(patch: Partial<GrpcStudioTabState>): Partial<GrpcStudioTabState> {
  const { id: _ignoredId, ...safePatch } = patch;
  if (safePatch.body !== undefined) {
    safePatch.body = structuredClone(safePatch.body);
  }
  if (safePatch.metadata !== undefined) {
    safePatch.metadata = { ...safePatch.metadata };
  }
  if (safePatch.lastResult !== undefined) {
    safePatch.lastResult = structuredClone(safePatch.lastResult);
  }
  if (safePatch.lastError !== undefined) {
    safePatch.lastError = structuredClone(safePatch.lastError);
  }
  if (safePatch.lastExecuteSnapshot !== undefined) {
    safePatch.lastExecuteSnapshot = structuredClone(safePatch.lastExecuteSnapshot);
  }
  if (safePatch.auth !== undefined) {
    safePatch.auth = structuredClone(safePatch.auth);
  }
  if (safePatch.tlsConfig !== undefined) {
    safePatch.tlsConfig = safePatch.tlsConfig
      ? structuredClone(safePatch.tlsConfig)
      : undefined;
  }
  if (safePatch.streamMessages !== undefined) {
    safePatch.streamMessages = structuredClone(safePatch.streamMessages);
  }
  return safePatch;
}

/** Phase 4E — redact tab fields before export/history/diagnostics consumers. */
export function prepareGrpcTabPatchForConsumer(
  patch: Partial<GrpcStudioTabState>,
  consumer: GrpcRedactionConsumer,
): Partial<GrpcStudioTabState> {
  const redacted = redactGrpcStudioPayloadForConsumer(
    patch as GrpcRedactableStudioPayload,
    consumer,
  );
  return {
    ...patch,
    ...redacted,
  } as Partial<GrpcStudioTabState>;
}

export function tabHasPendingUnaryCall(
  tab: GrpcStudioTabState,
  tabId: string,
  inFlightCallRef: MutableRefObject<Record<string, string>>,
): boolean {
  return isGrpcLifecycleInFlight(tab.lifecycle) || !!inFlightCallRef.current[tabId];
}

export function resolveTabAbortRequestId(
  tab: GrpcStudioTabState,
  tabId: string,
  inFlightCallRef: MutableRefObject<Record<string, string>>,
): string | undefined {
  return tab.activeRequestId ?? inFlightCallRef.current[tabId];
}

export function abortTabPendingUnaryCall(
  tabId: string,
  tab: GrpcStudioTabState,
  inFlightCallRef: MutableRefObject<Record<string, string>>,
  onAbort?: GrpcCallAbortNotifier,
): string | undefined {
  if (!tabHasPendingUnaryCall(tab, tabId, inFlightCallRef)) {
    return undefined;
  }
  const requestId = resolveTabAbortRequestId(tab, tabId, inFlightCallRef);
  delete inFlightCallRef.current[tabId];
  if (requestId) {
    onAbort?.(tabId, requestId);
    void cancelGrpcUnary(requestId, tabId, {
      transportMode: tab.lastExecuteSnapshot?.transportMode
        ?? resolveGrpcStudioTabTransportMode(tab),
    }).catch(() => undefined);
  }
  return requestId;
}

export function releaseCompletedGrpcCall(
  requestId: string,
  tabId: string,
  options?: { transportMode?: GrpcStudioTransportMode },
): void {
  void cancelGrpcUnary(requestId, tabId, options).catch(() => undefined);
}

export function assertTabMetadataValid(tab: GrpcStudioTabState): void {
  const validation = validateGrpcMetadataEntries(metadataEntriesFromRecord(tab.metadata));
  if (!validation.valid) {
    throw new Error(validation.message ?? 'Invalid metadata');
  }
}

/** Phase 4B — block execute/reflect snapshots when TLS contract is invalid. */
export function assertTabTlsConfigValid(
  resolution: GrpcTabConnectionResolution,
  tlsConfig: GrpcStudioTabState['tlsConfig'],
): void {
  const issues = validateGrpcTlsConfigContract(resolution.tlsMode, tlsConfig);
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? 'Invalid TLS configuration');
  }
}

/** Phase 4C/4D — block execute when auth shape is invalid (OAuth2 token fetch is server-side). */
export function assertTabAuthExecuteReady(tab: GrpcStudioTabState): void {
  const issues = validateGrpcAuthForExecute(tab.auth);
  if (issues.length > 0) {
    throw new Error(issues[0]?.message ?? 'Invalid auth configuration');
  }
}

/** Phase 9C — invalidate descriptor load state without clearing terminal call results. */
export function invalidateTabDescriptorConnectionContext(
  tabId: string,
  descriptorLoadGenerationRef: MutableRefObject<Record<string, number>>,
): Partial<GrpcStudioTabState> {
  descriptorLoadGenerationRef.current[tabId] = (descriptorLoadGenerationRef.current[tabId] ?? 0) + 1;
  return {};
}

export function invalidateTabConnectionContext(
  tabId: string,
  tab: GrpcStudioTabState,
  descriptorLoadGenerationRef: MutableRefObject<Record<string, number>>,
  callGenerationRef: MutableRefObject<Record<string, number>>,
  streamGenerationRef: MutableRefObject<Record<string, number>>,
  inFlightCallRef: MutableRefObject<Record<string, string>>,
  streamDisposeRef: MutableRefObject<Record<string, () => void>>,
  onAbort?: GrpcCallAbortNotifier,
): Partial<GrpcStudioTabState> {
  if (tabHasPendingUnaryCall(tab, tabId, inFlightCallRef)) {
    abortTabPendingUnaryCall(tabId, tab, inFlightCallRef, onAbort);
  }
  if (tabHasActiveStream(tab) || tab.activeStreamId) {
    abortTabActiveStream(tabId, tab, streamGenerationRef, streamDisposeRef);
  }
  bumpGrpcTargetProbeGeneration(tabId);
  descriptorLoadGenerationRef.current[tabId] = (descriptorLoadGenerationRef.current[tabId] ?? 0) + 1;
  callGenerationRef.current[tabId] = (callGenerationRef.current[tabId] ?? 0) + 1;
  return {
    ...clearedDescriptorContextPatch(),
    targetConnection: resetTargetConnectionSession(),
  };
}
