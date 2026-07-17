/**
 * Coverage gaps — grpcBrowserTransportAdapters.ts (Phase 10B).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_CANCEL_SUCCESS_ENVELOPE,
  FIXTURE_ECHO_DESCRIPTOR_PAYLOAD,
  FIXTURE_HAPPY_CALL_ENVELOPE,
  FIXTURE_UNARY_CALL_REQUEST,
} from './contractFixtures';
import { GRPC_ERROR_CODES } from './contracts';
import { GrpcApiClientError } from './grpcApiClient';
import { GrpcNativeTauriTransportError } from './grpcNativeTauriTransport';
import { SpringServletPathResolutionError } from './grpcSpringServletPathResolver';

vi.mock('./grpcApiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpcApiClient')>();
  return {
    ...actual,
    postGrpcCall: vi.fn(),
    deleteGrpcCall: vi.fn(),
  };
});

vi.mock('./grpcNativeTauriTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpcNativeTauriTransport')>();
  return {
    ...actual,
    invokeGrpcUnaryNative: vi.fn(),
    invokeGrpcCallCancelNative: vi.fn(),
  };
});

vi.mock('./grpcGrpcWebUnaryClient', () => ({
  invokeGrpcWebUnary: vi.fn(),
  cancelGrpcWebUnary: vi.fn(),
}));

vi.mock('./grpcGrpcSpringServletUnaryClient', () => ({
  invokeGrpcSpringServletUnary: vi.fn(),
  cancelGrpcSpringServletUnary: vi.fn(),
}));

vi.mock('./grpcTauriDescriptorBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./grpcTauriDescriptorBridge')>();
  return {
    ...actual,
    prepareGrpcTauriDescriptorPayload: vi.fn(),
  };
});

import { deleteGrpcCall, postGrpcCall } from './grpcApiClient';
import {
  invokeGrpcCallCancelNative,
  invokeGrpcUnaryNative,
} from './grpcNativeTauriTransport';
import { invokeGrpcWebUnary, cancelGrpcWebUnary } from './grpcGrpcWebUnaryClient';
import {
  invokeGrpcSpringServletUnary,
  cancelGrpcSpringServletUnary,
} from './grpcGrpcSpringServletUnaryClient';
import { prepareGrpcTauriDescriptorPayload } from './grpcTauriDescriptorBridge';
import { getGrpcBrowserTransportAdapter } from './grpcBrowserTransportAdapters';

const TAB_ID = 'tab-coverage-gaps';

describe('grpcBrowserTransportAdapters coverage gaps', () => {
  beforeEach(() => {
    vi.mocked(postGrpcCall).mockReset();
    vi.mocked(deleteGrpcCall).mockReset();
    vi.mocked(invokeGrpcUnaryNative).mockReset();
    vi.mocked(invokeGrpcCallCancelNative).mockReset();
    vi.mocked(invokeGrpcWebUnary).mockReset();
    vi.mocked(cancelGrpcWebUnary).mockReset();
    vi.mocked(invokeGrpcSpringServletUnary).mockReset();
    vi.mocked(cancelGrpcSpringServletUnary).mockReset();
    vi.mocked(prepareGrpcTauriDescriptorPayload).mockReset();
  });

  describe('express adapter', () => {
    it('invokeUnary attaches fallbackReason and transportUsed', async () => {
      vi.mocked(postGrpcCall).mockResolvedValue(FIXTURE_HAPPY_CALL_ENVELOPE);
      const adapter = getGrpcBrowserTransportAdapter('express');

      const envelope = await adapter.invokeUnary({
        request: FIXTURE_UNARY_CALL_REQUEST,
        tabId: TAB_ID,
        fallbackReason: 'native preflight failed',
      });

      expect(postGrpcCall).toHaveBeenCalledWith(FIXTURE_UNARY_CALL_REQUEST, TAB_ID);
      expect(envelope.data.transportUsed).toBe('express');
      expect(envelope.data.fallbackReason).toBe('native preflight failed');
    });

    it('cancelUnary calls deleteGrpcCall', async () => {
      vi.mocked(deleteGrpcCall).mockResolvedValue(FIXTURE_CANCEL_SUCCESS_ENVELOPE);
      const adapter = getGrpcBrowserTransportAdapter('express');

      await adapter.cancelUnary(FIXTURE_UNARY_CALL_REQUEST.requestId, TAB_ID);

      expect(deleteGrpcCall).toHaveBeenCalledWith(
        FIXTURE_UNARY_CALL_REQUEST.requestId,
        TAB_ID,
      );
    });

    it('exposes startStream', () => {
      const adapter = getGrpcBrowserTransportAdapter('express');
      expect(adapter.startStream).toBeTypeOf('function');
    });
  });

  describe('tauri adapter', () => {
    const invokeOptions = {
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: TAB_ID,
      descriptorPayload: FIXTURE_ECHO_DESCRIPTOR_PAYLOAD,
    };

    it('invokeUnary succeeds via native transport', async () => {
      vi.mocked(invokeGrpcUnaryNative).mockResolvedValue({
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'via-tauri' },
        durationMs: 8,
        transportUsed: 'tauri',
        requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      });
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      const envelope = await adapter.invokeUnary(invokeOptions);

      expect(invokeGrpcUnaryNative).toHaveBeenCalled();
      expect(envelope.ok).toBe(true);
      expect(envelope.data.transportUsed).toBe('tauri');
      expect(envelope.data.body).toEqual({ message: 'via-tauri' });
    });

    it('invokeUnary maps GrpcNativeTauriTransportError to GrpcApiClientError', async () => {
      vi.mocked(invokeGrpcUnaryNative).mockRejectedValue(
        new GrpcNativeTauriTransportError('unary', 'IPC down', { retryable: true }),
      );
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toBeInstanceOf(GrpcApiClientError);
    });

    it('invokeUnary maps descriptor prepare failures to GrpcApiClientError', async () => {
      vi.mocked(prepareGrpcTauriDescriptorPayload).mockRejectedValue(
        new Error('descriptorKey is required'),
      );
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      await expect(adapter.invokeUnary({
        request: FIXTURE_UNARY_CALL_REQUEST,
        tabId: TAB_ID,
      })).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      });
    });

    it('invokeUnary rethrows unexpected non-native errors', async () => {
      vi.mocked(invokeGrpcUnaryNative).mockRejectedValue(new Error('unexpected IPC'));
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toThrow('unexpected IPC');
    });

    it('invokeUnary throws when native result status is non-zero', async () => {
      vi.mocked(invokeGrpcUnaryNative).mockResolvedValue({
        callType: 'unary',
        status: 5,
        statusMessage: 'NOT_FOUND',
        headers: {},
        trailers: { 'grpc-status': '5' },
        body: null,
        durationMs: 4,
        transportUsed: 'tauri',
        requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
      });
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toBeInstanceOf(GrpcApiClientError);
    });

    it('cancelUnary succeeds via native cancel', async () => {
      vi.mocked(invokeGrpcCallCancelNative).mockResolvedValue({
        requestId: FIXTURE_UNARY_CALL_REQUEST.requestId,
        cancelled: true,
      });
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      const envelope = await adapter.cancelUnary(FIXTURE_UNARY_CALL_REQUEST.requestId, TAB_ID);

      expect(envelope.ok).toBe(true);
      expect(envelope.data.cancelled).toBe(true);
    });

    it('cancelUnary maps GrpcNativeTauriTransportError to GrpcApiClientError', async () => {
      vi.mocked(invokeGrpcCallCancelNative).mockRejectedValue(
        new GrpcNativeTauriTransportError('call_cancel', 'cancel IPC failed'),
      );
      const adapter = getGrpcBrowserTransportAdapter('tauri');

      await expect(
        adapter.cancelUnary(FIXTURE_UNARY_CALL_REQUEST.requestId, TAB_ID),
      ).rejects.toBeInstanceOf(GrpcApiClientError);
    });
  });

  describe('grpc-web adapter', () => {
    const invokeOptions = {
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: TAB_ID,
      descriptorPayload: FIXTURE_ECHO_DESCRIPTOR_PAYLOAD,
    };

    it('invokeUnary succeeds via grpc-web client', async () => {
      vi.mocked(invokeGrpcWebUnary).mockResolvedValue({
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'via-grpc-web' },
        durationMs: 6,
        transportUsed: 'grpc-web',
      });
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      const envelope = await adapter.invokeUnary(invokeOptions);

      expect(invokeGrpcWebUnary).toHaveBeenCalled();
      expect(envelope.data.transportUsed).toBe('grpc-web');
    });

    it('invokeUnary passthrough GrpcApiClientError', async () => {
      const passthrough = new GrpcApiClientError('call', 'already mapped', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
      });
      vi.mocked(invokeGrpcWebUnary).mockRejectedValue(passthrough);
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toBe(passthrough);
    });

    it('invokeUnary wraps generic errors as unreachable GrpcApiClientError', async () => {
      vi.mocked(invokeGrpcWebUnary).mockRejectedValue(new Error('network reset'));
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.UNREACHABLE,
        retryable: true,
        message: 'network reset',
      });
    });

    it('invokeUnary maps descriptor prepare failures to GrpcApiClientError', async () => {
      vi.mocked(prepareGrpcTauriDescriptorPayload).mockRejectedValue(
        new Error('descriptorKey is required'),
      );
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      await expect(adapter.invokeUnary({
        request: FIXTURE_UNARY_CALL_REQUEST,
        tabId: TAB_ID,
      })).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      });
    });

    it('invokeUnary wraps non-Error rejections as unreachable GrpcApiClientError', async () => {
      vi.mocked(invokeGrpcWebUnary).mockRejectedValue('socket hang up');
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.UNREACHABLE,
        message: 'socket hang up',
      });
    });

    it('invokeUnary throws when grpc-web result status is non-zero', async () => {
      vi.mocked(invokeGrpcWebUnary).mockResolvedValue({
        callType: 'unary',
        status: 7,
        statusMessage: 'PERMISSION_DENIED',
        headers: {},
        trailers: {},
        body: null,
        durationMs: 3,
        transportUsed: 'grpc-web',
      });
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toBeInstanceOf(GrpcApiClientError);
    });

    it('cancelUnary delegates to cancelGrpcWebUnary', async () => {
      vi.mocked(cancelGrpcWebUnary).mockReturnValue(true);
      const adapter = getGrpcBrowserTransportAdapter('grpc-web');

      const envelope = await adapter.cancelUnary(FIXTURE_UNARY_CALL_REQUEST.requestId, TAB_ID);

      expect(cancelGrpcWebUnary).toHaveBeenCalledWith(TAB_ID, FIXTURE_UNARY_CALL_REQUEST.requestId);
      expect(envelope.data.cancelled).toBe(true);
    });
  });

  describe('spring-servlet adapter', () => {
    const invokeOptions = {
      request: FIXTURE_UNARY_CALL_REQUEST,
      tabId: TAB_ID,
      descriptorPayload: FIXTURE_ECHO_DESCRIPTOR_PAYLOAD,
    };

    it('invokeUnary succeeds via spring servlet client', async () => {
      vi.mocked(invokeGrpcSpringServletUnary).mockResolvedValue({
        callType: 'unary',
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: { message: 'via-servlet' },
        durationMs: 5,
        transportUsed: 'spring-servlet',
      });
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      const envelope = await adapter.invokeUnary(invokeOptions);

      expect(invokeGrpcSpringServletUnary).toHaveBeenCalled();
      expect(envelope.data.transportUsed).toBe('spring-servlet');
    });

    it('invokeUnary maps SpringServletPathResolutionError to validation GrpcApiClientError', async () => {
      vi.mocked(invokeGrpcSpringServletUnary).mockRejectedValue(
        new SpringServletPathResolutionError('Invalid Spring Servlet service segment'),
      );
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        retryable: false,
        message: 'Invalid Spring Servlet service segment',
      });
    });

    it('invokeUnary maps descriptor prepare failures to GrpcApiClientError', async () => {
      vi.mocked(prepareGrpcTauriDescriptorPayload).mockRejectedValue(
        new Error('descriptorKey is required'),
      );
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      await expect(adapter.invokeUnary({
        request: FIXTURE_UNARY_CALL_REQUEST,
        tabId: TAB_ID,
      })).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
      });
    });

    it('invokeUnary passthrough GrpcApiClientError', async () => {
      const passthrough = new GrpcApiClientError('call', 'already mapped', {
        code: GRPC_ERROR_CODES.CALL_FAILED,
      });
      vi.mocked(invokeGrpcSpringServletUnary).mockRejectedValue(passthrough);
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toBe(passthrough);
    });

    it('invokeUnary throws when spring servlet result status is non-zero', async () => {
      vi.mocked(invokeGrpcSpringServletUnary).mockResolvedValue({
        callType: 'unary',
        status: 3,
        statusMessage: 'INVALID_ARGUMENT',
        headers: {},
        trailers: {},
        body: null,
        durationMs: 2,
        transportUsed: 'spring-servlet',
      });
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toBeInstanceOf(GrpcApiClientError);
    });

    it('cancelUnary delegates to cancelGrpcSpringServletUnary', async () => {
      vi.mocked(cancelGrpcSpringServletUnary).mockReturnValue(true);
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      const envelope = await adapter.cancelUnary(FIXTURE_UNARY_CALL_REQUEST.requestId, TAB_ID);

      expect(cancelGrpcSpringServletUnary).toHaveBeenCalledWith(TAB_ID, FIXTURE_UNARY_CALL_REQUEST.requestId);
      expect(envelope.data.cancelled).toBe(true);
    });

    it('invokeUnary wraps generic errors as unreachable GrpcApiClientError', async () => {
      vi.mocked(invokeGrpcSpringServletUnary).mockRejectedValue('servlet fetch failed');
      const adapter = getGrpcBrowserTransportAdapter('spring-servlet');

      await expect(adapter.invokeUnary(invokeOptions)).rejects.toMatchObject({
        code: GRPC_ERROR_CODES.UNREACHABLE,
        retryable: true,
        message: 'servlet fetch failed',
      });
    });
  });
});
