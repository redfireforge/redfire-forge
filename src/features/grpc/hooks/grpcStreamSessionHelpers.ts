import type { MutableRefObject } from 'react';
import { GRPC_ERROR_CODES, type GrpcErrorBody } from '@shared/grpc/contracts';
import { GrpcApiClientError } from '@shared/grpc/grpcApiClient';
import { cancelGrpcStream } from '@shared/grpc/grpcStreamClient';
import { clearGrpcStreamTransportBinding } from '@shared/grpc/grpcTransportFallback';
import { classifyGrpcTransportFailure } from '@shared/grpc/grpcTransportErrors';
import {
  isGrpcStreamLifecycleInFlight,
  isGrpcStreamLifecycleTerminal,
  type GrpcStreamLifecycle,
} from '@shared/grpc/streamLifecycle';
import type { GrpcStudioTabState } from '../grpcStudioTypes';

export function tabHasActiveStream(tab: GrpcStudioTabState): boolean {
  return isGrpcStreamLifecycleInFlight(tab.streamLifecycle);
}

export function tabAwaitingStreamEvents(tab: GrpcStudioTabState): boolean {
  return !!tab.activeStreamId
    && (tab.streamLifecycle === 'streaming' || tab.streamLifecycle === 'ending');
}

export function bumpStreamGeneration(
  streamGenerationRef: MutableRefObject<Record<string, number>>,
  tabId: string,
): void {
  streamGenerationRef.current[tabId] = (streamGenerationRef.current[tabId] ?? 0) + 1;
}

export function canCancelStreamCall(tab: GrpcStudioTabState): boolean {
  if (isGrpcStreamLifecycleTerminal(tab.streamLifecycle)) {
    return false;
  }
  return isGrpcStreamLifecycleInFlight(tab.streamLifecycle) || !!tab.activeStreamId;
}

export function detachStreamEventsWhenSwitchingActiveTab(
  streamDisposeRef: MutableRefObject<Record<string, () => void>>,
  previousActiveId: string | undefined,
): void {
  if (previousActiveId) {
    detachStreamEventsForTab(streamDisposeRef, previousActiveId);
  }
}

export function streamTerminalLifecycleFromGrpcEnd(status?: number): GrpcStreamLifecycle {
  if (status === 1) return 'cancelled';
  if (status === 0 || status === undefined) return 'ended';
  return 'error';
}

/** Build tab streamError with Phase 4F transport details (grpcStatus, tlsFailure, …). */
export function buildStreamEventErrorBody(
  message: string,
  status?: number,
): GrpcErrorBody {
  const classified = classifyGrpcTransportFailure(message, { grpcStatus: status });
  return {
    code: classified.code,
    category: classified.category,
    message: classified.message,
    retryable: classified.retryable,
    details: Object.keys(classified.details).length > 0 ? classified.details : undefined,
  };
}

/** Validation failures before transport I/O (snapshot build, interpolation, call-type guards). */
export function buildStreamValidationErrorBody(message: string): GrpcErrorBody {
  return {
    code: GRPC_ERROR_CODES.INVALID_REQUEST,
    category: 'validation',
    message,
  };
}

/** Prefer server envelope details from GrpcApiClientError; fall back to message classification. */
export function streamErrorFromCaught(error: unknown, fallbackMessage: string): GrpcErrorBody {
  if (error instanceof GrpcApiClientError) {
    return error.toErrorBody();
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  return buildStreamEventErrorBody(message);
}

export function isStreamNotFoundSseError(message: string): boolean {
  return /no active stream|not found|404|REQUEST_NOT_FOUND/i.test(message);
}

export function detachStreamEventsForTab(
  streamDisposeRef: MutableRefObject<Record<string, () => void>>,
  tabId: string,
): void {
  streamDisposeRef.current[tabId]?.();
  delete streamDisposeRef.current[tabId];
}

export function abortTabActiveStream(
  tabId: string,
  tab: GrpcStudioTabState,
  streamGenerationRef: MutableRefObject<Record<string, number>>,
  streamDisposeRef: MutableRefObject<Record<string, () => void>>,
): void {
  if (!tabHasActiveStream(tab) && !tab.activeStreamId) {
    return;
  }
  bumpStreamGeneration(streamGenerationRef, tabId);
  detachStreamEventsForTab(streamDisposeRef, tabId);
  if (tab.activeStreamId) {
    void cancelGrpcStream(tab.activeStreamId, tabId)
      .catch(() => undefined)
      .finally(() => clearGrpcStreamTransportBinding(tabId));
    return;
  }
  clearGrpcStreamTransportBinding(tabId);
}
