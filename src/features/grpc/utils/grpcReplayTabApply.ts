/**
 * Phase 5H — apply saved request / grpcurl import patches to active tab state.
 */
import type { GrpcDescriptor } from '../../../shared/grpc/contracts';
import type { GrpcSavedRequest } from '../../../shared/grpc/grpcSavedRequest';
import {
  clearedGrpcStreamSessionPatch,
  createDefaultProtoIngestState,
  createTabDescriptorStateAfterReplayConnectionChange,
  type GrpcStudioTabState,
  type GrpcTabDescriptorState,
  type GrpcTabProtoIngestState,
} from '../grpcStudioTypes';
import { clearedSchemaDriftPatch, patchTouchesConnection } from '../hooks/grpcStudioSessionHelpers';
import { buildReplayTabState } from './grpcReplayResolver';
import { analyzeReplaySchemaDrift, buildDescriptorMissingDrift } from './grpcReplayBinding';
import type { GrpcSchemaDriftAnalysis } from './grpcSchemaDrift';
import { findGrpcMethod } from './grpcExplorerUtils';
import type { GrpcGrpcurlDescriptorFlags, GrpcGrpcurlExportContext, GrpcGrpcurlImportSuccess } from './grpcGrpcurlTypes';
import { grpcGrpcurlImportToTabPatch } from './grpcGrpcurlCore';

const DEFAULT_REPLAY_PROTO_ROOT_ID = 'root-default';
const DEFAULT_REPLAY_PROTO_ROOT_MOUNT = 'root';

export function mergeGrpcurlDescriptorIntoProtoIngest(
  existing: GrpcTabProtoIngestState | undefined,
  flags: GrpcGrpcurlDescriptorFlags | undefined,
): Partial<GrpcTabProtoIngestState> | undefined {
  if (!flags) return undefined;

  const hasProtoset = Boolean(flags.protosetPath?.trim());
  const hasProtoPaths = (flags.protoPaths?.length ?? 0) > 0;
  const hasImportPaths = (flags.importPaths?.length ?? 0) > 0;
  if (!hasProtoset && !hasProtoPaths && !hasImportPaths) return undefined;

  const base = existing ?? createDefaultProtoIngestState();

  if (hasProtoset) {
    const protosetPath = flags.protosetPath!.trim();
    return {
      source: 'protoset',
      protosetFileName: protosetPath.split('/').pop() || protosetPath,
      importPaths: hasImportPaths
        ? [...new Set([...base.importPaths, ...flags.importPaths!])]
        : base.importPaths,
      protoRoots: [],
    };
  }

  const baseRoots = base.protoRoots.length > 0
    ? base.protoRoots
    : [{ id: DEFAULT_REPLAY_PROTO_ROOT_ID, mountPath: DEFAULT_REPLAY_PROTO_ROOT_MOUNT, files: [] }];
  const primaryRoot = baseRoots[0]!;

  const mergedProtoPaths = [...new Set([
    ...primaryRoot.files.map((file) => file.path),
    ...(flags.protoPaths ?? []),
  ])];

  return {
    source: 'proto_files',
    importPaths: [...new Set([...base.importPaths, ...(flags.importPaths ?? [])])],
    protoRoots: [
      {
        id: primaryRoot.id,
        mountPath: primaryRoot.mountPath,
        files: mergedProtoPaths.map((path) => {
          const existingFile = primaryRoot.files.find((file) => file.path === path);
          return existingFile
            ? {
              path: existingFile.path,
              content: existingFile.content,
              sizeBytes: existingFile.sizeBytes,
            }
            : { path, content: '' };
        }),
      },
    ],
  };
}

function buildGrpcurlExportContextFromImport(
  patch: ReturnType<typeof grpcGrpcurlImportToTabPatch>,
): GrpcGrpcurlExportContext | undefined {
  if (!patch.tlsFilePaths && !patch.descriptorImport) return undefined;
  return {
    tlsFilePaths: patch.tlsFilePaths,
    descriptorFlags: patch.descriptorImport,
  };
}

export function grpcurlImportDescriptorStatePatch(
  descriptorState: GrpcTabDescriptorState,
  importResult: GrpcGrpcurlImportSuccess,
): Partial<GrpcTabDescriptorState> | undefined {
  const patch = grpcGrpcurlImportToTabPatch(importResult);
  const protoIngestPatch = mergeGrpcurlDescriptorIntoProtoIngest(
    descriptorState.protoIngest,
    patch.descriptorImport,
  );
  if (!protoIngestPatch) return undefined;
  return {
    protoIngest: {
      ...(descriptorState.protoIngest ?? createDefaultProtoIngestState()),
      ...protoIngestPatch,
    },
  };
}

export function resolveDescriptorStateAfterTabPatch(
  tab: GrpcStudioTabState,
  descriptorState: GrpcTabDescriptorState,
  patch: Partial<GrpcStudioTabState>,
): GrpcTabDescriptorState {
  if (!patchTouchesConnection(patch)) {
    return descriptorState;
  }
  return createTabDescriptorStateAfterReplayConnectionChange(
    descriptorState,
    patch.descriptorKey ?? tab.descriptorKey,
  );
}

export function analyzeGrpcurlImportSchemaDrift(
  tab: GrpcStudioTabState,
  descriptorState: GrpcTabDescriptorState,
  importResult: GrpcGrpcurlImportSuccess,
): GrpcSchemaDriftAnalysis {
  const patch = grpcurlImportToTabStatePatch(tab, importResult);
  const effectiveState = resolveDescriptorStateAfterTabPatch(tab, descriptorState, patch);
  const descriptor = effectiveState.descriptor;
  if (!descriptor) {
    return buildDescriptorMissingDrift(importResult.serviceFullName, importResult.methodName);
  }
  return analyzeReplaySchemaDrift({
    currentDescriptor: descriptor,
    baselineDescriptor: effectiveState.lastKnownGoodDescriptor ?? descriptor,
    service: importResult.serviceFullName,
    method: importResult.methodName,
    body: importResult.body,
  });
}

export function buildDriftDescriptorPatchFromAnalysis(
  drift: GrpcSchemaDriftAnalysis,
  currentDescriptor: GrpcDescriptor | undefined,
  service: string,
  method: string,
): Partial<GrpcTabDescriptorState> {
  if (drift.state === 'none') {
    return clearedSchemaDriftPatch();
  }

  const previousMethod = currentDescriptor
    ? findGrpcMethod(currentDescriptor, service, method)
    : undefined;

  return {
    driftState: drift.state,
    driftMessage: drift.message || undefined,
    driftIssues: drift.issues.length > 0 ? drift.issues : undefined,
    suggestedRebinds: drift.suggestedRebinds.length > 0 ? drift.suggestedRebinds : undefined,
    driftStaleMethod: drift.state === 'blocking' && previousMethod ? previousMethod : undefined,
    driftBaselineRequestSchema: drift.state === 'warning' && previousMethod
      ? previousMethod.requestSchema
      : undefined,
  };
}

export function savedRequestToTabPatch(
  tab: GrpcStudioTabState,
  saved: GrpcSavedRequest,
  bodyOverride?: Record<string, unknown>,
): Partial<GrpcStudioTabState> {
  const replay = buildReplayTabState(tab, saved);
  return {
    ...clearedGrpcStreamSessionPatch(),
    target: replay.target,
    connectionId: replay.connectionId,
    tlsMode: replay.tlsMode,
    tlsConfig: replay.tlsConfig,
    service: replay.service,
    method: replay.method,
    descriptorKey: replay.descriptorKey,
    body: bodyOverride ?? replay.body,
    metadata: replay.metadata,
    timeoutMs: replay.timeoutMs,
    auth: replay.auth,
    requestMode: 'form',
    lifecycle: 'idle',
    activeRequestId: undefined,
    lastResult: undefined,
    lastError: undefined,
    lastExecuteSnapshot: undefined,
    grpcurlExportContext: undefined,
  };
}

export function grpcurlImportToTabStatePatch(
  tab: GrpcStudioTabState,
  importResult: GrpcGrpcurlImportSuccess,
): Partial<GrpcStudioTabState> {
  const patch = grpcGrpcurlImportToTabPatch(importResult);
  const exportContext = buildGrpcurlExportContextFromImport(patch);
  return {
    ...clearedGrpcStreamSessionPatch(),
    target: patch.target,
    tlsMode: patch.tlsMode,
    tlsConfig: patch.tlsConfig,
    service: patch.service,
    method: patch.method,
    body: patch.body,
    metadata: patch.metadata,
    lifecycle: 'idle',
    requestMode: 'form',
    activeRequestId: undefined,
    lastResult: undefined,
    lastError: undefined,
    lastExecuteSnapshot: undefined,
    descriptorKey: tab.descriptorKey,
    grpcurlExportContext: exportContext,
  };
}
