import {
  GRPC_DEFAULT_PROBE_TIMEOUT_MS,
  GRPC_ERROR_CODES,
  type GrpcDescriptor,
  type GrpcDescriptorSource,
} from '../../../shared/grpc/contracts';
import { createDefaultDescriptorSourceSelection } from '../../../shared/grpc/descriptorSourcePolicy';
import {
  GrpcApiClientError,
  postGrpcDescribe,
  postGrpcExportProtoset,
  postGrpcReflect,
} from '../../../shared/grpc/grpcApiClient';
import {
  clearedGrpcStreamSessionPatch,
  createDefaultProtoIngestState,
  createEmptyTabDescriptorState,
  type GrpcTabProtoIngestState,
} from '../grpcStudioTypes';
import {
  buildActiveSourceSelectionPatch,
  buildDescribeRequestForSource,
  buildDescriptorSourceAvailability,
  loadDescriptorWithAutoFallback,
  orderedDescriptorSourcesForLoad,
} from '../utils/descriptorSourceFallback';
import { downloadProtosetFile } from '../utils/downloadProtoset';
import { scheduleTabSecretsVaultSync } from '../utils/grpcTabSecretVault';
import { resolutionToGrpcTarget } from '../utils/resolveGrpcTabConnection';
import {
  abortTabPendingUnaryCall,
  assertTabTlsConfigValid,
  buildDescriptorLoadFailureUpdates,
  buildDescriptorLoadSuccessUpdates,
  resolveTabConnectionWithEnv,
  tabHasPendingUnaryCall,
} from './grpcStudioSessionHelpers';
import type { GrpcStudioRuntimeContext } from './grpcStudioRuntimeContext';
import {
  abortTabActiveStream,
  tabHasActiveStream,
} from './grpcStreamSessionHelpers';

function formatDescriptorLoadErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof GrpcApiClientError
    ? error.message
    : error instanceof Error
      ? error.message
      : fallback;
  const lower = message.toLowerCase();
  if (
    message === 'Failed to fetch'
    || lower.includes('backend server running')
    || lower.includes('could not reach the app http proxy')
    || (error instanceof GrpcApiClientError && error.code === 'GRPC_NETWORK_ERROR')
  ) {
    return 'Could not reach the Express gRPC proxy (port 3001). Start it in a second terminal: npm run server';
  }
  return message;
}

function abortInFlightBeforeDescriptorLoad(ctx: GrpcStudioRuntimeContext, tabId: string): void {
  const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
  if (!tab) return;

  if (tabHasPendingUnaryCall(tab, tabId, ctx.inFlightCallRef)) {
    ctx.callGenerationRef.current[tabId] = (ctx.callGenerationRef.current[tabId] ?? 0) + 1;
    abortTabPendingUnaryCall(tabId, tab, ctx.inFlightCallRef, ctx.fireCancelInFlight);
    ctx.updateTab(tabId, {
      lifecycle: 'idle',
      activeRequestId: undefined,
    });
  }

  if (tabHasActiveStream(tab) || tab.activeStreamId) {
    abortTabActiveStream(tabId, tab, ctx.streamGenerationRef, ctx.streamDisposeRef);
    ctx.updateTab(tabId, clearedGrpcStreamSessionPatch());
  }
}

function beginDescriptorLoadGeneration(
  ctx: GrpcStudioRuntimeContext,
  tabId: string,
): { isStale: () => boolean } {
  const generation = (ctx.descriptorLoadGenerationRef.current[tabId] ?? 0) + 1;
  ctx.descriptorLoadGenerationRef.current[tabId] = generation;
  return {
    isStale: () => ctx.descriptorLoadGenerationRef.current[tabId] !== generation,
  };
}

function applyDescriptorLoadFailure(
  ctx: GrpcStudioRuntimeContext,
  tabId: string,
  message: string,
): void {
  const { descriptorPatch, tabPatch } = buildDescriptorLoadFailureUpdates(
    ctx.sessionRef.current,
    tabId,
    message,
  );
  ctx.patchTabDescriptor(tabId, descriptorPatch);
  if (tabPatch) {
    ctx.updateTab(tabId, tabPatch);
  }
}

function applyDescriptorLoadSuccess(
  ctx: GrpcStudioRuntimeContext,
  tabId: string,
  descriptor: GrpcDescriptor,
  source: GrpcDescriptorSource,
): void {
  const { descriptorPatch, tabPatch } = buildDescriptorLoadSuccessUpdates(
    tabId,
    ctx.sessionRef.current,
    descriptor,
    {
      sourceSelectionPatch: buildActiveSourceSelectionPatch(source),
    },
  );
  ctx.patchTabDescriptor(tabId, descriptorPatch);
  ctx.updateTab(tabId, tabPatch);
}

async function loadDescriptorWithNetwork(
  ctx: GrpcStudioRuntimeContext,
  tabId: string,
  ingest: GrpcTabProtoIngestState,
  initialSource: GrpcDescriptorSource,
): Promise<{ descriptor: GrpcDescriptor; source: GrpcDescriptorSource }> {
  const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
  if (!tab) {
    throw new Error(`Tab not found: ${tabId}`);
  }

  const resolution = resolveTabConnectionWithEnv(
    tab,
    ctx.envVarMap,
    ctx.profiles,
    ctx.pageDefaults,
    ctx.workspaceDefaults,
  );
  const descriptorState = ctx.sessionRef.current.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
  const selection = descriptorState.sourceSelection ?? createDefaultDescriptorSourceSelection();
  const availability = buildDescriptorSourceAvailability(resolution, ingest);
  if (resolution.targetValidation.valid) {
    assertTabTlsConfigValid(resolution, tab.tlsConfig);
  }
  const target = resolution.targetValidation.valid
    ? resolutionToGrpcTarget(resolution, tab.tlsConfig)
    : undefined;

  const { descriptor, source } = await loadDescriptorWithAutoFallback({
    selection,
    availability,
    initialSource,
    reflect: async () => {
      if (!target) {
        throw new Error('Target address is invalid');
      }
      const requestId = globalThis.crypto?.randomUUID?.() ?? `req-reflect-${Date.now()}`;
      const envelope = await postGrpcReflect({
        requestId,
        target,
        timeoutMs: GRPC_DEFAULT_PROBE_TIMEOUT_MS,
      });
      return envelope.data;
    },
    describe: async (describeSource) => {
      const requestId = globalThis.crypto?.randomUUID?.() ?? `req-describe-${Date.now()}`;
      const built = buildDescribeRequestForSource(describeSource, ingest, requestId);
      if ('error' in built) {
        throw new Error(built.error);
      }
      const envelope = await postGrpcDescribe(built);
      return envelope.data;
    },
  });

  return { descriptor, source };
}

function validateProtoIngestBeforeLoad(ingest: GrpcTabProtoIngestState): string | null {
  if (ingest.source === 'proto_files') {
    if (ingest.protoFiles.length === 0) {
      return 'Add at least one .proto file before loading';
    }
    const invalidProtoFile = ingest.protoFiles.find(
      (file) => !file.path?.trim() || !file.content?.trim(),
    );
    if (invalidProtoFile) {
      return 'Each proto file requires a non-empty path and content';
    }
    return null;
  }

  if (ingest.source === 'protoset') {
    if (!ingest.protosetBase64?.trim()) {
      return 'Select a protoset file (.pb or .protoset) before loading';
    }
    return null;
  }

  if (ingest.source === 'url_proto') {
    if (!ingest.url?.trim()) {
      return 'Enter an HTTPS URL to a .proto file before loading';
    }
    return null;
  }

  if (!ingest.bsrModule?.trim()) {
    return 'Enter a BSR module reference (owner/repo) before loading';
  }

  return null;
}

export function createReflectTabHandler(ctx: GrpcStudioRuntimeContext): (tabId: string) => Promise<void> {
  return async (tabId) => {
    const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return;

    abortInFlightBeforeDescriptorLoad(ctx, tabId);
    const { isStale } = beginDescriptorLoadGeneration(ctx, tabId);

    const resolution = resolveTabConnectionWithEnv(
      tab,
      ctx.envVarMap,
      ctx.profiles,
      ctx.pageDefaults,
      ctx.workspaceDefaults,
    );
    const descriptorState = ctx.sessionRef.current.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
    const selection = descriptorState.sourceSelection ?? createDefaultDescriptorSourceSelection();
    const ingest = descriptorState.protoIngest ?? createDefaultProtoIngestState();
    const availability = buildDescriptorSourceAvailability(resolution, ingest);

    const initialSource = selection.mode === 'manual' && selection.activeSource
      ? selection.activeSource
      : 'reflection';
    const sources = orderedDescriptorSourcesForLoad(selection, availability, initialSource);

    if (!sources.length) {
      if (isStale()) return;
      const message = !resolution.targetValidation.valid
        ? resolution.targetValidation.reason
        : 'No descriptor sources are available for this tab';
      applyDescriptorLoadFailure(ctx, tabId, message);
      return;
    }

    ctx.patchTabDescriptor(tabId, {
      loadState: 'loading',
      errorMessage: undefined,
    });

    try {
      const { descriptor, source } = await loadDescriptorWithNetwork(ctx, tabId, ingest, initialSource);
      if (isStale()) return;
      applyDescriptorLoadSuccess(ctx, tabId, descriptor, source);
    } catch (error) {
      if (isStale()) return;
      applyDescriptorLoadFailure(
        ctx,
        tabId,
        formatDescriptorLoadErrorMessage(error, 'Reflection failed'),
      );
    }
  };
}

export function createDescribeFromIngestHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string) => Promise<boolean> {
  return async (tabId) => {
    const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (!tab) return false;

    abortInFlightBeforeDescriptorLoad(ctx, tabId);
    const { isStale } = beginDescriptorLoadGeneration(ctx, tabId);

    const ingest = (ctx.sessionRef.current.tabDescriptors[tabId] ?? createEmptyTabDescriptorState())
      .protoIngest ?? createDefaultProtoIngestState();

    const validationError = validateProtoIngestBeforeLoad(ingest);
    if (validationError) {
      applyDescriptorLoadFailure(ctx, tabId, validationError);
      return false;
    }

    ctx.patchTabDescriptor(tabId, {
      loadState: 'loading',
      errorMessage: undefined,
    });

    try {
      const { descriptor, source } = await loadDescriptorWithNetwork(ctx, tabId, ingest, ingest.source);
      if (isStale()) return false;

      applyDescriptorLoadSuccess(ctx, tabId, descriptor, source);

      if (ingest.source === 'bsr' && ingest.bsrToken?.trim()) {
        const currentIngest = ctx.sessionRef.current.tabDescriptors[tabId]?.protoIngest
          ?? createDefaultProtoIngestState();
        ctx.patchTabDescriptor(tabId, {
          protoIngest: { ...currentIngest, bsrToken: undefined },
        });
        const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
        if (tab) {
          scheduleTabSecretsVaultSync({
            id: tab.id,
            connectionId: tab.connectionId,
            target: tab.target,
            bsrToken: '',
          });
        }
      }
      return true;
    } catch (error) {
      if (isStale()) return false;

      applyDescriptorLoadFailure(
        ctx,
        tabId,
        formatDescriptorLoadErrorMessage(error, 'Failed to load descriptor from proto'),
      );
      return false;
    }
  };
}

export function createPatchTabProtoIngestHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string, patch: Partial<GrpcTabProtoIngestState>) => void {
  return (tabId, patch) => {
    const current = ctx.sessionRef.current.tabDescriptors[tabId] ?? createEmptyTabDescriptorState();
    const base = current.protoIngest ?? createDefaultProtoIngestState();
    const merged = { ...base, ...patch };
    const invalidatesInFlightLoad = current.loadState === 'loading';
    if (invalidatesInFlightLoad) {
      ctx.descriptorLoadGenerationRef.current[tabId] = (ctx.descriptorLoadGenerationRef.current[tabId] ?? 0) + 1;
    }
    ctx.patchTabDescriptor(tabId, {
      protoIngest: merged,
      ...(current.loadState === 'error'
        ? { loadState: 'idle', errorMessage: undefined }
        : {}),
      ...(invalidatesInFlightLoad
        ? { loadState: 'idle', errorMessage: undefined }
        : {}),
    });
    const tab = ctx.sessionRef.current.tabs.find((entry) => entry.id === tabId);
    if (tab && Object.prototype.hasOwnProperty.call(patch, 'bsrToken')) {
      scheduleTabSecretsVaultSync({
        id: tab.id,
        connectionId: tab.connectionId,
        target: tab.target,
        bsrToken: merged.bsrToken,
      });
    }
  };
}

export function createExportProtosetHandler(
  ctx: GrpcStudioRuntimeContext,
): (tabId: string) => Promise<void> {
  return async (tabId) => {
    const descriptor = ctx.sessionRef.current.tabDescriptors[tabId]?.descriptor;
    if (!descriptor?.key) {
      throw new Error('Load a schema before exporting a protoset');
    }
    const requestId = globalThis.crypto?.randomUUID?.() ?? `req-export-${Date.now()}`;
    try {
      const envelope = await postGrpcExportProtoset({
        requestId,
        descriptorKey: descriptor.key,
      });
      downloadProtosetFile(envelope.data.protosetBase64, envelope.data.fileName);
    } catch (error) {
      if (error instanceof GrpcApiClientError && error.code === GRPC_ERROR_CODES.INVALID_DESCRIPTOR) {
        throw new Error(`${error.message} Reload the schema (Reflect or Load) and try export again.`);
      }
      throw error;
    }
  };
}
