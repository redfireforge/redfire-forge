/**
 * gRPC Studio — client-streaming pending queue helpers (Phase 2 mockup 02).
 */
export const GRPC_STREAM_PENDING_QUEUE_CAP = 500;

export function previewGrpcStreamPendingBody(body: Record<string, unknown>): string {
  try {
    const text = JSON.stringify(body);
    return text.length > 48 ? `${text.slice(0, 45)}…` : text;
  } catch {
    return String(body);
  }
}

export function appendGrpcStreamPendingBody(
  queue: Record<string, unknown>[],
  body: Record<string, unknown>,
): Record<string, unknown>[] {
  const next = [...queue, structuredClone(body)];
  if (next.length <= GRPC_STREAM_PENDING_QUEUE_CAP) {
    return next;
  }
  return next.slice(next.length - GRPC_STREAM_PENDING_QUEUE_CAP);
}

export function removeGrpcStreamPendingBodyAtIndex(
  queue: Record<string, unknown>[],
  index: number,
): Record<string, unknown>[] {
  if (index < 0 || index >= queue.length) return queue;
  return queue.filter((_, entryIndex) => entryIndex !== index);
}
