/**
 * Mapping Execution Trace — Phase 9A
 *
 * Captures per-mapping data flow during test/workflow execution.
 * Each MappingTrace records what value flowed from source → expression → target
 * for a single mapping, enabling the Mapping Debugger overlay (Phase 9B+).
 *
 * Trace capture is gated by TraceCaptureLevel: only at 'full' or 'debug'.
 */

import type { Mapping, MapperSource } from '../types';
import type { TraceCaptureLevel } from '../../../types';
import { evaluateMapperExpression } from './mapperExpressionEvaluator';
import { getByPath } from '../../../utils/jsonPath';
import type { ExpressionFunction } from '../../../../features/workflow/utils/expressionFunctions/types';

// ─── Types ────────────────────────────────────────────────

export interface MappingTrace {
  mappingId: string;
  sourcePath: string;
  sourceId?: string;
  sourceValue: unknown;
  expression?: string;
  evaluatedValue: unknown;
  targetPath: string;
  targetValue: unknown;
  timestamp: number;
  durationMs: number;
  error?: string;
}

export interface MappingTraceOptions {
  mappings: Mapping[];
  sources: MapperSource[];
  activeSourceId: string;
  customFunctions?: ExpressionFunction[];
}

// ─── Trace Level Gating ───────────────────────────────────

const TRACE_ENABLED_LEVELS = new Set<TraceCaptureLevel>(['full', 'debug']);

export function shouldCaptureMappingTraces(level: TraceCaptureLevel): boolean {
  return TRACE_ENABLED_LEVELS.has(level);
}

// ─── Trace Capture ────────────────────────────────────────

function resolveSourceValue(
  sourcePath: string,
  sourceId: string,
  sources: MapperSource[],
): unknown {
  const source = sources.find((s) => s.id === sourceId);
  if (!source?.sampleData) return undefined;
  const data = typeof source.sampleData === 'string'
    ? (() => { try { return JSON.parse(source.sampleData as string); } catch { return undefined; } })()
    : source.sampleData;
  if (data == null) return undefined;
  const normalized = sourcePath.replace(/^\$\.?/, '');
  if (!normalized) return data;
  return getByPath(data, normalized);
}

/**
 * Capture mapping traces for a set of mappings against source data.
 * Each mapping produces one MappingTrace record documenting the
 * source value, expression evaluation, and resulting target value.
 */
export function captureMappingTraces(opts: MappingTraceOptions): MappingTrace[] {
  const { mappings, sources, activeSourceId, customFunctions } = opts;
  const traces: MappingTrace[] = [];

  for (const mapping of mappings) {
    const start = performance.now();
    const effectiveSourceId = mapping.sourceId || activeSourceId;
    const sourceValue = resolveSourceValue(mapping.sourcePath, effectiveSourceId, sources);

    let evaluatedValue: unknown = sourceValue;
    let error: string | undefined;

    if (mapping.expression) {
      try {
        const result = evaluateMapperExpression(
          mapping.expression,
          sources,
          effectiveSourceId,
          customFunctions,
        );
        if (result.error) {
          error = result.error;
          evaluatedValue = undefined;
        } else {
          evaluatedValue = result.value;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        evaluatedValue = undefined;
      }
    }

    const durationMs = performance.now() - start;

    traces.push({
      mappingId: mapping.id,
      sourcePath: mapping.sourcePath,
      sourceId: mapping.sourceId,
      sourceValue,
      expression: mapping.expression,
      evaluatedValue,
      targetPath: mapping.targetPath,
      targetValue: error ? undefined : evaluatedValue,
      timestamp: Date.now(),
      durationMs: Math.round(durationMs * 1000) / 1000,
      error,
    });
  }

  return traces;
}

// ─── Trace Summarization ──────────────────────────────────

export interface MappingTraceSummary {
  total: number;
  successful: number;
  failed: number;
  totalDurationMs: number;
  errors: { mappingId: string; error: string }[];
}

export function summarizeMappingTraces(traces: MappingTrace[]): MappingTraceSummary {
  let successful = 0;
  let failed = 0;
  let totalDurationMs = 0;
  const errors: { mappingId: string; error: string }[] = [];

  for (const trace of traces) {
    totalDurationMs += trace.durationMs;
    if (isTraceError(trace)) {
      failed++;
      errors.push({ mappingId: trace.mappingId, error: trace.error! });
    } else {
      successful++;
    }
  }

  return {
    total: traces.length,
    successful,
    failed,
    totalDurationMs: Math.round(totalDurationMs * 1000) / 1000,
    errors,
  };
}

// ─── Value Formatting (for UI display in Phase 9B) ────────

const MAX_DISPLAY_LENGTH = 50;

export function formatTraceValue(value: unknown, maxLen = MAX_DISPLAY_LENGTH): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

export function isTraceError(trace: MappingTrace): boolean {
  return typeof trace.error === 'string' && trace.error.length > 0;
}
