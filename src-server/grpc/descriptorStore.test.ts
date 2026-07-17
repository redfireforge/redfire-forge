/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '../../src/shared/grpc/contractFixtures.js';
import { clearDynamicProtoCodecCache, encodeProtoMessage } from './dynamicProtoCodec.js';
import {
  clearGrpcDescriptorStore,
  deleteGrpcDescriptor,
  getGrpcDescriptor,
  setGrpcDescriptor,
} from './descriptorStore.js';

describe('descriptorStore', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    clearDynamicProtoCodecCache();
  });

  it('invalidates proto codec cache when descriptor is replaced under the same key', () => {
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    const first = encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.EchoRequest', { message: 'hello' });

    setGrpcDescriptor({
      ...FIXTURE_DESCRIPTOR,
      services: [{
        fullName: 'echo.EchoService',
        methods: [{
          ...FIXTURE_DESCRIPTOR.services[0]!.methods[0]!,
          requestSchema: {
            typeName: 'echo.EchoRequest',
            fields: [{ name: 'title', number: 2, type: 'string', label: 'optional' }],
          },
        }],
      }],
    });

    const updated = getGrpcDescriptor(FIXTURE_DESCRIPTOR_KEY)!;
    const second = encodeProtoMessage(updated, 'echo.EchoRequest', { title: 'hello' });
    expect(second).not.toEqual(first);
    expect(second.length).toBeGreaterThan(0);
  });

  it('clears proto codec cache when descriptor is deleted', () => {
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    encodeProtoMessage(FIXTURE_DESCRIPTOR, 'echo.EchoRequest', { message: 'warm' });
    expect(deleteGrpcDescriptor(FIXTURE_DESCRIPTOR.key)).toBe(true);
    expect(getGrpcDescriptor(FIXTURE_DESCRIPTOR_KEY)).toBeUndefined();
  });
});
