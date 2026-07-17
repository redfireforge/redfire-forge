/**
 * Phase 9E — env variable dependency graph cycle detection.
 */
import { GRPC_INTERPOLATION_ERROR_CODES } from './grpcInterpolationConstants';
import type { GrpcInterpolationValidationIssue } from './grpcInterpolationConstants';
import { extractGrpcInterpolationTokenNamesSafe } from './grpcInterpolationGrammar';
import {
  buildGrpcInterpolationCycleIssue,
  sanitizeGrpcInterpolationDiagnosticMessage,
} from './grpcInterpolationDiagnostics';
import { GrpcInterpolationError } from './grpcInterpolationError';
import { normalizeGrpcInterpolationEnvMap } from './grpcInterpolationPrecedence';

export interface GrpcInterpolationEnvCycleResult {
  /** Ordered token names forming the cycle (first and last name match). */
  path: string[];
}

/** Build adjacency list: env key → other env keys referenced in its value. */
export function buildGrpcInterpolationEnvDependencyGraph(
  env: Readonly<Record<string, string>>,
): Readonly<Record<string, readonly string[]>> {
  const envKeys = new Set(Object.keys(env));
  const graph: Record<string, string[]> = {};
  for (const [key, rawValue] of Object.entries(env)) {
    const extracted = extractGrpcInterpolationTokenNamesSafe(rawValue);
    if (!extracted.ok) {
      graph[key] = [];
      continue;
    }
    const deps = [...new Set(
      extracted.names.filter((name) => envKeys.has(name)),
    )];
    graph[key] = deps;
  }
  return graph;
}

function findCycleFromNode(
  start: string,
  graph: Readonly<Record<string, readonly string[]>>,
  visiting: Set<string>,
  visited: Set<string>,
  stack: string[],
): GrpcInterpolationEnvCycleResult | undefined {
  if (visiting.has(start)) {
    const cycleStart = stack.indexOf(start);
    if (cycleStart >= 0) {
      const path = stack.slice(cycleStart);
      path.push(start);
      return { path };
    }
    return { path: [start, start] };
  }
  if (visited.has(start)) {
    return undefined;
  }
  visiting.add(start);
  stack.push(start);
  for (const neighbor of graph[start] ?? []) {
    const cycle = findCycleFromNode(neighbor, graph, visiting, visited, stack);
    if (cycle) {
      return cycle;
    }
  }
  stack.pop();
  visiting.delete(start);
  visited.add(start);
  return undefined;
}

/** Detect a circular dependency among merged env variable values. */
export function detectGrpcInterpolationEnvCycle(
  env: Readonly<Record<string, string>>,
): GrpcInterpolationEnvCycleResult | undefined {
  const normalized = normalizeGrpcInterpolationEnvMap(env);
  if (Object.keys(normalized).length === 0) {
    return undefined;
  }
  const graph = buildGrpcInterpolationEnvDependencyGraph(normalized);
  const visited = new Set<string>();
  for (const node of Object.keys(graph).sort()) {
    if (visited.has(node)) continue;
    const visiting = new Set<string>();
    const stack: string[] = [];
    const cycle = findCycleFromNode(node, graph, visiting, visited, stack);
    if (cycle) {
      return cycle;
    }
  }
  return undefined;
}

/** Return a validation issue when the merged env map contains a variable cycle. */
export function validateGrpcInterpolationEnvCycles(
  env: Readonly<Record<string, string>>,
): GrpcInterpolationValidationIssue | undefined {
  const cycle = detectGrpcInterpolationEnvCycle(env);
  if (!cycle) {
    return undefined;
  }
  const normalized = normalizeGrpcInterpolationEnvMap(env);
  const issue = buildGrpcInterpolationCycleIssue(cycle.path);
  return {
    ...issue,
    message: sanitizeGrpcInterpolationDiagnosticMessage(issue.message, { env: normalized }),
  };
}

/** Fail fast before interpolation when env variables reference each other cyclically. */
export function assertGrpcInterpolationEnvAcyclic(
  env: Readonly<Record<string, string>>,
): void {
  const issue = validateGrpcInterpolationEnvCycles(env);
  if (issue) {
    throw new GrpcInterpolationError(issue);
  }
}

export { GRPC_INTERPOLATION_ERROR_CODES };
