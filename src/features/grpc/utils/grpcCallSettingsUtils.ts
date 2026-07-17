/** gRPC timeout header value per spec §2.2.6 (S/M/H units or decimal seconds). */
export function formatGrpcTimeoutHeaderValue(timeoutMs: number): string {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return '—';
  }
  if (timeoutMs >= 3_600_000 && timeoutMs % 3_600_000 === 0) {
    return `${timeoutMs / 3_600_000}H`;
  }
  if (timeoutMs >= 60_000 && timeoutMs % 60_000 === 0) {
    return `${timeoutMs / 60_000}M`;
  }
  if (timeoutMs >= 1000 && timeoutMs % 1000 === 0) {
    return `${timeoutMs / 1000}S`;
  }
  if (timeoutMs < 1000) {
    return `${timeoutMs}m`;
  }
  return `${timeoutMs}m`;
}
