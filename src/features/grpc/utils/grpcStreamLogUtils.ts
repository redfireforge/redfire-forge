import {
  GRPC_STREAM_MESSAGE_CAP,
  type GrpcStreamEvent,
  type GrpcStreamLogEntry,
} from '@shared/grpc/contracts';
import { shouldAcceptGrpcStreamSequence } from '@shared/grpc/grpcStreamClient';

export function appendGrpcStreamLogEntry(
  messages: GrpcStreamLogEntry[],
  entry: GrpcStreamLogEntry,
  lastSequence: number,
): { messages: GrpcStreamLogEntry[]; lastSequence: number } | null {
  if (!shouldAcceptGrpcStreamSequence(entry.sequence, lastSequence)) {
    return null;
  }
  const next = [...messages, entry];
  const trimmed = next.length > GRPC_STREAM_MESSAGE_CAP
    ? next.slice(next.length - GRPC_STREAM_MESSAGE_CAP)
    : next;
  return { messages: trimmed, lastSequence: entry.sequence };
}

export function grpcStreamEventToLogEntry(event: GrpcStreamEvent): GrpcStreamLogEntry | null {
  if (event.type !== 'grpc-message' || !event.direction || !event.data) {
    return null;
  }
  return {
    sequence: event.sequence,
    timestamp: event.timestamp,
    direction: event.direction,
    data: event.data,
  };
}

export function countGrpcStreamDirections(messages: GrpcStreamLogEntry[]): {
  inbound: number;
  outbound: number;
} {
  let inbound = 0;
  let outbound = 0;
  for (const entry of messages) {
    if (entry.direction === 'inbound') inbound += 1;
    else outbound += 1;
  }
  return { inbound, outbound };
}
