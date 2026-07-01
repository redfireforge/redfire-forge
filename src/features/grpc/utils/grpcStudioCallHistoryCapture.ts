/**
 * Phase 5H — fire-and-forget call history capture from execute outcomes.
 */
import type { GrpcTabExecuteSnapshot } from '../../../shared/grpc/contracts';
import type { GrpcCallResult, GrpcErrorBody } from '../../../shared/grpc/contracts';
import { appendGrpcCallHistory } from '../data/grpcCallHistoryRecorder';
import { prepareGrpcCallHistoryExport } from './grpcCrossFeatureExport';
import type { GrpcCallHistoryTemplateContext } from '../../../shared/grpc/grpcReplayTemplateCompatibility';
import { applyGrpcCallHistoryTemplateContext } from '../../../shared/grpc/grpcReplayTemplateCompatibility';

export const GRPC_CALL_HISTORY_UPDATED_EVENT = 'grpc-call-history-updated';

function dispatchHistoryUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GRPC_CALL_HISTORY_UPDATED_EVENT));
  }
}

/** Append a redacted history row without blocking the UI thread. */
export function captureGrpcCallHistoryFromOutcome(input: {
  snapshot: GrpcTabExecuteSnapshot;
  result?: GrpcCallResult;
  error?: GrpcErrorBody;
  templateContext?: GrpcCallHistoryTemplateContext;
}): void {
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
    .then(() => dispatchHistoryUpdated())
    .catch(() => {
      /* history is best-effort — never block calls */
    });
}

/** Capture history when a stream reaches a terminal lifecycle. */
export function captureGrpcCallHistoryFromStreamTerminal(
  tab: {
    lastExecuteSnapshot?: GrpcTabExecuteSnapshot;
    streamError?: GrpcErrorBody;
    target?: string;
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
  captureGrpcCallHistoryFromOutcome({
    snapshot: tab.lastExecuteSnapshot,
    error: overrides?.error ?? tab.streamError,
    result: overrides?.result,
    templateContext,
  });
}
