/**
 * Phase 4E — feature bridge tests for tab secret vault.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProtoIngestState, createEmptyTabDescriptorState, createGrpcStudioTab } from '../grpcStudioTypes';
import {
  buildTabSecretsHydrationPatch,
  clearTabAuthSecretField,
  clearTabTlsSecretField,
  getGrpcTabSecretVault,
  hydrateActiveTabSecretsFromVault,
  persistTabAuthSecrets,
  persistTabTlsSecrets,
  resetGrpcTabSecretVaultForTests,
  shouldScheduleTabSecretsVaultSync,
  syncTabSecretsToVault,
} from './grpcTabSecretVault';

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => false,
}));

const storage = vi.hoisted(() => ({
  readKey: vi.fn().mockResolvedValue(null),
  writeKey: vi.fn().mockResolvedValue(undefined),
  removeKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../shared/utils/storage', () => storage);

const VALID_PEM = `-----BEGIN CERTIFICATE-----
abc
-----END CERTIFICATE-----`;

describe('grpcTabSecretVault (Phase 4E)', () => {
  afterEach(() => {
    resetGrpcTabSecretVaultForTests();
    vi.clearAllMocks();
  });

  it('shouldScheduleTabSecretsVaultSync detects explicit clears and target changes', () => {
    expect(shouldScheduleTabSecretsVaultSync({ tlsConfig: undefined })).toBe(true);
    expect(shouldScheduleTabSecretsVaultSync({ auth: undefined })).toBe(true);
    expect(shouldScheduleTabSecretsVaultSync({ target: 'localhost:50051' })).toBe(true);
    expect(shouldScheduleTabSecretsVaultSync({ body: { msg: 'hi' } })).toBe(false);
  });

  it('uses singleton vault and persists TLS on web keyed by target', async () => {
    await persistTabTlsSecrets(
      { id: 'tab-1', target: 'localhost:50051' },
      { serverCaPem: VALID_PEM },
    );
    expect(storage.writeKey).toHaveBeenCalled();
    const record = await getGrpcTabSecretVault().read('tls_pem', 'target:localhost:50051');
    expect(record?.values.serverCaPem).toBe(VALID_PEM);
  });

  it('does not persist auth secrets on web', async () => {
    await persistTabAuthSecrets({ id: 'tab-1' }, {
      type: 'bearer',
      bearerToken: 'session-only',
    });
    expect(storage.writeKey).not.toHaveBeenCalled();
    const record = await getGrpcTabSecretVault().read('auth_credentials', 'tab-1');
    expect(record?.values.bearerToken).toBe('session-only');
  });

  it('syncTabSecretsToVault writes tls and session auth without cross-clearing', async () => {
    await syncTabSecretsToVault({
      id: 'tab-2',
      target: 'localhost:50051',
      tlsConfig: { clientKeyPem: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----' },
    });
    await syncTabSecretsToVault({
      id: 'tab-2',
      target: 'localhost:50051',
      auth: { type: 'basic', basicUsername: 'u', basicPassword: 'p' },
    });
    const tls = await getGrpcTabSecretVault().read('tls_pem', 'target:localhost:50051');
    const auth = await getGrpcTabSecretVault().read('auth_credentials', 'target:localhost:50051');
    expect(tls?.values.clientKeyPem).toContain('PRIVATE KEY');
    expect(auth?.values.basicPassword).toBe('p');
  });

  it('buildTabSecretsHydrationPatch restores PEM, tls mode, and mask flags from vault', () => {
    const tab = createGrpcStudioTab({ target: 'localhost:50051', tlsMode: 'disabled' });
    const { tabPatch } = buildTabSecretsHydrationPatch(
      tab,
      createEmptyTabDescriptorState(),
      { tlsValues: { serverCaPem: VALID_PEM }, authValues: {} },
    );
    expect(tabPatch.tlsConfig?.serverCaPem).toBe(VALID_PEM);
    expect(tabPatch.tlsMode).toBe('tls');
    expect(tabPatch.maskedSecretFields?.tls?.serverCaPem).toBe(true);
  });

  it('hydrateActiveTabSecretsFromVault runs once per vault owner after apply', async () => {
    const tab = createGrpcStudioTab({
      target: 'localhost:50051',
      auth: { type: 'bearer', bearerToken: '' },
    });
    await persistTabAuthSecrets(
      { id: tab.id, target: tab.target },
      { type: 'bearer', bearerToken: 'stored-token' },
    );
    const hydrated = new Set<string>();
    const updateTab = vi.fn();
    await hydrateActiveTabSecretsFromVault(
      tab,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).toHaveBeenCalledWith(
      tab.id,
      {
        auth: { type: 'bearer', bearerToken: 'stored-token' },
        maskedSecretFields: { auth: { bearerToken: true } },
      },
      undefined,
    );
    updateTab.mockClear();
    await hydrateActiveTabSecretsFromVault(
      tab,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).not.toHaveBeenCalled();
  });

  it('hydrateActiveTabSecretsFromVault retries when vault has auth but tab auth unset', async () => {
    const tab = createGrpcStudioTab({ target: 'localhost:50051' });
    await persistTabAuthSecrets(
      { id: tab.id, target: tab.target },
      { type: 'bearer', bearerToken: 'stored-token' },
    );
    const hydrated = new Set<string>();
    const updateTab = vi.fn();

    await hydrateActiveTabSecretsFromVault(
      tab,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).not.toHaveBeenCalled();
    expect(hydrated.size).toBe(1);

    const tabWithAuth = { ...tab, auth: { type: 'bearer' as const, bearerToken: '' } };
    await hydrateActiveTabSecretsFromVault(
      tabWithAuth,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).toHaveBeenCalledWith(
      tab.id,
      {
        auth: { type: 'bearer', bearerToken: 'stored-token' },
        maskedSecretFields: { auth: { bearerToken: true } },
      },
      undefined,
    );
    expect(hydrated.size).toBe(2);
  });

  it('hydrates independently per tab when two tabs share the same target vault owner', async () => {
    const tabA = createGrpcStudioTab({
      id: 'tab-a',
      target: 'localhost:50051',
      auth: { type: 'bearer', bearerToken: 'already-set' },
    });
    const tabB = createGrpcStudioTab({
      id: 'tab-b',
      target: 'localhost:50051',
      auth: { type: 'bearer', bearerToken: '' },
    });
    await persistTabAuthSecrets(
      { id: tabA.id, target: tabA.target },
      { type: 'bearer', bearerToken: 'vault-token' },
    );
    const hydrated = new Set<string>();
    const updateTab = vi.fn();

    await hydrateActiveTabSecretsFromVault(
      tabA,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).not.toHaveBeenCalled();

    await hydrateActiveTabSecretsFromVault(
      tabB,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).toHaveBeenCalledWith(
      tabB.id,
      {
        auth: { type: 'bearer', bearerToken: 'vault-token' },
        maskedSecretFields: { auth: { bearerToken: true } },
      },
      undefined,
    );
  });

  it('retries TLS hydration when tlsMode changes after fields were cleared', async () => {
    const tab = createGrpcStudioTab({
      target: 'localhost:50051',
      tlsMode: 'disabled',
      tlsConfig: undefined,
    });
    await persistTabTlsSecrets(
      { id: tab.id, target: tab.target },
      { serverCaPem: VALID_PEM },
    );
    const hydrated = new Set<string>();
    const updateTab = vi.fn();

    await hydrateActiveTabSecretsFromVault(
      tab,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).toHaveBeenCalledWith(
      tab.id,
      expect.objectContaining({
        tlsConfig: expect.objectContaining({ serverCaPem: VALID_PEM }),
        tlsMode: 'tls',
        maskedSecretFields: { tls: { serverCaPem: true } },
      }),
      undefined,
    );

    updateTab.mockClear();
    const clearedTab = {
      ...tab,
      tlsMode: 'disabled' as const,
      tlsConfig: undefined,
    };
    await hydrateActiveTabSecretsFromVault(
      clearedTab,
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).not.toHaveBeenCalled();

    updateTab.mockClear();
    await hydrateActiveTabSecretsFromVault(
      { ...clearedTab, tlsMode: 'tls' },
      createEmptyTabDescriptorState(),
      updateTab,
      hydrated,
    );
    expect(updateTab).toHaveBeenCalledWith(
      tab.id,
      expect.objectContaining({
        tlsConfig: expect.objectContaining({ serverCaPem: VALID_PEM }),
      }),
      undefined,
    );
  });

  it('retries BSR hydration when ingest source switches to bsr', async () => {
    const tab = createGrpcStudioTab({ target: 'localhost:50051' });
    await syncTabSecretsToVault({
      id: tab.id,
      target: tab.target,
      bsrToken: 'stored-bsr',
    });
    const hydrated = new Set<string>();
    const updateTab = vi.fn();
    const descriptorBeforeBsr = createEmptyTabDescriptorState();

    await hydrateActiveTabSecretsFromVault(tab, descriptorBeforeBsr, updateTab, hydrated);
    expect(updateTab).not.toHaveBeenCalled();

    const descriptorWithBsr = {
      ...createEmptyTabDescriptorState(),
      protoIngest: { ...createDefaultProtoIngestState(), source: 'bsr' as const, bsrToken: '' },
    };
    await hydrateActiveTabSecretsFromVault(tab, descriptorWithBsr, updateTab, hydrated);
    expect(updateTab).toHaveBeenCalledWith(
      tab.id,
      {},
      { descriptorPatch: { protoIngest: expect.objectContaining({ bsrToken: 'stored-bsr' }) } },
    );
  });

  it('syncTabSecretsToVault preserves auth and BSR when both are in one patch', async () => {
    await syncTabSecretsToVault({
      id: 'tab-4',
      target: 'localhost:50051',
      auth: { type: 'bearer', bearerToken: 'tok' },
      bsrToken: 'bsr-secret',
    });
    const auth = await getGrpcTabSecretVault().read('auth_credentials', 'target:localhost:50051');
    const bsr = await getGrpcTabSecretVault().read('bsr_token', 'target:localhost:50051');
    expect(auth?.values.bearerToken).toBe('tok');
    expect(bsr?.values.bsrToken).toBe('bsr-secret');
  });

  it('clearTabTlsSecretField removes vault entry and unmasks field', async () => {
    const tab = createGrpcStudioTab({
      target: 'localhost:50051',
      tlsMode: 'tls',
      tlsConfig: { serverCaPem: VALID_PEM },
      maskedSecretFields: { tls: { serverCaPem: true } },
    });
    await persistTabTlsSecrets({ id: tab.id, target: tab.target }, tab.tlsConfig);
    const patch = await clearTabTlsSecretField({ tab, field: 'serverCaPem' });
    expect(patch.tlsConfig).toBeUndefined();
    expect(patch.maskedSecretFields).toBeUndefined();
    expect(await getGrpcTabSecretVault().read('tls_pem', 'target:localhost:50051')).toBeNull();
  });

  it('clearTabAuthSecretField clears bearer token and mask flag', async () => {
    const tab = createGrpcStudioTab({
      target: 'localhost:50051',
      auth: { type: 'bearer', bearerToken: 'tok' },
      maskedSecretFields: { auth: { bearerToken: true } },
    });
    const patch = await clearTabAuthSecretField({ tab, field: 'bearerToken' });
    expect(patch.auth?.bearerToken).toBeUndefined();
  });

  it('syncTabSecretsToVault clears TLS vault when tlsConfig is cleared', async () => {
    await syncTabSecretsToVault({
      id: 'tab-3',
      target: 'localhost:50051',
      tlsConfig: { serverCaPem: VALID_PEM },
    });
    expect(await getGrpcTabSecretVault().read('tls_pem', 'target:localhost:50051')).not.toBeNull();

    await syncTabSecretsToVault({
      id: 'tab-3',
      target: 'localhost:50051',
      tlsConfig: undefined,
    });
    expect(await getGrpcTabSecretVault().read('tls_pem', 'target:localhost:50051')).toBeNull();
  });
});
