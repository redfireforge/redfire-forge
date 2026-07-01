import type { TestRun, RequestResult } from '../shared/types';
import { buildGrpcHarnessResultTraceKey } from '../shared/grpc/grpcHarnessRowIdentity';
import { computeMetrics } from './metrics';

/**
 * Merge re-run results into an existing TestRun.
 * For each re-run result, replaces the original result with the same dataRowId + scenarioId.
 * Recalculates the summary from the merged results.
 *
 * @param original  The existing TestRun with all results
 * @param rerunResults  New results from re-running failed rows
 * @returns A new TestRun with merged results and recalculated summary
 */
export function mergeRerunResults(original: TestRun, rerunResults: RequestResult[]): TestRun {
  // Build a set of keys for the re-run results: scenarioId + dataRowId
  const rerunKeys = new Set(
    rerunResults.map((r) => buildGrpcHarnessResultTraceKey(r.scenarioId, r.dataRowId)),
  );

  // Keep original results that were NOT re-run, then append re-run results
  const kept = original.results.filter(
    (r) => !rerunKeys.has(buildGrpcHarnessResultTraceKey(r.scenarioId, r.dataRowId)),
  );
  const merged = [...kept, ...rerunResults];

  // Recalculate summary from merged results
  const summary = computeMetrics(merged, original.summary.totalDurationMs);

  return {
    ...original,
    results: merged,
    summary,
  };
}
