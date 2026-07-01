/**
 * Phase 8F — stable row trace keys for parameterized gRPC harness scenarios.
 */

/** Separator between base scenario id and data row id in composite trace keys. */
export const GRPC_HARNESS_ROW_TRACE_SEP = '::';

/** Build stable composite key for rerun merge / rust bridge lookup (`scenarioId::dataRowId`). */
export function buildGrpcHarnessRowTraceKey(
  scenarioId: string,
  dataRowId: string,
): string {
  return `${scenarioId}${GRPC_HARNESS_ROW_TRACE_SEP}${dataRowId}`;
}

/**
 * Build result/rerun merge trace key.
 * Row-less results use `scenarioId::` (empty row suffix) for merge parity with legacy keys.
 */
export function buildGrpcHarnessResultTraceKey(
  scenarioId: string,
  dataRowId?: string,
): string {
  return buildGrpcHarnessRowTraceKey(scenarioId, dataRowId ?? '');
}

/** Parse a composite trace key back into scenario id + optional row id. */
export function parseGrpcHarnessRowTraceKey(traceKey: string): {
  scenarioId: string;
  dataRowId?: string;
} {
  const idx = traceKey.indexOf(GRPC_HARNESS_ROW_TRACE_SEP);
  if (idx === -1) {
    return { scenarioId: traceKey };
  }
  return {
    scenarioId: traceKey.slice(0, idx),
    dataRowId: traceKey.slice(idx + GRPC_HARNESS_ROW_TRACE_SEP.length) || undefined,
  };
}
