/**
 * gRPC Studio — timing breakdown display helpers (Phase 1 mockup 01).
 */
import type { GrpcCallTimingBreakdown } from '../../../shared/grpc/contracts';
import { formatGrpcDurationMs } from './grpcResponseUtils';

export interface GrpcTimingBreakdownRow {
  key: keyof GrpcCallTimingBreakdown;
  label: string;
  durationMs: number;
  barClass: string;
}

const ROW_META: Array<{
  key: keyof GrpcCallTimingBreakdown;
  label: string;
  barClass: string;
}> = [
  { key: 'dnsLookupMs', label: 'DNS Lookup', barClass: 'grpc-timing-bar--dns' },
  { key: 'tcpConnectTlsMs', label: 'TCP Connect + TLS', barClass: 'grpc-timing-bar--tcp' },
  { key: 'http2HandshakeMs', label: 'HTTP/2 Handshake', barClass: 'grpc-timing-bar--h2' },
  { key: 'protoSerializationMs', label: 'Proto Serialization', barClass: 'grpc-timing-bar--serialize' },
  { key: 'serverProcessingMs', label: 'Server Processing', barClass: 'grpc-timing-bar--server' },
  { key: 'responseDeserializationMs', label: 'Response Deserialization', barClass: 'grpc-timing-bar--deserialize' },
];

function finiteMs(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function scaleTimingRowsToTotal(
  rows: GrpcTimingBreakdownRow[],
  safeTotal: number,
): GrpcTimingBreakdownRow[] {
  const rowSum = rows.reduce((acc, row) => acc + row.durationMs, 0);
  if (safeTotal <= 0 || rowSum <= safeTotal) return rows;
  const scale = safeTotal / rowSum;
  return rows.map((row) => ({
    ...row,
    durationMs: Math.max(0, Math.round(row.durationMs * scale)),
  }));
}

/** Normalize partial breakdowns into display rows; fills gaps proportionally when only total is known. */
export function buildGrpcTimingBreakdownRows(
  breakdown: GrpcCallTimingBreakdown | undefined,
  totalMs: number,
): GrpcTimingBreakdownRow[] {
  const safeTotal = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  const explicit: Partial<Record<keyof GrpcCallTimingBreakdown, number>> = {};
  let explicitSum = 0;

  for (const meta of ROW_META) {
    const ms = finiteMs(breakdown?.[meta.key]);
    if (ms !== undefined) {
      explicit[meta.key] = ms;
      explicitSum += ms;
    }
  }

  const rows: GrpcTimingBreakdownRow[] = [];
  const remaining = Math.max(0, safeTotal - explicitSum);

  for (const meta of ROW_META) {
    let durationMs = explicit[meta.key];
    if (durationMs === undefined && remaining > 0 && safeTotal > 0) {
      // Weight unknown phases using mockup-like ratios when server omitted a slice.
      const weight = meta.key === 'serverProcessingMs' ? 0.55
        : meta.key === 'tcpConnectTlsMs' ? 0.15
          : meta.key === 'http2HandshakeMs' ? 0.1
            : meta.key === 'protoSerializationMs' ? 0.05
              : meta.key === 'responseDeserializationMs' ? 0.05
                : 0.1;
      durationMs = Math.round(remaining * weight);
    }
    if (durationMs === undefined) {
      durationMs = 0;
    }
    rows.push({
      key: meta.key,
      label: meta.label,
      durationMs,
      barClass: meta.barClass,
    });
  }

  return scaleTimingRowsToTotal(rows, safeTotal);
}

export function resolveGrpcTimingBarDenominatorMs(
  rows: GrpcTimingBreakdownRow[],
  totalMs: number,
): number {
  const safeTotal = Number.isFinite(totalMs) && totalMs > 0 ? totalMs : 0;
  const rowSum = rows.reduce((acc, row) => acc + row.durationMs, 0);
  return Math.max(safeTotal, rowSum);
}

export function formatGrpcTimingDurationLabel(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '—';
  if (durationMs > 0 && durationMs < 1) return '<1ms';
  return formatGrpcDurationMs(durationMs);
}

export function grpcTimingBarWidthPercent(durationMs: number, denominatorMs: number): number {
  if (!Number.isFinite(denominatorMs) || denominatorMs <= 0) return 0;
  const pct = (Math.max(0, durationMs) / denominatorMs) * 100;
  return Math.min(100, Math.max(durationMs > 0 ? 1 : 0, pct));
}
