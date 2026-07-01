/**
 * gRPC browser transport adapters — Phase 10B.
 */
import {
  deleteGrpcCall,
  postGrpcCall,
  GrpcApiClientError,
} from './grpcApiClient';
import {
  GRPC_ERROR_CODES,
  type GrpcCallResult,
  type GrpcStreamStartRequest,
  type GrpcStreamStartResponse,
  type GrpcSuccessEnvelope,
} from './contracts';
import {
  buildGrpcTauriDescriptorPayload,
  type BuildGrpcTauriDescriptorPayloadInput,
} from './grpcTauriDescriptorPayload';
import {
  invokeGrpcCallCancelNative,
  invokeGrpcUnaryNative,
  mapGrpcTauriCancelResultToCallCancel,
  mapGrpcTauriUnaryResultToCallResult,
  toGrpcTauriCallCancelRequest,
  toGrpcTauriUnaryRequest,
  GrpcNativeTauriTransportError,
} from './grpcNativeTauriTransport';
import {
  toGrpcApiClientErrorFromDescriptorPrepare,
  toGrpcApiClientErrorFromNative,
  toGrpcApiClientErrorFromUnaryResult,
} from './grpcTauriErrorMapping';
import type { GrpcTauriDescriptorPayload } from './grpcTauriContracts';
import { prepareGrpcTauriDescriptorPayload, sha256HexFromBase64 } from './grpcTauriDescriptorBridge';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import type {
  GrpcBrowserTransportAdapter,
  GrpcBrowserUnaryInvokeOptions,
} from './grpcBrowserTransportAdapter';
import {
  buildGrpcStreamQuery,
  expressGrpcProxyDispatchJson,
  resolveGrpcExpressStreamJsonTransport,
} from './grpcExpressProxyJsonTransport';
import type { GrpcTransportMode } from './grpcTransportTabRouting';
import {
  cancelGrpcSpringServletUnary,
  invokeGrpcSpringServletUnary,
} from './grpcGrpcSpringServletUnaryClient';
import { SpringServletPathResolutionError } from './grpcSpringServletPathResolver';
import {
  cancelGrpcWebUnary,
  invokeGrpcWebUnary,
} from './grpcGrpcWebUnaryClient';

async function resolveDescriptorPayload(
  request: GrpcBrowserUnaryInvokeOptions['request'],
  descriptorPayload?: BuildGrpcTauriDescriptorPayloadInput,
): Promise<GrpcTauriDescriptorPayload> {
  if (descriptorPayload) {
    const protosetBase64 = descriptorPayload.protosetBase64.trim();
    const contentSha256 = await sha256HexFromBase64(protosetBase64);
    return buildGrpcTauriDescriptorPayload({
      descriptorKey: descriptorPayload.descriptorKey,
      contentSha256,
      protosetBase64,
    });
  }

  return prepareGrpcTauriDescriptorPayload({
    descriptorKey: request.descriptorKey.trim(),
    requestId: request.requestId,
  });
}

function attachUnaryTransportMeta(
  result: Omit<GrpcCallResult, 'transportUsed' | 'fallbackReason'>,
  transportUsed: GrpcTransportMode,
  fallbackReason?: string,
): GrpcCallResult {
  return {
    ...result,
    transportUsed,
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

async function startExpressGrpcStream(
  request: GrpcStreamStartRequest,
  tabId: string,
): Promise<GrpcSuccessEnvelope<GrpcStreamStartResponse>> {
  const query = buildGrpcStreamQuery(tabId);
  return expressGrpcProxyDispatchJson<GrpcStreamStartResponse>(
    'stream_start',
    `/api/grpc/stream/start?${query}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
    },
    resolveGrpcExpressStreamJsonTransport(),
  );
}

function createExpressAdapter(): GrpcBrowserTransportAdapter {
  return {
    mode: 'express',
    dispatchReady: true,
    async invokeUnary(options) {
      const { request, tabId, fallbackReason } = options;
      const envelope = await postGrpcCall(request, tabId);
      return {
        ...envelope,
        data: attachUnaryTransportMeta(envelope.data, 'express', fallbackReason),
      };
    },
    cancelUnary(requestId, tabId) {
      return deleteGrpcCall(requestId, tabId);
    },
    startStream: startExpressGrpcStream,
  };
}

function createTauriAdapter(): GrpcBrowserTransportAdapter {
  return {
    mode: 'tauri',
    dispatchReady: true,
    async invokeUnary(options) {
      const { request, tabId, descriptorPayload } = options;
      let payload: GrpcTauriDescriptorPayload;
      try {
        payload = await resolveDescriptorPayload(request, descriptorPayload);
      } catch (error) {
        throw toGrpcApiClientErrorFromDescriptorPrepare('call', error);
      }

      let nativeResult;
      try {
        nativeResult = await invokeGrpcUnaryNative(
          toGrpcTauriUnaryRequest(request, tabId, payload),
        );
      } catch (error) {
        if (error instanceof GrpcNativeTauriTransportError) {
          throw toGrpcApiClientErrorFromNative('call', error);
        }
        throw error;
      }

      const data = attachUnaryTransportMeta(
        mapGrpcTauriUnaryResultToCallResult(nativeResult),
        'tauri',
      );
      if (data.status !== 0) {
        throw toGrpcApiClientErrorFromUnaryResult(data);
      }
      return {
        ok: true,
        op: 'call',
        data,
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: data.durationMs,
          requestId: request.requestId,
        },
      };
    },
    async cancelUnary(requestId, tabId) {
      let nativeResult;
      try {
        nativeResult = await invokeGrpcCallCancelNative(
          toGrpcTauriCallCancelRequest(requestId, tabId),
        );
      } catch (error) {
        if (error instanceof GrpcNativeTauriTransportError) {
          throw toGrpcApiClientErrorFromNative('cancel', error);
        }
        throw error;
      }

      return {
        ok: true,
        op: 'cancel',
        data: mapGrpcTauriCancelResultToCallCancel(nativeResult),
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    },
    startStream: startExpressGrpcStream,
  };
}

function createGrpcWebAdapter(): GrpcBrowserTransportAdapter {
  return {
    mode: 'grpc-web',
    dispatchReady: true,
    async invokeUnary(options) {
      const { request, tabId, descriptorPayload } = options;
      let payload: GrpcTauriDescriptorPayload;
      try {
        payload = await resolveDescriptorPayload(request, descriptorPayload);
      } catch (error) {
        throw toGrpcApiClientErrorFromDescriptorPrepare('call', error);
      }

      try {
        const data = await invokeGrpcWebUnary({
          request,
          tabId,
          protosetBase64: payload.protosetBase64,
        });
        if (data.status !== 0) {
          throw toGrpcApiClientErrorFromUnaryResult(data);
        }
        return {
          ok: true,
          op: 'call',
          data,
          meta: {
            timestamp: new Date().toISOString(),
            durationMs: data.durationMs,
            requestId: request.requestId,
          },
        };
      } catch (error) {
        if (error instanceof GrpcApiClientError) {
          throw error;
        }
        throw new GrpcApiClientError('call', error instanceof Error ? error.message : String(error), {
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          retryable: true,
        });
      }
    },
    async cancelUnary(requestId, tabId) {
      const cancelled = cancelGrpcWebUnary(tabId, requestId);
      return {
        ok: true,
        op: 'cancel',
        data: { requestId, cancelled },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    },
  };
}

function createSpringServletAdapter(): GrpcBrowserTransportAdapter {
  return {
    mode: 'spring-servlet',
    dispatchReady: true,
    async invokeUnary(options) {
      const { request, tabId, descriptorPayload } = options;
      let payload: GrpcTauriDescriptorPayload;
      try {
        payload = await resolveDescriptorPayload(request, descriptorPayload);
      } catch (error) {
        throw toGrpcApiClientErrorFromDescriptorPrepare('call', error);
      }

      try {
        const data = await invokeGrpcSpringServletUnary({
          request,
          tabId,
          protosetBase64: payload.protosetBase64,
        });
        if (data.status !== 0) {
          throw toGrpcApiClientErrorFromUnaryResult(data);
        }
        return {
          ok: true,
          op: 'call',
          data,
          meta: {
            timestamp: new Date().toISOString(),
            durationMs: data.durationMs,
            requestId: request.requestId,
          },
        };
      } catch (error) {
        if (error instanceof GrpcApiClientError) {
          throw error;
        }
        if (error instanceof SpringServletPathResolutionError) {
          throw new GrpcApiClientError('call', error.message, {
            code: GRPC_ERROR_CODES.INVALID_REQUEST,
            category: 'validation',
            retryable: false,
          });
        }
        throw new GrpcApiClientError('call', error instanceof Error ? error.message : String(error), {
          code: GRPC_ERROR_CODES.UNREACHABLE,
          category: 'unreachable',
          retryable: true,
        });
      }
    },
    async cancelUnary(requestId, tabId) {
      const cancelled = cancelGrpcSpringServletUnary(tabId, requestId);
      return {
        ok: true,
        op: 'cancel',
        data: { requestId, cancelled },
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    },
  };
}

const EXPRESS_ADAPTER = createExpressAdapter();
const TAURI_ADAPTER = createTauriAdapter();
const GRPC_WEB_ADAPTER = createGrpcWebAdapter();
const SPRING_SERVLET_ADAPTER = createSpringServletAdapter();

export const GRPC_BROWSER_TRANSPORT_ADAPTERS: Record<
  GrpcStudioTransportMode,
  GrpcBrowserTransportAdapter
> = {
  express: EXPRESS_ADAPTER,
  tauri: TAURI_ADAPTER,
  'grpc-web': GRPC_WEB_ADAPTER,
  'spring-servlet': SPRING_SERVLET_ADAPTER,
};

export function getGrpcBrowserTransportAdapter(
  mode: GrpcStudioTransportMode,
): GrpcBrowserTransportAdapter {
  return GRPC_BROWSER_TRANSPORT_ADAPTERS[mode];
}
