/**
 * gRPC browser transport adapter interface — Phase 10B.
 */
import type {
  GrpcCallRequest,
  GrpcCallResult,
  GrpcCancelCallResult,
  GrpcStreamStartRequest,
  GrpcStreamStartResponse,
  GrpcSuccessEnvelope,
} from './contracts';
import type { GrpcStudioTransportMode } from './grpcWebTransportContracts';
import type { BuildGrpcTauriDescriptorPayloadInput } from './grpcTauriDescriptorPayload';

export interface GrpcBrowserUnaryInvokeOptions {
  request: GrpcCallRequest;
  tabId: string;
  descriptorPayload?: BuildGrpcTauriDescriptorPayloadInput;
  /** Set when retrying via express after native pre-start failure. */
  fallbackReason?: string;
}

export interface GrpcBrowserTransportAdapter {
  readonly mode: GrpcStudioTransportMode;
  /** When false, assertGrpcTransportDispatchReady blocks before I/O (10C/10D enable browser-direct). */
  readonly dispatchReady: boolean;
  invokeUnary(
    options: GrpcBrowserUnaryInvokeOptions,
  ): Promise<GrpcSuccessEnvelope<GrpcCallResult>>;
  cancelUnary(
    requestId: string,
    tabId: string,
  ): Promise<GrpcSuccessEnvelope<GrpcCancelCallResult>>;
  startStream?(
    request: GrpcStreamStartRequest,
    tabId: string,
  ): Promise<GrpcSuccessEnvelope<GrpcStreamStartResponse>>;
}
