import type { Response } from 'express';
import {
  GRPC_STREAM_HEARTBEAT_INTERVAL_MS,
  GRPC_STREAM_MESSAGE_CAP,
  GRPC_STREAM_SSE_DISCONNECT_GRACE_MS,
  type GrpcStreamEvent,
  type GrpcStreamingCallType,
  type GrpcStreamRegistryStatus,
} from '../../src/shared/grpc/contracts.js';
import { closeGrpcStreamSseResponse, writeGrpcStreamSseEvent } from './grpcStreamSse.js';

export interface GrpcStreamTransportHandle {
  callType: GrpcStreamingCallType;
  write(buffer: Buffer): void;
  endWrites(): void;
  cancel(): void;
}

export interface GrpcStreamRegistryEntry {
  streamId: string;
  tabId: string;
  requestId: string;
  callType: GrpcStreamingCallType;
  descriptorKey: string;
  requestTypeName: string;
  status: GrpcStreamRegistryStatus;
  startedAt: number;
  lastActivityAt: number;
  sequence: number;
  clientWritesEnded?: boolean;
  transport: GrpcStreamTransportHandle;
  sseClients: Map<Response, NodeJS.Timeout>;
  graceTimer?: NodeJS.Timeout;
  finalizeTimer?: NodeJS.Timeout;
  /** Buffered SSE events for late attach / reconnect replay. */
  eventLog: GrpcStreamEvent[];
}

export interface RegisterGrpcStreamParams {
  streamId: string;
  tabId: string;
  requestId: string;
  callType: GrpcStreamingCallType;
  descriptorKey: string;
  requestTypeName: string;
  transport: GrpcStreamTransportHandle;
}

const registry = new Map<string, GrpcStreamRegistryEntry>();
const activeRequestIds = new Map<string, string>();

function touchActivity(entry: GrpcStreamRegistryEntry): void {
  entry.lastActivityAt = Date.now();
}

function clearGraceTimer(entry: GrpcStreamRegistryEntry): void {
  if (entry.graceTimer) {
    clearTimeout(entry.graceTimer);
    entry.graceTimer = undefined;
  }
}

function clearFinalizeTimer(entry: GrpcStreamRegistryEntry): void {
  if (entry.finalizeTimer) {
    clearTimeout(entry.finalizeTimer);
    entry.finalizeTimer = undefined;
  }
}

function appendEventLog(entry: GrpcStreamRegistryEntry, event: GrpcStreamEvent): void {
  entry.eventLog.push(event);
  if (entry.eventLog.length > GRPC_STREAM_MESSAGE_CAP) {
    entry.eventLog.shift();
  }
}

function closeSseClient(entry: GrpcStreamRegistryEntry, res: Response): void {
  const heartbeat = entry.sseClients.get(res);
  if (heartbeat) {
    clearInterval(heartbeat);
    entry.sseClients.delete(res);
  }
  closeGrpcStreamSseResponse(res);
}

function closeAllSseClients(entry: GrpcStreamRegistryEntry): void {
  for (const res of entry.sseClients.keys()) {
    closeSseClient(entry, res);
  }
}

function removeEntry(streamId: string): void {
  const entry = registry.get(streamId);
  if (!entry) return;
  clearGraceTimer(entry);
  clearFinalizeTimer(entry);
  closeAllSseClients(entry);
  if (entry.status === 'active') {
    try {
      entry.transport.cancel();
    } catch {
      // Best-effort cleanup.
    }
  }
  activeRequestIds.delete(entry.requestId);
  registry.delete(streamId);
}

export function clearGrpcStreamRegistry(): void {
  for (const streamId of registry.keys()) {
    removeEntry(streamId);
  }
}

export function getGrpcStreamEntry(streamId: string): GrpcStreamRegistryEntry | undefined {
  return registry.get(streamId);
}

export function findActiveGrpcStreamsByTabId(tabId: string): GrpcStreamRegistryEntry[] {
  return [...registry.values()].filter(
    (entry) => entry.tabId === tabId && entry.status === 'active',
  );
}

export function findActiveGrpcStreamByRequestId(requestId: string): GrpcStreamRegistryEntry | undefined {
  const streamId = activeRequestIds.get(requestId);
  if (!streamId) return undefined;
  const entry = registry.get(streamId);
  if (!entry || entry.status !== 'active') return undefined;
  return entry;
}

export function tryRegisterGrpcStream(
  params: RegisterGrpcStreamParams,
): { ok: true } | { ok: false; reason: 'duplicate_active_request' } {
  const existingStreamId = activeRequestIds.get(params.requestId);
  if (existingStreamId) {
    const existing = registry.get(existingStreamId);
    if (existing?.status === 'active') {
      return { ok: false, reason: 'duplicate_active_request' };
    }
    activeRequestIds.delete(params.requestId);
  }

  const now = Date.now();
  registry.set(params.streamId, {
    streamId: params.streamId,
    tabId: params.tabId,
    requestId: params.requestId,
    callType: params.callType,
    descriptorKey: params.descriptorKey,
    requestTypeName: params.requestTypeName,
    status: 'active',
    startedAt: now,
    lastActivityAt: now,
    sequence: 0,
    transport: params.transport,
    sseClients: new Map(),
    eventLog: [],
  });
  activeRequestIds.set(params.requestId, params.streamId);
  return { ok: true };
}

export function cancelActiveGrpcStreamsForTab(tabId: string): string[] {
  const cancelled: string[] = [];
  for (const entry of findActiveGrpcStreamsByTabId(tabId)) {
    if (entry.status !== 'active') continue;
    markGrpcStreamTerminal(entry.streamId, 'cancelled');
    emitGrpcStreamEvent(entry.streamId, {
      type: 'grpc-end',
      status: 1,
      statusMessage: 'Cancelled',
    });
    try {
      entry.transport.cancel();
    } catch {
      // Best-effort.
    }
    scheduleFinalizeAfterTerminal(entry.streamId);
    cancelled.push(entry.streamId);
  }
  return cancelled;
}

/** Keep terminal entries briefly so late SSE attach can replay buffered events. */
export function scheduleFinalizeAfterTerminal(streamId: string): void {
  const entry = registry.get(streamId);
  if (!entry) return;

  if (entry.sseClients.size > 0) {
    return;
  }

  clearFinalizeTimer(entry);
  entry.finalizeTimer = setTimeout(() => {
    finalizeGrpcStreamEntry(streamId);
  }, GRPC_STREAM_SSE_DISCONNECT_GRACE_MS);
  entry.finalizeTimer.unref?.();
}

export function replayBufferedGrpcStreamEvents(
  streamId: string,
  res: Response,
  lastSequence = 0,
): number {
  const entry = registry.get(streamId);
  if (!entry) return 0;

  let replayed = 0;
  for (const event of entry.eventLog) {
    if (event.sequence > lastSequence) {
      writeGrpcStreamSseEvent(res, event.type, event);
      replayed += 1;
    }
  }
  return replayed;
}

export function attachGrpcStreamSseClient(
  streamId: string,
  res: Response,
  onEvent: (event: GrpcStreamEvent) => void,
): 'attached' | 'not_found' {
  const entry = registry.get(streamId);
  if (!entry) return 'not_found';

  clearGraceTimer(entry);
  clearFinalizeTimer(entry);

  const heartbeat = setInterval(() => {
    if (entry.status !== 'active') return;
    const heartbeatEvent: GrpcStreamEvent = {
      type: 'grpc-heartbeat',
      streamId: entry.streamId,
      requestId: entry.requestId,
      tabId: entry.tabId,
      sequence: entry.sequence,
      timestamp: new Date().toISOString(),
    };
    writeGrpcStreamSseEvent(res, 'grpc-heartbeat', heartbeatEvent);
    onEvent(heartbeatEvent);
  }, GRPC_STREAM_HEARTBEAT_INTERVAL_MS);
  heartbeat.unref?.();

  entry.sseClients.set(res, heartbeat);

  res.on('close', () => {
    detachGrpcStreamSseClient(streamId, res);
  });

  return 'attached';
}

export function expireGrpcStreamAfterSseGrace(streamId: string): void {
  const entry = registry.get(streamId);
  if (!entry || entry.status !== 'active' || entry.sseClients.size > 0) {
    return;
  }
  markGrpcStreamTerminal(streamId, 'cancelled');
  emitGrpcStreamEvent(streamId, {
    type: 'grpc-end',
    status: 1,
    statusMessage: 'Cancelled',
  });
  try {
    entry.transport.cancel();
  } catch {
    // Best-effort.
  }
  finalizeGrpcStreamEntry(streamId);
}

export function detachGrpcStreamSseClient(streamId: string, res: Response): void {
  const entry = registry.get(streamId);
  if (!entry) return;

  closeSseClient(entry, res);

  if (entry.sseClients.size > 0) {
    return;
  }

  if (entry.status !== 'active') {
    finalizeGrpcStreamEntry(streamId);
    return;
  }

  clearGraceTimer(entry);
  entry.graceTimer = setTimeout(() => {
    expireGrpcStreamAfterSseGrace(streamId);
  }, GRPC_STREAM_SSE_DISCONNECT_GRACE_MS);
  entry.graceTimer.unref?.();
}

export function emitGrpcStreamEvent(
  streamId: string,
  partial: Omit<GrpcStreamEvent, 'streamId' | 'requestId' | 'tabId' | 'sequence' | 'timestamp'>,
): GrpcStreamEvent | undefined {
  const entry = registry.get(streamId);
  if (!entry) return undefined;

  entry.sequence += 1;
  touchActivity(entry);

  const event: GrpcStreamEvent = {
    streamId: entry.streamId,
    requestId: entry.requestId,
    tabId: entry.tabId,
    sequence: entry.sequence,
    timestamp: new Date().toISOString(),
    ...partial,
  };

  appendEventLog(entry, event);

  for (const res of entry.sseClients.keys()) {
    writeGrpcStreamSseEvent(res, event.type, event);
  }

  return event;
}

export function markGrpcStreamTerminal(
  streamId: string,
  status: Exclude<GrpcStreamRegistryStatus, 'active'>,
): void {
  const entry = registry.get(streamId);
  if (!entry || entry.status !== 'active') return;
  entry.status = status;
  touchActivity(entry);
  activeRequestIds.delete(entry.requestId);
}

export function finalizeGrpcStreamEntry(streamId: string): void {
  const entry = registry.get(streamId);
  if (!entry) return;
  closeAllSseClients(entry);
  removeEntry(streamId);
}

export function cancelGrpcStreamEntry(
  streamId: string,
  tabId: string,
  terminalStatus: 'cancelled' | 'ended' | 'error' = 'cancelled',
): 'cancelled' | 'not_found' | 'tab_mismatch' | 'already_terminal' {
  const entry = registry.get(streamId);
  if (!entry) return 'not_found';
  if (entry.tabId !== tabId) return 'tab_mismatch';
  if (entry.status !== 'active') {
    return 'already_terminal';
  }

  markGrpcStreamTerminal(streamId, terminalStatus);
  try {
    entry.transport.cancel();
  } catch {
    // Best-effort cancel.
  }

  return 'cancelled';
}
