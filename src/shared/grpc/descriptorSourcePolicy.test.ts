import { describe, expect, it } from 'vitest';
import {
  areDescriptorFingerprintsCompatible,
  buildDescriptorSourceFingerprint,
  createDefaultDescriptorSourceSelection,
  DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE,
  formatDescriptorExecutionIdentity,
  isDescriptorExecutionIdentityCompatible,
  isDescriptorSourceAvailable,
  normalizeDescriptorSourceSelection,
  resolveDescriptorSource,
  resolveDescriptorSourceFingerprint,
  shouldAttemptDescriptorSourceFallback,
} from './descriptorSourcePolicy';
import { FIXTURE_DESCRIPTOR } from './contractFixtures';

describe('descriptorSourcePolicy (Phase 3A)', () => {
  it('exposes default auto precedence order', () => {
    expect([...DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE]).toEqual([
      'reflection',
      'proto_files',
      'protoset',
      'bsr',
      'url_proto',
    ]);
  });

  it('resolveDescriptorSource picks manual source when mode is manual', () => {
    const result = resolveDescriptorSource({
      selection: { mode: 'manual', activeSource: 'protoset' },
      availability: { protoset: true, reflection: true },
    });
    expect(result).toEqual({ source: 'protoset', reason: 'manual' });
  });

  it('resolveDescriptorSource returns unavailable when manual source is not available', () => {
    const result = resolveDescriptorSource({
      selection: { mode: 'manual', activeSource: 'bsr' },
      availability: { reflection: true },
    });
    expect(result).toEqual({ source: null, reason: 'unavailable' });
  });

  it('resolveDescriptorSource follows auto precedence', () => {
    expect(resolveDescriptorSource({
      selection: createDefaultDescriptorSourceSelection(),
      availability: { reflection: true, proto_files: true },
    }).source).toBe('reflection');

    expect(resolveDescriptorSource({
      selection: createDefaultDescriptorSourceSelection(),
      availability: { reflection: false, proto_files: true, protoset: true },
    }).source).toBe('proto_files');

    expect(resolveDescriptorSource({
      selection: createDefaultDescriptorSourceSelection(),
      availability: { reflection: false, bsr: true },
    }).source).toBe('bsr');
  });

  it('treats reflection as available by default in auto mode', () => {
    expect(isDescriptorSourceAvailable('reflection', {})).toBe(true);
    expect(isDescriptorSourceAvailable('proto_files', {})).toBe(false);
  });

  it('resolveDescriptorSource returns unavailable when auto mode has no available sources', () => {
    expect(resolveDescriptorSource({
      selection: createDefaultDescriptorSourceSelection(),
      availability: { reflection: false, proto_files: false, protoset: false, bsr: false, url_proto: false },
    })).toEqual({ source: null, reason: 'unavailable' });
  });

  it('resolveDescriptorSource returns unavailable when manual mode has no activeSource', () => {
    expect(resolveDescriptorSource({
      selection: { mode: 'manual' },
      availability: { reflection: true },
    })).toEqual({ source: null, reason: 'unavailable' });
  });

  it('formatDescriptorExecutionIdentity returns key only without fingerprint', () => {
    expect(formatDescriptorExecutionIdentity('reflection:host:50051:abc', null)).toBe(
      'reflection:host:50051:abc',
    );
  });

  it('areDescriptorFingerprintsCompatible treats missing fingerprints as compatible', () => {
    expect(areDescriptorFingerprintsCompatible(null, null)).toBe(true);
    expect(areDescriptorFingerprintsCompatible(undefined, undefined)).toBe(true);
  });

  it('areDescriptorFingerprintsCompatible rejects one-sided missing fingerprints', () => {
    const fingerprint = buildDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: 'abc',
    });
    expect(areDescriptorFingerprintsCompatible(fingerprint, null)).toBe(false);
    expect(areDescriptorFingerprintsCompatible(null, fingerprint)).toBe(false);
  });

  it('resolveDescriptorSourceFingerprint prefers tab fingerprint then descriptor fields', () => {
    const tabFingerprint = buildDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: 'tab-hash',
    });
    expect(resolveDescriptorSourceFingerprint(FIXTURE_DESCRIPTOR, tabFingerprint)).toBe(tabFingerprint);

    const { sourceFingerprint: _ignored, ...descriptorWithoutFingerprint } = FIXTURE_DESCRIPTOR;
    expect(resolveDescriptorSourceFingerprint(descriptorWithoutFingerprint)).toMatchObject({
      source: FIXTURE_DESCRIPTOR.source,
      sourceRef: FIXTURE_DESCRIPTOR.sourceRef,
      contentSha256: FIXTURE_DESCRIPTOR.contentSha256,
    });

    expect(resolveDescriptorSourceFingerprint(FIXTURE_DESCRIPTOR)).toEqual(
      FIXTURE_DESCRIPTOR.sourceFingerprint,
    );
    expect(resolveDescriptorSourceFingerprint(null, null)).toBeUndefined();
  });

  it('isDescriptorExecutionIdentityCompatible allows missing snapshot fingerprint', () => {
    expect(isDescriptorExecutionIdentityCompatible(
      FIXTURE_DESCRIPTOR.key,
      undefined,
      FIXTURE_DESCRIPTOR,
    )).toBe(true);
  });

  it('shouldAttemptDescriptorSourceFallback only in auto mode for retriable failures', () => {
    expect(shouldAttemptDescriptorSourceFallback('auto', 'reflection_failed')).toBe(true);
    expect(shouldAttemptDescriptorSourceFallback('auto', 'describe_failed')).toBe(true);
    expect(shouldAttemptDescriptorSourceFallback('auto', 'source_unavailable')).toBe(true);
    expect(shouldAttemptDescriptorSourceFallback('auto', 'import_resolution_failed')).toBe(false);
    expect(shouldAttemptDescriptorSourceFallback('auto', 'cache_stale')).toBe(false);
    expect(shouldAttemptDescriptorSourceFallback('auto', 'schema_drift')).toBe(false);
    expect(shouldAttemptDescriptorSourceFallback('manual', 'reflection_failed')).toBe(false);
  });

  it('buildDescriptorSourceFingerprint requires contentSha256', () => {
    expect(() => buildDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: '',
    })).toThrow(/contentSha256/);

    const fingerprint = buildDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: 'abc123',
      reflectionVersion: 'v1',
    }, { etag: 'W/"etag-1"' });

    expect(fingerprint).toMatchObject({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: 'abc123',
      reflectionVersion: 'v1',
      etag: 'W/"etag-1"',
    });
    expect(fingerprint.resolvedAt).toBeTruthy();
  });

  it('formatDescriptorExecutionIdentity combines key and fingerprint', () => {
    const fingerprint = buildDescriptorSourceFingerprint({
      source: 'protoset',
      sourceRef: 'deadbeef',
      contentSha256: 'cafebabe',
    });
    expect(formatDescriptorExecutionIdentity('protoset:deadbeef:cafebabe', fingerprint))
      .toBe('protoset:deadbeef:cafebabe@protoset:deadbeef:cafebabe');
  });

  it('areDescriptorFingerprintsCompatible compares source identity fields', () => {
    const a = buildDescriptorSourceFingerprint({
      source: 'proto_files',
      sourceRef: 'hash-a',
      contentSha256: 'content-a',
    });
    const b = buildDescriptorSourceFingerprint({
      source: 'proto_files',
      sourceRef: 'hash-a',
      contentSha256: 'content-b',
    });
    expect(areDescriptorFingerprintsCompatible(a, a)).toBe(true);
    expect(areDescriptorFingerprintsCompatible(a, b)).toBe(false);
  });

  it('isDescriptorExecutionIdentityCompatible guards mixed-cache execution', () => {
    const fingerprint = buildDescriptorSourceFingerprint({
      ...FIXTURE_DESCRIPTOR,
      contentSha256: FIXTURE_DESCRIPTOR.contentSha256 ?? 'fixture-hash',
    });
    const compatibleDescriptor = {
      key: FIXTURE_DESCRIPTOR.key,
      source: FIXTURE_DESCRIPTOR.source,
      sourceRef: FIXTURE_DESCRIPTOR.sourceRef,
      contentSha256: FIXTURE_DESCRIPTOR.contentSha256,
      sourceFingerprint: fingerprint,
    };
    expect(isDescriptorExecutionIdentityCompatible(
      FIXTURE_DESCRIPTOR.key,
      fingerprint,
      compatibleDescriptor,
    )).toBe(true);

    expect(isDescriptorExecutionIdentityCompatible(
      'other-key',
      fingerprint,
      compatibleDescriptor,
    )).toBe(false);
  });

  it('normalizeDescriptorSourceSelection fills defaults', () => {
    expect(normalizeDescriptorSourceSelection()).toEqual({
      mode: 'auto',
      activeSource: undefined,
      autoPrecedence: [...DEFAULT_DESCRIPTOR_SOURCE_PRECEDENCE],
    });
  });
});
