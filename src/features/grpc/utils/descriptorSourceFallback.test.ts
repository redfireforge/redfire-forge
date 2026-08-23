import { describe, expect, it, vi } from 'vitest';
import { GRPC_ERROR_CODES } from '@shared/grpc/contracts';
import { createDefaultDescriptorSourceSelection } from '@shared/grpc/descriptorSourcePolicy';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import { FIXTURE_DESCRIPTOR } from '@shared/grpc/contractFixtures';
import { createDefaultProtoIngestState } from '../grpcStudioTypes';
import {
  buildDescribeRequestForSource,
  buildDescriptorSourceAvailability,
  loadDescriptorWithAutoFallback,
  mapGrpcClientErrorToFailureKind,
  orderedDescriptorSourcesForLoad,
} from './descriptorSourceFallback';

describe('descriptorSourceFallback', () => {
  const resolution = {
    target: 'localhost:50051',
    targetValidation: { valid: true, normalized: 'localhost:50051' },
  } as const;

  it('buildDescriptorSourceAvailability reflects ingest readiness', () => {
    const ingest = {
      ...createDefaultProtoIngestState(),
      protosetBase64: 'abc',
    };
    expect(buildDescriptorSourceAvailability(resolution, ingest)).toMatchObject({
      reflection: true,
      protoset: true,
      proto_files: false,
    });
  });

  it('orders auto sources with initial source first when available', () => {
    const selection = createDefaultDescriptorSourceSelection();
    const availability = {
      reflection: true,
      proto_files: true,
      protoset: false,
      bsr: false,
      url_proto: false,
    };
    expect(orderedDescriptorSourcesForLoad(selection, availability, 'proto_files')).toEqual([
      'proto_files',
      'reflection',
    ]);
  });

  it('maps grpc client errors to failure kinds', () => {
    const error = new GrpcApiClientError('reflect', 'failed', {
      code: GRPC_ERROR_CODES.REFLECTION_FAILED,
    });
    expect(mapGrpcClientErrorToFailureKind(error, 'reflect')).toBe('reflection_failed');
  });

  it('buildDescribeRequestForSource validates protoset ingest', () => {
    const ingest = { ...createDefaultProtoIngestState(), source: 'protoset' as const };
    expect(buildDescribeRequestForSource('protoset', ingest, 'req-1')).toEqual({
      error: 'Select a protoset file (.pb or .protoset) before loading',
    });
  });

  it('loadDescriptorWithAutoFallback tries next source in auto mode', async () => {
    const reflect = vi.fn(async () => {
      throw new GrpcApiClientError('reflect', 'reflection down', {
        code: GRPC_ERROR_CODES.REFLECTION_FAILED,
      });
    });
    const describe = vi.fn(async () => FIXTURE_DESCRIPTOR);

    const result = await loadDescriptorWithAutoFallback({
      selection: createDefaultDescriptorSourceSelection(),
      availability: {
        reflection: true,
        proto_files: true,
        protoset: false,
        bsr: false,
        url_proto: false,
      },
      initialSource: 'reflection',
      reflect,
      describe: async (source) => {
        expect(source).toBe('proto_files');
        return describe();
      },
    });

    expect(result.source).toBe('proto_files');
    expect(reflect).toHaveBeenCalledTimes(1);
    expect(describe).toHaveBeenCalledTimes(1);
  });

  it('loadDescriptorWithAutoFallback stops after first failure in manual mode', async () => {
    const reflect = vi.fn(async () => {
      throw new GrpcApiClientError('reflect', 'reflection down', {
        code: GRPC_ERROR_CODES.REFLECTION_FAILED,
      });
    });
    const describe = vi.fn(async () => FIXTURE_DESCRIPTOR);

    await expect(loadDescriptorWithAutoFallback({
      selection: { mode: 'manual', activeSource: 'reflection' },
      availability: { reflection: true, proto_files: true },
      initialSource: 'reflection',
      reflect,
      describe,
    })).rejects.toBeInstanceOf(GrpcApiClientError);

    expect(describe).not.toHaveBeenCalled();
  });
});
