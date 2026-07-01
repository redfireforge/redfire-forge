/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { FIXTURE_DESCRIBE_REQUEST, FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import { DescriptorLoader } from './descriptorLoader.js';
import {
  buildDescribeCacheLookup,
  clearDescriptorCacheManager,
  findDescriptorCacheEntry,
  invalidateDescriptorCacheBySourceRef,
  putDescriptorCacheEntry,
} from './descriptorCacheManager.js';
import { clearGrpcDescriptorStore } from './descriptorStore.js';
import { getGrpcDescriptor, setGrpcDescriptor } from './descriptorStore.js';
import { getDescriptorRootCache, setDescriptorRootCache } from './descriptorRootCache.js';

describe('descriptorCacheManager', () => {
  beforeEach(() => {
    clearDescriptorCacheManager();
    clearGrpcDescriptorStore();
  });

  it('stores and retrieves entries by sourceRef', async () => {
    const loader = new DescriptorLoader();
    const descriptor = await loader.loadFromDescribe(FIXTURE_DESCRIBE_REQUEST);
    const fingerprint = descriptor.sourceFingerprint!;

    const hit = findDescriptorCacheEntry({
      source: 'proto_files',
      sourceRef: fingerprint.sourceRef,
    });
    expect(hit?.descriptor.key).toBe(descriptor.key);
  });

  it('returns undefined on sourceRef miss', () => {
    expect(findDescriptorCacheEntry({
      source: 'url_proto',
      sourceRef: 'https://example.com/missing.proto',
    })).toBeUndefined();
  });

  it('buildDescribeCacheLookup normalizes BSR module aliases', () => {
    const canonical = buildDescribeCacheLookup({
      source: 'bsr',
      bsrModule: 'buf.build/acme/echo',
      bsrVersion: 'main',
    });
    const alias = buildDescribeCacheLookup({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });
    expect(canonical?.sourceRef).toBe('buf.build/acme/echo@main');
    expect(alias?.sourceRef).toBe(canonical?.sourceRef);
  });

  it('buildDescribeCacheLookup separates BSR versions', () => {
    const main = buildDescribeCacheLookup({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'main',
    });
    const tagged = buildDescribeCacheLookup({
      source: 'bsr',
      bsrModule: 'acme/echo',
      bsrVersion: 'v1.2.0',
    });
    expect(main?.sourceRef).not.toBe(tagged?.sourceRef);
  });

  it('buildDescribeCacheLookup separates proto_files importPaths', () => {
    const files = [{ path: 'api.proto', content: 'syntax = "proto3";' }];
    const withVendor = buildDescribeCacheLookup({
      source: 'proto_files',
      protoFiles: files,
      importPaths: ['vendor'],
    });
    const withOther = buildDescribeCacheLookup({
      source: 'proto_files',
      protoFiles: files,
      importPaths: ['other'],
    });
    expect(withVendor?.sourceRef).not.toBe(withOther?.sourceRef);
  });

  it('buildDescribeCacheLookup canonicalizes URL strings', () => {
    const lookup = buildDescribeCacheLookup({
      source: 'url_proto',
      url: 'https://example.com/schemas/echo.proto',
    });
    expect(lookup?.sourceRef).toBe('https://example.com/schemas/echo.proto');
  });

  it('replaces prior cache entry for the same sourceRef on put', () => {
    const sourceRef = 'buf.build/acme/echo@main';
    const older = {
      ...FIXTURE_DESCRIPTOR,
      key: 'bsr:older',
      source: 'bsr' as const,
      sourceRef,
    };
    const newer = {
      ...FIXTURE_DESCRIPTOR,
      key: 'bsr:newer',
      source: 'bsr' as const,
      sourceRef,
    };
    putDescriptorCacheEntry({
      descriptor: older,
      fingerprint: {
        source: 'bsr',
        sourceRef,
        contentSha256: older.contentSha256!,
        resolvedAt: '2020-01-01T00:00:00.000Z',
      },
      storedAt: '2020-01-01T00:00:00.000Z',
    });
    putDescriptorCacheEntry({
      descriptor: newer,
      fingerprint: {
        source: 'bsr',
        sourceRef,
        contentSha256: newer.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });

    const hit = findDescriptorCacheEntry({ source: 'bsr', sourceRef });
    expect(hit?.descriptor.key).toBe('bsr:newer');
  });

  it('invalidates descriptor root cache when sourceRef entries are removed', () => {
    const sourceRef = 'buf.build/acme/echo@main';
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'bsr:root-cache',
      source: 'bsr' as const,
      sourceRef,
    };
    setDescriptorRootCache(descriptor.key, {} as never);
    putDescriptorCacheEntry({
      descriptor,
      fingerprint: {
        source: 'bsr',
        sourceRef,
        contentSha256: descriptor.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });

    invalidateDescriptorCacheBySourceRef('bsr', sourceRef);
    expect(getDescriptorRootCache(descriptor.key)).toBeUndefined();
    expect(getGrpcDescriptor(descriptor.key)).toBeUndefined();
  });

  it('preserves grpc store and root cache when put reuses the same descriptor key', () => {
    const sourceRef = 'localhost:50051';
    const descriptor = {
      ...FIXTURE_DESCRIPTOR,
      key: 'reflection:localhost:50051:abc',
      source: 'reflection' as const,
      sourceRef,
    };
    const root = {} as never;
    setGrpcDescriptor(descriptor);
    setDescriptorRootCache(descriptor.key, root);
    putDescriptorCacheEntry({
      descriptor,
      fingerprint: {
        source: 'reflection',
        sourceRef,
        contentSha256: descriptor.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
        reflectionVersion: 'v1',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
      root,
    });

    expect(getGrpcDescriptor(descriptor.key)).toEqual(descriptor);
    expect(getDescriptorRootCache(descriptor.key)).toBe(root);
    expect(findDescriptorCacheEntry({ source: 'reflection', sourceRef })?.descriptor.key).toBe(descriptor.key);
  });
});
