/**
 * Phase 12B — stable scenario fingerprint for reproducibility metadata.
 */
import type { GrpcLessonScenarioSnapshot } from './types';

type FingerprintInput = Omit<GrpcLessonScenarioSnapshot, 'fingerprint'>;

/** Deterministic fingerprint from scenario fields (djb2 over stable JSON). */
export function computeGrpcScenarioFingerprint(input: FingerprintInput): string {
  const canonical = JSON.stringify({
    lessonId: input.lessonId,
    schemaVersion: input.schemaVersion,
    target: input.target,
    descriptorSource: input.descriptorSource,
    service: input.service,
    method: input.method,
    callType: input.callType,
    requestPayload: input.requestPayload,
    expectedStatus: input.expectedStatus,
    transportMode: input.transportMode,
    fixtureFingerprint: input.fixtureFingerprint,
  });
  let hash = 5381;
  for (let i = 0; i < canonical.length; i += 1) {
    hash = ((hash << 5) + hash) ^ canonical.charCodeAt(i);
  }
  return `grpc-scenario-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function freezeGrpcScenarioSnapshot(
  input: FingerprintInput,
): GrpcLessonScenarioSnapshot {
  const fingerprint = computeGrpcScenarioFingerprint(input);
  return Object.freeze({
    ...input,
    fingerprint,
    requestPayload: Object.freeze({ ...input.requestPayload }),
  });
}
