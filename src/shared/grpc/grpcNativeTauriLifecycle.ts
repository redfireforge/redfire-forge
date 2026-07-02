/**
 * Native Tauri lifecycle commands — Phase 7H.
 */
import {
  GRPC_TAURI_SCHEMA_VERSION,
  type GrpcTauriEnvelope,
  type GrpcTauriTabCleanupRequest,
  type GrpcTauriTabCleanupResult,
} from './grpcTauriContracts';

export class GrpcNativeTauriLifecycleError extends Error {
  readonly code: string;
  readonly op: 'tab_cleanup' | 'tab_events_attach' | 'tab_events_detach' | 'tab_heartbeat';
  readonly retryable: boolean;

  constructor(
    op: 'tab_cleanup' | 'tab_events_attach' | 'tab_events_detach' | 'tab_heartbeat',
    message: string,
    options?: { code?: string; retryable?: boolean },
  ) {
    super(message);
    this.name = 'GrpcNativeTauriLifecycleError';
    this.op = op;
    this.code = options?.code ?? 'GRPC_TAURI_INVOKE_ERROR';
    this.retryable = options?.retryable ?? false;
  }
}

function throwIfEnvelopeNotOk<T>(
  op: 'tab_cleanup' | 'tab_events_attach' | 'tab_events_detach' | 'tab_heartbeat',
  envelope: GrpcTauriEnvelope<T>,
): asserts envelope is Extract<GrpcTauriEnvelope<T>, { ok: true }> {
  if (!envelope.ok) {
    throw new GrpcNativeTauriLifecycleError(op, envelope.error.message, {
      code: envelope.error.code,
      retryable: envelope.error.retryable ?? false,
    });
  }
}

export function toGrpcTauriTabCleanupRequest(tabId: string): GrpcTauriTabCleanupRequest {
  return {
    schemaVersion: GRPC_TAURI_SCHEMA_VERSION,
    tabId,
  };
}

export async function invokeGrpcTabCleanupNative(
  tabId: string,
): Promise<GrpcTauriTabCleanupResult> {
  const { invoke } = await import('@tauri-apps/api/core');
  const request = toGrpcTauriTabCleanupRequest(tabId);

  let envelope: GrpcTauriEnvelope<GrpcTauriTabCleanupResult>;
  try {
    envelope = await invoke<GrpcTauriEnvelope<GrpcTauriTabCleanupResult>>('grpc_tab_cleanup', { request });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriLifecycleError('tab_cleanup', message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }

  throwIfEnvelopeNotOk('tab_cleanup', envelope);
  return envelope.data;
}

async function invokeTabEventsSignal(
  command: 'grpc_tab_events_attach' | 'grpc_tab_events_detach' | 'grpc_tab_heartbeat',
  tabId: string,
  options: { bestEffort?: boolean },
): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  const request = toGrpcTauriTabCleanupRequest(tabId);
  const op =
    command === 'grpc_tab_events_attach'
      ? 'tab_events_attach'
      : command === 'grpc_tab_events_detach'
        ? 'tab_events_detach'
        : 'tab_heartbeat';

  let envelope: GrpcTauriEnvelope<{ tabId: string; listenerCount: number }>;
  try {
    envelope = await invoke(command, { request });
  } catch (error) {
    if (options.bestEffort) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new GrpcNativeTauriLifecycleError(op, message, {
      code: 'GRPC_TAURI_INVOKE_ERROR',
      retryable: true,
    });
  }

  if (!envelope.ok) {
    if (options.bestEffort) {
      return;
    }
    throw new GrpcNativeTauriLifecycleError(op, envelope.error.message, {
      code: envelope.error.code,
      retryable: envelope.error.retryable ?? false,
    });
  }
}

export async function invokeGrpcTabEventsAttachNative(tabId: string): Promise<void> {
  await invokeTabEventsSignal('grpc_tab_events_attach', tabId, { bestEffort: false });
}

export async function invokeGrpcTabEventsDetachNative(tabId: string): Promise<void> {
  await invokeTabEventsSignal('grpc_tab_events_detach', tabId, { bestEffort: true });
}

export async function invokeGrpcTabHeartbeatNative(tabId: string): Promise<void> {
  await invokeTabEventsSignal('grpc_tab_heartbeat', tabId, { bestEffort: true });
}

export const GRPC_TAB_HEARTBEAT_INTERVAL_MS = 15_000;

type GrpcHeartbeatEntry = {
  refs: number;
  timer: ReturnType<typeof setInterval>;
};

const heartbeatByTab = new Map<string, GrpcHeartbeatEntry>();

/**
 * Starts (or joins) a shared per-tab heartbeat loop and returns a release function.
 * Heartbeats are best-effort because tab-local cleanup should continue on renderer teardown.
 */
export function retainGrpcTabHeartbeat(tabId: string): () => void {
  const existing = heartbeatByTab.get(tabId);
  if (existing) {
    existing.refs += 1;
    return () => releaseGrpcTabHeartbeat(tabId);
  }

  void invokeGrpcTabHeartbeatNative(tabId);
  const timer = setInterval(() => {
    void invokeGrpcTabHeartbeatNative(tabId);
  }, GRPC_TAB_HEARTBEAT_INTERVAL_MS);

  heartbeatByTab.set(tabId, { refs: 1, timer });
  return () => releaseGrpcTabHeartbeat(tabId);
}

function releaseGrpcTabHeartbeat(tabId: string): void {
  const entry = heartbeatByTab.get(tabId);
  if (!entry) {
    return;
  }
  entry.refs -= 1;
  if (entry.refs <= 0) {
    clearInterval(entry.timer);
    heartbeatByTab.delete(tabId);
  }
}

export function resetGrpcTabHeartbeatForTests(): void {
  for (const entry of heartbeatByTab.values()) {
    clearInterval(entry.timer);
  }
  heartbeatByTab.clear();
}
