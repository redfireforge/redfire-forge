/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_SERVER_STREAM_START_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import * as descriptorStore from './descriptorStore.js';
import * as descriptorUtils from './descriptorUtils.js';
import * as dynamicProtoCodec from './dynamicProtoCodec.js';
import * as helpers from './grpcStreamServiceHelpers.js';
import * as streamRegistry from './streamRegistry.js';
import { startGrpcStreamSync } from './grpcStreamServiceStart.js';
import type { GrpcStreamingClientFactory } from './grpcStreamingClient.js';

describe('grpcStreamServiceStart coverage gaps', () => {
  it('returns invalid descriptor error when descriptor key is missing', () => {
    clearGrpcDescriptorStore();

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-missing-descriptor-start',
        descriptorKey: 'missing-descriptor',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      expect(envelope.error.message).toContain('Descriptor not found');
    }
  });

  it('returns invalid descriptor error when method is not found in descriptor', () => {
    clearGrpcDescriptorStore();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-missing-method-start',
        method: 'MethodThatDoesNotExist',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      expect(envelope.error.message).toContain('not found in descriptor');
    }
  });

  it('maps non-schema encode failures to INVALID_REQUEST', () => {
    clearGrpcDescriptorStore();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-invalid-request-encode',
        body: { message: 123 },
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('returns conflict when requestId is already active', () => {
    clearGrpcDescriptorStore();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);

    const first = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-duplicate-active-start',
      },
      'tab-1',
      {
        startStream: vi.fn(() => ({
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        })),
      } as unknown as GrpcStreamingClientFactory,
    );
    expect(first.ok).toBe(true);

    const second = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-duplicate-active-start',
      },
      'tab-2',
      {
        startStream: vi.fn(() => ({
          callType: 'server_streaming',
          write: vi.fn(),
          endWrites: vi.fn(),
          cancel: vi.fn(),
        })),
      } as unknown as GrpcStreamingClientFactory,
    );

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      expect(second.error.category).toBe('conflict');
    }
  });

  it('returns transport envelope when streaming client throws on start', () => {
    clearGrpcDescriptorStore();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-start-throws',
      },
      'tab-1',
      {
        startStream: vi.fn(() => {
          throw new Error('stream start exploded');
        }),
      } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
    }
  });

  it('covers start-local descriptor and method error branches when preflight is bypassed', () => {
    const preflightSpy = vi.spyOn(helpers, 'validateGrpcStreamStartPreflight').mockReturnValue(null);

    const missingDescriptorSpy = vi.spyOn(descriptorStore, 'getGrpcDescriptor').mockReturnValueOnce(undefined);
    const missingDescriptor = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-local-missing-descriptor',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );
    expect(missingDescriptor.ok).toBe(false);
    if (!missingDescriptor.ok) {
      expect(missingDescriptor.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
    missingDescriptorSpy.mockRestore();

    const descriptorSpy = vi.spyOn(descriptorStore, 'getGrpcDescriptor').mockReturnValue(FIXTURE_DESCRIPTOR);
    const methodSpy = vi.spyOn(descriptorUtils, 'findGrpcMethod').mockReturnValue(undefined);
    const missingMethod = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-local-missing-method',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );
    expect(missingMethod.ok).toBe(false);
    if (!missingMethod.ok) {
      expect(missingMethod.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }

    methodSpy.mockRestore();
    descriptorSpy.mockRestore();
    preflightSpy.mockRestore();
  });

  it('covers encode error code mapping and duplicate request conflict when preflight is bypassed', () => {
    const preflightSpy = vi.spyOn(helpers, 'validateGrpcStreamStartPreflight').mockReturnValue(null);
    const descriptorSpy = vi.spyOn(descriptorStore, 'getGrpcDescriptor').mockReturnValue(FIXTURE_DESCRIPTOR);
    const methodSpy = vi.spyOn(descriptorUtils, 'findGrpcMethod').mockReturnValue(FIXTURE_DESCRIPTOR.services[0]!.methods[0]!);

    const schemaEncodeSpy = vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementationOnce(() => {
      throw new Error('Invalid descriptor schema: missing field map');
    });
    const schemaFailure = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-local-schema-failure',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );
    expect(schemaFailure.ok).toBe(false);
    if (!schemaFailure.ok) {
      expect(schemaFailure.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    }
    schemaEncodeSpy.mockRestore();

    const stringEncodeSpy = vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementationOnce(() => {
      throw 'bad body payload';
    });
    const requestFailure = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-local-request-failure',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );
    expect(requestFailure.ok).toBe(false);
    if (!requestFailure.ok) {
      expect(requestFailure.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
    stringEncodeSpy.mockRestore();

    const duplicateSpy = vi.spyOn(streamRegistry, 'findActiveGrpcStreamByRequestId').mockReturnValue({ requestId: 'req-dup' } as never);
    const duplicate = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-local-duplicate',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      expect(duplicate.error.category).toBe('conflict');
    }

    duplicateSpy.mockRestore();
    methodSpy.mockRestore();
    descriptorSpy.mockRestore();
    preflightSpy.mockRestore();
  });
});
