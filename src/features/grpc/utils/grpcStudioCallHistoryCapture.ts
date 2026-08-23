/**
 * Phase 5H — fire-and-forget call history capture from execute outcomes.
 */
import type { GrpcTabExecuteSnapshot } from '@shared/grpc/contracts';
import type { GrpcCallResult, GrpcErrorBody } from '@shared/grpc/contracts';
import { appendGrpcCallHistory } from '../data/grpcCallHistoryRecorder';
import { prepareGrpcCallHistoryExport } from './grpcCrossFeatureExport';
import type { GrpcCallHistoryTemplateContext } from '@shared/grpc/grpcReplayTemplateCompatibility';
import { applyGrpcCallHistoryTemplateContext } from '@shared/grpc/grpcReplayTemplateCompatibility';
import { captureGrpcRpcStatsFromOutcome } from './grpcStudioRpcStatsCapture';
import { prepareGrpcCallMetadata } from '@shared/grpc/grpcCompressionPolicy';
import { isGrpcRedactedPersistValue } from '@shared/grpc/grpcSavedRequest';

export const GRPC_CALL_HISTORY_UPDATED_EVENT = 'grpc-call-history-updated';

// Session-scoped capture cache: preserves request metadata for copy/replay UX without
// weakening persisted history redaction rules. Backed by sessionStorage (not just an
// in-memory Map) so a full page reload — e.g. Vite HMR during dev, or an accidental
// refresh mid-demo — doesn't silently break "Copy grpcurl" / "Replay" restoration for
// calls made earlier in the same browser tab. Still cleared when the tab/window closes,
// so raw secrets never outlive the session or reach durable storage (IndexedDB/localStorage).
const RUNTIME_METADATA_STORAGE_KEY = 'grpc-runtime-history-metadata';
const RUNTIME_METADATA_MAX_ENTRIES = 200;

/** Strip redacted placeholders from a metadata record — stale cache entries from pre-fix code. */
function stripRedactedValues(metadata: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!isGrpcRedactedPersistValue(value)) {
      clean[key] = value;
    }
  }
  return clean;
}

function readRuntimeMetadataStore(): Map<string, Record<string, string>> {
  if (typeof window === 'undefined' || !window.sessionStorage) return new Map();
  try {
    const raw = window.sessionStorage.getItem(RUNTIME_METADATA_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Array<[string, Record<string, string>]>;
    const cleaned = new Map<string, Record<string, string>>();
    for (const [id, metadata] of parsed) {
      const stripped = stripRedactedValues(metadata);
      if (Object.keys(stripped).length > 0) {
        cleaned.set(id, stripped);
      }
    }
    return cleaned;
  } catch {
    return new Map();
  }
}

const runtimeHistoryMetadataByEntryId = readRuntimeMetadataStore();

function persistRuntimeMetadataStore(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const entries = [...runtimeHistoryMetadataByEntryId.entries()];
    const trimmed = entries.length > RUNTIME_METADATA_MAX_ENTRIES
      ? entries.slice(entries.length - RUNTIME_METADATA_MAX_ENTRIES)
      : entries;
    window.sessionStorage.setItem(RUNTIME_METADATA_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* sessionStorage best-effort — quota/availability issues never block calls */
  }
}

function setRuntimeGrpcHistoryMetadata(entryId: string, metadata: Record<string, string>): void {
  const clean = stripRedactedValues(metadata);
  if (Object.keys(clean).length === 0) return;
  runtimeHistoryMetadataByEntryId.set(entryId, clean);
  if (runtimeHistoryMetadataByEntryId.size > RUNTIME_METADATA_MAX_ENTRIES) {
    const oldestKey = runtimeHistoryMetadataByEntryId.keys().next().value;
    if (oldestKey !== undefined) runtimeHistoryMetadataByEntryId.delete(oldestKey);
  }
  persistRuntimeMetadataStore();
}

function dispatchHistoryUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GRPC_CALL_HISTORY_UPDATED_EVENT));
  }
}

export function getRuntimeGrpcHistoryMetadata(entryId: string): Record<string, string> | undefined {
  const metadata = runtimeHistoryMetadataByEntryId.get(entryId);
  return metadata ? { ...metadata } : undefined;
}

/** Drop all cached runtime metadata — call when the user clears call history entirely. */
export function clearAllRuntimeGrpcHistoryMetadata(): void {
  runtimeHistoryMetadataByEntryId.clear();
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(RUNTIME_METADATA_STORAGE_KEY);
    } catch {
      /* best-effort */
    }
  }
}

export const clearRuntimeGrpcHistoryMetadataForTests = clearAllRuntimeGrpcHistoryMetadata;

/** Append a redacted history row without blocking the UI thread. */
export function captureGrpcCallHistoryFromOutcome(input: {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallResult;
  error?: GrpcErrorBody;
  templateContext?: GrpcCallHistoryTemplateContext;
  statsSource?: 'unary' | 'stream_terminal' | false;
  streamTiming?: { startedAt?: string; endedAt?: string };
}): void {
  const runtimeRequestMetadata = (() => {
    try {
      return prepareGrpcCallMetadata(
        input.snapshot.metadata,
        input.snapshot.auth,
        input.snapshot.compression,
      ) ?? { ...input.snapshot.metadata };
    } catch {
      return { ...input.snapshot.metadata };
    }
  })();

  const { snapshot, filterTarget } = applyGrpcCallHistoryTemplateContext(
    input.snapshot,
    input.templateContext,
  );
  const record = prepareGrpcCallHistoryExport({
    snapshot,
    result: input.result,
    error: input.error,
  });
  void appendGrpcCallHistory({
    snapshot: record.snapshot,
    result: record.result,
    error: record.error,
    filterTarget,
  })
    .then((entry) => {
      if (entry?.id) {
        setRuntimeGrpcHistoryMetadata(entry.id, runtimeRequestMetadata);
      }
      dispatchHistoryUpdated();
    })
    .catch(() => {
      /* history is best-effort — never block calls */
    });
  if (input.statsSource !== false) {
    const streamTiming = input.streamTiming?.startedAt
      ? input.streamTiming
      : undefined;
    captureGrpcRpcStatsFromOutcome({
      snapshot,
      result: input.result,
      error: input.error,
      source: input.statsSource ?? 'unary',
      streamTiming,
    });
  }
}

/** Capture history when a stream reaches a terminal lifecycle. */
export function captureGrpcCallHistoryFromStreamTerminal(
  tab: {
    lastExecuteSnapshot?: GrpcTabExecuteSnapshot;
    streamError?: GrpcErrorBody;
    target?: string;
    streamStartedAt?: string;
    streamEndedAt?: string;
  },
  overrides?: {
    error?: GrpcErrorBody;
    result?: GrpcCallResult;
  },
): void {
  if (!tab.lastExecuteSnapshot) return;
  const templateContext = tab.target?.trim()
    ? {
        rawTarget: tab.target,
        filterTarget: tab.lastExecuteSnapshot.target.address,
      }
    : undefined;
  const streamTiming = tab.streamStartedAt
    ? { startedAt: tab.streamStartedAt, endedAt: tab.streamEndedAt }
    : undefined;
  captureGrpcCallHistoryFromOutcome({
    snapshot: tab.lastExecuteSnapshot,
    error: overrides?.error ?? tab.streamError,
    result: overrides?.result,
    templateContext,
    statsSource: 'stream_terminal',
    streamTiming,
  });
}
