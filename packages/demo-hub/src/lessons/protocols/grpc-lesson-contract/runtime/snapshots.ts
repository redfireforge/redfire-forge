/**
 * Phase 12B — immutable scenario snapshot factories per shipped lesson.
 */
import {
  GRPC_DEMO_TARGET,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_ENVOY_PROBE_URL,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_URL,
} from '../../../../adapters/grpcStudioAdapter';
import { GRPC_LESSON_SCHEMA_VERSION } from '../types';
import { freezeGrpcScenarioSnapshot } from './fingerprint';
import type { GrpcLessonScenarioSnapshot } from './types';

const GRPC1_FIXTURE_FINGERPRINT = GRPC_DEMO_PREREQUISITE_ENDPOINTS.join('|');

const GRPC_TRANSPORT_MODES_FIXTURE_FINGERPRINT = [
  ...GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_ENVOY_PROBE_URL,
].join('|');

const GRPC_SPRING_FIXTURE_FINGERPRINT = [
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_URL,
].join('|');

type SnapshotSeed = Omit<GrpcLessonScenarioSnapshot, 'fingerprint'>;

/** Shared unary Echo seed used by most Studio lessons. */
function standardEchoSeed(
  lessonId: string,
  overrides: Partial<SnapshotSeed> = {},
): SnapshotSeed {
  return {
    lessonId,
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
    ...overrides,
  };
}

/** GRPC-1 — unary Echo via reflection on Docker echo + Express proxy. */
export function buildGrpcFirstCallScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-first-call'));
}

/** GRPC-5 — TLS / mTLS configuration (plaintext baseline; live TLS targets in later steps). */
export function buildGrpcTlsScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-tls'));
}

/** GRPC-16 — consolidated schema discovery (reflection + proto import orientation). */
export function buildGrpcSchemaDiscoveryScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-schema-discovery'));
}

/** GRPC-3 — streaming patterns lesson (server, client, bidi). Primary verify method is ServerStream. */
export function buildGrpcStreamingScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(
    standardEchoSeed('grpc-streaming', {
      method: 'ServerStream',
      callType: 'server-stream',
      requestPayload: { message: 'stream-demo', repeat_count: 5, interval_ms: 300 },
    }),
  );
}

/** GRPC-4 — request metadata & authentication lesson (headers, auth types, conflict detection). */
export function buildGrpcMetadataAuthScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-metadata-auth'));
}

/** GRPC-11 — workflow integration lesson (grpcUnary + grpcAssert chaining). */
export function buildGrpcWorkflowIntegrationScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(
    standardEchoSeed('grpc-workflow-integration', {
      target: 'localhost:50051',
      requestPayload: { message: 'workflow-test' },
    }),
  );
}

/** GRPC-12 — load testing lesson (concurrent unary calls + metrics). */
export function buildGrpcLoadTestingScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-load-testing'));
}

/** GRPC-13 — mock server lesson (rules, runtime, and network listener). */
export function buildGrpcMockServerScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-mock-server'));
}

/** GRPC-14 — proto schema diff lesson. */
export function buildGrpcSchemaDiffScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-schema-diff'));
}

/** GRPC-15 — Spring Boot & Spring gRPC integration (Netty :9090 + Servlet :8081). */
export function buildGrpcSpringBootScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(
    standardEchoSeed('grpc-spring-boot', {
      target: 'localhost:9090',
      fixtureFingerprint: GRPC_SPRING_FIXTURE_FINGERPRINT,
    }),
  );
}

/** GRPC-19 — transport modes lesson (Envoy gRPC-Web + express proxy retry). */
export function buildGrpcTransportModesScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(
    standardEchoSeed('grpc-transport-modes', {
      fixtureFingerprint: GRPC_TRANSPORT_MODES_FIXTURE_FINGERPRINT,
    }),
  );
}

/** GRPC-20 — full form editor lesson. */
export function buildGrpcProtoFormScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-proto-form'));
}

/** GRPC-21 — environments, collections & history. */
export function buildGrpcEnvCollectionsScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-env-collections'));
}

/** GRPC-22 — grpcurl interop lesson. */
export function buildGrpcGrpcurlScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-grpcurl'));
}

/** GRPC-23 — Tauri desktop transport lesson. */
export function buildGrpcTauriDesktopScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(
    standardEchoSeed('grpc-tauri-desktop', {
      transportMode: 'tauri',
    }),
  );
}

/** GRPC-24 — workflow runner & results. */
export function buildGrpcWorkflowRunnerScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(
    standardEchoSeed('grpc-workflow-runner', {
      requestPayload: { message: 'workflow-test' },
    }),
  );
}

/** GRPC-25 — multi-tab gRPC calls. */
export function buildGrpcTabsScenarioSnapshot(): GrpcLessonScenarioSnapshot {
  return freezeGrpcScenarioSnapshot(standardEchoSeed('grpc-tabs'));
}

const SNAPSHOT_BUILDERS: Readonly<Record<string, () => GrpcLessonScenarioSnapshot>> = {
  'grpc-first-call': buildGrpcFirstCallScenarioSnapshot,
  'grpc-tls': buildGrpcTlsScenarioSnapshot,
  'grpc-schema-discovery': buildGrpcSchemaDiscoveryScenarioSnapshot,
  'grpc-streaming': buildGrpcStreamingScenarioSnapshot,
  'grpc-metadata-auth': buildGrpcMetadataAuthScenarioSnapshot,
  'grpc-workflow-integration': buildGrpcWorkflowIntegrationScenarioSnapshot,
  'grpc-load-testing': buildGrpcLoadTestingScenarioSnapshot,
  'grpc-mock-server': buildGrpcMockServerScenarioSnapshot,
  'grpc-schema-diff': buildGrpcSchemaDiffScenarioSnapshot,
  'grpc-spring-boot': buildGrpcSpringBootScenarioSnapshot,
  'grpc-transport-modes': buildGrpcTransportModesScenarioSnapshot,
  'grpc-proto-form': buildGrpcProtoFormScenarioSnapshot,
  'grpc-env-collections': buildGrpcEnvCollectionsScenarioSnapshot,
  'grpc-grpcurl': buildGrpcGrpcurlScenarioSnapshot,
  'grpc-tauri-desktop': buildGrpcTauriDesktopScenarioSnapshot,
  'grpc-workflow-runner': buildGrpcWorkflowRunnerScenarioSnapshot,
  'grpc-tabs': buildGrpcTabsScenarioSnapshot,
};

/** Build the frozen scenario snapshot for a shipped lesson id. */
export function buildGrpcScenarioSnapshotForLesson(lessonId: string): GrpcLessonScenarioSnapshot | null {
  const builder = SNAPSHOT_BUILDERS[lessonId];
  return builder ? builder() : null;
}

/** Lesson ids that have a registered frozen scenario snapshot. */
export function listGrpcScenarioSnapshotLessonIds(): readonly string[] {
  return Object.keys(SNAPSHOT_BUILDERS);
}
