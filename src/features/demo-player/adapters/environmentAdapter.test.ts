/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applyGqlTlsSettings,
  deleteGqlEnvironmentByName,
  upsertGlobalAuthProfile,
  upsertGqlEnvironment,
} from './environmentAdapter';

describe('environmentAdapter', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__demoUpsertGlobalAuthProfile;
    delete (window as unknown as Record<string, unknown>).__demoUpsertGqlEnv;
    delete (window as unknown as Record<string, unknown>).__demoApplyGqlTlsSettings;
    delete (window as unknown as Record<string, unknown>).__demoDeleteGqlEnvByName;
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
});
