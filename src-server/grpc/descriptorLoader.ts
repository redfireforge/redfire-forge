import protobuf from 'protobufjs';
import type {
  GrpcDescribeRequest,
  GrpcDescriptor,
  GrpcReflectRequest,
} from '../../src/shared/grpc/contracts.js';
import {
  classifyGrpcTransportFailure,
  type GrpcTransportErrorDetails,
} from '../../src/shared/grpc/grpcTransportErrors.js';
import { validateResolvedGrpcTargetAddress } from '../../src/shared/grpc/targetValidation.js';
import {
  buildDescriptorKey,
  buildReflectionDescriptorKey,
  computeDescriptorContentHash,
  shortContentHash,
} from './descriptorKey.js';
import { buildDescriptorSourceFingerprint } from '../../src/shared/grpc/descriptorSourcePolicy.js';
import { setDescriptorRootCache } from './descriptorRootCache.js';
import {
  descriptorServiceSignatures,
  normalizeRootToDescriptor,
} from './descriptorNormalizer.js';
import { parseDescribeRequestSource, parseProtoFiles, parseProtosetBase64 } from './protoDescriptorParser.js';
import { ProtoImportResolutionError } from './protoImportResolver.js';
import { setGrpcDescriptor } from './descriptorStore.js';
import {
  buildBsrDescriptorSourceRef,
  buildDescribeCacheLookup,
  buildProtoFilesSourceRefFromDescribeRequest,
  findDescriptorCacheEntry,
  putDescriptorCacheEntry,
} from './descriptorCacheManager.js';
import { fetchBsrDescriptorSet, BsrFetchGatewayError } from './bsrFetchGateway.js';
import { grpcMockServerPool } from './grpcMockServerPool.js';
import { fetchProtoFromUrl, ProtoFetchGatewayError } from './protoFetchGateway.js';
import {
  grpcReflectionClient,
  isNoMatchingServicesError,
  isReflectionUnavailableError,
  isUnreachableError,
  ReflectionFetchError,
  type ReflectionClientPort,
} from './reflectionClient.js';

export class DescriptorLoaderError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unreachable'
      | 'reflection_failed'
      | 'describe_failed'
      | 'import_resolution_failed'
      | 'invalid_descriptor'
      | 'invalid_target'
      | 'source_unavailable',
    readonly transportDetails?: GrpcTransportErrorDetails,
  ) {
    super(message);
    this.name = 'DescriptorLoaderError';
  }
}

function finalizeDescriptorFromRoot(
  root: protobuf.Root,
  source: GrpcDescriptor['source'],
  sourceRef?: string,
  options?: {
    reflectionVersion?: 'v1' | 'v1alpha';
    fingerprintExtras?: Parameters<typeof buildDescriptorSourceFingerprint>[1];
  },
): GrpcDescriptor {
  const normalized = normalizeRootToDescriptor(root, source, '', { sourceRef });
  const contentSha256 = computeDescriptorContentHash(normalized);
  const key = source === 'reflection'
    ? buildReflectionDescriptorKey(sourceRef ?? 'unknown', contentSha256)
    : buildDescriptorKey(source, contentSha256, sourceRef);
  const base: GrpcDescriptor = {
    ...normalized,
    contentSha256,
    key,
    reflectionVersion: options?.reflectionVersion,
  };
  const descriptor: GrpcDescriptor = {
    ...base,
    sourceFingerprint: buildDescriptorSourceFingerprint(base, options?.fingerprintExtras),
  };
  setGrpcDescriptor(descriptor);
  setDescriptorRootCache(descriptor.key, root);
  putDescriptorCacheEntry({
    descriptor,
    fingerprint: descriptor.sourceFingerprint!,
    storedAt: new Date().toISOString(),
    root,
  });
  return descriptor;
}

function tryDescribeCacheHit(request: GrpcDescribeRequest): GrpcDescriptor | null {
  const lookup = buildDescribeCacheLookup(request);
  if (!lookup) {
    return null;
  }
  const cached = findDescriptorCacheEntry(lookup);
  if (!cached) {
    return null;
  }
  setGrpcDescriptor(cached.descriptor);
  if (cached.root) {
    setDescriptorRootCache(cached.descriptor.key, cached.root);
  }
  return cached.descriptor;
}

export class DescriptorLoader {
  constructor(private readonly reflectionClient: ReflectionClientPort = grpcReflectionClient) {}

  async loadFromReflection(request: GrpcReflectRequest): Promise<GrpcDescriptor> {
    const targetCheck = validateResolvedGrpcTargetAddress(request.target.address);
    if (!targetCheck.valid) {
      throw new DescriptorLoaderError(targetCheck.reason, 'invalid_target');
    }
    if (targetCheck.kind === 'in_process') {
      throw new DescriptorLoaderError(
        'in-process targets are not dialable from the Node server (Phase 1C)',
        'unreachable',
      );
    }

    const mockDescriptor = grpcMockServerPool.resolveDescriptorForListenTarget(targetCheck.normalized);
    if (mockDescriptor) {
      setGrpcDescriptor(mockDescriptor);
      return mockDescriptor;
    }

    const timeoutMs = request.timeoutMs ?? 5_000;
    try {
      const reflection = await this.reflectionClient.fetchReflectionRoot({
        address: targetCheck.normalized,
        timeoutMs,
        serviceNames: request.serviceNames,
        tlsMode: request.target.tlsMode,
        tlsConfig: request.target.tlsConfig,
      });
      return finalizeDescriptorFromRoot(
        reflection.root,
        'reflection',
        targetCheck.normalized,
        { reflectionVersion: reflection.reflectionVersion },
      );
    } catch (error) {
      if (error instanceof DescriptorLoaderError) {
        throw error;
      }

      const classified = classifyGrpcTransportFailure(error);
      if (classified.details.tlsFailure) {
        throw new DescriptorLoaderError(
          `Could not reach ${targetCheck.normalized}: ${classified.message}`,
          'unreachable',
          classified.details,
        );
      }

      if (isUnreachableError(error)) {
        throw new DescriptorLoaderError(
          `Could not reach ${targetCheck.normalized}: ${classified.message}`,
          'unreachable',
          Object.keys(classified.details).length > 0 ? classified.details : undefined,
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      if (isNoMatchingServicesError(error)) {
        throw new DescriptorLoaderError(message, 'reflection_failed');
      }
      if (error instanceof ReflectionFetchError) {
        throw new DescriptorLoaderError(error.message, 'reflection_failed');
      }
      throw new DescriptorLoaderError(
        isReflectionUnavailableError(error)
          ? `Server reflection is not enabled on this target: ${message}`
          : `Server reflection failed: ${message}`,
        'reflection_failed',
      );
    }
  }

  async loadFromDescribe(request: GrpcDescribeRequest): Promise<GrpcDescriptor> {
    if (request.source === 'proto_files' || request.source === 'protoset') {
      const cached = tryDescribeCacheHit(request);
      if (cached) {
        return cached;
      }
    }

    try {
      if (request.source === 'url_proto') {
        const url = request.url?.trim() ?? '';
        const lookup = buildDescribeCacheLookup(request);
        const cached = lookup ? findDescriptorCacheEntry(lookup) : undefined;
        const fetched = await fetchProtoFromUrl(url, {
          ifNoneMatch: cached?.fingerprint.etag,
        });
        if (fetched.notModified && cached) {
          setGrpcDescriptor(cached.descriptor);
          if (cached.root) {
            setDescriptorRootCache(cached.descriptor.key, cached.root);
          }
          return cached.descriptor;
        }
        const root = parseProtoFiles([{ path: fetched.protoPath, content: fetched.content }]);
        return finalizeDescriptorFromRoot(root, 'url_proto', fetched.resolvedUrl, {
          fingerprintExtras: { etag: fetched.etag },
        });
      }

      if (request.source === 'bsr') {
        const lookup = buildDescribeCacheLookup(request);
        const cached = lookup ? findDescriptorCacheEntry(lookup) : undefined;
        const fetched = await fetchBsrDescriptorSet({
          module: request.bsrModule?.trim() ?? '',
          version: request.bsrVersion,
          digest: request.bsrDigest,
          token: request.bsrToken,
        });
        if (
          cached
          && fetched.digest
          && cached.fingerprint.bsrDigest
          && cached.fingerprint.bsrDigest === fetched.digest
        ) {
          setGrpcDescriptor(cached.descriptor);
          if (cached.root) {
            setDescriptorRootCache(cached.descriptor.key, cached.root);
          }
          return cached.descriptor;
        }
        const root = parseProtosetBase64(fetched.protosetBase64);
        const bsrSourceRef = buildBsrDescriptorSourceRef(fetched.module.fullName, fetched.version);
        return finalizeDescriptorFromRoot(root, 'bsr', bsrSourceRef, {
          fingerprintExtras: {
            bsrModule: fetched.module.fullName,
            bsrDigest: fetched.digest,
          },
        });
      }

      const root = parseDescribeRequestSource(request);
      const sourceRef = request.source === 'proto_files'
        ? buildProtoFilesSourceRefFromDescribeRequest(request)
        : shortContentHash(request.protosetBase64?.trim() ?? '');
      return finalizeDescriptorFromRoot(root, request.source, sourceRef);
    } catch (error) {
      if (error instanceof DescriptorLoaderError) {
        throw error;
      }
      if (error instanceof ProtoImportResolutionError) {
        throw new DescriptorLoaderError(error.message, 'import_resolution_failed');
      }
      if (error instanceof ProtoFetchGatewayError || error instanceof BsrFetchGatewayError) {
        throw new DescriptorLoaderError(error.message, 'describe_failed');
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new DescriptorLoaderError(
        `Failed to parse ${request.source} source: ${message}`,
        message.includes('No gRPC services') ? 'invalid_descriptor' : 'describe_failed',
      );
    }
  }
}

export const descriptorLoader = new DescriptorLoader();

/** Test helper — compare normalized signatures across describe sources. */
export function descriptorsHaveEquivalentSignatures(
  left: GrpcDescriptor,
  right: GrpcDescriptor,
): boolean {
  return descriptorServiceSignatures(left) === descriptorServiceSignatures(right);
}
