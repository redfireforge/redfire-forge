/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  buildDescriptorKey,
  computeDescriptorContentHash,
  sha256Hex,
} from './descriptorKey.js';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';

describe('descriptorKey coverage gaps', () => {
  it('builds proto_files and protoset keys without sourceRef', () => {
    expect(buildDescriptorKey('proto_files', 'hash123')).toBe('proto_files:hash123');
    expect(buildDescriptorKey('protoset', 'hash456')).toBe('protoset:hash456');
  });

  it('uses unknown placeholder when reflection or bsr sourceRef is omitted', () => {
    expect(buildDescriptorKey('reflection', 'abc')).toBe('reflection:unknown:abc');
    expect(buildDescriptorKey('bsr', 'def')).toBe('bsr:unknown:def');
  });

  it('falls back to source-only key for unrecognized source values', () => {
    expect(buildDescriptorKey('legacy' as never, 'xyz')).toBe('legacy:xyz');
  });

  it('sha256Hex produces full-length hex digest', () => {
    expect(sha256Hex('test')).toHaveLength(64);
  });

  it('computeDescriptorContentHash treats missing sourceRef as null', () => {
    const hash = computeDescriptorContentHash({
      source: 'proto_files',
      services: FIXTURE_DESCRIPTOR.services,
    });
    expect(hash).toHaveLength(16);
  });
});
