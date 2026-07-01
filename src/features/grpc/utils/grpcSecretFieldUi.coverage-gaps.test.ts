import { describe, expect, it } from 'vitest';
import { GRPC_REDACTED_PLACEHOLDER } from '../../../shared/grpc/grpcRedaction';
import {
  authFieldHasStoredValue,
  buildMaskedFieldsFromVaultHydration,
  clearMaskedAuthField,
  clearMaskedTlsField,
  isGrpcRedactedPlaceholder,
  mergeMaskedSecretFields,
  pruneAuthMaskForConfig,
  tlsFieldHasStoredValue,
  unmaskSecretField,
  withoutTlsMaskFields,
} from './grpcSecretFieldUi';

describe('grpcSecretFieldUi coverage gaps', () => {
  it('isGrpcRedactedPlaceholder recognizes redacted markers', () => {
    expect(isGrpcRedactedPlaceholder(GRPC_REDACTED_PLACEHOLDER)).toBe(true);
    expect(isGrpcRedactedPlaceholder('[REDACTED_PEM]')).toBe(true);
    expect(isGrpcRedactedPlaceholder(' literal ')).toBe(false);
    expect(isGrpcRedactedPlaceholder(undefined)).toBe(false);
  });

  it('tlsFieldHasStoredValue rejects redacted and empty PEM', () => {
    expect(tlsFieldHasStoredValue({ serverCaPem: GRPC_REDACTED_PLACEHOLDER }, 'serverCaPem')).toBe(false);
    expect(tlsFieldHasStoredValue({ serverCaPem: '   ' }, 'serverCaPem')).toBe(false);
    expect(tlsFieldHasStoredValue(undefined, 'serverCaPem')).toBe(false);
  });

  it('authFieldHasStoredValue covers all auth secret fields', () => {
    expect(authFieldHasStoredValue({ type: 'basic', basicPassword: 'pw' }, 'basicPassword')).toBe(true);
    expect(authFieldHasStoredValue({ type: 'api_key', apiKeyValue: 'k' }, 'apiKeyValue')).toBe(true);
    expect(authFieldHasStoredValue({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'sec' },
    }, 'oauth2ClientSecret')).toBe(true);
    expect(authFieldHasStoredValue({ type: 'bearer', bearerToken: GRPC_REDACTED_PLACEHOLDER }, 'bearerToken')).toBe(false);
  });

  it('buildMaskedFieldsFromVaultHydration returns empty object when no values', () => {
    expect(buildMaskedFieldsFromVaultHydration({ tlsValues: {}, authValues: {} })).toEqual({});
  });

  it('clearMaskedTlsField drops config when only cleared field remains', () => {
    expect(clearMaskedTlsField({ serverCaPem: 'pem' }, 'serverCaPem')).toBeUndefined();
    expect(clearMaskedTlsField({ serverCaPem: 'pem', serverNameOverride: 'host' }, 'serverCaPem')).toEqual({
      serverNameOverride: 'host',
    });
  });

  it('clearMaskedAuthField no-ops when auth type mismatches field', () => {
    const auth = { type: 'bearer' as const, bearerToken: 'tok' };
    expect(clearMaskedAuthField(auth, 'basicPassword')).toBe(auth);
    expect(clearMaskedAuthField({ type: 'oauth2', oauth2: undefined }, 'oauth2ClientSecret')).toEqual({
      type: 'oauth2',
      oauth2: undefined,
    });
  });

  it('unmaskSecretField returns unchanged when field is not masked', () => {
    const masked = { auth: { bearerToken: true as const } };
    expect(unmaskSecretField(masked, 'auth', 'basicPassword')).toBe(masked);
    expect(unmaskSecretField(undefined, 'tls', 'serverCaPem')).toBeUndefined();
  });

  it('unmaskSecretField removes last scope entry', () => {
    expect(unmaskSecretField({ tls: { serverCaPem: true } }, 'tls', 'serverCaPem')).toBeUndefined();
  });

  it('pruneAuthMaskForConfig keeps tls masks when auth is none', () => {
    expect(pruneAuthMaskForConfig({ type: 'none' }, {
      tls: { serverCaPem: true },
      auth: { bearerToken: true },
    })).toEqual({ tls: { serverCaPem: true } });
  });

  it('pruneAuthMaskForConfig keeps oauth2 mask for oauth2 auth', () => {
    expect(pruneAuthMaskForConfig({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: '' },
    }, {
      auth: { oauth2ClientSecret: true, bearerToken: true },
    })).toEqual({ auth: { oauth2ClientSecret: true } });
  });

  it('mergeMaskedSecretFields merges partial scopes', () => {
    expect(mergeMaskedSecretFields({ tls: { clientKeyPem: true } }, { tls: { serverCaPem: true } })).toEqual({
      tls: { clientKeyPem: true, serverCaPem: true },
    });
  });

  it('withoutTlsMaskFields returns undefined when only tls present', () => {
    expect(withoutTlsMaskFields({ tls: { serverCaPem: true } })).toBeUndefined();
  });

  it('buildMaskedFieldsFromVaultHydration marks hydrated tls and auth fields', () => {
    expect(buildMaskedFieldsFromVaultHydration({
      tlsValues: { serverCaPem: 'pem', clientCertPem: 'cert' },
      authValues: { bearerToken: 'tok', 'oauth2.clientSecret': 'sec' },
    })).toEqual({
      tls: { serverCaPem: true, clientCertPem: true },
      auth: { bearerToken: true, oauth2ClientSecret: true },
    });
  });

  it('mergeMaskedSecretFields merges auth scopes', () => {
    expect(mergeMaskedSecretFields(
      { auth: { bearerToken: true } },
      { auth: { basicPassword: true } },
    )).toEqual({ auth: { bearerToken: true, basicPassword: true } });
  });

  it('clearMaskedAuthField clears bearer, basic, api_key, and oauth2 secrets', () => {
    expect(clearMaskedAuthField({ type: 'bearer', bearerToken: 'tok' }, 'bearerToken')).toEqual({
      type: 'bearer',
      bearerToken: undefined,
    });
    expect(clearMaskedAuthField({ type: 'basic', basicUsername: 'u', basicPassword: 'pw' }, 'basicPassword')).toEqual({
      type: 'basic',
      basicUsername: 'u',
      basicPassword: undefined,
    });
    expect(clearMaskedAuthField({ type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'v' }, 'apiKeyValue')).toEqual({
      type: 'api_key',
      apiKeyName: 'x-key',
      apiKeyValue: undefined,
    });
    expect(clearMaskedAuthField({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: 'sec' },
    }, 'oauth2ClientSecret')).toEqual({
      type: 'oauth2',
      oauth2: { tokenUrl: 'u', clientId: 'id', clientSecret: '' },
    });
  });

  it('unmaskSecretField keeps remaining masked fields in scope', () => {
    expect(unmaskSecretField({
      auth: { bearerToken: true, basicPassword: true },
    }, 'auth', 'bearerToken')).toEqual({ auth: { basicPassword: true } });
  });

  it('pruneAuthMaskForConfig keeps bearer/basic/api_key masks for matching auth types', () => {
    expect(pruneAuthMaskForConfig({ type: 'bearer', bearerToken: 'tok' }, {
      auth: { bearerToken: true, basicPassword: true },
    })).toEqual({ auth: { bearerToken: true } });
    expect(pruneAuthMaskForConfig({ type: 'basic', basicUsername: 'u', basicPassword: 'pw' }, {
      auth: { basicPassword: true },
    })).toEqual({ auth: { basicPassword: true } });
    expect(pruneAuthMaskForConfig({ type: 'api_key', apiKeyName: 'x-key', apiKeyValue: 'v' }, {
      auth: { apiKeyValue: true },
    })).toEqual({ auth: { apiKeyValue: true } });
  });

  it('tlsFieldHasStoredValue accepts valid inline PEM', () => {
    expect(tlsFieldHasStoredValue({ serverCaPem: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----' }, 'serverCaPem')).toBe(true);
  });
});
