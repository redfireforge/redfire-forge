/**
 * Phase 4E — secret vault adapter (session memory + optional persistent storage port).
 */
import {
  GRPC_AUTH_SECRETS_STORAGE_KEY,
  GRPC_TLS_STORAGE_KEY,
  type GrpcAuthConfig,
  type GrpcSecretStorageClass,
  type GrpcSecretVaultScope,
  type GrpcTlsConfig,
  type GrpcTlsMode,
} from './contracts';
import { defaultGrpcSecretStorageClass } from './grpcSecretPolicy';
import { validateResolvedGrpcTargetAddress } from './targetValidation';

export interface GrpcSecretVaultRecord {
  values: Record<string, string>;
  storageClass: GrpcSecretStorageClass;
  updatedAt: string;
}

export interface GrpcSecretVaultStoragePort {
  readKey(key: string): Promise<string | null>;
  writeKey(key: string, value: string): Promise<void>;
  removeKey(key: string): Promise<void>;
}

export interface GrpcSecretVaultAdapter {
  read(scope: GrpcSecretVaultScope, ownerId: string): Promise<GrpcSecretVaultRecord | null>;
  write(scope: GrpcSecretVaultScope, ownerId: string, values: Record<string, string>): Promise<void>;
  delete(scope: GrpcSecretVaultScope, ownerId: string): Promise<void>;
  deleteOwner(ownerId: string): Promise<void>;
  copyOwner(sourceOwnerId: string, targetOwnerId: string): Promise<void>;
}

export interface GrpcVaultOwnerRef {
  id: string;
  connectionId?: string;
  /** Resolved target address — fallback vault owner when no connection profile (survives refresh). */
  target?: string;
}

/** Prefer connection profile id, then normalized target, then tab id. */
export function resolveGrpcVaultOwnerId(owner: GrpcVaultOwnerRef): string {
  const connectionId = owner.connectionId?.trim();
  if (connectionId) return connectionId;
  const target = owner.target?.trim();
  if (target) {
    const check = validateResolvedGrpcTargetAddress(target);
    return `target:${check.valid ? check.normalized : target}`;
  }
  return owner.id;
}

export function resolveGrpcSecretStorageClassForScope(
  scope: GrpcSecretVaultScope,
  platform: 'web' | 'desktop',
): GrpcSecretStorageClass {
  if (scope === 'tls_pem') {
    return defaultGrpcSecretStorageClass('tls_pem', platform);
  }
  if (scope === 'auth_credentials') {
    return defaultGrpcSecretStorageClass('auth_token', platform);
  }
  return defaultGrpcSecretStorageClass('bsr_token', platform);
}

function vaultStorageKeyForScope(scope: GrpcSecretVaultScope): string | null {
  switch (scope) {
    case 'tls_pem':
      return GRPC_TLS_STORAGE_KEY;
    case 'auth_credentials':
      return GRPC_AUTH_SECRETS_STORAGE_KEY;
    case 'bsr_token':
      return GRPC_AUTH_SECRETS_STORAGE_KEY;
    default:
      return null;
  }
}

function compositeVaultKey(scope: GrpcSecretVaultScope, ownerId: string): string {
  return `${scope}:${ownerId}`;
}

function shouldPersistScope(
  scope: GrpcSecretVaultScope,
  platform: 'web' | 'desktop',
): boolean {
  if (scope === 'tls_pem') return true;
  return platform === 'desktop';
}

type PersistedVaultBlob = Record<string, GrpcSecretVaultRecord>;

function parsePersistedVaultBlob(raw: string | null): PersistedVaultBlob {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PersistedVaultBlob;
  } catch {
    return {};
  }
}

export function extractTlsVaultValues(tlsConfig: GrpcTlsConfig | undefined): Record<string, string> {
  if (!tlsConfig) return {};
  const values: Record<string, string> = {};
  if (tlsConfig.serverCaPem?.trim()) values.serverCaPem = tlsConfig.serverCaPem;
  if (tlsConfig.clientCertPem?.trim()) values.clientCertPem = tlsConfig.clientCertPem;
  if (tlsConfig.clientKeyPem?.trim()) values.clientKeyPem = tlsConfig.clientKeyPem;
  return values;
}

export function mergeTlsConfigWithVaultValues(
  tlsConfig: GrpcTlsConfig | undefined,
  vaultValues: Record<string, string> | undefined,
): GrpcTlsConfig | undefined {
  const merged: GrpcTlsConfig = {
    ...(tlsConfig ?? {}),
    ...(vaultValues?.serverCaPem ? { serverCaPem: vaultValues.serverCaPem } : {}),
    ...(vaultValues?.clientCertPem ? { clientCertPem: vaultValues.clientCertPem } : {}),
    ...(vaultValues?.clientKeyPem ? { clientKeyPem: vaultValues.clientKeyPem } : {}),
  };
  const hasAny = !!(
    merged.serverCaPem?.trim()
    || merged.clientCertPem?.trim()
    || merged.clientKeyPem?.trim()
    || merged.serverNameOverride?.trim()
  );
  return hasAny ? merged : undefined;
}

export function extractAuthVaultValues(auth: GrpcAuthConfig | undefined): Record<string, string> {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return {};
  switch (auth.type) {
    case 'bearer':
      return auth.bearerToken?.trim() ? { bearerToken: auth.bearerToken } : {};
    case 'basic':
      return auth.basicPassword?.trim()
        ? { basicPassword: auth.basicPassword }
        : {};
    case 'api_key':
      return auth.apiKeyValue?.trim() ? { apiKeyValue: auth.apiKeyValue } : {};
    case 'oauth2':
      return auth.oauth2?.clientSecret?.trim()
        ? { 'oauth2.clientSecret': auth.oauth2.clientSecret }
        : {};
    default:
      return {};
  }
}

export function mergeAuthConfigWithVaultValues(
  auth: GrpcAuthConfig | undefined,
  vaultValues: Record<string, string> | undefined,
): GrpcAuthConfig | undefined {
  if (!auth || auth.type === 'none' || auth.type === 'inherit') return auth;
  if (!vaultValues || Object.keys(vaultValues).length === 0) return auth;

  switch (auth.type) {
    case 'bearer': {
      if (!vaultValues.bearerToken?.trim()) return auth;
      const bearerToken = auth.bearerToken?.trim() ? auth.bearerToken : vaultValues.bearerToken;
      if (bearerToken === (auth.bearerToken ?? '')) return auth;
      return { ...auth, bearerToken };
    }
    case 'basic': {
      if (!vaultValues.basicPassword?.trim()) return auth;
      const basicPassword = auth.basicPassword?.trim() ? auth.basicPassword : vaultValues.basicPassword;
      if (basicPassword === (auth.basicPassword ?? '')) return auth;
      return { ...auth, basicPassword };
    }
    case 'api_key': {
      if (!vaultValues.apiKeyValue?.trim()) return auth;
      const apiKeyValue = auth.apiKeyValue?.trim() ? auth.apiKeyValue : vaultValues.apiKeyValue;
      if (apiKeyValue === (auth.apiKeyValue ?? '')) return auth;
      return { ...auth, apiKeyValue };
    }
    case 'oauth2': {
      if (!vaultValues['oauth2.clientSecret']?.trim()) return auth;
      if (!auth.oauth2) return auth;
      const clientSecret = auth.oauth2.clientSecret?.trim()
        ? auth.oauth2.clientSecret
        : vaultValues['oauth2.clientSecret'];
      if (clientSecret === (auth.oauth2.clientSecret ?? '')) return auth;
      return {
        ...auth,
        oauth2: { ...auth.oauth2, clientSecret },
      };
    }
    default:
      return auth;
  }
}

export function inferGrpcTlsModeFromVaultValues(
  values: Record<string, string>,
): GrpcTlsMode | undefined {
  if (values.clientCertPem?.trim() && values.clientKeyPem?.trim()) return 'mtls';
  if (values.serverCaPem?.trim() || values.clientCertPem?.trim()) return 'tls';
  return undefined;
}

export function tlsConfigMissingVaultPemFields(
  tlsConfig: GrpcTlsConfig | undefined,
  vaultValues: Record<string, string>,
): boolean {
  for (const [key, value] of Object.entries(vaultValues)) {
    if (!value.trim()) continue;
    const current = tlsConfig?.[key as keyof GrpcTlsConfig];
    if (typeof current !== 'string' || !current.trim()) return true;
  }
  return false;
}

export function createGrpcSecretVault(options: {
  platform: 'web' | 'desktop';
  storage?: GrpcSecretVaultStoragePort;
}): GrpcSecretVaultAdapter {
  const memory = new Map<string, GrpcSecretVaultRecord>();
  const { platform, storage } = options;

  async function loadPersistedScope(scope: GrpcSecretVaultScope): Promise<PersistedVaultBlob> {
    if (!storage || !shouldPersistScope(scope, platform)) return {};
    const storageKey = vaultStorageKeyForScope(scope);
    if (!storageKey) return {};
    const raw = await storage.readKey(storageKey);
    return parsePersistedVaultBlob(raw);
  }

  async function savePersistedScope(
    scope: GrpcSecretVaultScope,
    blob: PersistedVaultBlob,
  ): Promise<void> {
    if (!storage || !shouldPersistScope(scope, platform)) return;
    const storageKey = vaultStorageKeyForScope(scope);
    if (!storageKey) return;
    const hasAny = Object.keys(blob).length > 0;
    if (hasAny) {
      await storage.writeKey(storageKey, JSON.stringify(blob));
    } else {
      await storage.removeKey(storageKey);
    }
  }

  async function readPersistedRecord(
    scope: GrpcSecretVaultScope,
    ownerId: string,
  ): Promise<GrpcSecretVaultRecord | null> {
    const blob = await loadPersistedScope(scope);
    const record = blob[compositeVaultKey(scope, ownerId)];
    return record ?? null;
  }

  async function writePersistedRecord(
    scope: GrpcSecretVaultScope,
    ownerId: string,
    record: GrpcSecretVaultRecord | null,
  ): Promise<void> {
    const blob = await loadPersistedScope(scope);
    const key = compositeVaultKey(scope, ownerId);
    if (record) {
      blob[key] = record;
    } else {
      delete blob[key];
    }
    await savePersistedScope(scope, blob);
  }

  return {
    async read(scope, ownerId) {
      const memKey = compositeVaultKey(scope, ownerId);
      const cached = memory.get(memKey);
      if (cached) return cached;
      const persisted = await readPersistedRecord(scope, ownerId);
      if (persisted) {
        memory.set(memKey, persisted);
      }
      return persisted;
    },

    async write(scope, ownerId, values) {
      const filtered = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value.trim().length > 0),
      );
      const memKey = compositeVaultKey(scope, ownerId);
      if (Object.keys(filtered).length === 0) {
        memory.delete(memKey);
        await writePersistedRecord(scope, ownerId, null);
        return;
      }
      const record: GrpcSecretVaultRecord = {
        values: filtered,
        storageClass: resolveGrpcSecretStorageClassForScope(scope, platform),
        updatedAt: new Date().toISOString(),
      };
      memory.set(memKey, record);
      if (shouldPersistScope(scope, platform)) {
        await writePersistedRecord(scope, ownerId, record);
      }
    },

    async delete(scope, ownerId) {
      const memKey = compositeVaultKey(scope, ownerId);
      memory.delete(memKey);
      if (shouldPersistScope(scope, platform)) {
        await writePersistedRecord(scope, ownerId, null);
      }
    },

    async deleteOwner(ownerId) {
      const scopes: GrpcSecretVaultScope[] = ['tls_pem', 'auth_credentials', 'bsr_token'];
      for (const scope of scopes) {
        await this.delete(scope, ownerId);
      }
    },

    async copyOwner(sourceOwnerId, targetOwnerId) {
      const scopes: GrpcSecretVaultScope[] = ['tls_pem', 'auth_credentials', 'bsr_token'];
      for (const scope of scopes) {
        const record = await this.read(scope, sourceOwnerId);
        if (record) {
          await this.write(scope, targetOwnerId, record.values);
        }
      }
    },
  };
}
