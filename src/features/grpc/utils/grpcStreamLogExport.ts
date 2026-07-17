/**
 * gRPC Studio — stream message log JSON export (Phase 2 mockup 02).
 */
import type { GrpcStreamLogEntry } from '../../../shared/grpc/contracts';

export interface GrpcStreamLogExportMeta {
  exportedAt: string;
  service?: string;
  method?: string;
  callType?: string;
  streamLifecycle?: string;
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  startedAt?: string;
  endedAt?: string;
}

export interface GrpcStreamLogExportPayload {
  _meta: GrpcStreamLogExportMeta;
  messages: Array<{
    sequence: number;
    timestamp: string;
    direction: GrpcStreamLogEntry['direction'];
    data: Record<string, unknown>;
  }>;
}

export function buildGrpcStreamLogExportPayload(input: {
  messages: GrpcStreamLogEntry[];
  service?: string;
  method?: string;
  callType?: string;
  streamLifecycle?: string;
  startedAt?: string;
  endedAt?: string;
}): GrpcStreamLogExportPayload {
  let inboundCount = 0;
  let outboundCount = 0;
  for (const entry of input.messages) {
    if (entry.direction === 'inbound') inboundCount += 1;
    else outboundCount += 1;
  }

  return {
    _meta: {
      exportedAt: new Date().toISOString(),
      service: input.service,
      method: input.method,
      callType: input.callType,
      streamLifecycle: input.streamLifecycle,
      totalMessages: input.messages.length,
      inboundCount,
      outboundCount,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    },
    messages: input.messages.map((entry) => ({
      sequence: entry.sequence,
      timestamp: entry.timestamp,
      direction: entry.direction,
      data: entry.data,
    })),
  };
}

export function buildGrpcStreamLogExportFilename(input: {
  service?: string;
  method?: string;
}): string {
  const rawService = input.service ?? 'grpc';
  const serviceSegments = rawService.split('.');
  const serviceBase = serviceSegments.length > 1
    ? serviceSegments[0]!
    : serviceSegments[serviceSegments.length - 1]!;
  const servicePart = serviceBase
    .replace(/Service$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '') || 'grpc';
  const methodPart = (input.method ?? 'stream')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '') || 'stream';
  return `grpc-stream-${servicePart}-${methodPart}-${Date.now()}.json`;
}

export function downloadGrpcStreamLogExport(
  payload: GrpcStreamLogExportPayload,
  filename: string,
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
