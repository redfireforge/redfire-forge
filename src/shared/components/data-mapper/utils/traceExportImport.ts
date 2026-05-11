/**
 * Trace Export / Import — Phase 9D.3
 *
 * Utilities to extract mapping traces from workflow execution traces
 * and re-import them for offline debugging. Supports round-trip:
 * export → JSON file → import → same MappingTrace[] available for
 * the Data Mapper's debug overlay.
 */

import type { MappingTrace } from './mappingTrace';

export interface ExportedMappingTraces {
  version: 1;
  exportedAt: string;
  workflowId?: string;
  workflowName?: string;
  iterationIndex?: number;
  nodeId?: string;
  nodeLabel?: string;
  traces: MappingTrace[];
}

/**
 * Package mapping traces for export as a standalone JSON file.
 */
export function exportMappingTraces(
  traces: MappingTrace[],
  meta?: {
    workflowId?: string;
    workflowName?: string;
    iterationIndex?: number;
    nodeId?: string;
    nodeLabel?: string;
  },
): ExportedMappingTraces {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...meta,
    traces,
  };
}

/**
 * Validate and import mapping traces from a parsed JSON object.
 * Returns the traces if valid, or throws with a descriptive error.
 */
export function importMappingTraces(data: unknown): MappingTrace[] {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid mapping trace file: expected a JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new Error(`Unsupported mapping trace version: ${obj.version ?? 'missing'}`);
  }

  if (!Array.isArray(obj.traces)) {
    throw new Error('Invalid mapping trace file: "traces" must be an array');
  }

  const traces: MappingTrace[] = [];
  for (let i = 0; i < obj.traces.length; i++) {
    const t = obj.traces[i];
    if (!t || typeof t !== 'object') {
      throw new Error(`Invalid trace at index ${i}: expected an object`);
    }
    const trace = t as Record<string, unknown>;
    if (typeof trace.mappingId !== 'string') {
      throw new Error(`Invalid trace at index ${i}: missing "mappingId"`);
    }
    if (typeof trace.sourcePath !== 'string') {
      throw new Error(`Invalid trace at index ${i}: missing "sourcePath"`);
    }
    if (typeof trace.targetPath !== 'string') {
      throw new Error(`Invalid trace at index ${i}: missing "targetPath"`);
    }

    traces.push({
      mappingId: trace.mappingId as string,
      sourcePath: trace.sourcePath as string,
      sourceId: typeof trace.sourceId === 'string' ? trace.sourceId : undefined,
      sourceValue: trace.sourceValue,
      expression: typeof trace.expression === 'string' ? trace.expression : undefined,
      evaluatedValue: trace.evaluatedValue,
      targetPath: trace.targetPath as string,
      targetValue: trace.targetValue,
      timestamp: typeof trace.timestamp === 'number' ? trace.timestamp : Date.now(),
      durationMs: typeof trace.durationMs === 'number' ? trace.durationMs : 0,
      error: typeof trace.error === 'string' ? trace.error : undefined,
    });
  }

  return traces;
}

/**
 * Extract all mapping traces from a workflow execution trace.
 * Returns a flat array of all traces across all iterations and events.
 * Each entry is tagged with iterationIndex and nodeId for context.
 */
export interface ContextualMappingTrace extends MappingTrace {
  iterationIndex: number;
  nodeId: string;
  nodeLabel: string;
}

export function extractAllMappingTraces(
  executionTrace: {
    iterations: Array<{
      index: number;
      events: Array<{
        nodeId: string;
        nodeLabel: string;
        details?: { mappingTraces?: MappingTrace[] };
      }>;
    }>;
  },
): ContextualMappingTrace[] {
  const result: ContextualMappingTrace[] = [];

  for (const iter of executionTrace.iterations) {
    for (const event of iter.events) {
      const traces = event.details?.mappingTraces;
      if (!traces || traces.length === 0) continue;
      for (const trace of traces) {
        result.push({
          ...trace,
          iterationIndex: iter.index,
          nodeId: event.nodeId,
          nodeLabel: event.nodeLabel,
        });
      }
    }
  }

  return result;
}
