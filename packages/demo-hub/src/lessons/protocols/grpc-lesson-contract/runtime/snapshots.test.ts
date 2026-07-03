/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  buildGrpcFirstCallScenarioSnapshot,
  buildGrpcSchemaDiscoveryScenarioSnapshot,
  buildGrpcScenarioSnapshotForLesson,
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
    expect(buildGrpcScenarioSnapshotForLesson('grpc-tls')).toBeNull();
  });

  it('builds GRPC-16 schema discovery snapshot', () => {
    const snap = buildGrpcSchemaDiscoveryScenarioSnapshot();
    expect(snap.lessonId).toBe('grpc-schema-discovery');
    expect(snap.descriptorSource).toBe('reflection');
    expect(snap.callType).toBe('unary');
    expect(snap.requestPayload.message).toBe(GRPC_DEMO_MESSAGE);
    expect(buildGrpcScenarioSnapshotForLesson('grpc-schema-discovery')?.fingerprint).toBe(snap.fingerprint);
  });
});
