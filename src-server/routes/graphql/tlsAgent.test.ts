import { describe, it, expect } from 'vitest';
import https from 'node:https';
import { buildGraphqlTlsAgent, tlsAgentForEndpoint } from './tlsAgent';

describe('buildGraphqlTlsAgent', () => {
  it('returns undefined for http URLs', () => {
    expect(buildGraphqlTlsAgent({ skipTlsVerify: true }, 'http://localhost/graphql')).toBeUndefined();
  });

  it('returns an https.Agent for skipTlsVerify on https', () => {
    const agent = buildGraphqlTlsAgent({ skipTlsVerify: true }, 'https://localhost:4443/graphql');
    expect(agent).toBeInstanceOf(https.Agent);
  });

  it('includes CA and client credentials for mTLS', () => {
    const ca = '-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----';
    const cert = '-----BEGIN CERTIFICATE-----\nclient\n-----END CERTIFICATE-----';
    const key = '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----';
    const agent = buildGraphqlTlsAgent({ caCert: ca, clientCert: cert, clientKey: key }, 'https://localhost:4445/graphql');
    expect(agent).toBeInstanceOf(https.Agent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((agent as any).options.ca).toBe(ca);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((agent as any).options.cert).toBe(cert);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((agent as any).options.key).toBe(key);
  });
});

describe('tlsAgentForEndpoint', () => {
  it('returns undefined for http endpoints', () => {
    expect(tlsAgentForEndpoint({ skipTlsVerify: true }, 'http://localhost/graphql')).toBeUndefined();
  });

  it('delegates to buildGraphqlTlsAgent for https endpoints', () => {
    const agent = tlsAgentForEndpoint({ skipTlsVerify: true }, 'https://localhost:4443/graphql');
    expect(agent).toBeInstanceOf(https.Agent);
  });
});
