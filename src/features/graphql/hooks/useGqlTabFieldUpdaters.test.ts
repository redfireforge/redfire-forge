/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGqlTabFieldUpdaters } from './useGqlTabFieldUpdaters';
import type { GqlStudioTab } from '../utils/tabPersistence';
import type { GqlTabFieldPageDefaults } from './useGqlTabFieldUpdaters';
import type { ConnectionProfile } from '../utils/connectionProfileStorage';

function makeTab(overrides: Partial<GqlStudioTab> = {}): GqlStudioTab {
  return {
    id: `tab-${Math.random().toString(36).slice(2, 6)}`,
    label: 'Tab',
    labelManual: false,
    query: '',
    variables: '',
    headers: [],
    unsavedChanges: false,
    ...overrides,
  } as GqlStudioTab;
}

const defaults: GqlTabFieldPageDefaults = {
  endpoint: 'http://default.local/graphql',
  endpointResolved: 'http://default.local/graphql',
  skipTlsVerify: false,
  pollingEnabled: false,
  pollingIntervalSeconds: 30,
  auth: null,
};

function setup(
  tabs: GqlStudioTab[],
  activeTabId: string,
  pageDefaults = defaults,
  profiles: ConnectionProfile[] = [],
) {
  const setTabsMock = vi.fn<[React.SetStateAction<GqlStudioTab[]>], void>();
  const activeTabIdRef = { current: activeTabId };

  const { result } = renderHook(() =>
    useGqlTabFieldUpdaters({
      setTabs: setTabsMock,
      activeTabIdRef,
      pageDefaults,
      profiles,
      tabCount: tabs.length,
    }),
  );

  function applySetTabs(): GqlStudioTab[] {
    const lastCall = setTabsMock.mock.calls.at(-1);
    if (!lastCall) throw new Error('setTabs not called');
    const arg = lastCall[0];
    return typeof arg === 'function' ? arg(tabs) : arg;
  }

  return { result, setTabsMock, applySetTabs };
}

describe('useGqlTabFieldUpdaters', () => {
  describe('updateActiveTab', () => {
    it('patches the active tab with unsavedChanges=true', () => {
      const tab = makeTab({ id: 'a', variables: '' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTab({ variables: 'new vars' }));
      const next = applySetTabs();
      expect(next[0].variables).toBe('new vars');
      expect(next[0].unsavedChanges).toBe(true);
    });

    it('does not affect non-active tabs', () => {
      const t1 = makeTab({ id: 'a', query: 'old' });
      const t2 = makeTab({ id: 'b', query: 'keep' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.updateActiveTab({ query: 'new' }));
      const next = applySetTabs();
      expect(next[1].query).toBe('keep');
    });
  });

  describe('updateActiveTabEndpoint', () => {
    it('sets endpoint when different from page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabEndpoint('http://custom.local/gql'));
      const next = applySetTabs();
      expect(next[0].endpoint).toBe('http://custom.local/gql');
      expect(next[0].connectionId).toBeUndefined();
      expect(next[0].unsavedChanges).toBe(true);
    });

    it('clears endpoint when matching page default', () => {
      const tab = makeTab({ id: 'a', endpoint: 'http://old.local' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabEndpoint(defaults.endpoint));
      const next = applySetTabs();
      expect(next[0].endpoint).toBeUndefined();
    });

    it('sets empty string override for blank input in multi-tab', () => {
      const t1 = makeTab({ id: 'a' });
      const t2 = makeTab({ id: 'b' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.updateActiveTabEndpoint(''));
      const next = applySetTabs();
      expect(next[0].endpoint).toBe('');
    });

    it('clears to undefined for blank input in single-tab', () => {
      const tab = makeTab({ id: 'a', endpoint: 'old' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabEndpoint(''));
      const next = applySetTabs();
      expect(next[0].endpoint).toBeUndefined();
    });
  });

  describe('clearActiveTabEndpoint', () => {
    it('clears endpoint and connectionId', () => {
      const tab = makeTab({ id: 'a', endpoint: 'http://x', connectionId: 'p1' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabEndpoint());
      const next = applySetTabs();
      expect(next[0].endpoint).toBeUndefined();
      expect(next[0].connectionId).toBeUndefined();
    });

    it('returns unchanged tab when already cleared', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabEndpoint());
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('updateActiveTabSkipTlsVerify', () => {
    it('sets undefined when matching page default', () => {
      const tab = makeTab({ id: 'a', skipTlsVerify: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabSkipTlsVerify(false));
      const next = applySetTabs();
      expect(next[0].skipTlsVerify).toBeUndefined();
    });

    it('sets value when different from page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabSkipTlsVerify(true));
      const next = applySetTabs();
      expect(next[0].skipTlsVerify).toBe(true);
    });
  });

  describe('updateActiveTabTlsSettings', () => {
    it('updates skipTlsVerify relative to page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ skipTlsVerify: true }));
      const next = applySetTabs();
      expect(next[0].skipTlsVerify).toBe(true);
    });

    it('clears caCert when matching page default', () => {
      const tab = makeTab({ id: 'a', tlsCaCert: 'old' });
      const pd = { ...defaults, tlsCaCert: 'same' };
      const { result, applySetTabs } = setup([tab], 'a', pd);
      act(() => result.current.updateActiveTabTlsSettings({ caCert: 'same' }));
      const next = applySetTabs();
      expect(next[0].tlsCaCert).toBeUndefined();
    });

    it('sets clientCert when different from page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ clientCert: 'cert-pem' }));
      const next = applySetTabs();
      expect(next[0].tlsClientCert).toBe('cert-pem');
    });

    it('sets clientKey when different from page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ clientKey: 'key-pem' }));
      const next = applySetTabs();
      expect(next[0].tlsClientKey).toBe('key-pem');
    });

    it('returns unchanged tab when all patches match current state', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({}));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('updateActiveTabPolling', () => {
    it('stores override when different from page defaults', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabPolling(true, 15));
      const next = applySetTabs();
      expect(next[0].pollingEnabled).toBe(true);
      expect(next[0].pollingIntervalSeconds).toBe(15);
    });

    it('clears to undefined when matching page defaults', () => {
      const tab = makeTab({ id: 'a', pollingEnabled: true, pollingIntervalSeconds: 15 });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabPolling(false, 30));
      const next = applySetTabs();
      expect(next[0].pollingEnabled).toBeUndefined();
      expect(next[0].pollingIntervalSeconds).toBeUndefined();
    });
  });

  describe('clearActiveTabPolling', () => {
    it('clears polling fields to undefined', () => {
      const tab = makeTab({ id: 'a', pollingEnabled: true, pollingIntervalSeconds: 10 });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabPolling());
      const next = applySetTabs();
      expect(next[0].pollingEnabled).toBeUndefined();
      expect(next[0].pollingIntervalSeconds).toBeUndefined();
    });

    it('returns unchanged tab when already cleared', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabPolling());
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('clearActiveTabAuth', () => {
    it('removes auth field', () => {
      const tab = makeTab({ id: 'a', auth: { type: 'bearer', token: 'x' } as never });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabAuth());
      const next = applySetTabs();
      expect(next[0].auth).toBeUndefined();
      expect(next[0].unsavedChanges).toBe(true);
    });

    it('returns unchanged tab when auth already undefined', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabAuth());
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('applyProfileToActiveTab', () => {
    it('sets connectionId and endpoint from profile', () => {
      const tab = makeTab({ id: 'a', labelManual: true });
      const profile: ConnectionProfile = { id: 'p1', name: 'Main', endpoint: 'http://prof.local/gql' } as ConnectionProfile;
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.applyProfileToActiveTab(profile));
      const next = applySetTabs();
      expect(next[0].connectionId).toBe('p1');
      expect(next[0].endpoint).toBe('http://prof.local/gql');
    });
  });

  describe('clearConnectionIdsForProfile', () => {
    it('clears connectionId on matching tabs', () => {
      const t1 = makeTab({ id: 'a', connectionId: 'p1' });
      const t2 = makeTab({ id: 'b', connectionId: 'p2' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.clearConnectionIdsForProfile('p1'));
      const next = applySetTabs();
      expect(next[0].connectionId).toBeUndefined();
      expect(next[1].connectionId).toBe('p2');
    });
  });

  describe('clearActiveTabProfileLink', () => {
    it('clears connectionId on active tab', () => {
      const tab = makeTab({ id: 'a', connectionId: 'p1', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabProfileLink());
      const next = applySetTabs();
      expect(next[0].connectionId).toBeUndefined();
    });

    it('returns unchanged when connectionId already undefined', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabProfileLink());
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('handleQueryChange', () => {
    it('updates query and derives operation type', () => {
      const tab = makeTab({ id: 'a', query: '', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.handleQueryChange('mutation { addUser { id } }'));
      const next = applySetTabs();
      expect(next[0].query).toBe('mutation { addUser { id } }');
      expect(next[0].operationType).toBe('mutation');
      expect(next[0].unsavedChanges).toBe(true);
    });
  });

  describe('handleVariablesChange', () => {
    it('updates variables on active tab', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.handleVariablesChange('{"key": "val"}'));
      const next = applySetTabs();
      expect(next[0].variables).toBe('{"key": "val"}');
    });
  });

  describe('handleHeadersChange', () => {
    it('updates headers on active tab', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.handleHeadersChange([{ key: 'X-H', value: '1' }]));
      const next = applySetTabs();
      expect(next[0].headers).toEqual([{ key: 'X-H', value: '1' }]);
    });
  });

  describe('handleSubscriptionTransportChange', () => {
    it('updates subscriptionTransport on active tab', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.handleSubscriptionTransportChange('sse'));
      const next = applySetTabs();
      expect(next[0].subscriptionTransport).toBe('sse');
    });
  });

  describe('handleSelectOperation', () => {
    it('updates selectedOperation on active tab', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.handleSelectOperation('GetUsers'));
      const next = applySetTabs();
      expect(next[0].selectedOperation).toBe('GetUsers');
    });
  });

  describe('handleAssertionsChange', () => {
    it('updates subscriptionAssertions on active tab', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      const assertions = [{ field: 'data.id', operator: 'equals' as const, value: '1' }];
      act(() => result.current.handleAssertionsChange(assertions as never));
      const next = applySetTabs();
      expect(next[0].subscriptionAssertions).toEqual(assertions);
    });
  });

  describe('updateActiveTabAuth', () => {
    it('sets auth on active tab when different from page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      const auth = { type: 'bearer' as const, token: 'test-token' };
      act(() => result.current.updateActiveTabAuth(auth));
      const next = applySetTabs();
      expect(next[0].auth).toEqual(auth);
      expect(next[0].unsavedChanges).toBe(true);
    });

    it('clears auth when matching page default', () => {
      const pageAuth = { type: 'bearer' as const, token: 'def-token' };
      const tab = makeTab({ id: 'a', auth: pageAuth as never });
      const pd = { ...defaults, auth: pageAuth };
      const { result, applySetTabs } = setup([tab], 'a', pd);
      act(() => result.current.updateActiveTabAuth(pageAuth));
      const next = applySetTabs();
      expect(next[0].auth).toBeUndefined();
    });

    it('clears profile link when clearProfileLink option is set and auth is non-default', () => {
      const tab = makeTab({ id: 'a', connectionId: 'p1', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      const auth = { type: 'bearer' as const, token: 'new' };
      act(() => result.current.updateActiveTabAuth(auth, { clearProfileLink: true }));
      const next = applySetTabs();
      expect(next[0].connectionId).toBeUndefined();
      expect(next[0].auth).toEqual(auth);
    });

    it('returns unchanged when auth equals current stored value', () => {
      const auth = { type: 'bearer' as const, token: 'same' };
      const tab = makeTab({ id: 'a', auth: auth as never });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabAuth(auth));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('applyProfileToActiveTab — no-op when already linked', () => {
    it('returns unchanged tab when profile and endpoint already match', () => {
      const profile: ConnectionProfile = { id: 'p1', name: 'Main', endpoint: 'http://x' } as ConnectionProfile;
      const tab = makeTab({ id: 'a', connectionId: 'p1', endpoint: 'http://x', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.applyProfileToActiveTab(profile));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('updateActiveTabEndpoint — no-op when same value', () => {
    it('returns unchanged when endpoint and connectionId match', () => {
      const tab = makeTab({ id: 'a', endpoint: 'http://custom', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabEndpoint('http://custom'));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('clearActiveTabEndpoint — no-op', () => {
    it('returns same tab reference when already cleared', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.clearActiveTabEndpoint());
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('updateActiveTabSkipTlsVerify — no-op when unchanged', () => {
    it('returns same tab when skip already matches new value', () => {
      const tab = makeTab({ id: 'a', skipTlsVerify: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabSkipTlsVerify(true));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('updateActiveTabPolling — no-op', () => {
    it('returns same tab when values unchanged', () => {
      const tab = makeTab({ id: 'a', pollingEnabled: true, pollingIntervalSeconds: 15 });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabPolling(true, 15));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });
  });

  describe('updateActiveTabTlsSettings — inherited cert branches', () => {
    it('clears clientCert when matching page default', () => {
      const tab = makeTab({ id: 'a', tlsClientCert: 'old' });
      const pd = { ...defaults, tlsClientCert: 'same-cert' };
      const { result, applySetTabs } = setup([tab], 'a', pd);
      act(() => result.current.updateActiveTabTlsSettings({ clientCert: 'same-cert' }));
      const next = applySetTabs();
      expect(next[0].tlsClientCert).toBeUndefined();
    });

    it('clears clientKey when matching page default', () => {
      const tab = makeTab({ id: 'a', tlsClientKey: 'old' });
      const pd = { ...defaults, tlsClientKey: 'same-key' };
      const { result, applySetTabs } = setup([tab], 'a', pd);
      act(() => result.current.updateActiveTabTlsSettings({ clientKey: 'same-key' }));
      const next = applySetTabs();
      expect(next[0].tlsClientKey).toBeUndefined();
    });

    it('sets caCert when different from page default', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ caCert: 'new-ca' }));
      const next = applySetTabs();
      expect(next[0].tlsCaCert).toBe('new-ca');
    });

    it('normalizes empty caCert to undefined', () => {
      const tab = makeTab({ id: 'a', tlsCaCert: 'existing' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ caCert: '' }));
      const next = applySetTabs();
      expect(next[0].tlsCaCert).toBeUndefined();
    });

    it('does not mutate when caCert already matches tab value', () => {
      const tab = makeTab({ id: 'a', tlsCaCert: 'same' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ caCert: 'same' }));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });

    it('does not mutate when clientCert already matches tab value', () => {
      const tab = makeTab({ id: 'a', tlsClientCert: 'cert' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ clientCert: 'cert' }));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });

    it('does not mutate when clientKey already matches tab value', () => {
      const tab = makeTab({ id: 'a', tlsClientKey: 'key' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ clientKey: 'key' }));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });

    it('does not mutate when skipTlsVerify already matches computed value', () => {
      const tab = makeTab({ id: 'a', skipTlsVerify: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({ skipTlsVerify: true }));
      const next = applySetTabs();
      expect(next[0]).toBe(tab);
    });

    it('updates all TLS fields at once', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabTlsSettings({
        skipTlsVerify: true, caCert: 'ca', clientCert: 'cert', clientKey: 'key',
      }));
      const next = applySetTabs();
      expect(next[0].skipTlsVerify).toBe(true);
      expect(next[0].tlsCaCert).toBe('ca');
      expect(next[0].tlsClientCert).toBe('cert');
      expect(next[0].tlsClientKey).toBe('key');
      expect(next[0].unsavedChanges).toBe(true);
    });
  });

  describe('updateActiveTabAuth — edge cases', () => {
    it('removes auth field (keeps profile link) when nextStored is undefined', () => {
      const pageAuth = { type: 'bearer' as const, token: 'def' };
      const tab = makeTab({ id: 'a', connectionId: 'p1', auth: pageAuth as never, labelManual: true });
      const pd = { ...defaults, auth: pageAuth };
      const { result, applySetTabs } = setup([tab], 'a', pd);
      act(() => result.current.updateActiveTabAuth(pageAuth, { clearProfileLink: true }));
      const next = applySetTabs();
      expect(next[0].connectionId).toBe('p1');
      expect(next[0].auth).toBeUndefined();
      expect(next[0].unsavedChanges).toBe(true);
    });

    it('returns unsavedChanges when profile link cleared but auth already undefined', () => {
      const tab = makeTab({ id: 'a', connectionId: 'p1', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      const auth = { type: 'bearer' as const, token: 'new' };
      act(() => result.current.updateActiveTabAuth(auth, { clearProfileLink: true }));
      const next = applySetTabs();
      expect(next[0].connectionId).toBeUndefined();
      expect(next[0].auth).toEqual(auth);
    });

    it('keeps profile link when clearProfileLink is false with non-default auth', () => {
      const tab = makeTab({ id: 'a', connectionId: 'p1', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      const auth = { type: 'bearer' as const, token: 'new' };
      act(() => result.current.updateActiveTabAuth(auth, { clearProfileLink: false }));
      const next = applySetTabs();
      expect(next[0].connectionId).toBe('p1');
      expect(next[0].auth).toEqual(auth);
    });

    it('sets unsavedChanges when profile link cleared and auth equals stored', () => {
      const auth = { type: 'bearer' as const, token: 'same' };
      const tab = makeTab({ id: 'a', connectionId: 'p1', auth: auth as never, labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabAuth(auth, { clearProfileLink: true }));
      const next = applySetTabs();
      expect(next[0].connectionId).toBeUndefined();
      expect(next[0].unsavedChanges).toBe(true);
    });

    it('applies null auth when page default is also null', () => {
      const tab = makeTab({ id: 'a' });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.updateActiveTabAuth(null));
      const next = applySetTabs();
      expect(next[0].unsavedChanges).toBe(true);
    });
  });

  describe('applyProfileToActiveTab — auth override branch', () => {
    it('still applies profile when tab has auth override', () => {
      const profile: ConnectionProfile = { id: 'p1', name: 'Main', endpoint: 'http://x' } as ConnectionProfile;
      const tab = makeTab({ id: 'a', connectionId: 'p1', endpoint: 'http://x', auth: { type: 'bearer', token: 'x' } as never, labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.applyProfileToActiveTab(profile));
      const next = applySetTabs();
      expect(next[0].connectionId).toBe('p1');
      expect(next[0].auth).toBeUndefined();
    });

    it('applies profile with empty endpoint (clears to undefined)', () => {
      const profile: ConnectionProfile = { id: 'p2', name: 'Empty', endpoint: '' } as ConnectionProfile;
      const tab = makeTab({ id: 'a', labelManual: true });
      const { result, applySetTabs } = setup([tab], 'a');
      act(() => result.current.applyProfileToActiveTab(profile));
      const next = applySetTabs();
      expect(next[0].connectionId).toBe('p2');
      expect(next[0].endpoint).toBeUndefined();
    });
  });

  describe('non-active tab identity', () => {
    it('clearActiveTabEndpoint leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a', endpoint: 'http://x' });
      const t2 = makeTab({ id: 'b', endpoint: 'http://y' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.clearActiveTabEndpoint());
      const next = applySetTabs();
      expect(next[1]).toBe(t2);
    });

    it('updateActiveTabSkipTlsVerify leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a' });
      const t2 = makeTab({ id: 'b' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.updateActiveTabSkipTlsVerify(true));
      const next = applySetTabs();
      expect(next[1]).toBe(t2);
    });

    it('updateActiveTabPolling leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a' });
      const t2 = makeTab({ id: 'b' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.updateActiveTabPolling(true, 10));
      const next = applySetTabs();
      expect(next[1]).toBe(t2);
    });

    it('clearActiveTabPolling leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a', pollingEnabled: true });
      const t2 = makeTab({ id: 'b', pollingEnabled: true });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.clearActiveTabPolling());
      const next = applySetTabs();
      expect(next[1]).toBe(t2);
    });

    it('clearActiveTabAuth leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a', auth: { type: 'bearer', token: 'x' } as never });
      const t2 = makeTab({ id: 'b', auth: { type: 'bearer', token: 'y' } as never });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.clearActiveTabAuth());
      const next = applySetTabs();
      expect(next[1]).toBe(t2);
    });

    it('handleQueryChange leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a', labelManual: true });
      const t2 = makeTab({ id: 'b', query: 'keep' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.handleQueryChange('{ users { id } }'));
      const next = applySetTabs();
      expect(next[1].query).toBe('keep');
    });

    it('handleSubscriptionTransportChange leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a' });
      const t2 = makeTab({ id: 'b' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.handleSubscriptionTransportChange('sse'));
      const next = applySetTabs();
      expect(next[1].subscriptionTransport).toBeUndefined();
    });

    it('updateActiveTabAuth leaves non-active tabs unchanged', () => {
      const t1 = makeTab({ id: 'a' });
      const t2 = makeTab({ id: 'b' });
      const { result, applySetTabs } = setup([t1, t2], 'a');
      act(() => result.current.updateActiveTabAuth({ type: 'bearer', token: 'new' }));
      const next = applySetTabs();
      expect(next[1]).toBe(t2);
    });
  });
});
