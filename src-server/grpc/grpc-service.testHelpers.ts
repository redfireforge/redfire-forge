import { vi } from 'vitest';
import type { GrpcClientPort } from '../grpc/grpcClient.js';

export function createMockGrpcClientPort(): GrpcClientPort {
  return {
    probeReachability: vi.fn(async () => ({
      reachable: true,
      latencyMs: 5,
    })),
    invokeUnary: vi.fn(async ({ decodeResponse, requestBuffer }) => ({
      status: 0,
      statusMessage: 'OK',
      headers: { 'content-type': 'application/grpc' },
      trailers: { 'grpc-status': '0' },
      body: decodeResponse(requestBuffer),
    })),
  };
}
