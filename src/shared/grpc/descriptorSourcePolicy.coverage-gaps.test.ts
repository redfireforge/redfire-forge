import { describe, expect, it } from 'vitest';
import {
  buildDescriptorSourceFingerprint,
  isDescriptorExecutionIdentityCompatible,
  isDescriptorSourceAvailable,
  resolveDescriptorSourceFingerprint,
} from './descriptorSourcePolicy';
import { FIXTURE_DESCRIPTOR } from './contractFixtures';

describe('descriptorSourcePolicy coverage gaps', () => {
  it('isDescriptorSourceAvailable handles protoset, bsr, and url_proto flags', () => {
    expect(isDescriptorSourceAvailable('protoset', { protoset: true })).toBe(true);
    expect(isDescriptorSourceAvailable('bsr', { bsr: true })).toBe(true);
    expect(isDescriptorSourceAvailable('url_proto', { url_proto: true })).toBe(true);
    expect(isDescriptorSourceAvailable('protoset', { protoset: false })).toBe(false);
  });

  it('resolveDescriptorSourceFingerprint returns undefined without content identity', () => {
    expect(resolveDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: '   ',
    })).toBeUndefined();
  });

  it('isDescriptorExecutionIdentityCompatible compares derived fingerprints', () => {
    const fingerprint = buildDescriptorSourceFingerprint({
      source: 'reflection',
      sourceRef: 'localhost:50051',
      contentSha256: 'hash-a',
    });
    const descriptor = {
      key: FIXTURE_DESCRIPTOR.key,
      source: 'reflection' as const,
      sourceRef: 'localhost:50051',
      contentSha256: 'hash-b',
    };
    expect(isDescriptorExecutionIdentityCompatible(FIXTURE_DESCRIPTOR.key, fingerprint, descriptor)).toBe(false);

    const matching = {
      ...descriptor,
      contentSha256: 'hash-a',
    };
    expect(isDescriptorExecutionIdentityCompatible(FIXTURE_DESCRIPTOR.key, fingerprint, matching)).toBe(true);
  });

  it('buildDescriptorSourceFingerprint trims empty sourceRef to unknown', () => {
    const fingerprint = buildDescriptorSourceFingerprint({
      source: 'protoset',
      sourceRef: '   ',
      contentSha256: 'abc',
    });
    expect(fingerprint.sourceRef).toBe('unknown');
  });

  it('isDescriptorSourceAvailable returns false for unknown source kinds', () => {
    expect(isDescriptorSourceAvailable('unknown' as 'reflection', { reflection: true })).toBe(false);
  });
});
