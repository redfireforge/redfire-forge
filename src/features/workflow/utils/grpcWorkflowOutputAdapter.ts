/**
 * Phase 6G — gRPC workflow output adapter.
 *
 * Converts raw step result data (GrpcWorkflowStepResult + metadata) into
 * display-ready structures:
 *   - GrpcNodeStatusMeta  → populated on NodeRunStatus.grpcMeta
 *   - responseDetail string → populated on NodeRunStatus.responseDetail
 *
 * No network I/O, no side effects — pure transformation only.
 */
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';
import type { GrpcNodeStatusMeta } from '../types/workflow/node-grpc';
import { truncate } from '../../../shared/utils/helpers';

const MAX_BODY_PREVIEW = 512;

/** Well-known gRPC canonical status codes for human-readable display. */
const GRPC_STATUS_NAMES: Record<number, string> = {
  0: 'OK',
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
};

export function grpcStatusLabel(code: number | undefined): string {
  if (code === undefined) return 'UNKNOWN';
  return GRPC_STATUS_NAMES[code] ?? `STATUS_${code}`;
}

export interface GrpcOutputAdapterMeta {
  service: string;
  method: string;
  target: string;
  callType: 'unary' | 'server_streaming' | 'assert';
  attempts?: number;
  /** Source node id or saveAs alias for assert nodes */
  assertSource?: string;
}

/** Build a GrpcNodeStatusMeta from step result + execution metadata. */
export function buildGrpcNodeStatusMeta(
  stepResult: GrpcWorkflowStepResult | undefined,
  meta: GrpcOutputAdapterMeta,
): GrpcNodeStatusMeta {
  if (!stepResult) {
    return {
      service: meta.service,
      method: meta.method,
      target: meta.target,
      callType: meta.callType,
      attempts: meta.attempts,
    };
  }

  const bodySource =
    stepResult.body ?? stepResult.messages?.[stepResult.messages.length - 1];
  const bodyPreview = bodySource
    ? truncate(JSON.stringify(bodySource), MAX_BODY_PREVIEW)
    : undefined;

  return {
    service: meta.service,
    method: meta.method,
    target: meta.target,
    callType: meta.callType,
    grpcStatus: stepResult.grpcStatus,
    grpcStatusMessage: stepResult.grpcStatusMessage,
    messageCount: stepResult.messages?.length,
    streamStopReason: stepResult.streamStopReason,
    attempts: meta.attempts,
    assertionFailures: stepResult.assertionFailures,
    bodyPreview,
  };
}

/** Format a gRPC call step result into a multi-line detail string for NodeRunStatus.responseDetail. */
export function formatGrpcNodeRunDetail(
  stepResult: GrpcWorkflowStepResult,
  meta: GrpcOutputAdapterMeta,
): string {
  const lines: string[] = [];

  if (meta.callType === 'assert') {
    lines.push(`ASSERT source=${meta.assertSource ?? meta.target}`);
    if (stepResult.assertionFailures?.length) {
      lines.push('');
      lines.push('Assertion failures:');
      for (const f of stepResult.assertionFailures) {
        lines.push(`  • ${f}`);
      }
    } else {
      lines.push('All assertions passed');
    }
    if (stepResult.durationMs !== undefined) {
      lines.push('');
      lines.push(`Duration: ${stepResult.durationMs}ms`);
    }
    return lines.join('\n');
  }

  const callLabel = meta.callType === 'server_streaming' ? 'SERVER_STREAM' : 'UNARY';
  lines.push(`${callLabel} ${meta.service}/${meta.method} → ${meta.target}`);

  const statusCode = stepResult.grpcStatus ?? 0;
  const statusName = grpcStatusLabel(statusCode);
  const statusMsg = stepResult.grpcStatusMessage
    ? ` (${stepResult.grpcStatusMessage})`
    : '';
  const durationPart =
    stepResult.durationMs !== undefined ? ` · ${stepResult.durationMs}ms` : '';
  lines.push(`gRPC ${statusCode} ${statusName}${statusMsg}${durationPart}`);

  if (meta.attempts !== undefined && meta.attempts > 1) {
    lines.push(`Attempts: ${meta.attempts}`);
  }

  if (stepResult.errorDetail) {
    lines.push('');
    lines.push(stepResult.errorDetail);
  }

  if (meta.callType === 'server_streaming' && stepResult.messages !== undefined) {
    lines.push('');
    lines.push(`Messages collected: ${stepResult.messages.length}`);
    if (stepResult.streamStopReason) {
      lines.push(`Stop reason: ${stepResult.streamStopReason}`);
    }
    if (stepResult.messages.length > 0) {
      lines.push('');
      lines.push('Last message:');
      const last = stepResult.messages[stepResult.messages.length - 1];
      const preview = truncate(JSON.stringify(last, null, 2), MAX_BODY_PREVIEW);
      lines.push(preview);
    }
  } else if (stepResult.body !== undefined) {
    lines.push('');
    lines.push('Response body:');
    const preview = truncate(JSON.stringify(stepResult.body, null, 2), MAX_BODY_PREVIEW);
    lines.push(preview);
  }

  if (stepResult.trailers && Object.keys(stepResult.trailers).length > 0) {
    lines.push('');
    lines.push('Trailers:');
    for (const [k, v] of Object.entries(stepResult.trailers)) {
      lines.push(`  ${k}: ${v}`);
    }
  }

  return lines.join('\n');
}
