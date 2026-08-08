/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  GRPC_ENVOY_PROBE_URL,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_URL,
  GRPC_TRANSPORT_MODES_PREREQUISITE_ENDPOINTS,
} from '../../../../adapters/grpcStudioAdapter';
import { shippedGrpcLessonRosterEntries } from '../roster';
import {
  buildGrpcFirstCallScenarioSnapshot,
  buildGrpcMetadataAuthScenarioSnapshot,
  buildGrpcMockServerScenarioSnapshot,
  buildGrpcSchemaDiscoveryScenarioSnapshot,
  buildGrpcScenarioSnapshotForLesson,
  buildGrpcSpringBootScenarioSnapshot,
  buildGrpcTlsScenarioSnapshot,
  buildGrpcTransportModesScenarioSnapshot,
  buildGrpcStreamingScenarioSnapshot,
  buildGrpcWorkflowIntegrationScenarioSnapshot,
  listGrpcScenarioSnapshotLessonIds,
} from './snapshots';
import { GRPC_DEMO_MESSAGE } from '../../grpc-lesson-helpers';

describe('buildGrpcScenarioSnapshotForLesson', () => {
  it('builds GRPC-1 unary echo snapshot', () => {
    const snap = buildGrpcFirstCallScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-first-call');
    expect(snap.callType).toBe('unary');
    expect(snap.descriptorSource).toBe('reflection');
    expect(snap.service).toBe('echo.EchoService');
    expect(snap.method).toBe('Echo');
    expect(snap.requestPayload.message).toBe(GRPC_DEMO_MESSAGE);
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.requestPayload)).toBe(true);
  });

  it('returns null for unregistered lessons', () => {
    expect(buildGrpcScenarioSnapshotForLesson('grpc-not-a-real-lesson')).toBeNull();
  });

  it('builds GRPC-5 TLS snapshot', () => {
    const snap = buildGrpcTlsScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-tls');
    expect(buildGrpcScenarioSnapshotForLesson('grpc-tls')?.fingerprint).toBe(snap.fingerprint);
  });

  it('registers a snapshot for every shipped roster lesson', () => {
    const shippedIds = shippedGrpcLessonRosterEntries().map((e) => e.id);
    const registered = new Set(listGrpcScenarioSnapshotLessonIds());
    for (const id of shippedIds) {
      expect(registered.has(id), `missing snapshot for shipped lesson ${id}`).toBe(true);
      expect(buildGrpcScenarioSnapshotForLesson(id)?.lessonId).toBe(id);
    }
  });

  it('builds GRPC-16 schema discovery snapshot', () => {
    const snap = buildGrpcSchemaDiscoveryScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-schema-discovery');
    expect(snap.descriptorSource).toBe('reflection');
    expect(snap.callType).toBe('unary');
    expect(snap.requestPayload.message).toBe(GRPC_DEMO_MESSAGE);
    expect(buildGrpcScenarioSnapshotForLesson('grpc-schema-discovery')?.fingerprint).toBe(snap.fingerprint);
  });

  it('builds GRPC-3 streaming snapshot', () => {
    const snap = buildGrpcStreamingScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-streaming');
    expect(snap.callType).toBe('server-stream');
    expect(snap.method).toBe('ServerStream');
    expect(buildGrpcScenarioSnapshotForLesson('grpc-streaming')?.fingerprint).toBe(snap.fingerprint);
  });

  it('builds GRPC-4 metadata auth snapshot', () => {
    const snap = buildGrpcMetadataAuthScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-metadata-auth');
    expect(buildGrpcScenarioSnapshotForLesson('grpc-metadata-auth')?.lessonId).toBe('grpc-metadata-auth');
  });

  it('builds GRPC-11 workflow integration snapshot', () => {
    const snap = buildGrpcWorkflowIntegrationScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-workflow-integration');
    expect(snap.requestPayload.message).toBe('workflow-test');
    expect(buildGrpcScenarioSnapshotForLesson('grpc-workflow-integration')?.method).toBe('Echo');
  });

  it('builds GRPC-13 mock server snapshot', () => {
    const snap = buildGrpcMockServerScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-mock-server');
    expect(buildGrpcScenarioSnapshotForLesson('grpc-mock-server')?.target).toBe(snap.target);
  });

  it('builds GRPC-15 Spring Boot snapshot with actuator fixture fingerprint', () => {
    const snap = buildGrpcSpringBootScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-spring-boot');
    expect(snap.target).toBe('localhost:9090');
    expect(snap.fixtureFingerprint).toBe(
      [GRPC_EXPRESS_HEALTH_URL, GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_URL].join('|'),
    );
    expect(buildGrpcScenarioSnapshotForLesson('grpc-spring-boot')?.fingerprint).toBe(snap.fingerprint);
  });

  it('builds GRPC-19 transport modes snapshot with Envoy fixture fingerprint', () => {
    const snap = buildGrpcTransportModesScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-transport-modes');
    expect(snap.target).toBe('localhost:50051');
    expect(snap.method).toBe('Echo');
    expect(snap.fixtureFingerprint).toBe(GRPC_TRANSPORT_MODES_PREREQUISITE_ENDPOINTS.join('|'));
    expect(snap.fixtureFingerprint).toContain(GRPC_ENVOY_PROBE_URL);
    expect(buildGrpcScenarioSnapshotForLesson('grpc-transport-modes')?.fingerprint).toBe(snap.fingerprint);
  });
});
