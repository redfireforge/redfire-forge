/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR } from '../../src/shared/grpc/contractFixtures.js';
import {
  clearGrpcDescriptorStore,
  deleteGrpcDescriptor,
  getGrpcDescriptor,
  hasGrpcDescriptor,
  setGrpcDescriptor,
} from './descriptorStore.js';

describe('descriptorStore coverage gaps', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
  });

  it('hasGrpcDescriptor reports store membership', () => {
    expect(hasGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toBe(false);
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    expect(hasGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toBe(true);
  });

  it('getGrpcDescriptor returns stored descriptor', () => {
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    expect(getGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toEqual(FIXTURE_DESCRIPTOR);
  });

  it('deleteGrpcDescriptor removes stored descriptor', () => {
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    expect(deleteGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toBe(true);
    expect(getGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toBeUndefined();
  });

  it('deleteGrpcDescriptor returns false for missing keys', () => {
    expect(deleteGrpcDescriptor('missing-key')).toBe(false);
  });
});
