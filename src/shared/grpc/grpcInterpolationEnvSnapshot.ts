/**
 * Phase 9C — immutable env snapshot binding for gRPC execute requests.
 */
import {
  computeGrpcInterpolationEnvFingerprint,
  computeGrpcInterpolationEnvLayerFingerprints,
  mergeGrpcInterpolationEnvLayers,
  normalizeGrpcInterpolationEnvMap,
  type GrpcInterpolationEnvLayers,
} from './grpcInterpolationPrecedence';
import { assertGrpcInterpolationEnvAcyclic } from './grpcInterpolationCycleDetector';

/** Frozen env context captured at execute/snapshot build time. */
export interface GrpcInterpolationEnvSnapshot {
  /** Merged, immutable env map used for template resolution. */
  env: Readonly<Record<string, string>>;
  /** Deterministic fingerprint of `env` for cache/compare. */
  fingerprint: string;
  /** ISO timestamp when the snapshot was captured. */
  capturedAt: string;
  /** Per-layer fingerprints for diagnostics (no secret values). */
  layerFingerprints: Record<string, string>;
}

export interface CreateGrpcInterpolationEnvSnapshotOptions {
  capturedAt?: string;
}

/** Merge precedence layers and return a frozen env snapshot. */
export function createGrpcInterpolationEnvSnapshot(
  layers: GrpcInterpolationEnvLayers,
  options?: CreateGrpcInterpolationEnvSnapshotOptions,
): GrpcInterpolationEnvSnapshot {
  const merged = mergeGrpcInterpolationEnvLayers(layers);
  assertGrpcInterpolationEnvAcyclic(merged);
  const env = Object.freeze({ ...merged });
  const layerFingerprints = computeGrpcInterpolationEnvLayerFingerprints(layers);
  return {
    env,
    fingerprint: computeGrpcInterpolationEnvFingerprint(env),
    capturedAt: options?.capturedAt ?? new Date().toISOString(),
    layerFingerprints,
  };
}

/** Create a snapshot from an already-merged flat env map (harness runner path). */
export function createGrpcInterpolationEnvSnapshotFromMap(
  env: Readonly<Record<string, string>>,
  options?: CreateGrpcInterpolationEnvSnapshotOptions,
): GrpcInterpolationEnvSnapshot {
  const normalized = normalizeGrpcInterpolationEnvMap(env);
  assertGrpcInterpolationEnvAcyclic(normalized);
  const frozen = Object.freeze({ ...normalized });
  return {
    env: frozen,
    fingerprint: computeGrpcInterpolationEnvFingerprint(frozen),
    capturedAt: options?.capturedAt ?? new Date().toISOString(),
    layerFingerprints: {
      merged: computeGrpcInterpolationEnvFingerprint(frozen),
    },
  };
}
