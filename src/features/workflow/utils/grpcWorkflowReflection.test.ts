/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { FIXTURE_DESCRIPTOR, FIXTURE_DESCRIPTOR_KEY } from '../../../shared/grpc/contractFixtures';
import {
  buildGrpcWorkflowReflectionPatch,
  listGrpcWorkflowMethods,
  reflectGrpcWorkflowTarget,
} from './grpcWorkflowReflection';

vi.mock('../../../shared/grpc/grpcApiClient', () => ({
  postGrpcReflect: vi.fn(),
}));

import { postGrpcReflect } from '../../../shared/grpc/grpcApiClient';

describe('grpcWorkflowReflection', () => {
  it('returns empty method list when descriptor or service is missing', () => {
    expect(listGrpcWorkflowMethods(null, 'echo.EchoService', 'unary')).toEqual([]);
    expect(listGrpcWorkflowMethods(FIXTURE_DESCRIPTOR, '', 'unary')).toEqual([]);
  });

  it('lists unary methods for a selected service', () => {
    const methods = listGrpcWorkflowMethods(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'unary');
    expect(methods.map((method) => method.name)).toContain('Echo');
  });

  it('filters server-streaming methods only when requested', () => {
    const methods = listGrpcWorkflowMethods(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'server_streaming');
    expect(methods.every((method) => method.callType === 'server_streaming')).toBe(true);
  });

  it('reflectGrpcWorkflowTarget calls the reflect API with normalized target', async () => {
    vi.mocked(postGrpcReflect).mockResolvedValueOnce({
      ok: true,
      data: FIXTURE_DESCRIPTOR,
    } as never);

    const descriptor = await reflectGrpcWorkflowTarget('localhost:50051');
    expect(descriptor.key).toBe(FIXTURE_DESCRIPTOR_KEY);
    expect(postGrpcReflect).toHaveBeenCalledWith(expect.objectContaining({
      target: { address: 'localhost:50051', tlsMode: 'disabled' },
    }));
  });

  it('reflectGrpcWorkflowTarget rejects invalid targets', async () => {
    await expect(reflectGrpcWorkflowTarget('not-a-valid-target')).rejects.toThrow();
  });

  it('reflectGrpcWorkflowTarget forwards tls mode', async () => {
    vi.mocked(postGrpcReflect).mockResolvedValueOnce({
      ok: true,
      data: FIXTURE_DESCRIPTOR,
    } as never);
    await reflectGrpcWorkflowTarget('localhost:50051', 'tls');
    expect(postGrpcReflect).toHaveBeenCalledWith(expect.objectContaining({
      target: { address: 'localhost:50051', tlsMode: 'tls' },
    }));
  });

  it('buildGrpcWorkflowReflectionPatch fills descriptor key and clears invalid method', () => {
    const patch = buildGrpcWorkflowReflectionPatch(
      {
        descriptorKey: '',
        service: 'echo.EchoService',
        method: 'NotARealMethod',
      },
      FIXTURE_DESCRIPTOR,
      'unary',
    );

    expect(patch.descriptorKey).toBe(FIXTURE_DESCRIPTOR_KEY);
    expect(patch.method).toBe('');
  });

  it('buildGrpcWorkflowReflectionPatch clears unknown service and keeps valid method pairs', () => {
    const unknownService = buildGrpcWorkflowReflectionPatch(
      {
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'missing.Service',
        method: 'Echo',
      },
      FIXTURE_DESCRIPTOR,
      'unary',
    );
    expect(unknownService).toEqual({ service: '', method: '' });

    const valid = buildGrpcWorkflowReflectionPatch(
      {
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
      },
      FIXTURE_DESCRIPTOR,
      'unary',
    );
    expect(valid).toEqual({});
  });
});
