/**
 * @vitest-environment node
 * Phase 4F — channel credentials factory tests.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import tls from 'node:tls';
import { buildGrpcChannelCredentials } from './grpcChannelCredentials.js';

const createInsecure = vi.fn(() => ({}));
const createSsl = vi.fn(() => ({}));

vi.mock('./grpcJsLoader.js', () => ({
  grpc: {
    credentials: {
      createInsecure: (...args: unknown[]) => createInsecure(...args),
      createSsl: (...args: unknown[]) => createSsl(...args),
    },
  },
}));

const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
-----END CERTIFICATE-----`;

const VALID_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC
-----END PRIVATE KEY-----`;

describe('grpcChannelCredentials (Phase 4F)', () => {
  beforeEach(() => {
    createInsecure.mockClear();
    createSsl.mockClear();
  });

  afterEach(() => {
    resetAllMocks();
  });

  it('uses insecure credentials when tlsMode is disabled', () => {
    buildGrpcChannelCredentials({ tlsMode: 'disabled' });
    expect(createInsecure).toHaveBeenCalled();
    expect(createSsl).not.toHaveBeenCalled();
  });

  it('uses SSL credentials for tls mode with optional CA', () => {
    buildGrpcChannelCredentials({
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: VALID_CERT, serverNameOverride: 'grpc.local' },
    });
    expect(createSsl).toHaveBeenCalledWith(
      expect.any(Buffer),
      null,
      null,
      expect.objectContaining({ checkServerIdentity: expect.any(Function) }),
    );
  });

  it('uses SSL credentials with client key/cert for mtls', () => {
    buildGrpcChannelCredentials({
      tlsMode: 'mtls',
      tlsConfig: {
        serverCaPem: VALID_CERT,
        clientCertPem: VALID_CERT,
        clientKeyPem: VALID_KEY,
      },
    });
    expect(createSsl).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(Buffer),
      expect.any(Buffer),
      undefined,
    );
  });

  it('passes null root certs when serverCaPem is absent or whitespace', () => {
    buildGrpcChannelCredentials({ tlsMode: 'tls' });
    expect(createSsl).toHaveBeenCalledWith(null, null, null, undefined);

    buildGrpcChannelCredentials({
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: '   ' },
    });
    expect(createSsl).toHaveBeenLastCalledWith(null, null, null, undefined);
  });

  it('omits client cert/key buffers for mtls when PEM fields are blank', () => {
    buildGrpcChannelCredentials({
      tlsMode: 'mtls',
      tlsConfig: {
        clientCertPem: '  ',
        clientKeyPem: '',
      },
    });
    expect(createSsl).toHaveBeenCalledWith(null, null, null, undefined);
  });

  it('wires serverNameOverride into checkServerIdentity for tls mode', () => {
    const checkSpy = vi.spyOn(tls, 'checkServerIdentity');
    buildGrpcChannelCredentials({
      tlsMode: 'tls',
      tlsConfig: {
        serverCaPem: VALID_CERT,
        serverNameOverride: 'grpc.override.local',
      },
    });
    const verifyOptions = createSsl.mock.calls.at(-1)?.[3] as {
      checkServerIdentity?: (host: string, cert: tls.PeerCertificate) => Error | undefined;
    };
    expect(verifyOptions?.checkServerIdentity).toEqual(expect.any(Function));

    const fakeCert = {} as tls.PeerCertificate;
    verifyOptions?.checkServerIdentity?.('ignored-host', fakeCert);
    expect(checkSpy).toHaveBeenCalledWith('grpc.override.local', fakeCert);
  });

  it('defaults to insecure credentials when tlsMode is omitted', () => {
    buildGrpcChannelCredentials({});
    expect(createInsecure).toHaveBeenCalled();
  });

  it('uses tls mode without serverName override', () => {
    buildGrpcChannelCredentials({
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: VALID_CERT },
    });
    expect(createSsl).toHaveBeenCalledWith(
      expect.any(Buffer),
      null,
      null,
      undefined,
    );
  });

  it('includes only client cert buffer when mtls key is blank', () => {
    buildGrpcChannelCredentials({
      tlsMode: 'mtls',
      tlsConfig: {
        clientCertPem: VALID_CERT,
        clientKeyPem: '   ',
      },
    });
    expect(createSsl).toHaveBeenCalledWith(
      null,
      null,
      expect.any(Buffer),
      undefined,
    );
  });
});
