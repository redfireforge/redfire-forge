/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { FIXTURE_ECHO_PROTO } from '../../src/shared/grpc/contractFixtures.js';
import {
  cacheProtoIngestRoot,
  clearProtoFileDescriptorPool,
  computeProtoIngestFingerprint,
  createRootWithBundledWkt,
  getCachedProtoIngestRoot,
} from './protoFileDescriptorPool.js';
import { buildProtoFileMap } from './protoImportResolver.js';
import { parseProtoFiles } from './protoDescriptorParser.js';

describe('protoFileDescriptorPool (OQ-3)', () => {
  beforeEach(() => {
    clearProtoFileDescriptorPool();
  });

  it('computes stable fingerprints for equivalent proto ingest sets', () => {
    const files = [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }];
    const left = computeProtoIngestFingerprint(files, ['shared']);
    const right = computeProtoIngestFingerprint([...files], ['shared']);
    expect(left).toBe(right);
  });

  it('seeds roots from cached bundled WKT descriptors', () => {
    const fileMap = buildProtoFileMap({
      protoFiles: [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }],
      includeWktBundle: true,
    });
    const root = createRootWithBundledWkt(fileMap, []);
    expect(root.lookupType('google.protobuf.Timestamp')?.name).toBe('Timestamp');
  });

  it('returns cached ingest root for repeated parseProtoFiles calls', () => {
    const files = [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }];
    const fingerprint = computeProtoIngestFingerprint(files, []);
    expect(getCachedProtoIngestRoot(fingerprint)).toBeUndefined();

    const first = parseProtoFiles(files);
    const cached = getCachedProtoIngestRoot(fingerprint);
    expect(cached).toBe(first);

    const second = parseProtoFiles(files);
    expect(second).toBe(first);
  });

  it('clearProtoFileDescriptorPool drops ingest cache entries', () => {
    const files = [{ path: 'echo.proto', content: FIXTURE_ECHO_PROTO }];
    parseProtoFiles(files);
    const fingerprint = computeProtoIngestFingerprint(files, []);
    expect(getCachedProtoIngestRoot(fingerprint)).toBeTruthy();

    clearProtoFileDescriptorPool();
    expect(getCachedProtoIngestRoot(fingerprint)).toBeUndefined();
  });

  it('cacheProtoIngestRoot stores provided roots by fingerprint', () => {
    const fileMap = buildProtoFileMap({ protoFiles: [], includeWktBundle: true });
    const root = createRootWithBundledWkt(fileMap, []);
    const fingerprint = 'manual-test-fingerprint';
    cacheProtoIngestRoot(fingerprint, root);
    expect(getCachedProtoIngestRoot(fingerprint)).toBe(root);
  });
});
