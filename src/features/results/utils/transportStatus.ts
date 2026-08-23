import type { RequestResult, TransportType } from '@shared/types';

/**
 * Format the status column value for a RequestResult based on its transport type.
 * HTTP → numeric status code, Kafka → PRODUCE/CONSUME, WS → CONNECT/SEND/RECEIVE.
 */
export function formatTransportStatus(r: RequestResult): string {
  const t = r.transportType ?? 'http';
  if (t === 'http') return String(r.httpStatus || 'ERR');
  if (t === 'kafkaProduce') return 'PRODUCE';
  if (t === 'kafkaConsume') return 'CONSUME';
  if (t === 'wsConnect') return 'CONNECT';
  if (t === 'wsSend') return 'SEND';
  if (t === 'wsReceive') return 'RECEIVE';
  if (t === 'wsTrigger') return 'TRIGGER';
  return String(t).toUpperCase();
}

/**
 * Returns a concise method badge label for the result's transport type.
 * HTTP → the actual HTTP method (GET, POST, etc.),
 * WS → CONNECT / SEND / RECEIVE / TRIGGER,
 * Kafka → PRODUCE / CONSUME.
 */
export function getTransportMethodLabel(r: RequestResult): string {
  const t = r.transportType ?? 'http';
  if (t === 'http') return r.method;
  return formatTransportStatus(r);
}

/** Returns true if the result is HTTP transport. */
export function isHttpResult(r: RequestResult): boolean {
  return (r.transportType ?? 'http') === 'http';
}

/** Transport family: 'http' | 'ws' | 'kafka'. */
export type TransportFamily = 'http' | 'ws' | 'kafka';

/** Derive the transport family from a TransportType. */
export function getTransportFamily(t: TransportType | undefined): TransportFamily {
  if (!t || t === 'http') return 'http';
  if (t === 'kafkaProduce' || t === 'kafkaConsume') return 'kafka';
  return 'ws';
}
