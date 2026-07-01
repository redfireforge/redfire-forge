import { describe, expect, it } from 'vitest';
import {
  authFieldHasStoredValue,
  buildMaskedFieldsFromVaultHydration,
  clearMaskedAuthField,
  clearMaskedTlsField,
  mergeMaskedSecretFields,
  pruneAuthMaskForConfig,
  tlsFieldHasStoredValue,
  unmaskSecretField,
  withoutTlsMaskFields,
} from './grpcSecretFieldUi';

describe('grpcSecretFieldUi (Phase 4G)', () => {
  it('builds mask flags from vault hydration', () => {
    expect(buildMaskedFieldsFromVaultHydration({
      tlsValues: { serverCaPem: 'pem-ca', clientCertPem: '', clientKeyPem: 'pem-key' },
      authValues: { bearerToken: 'tok', 'oauth2.clientSecret': 'sec' },
    })).toEqual({
      tls: { serverCaPem: true, clientKeyPem: true },
      auth: { bearerToken: true, oauth2ClientSecret: true },
    });
  });

  it('detects stored TLS and auth values', () => {
    expect(tlsFieldHasStoredValue({ serverCaPem: 'x' }, 'serverCaPem')).toBe(true);
    expect(authFieldHasStoredValue({ type: 'bearer', bearerToken: 'tok' }, 'bearerToken')).toBe(true);
    expect(authFieldHasStoredValue({ type: 'none' }, 'bearerToken')).toBe(false);
  });

  it('clears masked TLS and auth fields', () => {
    expect(clearMaskedTlsField({ serverCaPem: 'a', clientCertPem: 'b' }, 'serverCaPem')).toEqual({
      clientCertPem: 'b',
    });
    expect(clearMaskedAuthField({ type: 'oauth2', oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 's' } }, 'oauth2ClientSecret')).toEqual({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: '' },
    });
  });

  it('unmasks and merges masked secret field maps', () => {
    const merged = mergeMaskedSecretFields(
      { tls: { serverCaPem: true } },
      { auth: { bearerToken: true } },
    );
    expect(merged).toEqual({
      tls: { serverCaPem: true },
      auth: { bearerToken: true },
    });
    expect(unmaskSecretField(merged, 'tls', 'serverCaPem')).toEqual({
      auth: { bearerToken: true },
    });
    expect(mergeMaskedSecretFields(undefined, { auth: { bearerToken: true } })).toEqual({
      auth: { bearerToken: true },
    });
  });

  it('withoutTlsMaskFields drops tls scope only', () => {
    expect(withoutTlsMaskFields({
      tls: { serverCaPem: true },
      auth: { bearerToken: true },
    })).toEqual({ auth: { bearerToken: true } });
    expect(withoutTlsMaskFields({ tls: { serverCaPem: true } })).toBeUndefined();
  });

  it('pruneAuthMaskForConfig keeps masks for active auth type only', () => {
    expect(pruneAuthMaskForConfig(
      { type: 'basic', basicUsername: 'u' },
      { auth: { bearerToken: true, basicPassword: true } },
    )).toEqual({ auth: { basicPassword: true } });
    expect(pruneAuthMaskForConfig(undefined, { auth: { bearerToken: true } })).toBeUndefined();
  });
});
