import type { ConnectionLine } from '../hooks/useConnectionLines';
import type { MappingTrace } from './mappingTrace';
import { formatTraceValue, isTraceError } from './mappingTrace';

export interface LineEnrichmentContext {
  autoMapScores: Map<string, number>;
  patternMappingIds: Set<string>;
  driftMappingIds?: Map<string, 'warning' | 'breaking'>;
  debugMode: boolean;
  traceByMappingId?: Map<string, MappingTrace> | null;
}

export function enrichConnectionLines(
  rawLines: ConnectionLine[],
  ctx: LineEnrichmentContext,
): ConnectionLine[] {
  return rawLines.map((line) => {
    let updated = line;
    const score = ctx.autoMapScores.get(line.mappingId);
    if (score != null) updated = { ...updated, confidenceScore: score };
    if (ctx.patternMappingIds.has(line.mappingId)) updated = { ...updated, isFromPattern: true };
    if (ctx.driftMappingIds && ctx.driftMappingIds.size > 0) {
      const severity = ctx.driftMappingIds.get(line.mappingId);
      if (severity) updated = { ...updated, driftSeverity: severity };
    }
    if (ctx.debugMode && ctx.traceByMappingId) {
      const trace = ctx.traceByMappingId.get(line.mappingId);
      if (trace) {
        updated = {
          ...updated,
          traceValue: formatTraceValue(trace.targetValue, 20),
          traceError: isTraceError(trace),
        };
      }
    }
    return updated;
  });
}
