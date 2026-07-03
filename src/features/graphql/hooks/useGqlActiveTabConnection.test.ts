/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { GraphqlAuth } from '../../../shared/types/graphql';
import { useGqlActiveTabConnection } from './useGqlActiveTabConnection';
import type { GqlStudioTab } from '../utils/tabPersistence';

const tab: GqlStudioTab = {
  id: 'tab-1',
  label: 'Q',
  modelUri: 'm://1',
  query: 'query { x }',
  variables: '{}',
  headers: [],
  connectionId: 'prof-1',
};

const profiles = [{
  id: 'prof-1',
  name: 'Staging',
  endpoint: 'https://staging.example/graphql',
  auth: { type: 'bearer', token: 'staging' } as GraphqlAuth,
  createdAt: 1,
}];

describe('useGqlActiveTabConnection', () => {
  it('resolves auth and TLS from linked profile', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: tab,
      profiles,
      endpoint: 'https://page.example/graphql',
      auth: { type: 'bearer', token: 'page' } as GraphqlAuth,
      skipTlsVerify: false,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabAuth).toEqual({ type: 'bearer', token: 'staging' });
    expect(result.current.activeTabConnection?.endpoint).toBe('https://staging.example/graphql');
    expect(result.current.activeTabConnection?.profileName).toBe('Staging');
  });

  it('falls back to page auth when tab has no profile link', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: { ...tab, connectionId: undefined },
      profiles,
      endpoint: 'https://page.example/graphql',
      auth: { type: 'bearer', token: 'page' } as GraphqlAuth,
      skipTlsVerify: false,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabAuth).toEqual({ type: 'bearer', token: 'page' });
    expect(result.current.activeTabConnection?.endpoint).toBe('https://page.example/graphql');
    expect(result.current.activeTabConnection?.profileName).toBeUndefined();
  });

  it('returns undefined profileName for orphaned connectionId', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: { ...tab, connectionId: 'prof-missing' },
      profiles,
      endpoint: 'https://page.example/graphql',
      auth: { type: 'bearer', token: 'page' } as GraphqlAuth,
      skipTlsVerify: false,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.activeTabConnection?.profileName).toBeUndefined();
    expect(result.current.resolvedTabAuth).toEqual({ type: 'bearer', token: 'page' });
  });

  it('Phase 6H: preserves tab explicit null No Auth (does not fall back to page auth)', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: { ...tab, connectionId: undefined, auth: null },
      profiles,
      endpoint: 'https://page.example/graphql',
      auth: { type: 'bearer', token: 'page' } as GraphqlAuth,
      skipTlsVerify: false,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabAuth).toBeNull();
  });

  it('Phase 6H: preserves profile explicit null when tab inherits workspace', () => {
    const noAuthProfile = [{
      id: 'prof-1',
      name: 'Public',
      endpoint: 'https://staging.example/graphql',
      auth: null,
      createdAt: 1,
    }];
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: tab,
      profiles: noAuthProfile,
      endpoint: 'https://page.example/graphql',
      auth: { type: 'bearer', token: 'page' } as GraphqlAuth,
      skipTlsVerify: false,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabAuth).toBeNull();
  });

  it('resolves per-tab polling overrides (Phase 6F)', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: { ...tab, connectionId: undefined, pollingEnabled: true, pollingIntervalSeconds: 15 },
      profiles: [],
      endpoint: 'https://page.example/graphql',
      auth: null,
      skipTlsVerify: false,
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabPollingEnabled).toBe(true);
    expect(result.current.resolvedTabPollingIntervalSeconds).toBe(15);
    expect(result.current.resolvedTabPollingIntervalMs).toBe(15000);
  });

  it('returns pollingIntervalMs 0 when tab explicitly disables polling (Phase 6F)', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: { ...tab, connectionId: undefined, pollingEnabled: false },
      profiles: [],
      endpoint: 'https://page.example/graphql',
      auth: null,
      skipTlsVerify: false,
      pollingEnabled: true,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabPollingEnabled).toBe(false);
    expect(result.current.resolvedTabPollingIntervalMs).toBe(0);
  });

  it('merges page-level TLS PEM fields into resolvedTabTls', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: { ...tab, connectionId: undefined },
      profiles: [],
      endpoint: 'https://page.example/graphql',
      auth: null,
      skipTlsVerify: false,
      tlsCaCert: 'page-ca',
      tlsClientCert: 'page-client',
      tlsClientKey: 'page-key',
      pollingEnabled: false,
      pollingIntervalSeconds: 30,
    }));

    expect(result.current.resolvedTabTls.caCert).toBe('page-ca');
    expect(result.current.resolvedTabTls.clientCert).toBe('page-client');
    expect(result.current.resolvedTabTls.clientKey).toBe('page-key');
  });

  it('returns null activeTabConnection and falls back to page values when activeTab is undefined', () => {
    const { result } = renderHook(() => useGqlActiveTabConnection({
      activeTab: undefined,
      profiles,
      endpoint: 'https://page.example/graphql',
      auth: { type: 'bearer', token: 'page-token' } as GraphqlAuth,
      skipTlsVerify: true,
      pollingEnabled: true,
      pollingIntervalSeconds: 15,
    }));

    expect(result.current.activeTabConnection).toBeNull();
    expect(result.current.resolvedTabAuth).toEqual({ type: 'bearer', token: 'page-token' });
    expect(result.current.resolvedTabSkipTlsVerify).toBe(true);
    expect(result.current.resolvedTabPollingEnabled).toBe(true);
    expect(result.current.resolvedTabPollingIntervalMs).toBe(15000);
  });
});
