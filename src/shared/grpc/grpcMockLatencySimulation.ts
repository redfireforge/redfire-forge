/**
 * Phase 11E - Deterministic mock latency and jitter simulation.
 */

export const GRPC_MOCK_LATENCY_LIMITS = {
  maxDefaultLatencyMs: 30_000,
  maxJitterMs: 5_000,
} as const;

export interface GrpcMockLatencyPolicy {
  defaultLatencyMs?: number;
  jitterMs?: number;
  seed?: number;
}

export interface GrpcMockLatencyIssue {
  path: 'defaultLatencyMs' | 'jitterMs' | 'seed';
  message: string;
}

export class GrpcMockLatencyPolicyValidationError extends Error {
  readonly category = 'validation' as const;
  readonly issues: GrpcMockLatencyIssue[];

  constructor(issues: GrpcMockLatencyIssue[]) {
    super(issues[0]?.message ?? 'Invalid mock latency policy');
    this.name = 'GrpcMockLatencyPolicyValidationError';
    this.issues = issues;
  }
}

export function validateGrpcMockLatencyPolicy(
  policy: GrpcMockLatencyPolicy | undefined,
): GrpcMockLatencyIssue[] {
  if (policy == null) {
    return [];
  }

  const issues: GrpcMockLatencyIssue[] = [];

  if (policy.defaultLatencyMs != null) {
    if (!Number.isInteger(policy.defaultLatencyMs) || policy.defaultLatencyMs < 0) {
      issues.push({
        path: 'defaultLatencyMs',
        message: 'defaultLatencyMs must be a non-negative integer.',
      });
    } else if (policy.defaultLatencyMs > GRPC_MOCK_LATENCY_LIMITS.maxDefaultLatencyMs) {
      issues.push({
        path: 'defaultLatencyMs',
        message: `defaultLatencyMs exceeds max ${GRPC_MOCK_LATENCY_LIMITS.maxDefaultLatencyMs}.`,
      });
    }
  }

  if (policy.jitterMs != null) {
    if (!Number.isInteger(policy.jitterMs) || policy.jitterMs < 0) {
      issues.push({
        path: 'jitterMs',
        message: 'jitterMs must be a non-negative integer.',
      });
    } else if (policy.jitterMs > GRPC_MOCK_LATENCY_LIMITS.maxJitterMs) {
      issues.push({
        path: 'jitterMs',
        message: `jitterMs exceeds max ${GRPC_MOCK_LATENCY_LIMITS.maxJitterMs}.`,
      });
    }
  }

  if (policy.seed != null && !Number.isInteger(policy.seed)) {
    issues.push({
      path: 'seed',
      message: 'seed must be an integer when provided.',
    });
  }

  return issues;
}

export function assertGrpcMockLatencyPolicy(policy: GrpcMockLatencyPolicy | undefined): void {
  const issues = validateGrpcMockLatencyPolicy(policy);
  if (issues.length > 0) {
    throw new GrpcMockLatencyPolicyValidationError(issues);
  }
}

/** Mulberry32 PRNG — deterministic for a given seed. */
export function createGrpcMockLatencyRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function drawGrpcMockJitterMs(
  policy: GrpcMockLatencyPolicy | undefined,
  callSequence: number,
): number {
  const jitterCap = policy?.jitterMs ?? 0;
  if (jitterCap <= 0) {
    return 0;
  }

  if (policy?.seed == null) {
    return 0;
  }

  const rng = createGrpcMockLatencyRng(policy.seed + callSequence);
  return Math.floor(rng() * (jitterCap + 1));
}

export function resolveGrpcMockLatencyMs(input: {
  responseLatencyMs?: number;
  policy?: GrpcMockLatencyPolicy;
  callSequence: number;
}): number {
  assertGrpcMockLatencyPolicy(input.policy);
  const base = input.responseLatencyMs ?? input.policy?.defaultLatencyMs ?? 0;
  const jitter = drawGrpcMockJitterMs(input.policy, input.callSequence);
  return Math.max(0, base + jitter);
}
