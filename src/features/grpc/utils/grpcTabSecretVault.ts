/**
 * Phase 4E — feature-layer bridge to the gRPC secret vault (storage port injection).
 */
import type { GrpcAuthConfig, GrpcTlsConfig } from '@shared/grpc/contracts';
import {
  createGrpcSecretVault,
  extractAuthVaultValues,
  extractTlsVaultValues,
  inferGrpcTlsModeFromVaultValues,
  mergeAuthConfigWithVaultValues,
  mergeTlsConfigWithVaultValues,
  resolveGrpcVaultOwnerId,
  tlsConfigMissingVaultPemFields,
  type GrpcSecretVaultAdapter,
  type GrpcVaultOwnerRef,
} from '@shared/grpc/grpcSecretVault';
import { isTauri } from '@shared/utils/platform';
import { readKey, removeKey, writeKey } from '@shared/utils/storage';
import type { GrpcTabDescriptorState, GrpcStudioTabState } from '../grpcStudioTypes';
import {
  buildMaskedFieldsFromVaultHydration,
  clearMaskedAuthField,
  clearMaskedTlsField,
  mergeMaskedSecretFields,
  unmaskSecretField,
  type GrpcAuthSecretFieldKey,
  type GrpcMaskedSecretFields,
  type GrpcTlsSecretFieldKey,
} from './grpcSecretFieldUi';

let vaultSingleton: GrpcSecretVaultAdapter | null = null;

export function getGrpcTabSecretVault(): GrpcSecretVaultAdapter {
  if (!vaultSingleton) {
    vaultSingleton = createGrpcSecretVault({
      platform: isTauri() ? 'desktop' : 'web',
      storage: { readKey, writeKey, removeKey },
    });
  }
  return vaultSingleton;
}

export function resetGrpcTabSecretVaultForTests(): void {
  vaultSingleton = null;
}

function vaultOwnerFromTab(
  tab: { id: string; connectionId?: string; target?: string },
): GrpcVaultOwnerRef {
  return {
    id: tab.id,
    connectionId: tab.connectionId,
    target: tab.target,
  };
}

export async function loadTabSecretsFromVault(
  owner: GrpcVaultOwnerRef,
): Promise<{
  tlsValues: Record<string, string>;
  authValues: Record<string, string>;
  bsrToken?: string;
}> {
  const vault = getGrpcTabSecretVault();
  const ownerId = resolveGrpcVaultOwnerId(owner);
  const [tls, auth, bsr] = await Promise.all([
    vault.read('tls_pem', ownerId),
    vault.read('auth_credentials', ownerId),
    vault.read('bsr_token', ownerId),
  ]);
  return {
    tlsValues: tls?.values ?? {},
    authValues: auth?.values ?? {},
    bsrToken: bsr?.values.bsrToken,
  };
}

export function buildTabSecretsHydrationPatch(
  tab: GrpcStudioTabState,
  descriptor: GrpcTabDescriptorState | undefined,
  loaded: {
    tlsValues: Record<string, string>;
    authValues: Record<string, string>;
    bsrToken?: string;
  },
): {
  tabPatch: Partial<GrpcStudioTabState>;
  descriptorPatch?: Partial<GrpcTabDescriptorState>;
} {
  const tabPatch: Partial<GrpcStudioTabState> = {};
  let descriptorPatch: Partial<GrpcTabDescriptorState> | undefined;

  if (
    Object.keys(loaded.tlsValues).length > 0
    && tlsConfigMissingVaultPemFields(tab.tlsConfig, loaded.tlsValues)
  ) {
    tabPatch.tlsConfig = mergeTlsConfigWithVaultValues(tab.tlsConfig, loaded.tlsValues);
    const inferredMode = inferGrpcTlsModeFromVaultValues(loaded.tlsValues);
    const currentMode = tab.tlsMode ?? 'disabled';
    if (inferredMode && (currentMode === 'disabled' || !tab.tlsMode)) {
      tabPatch.tlsMode = inferredMode;
    }
    const incomingMask = buildMaskedFieldsFromVaultHydration({
      tlsValues: loaded.tlsValues,
      authValues: {},
    });
    tabPatch.maskedSecretFields = mergeMaskedSecretFields(tab.maskedSecretFields, incomingMask);
  }

  if (tab.auth && Object.keys(loaded.authValues).length > 0) {
    const mergedAuth = mergeAuthConfigWithVaultValues(tab.auth, loaded.authValues);
    if (mergedAuth && mergedAuth !== tab.auth) {
      tabPatch.auth = mergedAuth;
      const incomingMask = buildMaskedFieldsFromVaultHydration({
        tlsValues: {},
        authValues: loaded.authValues,
      });
      tabPatch.maskedSecretFields = mergeMaskedSecretFields(
        tabPatch.maskedSecretFields ?? tab.maskedSecretFields,
        incomingMask,
      );
    }
  }

  const ingest = descriptor?.protoIngest;
  if (loaded.bsrToken?.trim() && ingest && !ingest.bsrToken?.trim()) {
    descriptorPatch = {
      protoIngest: {
        ...ingest,
        bsrToken: loaded.bsrToken,
      },
    };
  }

  return { tabPatch, descriptorPatch };
}

export function shouldScheduleTabSecretsVaultSync(
  tabPatch: Partial<GrpcStudioTabState>,
): boolean {
  return 'tlsConfig' in tabPatch
    || 'auth' in tabPatch
    || 'target' in tabPatch
    || 'connectionId' in tabPatch;
}

export function buildVaultHydrationAttemptKey(
  owner: GrpcVaultOwnerRef,
  tab: Pick<GrpcStudioTabState, 'auth' | 'tlsMode'>,
  descriptor: GrpcTabDescriptorState | undefined,
): string {
  const ownerKey = resolveGrpcVaultOwnerId(owner);
  const authType = tab.auth?.type ?? 'none';
  const tlsMode = tab.tlsMode ?? 'disabled';
  const ingestSource = descriptor?.protoIngest?.source ?? 'none';
  return `${ownerKey}|auth:${authType}|tls:${tlsMode}|ingest:${ingestSource}`;
}

/** Effect dependency key — tab-scoped so shared target owners hydrate independently per tab. */
export function buildVaultHydrationEffectKey(
  tab: GrpcStudioTabState,
  descriptor: GrpcTabDescriptorState | undefined,
): string {
  const owner = vaultOwnerFromTab(tab);
  return `${tab.id}|${buildVaultHydrationAttemptKey(owner, tab, descriptor)}`;
}

/** Restore persisted secrets into tab state once per tab + vault readiness signature. */
export async function hydrateActiveTabSecretsFromVault(
  tab: GrpcStudioTabState,
  descriptor: GrpcTabDescriptorState | undefined,
  updateTab: (
    tabId: string,
    patch: Partial<GrpcStudioTabState>,
    options?: { descriptorPatch?: Partial<GrpcTabDescriptorState> },
  ) => void,
  hydratedOwners: Set<string>,
): Promise<void> {
  const effectKey = buildVaultHydrationEffectKey(tab, descriptor);
  if (hydratedOwners.has(effectKey)) return;

  const owner = vaultOwnerFromTab(tab);
  const loaded = await loadTabSecretsFromVault(owner);
  const hasVaultData = Object.keys(loaded.tlsValues).length > 0
    || Object.keys(loaded.authValues).length > 0
    || !!loaded.bsrToken?.trim();

  if (!hasVaultData) {
    hydratedOwners.add(effectKey);
    return;
  }

  const { tabPatch, descriptorPatch } = buildTabSecretsHydrationPatch(tab, descriptor, loaded);
  const applied = Object.keys(tabPatch).length > 0 || !!descriptorPatch;

  hydratedOwners.add(effectKey);

  if (!applied) return;

  updateTab(tab.id, tabPatch, descriptorPatch ? { descriptorPatch } : undefined);
}

export async function persistTabTlsSecrets(
  owner: GrpcVaultOwnerRef,
  tlsConfig: GrpcTlsConfig | undefined,
): Promise<void> {
  const vault = getGrpcTabSecretVault();
  await vault.write('tls_pem', resolveGrpcVaultOwnerId(owner), extractTlsVaultValues(tlsConfig));
}

export async function persistTabAuthSecrets(
  owner: GrpcVaultOwnerRef,
  auth: GrpcAuthConfig | undefined,
): Promise<void> {
  const vault = getGrpcTabSecretVault();
  await vault.write(
    'auth_credentials',
    resolveGrpcVaultOwnerId(owner),
    extractAuthVaultValues(auth),
  );
}

export async function persistTabBsrToken(
  owner: GrpcVaultOwnerRef,
  bsrToken: string | undefined,
): Promise<void> {
  const vault = getGrpcTabSecretVault();
  const values: Record<string, string> = bsrToken?.trim() ? { bsrToken } : {};
  await vault.write('bsr_token', resolveGrpcVaultOwnerId(owner), values);
}

/**
 * Drop session-scoped vault entries when tab closes.
 * Profile- and target-keyed secrets persist for reuse across tabs/refresh.
 */
export async function clearTabSessionVaultSecrets(owner: GrpcVaultOwnerRef): Promise<void> {
  if (owner.connectionId?.trim() || owner.target?.trim()) return;
  await getGrpcTabSecretVault().deleteOwner(owner.id);
}

export async function copyTabVaultSecrets(
  source: GrpcVaultOwnerRef,
  target: GrpcVaultOwnerRef,
): Promise<void> {
  const sourceOwnerId = resolveGrpcVaultOwnerId(source);
  const targetOwnerId = resolveGrpcVaultOwnerId(target);
  if (sourceOwnerId === targetOwnerId) return;
  await getGrpcTabSecretVault().copyOwner(sourceOwnerId, targetOwnerId);
}

export async function syncTabSecretsToVault(input: {
  id: string;
  connectionId?: string;
  target?: string;
  tlsConfig?: GrpcTlsConfig;
  auth?: GrpcAuthConfig;
  bsrToken?: string;
}): Promise<void> {
  const owner = vaultOwnerFromTab(input);
  // TLS uses a separate storage key; auth + BSR share grpc_auth_secrets_v1 — must be sequential.
  if ('tlsConfig' in input) {
    await persistTabTlsSecrets(owner, input.tlsConfig);
  }
  if ('auth' in input) {
    await persistTabAuthSecrets(owner, input.auth);
  }
  if ('bsrToken' in input) {
    await persistTabBsrToken(owner, input.bsrToken);
  }
}

export function scheduleTabSecretsVaultSync(input: {
  id: string;
  connectionId?: string;
  target?: string;
  tlsConfig?: GrpcTlsConfig;
  auth?: GrpcAuthConfig;
  bsrToken?: string;
}): void {
  queueMicrotask(() => {
    void syncTabSecretsToVault(input);
  });
}

export async function clearTabTlsSecretField(input: {
  tab: Pick<GrpcStudioTabState, 'id' | 'connectionId' | 'target' | 'tlsConfig' | 'maskedSecretFields'>;
  field: GrpcTlsSecretFieldKey;
}): Promise<Partial<GrpcStudioTabState>> {
  const owner = vaultOwnerFromTab(input.tab);
  const tlsConfig = clearMaskedTlsField(input.tab.tlsConfig, input.field);
  await persistTabTlsSecrets(owner, tlsConfig);
  return {
    tlsConfig,
    maskedSecretFields: unmaskSecretField(input.tab.maskedSecretFields, 'tls', input.field),
  };
}

export async function clearTabAuthSecretField(input: {
  tab: Pick<GrpcStudioTabState, 'id' | 'connectionId' | 'target' | 'auth' | 'maskedSecretFields'>;
  field: GrpcAuthSecretFieldKey;
}): Promise<Partial<GrpcStudioTabState>> {
  const owner = vaultOwnerFromTab(input.tab);
  const auth = clearMaskedAuthField(input.tab.auth, input.field);
  await persistTabAuthSecrets(owner, auth);
  return {
    auth,
    maskedSecretFields: unmaskSecretField(input.tab.maskedSecretFields, 'auth', input.field),
  };
}

export type { GrpcMaskedSecretFields, GrpcTlsSecretFieldKey, GrpcAuthSecretFieldKey };
export { unmaskSecretField };
