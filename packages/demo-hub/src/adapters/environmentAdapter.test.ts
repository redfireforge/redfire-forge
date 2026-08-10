/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('@graphql/utils/gqlDemoGlobalAuthProfiles', () => ({
  ALL_GQL_DEMO_GLOBAL_AUTH_PROFILE_SPECS: [{ id: 'lesson6-gql-profile', name: 'Lesson 6 Bearer' }],
  purgeGqlDemoGlobalAuthProfilesFromStorage: vi.fn(async () => 2),
}));
vi.mock('@graphql/utils/gqlDemoBatchDetectionCleanup', () => ({
  purgeGqlDemoBatchDetectionFlags: vi.fn(async () => undefined),
}));

import {
  applyGqlTlsSettings,
  deleteGqlEnvironmentByName,
  ensureSettingsEnvironment,
  ensureSettingsMicroservice,
  purgeGqlDemoGlobalAuthProfiles,
  removeSettingsEnvironment,
  removeSettingsMicroservice,
  removeWorkspaceDefaults,
  resetGqlDemoBatchDetection,
  resetSettingsMicroserviceProtocols,
  selectSettingsEnvSvc,
  upsertGlobalAuthProfile,
  upsertGqlEnvironment,
  upsertWorkspaceDefaults,
} from './environmentAdapter';
import { purgeGqlDemoBatchDetectionFlags } from '@graphql/utils/gqlDemoBatchDetectionCleanup';
import { purgeGqlDemoGlobalAuthProfilesFromStorage } from '@graphql/utils/gqlDemoGlobalAuthProfiles';

describe('environmentAdapter', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    delete (window as unknown as Record<string, unknown>).__demoPurgeGlobalAuthProfiles;
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
    delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
    delete (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName;
    delete (window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults;
    delete (window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults;
    delete (window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection;
    delete (window as unknown as Record<string, unknown>).__demoEnsureSettingsEnv;
    delete (window as unknown as Record<string, unknown>).__demoRemoveSettingsEnv;
    resetAllMocks();
  });

  it('upsertGlobalAuthProfile calls window bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile = spy;
    upsertGlobalAuthProfile({
      id: 'p1',
      name: 'Demo',
      auth: { type: 'bearer', token: 'tok' },
    });
    expect(spy).toHaveBeenCalledWith({
      id: 'p1',
      name: 'Demo',
      auth: { type: 'bearer', token: 'tok' },
    });
  });

  it('upsertGqlEnvironment returns false when bridge missing', () => {
    expect(upsertGqlEnvironment('Demo', [{ key: 'a', value: '1' }])).toBe(false);
  });

  it('upsertGqlEnvironment masks vars by default', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv = spy;
    expect(upsertGqlEnvironment('Demo', [{ key: 'a', value: '1', masked: false }])).toBe(true);
    expect(spy).toHaveBeenCalledWith('Demo', [{ key: 'a', value: '1', masked: false }]);
  });

  it('applyGqlTlsSettings returns false when bridge missing', () => {
    expect(applyGqlTlsSettings({ skipTlsVerify: true })).toBe(false);
  });

  it('applyGqlTlsSettings applies patch via bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings = spy;
    expect(applyGqlTlsSettings({ skipTlsVerify: true })).toBe(true);
    expect(spy).toHaveBeenCalledWith({ skipTlsVerify: true });
  });

  it('deleteGqlEnvironmentByName calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName = spy;
    deleteGqlEnvironmentByName('Demo');
    expect(spy).toHaveBeenCalledWith('Demo');
  });

  it('upsertWorkspaceDefaults returns false when bridge missing', () => {
    expect(upsertWorkspaceDefaults({ authToken: 'token-demo-123' })).toBe(false);
  });

  it('upsertWorkspaceDefaults applies patch via bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoUpsertWorkspaceDefaults = spy;
    expect(upsertWorkspaceDefaults({ authToken: 'token-demo-123' })).toBe(true);
    expect(spy).toHaveBeenCalledWith({ authToken: 'token-demo-123' });
  });

  it('removeWorkspaceDefaults returns false when bridge missing', () => {
    expect(removeWorkspaceDefaults(['authToken'])).toBe(false);
  });

  it('removeWorkspaceDefaults applies key removal via bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoRemoveWorkspaceDefaults = spy;
    expect(removeWorkspaceDefaults(['authToken'])).toBe(true);
    expect(spy).toHaveBeenCalledWith(['authToken']);
  });

  it('resetGqlDemoBatchDetection purges persisted flags and returns bridge live value', async () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__demoResetGqlBatchDetection = spy;
    await expect(resetGqlDemoBatchDetection()).resolves.toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(purgeGqlDemoBatchDetectionFlags).toHaveBeenCalledTimes(1);
  });

  it('resetGqlDemoBatchDetection returns false when bridge is absent', async () => {
    await expect(resetGqlDemoBatchDetection()).resolves.toBe(false);
    expect(purgeGqlDemoBatchDetectionFlags).toHaveBeenCalledTimes(1);
  });

  it('purgeGqlDemoGlobalAuthProfiles purges storage and syncs bridge state', async () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoPurgeGlobalAuthProfiles = spy;
    await expect(purgeGqlDemoGlobalAuthProfiles()).resolves.toBe(2);
    expect(purgeGqlDemoGlobalAuthProfilesFromStorage).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(['Lesson 6 Bearer'], ['lesson6-gql-profile']);
  });

  it('ensureSettingsEnvironment returns empty string when bridge missing', () => {
    expect(ensureSettingsEnvironment('prod')).toBe('');
  });

  it('ensureSettingsEnvironment calls bridge and returns env id', () => {
    const spy = vi.fn(() => 'env-123');
    (window as unknown as Record<string, unknown>).__demoEnsureSettingsEnv = spy;
    expect(ensureSettingsEnvironment('prod')).toBe('env-123');
    expect(spy).toHaveBeenCalledWith('prod');
  });

  it('removeSettingsEnvironment calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoRemoveSettingsEnv = spy;
    removeSettingsEnvironment('staging');
    expect(spy).toHaveBeenCalledWith('staging');
  });

  it('removeSettingsEnvironment is a no-op when bridge missing', () => {
    expect(() => removeSettingsEnvironment('staging')).not.toThrow();
  });

  it('ensureSettingsMicroservice returns empty string when bridge missing', () => {
    expect(ensureSettingsMicroservice('svc')).toBe('');
  });

  it('ensureSettingsMicroservice calls bridge and returns svc id', () => {
    const spy = vi.fn(() => 'svc-abc');
    (window as unknown as Record<string, unknown>).__demoEnsureSettingsSvc = spy;
    expect(ensureSettingsMicroservice('product-api', { e1: 'http://x' })).toBe('svc-abc');
    expect(spy).toHaveBeenCalledWith('product-api', { e1: 'http://x' });
  });

  it('removeSettingsMicroservice calls bridge', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoRemoveSettingsSvc = spy;
    removeSettingsMicroservice('product-api');
    expect(spy).toHaveBeenCalledWith('product-api');
  });

  it('removeSettingsMicroservice is a no-op when bridge missing', () => {
    expect(() => removeSettingsMicroservice('product-api')).not.toThrow();
  });

  it('selectSettingsEnvSvc calls bridge when envId is set', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoSelectEnvSvc = spy;
    selectSettingsEnvSvc('env-1', 'svc-1');
    expect(spy).toHaveBeenCalledWith('env-1', 'svc-1');
  });

  it('selectSettingsEnvSvc is a no-op when envId is empty', () => {
    const spy = vi.fn();
    (window as unknown as Record<string, unknown>).__demoSelectEnvSvc = spy;
    selectSettingsEnvSvc('');
    expect(spy).not.toHaveBeenCalled();
  });

  it('resetSettingsMicroserviceProtocols calls bridge and returns false when missing', () => {
    expect(resetSettingsMicroserviceProtocols('grpc-demo')).toBe(false);
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__demoResetSettingsSvcProtocols = spy;
    expect(resetSettingsMicroserviceProtocols('grpc-demo', { clearGlobalVars: true })).toBe(true);
    expect(spy).toHaveBeenCalledWith('grpc-demo', { clearGlobalVars: true });
  });
});
