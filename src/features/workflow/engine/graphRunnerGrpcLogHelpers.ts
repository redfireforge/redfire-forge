/** Console log helpers for gRPC workflow nodes — mirrors GraphQL/HTTP detail level. */

import type { GrpcAuthConfig } from '@shared/grpc/contracts';
import { prepareGrpcExecuteRequestMetadata } from '@shared/grpc/grpcAuthPolicy';
import { redactGrpcMetadataForDisplay } from '@shared/grpc/grpcRedaction';
import type { GrpcWorkflowAssertion, GrpcWorkflowStepResult } from '../types/workflow/node-grpc';
import { grpcStatusLabel } from '../utils/grpcWorkflowOutputAdapter';
import { previewForConsoleLog } from './graphRunnerGraphqlLogHelpers';

export type GrpcConsoleLogFn = (line: { prefix: string; text: string }) => void;

export function resolveGrpcRequestMetadataForLog(
  metadata: Record<string, string> | undefined,
  auth: GrpcAuthConfig | undefined,
): Record<string, string> {
  try {
    return prepareGrpcExecuteRequestMetadata(metadata, auth) ?? {};
  } catch {
    return metadata ?? {};
  }
}

export function logGrpcRequestMetadata(
  label: string,
  log: GrpcConsoleLogFn,
  metadata: Record<string, string> | undefined,
  auth: GrpcAuthConfig | undefined,
): void {
  if (auth?.type === 'oauth2') {
    log({ prefix: '→', text: `[${label}]   Auth: oauth2 (token acquired server-side)` });
  }

  const effective = resolveGrpcRequestMetadataForLog(metadata, auth);
  if (Object.keys(effective).length === 0) {
    if (auth?.type && auth.type !== 'none' && auth.type !== 'oauth2') {
      log({ prefix: '→', text: `[${label}]   Auth: ${auth.type}` });
    }
    return;
  }

  const display = redactGrpcMetadataForDisplay(effective, { maskNonSecret: false });
  for (const key of Object.keys(display).sort()) {
    log({ prefix: '→', text: `[${label}]   ${key}: ${display[key]}` });
  }
}

export function logGrpcRequestBody(
  label: string,
  log: GrpcConsoleLogFn,
  body: Record<string, unknown> | undefined,
): void {
  if (!body || Object.keys(body).length === 0) return;
  log({ prefix: '→', text: `[${label}]   Request: ${previewForConsoleLog(body)}` });
}

export function logGrpcCallResponse(
  label: string,
  log: GrpcConsoleLogFn,
  stepResult: GrpcWorkflowStepResult,
  opts?: { attempts?: number },
): void {
  const statusCode = stepResult.grpcStatus ?? 0;
  const statusName = grpcStatusLabel(statusCode);
  const statusMsg = stepResult.grpcStatusMessage ? ` (${stepResult.grpcStatusMessage})` : '';
  const durationPart = stepResult.durationMs !== undefined ? ` — ${stepResult.durationMs}ms` : '';
  log({ prefix: '←', text: `[${label}] gRPC ${statusCode} ${statusName}${statusMsg}${durationPart}` });

  if (opts?.attempts !== undefined && opts.attempts > 1) {
    log({ prefix: '←', text: `[${label}]   Attempts: ${opts.attempts}` });
  }

  if (stepResult.callType === 'server_streaming' && stepResult.messages !== undefined) {
    log({ prefix: '←', text: `[${label}]   Messages: ${stepResult.messages.length}` });
    if (stepResult.streamStopReason) {
      log({ prefix: '←', text: `[${label}]   Stop reason: ${stepResult.streamStopReason}` });
    }
    if (stepResult.messages.length > 0) {
      const last = stepResult.messages[stepResult.messages.length - 1];
      log({ prefix: '←', text: `[${label}]   Last message: ${previewForConsoleLog(last)}` });
    }
    return;
  }

  if (stepResult.body !== undefined) {
    log({ prefix: '←', text: `[${label}]   Response: ${previewForConsoleLog(stepResult.body)}` });
  }

  if (stepResult.trailers && Object.keys(stepResult.trailers).length > 0) {
    log({ prefix: '←', text: `[${label}]   Trailers: ${previewForConsoleLog(stepResult.trailers)}` });
  }
}

export function logGrpcSaveAs(
  label: string,
  log: GrpcConsoleLogFn,
  saveAs: string | undefined,
): void {
  const alias = saveAs?.trim();
  if (!alias) return;
  log({ prefix: '#', text: `[${label}] saveAs=${alias} → steps.${alias}.*` });
}

export function describeGrpcAssertion(assertion: GrpcWorkflowAssertion): string {
  if ('grpcStatus' in assertion) {
    return `grpcStatus = ${assertion.grpcStatus}`;
  }
  if ('grpcField' in assertion) {
    const field = assertion.grpcField;
    if (assertion.exists !== undefined) {
      return `grpcField "${field}" exists = ${assertion.exists}`;
    }
    if (assertion.equals !== undefined) {
      return `grpcField "${field}" equals ${previewForConsoleLog(assertion.equals, 80)}`;
    }
    if (assertion.contains !== undefined) {
      return `grpcField "${field}" contains ${previewForConsoleLog(assertion.contains, 80)}`;
    }
    return `grpcField "${field}"`;
  }
  if ('grpcTrailer' in assertion) {
    const trailer = assertion.grpcTrailer;
    if (assertion.exists !== undefined) {
      return `grpcTrailer "${trailer}" exists = ${assertion.exists}`;
    }
    if (assertion.equals !== undefined) {
      return `grpcTrailer "${trailer}" equals ${assertion.equals}`;
    }
    return `grpcTrailer "${trailer}"`;
  }
  if ('grpcDuration' in assertion) {
    const duration = assertion.grpcDuration;
    const parts: string[] = [];
    if (duration.max !== undefined) parts.push(`max ${duration.max}ms`);
    if (duration.min !== undefined) parts.push(`min ${duration.min}ms`);
    return `grpcDuration ${parts.join(', ') || '(empty)'}`;
  }
  if ('grpcStreamLength' in assertion) {
    const length = assertion.grpcStreamLength;
    const parts: string[] = [];
    if (length.equals !== undefined) parts.push(`equals ${length.equals}`);
    if (length.min !== undefined) parts.push(`min ${length.min}`);
    if (length.max !== undefined) parts.push(`max ${length.max}`);
    return `grpcStreamLength ${parts.join(', ') || '(empty)'}`;
  }
  return 'assertion';
}

export function logGrpcAssertUpstream(
  label: string,
  log: GrpcConsoleLogFn,
  upstream: GrpcWorkflowStepResult,
): void {
  const statusCode = upstream.grpcStatus ?? 0;
  const statusName = grpcStatusLabel(statusCode);
  log({
    prefix: '→',
    text: `[${label}]   Upstream: ${upstream.callType} gRPC ${statusCode} ${statusName}`,
  });
  if (upstream.body !== undefined) {
    log({ prefix: '→', text: `[${label}]   Upstream response: ${previewForConsoleLog(upstream.body)}` });
  } else if (upstream.messages?.length) {
    const last = upstream.messages[upstream.messages.length - 1];
    log({ prefix: '→', text: `[${label}]   Upstream last message: ${previewForConsoleLog(last)}` });
  }
}

export function logGrpcAssertionResults(
  label: string,
  log: GrpcConsoleLogFn,
  assertions: GrpcWorkflowAssertion[],
  passed: boolean,
  failures: string[],
): void {
  assertions.forEach((assertion, index) => {
    const description = describeGrpcAssertion(assertion);
    if (passed) {
      log({ prefix: '✓', text: `[${label}]   ✓ ${description}` });
      return;
    }
    const failure = failures.find((f) => f.startsWith(`assertions[${index}]:`));
    if (failure) {
      log({ prefix: '!', text: `[${label}]   ✗ ${failure.replace(/^assertions\[\d+\]:\s*/, '')}` });
    } else {
      log({ prefix: '✓', text: `[${label}]   ✓ ${description}` });
    }
  });
}
