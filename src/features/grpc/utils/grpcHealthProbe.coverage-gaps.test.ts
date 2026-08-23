import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import { postGrpcCall } from '@shared/grpc/grpcApiClient';
import { releaseCompletedGrpcCall } from '../hooks/grpcStudioSessionHelpers';
import {
  descriptorHasHealthWatch,
  descriptorHasHealthService,
  executeGrpcHealthProbe,
  findGrpcHealthService,
  formatGrpcHealthStatusLabel,
  GRPC_HEALTH_CHECK_METHOD,
  GRPC_HEALTH_WATCH_METHOD,
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

const baseResolution = {
  target: 'localhost:50051',
  targetValidation: { valid: true, normalized: 'localhost:50051' },
  tlsMode: 'disabled' as const,
  connectionId: undefined,
};

describe('grpcHealthProbe coverage gaps', () => {
  it('descriptorHasHealthService is false without Check method and true with it', () => {
    const withoutCheck = {
      ...FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      services: FIXTURE_MULTI_SERVICE_DESCRIPTOR.services.map((svc) => (
        svc.fullName === 'health.v1.Health'
          ? { ...svc, methods: svc.methods.filter((m) => m.name !== GRPC_HEALTH_CHECK_METHOD) }
          : svc
      )),
    };
    expect(descriptorHasHealthService(withoutCheck)).toBe(false);
    expect(descriptorHasHealthService(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(true);
    expect(descriptorHasHealthWatch(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(true);
    expect(GRPC_HEALTH_WATCH_METHOD).toBe('Watch');
  });

  beforeEach(() => {
    vi.mocked(postGrpcCall).mockReset();
  });

  it('findGrpcHealthService returns health service metadata', () => {
    const service = findGrpcHealthService(FIXTURE_MULTI_SERVICE_DESCRIPTOR);
    expect(service?.fullName).toBe('health.v1.Health');
    expect(findGrpcHealthService(undefined)).toBeUndefined();
  });

  it('descriptorHasHealthWatch is false without Watch method', () => {
    const descriptor = {
      ...FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      services: FIXTURE_MULTI_SERVICE_DESCRIPTOR.services.map((svc) => (
        svc.fullName === 'health.v1.Health'
          ? { ...svc, methods: svc.methods.filter((m) => m.name !== 'Watch') }
          : svc
      )),
    };
    expect(descriptorHasHealthWatch(descriptor)).toBe(false);
  });

  it('formatGrpcHealthStatusLabel falls back to SERVING and statusMessage', () => {
    expect(formatGrpcHealthStatusLabel({
      callType: 'unary',
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: {},
      durationMs: 1,
    })).toBe('SERVING');
    expect(formatGrpcHealthStatusLabel({
      callType: 'unary',
      status: 14,
      statusMessage: 'UNAVAILABLE',
      headers: {},
      trailers: {},
      body: {},
      durationMs: 1,
    })).toBe('UNAVAILABLE');
    expect(formatGrpcHealthStatusLabel({
      callType: 'unary',
      status: 5,
      statusMessage: '',
      headers: {},
      trailers: {},
      body: {},
      durationMs: 1,
    })).toBe('gRPC 5');
  });

  it('executeGrpcHealthProbe rejects invalid target', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: {
        ...baseResolution,
        targetValidation: { valid: false, reason: 'bad host' },
      },
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result).toEqual({ ok: false, error: 'bad host' });
  });

  it('executeGrpcHealthProbe rejects incomplete auth', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: { type: 'bearer', bearerToken: '' },
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Bearer token/i);
    }
  });

  it('executeGrpcHealthProbe rejects invalid metadata entries', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: { ' bad key ': 'value' },
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/metadata/i);
    }
  });

  it('executeGrpcHealthProbe maps GrpcApiClientError and generic failures', async () => {
    vi.mocked(postGrpcCall).mockRejectedValueOnce(new (await import('../../../shared/grpc/grpcApiClient')).GrpcApiClientError('call', 'probe failed'));
    const apiError = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: 'orders',
    });
    expect(apiError).toEqual({ ok: false, error: 'probe failed' });

    vi.mocked(postGrpcCall).mockRejectedValueOnce('unexpected');
    const generic = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: 'orders',
    });
    expect(generic).toEqual({ ok: false, error: 'Health check failed' });
    expect(releaseCompletedGrpcCall).toHaveBeenCalled();
  });

  it('executeGrpcHealthProbe passes auth clone when auth is configured', async () => {
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
        durationMs: 3,
      },
    });

    const auth = { type: 'bearer' as const, bearerToken: 'health-token' };
    await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: 'orders',
    });

    expect(postGrpcCall).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { type: 'bearer', bearerToken: 'health-token' } }),
      'tab-1',
    );
  });

  it('executeGrpcHealthProbe uses generic invalid target fallback when reason is absent', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: {
        ...baseResolution,
        targetValidation: { valid: false },
      },
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result).toEqual({ ok: false, error: 'Invalid target address.' });
  });

  it('descriptorHasHealthWatch is true when Watch method exists', () => {
    expect(descriptorHasHealthWatch(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(true);
  });

  it('executeGrpcHealthProbe returns formatted success label from body status', async () => {
    vi.mocked(postGrpcCall).mockResolvedValueOnce({
      ok: true,
      op: 'call',
      data: {
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { status: 'NOT_SERVING' },
        durationMs: 2,
      },
    });

    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(formatGrpcHealthStatusLabel(result.result)).toBe('NOT_SERVING');
    }
  });

  it('formatGrpcHealthStatusLabel prefers body.status string', () => {
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

  it('executeGrpcHealthProbe rejects empty descriptor key', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: '   ',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result).toEqual({ ok: false, error: 'Reflect services first — descriptor key is required.' });
  });

  it('executeGrpcHealthProbe rejects invalid TLS configuration', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: { ...baseResolution, tlsMode: 'tls' },
      tlsConfig: { serverCaPem: 'not-a-pem' },
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('executeGrpcHealthProbe rejects invalid metadata', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: { 'payload-bin': 'not!!!base64' },
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('descriptorHasHealthService is true when Check method exists', () => {
    expect(descriptorHasHealthService(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(true);
    expect(descriptorHasHealthService(undefined)).toBe(false);
  });

  it('descriptorHasHealthService is false when Check method is missing', () => {
    const descriptor = {
      ...FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      services: FIXTURE_MULTI_SERVICE_DESCRIPTOR.services.map((svc) => (
        svc.fullName === 'health.v1.Health'
          ? { ...svc, methods: svc.methods.filter((method) => method.name !== 'Check') }
          : svc
      )),
    };
    expect(descriptorHasHealthService(descriptor)).toBe(false);
  });

  it('executeGrpcHealthProbe omits auth clone when auth is undefined', async () => {
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
        durationMs: 3,
      },
    });

    await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });

    expect(postGrpcCall).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined }),
      'tab-1',
    );
  });

  it('executeGrpcHealthProbe uses default invalid target message when reason missing', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: {
        ...baseResolution,
        targetValidation: { valid: false },
      },
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result).toEqual({ ok: false, error: 'Invalid target address.' });
  });

  it('executeGrpcHealthProbe passes compression and clones metadata for successful probe', async () => {
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
        durationMs: 3,
      },
    });

    await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: { 'x-custom': '1' },
      auth: undefined,
      compression: { request: 'gzip', response: 'identity' },
      timeoutMs: 5000,
      serviceName: 'orders',
    });

    expect(postGrpcCall).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { service: 'orders' },
        metadata: expect.objectContaining({ 'x-custom': '1' }),
      }),
      'tab-1',
    );
  });

  it('executeGrpcHealthProbe trims service name in request body', async () => {
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
        durationMs: 1,
      },
    });

    await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '  orders  ',
    });

    expect(postGrpcCall).toHaveBeenCalledWith(
      expect.objectContaining({ body: { service: 'orders' } }),
      'tab-1',
    );
  });

  it('executeGrpcHealthProbe falls back when crypto.randomUUID is unavailable', async () => {
    const originalRandomUUID = globalThis.crypto.randomUUID;
    // @ts-expect-error — simulate environments without randomUUID
    globalThis.crypto.randomUUID = undefined;
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
        durationMs: 1,
      },
    });

    await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: undefined,
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });

    expect(postGrpcCall).toHaveBeenCalled();
    expect(releaseCompletedGrpcCall).toHaveBeenCalledWith(
      expect.stringMatching(/^req-health-/),
      'tab-1',
      { transportMode: 'express' },
    );
    globalThis.crypto.randomUUID = originalRandomUUID;
  });

  it('descriptorHasHealthWatch is false without a health service', () => {
    expect(descriptorHasHealthWatch({
      key: 'k',
      services: [],
      messages: [],
      enums: [],
    })).toBe(false);
  });

  it('findGrpcHealthService returns undefined when health service is absent', () => {
    expect(findGrpcHealthService({
      key: 'k',
      services: [],
      messages: [],
      enums: [],
    })).toBeUndefined();
  });

  it('executeGrpcHealthProbe uses auth issue message when present', async () => {
    const result = await executeGrpcHealthProbe({
      tabId: 'tab-1',
      descriptorKey: 'key',
      resolution: baseResolution,
      tlsConfig: undefined,
      metadata: {},
      auth: { type: 'basic', basicUsername: '', basicPassword: '' },
      compression: undefined,
      timeoutMs: 5000,
      serviceName: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
