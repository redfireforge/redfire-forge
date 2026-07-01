/**
 * Tauri gRPC stream event adapter — Phase 7D.
 *
 * Listens on `grpc-event-{tabId}`, deduplicates by sequence, and normalizes
 * `GrpcTauriEvent` → `GrpcStreamEvent` for existing stream session code.
 */
import type { GrpcStreamEvent } from './contracts';
import {
  GRPC_TAURI_EVENT_REORDER_BUFFER,
  GRPC_TAURI_SCHEMA_VERSION,
  grpcTauriEventChannel,
  type GrpcTauriEvent,
} from './grpcTauriContracts';
import { shouldAcceptGrpcStreamSequence } from './grpcStreamClient';
import {
  invokeGrpcTabEventsAttachNative,
  invokeGrpcTabEventsDetachNative,
} from './grpcNativeTauriLifecycle';

export type GrpcTauriEventListener = (event: GrpcStreamEvent) => void;

export interface GrpcTauriEventAdapterOptions {
  tabId: string;
  streamId: string;
  requestId?: string;
  onEvent: GrpcTauriEventListener;
  onError?: (message: string) => void;
  resolveLastSequence?: () => number;
}

export interface GrpcTauriEventAdapterHandle {
  dispose: () => void;
}

export function normalizeGrpcTauriEvent(event: GrpcTauriEvent): GrpcStreamEvent | null {
  if (event.schemaVersion !== GRPC_TAURI_SCHEMA_VERSION) {
    return null;
  }
  return {
    type: event.type,
    streamId: event.streamId,
    requestId: event.requestId,
    tabId: event.tabId,
    sequence: event.sequence,
    timestamp: event.timestamp,
    data: event.data,
    direction: event.direction,
    headers: event.headers,
    trailers: event.trailers,
    status: event.grpcStatus,
    statusMessage: event.grpcStatusMessage,
  };
}

export function shouldAcceptGrpcTauriEventForStream(
  event: GrpcTauriEvent,
  streamId: string,
  tabId: string,
  lastSequence: number,
  requestId?: string,
): boolean {
  if (event.streamId !== streamId || event.tabId !== tabId) {
    return false;
  }
  if (requestId && event.requestId !== requestId) {
    return false;
  }
  return shouldAcceptGrpcStreamSequence(event.sequence, lastSequence);
}

export class GrpcTauriEventSequenceBuffer {
  private lastSequence: number;
  private pending = new Map<number, GrpcStreamEvent>();

  constructor(initialSequence = 0) {
    this.lastSequence = initialSequence;
  }

  accept(event: GrpcStreamEvent): GrpcStreamEvent[] {
    if (!shouldAcceptGrpcStreamSequence(event.sequence, this.lastSequence)) {
      return [];
    }

    this.pending.set(event.sequence, event);
    const released: GrpcStreamEvent[] = [];

    while (this.pending.has(this.lastSequence + 1)) {
      const next = this.pending.get(this.lastSequence + 1)!;
      this.pending.delete(this.lastSequence + 1);
      this.lastSequence = next.sequence;
      released.push(next);
    }

    if (this.pending.size > GRPC_TAURI_EVENT_REORDER_BUFFER) {
      const overflow = [...this.pending.keys()].sort((a, b) => a - b);
      for (const key of overflow.slice(0, overflow.length - GRPC_TAURI_EVENT_REORDER_BUFFER)) {
        this.pending.delete(key);
      }
    }

    return released;
  }

  getLastSequence(): number {
    return this.lastSequence;
  }
}

export async function listenGrpcTauriStreamEvents(
  options: GrpcTauriEventAdapterOptions,
): Promise<GrpcTauriEventAdapterHandle> {
  const { listen } = await import('@tauri-apps/api/event');
  const buffer = new GrpcTauriEventSequenceBuffer(options.resolveLastSequence?.() ?? 0);

  const unlisten = await listen<GrpcTauriEvent>(grpcTauriEventChannel(options.tabId), (payload) => {
    const raw = payload.payload;
    if (!shouldAcceptGrpcTauriEventForStream(
      raw,
      options.streamId,
      options.tabId,
      buffer.getLastSequence(),
      options.requestId,
    )) {
      return;
    }

    const normalized = normalizeGrpcTauriEvent(raw);
    if (!normalized) {
      options.onError?.('Native gRPC event schema version mismatch');
      return;
    }

    for (const event of buffer.accept(normalized)) {
      options.onEvent(event);
    }
  });

  try {
    await invokeGrpcTabEventsAttachNative(options.tabId);
  } catch (error) {
    void unlisten();
    throw error;
  }

  return {
    dispose: () => {
      void invokeGrpcTabEventsDetachNative(options.tabId);
      void unlisten();
    },
  };
}
