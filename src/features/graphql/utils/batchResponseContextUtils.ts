import type { GraphqlBatchResponseContext, GraphqlBatchResult, GraphqlResponse } from '../../../shared/types/graphql';

/** Human label for the active operation slot, e.g. "Operation 2 of 2". */
export function batchOperationSlotLabel(ctx: GraphqlBatchResponseContext): string {
  return `Operation ${ctx.batchIndex + 1} of ${ctx.batchSize}`;
}

/** Short status-bar pill, e.g. "Batch 2/2". */
export function batchStatusPillLabel(ctx: GraphqlBatchResponseContext): string {
  return `Batch ${ctx.batchIndex + 1}/${ctx.batchSize}`;
}

/** One-line transport summary for batch modal / response banner. */
export function batchTransportSummary(ctx: GraphqlBatchResponseContext): string {
  if (ctx.batchUnsupported) {
    return `${ctx.upstreamRequestCount} upstream HTTP POST${ctx.upstreamRequestCount === 1 ? '' : 's'} · sequential fallback`;
  }
  return `1 upstream HTTP POST · JSON array batch · ${ctx.batchLatencyMs} ms total`;
}

/** Transport summary with response-aware proxy failure detection. */
export function batchTransportSummaryForResponse(
  ctx: GraphqlBatchResponseContext,
  response: GraphqlResponse,
): string {
  if (response.httpStatus === 0) {
    return 'Batch request failed before reaching GraphQL server';
  }
  return batchTransportSummary(ctx);
}

/** Latency label for the response status bar when viewing a batch slice. */
export function batchLatencyStatusLabel(ctx: GraphqlBatchResponseContext, operationLatencyMs: number): string {
  if (ctx.batchUnsupported) {
    return `${operationLatencyMs} ms · op ${ctx.batchIndex + 1}`;
  }
  if (operationLatencyMs === ctx.batchLatencyMs) {
    return `${ctx.batchLatencyMs} ms batch`;
  }
  return `${operationLatencyMs} ms · batch ${ctx.batchLatencyMs} ms`;
}

/** Explainer shown in Metadata and the response banner. */
export function batchResponseExplainer(ctx: GraphqlBatchResponseContext): string {
  if (ctx.batchUnsupported) {
    return (
      'This tab shows one operation from a batch run. The server did not accept a JSON-array body, ' +
      'so RedfireForge sent each operation as its own POST and aggregated the results.'
    );
  }
  return (
    'This tab shows one operation from a batch run. RedfireForge sent all operations in a single ' +
    'JSON-array POST; the latency above is the shared round-trip for that batch request.'
  );
}

/** Transport summary for the batch results modal header. */
export function batchResultTransportSummary(result: GraphqlBatchResult): string | null {
  const ctx = result.results[0]?.response.batchContext;
  if (!ctx) {
    if (result.batchUnsupported) {
      const count = result.results.length;
      return `${count} upstream HTTP POST${count === 1 ? '' : 's'} · sequential fallback`;
    }
    return result.results.length > 0
      ? `1 upstream HTTP POST · JSON array batch`
      : null;
  }
  return batchTransportSummary(ctx);
}
