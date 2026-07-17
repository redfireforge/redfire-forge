import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import { postGrpcCall } from '../../../shared/grpc/grpcApiClient';
import { releaseCompletedGrpcCall } from '../hooks/grpcStudioSessionHelpers';
import {
  descriptorHasHealthService,
  descriptorHasHealthWatch,
  executeGrpcHealthProbe,
  formatGrpcHealthStatusLabel,
} from './grpcHealthProbe';

vi.mock('../../../shared/grpc/grpcApiClient', () => ({
  postGrpcCall: vi.fn(),
  GrpcApiClientError: class extends Error {
    constructor(_op: string, message: string) {
      super(message);
      this.name = 'GrpcApiClientError';
    }
  },
}));

vi.mock('../hooks/grpcStudioSessionHelpers', () => ({
  releaseCompletedGrpcCall: vi.fn(),
}));

describe('grpcHealthProbe (Phase 4J-D)', () => {
  beforeEach(() => {
    vi.mocked(postGrpcCall).mockReset();
  });

  it('descriptorHasHealthService requires Check method', () => {
    expect(descriptorHasHealthService(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(true);
    expect(descriptorHasHealthService(undefined)).toBe(false);
    expect(descriptorHasHealthWatch(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(true);
  });

  it('formatGrpcHealthStatusLabel prefers body status', () => {
    expect(formatGrpcHealthStatusLabel({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { status: 'NOT_SERVING' },
      durationMs: 1,
    })).toBe('NOT_SERVING');
  });

  it('executeGrpcHealthProbe posts unary health check', async () => {
    vi.mocked(postGrpcCall).mockResolvedValueOnce({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { status: 'SERVING' },
        durationMs: 8,
      },
    });

    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'desc-key',
      resolution: {
        target: 'localhost:50051',
        targetValidation: { valid: true, normalized: 'localhost:50051' },
        tlsMode: 'disabled',
        connectionId: undefined,
      },
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: { enabled: true, algorithm: 'gzip' },
      timeoutMs: 5000,
      serviceName: 'orders',
    });

    expect(result.ok).toBe(true);
    expect(postGrpcCall).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'health.v1.Health',
        method: 'Check',
        body: { service: 'orders' },
        metadata: expect.objectContaining({ 'grpc-encoding': 'gzip' }),
      }),
      'tab-1',
    );
    expect(releaseCompletedGrpcCall).toHaveBeenCalledWith(
      expect.any(String),
      'tab-1',
      { transportMode: 'express' },
    );
  });

  it('executeGrpcHealthProbe rejects invalid metadata', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'desc-key',
      resolution: {
        target: 'localhost:50051',
        targetValidation: { valid: true, normalized: 'localhost:50051' },
        tlsMode: 'disabled',
        connectionId: undefined,
      },
      tlsConfig: undefined,
      metadata: { 'bad key!': 'value' },
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/metadata/i);
    }
    expect(postGrpcCall).not.toHaveBeenCalled();
  });

  it('executeGrpcHealthProbe rejects invalid TLS configuration', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'desc-key',
      resolution: {
        target: 'localhost:50051',
        targetValidation: { valid: true, normalized: 'localhost:50051' },
        tlsMode: 'mtls',
        connectionId: undefined,
      },
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/TLS|client cert|PEM/i);
    }
    expect(postGrpcCall).not.toHaveBeenCalled();
  });

  it('executeGrpcHealthProbe rejects missing descriptor key', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: '',
      resolution: {
        target: 'localhost:50051',
        targetValidation: { valid: true, normalized: 'localhost:50051' },
        tlsMode: 'disabled',
        connectionId: undefined,
      },
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/descriptor key/i);
    }
  });
});
