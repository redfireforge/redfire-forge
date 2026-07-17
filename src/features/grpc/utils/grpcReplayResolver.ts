/**
 * Phase 4H — saved request replay resolver (Phase 5C prep).
 *
 * Binds a persisted saved request to the active tab runtime without mutating
 * the source tab. Secrets (TLS PEM, auth tokens) come from tab vault state.
 */
import type { GrpcCallType, GrpcDescriptorSourceFingerprint, GrpcTabExecuteSnapshot } from '../../../shared/grpc/contracts';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import {
  isGrpcRedactedPersistValue,
  mergeAuthForReplay,
  mergeTlsConfigForReplay,
} from '../../../shared/grpc/grpcSavedRequest';
import { getGrpcAuthMetadataKeys, prepareGrpcExecuteRequestMetadata } from '../../../shared/grpc/grpcAuthPolicy';
import { isGrpcSecretMetadataKey } from '../../../shared/grpc/grpcSecretPolicy';
import {
  captureGrpcTabExecuteSnapshotFromResolution,
  type GrpcStudioTabState,
} from '../grpcStudioTypes';
import {
  assertGrpcReplayUsesFreshInterpolationEnv,
} from '../../../shared/grpc/grpcReplayTemplateCompatibility';
import { resolveGrpcStudioTabFieldsForExecute } from '../../../shared/grpc/grpcStudioExecuteInterpolation';
import {
  resolveTabConnectionWithEnv,
  bindTabInterpolationEnvForExecute,
} from '../hooks/grpcStudioSessionHelpers';
import type {
  GrpcConnectionProfile,
  GrpcTabConnectionPageDefaults,
} from '../utils/resolveGrpcTabConnection';

export interface GrpcReplayResolverInput {
  saved: GrpcSavedRequest;
  tab: GrpcStudioTabState;
  requestId: string;
  envVarMap: Record<string, string>;
  profiles: GrpcConnectionProfile[];
  pageDefaults: GrpcTabConnectionPageDefaults;
  callType?: GrpcCallType;
  sourceFingerprint?: GrpcDescriptorSourceFingerprint;
}

/** When saved request binds a profile, omit tab target so profile resolution applies. */
function resolveReplayTarget(saved: GrpcSavedRequest, tab: GrpcStudioTabState): string {
  if (saved.target?.trim()) return saved.target.trim();
  if (saved.connectionId?.trim()) return '';
  return tab.target ?? '';
}

function savedRequestUsesConnectionProfileOnly(saved: GrpcSavedRequest): boolean {
  return !!saved.connectionId?.trim() && !saved.target?.trim();
}

function savedRequestHasExplicitTarget(saved: GrpcSavedRequest): boolean {
  return !!saved.target?.trim();
}

function resolveReplayConnectionId(
  saved: GrpcSavedRequest,
  tab: GrpcStudioTabState,
): string | undefined {
  if (saved.connectionId?.trim()) return saved.connectionId;
  if (savedRequestHasExplicitTarget(saved)) return undefined;
  return tab.connectionId;
}

function resolveReplayTlsMode(
  saved: GrpcSavedRequest,
  tab: GrpcStudioTabState,
): GrpcStudioTabState['tlsMode'] {
  if (saved.tlsMode) return saved.tlsMode;
  if (savedRequestUsesConnectionProfileOnly(saved)) return undefined;
  if (savedRequestHasExplicitTarget(saved)) return undefined;
  return tab.tlsMode;
}

/** Build ephemeral tab state for replay — does not mutate the source tab. */
export function buildReplayTabState(
  tab: GrpcStudioTabState,
  saved: GrpcSavedRequest,
): GrpcStudioTabState {
  const mergedTls = mergeTlsConfigForReplay(saved.tlsConfig, tab.tlsConfig);
  return {
    ...tab,
    target: resolveReplayTarget(saved, tab),
    connectionId: resolveReplayConnectionId(saved, tab),
    tlsMode: resolveReplayTlsMode(saved, tab),
    tlsConfig: mergedTls,
    service: saved.service,
    method: saved.method,
    descriptorKey: saved.descriptorKey,
    body: structuredClone(saved.body),
    metadata: { ...saved.metadata },
    timeoutMs: saved.timeoutMs,
    auth: mergeAuthForReplay(saved.auth, tab.auth),
  };
}

function stripRedactedMetadataValues(metadata: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!isGrpcRedactedPersistValue(value)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Align replay metadata with execute path — OAuth2 never carries client-side Authorization. */
function prepareReplayExecuteMetadata(
  metadata: Record<string, string>,
  auth?: GrpcStudioTabState['auth'],
): Record<string, string> {
  let cleaned = stripRedactedMetadataValues(metadata);
  if (auth?.type === 'oauth2') {
    const authKeys = new Set(getGrpcAuthMetadataKeys(auth));
    cleaned = Object.fromEntries(
      Object.entries(cleaned).filter(([key]) => !authKeys.has(key) && !isGrpcSecretMetadataKey(key)),
    );
  }
  return prepareGrpcExecuteRequestMetadata(cleaned, auth) ?? {};
}

/**
 * Resolve saved request → executable snapshot using active tab secrets and
 * current environment interpolation.
 */
export function resolveGrpcSavedRequestReplay(input: GrpcReplayResolverInput): GrpcTabExecuteSnapshot {
  const replayTab = buildReplayTabState(input.tab, input.saved);
  const interpolationEnv = bindTabInterpolationEnvForExecute(
    replayTab,
    input.envVarMap,
    input.profiles,
    input.pageDefaults,
  );
  const resolution = resolveTabConnectionWithEnv(
    replayTab,
    input.envVarMap,
    input.profiles,
    input.pageDefaults,
  );

  if (!resolution.targetValidation.valid) {
    throw new Error(resolution.targetValidation.reason);
  }

  const resolvedFields = resolveGrpcStudioTabFieldsForExecute(
    replayTab,
    interpolationEnv.env,
  );
  const executeTab = {
    ...replayTab,
    body: resolvedFields.body,
    metadata: resolvedFields.metadata,
    auth: resolvedFields.auth,
  };

  const snapshot = captureGrpcTabExecuteSnapshotFromResolution(
    executeTab,
    input.requestId,
    resolution,
    input.callType ?? input.saved.callType,
    {
      sourceFingerprint: input.sourceFingerprint,
      interpolationEnv,
    },
  );

  const executeMetadata = prepareReplayExecuteMetadata(snapshot.metadata, snapshot.auth);

  const replaySnapshot = {
    ...snapshot,
    metadata: executeMetadata,
  };
  assertGrpcReplayUsesFreshInterpolationEnv(undefined, replaySnapshot.interpolationEnv);
  return replaySnapshot;
}
