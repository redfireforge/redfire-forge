/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';

const mockResolveGrpcExecuteAuthMetadata = vi.fn(async (metadata: Record<string, string>) => ({
  ...metadata,
  async: 'yes',
}));
const mockResolveGrpcExecuteAuthMetadataSync = vi.fn((metadata: Record<string, string>) => ({
  ...metadata,
  sync: 'yes',
}));

vi.mock('./grpcAuthResolve.js', () => ({
  resolveGrpcExecuteAuthMetadata: (...args: unknown[]) => mockResolveGrpcExecuteAuthMetadata(...(args as [Record<string, string>])),
  resolveGrpcExecuteAuthMetadataSync: (...args: unknown[]) => mockResolveGrpcExecuteAuthMetadataSync(...(args as [Record<string, string>])),
}));

const loadModule = async () => import('./grpcServiceHelpers.js');

describe('grpcServiceHelpers', () => {
  it('maps descriptor loader errors to the expected gRPC codes', async () => {
    const { mapDescriptorLoaderErrorCode } = await loadModule();

    expect(mapDescriptorLoaderErrorCode({ code: 'unreachable' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.UNREACHABLE);
    expect(mapDescriptorLoaderErrorCode({ code: 'invalid_target' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.INVALID_TARGET);
    expect(mapDescriptorLoaderErrorCode({ code: 'invalid_descriptor' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    expect(mapDescriptorLoaderErrorCode({ code: 'describe_failed' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
    expect(mapDescriptorLoaderErrorCode({ code: 'import_resolution_failed' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.IMPORT_RESOLUTION_FAILED);
    expect(mapDescriptorLoaderErrorCode({ code: 'reflection_failed' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.REFLECTION_FAILED);
    expect(mapDescriptorLoaderErrorCode({ code: 'unexpected' } as never, 'reflect'))
      .toBe(GRPC_ERROR_CODES.REFLECTION_FAILED);
    expect(mapDescriptorLoaderErrorCode({ code: 'unexpected' } as never, 'describe'))
      .toBe(GRPC_ERROR_CODES.DESCRIBE_FAILED);
  });

  it('uses async oauth2 metadata resolution when auth is oauth2', async () => {
    const { appendAuthMetadata } = await loadModule();

    await expect(appendAuthMetadata(
      { existing: '1' },
      { type: 'oauth2' } as never,
      {} as never,
    )).resolves.toEqual({ existing: '1', async: 'yes' });
    expect(mockResolveGrpcExecuteAuthMetadata).toHaveBeenCalled();
    expect(mockResolveGrpcExecuteAuthMetadataSync).not.toHaveBeenCalled();
  });

  it('uses sync metadata resolution for non-oauth2 auth', async () => {
    const { appendAuthMetadata } = await loadModule();

    await expect(appendAuthMetadata(
      { existing: '1' },
      { type: 'basic' } as never,
      {} as never,
    )).resolves.toEqual({ existing: '1', sync: 'yes' });
    expect(mockResolveGrpcExecuteAuthMetadataSync).toHaveBeenCalled();
  });
});