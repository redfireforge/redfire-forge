/**
 * Phase 3I — auto cross-source descriptor fallback helpers (renderer).
 */
import {
  GRPC_ERROR_CODES,
  type GrpcDescribeRequest,
  type GrpcDescriptor,
  type GrpcDescriptorSource,
  type GrpcDescriptorSourceSelection,
} from '../../../shared/grpc/contracts';
import {
  DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE,
  type GrpcDescriptorPhaseFailureKind,
  type GrpcDescriptorSourceAvailability,
  isDescriptorSourceAvailable,
  normalizeDescriptorSourceSelection,
  shouldAttemptDescriptorSourceFallback,
} from '../../../shared/grpc/descriptorSourcePolicy';
import { GrpcApiClientError } from '../../../shared/grpc/grpcApiClient';
import type { GrpcTabProtoIngestState } from '../grpcStudioTypes';
import type { GrpcTabConnectionResolution } from './resolveGrpcTabConnection';

export function buildDescriptorSourceAvailability(
  resolution: GrpcTabConnectionResolution,
  ingest: GrpcTabProtoIngestState,
): GrpcDescriptorSourceAvailability {
  const protoFilesReady = ingest.protoFiles.length > 0
    && ingest.protoFiles.every((file) => file.path?.trim() && file.content?.trim());

  return {
    reflection: resolution.targetValidation.valid,
    proto_files: protoFilesReady,
    protoset: Boolean(ingest.protosetBase64?.trim()),
    bsr: Boolean(ingest.bsrModule?.trim()),
    url_proto: Boolean(ingest.url?.trim()),
  };
}

export function mapGrpcClientErrorToFailureKind(
  error: GrpcApiClientError,
  op: 'reflect' | 'describe',
): GrpcDescriptorPhaseFailureKind {
  switch (error.code) {
    case GRPC_ERROR_CODES.UNREACHABLE:
    case GRPC_ERROR_CODES.SOURCE_UNAVAILABLE:
      return 'source_unavailable';
    case GRPC_ERROR_CODES.REFLECTION_FAILED:
      return 'reflection_failed';
    case GRPC_ERROR_CODES.DESCRIBE_FAILED:
      return 'describe_failed';
    case GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED:
      return 'import_resolution_failed';
    default:
      return op === 'reflect' ? 'reflection_failed' : 'describe_failed';
  }
}

export function buildDescribeRequestForSource(
  source: Exclude<GrpcDescriptorSource, 'reflection'>,
  ingest: GrpcTabProtoIngestState,
  requestId: string,
): GrpcDescribeRequest | { error: string } {
  if (source === 'proto_files') {
    if (ingest.protoFiles.length === 0) {
      return { error: 'Add at least one .proto file before loading' };
    }
    const invalidProtoFile = ingest.protoFiles.find(
      (file) => !file.path?.trim() || !file.content?.trim(),
    );
    if (invalidProtoFile) {
      return { error: 'Each proto file requires a non-empty path and content' };
    }
    return {
      requestId,
      source,
      protoFiles: ingest.protoFiles.map(({ path, content }) => ({ path, content })),
      importPaths: ingest.importPaths.length > 0 ? ingest.importPaths : undefined,
    };
  }

  if (source === 'protoset') {
    if (!ingest.protosetBase64?.trim()) {
      return { error: 'Select a protoset file (.pb or .protoset) before loading' };
    }
    return { requestId, source, protosetBase64: ingest.protosetBase64 };
  }

  if (source === 'url_proto') {
    if (!ingest.url?.trim()) {
      return { error: 'Enter an HTTPS URL to a .proto file before loading' };
    }
    return { requestId, source, url: ingest.url.trim() };
  }

  if (!ingest.bsrModule?.trim()) {
    return { error: 'Enter a BSR module reference (owner/repo) before loading' };
  }
  return {
    requestId,
    source: 'bsr',
    bsrModule: ingest.bsrModule.trim(),
    bsrVersion: ingest.bsrVersion?.trim() || undefined,
    bsrDigest: ingest.bsrDigest?.trim() || undefined,
    bsrToken: ingest.bsrToken?.trim() || undefined,
  };
}

export function orderedDescriptorSourcesForLoad(
  selection: GrpcDescriptorSourceSelection,
  availability: GrpcDescriptorSourceAvailability,
  initialSource: GrpcDescriptorSource,
): GrpcDescriptorSource[] {
  const normalized = normalizeDescriptorSourceSelection(selection);
  if (normalized.mode === 'manual') {
    return isDescriptorSourceAvailable(initialSource, availability) ? [initialSource] : [];
  }

  const precedence = normalized.autoPrecedence ?? DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE;
  const ordered: GrpcDescriptorSource[] = [];
  const seen = new Set<GrpcDescriptorSource>();
  for (const source of [initialSource, ...precedence]) {
    if (seen.has(source)) continue;
    seen.add(source);
    if (isDescriptorSourceAvailable(source, availability)) {
      ordered.push(source);
    }
  }
  return ordered;
}

export async function loadDescriptorWithAutoFallback(options: {
  selection: GrpcDescriptorSourceSelection;
  availability: GrpcDescriptorSourceAvailability;
  initialSource: GrpcDescriptorSource;
  reflect: () => Promise<GrpcDescriptor>;
  describe: (source: Exclude<GrpcDescriptorSource, 'reflection'>) => Promise<GrpcDescriptor>;
}): Promise<{ descriptor: GrpcDescriptor; source: GrpcDescriptorSource }> {
  const sources = orderedDescriptorSourcesForLoad(
    options.selection,
    options.availability,
    options.initialSource,
  );

  if (!sources.length) {
    throw new Error('No descriptor sources are available for this tab');
  }

  let lastError: unknown;
  for (const source of sources) {
    try {
      if (source === 'reflection') {
        return { descriptor: await options.reflect(), source };
      }
      return { descriptor: await options.describe(source), source };
    } catch (error) {
      lastError = error;
      const selection = normalizeDescriptorSourceSelection(options.selection);
      if (selection.mode !== 'auto') {
        break;
      }
      const failureKind = error instanceof GrpcApiClientError
        ? mapGrpcClientErrorToFailureKind(error, source === 'reflection' ? 'reflect' : 'describe')
        : (source === 'reflection' ? 'reflection_failed' : 'describe_failed');
      if (!shouldAttemptDescriptorSourceFallback('auto', failureKind)) {
        break;
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Failed to load descriptor');
}

export function buildActiveSourceSelectionPatch(
  activeSource: GrpcDescriptorSource,
): Partial<GrpcDescriptorSourceSelection> {
  return { activeSource };
}
