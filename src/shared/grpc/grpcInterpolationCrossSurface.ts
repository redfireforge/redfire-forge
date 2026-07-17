/**
 * Phase 9H — cross-surface interpolation parity helpers (Studio / Workflow / Harness).
 */
import type { GrpcAuthConfig, GrpcTabExecuteSnapshot } from './contracts';
import { getGrpcAuthMetadataKeys } from './grpcAuthPolicy';
import { FIXTURE_DESCRIPTOR_KEY, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';

export interface GrpcInterpolationCrossSurfaceTemplates {
  target: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  auth: GrpcAuthConfig;
}

/** Shared fixture env + templates for cross-surface matrix tests. */
export const GRPC_CROSS_SURFACE_FIXTURE = {
  env: {
    grpcHost: 'localhost:50051',
    greeting: 'hello',
    envName: 'dev',
    token: 'abc123',
  },
  templates: {
    target: '{{grpcHost}}',
    body: { message: '{{greeting}}', nested: { tag: '{{envName}}' } },
    metadata: { 'x-env': '{{envName}}' },
    auth: { type: 'bearer' as const, bearerToken: '{{token}}' },
  } satisfies GrpcInterpolationCrossSurfaceTemplates,
  pageDefaults: { target: 'fallback:50051', tlsMode: 'disabled' as const },
  profiles: [{
    id: 'profile-a',
    name: 'Local',
    target: '{{grpcHost}}',
    tlsMode: 'disabled' as const,
  }],
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
  service: FIXTURE_UNARY_CALL_REQUEST.service,
  method: FIXTURE_UNARY_CALL_REQUEST.method,
};

export interface GrpcInterpolationExecuteComparable {
  targetAddress: string;
  body: Record<string, unknown>;
  metadata: Record<string, string>;
  authBearer?: string;
}

/** Normalize execute payloads for cross-surface comparison. */
export function grpcExecuteSnapshotToComparable(
  snapshot: Pick<GrpcTabExecuteSnapshot, 'target' | 'body' | 'metadata' | 'auth'>,
): GrpcInterpolationExecuteComparable {
  return grpcExecuteSnapshotToInterpolationComparable(snapshot);
}

/**
 * Compare interpolation-resolved fields only — strips auth-injected metadata keys
 * (Phase 4H replay merges Authorization into snapshot metadata; Studio defers to transport).
 */
export function grpcExecuteSnapshotToInterpolationComparable(
  snapshot: Pick<GrpcTabExecuteSnapshot, 'target' | 'body' | 'metadata' | 'auth'>,
): GrpcInterpolationExecuteComparable {
  const authKeys = new Set(
    getGrpcAuthMetadataKeys(snapshot.auth).map((key) => key.toLowerCase()),
  );
  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(snapshot.metadata ?? {})) {
    if (!authKeys.has(key.toLowerCase())) {
      metadata[key] = value;
    }
  }
  return {
    targetAddress: snapshot.target.address,
    body: structuredClone(snapshot.body),
    metadata,
    authBearer: snapshot.auth?.type === 'bearer' ? snapshot.auth.bearerToken : undefined,
  };
}

/** Assert two execute views match (target, body, metadata, bearer token). */
export function assertGrpcInterpolationExecuteParity(
  labelA: string,
  a: GrpcInterpolationExecuteComparable,
  labelB: string,
  b: GrpcInterpolationExecuteComparable,
): void {
  if (a.targetAddress !== b.targetAddress) {
    throw new Error(
      `Interpolation parity mismatch (${labelA} vs ${labelB}): target ${a.targetAddress} !== ${b.targetAddress}`,
    );
  }
  const bodyA = JSON.stringify(a.body);
  const bodyB = JSON.stringify(b.body);
  if (bodyA !== bodyB) {
    throw new Error(
      `Interpolation parity mismatch (${labelA} vs ${labelB}): body ${bodyA} !== ${bodyB}`,
    );
  }
  const metaA = JSON.stringify(a.metadata);
  const metaB = JSON.stringify(b.metadata);
  if (metaA !== metaB) {
    throw new Error(
      `Interpolation parity mismatch (${labelA} vs ${labelB}): metadata ${metaA} !== ${metaB}`,
    );
  }
  if (a.authBearer !== b.authBearer) {
    throw new Error(
      `Interpolation parity mismatch (${labelA} vs ${labelB}): bearer ${a.authBearer} !== ${b.authBearer}`,
    );
  }
}
