/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_BIDI_STREAM_START_REQUEST,
  FIXTURE_SERVER_STREAM_START_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { GRPC_DEFAULT_CALL_TIMEOUT_MS, GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import * as grpcAuthResolve from './grpcAuthResolve.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import * as descriptorStore from './descriptorStore.js';
import * as descriptorUtils from './descriptorUtils.js';
import * as dynamicProtoCodec from './dynamicProtoCodec.js';
import * as helpers from './grpcStreamServiceHelpers.js';
import * as streamRegistry from './streamRegistry.js';
import { startGrpcStreamSync } from './grpcStreamServiceStart.js';
import type { GrpcStreamingClientFactory } from './grpcStreamingClient.js';

describe('grpcStreamServiceStart coverage gaps', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    streamRegistry.clearGrpcStreamRegistry();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    vi.restoreAllMocks();
  });

  it('returns invalid descriptor error when descriptor key is missing', () => {
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

  it('covers successful response decoding, callbacks, and transport proxy methods', () => {
    let capturedCallbacks: {
      onInboundMessage: (body: unknown, headers?: unknown) => void;
      onTerminal: (result: {
        status: number;
        statusMessage: string;
        headers: Record<string, string>;
        trailers: Record<string, string>;
        body?: unknown;
      }) => void;
      onError: (message: string, status: number) => void;
    } | undefined;

    const startStream = vi.fn((params, callbacks) => {
      capturedCallbacks = callbacks;
      const responseBuffer = dynamicProtoCodec.encodeProtoMessage(
        FIXTURE_DESCRIPTOR,
        FIXTURE_DESCRIPTOR.services[0]!.methods[0]!.responseTypeName,
        { message: 'reply' },
      );
      expect(params.decodeResponse(responseBuffer)).toEqual({ message: 'reply' });
      return {
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      };
    });

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-success-path-start',
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(true);
    expect(capturedCallbacks).toBeDefined();

    capturedCallbacks?.onInboundMessage({ message: 'chunk-1' });
    capturedCallbacks?.onTerminal({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'done' },
    });

    const registered = streamRegistry.getGrpcStreamEntry(envelope.data.streamId);
    expect(registered).toBeDefined();
    registered?.transport.write(Buffer.from('transport-write'));
    registered?.transport.endWrites();
    registered?.transport.cancel();
  });

  it('maps auth resolve failures to validation envelopes', () => {
    vi.spyOn(grpcAuthResolve, 'resolveGrpcExecuteAuthMetadataSync').mockImplementationOnce(() => {
      throw new Error('auth failed');
    });

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-auth-failure-start',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    }
  });

  it('returns conflict when registration fails', () => {
    vi.spyOn(streamRegistry, 'tryRegisterGrpcStream').mockReturnValueOnce({
      ok: false,
      reason: 'duplicate_active_request',
    });

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-register-conflict-start',
      },
      'tab-1',
      { startStream: vi.fn() } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      expect(envelope.error.category).toBe('conflict');
    }
  });

  it('covers terminal and error callbacks while the stream remains active', () => {
    let capturedCallbacks: {
      onInboundMessage: (body: unknown, headers?: unknown) => void;
      onTerminal: (result: {
        status: number;
        statusMessage: string;
        headers: Record<string, string>;
        trailers: Record<string, string>;
        body?: unknown;
      }) => void;
      onError: (message: string, status: number) => void;
    } | undefined;

    const startStream = vi.fn((_params, callbacks) => {
      capturedCallbacks = callbacks;
      return {
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      };
    });

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-terminal-error-callbacks-start',
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(true);
    capturedCallbacks?.onError('transport exploded', 14);
    capturedCallbacks?.onTerminal({
      status: 7,
      statusMessage: 'Permission denied',
      headers: {},
      trailers: {},
    });
  });

  it('covers inactive callback guards after the stream is finalized', () => {
    let capturedCallbacks: {
      onInboundMessage: (body: unknown, headers?: unknown) => void;
      onTerminal: (result: {
        status: number;
        statusMessage: string;
        headers: Record<string, string>;
        trailers: Record<string, string>;
        body?: unknown;
      }) => void;
      onError: (message: string, status: number) => void;
    } | undefined;

    const startStream = vi.fn((_params, callbacks) => {
      capturedCallbacks = callbacks;
      return {
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      };
    });

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-inactive-callbacks-start',
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(true);
    if (!envelope.ok) return;

    streamRegistry.finalizeGrpcStreamEntry(envelope.data.streamId);
    capturedCallbacks?.onInboundMessage({ message: 'late chunk' });
    capturedCallbacks?.onTerminal({
      status: 0,
      statusMessage: 'OK',
      headers: {},
      trailers: {},
      body: { message: 'late terminal' },
    });
    capturedCallbacks?.onError('late error', 13);
  });

  it('uses the default timeout when the request omits timeoutMs', () => {
    const startStream = vi.fn((params) => {
      expect(params.timeoutMs).toBe(GRPC_DEFAULT_CALL_TIMEOUT_MS);
      return {
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      };
    });

    const { timeoutMs: _ignoredTimeoutMs, ...requestWithoutTimeout } = FIXTURE_SERVER_STREAM_START_REQUEST;
    const envelope = startGrpcStreamSync(
      {
        ...requestWithoutTimeout,
        requestId: 'req-default-timeout-start',
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(true);
  });

  it('uses provided resolved metadata instead of resolving auth metadata again', () => {
    const resolveSpy = vi.spyOn(grpcAuthResolve, 'resolveGrpcExecuteAuthMetadataSync');
    const providedMetadata = { authorization: 'Bearer resolved-metadata' };

    const startStream = vi.fn((params) => {
      expect(params.metadata).toEqual(providedMetadata);
      return {
        callType: 'server_streaming',
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      };
    });

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_SERVER_STREAM_START_REQUEST,
        requestId: 'req-provided-metadata-start',
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
      providedMetadata,
    );

    expect(envelope.ok).toBe(true);
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it('writes the initial bidi body when the stream starts successfully', () => {
    const write = vi.fn();
    const startStream = vi.fn(() => ({
      callType: 'bidi_streaming',
      write,
      endWrites: vi.fn(),
      cancel: vi.fn(),
    }));

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_BIDI_STREAM_START_REQUEST,
        requestId: 'req-bidi-success-start',
        body: { message: 'hello bidi' },
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
    );

    expect(envelope.ok).toBe(true);
    expect(startStream).toHaveBeenCalled();
    expect(write).toHaveBeenCalled();
  });

  it('returns transport envelope when the initial bidi write fails', () => {
    const startStream = vi.fn(() => ({
      callType: 'bidi_streaming',
      write: vi.fn(() => {
        throw new Error('write exploded');
      }),
      endWrites: vi.fn(),
      cancel: vi.fn(),
    }));

    const envelope = startGrpcStreamSync(
      {
        ...FIXTURE_BIDI_STREAM_START_REQUEST,
        requestId: 'req-bidi-write-failure-start',
        body: { message: 'hello bidi' },
      },
      'tab-1',
      { startStream } as unknown as GrpcStreamingClientFactory,
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
