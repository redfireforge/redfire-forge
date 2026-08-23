/**
 * Phase 6E — JSONPath resolution for grpcField assertions against step results.
 */
import { getByPath, stripJsonPathPrefix } from '@shared/utils/jsonPath';
import type { GrpcWorkflowStepResult } from '../types/workflow/node-grpc';

/** Resolve a grpcField path against a frozen step result payload. */
export function resolveGrpcAssertFieldValue(
  fieldPath: string,
  result: GrpcWorkflowStepResult,
): unknown {
  const trimmed = fieldPath.trim();
  if (!trimmed) return undefined;

  if (/^messages\[\d+\]/i.test(trimmed)) {
    const root = { messages: result.messages ?? [] };
    const normalized = trimmed.replace(/^messages\[(\d+)\]/i, 'messages.$1');
    return getByPath(root, normalized.startsWith('$.') ? stripJsonPathPrefix(normalized) : normalized);
  }

  if (result.callType === 'unary') {
    const path = trimmed.startsWith('$.') ? stripJsonPathPrefix(trimmed) : trimmed;
    return getByPath(result.body ?? {}, path);
  }

  const messages = result.messages ?? [];
  const lastMessage = messages[messages.length - 1] ?? {};
  const path = trimmed.startsWith('$.') ? stripJsonPathPrefix(trimmed) : trimmed;
  return getByPath(lastMessage, path);
}
