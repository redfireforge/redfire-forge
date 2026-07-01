/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { computeGrpcScenarioFingerprint, freezeGrpcScenarioSnapshot } from './fingerprint';
import { buildGrpcFirstCallScenarioSnapshot } from './snapshots';

describe('computeGrpcScenarioFingerprint', () => {
  it('is deterministic for identical scenario input', () => {
    const a = buildGrpcFirstCallScenarioSnapshot();
    const b = buildGrpcFirstCallScenarioSnapshot();
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(computeGrpcScenarioFingerprint({
      lessonId: a.lessonId,
      schemaVersion: a.schemaVersion,
      target: a.target,
      descriptorSource: a.descriptorSource,
      service: a.service,
      method: a.method,
      callType: a.callType,
      requestPayload: a.requestPayload,
      expectedStatus: a.expectedStatus,
      transportMode: a.transportMode,
      fixtureFingerprint: a.fixtureFingerprint,
    })).toBe(a.fingerprint);
  });

  it('changes when target changes', () => {
    const base = buildGrpcFirstCallScenarioSnapshot();
    const other = freezeGrpcScenarioSnapshot({
      lessonId: base.lessonId,
      schemaVersion: base.schemaVersion,
      target: 'localhost:50099',
      descriptorSource: base.descriptorSource,
      service: base.service,
      method: base.method,
      callType: base.callType,
      requestPayload: base.requestPayload,
      expectedStatus: base.expectedStatus,
      transportMode: base.transportMode,
      fixtureFingerprint: base.fixtureFingerprint,
    });
    expect(other.fingerprint).not.toBe(base.fingerprint);
  });
});
