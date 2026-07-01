/**
 * Phase 12B — immutable scenario snapshot factories per shipped lesson.
 */
import {
  GRPC_DEMO_TARGET,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
} from '../../../../adapters/grpcStudioAdapter';
import { GRPC_LESSON_SCHEMA_VERSION } from '../types';
import { freezeGrpcScenarioSnapshot } from './fingerprint';
import type { GrpcLessonScenarioSnapshot } from './types';

const GRPC1_FIXTURE_FINGERPRINT = GRPC_DEMO_PREREQUISITE_ENDPOINTS.join('|');

/** GRPC-1 — unary Echo via reflection on Docker echo + Express proxy. */
export function buildGrpcFirstCallScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot({
    lessonId: 'grpc-first-call',
    schemaVersion: GRPC_LESSON_SCHEMA_VERSION,
    target: GRPC_DEMO_TARGET,
    descriptorSource: 'reflection',
    service: 'echo.EchoService',
    method: 'Echo',
    callType: 'unary',
    requestPayload: { message: 'Hello from gRPC Studio' },
    expectedStatus: 'OK',
    transportMode: 'express',
    fixtureFingerprint: GRPC1_FIXTURE_FINGERPRINT,
  });
}

const SNAPSHOT_BUILDERS: Readonly<Record<string, () => GrpcLessonScenarioSnapshot>> = {
  'grpc-first-call': buildGrpcFirstCallScenarioSnapshot,
};

/** Build the frozen scenario snapshot for a shipped lesson id. */
export function buildGrpcScenarioSnapshotForLesson(lessonId: string): GrpcLessonScenarioSnapshot | null {
  const builder = SNAPSHOT_BUILDERS[lessonId];
  return builder ? builder() : null;
}
