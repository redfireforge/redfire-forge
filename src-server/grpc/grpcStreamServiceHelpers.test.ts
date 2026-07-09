/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_SERVER_STREAM_START_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import * as dynamicProtoCodec from './dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from './descriptorStore.js';
import { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';
import * as grpcAuthResolve from './grpcAuthResolve.js';
import {
  appendAuthMetadata,
  assertOwnershipOrError,
  hasNonEmptyInitialBody,
  isActiveStream,
  ownershipError,
  requireTransport,
  validateGrpcStreamStartPreflight,
} from './grpcStreamServiceHelpers.js';
import { clearGrpcStreamRegistry, tryRegisterGrpcStream } from './streamRegistry.js';

function makeTransport() {
  return {
    callType: 'server_streaming' as const,
    write: vi.fn(),
    endWrites: vi.fn(),
    cancel: vi.fn(),
  };
}

function registerActiveStream(overrides: Partial<Parameters<typeof tryRegisterGrpcStream>[0]> = {}) {
  const params = {
    streamId: 'stream-1',
    tabId: 'tab-1',
    requestId: 'req-1',
    callType: 'server_streaming' as const,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    requestTypeName: 'echo.StreamRequest',
    transport: makeTransport(),
    ...overrides,
  };
  const result = tryRegisterGrpcStream(params);
  expect(result.ok).toBe(true);
  return params;
}

describe('grpcStreamServiceHelpers', () => {
  beforeEach(() => {
    clearGrpcDescriptorStore();
    clearGrpcStreamRegistry();
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
    vi.restoreAllMocks();
  });

  describe('appendAuthMetadata', () => {
    it('resolves oauth2 auth asynchronously', async () => {
      const oauth2TokenService = new GrpcOAuth2TokenService();
      const spy = vi.spyOn(grpcAuthResolve, 'resolveGrpcExecuteAuthMetadata').mockResolvedValue({
        authorization: 'Bearer token',
      });
      const result = await appendAuthMetadata({}, { type: 'oauth2', profileId: 'p1' }, oauth2TokenService);
      expect(result).toEqual({ authorization: 'Bearer token' });
      expect(spy).toHaveBeenCalled();
    });

    it('resolves non-oauth auth synchronously', async () => {
      const spy = vi.spyOn(grpcAuthResolve, 'resolveGrpcExecuteAuthMetadataSync').mockReturnValue({
        'x-api-key': 'secret',
      });
      const result = await appendAuthMetadata({}, { type: 'api_key', headerName: 'x-api-key', value: 'secret' }, new GrpcOAuth2TokenService());
      expect(result).toEqual({ 'x-api-key': 'secret' });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('validateGrpcStreamStartPreflight', () => {
    const started = Date.now();

    it('returns validation error for missing tab id', () => {
      const result = validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, '', started);
      expect(result?.ok).toBe(false);
      expect(result?.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });

    it('returns validation error for invalid request payload', () => {
      const result = validateGrpcStreamStartPreflight(
        { ...FIXTURE_SERVER_STREAM_START_REQUEST, requestId: '' },
        'tab-1',
        started,
      );
      expect(result?.ok).toBe(false);
      expect(result?.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });

    it('returns descriptor error when descriptor key is unknown', () => {
      clearGrpcDescriptorStore();
      const result = validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1', started);
      expect(result?.ok).toBe(false);
      expect(result?.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    });

    it('returns descriptor error when method is missing', () => {
      const result = validateGrpcStreamStartPreflight(
        { ...FIXTURE_SERVER_STREAM_START_REQUEST, method: 'MissingMethod' },
        'tab-1',
        started,
      );
      expect(result?.ok).toBe(false);
      expect(result?.error.message).toMatch(/not found in descriptor/i);
    });

    it('returns invalid request when call type mismatches descriptor', () => {
      const result = validateGrpcStreamStartPreflight(
        { ...FIXTURE_SERVER_STREAM_START_REQUEST, callType: 'unary' },
        'tab-1',
        started,
      );
      expect(result?.ok).toBe(false);
      expect(result?.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });

    it('returns invalid descriptor when body encoding fails with schema error', () => {
      vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementation(() => {
        throw new Error('Invalid descriptor schema for echo.StreamRequest');
      });
      const result = validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1', started);
      expect(result?.ok).toBe(false);
      expect(result?.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
    });

    it('returns invalid request when body encoding fails for non-schema reasons', () => {
      vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementation(() => {
        throw new Error('body field message must be a string');
      });
      const result = validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1', started);
      expect(result?.ok).toBe(false);
      expect(result?.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
    });

    it('stringifies non-Error encode failures as invalid request messages', () => {
      vi.spyOn(dynamicProtoCodec, 'encodeProtoMessage').mockImplementation(() => {
        throw 'plain failure';
      });
      const result = validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1', started);
      expect(result?.ok).toBe(false);
      expect(result?.error.message).toBe('plain failure');
    });

    it('returns conflict when requestId is already active', () => {
      registerActiveStream({ requestId: FIXTURE_SERVER_STREAM_START_REQUEST.requestId });
      const result = validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1', started);
      expect(result?.ok).toBe(false);
      expect(result?.error.category).toBe('conflict');
    });

    it('returns null when preflight passes', () => {
      expect(validateGrpcStreamStartPreflight(FIXTURE_SERVER_STREAM_START_REQUEST, 'tab-1', started)).toBeNull();
    });
  });

  describe('ownershipError', () => {
    it('maps not_found to REQUEST_NOT_FOUND', () => {
      const envelope = ownershipError('stream_send', 'not_found', 'stream-1', 'req-1');
      expect(envelope.ok).toBe(false);
      expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
    });

    it('maps tab_mismatch to conflict INVALID_REQUEST', () => {
      const envelope = ownershipError('stream_end', 'tab_mismatch', 'stream-1');
      expect(envelope.ok).toBe(false);
      expect(envelope.error.category).toBe('conflict');
    });
  });

  describe('hasNonEmptyInitialBody', () => {
    it('returns true when any value is non-empty', () => {
      expect(hasNonEmptyInitialBody({ message: 'hi', count: 0 })).toBe(true);
    });

    it('returns false when all values are empty/null/undefined', () => {
      expect(hasNonEmptyInitialBody({ message: '', note: null, count: undefined })).toBe(false);
    });
  });

  describe('isActiveStream', () => {
    it('returns true only for active registry entries', () => {
      registerActiveStream();
      expect(isActiveStream('stream-1')).toBe(true);
      expect(isActiveStream('missing')).toBe(false);
    });
  });

  describe('requireTransport', () => {
    it('throws when transport is missing', () => {
      expect(() => requireTransport(null)).toThrow(/not ready/i);
    });

    it('returns the transport handle when present', () => {
      const transport = {
        callType: 'server_streaming' as const,
        write: vi.fn(),
        endWrites: vi.fn(),
        cancel: vi.fn(),
      };
      expect(requireTransport(transport)).toBe(transport);
    });
  });

  describe('assertOwnershipOrError', () => {
    it('returns envelope when stream is missing', () => {
      const result = assertOwnershipOrError('stream_events', 'missing', 'tab-1');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
      }
    });

    it('returns envelope when tab id mismatches', () => {
      registerActiveStream({ tabId: 'tab-a' });
      const result = assertOwnershipOrError('stream_cancel', 'stream-1', 'tab-b');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.envelope.error.category).toBe('conflict');
      }
    });

    it('returns entry when ownership passes', () => {
      registerActiveStream({ tabId: 'tab-a' });
      const result = assertOwnershipOrError('stream_send', 'stream-1', 'tab-a');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entry.streamId).toBe('stream-1');
      }
    });
  });
});
