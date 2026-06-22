import { describe, it, expect } from 'vitest';
import {
  gqlRequiresTlsProxy,
  gqlTlsSettingsFromPartial,
  buildTabTlsSettings,
  normalizeGqlFetchTls,
  tlsApqGetNeedsPostProxy,
  serializeGqlTlsForProxy,
  parseGqlTlsFromBody,
} from './gqlTls';

describe('gqlTls', () => {
  it('gqlRequiresTlsProxy is true for skip-cert, CA, or mTLS fields', () => {
    expect(gqlRequiresTlsProxy({ skipTlsVerify: true })).toBe(true);
    expect(gqlRequiresTlsProxy({ caCert: '-----BEGIN CERTIFICATE-----\n' })).toBe(true);
    expect(gqlRequiresTlsProxy({ clientCert: 'cert', clientKey: 'key' })).toBe(true);
    expect(gqlRequiresTlsProxy({})).toBe(false);
  });

  it('gqlTlsSettingsFromPartial trims empty strings', () => {
    expect(gqlTlsSettingsFromPartial({ caCert: '  ' })).toEqual({});
    expect(gqlTlsSettingsFromPartial({ caCert: 'pem' }).caCert).toBe('pem');
  });

  it('buildTabTlsSettings merges resolution fields', () => {
    const tls = buildTabTlsSettings({
      skipTlsVerify: true,
      tlsCaCert: 'ca',
      tlsClientCert: 'cert',
      tlsClientKey: 'key',
    });
    expect(tls.skipTlsVerify).toBe(true);
    expect(tls.caCert).toBe('ca');
    expect(tls.clientCert).toBe('cert');
    expect(tls.clientKey).toBe('key');
  });

  it('buildTabTlsSettings preserves explicit skipTlsVerify false as absent', () => {
    const tls = buildTabTlsSettings({ skipTlsVerify: false, tlsCaCert: 'ca' });
    expect(tls.skipTlsVerify).toBeUndefined();
    expect(tls.caCert).toBe('ca');
  });

  it('normalizeGqlFetchTls accepts boolean legacy input', () => {
    expect(normalizeGqlFetchTls(true)).toEqual({ skipTlsVerify: true });
    expect(normalizeGqlFetchTls(false)).toEqual({});
  });

  it('tlsApqGetNeedsPostProxy is true when PEM fields are set', () => {
    expect(tlsApqGetNeedsPostProxy({ caCert: 'pem' })).toBe(true);
    expect(tlsApqGetNeedsPostProxy({ skipTlsVerify: true })).toBe(false);
  });

  it('serializeGqlTlsForProxy omits empty fields', () => {
    expect(serializeGqlTlsForProxy({ skipTlsVerify: true })).toEqual({ skipTlsVerify: true });
    expect(serializeGqlTlsForProxy({ caCert: 'ca', clientCert: 'c', clientKey: 'k' })).toMatchObject({
      caCert: 'ca',
      clientCert: 'c',
      clientKey: 'k',
    });
  });

  it('gqlTlsSettingsFromPartial returns empty object for undefined input', () => {
    expect(gqlTlsSettingsFromPartial(undefined)).toEqual({});
  });

  it('gqlRequiresTlsProxy is false for undefined and clientKey-only', () => {
    expect(gqlRequiresTlsProxy(undefined)).toBe(false);
    expect(gqlRequiresTlsProxy({ clientKey: 'key-only' })).toBe(true);
    expect(gqlRequiresTlsProxy({ clientCert: '  ' })).toBe(false);
  });

  it('parseGqlTlsFromBody returns empty for undefined body', () => {
    expect(parseGqlTlsFromBody(undefined)).toEqual({});
  });

  it('parseGqlTlsFromBody ignores non-string PEM fields', () => {
    expect(parseGqlTlsFromBody({
      skipTlsVerify: false,
      caCert: 123,
      clientCert: null,
      clientKey: ['bad'],
    })).toEqual({});
  });

  it('parseGqlTlsFromBody parses valid PEM fields', () => {
    expect(parseGqlTlsFromBody({
      skipTlsVerify: true,
      caCert: ' ca-pem ',
      clientCert: 'client-pem',
      clientKey: 'key-pem',
    })).toEqual({
      skipTlsVerify: true,
      caCert: 'ca-pem',
      clientCert: 'client-pem',
      clientKey: 'key-pem',
    });
  });

  it('normalizeGqlFetchTls passes through object settings', () => {
    expect(normalizeGqlFetchTls({ caCert: 'pem' })).toEqual({ caCert: 'pem' });
  });

  it('tlsApqGetNeedsPostProxy is false for undefined tls', () => {
    expect(tlsApqGetNeedsPostProxy(undefined)).toBe(false);
    expect(tlsApqGetNeedsPostProxy({ clientKey: 'k' })).toBe(true);
  });

  it('serializeGqlTlsForProxy returns empty for undefined tls', () => {
    expect(serializeGqlTlsForProxy(undefined)).toEqual({});
  });
});
