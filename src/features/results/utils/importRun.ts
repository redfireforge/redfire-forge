import type { TestRun } from '@shared/types';

const REQUIRED_EXECUTION_MODES = ['sequential', 'batch', 'pool', 'load-profile', 'workflow'];

/**
 * Validates that an unknown JSON payload is a valid TestRun object.
 * Returns the validated run (with a fresh id to avoid collisions) or an error message.
 */
export function validateImportedRun(
  data: unknown,
): { valid: true; run: TestRun } | { valid: false; error: string } {
  if (data == null || typeof data !== 'object') {
    return { valid: false, error: 'File does not contain a JSON object' };
  }

  const obj = data as Record<string, unknown>;

  // config
  if (obj.config == null || typeof obj.config !== 'object') {
    return { valid: false, error: 'Missing or invalid "config" field' };
  }
  const config = obj.config as Record<string, unknown>;
  if (typeof config.concurrency !== 'number') {
    return { valid: false, error: 'config.concurrency must be a number' };
  }
  if (typeof config.iterations !== 'number') {
    return { valid: false, error: 'config.iterations must be a number' };
  }
  if (!Array.isArray(config.scenarioWeights)) {
    return { valid: false, error: 'config.scenarioWeights must be an array' };
  }
  if (typeof config.executionMode !== 'string' || !REQUIRED_EXECUTION_MODES.includes(config.executionMode)) {
    return { valid: false, error: `config.executionMode must be one of: ${REQUIRED_EXECUTION_MODES.join(', ')}` };
  }

  // summary
  if (obj.summary == null || typeof obj.summary !== 'object') {
    return { valid: false, error: 'Missing or invalid "summary" field' };
  }
  const summary = obj.summary as Record<string, unknown>;
  if (typeof summary.totalRequests !== 'number') {
    return { valid: false, error: 'summary.totalRequests must be a number' };
  }
  if (typeof summary.totalDurationMs !== 'number') {
    return { valid: false, error: 'summary.totalDurationMs must be a number' };
  }

  // Compute tps if missing
  if (typeof summary.tps !== 'number' && typeof summary.totalDurationMs === 'number' && summary.totalDurationMs > 0) {
    summary.tps = Math.round(((summary.totalRequests as number) / ((summary.totalDurationMs as number) / 1000)) * 100) / 100;
  }

  // results
  if (!Array.isArray(obj.results)) {
    return { valid: false, error: '"results" must be an array' };
  }

  // timestamp — use existing or default to now
  const timestamp = typeof obj.timestamp === 'number' ? obj.timestamp : Date.now();

  // Assign a fresh id to avoid collisions with existing runs
  // Also ensure each result has an id (CLI outputs may omit it)
  const results = (obj.results as Array<Record<string, unknown>>).map((r, i) => ({
    ...r,
    id: typeof r.id === 'string' ? r.id : `imported-${i}`,
  }));

  const run: TestRun = {
    ...(obj as unknown as TestRun),
    id: crypto.randomUUID(),
    timestamp,
    results: results as TestRun['results'],
  };

  return { valid: true, run };
}
