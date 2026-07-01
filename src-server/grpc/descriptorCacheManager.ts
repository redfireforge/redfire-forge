/**
 * Phase 3F — content-hash keyed descriptor cache with source fingerprint augmentation.
 */
import type protobuf from 'protobufjs';
import type {
  GrpcDescriptor,
  GrpcDescriptorSource,
  GrpcDescriptorSourceFingerprint,
  GrpcDescribeRequest,
} from '../../src/shared/grpc/contracts.js';
import { areDescriptorFingerprintsCompatible } from '../../src/shared/grpc/descriptorSourcePolicy.js';
import { parseBsrModuleReference } from './bsrFetchGateway.js';
import { clearDynamicProtoCodecCache } from './dynamicProtoCodec.js';
import { clearDescriptorRootCache, deleteDescriptorRootCache } from './descriptorRootCache.js';
import { deleteGrpcDescriptor } from './descriptorStore.js';
import { validateProtoFetchUrl } from './protoFetchPolicy.js';
import { shortContentHash } from './descriptorKey.js';

export interface DescriptorCacheEntry {
  descriptor: GrpcDescriptor;
  fingerprint: GrpcDescriptorSourceFingerprint;
  storedAt: string;
  /** Original protobuf root — restored on cache hit for protoset export and wire encoding. */
  root?: protobuf.Root;
}

export interface DescriptorCacheLookup {
  source: GrpcDescriptorSource;
  sourceRef: string;
  etag?: string;
  bsrDigest?: string;
}

function canonicalProtoFilesHash(
  protoFiles: NonNullable<GrpcDescribeRequest['protoFiles']>,
  importPaths: string[] = [],
): string {
  const canonicalFiles = protoFiles
    .map((file) => ({ path: file.path.trim(), content: file.content.trim() }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const canonicalImportPaths = importPaths
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return shortContentHash(JSON.stringify({
    files: canonicalFiles,
    importPaths: canonicalImportPaths,
  }));
}

/** Canonical proto_files sourceRef — includes importPaths because they affect resolution. */
export function buildProtoFilesSourceRef(
  protoFiles: NonNullable<GrpcDescribeRequest['protoFiles']>,
  importPaths: string[] = [],
): string {
  return canonicalProtoFilesHash(protoFiles, importPaths);
}

/** Canonical cache lookup key for describe requests — must match descriptor `sourceRef` on store. */
export function buildDescribeCacheLookup(
  request: GrpcDescribeRequest,
): DescriptorCacheLookup | null {
  switch (request.source) {
    case 'proto_files':
      return {
        source: 'proto_files',
        sourceRef: canonicalProtoFilesHash(
          request.protoFiles ?? [],
          request.importPaths ?? [],
        ),
      };
    case 'protoset':
      return {
        source: 'protoset',
        sourceRef: shortContentHash(request.protosetBase64?.trim() ?? ''),
      };
    case 'url_proto': {
      const raw = request.url?.trim();
      if (!raw) return null;
      try {
        return {
          source: 'url_proto',
          sourceRef: validateProtoFetchUrl(raw).toString(),
        };
      } catch {
        return null;
      }
    }
    case 'bsr': {
      const raw = request.bsrModule?.trim();
      if (!raw) return null;
      const version = request.bsrVersion?.trim() || 'main';
      try {
        const module = parseBsrModuleReference(raw);
        return {
          source: 'bsr',
          sourceRef: buildBsrDescriptorSourceRef(module.fullName, version),
          bsrDigest: request.bsrDigest?.trim(),
        };
      } catch {
        return {
          source: 'bsr',
          sourceRef: buildBsrDescriptorSourceRef(raw, version),
          bsrDigest: request.bsrDigest?.trim(),
        };
      }
    }
    default:
      return null;
  }
}

export function buildBsrDescriptorSourceRef(moduleFullName: string, version: string): string {
  return `${moduleFullName}@${version}`;
}

const cacheByKey = new Map<string, DescriptorCacheEntry>();
const cacheBySourceRef = new Map<string, Set<string>>();

function sourceRefIndexKey(source: GrpcDescriptorSource, sourceRef: string): string {
  return `${source}:${sourceRef}`;
}

export function buildDescriptorCacheKey(descriptor: GrpcDescriptor): string {
  return descriptor.key;
}

export function putDescriptorCacheEntry(entry: DescriptorCacheEntry): void {
  const key = buildDescriptorCacheKey(entry.descriptor);
  invalidateDescriptorCacheBySourceRef(
    entry.descriptor.source,
    entry.fingerprint.sourceRef,
    key,
  );
  cacheByKey.set(key, entry);
  const indexKey = sourceRefIndexKey(entry.descriptor.source, entry.fingerprint.sourceRef);
  const keys = cacheBySourceRef.get(indexKey) ?? new Set<string>();
  keys.add(key);
  cacheBySourceRef.set(indexKey, keys);
  clearDynamicProtoCodecCache();
}

export function getDescriptorCacheEntry(key: string): DescriptorCacheEntry | undefined {
  return cacheByKey.get(key);
}

export function findDescriptorCacheEntry(
  lookup: DescriptorCacheLookup,
  expected?: Partial<GrpcDescriptorSourceFingerprint>,
): DescriptorCacheEntry | undefined {
  const indexKey = sourceRefIndexKey(lookup.source, lookup.sourceRef);
  const keys = cacheBySourceRef.get(indexKey);
  if (!keys?.size) {
    return undefined;
  }

  const candidates: DescriptorCacheEntry[] = [];
  for (const key of keys) {
    const entry = cacheByKey.get(key);
    if (!entry) continue;
    if (lookup.etag && entry.fingerprint.etag && entry.fingerprint.etag !== lookup.etag) {
      continue;
    }
    if (lookup.bsrDigest && entry.fingerprint.bsrDigest && entry.fingerprint.bsrDigest !== lookup.bsrDigest) {
      continue;
    }
    if (expected && !areDescriptorFingerprintsCompatible(entry.fingerprint, expected as GrpcDescriptorSourceFingerprint)) {
      continue;
    }
    candidates.push(entry);
  }
  if (!candidates.length) {
    return undefined;
  }
  return candidates.sort((a, b) => b.storedAt.localeCompare(a.storedAt))[0];
}

export function invalidateDescriptorCacheBySourceRef(
  source: GrpcDescriptorSource,
  sourceRef: string,
  preserveKey?: string,
): number {
  const indexKey = sourceRefIndexKey(source, sourceRef);
  const keys = cacheBySourceRef.get(indexKey);
  if (!keys?.size) {
    return 0;
  }
  let removed = 0;
  for (const key of [...keys]) {
    if (preserveKey && key === preserveKey) {
      continue;
    }
    if (cacheByKey.delete(key)) {
      deleteDescriptorRootCache(key);
      deleteGrpcDescriptor(key);
      removed += 1;
      keys.delete(key);
    }
  }
  if (keys.size === 0) {
    cacheBySourceRef.delete(indexKey);
  } else {
    cacheBySourceRef.set(indexKey, keys);
  }
  if (removed > 0) {
    clearDynamicProtoCodecCache();
  }
  return removed;
}

/** Test helper — clears descriptor cache manager state. */
export function clearDescriptorCacheManager(): void {
  cacheByKey.clear();
  cacheBySourceRef.clear();
  clearDescriptorRootCache();
  clearDynamicProtoCodecCache();
}
