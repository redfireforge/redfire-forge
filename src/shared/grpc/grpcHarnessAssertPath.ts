/**
 * Phase 8D — JSONPath resolution for harness gRPC assertions.
 */
import { getByPath, stripJsonPathPrefix } from '../utils/jsonPath';
import type { GrpcHarnessCallOutcome } from '../types/grpc-harness-snapshot';

function normalizePath(fieldPath: string): string {
  const trimmed = fieldPath.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('$.') ? stripJsonPathPrefix(trimmed) : trimmed;
}

function resolveFromObject(root: Record<string, unknown>, fieldPath: string): unknown {
  const path = normalizePath(fieldPath);
  if (!path) return undefined;
  return getByPath(root, path);
}

/** True when a stream terminal body carries at least one field (empty `{}` is treated as absent). */
export function hasGrpcHarnessTerminalBody(body: Record<string, unknown> | undefined): boolean {
  return body != null && Object.keys(body).length > 0;
}

/** Resolve a grpcField path against a harness call outcome. */
export function resolveGrpcHarnessFieldValue(
  fieldPath: string,
  outcome: GrpcHarnessCallOutcome,
): unknown {
  const trimmed = fieldPath.trim();
  if (!trimmed) return undefined;

  if (/^messages\[\d+\]/i.test(trimmed)) {
    const root = { messages: outcome.messages ?? [] };
    const normalized = trimmed.replace(/^messages\[(\d+)\]/i, 'messages.$1');
    const path = normalized.startsWith('$.') ? stripJsonPathPrefix(normalized) : normalized;
    return getByPath(root, path);
  }

  if (outcome.callType === 'unary') {
    return resolveFromObject(outcome.body ?? {}, trimmed);
  }

  if (outcome.callType === 'client_streaming') {
    if (hasGrpcHarnessTerminalBody(outcome.body)) {
      return resolveFromObject(outcome.body!, trimmed);
    }
    const clientMessages = outcome.messages ?? [];
    if (clientMessages.length > 0) {
      const lastClientMessage = clientMessages[clientMessages.length - 1] ?? {};
      return resolveFromObject(lastClientMessage as Record<string, unknown>, trimmed);
    }
    return undefined;
  }

  const messages = outcome.messages ?? [];
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1] ?? {};
    return resolveFromObject(lastMessage as Record<string, unknown>, trimmed);
  }

  // Bidi (or server) streams with only a terminal grpc-end body and no inbound frames.
  if (outcome.body) {
    return resolveFromObject(outcome.body, trimmed);
  }

  return undefined;
}

/** Resolve a grpcStreamField path within messages[index]. */
export function resolveGrpcHarnessStreamFieldValue(
  fieldPath: string,
  index: number,
  outcome: GrpcHarnessCallOutcome,
): unknown {
  const messages = outcome.messages ?? [];
  const message = messages[index];
  if (message === undefined) return undefined;
  return resolveFromObject(message, fieldPath);
}

/** Inbound stream message count for grpcStreamLength assertions. */
export function resolveGrpcHarnessStreamLength(outcome: GrpcHarnessCallOutcome): number {
  return outcome.messages?.length ?? 0;
}
