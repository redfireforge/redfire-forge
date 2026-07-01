import { describe, expect, it } from 'vitest';
import { GRPC_REDACTED_PLACEHOLDER } from './grpcRedaction';
import {
  assertNoGrpcSecretLeakage,
  scanForbiddenGrpcPersistTargets,
  scanGrpcObjectForSecretLeakage,
} from './grpcSecretLeakScan';

const VALID_PEM = `-----BEGIN CERTIFICATE-----
LEAKED
-----END CERTIFICATE-----`;

describe('grpcSecretLeakScan coverage gaps', () => {
  it('assertNoGrpcSecretLeakage throws with finding summary', () => {
    expect(() => assertNoGrpcSecretLeakage({
      auth: { bearerToken: 'super-secret-token-value' },
    }, 'export')).toThrow(/gRPC secret leakage in export/);
  });

  it('detects bearer and basic patterns in secret-like string paths', () => {
    const bearerFindings = scanGrpcObjectForSecretLeakage({
      headers: { authorization: 'Bearer abcdefghijklmnop' },
    });
    expect(bearerFindings.some((f) => f.reason.includes('Bearer'))).toBe(true);

    const basicFindings = scanGrpcObjectForSecretLeakage({
      headers: { authorization: 'Basic abcdefghijklmnop==' },
    });
    expect(basicFindings.some((f) => f.reason.includes('Basic'))).toBe(true);
  });

  it('walks arrays and ignores redacted bearer previews', () => {
    const findings = scanGrpcObjectForSecretLeakage({
      items: [{ note: 'Bearer abc…wxyz' }],
    });
    expect(findings).toEqual([]);
    expect(scanGrpcObjectForSecretLeakage({
      items: [{ password: 'Basic ••••' }],
    })).toEqual([]);
  });

  it('flags secret-like key names with embedded PEM', () => {
    const findings = scanGrpcObjectForSecretLeakage({
      customPemField: VALID_PEM,
    });
    expect(findings.some((f) => f.path.includes('customPemField'))).toBe(true);
  });

  it('scanForbiddenGrpcPersistTargets skips undefined targets', () => {
    expect(scanForbiddenGrpcPersistTargets({})).toEqual([]);
  });

  it('allows classified fields with redacted placeholders', () => {
    expect(scanGrpcObjectForSecretLeakage({
      auth: { bearerToken: GRPC_REDACTED_PLACEHOLDER },
      nested: [{ clientSecret: '[base64]' }],
    })).toEqual([]);
  });

  it('ignores empty strings and redacted bearer previews in walk paths', () => {
    expect(scanGrpcObjectForSecretLeakage({
      note: '',
      headers: { authorization: 'Bearer abc…wxyz' },
    })).toEqual([]);
    expect(scanGrpcObjectForSecretLeakage({
      password: 'Basic ••••',
    })).toEqual([]);
  });

  it('flags classified auth fields and secret leaf keys during object walks', () => {
    const passwordFinding = scanGrpcObjectForSecretLeakage({
      auth: { basicPassword: 'Basic abcdefghijklmnop==' },
    });
    expect(passwordFinding.some((f) => f.path.includes('basicPassword'))).toBe(true);

    const findings = scanGrpcObjectForSecretLeakage({
      items: [{ bsrToken: 'raw-bsr-token-value-here' }],
      metadata: { apiKeyValue: 'super-secret-api-key-value' },
    });
    expect(findings.some((f) => f.path.includes('bsrToken'))).toBe(true);
    expect(findings.some((f) => f.path.includes('apiKeyValue'))).toBe(true);
  });

  it('flags secret-like key names that embed PEM without classified path match', () => {
    const findings = scanGrpcObjectForSecretLeakage({
      customSecretField: VALID_PEM,
    });
    expect(findings.some((f) => f.path.includes('customSecretField'))).toBe(true);
    expect(findings.some((f) => f.reason.includes('PEM'))).toBe(true);
  });

  it('scanForbiddenGrpcPersistTargets scans configured forbidden stores', () => {
    const findings = scanForbiddenGrpcPersistTargets({
      grpc_collections_v1: {
        collections: [{
          savedRequests: [{ auth: { bearerToken: 'must-not-persist-token-value' } }],
        }],
      },
    });
    expect(findings.some((f) => f.path.startsWith('grpc_collections_v1'))).toBe(true);
  });

  it('flags raw secrets on secret-like string paths with rootPath prefix', () => {
    const findings = scanGrpcObjectForSecretLeakage('Bearer abcdefghijklmnop', {
      rootPath: 'metadata.authorization',
    });
    expect(findings.some((f) => f.path.includes('metadata.authorization'))).toBe(true);
  });
});
