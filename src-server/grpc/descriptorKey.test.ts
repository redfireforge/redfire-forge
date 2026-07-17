/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  buildDescriptorKey,
  buildReflectionDescriptorKey,
  computeDescriptorContentHash,
  shortContentHash,
} from './descriptorKey.js';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_CONTENT_SHA,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
} from '../../src/shared/grpc/contractFixtures.js';

describe('descriptorKey', () => {
  it('produces stable short hashes', () => {
    const first = shortContentHash('hello');
    const second = shortContentHash('hello');
    expect(first).toBe(second);
    expect(first).toHaveLength(16);
  });

  it('builds reflection keys with normalized address + content hash', () => {
    const hash = computeDescriptorContentHash(FIXTURE_DESCRIPTOR);
    expect(buildReflectionDescriptorKey('localhost:50051', hash)).toBe(
      `reflection:localhost:50051:${hash}`,
    );
  });

  it('changes hash when service signatures change', () => {
    const base = computeDescriptorContentHash(FIXTURE_DESCRIPTOR);
    const changed = computeDescriptorContentHash({
      ...FIXTURE_DESCRIPTOR,
      services: [{
        ...FIXTURE_DESCRIPTOR.services[0]!,
        methods: [{
          ...FIXTURE_DESCRIPTOR.services[0]!.methods[0]!,
          name: 'Ping',
        }],
      }],
    });
    expect(changed).not.toBe(base);
  });

  it('builds bsr and url_proto keys with sourceRef', () => {
    expect(buildDescriptorKey('bsr', 'abc123', 'buf.build/acme/echo')).toBe(
      'bsr:buf.build/acme/echo:abc123',
    );
    expect(buildDescriptorKey('url_proto', 'def456', 'https://example.com/echo.proto')).toBe(
      'url_proto:https://example.com/echo.proto:def456',
    );
  });

  it('FIXTURE_DESCRIPTOR key and contentSha256 stay aligned with computeDescriptorContentHash', () => {
    const computed = computeDescriptorContentHash(FIXTURE_DESCRIPTOR);
    expect(computed).toBe(FIXTURE_DESCRIPTOR_CONTENT_SHA);
    expect(FIXTURE_DESCRIPTOR.key).toBe(FIXTURE_DESCRIPTOR_KEY);
    expect(FIXTURE_DESCRIPTOR.key.endsWith(FIXTURE_DESCRIPTOR_CONTENT_SHA)).toBe(true);
    expect(FIXTURE_DESCRIPTOR.sourceFingerprint?.contentSha256).toBe(FIXTURE_DESCRIPTOR_CONTENT_SHA);
  });

  it('FIXTURE_MULTI_SERVICE_DESCRIPTOR key aligns with computed content hash', () => {
    const computed = computeDescriptorContentHash(FIXTURE_MULTI_SERVICE_DESCRIPTOR);
    expect(computed).toBe(FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA);
    expect(FIXTURE_MULTI_SERVICE_DESCRIPTOR.key).toBe(FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY);
    expect(FIXTURE_MULTI_SERVICE_DESCRIPTOR.sourceFingerprint?.contentSha256)
      .toBe(FIXTURE_MULTI_SERVICE_DESCRIPTOR_CONTENT_SHA);
  });
});
