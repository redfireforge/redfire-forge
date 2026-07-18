/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import protobuf from 'protobufjs';
import {
  clearDescriptorRootCache,
  deleteDescriptorRootCache,
  getDescriptorRootCache,
  setDescriptorRootCache,
} from './descriptorRootCache.js';

describe('descriptorRootCache', () => {
  beforeEach(() => {
    clearDescriptorRootCache();
  });

  it('stores and returns roots by descriptor key', () => {
    const root = new protobuf.Root();
    setDescriptorRootCache('demo-key', root);
    expect(getDescriptorRootCache('demo-key')).toBe(root);
  });

  it('returns undefined when key does not exist', () => {
    expect(getDescriptorRootCache('missing')).toBeUndefined();
  });

  it('deletes a cached root for a single key', () => {
    setDescriptorRootCache('demo-key', new protobuf.Root());
    deleteDescriptorRootCache('demo-key');
    expect(getDescriptorRootCache('demo-key')).toBeUndefined();
  });

  it('clears all cached roots', () => {
    setDescriptorRootCache('a', new protobuf.Root());
    setDescriptorRootCache('b', new protobuf.Root());
    clearDescriptorRootCache();
    expect(getDescriptorRootCache('a')).toBeUndefined();
    expect(getDescriptorRootCache('b')).toBeUndefined();
  });
});
