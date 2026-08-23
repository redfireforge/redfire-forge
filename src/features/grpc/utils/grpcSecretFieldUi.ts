/**
 * Phase 4G — masked secret field UI helpers (write-only vault display).
 */
import type { GrpcAuthConfig, GrpcTlsConfig } from '@shared/grpc/contracts';
import { GRPC_REDACTED_PLACEHOLDER } from '@shared/grpc/grpcRedaction';

export const GRPC_SECRET_STORED_LABEL = 'Stored securely';

export type GrpcTlsSecretFieldKey = 'serverCaPem' | 'clientCertPem' | 'clientKeyPem';

export type GrpcAuthSecretFieldKey =
  | 'bearerToken'
  | 'basicPassword'
  | 'apiKeyValue'
  | 'oauth2ClientSecret';

export interface GrpcMaskedSecretFields {
  tls?: Partial<Record<GrpcTlsSecretFieldKey, true>>;
  auth?: Partial<Record<GrpcAuthSecretFieldKey, true>>;
}

export function isGrpcRedactedPlaceholder(value: string | undefined): boolean {
  const trimmed = value?.trim();
  return trimmed === GRPC_REDACTED_PLACEHOLDER || trimmed === '[REDACTED_PEM]';
}

export function tlsFieldHasStoredValue(
  config: GrpcTlsConfig | undefined,
  field: GrpcTlsSecretFieldKey,
): boolean {
  const value = config?.[field];
  return typeof value === 'string' && value.trim().length > 0 && !isGrpcRedactedPlaceholder(value);
}

export function authFieldHasStoredValue(
  auth: GrpcAuthConfig | undefined,
  field: GrpcAuthSecretFieldKey,
): boolean {
  if (!auth || auth.type === 'none') return false;
  switch (field) {
    case 'bearerToken':
      return !!auth.bearerToken?.trim() && !isGrpcRedactedPlaceholder(auth.bearerToken);
    case 'basicPassword':
      return !!auth.basicPassword?.trim() && !isGrpcRedactedPlaceholder(auth.basicPassword);
    case 'apiKeyValue':
      return !!auth.apiKeyValue?.trim() && !isGrpcRedactedPlaceholder(auth.apiKeyValue);
    case 'oauth2ClientSecret':
      return !!auth.oauth2?.clientSecret?.trim()
        && !isGrpcRedactedPlaceholder(auth.oauth2.clientSecret);
    default:
      return false;
  }
}

export function buildMaskedFieldsFromVaultHydration(input: {
  tlsValues: Record<string, string>;
  authValues: Record<string, string>;
}): GrpcMaskedSecretFields {
  const tls: Partial<Record<GrpcTlsSecretFieldKey, true>> = {};
  if (input.tlsValues.serverCaPem?.trim()) tls.serverCaPem = true;
  if (input.tlsValues.clientCertPem?.trim()) tls.clientCertPem = true;
  if (input.tlsValues.clientKeyPem?.trim()) tls.clientKeyPem = true;

  const auth: Partial<Record<GrpcAuthSecretFieldKey, true>> = {};
  if (input.authValues.bearerToken?.trim()) auth.bearerToken = true;
  if (input.authValues.basicPassword?.trim()) auth.basicPassword = true;
  if (input.authValues.apiKeyValue?.trim()) auth.apiKeyValue = true;
  if (input.authValues['oauth2.clientSecret']?.trim()) auth.oauth2ClientSecret = true;

  return {
    ...(Object.keys(tls).length > 0 ? { tls } : {}),
    ...(Object.keys(auth).length > 0 ? { auth } : {}),
  };
}

export function clearMaskedTlsField(
  config: GrpcTlsConfig | undefined,
  field: GrpcTlsSecretFieldKey,
): GrpcTlsConfig | undefined {
  if (!config) return undefined;
  const next: GrpcTlsConfig = { ...config, [field]: undefined };
  const hasAny = !!(
    next.serverCaPem?.trim()
    || next.clientCertPem?.trim()
    || next.clientKeyPem?.trim()
    || next.serverNameOverride?.trim()
  );
  return hasAny ? next : undefined;
}

export function clearMaskedAuthField(
  auth: GrpcAuthConfig | undefined,
  field: GrpcAuthSecretFieldKey,
): GrpcAuthConfig | undefined {
  if (!auth || auth.type === 'none') return auth;
  switch (field) {
    case 'bearerToken':
      if (auth.type !== 'bearer') return auth;
      return { ...auth, bearerToken: undefined };
    case 'basicPassword':
      if (auth.type !== 'basic') return auth;
      return { ...auth, basicPassword: undefined };
    case 'apiKeyValue':
      if (auth.type !== 'api_key') return auth;
      return { ...auth, apiKeyValue: undefined };
    case 'oauth2ClientSecret':
      if (auth.type !== 'oauth2' || !auth.oauth2) return auth;
      return {
        ...auth,
        oauth2: { ...auth.oauth2, clientSecret: '' },
      };
    default:
      return auth;
  }
}

export function unmaskSecretField(
  masked: GrpcMaskedSecretFields | undefined,
  scope: 'tls' | 'auth',
  field: string,
): GrpcMaskedSecretFields | undefined {
  if (!masked?.[scope]?.[field as keyof NonNullable<GrpcMaskedSecretFields[typeof scope]>]) {
    return masked;
  }
  const nextScope = { ...masked[scope] };
  delete nextScope[field as keyof typeof nextScope];
  const next: GrpcMaskedSecretFields = { ...masked };
  if (Object.keys(nextScope).length > 0) {
    next[scope] = nextScope;
  } else {
    delete next[scope];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function mergeMaskedSecretFields(
  existing: GrpcMaskedSecretFields | undefined,
  incoming: GrpcMaskedSecretFields,
): GrpcMaskedSecretFields {
  const tls = { ...existing?.tls, ...incoming.tls };
  const auth = { ...existing?.auth, ...incoming.auth };
  const next: GrpcMaskedSecretFields = {};
  if (Object.keys(tls).length > 0) next.tls = tls;
  if (Object.keys(auth).length > 0) next.auth = auth;
  return next;
}

export function withoutTlsMaskFields(
  masked: GrpcMaskedSecretFields | undefined,
): GrpcMaskedSecretFields | undefined {
  if (!masked?.auth || Object.keys(masked.auth).length === 0) return undefined;
  return { auth: masked.auth };
}

export function pruneAuthMaskForConfig(
  auth: GrpcAuthConfig | undefined,
  masked: GrpcMaskedSecretFields | undefined,
): GrpcMaskedSecretFields | undefined {
  if (!masked) return undefined;
  const tls = masked.tls && Object.keys(masked.tls).length > 0 ? masked.tls : undefined;
  if (!auth || auth.type === 'none') {
    return tls ? { tls } : undefined;
  }
  const pruned: Partial<Record<GrpcAuthSecretFieldKey, true>> = {};
  if (auth.type === 'bearer' && masked.auth?.bearerToken) pruned.bearerToken = true;
  if (auth.type === 'basic' && masked.auth?.basicPassword) pruned.basicPassword = true;
  if (auth.type === 'api_key' && masked.auth?.apiKeyValue) pruned.apiKeyValue = true;
  if (auth.type === 'oauth2' && masked.auth?.oauth2ClientSecret) pruned.oauth2ClientSecret = true;
  const next: GrpcMaskedSecretFields = {};
  if (tls) next.tls = tls;
  if (Object.keys(pruned).length > 0) next.auth = pruned;
  return Object.keys(next).length > 0 ? next : undefined;
}
