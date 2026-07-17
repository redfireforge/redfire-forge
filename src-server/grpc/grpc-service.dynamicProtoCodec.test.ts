/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_UNARY_CALL_REQUEST } from '../../src/shared/grpc/contractFixtures.js';
import { clearDynamicProtoCodecCache } from '../grpc/dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from '../grpc/descriptorStore.js';
import { clearDescriptorCacheManager } from '../grpc/descriptorCacheManager.js';
import { GrpcService } from '../grpc/grpc-service.js';
import type { GrpcClientPort } from '../grpc/grpcClient.js';

describe('dynamicProtoCodec integration', () => {
  beforeEach(() => {
    clearDynamicProtoCodecCache();
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  it('round-trips echo request/response schemas', async () => {
    const mockClient: GrpcClientPort = {
      probeReachability: vi.fn(),
      invokeUnary: vi.fn(async ({ requestBuffer, decodeResponse }) => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: decodeResponse(requestBuffer),
      })),
    };
    const service = new GrpcService(mockClient);
    const envelope = await service.call(FIXTURE_UNARY_CALL_REQUEST);
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.body).toEqual({ message: 'hello grpc' });
    }
  });
});

