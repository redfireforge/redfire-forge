/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import {
  buildDescribeCacheLookup,
  buildProtoFilesSourceRef,
  buildProtoFilesSourceRefFromDescribeRequest,
  clearDescriptorCacheManager,
  findDescriptorCacheEntry,
  getDescriptorCacheEntry,
  invalidateDescriptorCacheBySourceRef,
  putDescriptorCacheEntry,
} from './descriptorCacheManager.js';

describe('descriptorCacheManager coverage gaps', () => {
  beforeEach(() => {
    clearDescriptorCacheManager();
  });

  it('buildDescribeCacheLookup returns null for empty url or bsr module', () => {
    expect(buildDescribeCacheLookup({ source: 'url_proto', url: '   ' })).toBeNull();
    expect(buildDescribeCacheLookup({ source: 'bsr', bsrModule: '' })).toBeNull();
    expect(buildDescribeCacheLookup({ source: 'reflection' } as never)).toBeNull();
  });

  it('buildDescribeCacheLookup returns null for invalid url_proto URLs', () => {
    expect(buildDescribeCacheLookup({ source: 'url_proto', url: 'ftp://bad.example/proto' })).toBeNull();
  });

  it('buildDescribeCacheLookup falls back to raw bsr module when parse fails', () => {
    const lookup = buildDescribeCacheLookup({
      source: 'bsr',
      bsrModule: 'invalid-only',
      bsrVersion: 'main',
    });
    expect(lookup?.sourceRef).toBe('invalid-only@main');
  });

  it('buildProtoFilesSourceRef ignores blank import path entries', () => {
    const files = [{ path: 'a.proto', content: 'syntax = "proto3";' }];
    expect(buildProtoFilesSourceRef(files, ['', '  '])).toBe(buildProtoFilesSourceRef(files, []));
  });

  it('buildProtoFilesSourceRef hashes proto files and import paths', () => {
    const files = [{ path: 'a.proto', content: 'syntax = "proto3";' }];
    const ref = buildProtoFilesSourceRef(files, ['vendor']);
    expect(ref).toHaveLength(16);
    expect(ref).not.toBe(buildProtoFilesSourceRef(files, ['other']));
  });

  it('findDescriptorCacheEntry filters by etag and bsrDigest mismatches', () => {
    const sourceRef = 'buf.build/acme/echo@main';
    putDescriptorCacheEntry({
      descriptor: { ...FIXTURE_DESCRIPTOR, key: 'bsr:one', source: 'bsr', sourceRef },
      fingerprint: {
        source: 'bsr',
        sourceRef,
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
        etag: 'etag-a',
        bsrDigest: 'digest-a',
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(findDescriptorCacheEntry({ source: 'bsr', sourceRef, etag: 'etag-b' })).toBeUndefined();
    expect(findDescriptorCacheEntry({ source: 'bsr', sourceRef, bsrDigest: 'digest-b' })).toBeUndefined();
    expect(findDescriptorCacheEntry({ source: 'bsr', sourceRef, etag: 'etag-a' })?.descriptor.key).toBe('bsr:one');
  });

  it('findDescriptorCacheEntry rejects incompatible expected fingerprints', () => {
    const sourceRef = 'hash-ref';
    putDescriptorCacheEntry({
      descriptor: { ...FIXTURE_DESCRIPTOR, key: 'proto:one', source: 'proto_files', sourceRef },
      fingerprint: {
        source: 'proto_files',
        sourceRef,
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(findDescriptorCacheEntry(
      { source: 'proto_files', sourceRef },
      { contentSha256: 'different-hash-value' },
    )).toBeUndefined();
  });

  it('getDescriptorCacheEntry returns stored entry by key', () => {
    putDescriptorCacheEntry({
      descriptor: FIXTURE_DESCRIPTOR,
      fingerprint: FIXTURE_DESCRIPTOR.sourceFingerprint!,
      storedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(getDescriptorCacheEntry(FIXTURE_DESCRIPTOR.key)?.descriptor.key).toBe(FIXTURE_DESCRIPTOR.key);
  });

  it('invalidateDescriptorCacheBySourceRef preserves specified key', () => {
    const sourceRef = 'preserve-test';
    putDescriptorCacheEntry({
      descriptor: { ...FIXTURE_DESCRIPTOR, key: 'keep-me', source: 'proto_files', sourceRef },
      fingerprint: {
        source: 'proto_files',
        sourceRef,
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });

    const removed = invalidateDescriptorCacheBySourceRef('proto_files', sourceRef, 'keep-me');
    expect(removed).toBe(0);
    expect(getDescriptorCacheEntry('keep-me')).toBeDefined();
  });

  it('invalidateDescriptorCacheBySourceRef returns zero for unknown sourceRef', () => {
    expect(invalidateDescriptorCacheBySourceRef('bsr', 'missing@main')).toBe(0);
  });

  it('findDescriptorCacheEntry returns the newest candidate when multiple entries match', () => {
    const sourceRef = 'multi-hit';
    putDescriptorCacheEntry({
      descriptor: { ...FIXTURE_DESCRIPTOR, key: 'older', source: 'proto_files', sourceRef },
      fingerprint: {
        source: 'proto_files',
        sourceRef,
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });
    putDescriptorCacheEntry({
      descriptor: { ...FIXTURE_DESCRIPTOR, key: 'newer', source: 'proto_files', sourceRef },
      fingerprint: {
        source: 'proto_files',
        sourceRef,
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
        resolvedAt: '2026-01-02T00:00:00.000Z',
      },
      storedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(findDescriptorCacheEntry({ source: 'proto_files', sourceRef })?.descriptor.key).toBe('newer');
  });

  it('invalidateDescriptorCacheBySourceRef removes stale entries and clears codec cache', () => {
    const sourceRef = 'remove-me';
    putDescriptorCacheEntry({
      descriptor: { ...FIXTURE_DESCRIPTOR, key: 'gone', source: 'proto_files', sourceRef },
      fingerprint: {
        source: 'proto_files',
        sourceRef,
        contentSha256: FIXTURE_DESCRIPTOR.contentSha256!,
        resolvedAt: '2026-01-01T00:00:00.000Z',
      },
      storedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(invalidateDescriptorCacheBySourceRef('proto_files', sourceRef)).toBe(1);
    expect(getDescriptorCacheEntry('gone')).toBeUndefined();
  });

  it('buildDescribeCacheLookup supports protoset and url_proto sources', () => {
    expect(buildDescribeCacheLookup({
      source: 'protoset',
      protosetBase64: 'abc123',
    })).toEqual({
      source: 'protoset',
      sourceRef: expect.any(String),
    });
    expect(buildDescribeCacheLookup({
      source: 'url_proto',
      url: 'https://example.com/echo.proto',
    })?.sourceRef).toContain('example.com');
  });

  it('buildProtoFilesSourceRef sorts files and import paths canonically', () => {
    const ref = buildProtoFilesSourceRef([
      { path: 'b.proto', content: 'syntax = "proto3";' },
      { path: 'a.proto', content: 'syntax = "proto3";' },
    ], ['vendor', 'shared']);
    expect(ref).toBe(buildProtoFilesSourceRef([
      { path: 'a.proto', content: 'syntax = "proto3";' },
      { path: 'b.proto', content: 'syntax = "proto3";' },
    ], ['shared', 'vendor']));
  });

  it('buildProtoFilesSourceRefFromDescribeRequest canonicalizes protoRoots payloads', () => {
    const fromRootsA = buildProtoFilesSourceRefFromDescribeRequest({
      protoRoots: [
        {
          id: 'r2',
          mountPath: 'api',
          files: [{ path: 'service.proto', content: 'syntax = "proto3";' }],
        },
        {
          id: 'r1',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
      ],
    });
    const fromRootsB = buildProtoFilesSourceRefFromDescribeRequest({
      protoRoots: [
        {
          id: 'r1',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
        {
          id: 'r2',
          mountPath: 'api',
          files: [{ path: 'service.proto', content: 'syntax = "proto3";' }],
        },
      ],
    });
    expect(fromRootsA).toBe(fromRootsB);
  });

  it('buildDescribeCacheLookup hashes protoRoots payload for proto_files source', () => {
    const lookup = buildDescribeCacheLookup({
      source: 'proto_files',
      protoRoots: [
        {
          id: 'root-shared',
          mountPath: 'shared',
          files: [{ path: 'common.proto', content: 'syntax = "proto3";' }],
        },
      ],
    });
    expect(lookup).toEqual({ source: 'proto_files', sourceRef: expect.any(String) });
    expect(lookup?.sourceRef).toHaveLength(16);
  });
});
