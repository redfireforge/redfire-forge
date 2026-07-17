/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('./monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql-vars/${id}`,
}));

const { isTauriMock, readKeyMock, writeKeyMock, removeKeyMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  readKeyMock: vi.fn(async (): Promise<string | null> => null),
  writeKeyMock: vi.fn(async () => {}),
  removeKeyMock: vi.fn(async () => {}),
}));

vi.mock('../../../shared/utils/platform', () => ({
  isTauri: () => isTauriMock(),
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: (key: string) => readKeyMock(key),
  writeKey: (key: string, value: string) => writeKeyMock(key, value),
  removeKey: (key: string) => removeKeyMock(key),
}));

import {
  normalizeGraphqlAuth,
  graphqlAuthEquals,
  normalizePageAuthSnapshot,
  capturePageAuthSnapshot,
  restorePageEndpointSnapshot,
  loadDemoPriorPageEndpointBackup,
  saveDemoPriorPageEndpointBackup,
  clearDemoPriorPageEndpointBackup,
  loadTlsCerts,
  saveTlsCerts,
  normalizeTlsCertsStorage,
  loadTabs,
  saveTabs,
  loadAuth,
  saveAuth,
  loadActiveTabId,
  ENDPOINT_STORAGE_KEY,
  STORAGE_KEY,
  DEMO_PRIOR_PAGE_ENDPOINT_KEY,
  TLS_CERTS_STORAGE_KEY,
  disposeTabModels,
  type GqlStudioTab,
} from './tabPersistence';

describe('tabPersistence — coverage gaps', () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    readKeyMock.mockReset();
    writeKeyMock.mockReset();
    removeKeyMock.mockReset();
    localStorage.clear();
    indexedDB.deleteDatabase('redfireforge');
  });

  it('normalizeGraphqlAuth copies bearer/basic/apiKey/oauth2 fields', () => {
    expect(normalizeGraphqlAuth({ type: 'bearer', token: 'tok' })).toEqual({ type: 'bearer', token: 'tok' });
    expect(normalizeGraphqlAuth({ type: 'basic', username: 'u', password: 'p' })).toEqual({
      type: 'basic',
      username: 'u',
      password: 'p',
    });
    expect(normalizeGraphqlAuth({ type: 'apiKey', headerName: 'X', headerValue: 'v' })).toEqual({
      type: 'apiKey',
      headerName: 'X',
      headerValue: 'v',
    });
    expect(normalizeGraphqlAuth({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://t', clientId: 'id', clientSecret: 'sec', scope: 's', audience: 'a' },
    })).toEqual({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://t', clientId: 'id', clientSecret: 'sec', scope: 's', audience: 'a' },
    });
  });

  it('graphqlAuthEquals compares oauth2 via JSON', () => {
    const a = { type: 'oauth2' as const, oauth2: { tokenUrl: 'u', clientId: 'c', clientSecret: 's' } };
    const b = { type: 'oauth2' as const, oauth2: { tokenUrl: 'u', clientId: 'c', clientSecret: 's' } };
    expect(graphqlAuthEquals(a, b)).toBe(true);
  });

  it('loadTabs migrates from localStorage and removes legacy keys', async () => {
    const tab = {
      id: 'gql-tab-1',
      label: 'Q',
      modelUri: 'inmemory://graphql/gql-tab-1',
      query: 'query { x }',
      variables: '{}',
      headers: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([tab]));
    localStorage.setItem(`${STORAGE_KEY}_active`, 'gql-tab-1');
    const loaded = await loadTabs();
    expect(loaded).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('saveTabs falls back to writeKey when IDB save throws', async () => {
    const idbMod = await import('../../../shared/utils/idbGraphqlStudio');
    vi.spyOn(idbMod, 'idbSaveTabsPersisted').mockRejectedValueOnce(new Error('quota'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tab: GqlStudioTab = {
      id: 'gql-tab-2',
      label: 'T',
      modelUri: 'inmemory://graphql/gql-tab-2',
      query: 'query { y }',
      variables: '{}',
      headers: [],
      operationType: 'query',
      unsavedChanges: false,
    };
    await saveTabs([tab], tab.id);
    expect(writeKeyMock).toHaveBeenCalled();
    errSpy.mockRestore();
    vi.mocked(idbMod.idbSaveTabsPersisted).mockRestore();
  });

  it('loadActiveTabId falls back to readKey on IDB miss', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockResolvedValue('tab-x');
    await expect(loadActiveTabId()).resolves.toBe('tab-x');
  });

  it('loadAuth reads bearer auth via readKey on Tauri', async () => {
    isTauriMock.mockReturnValue(true);
    readKeyMock.mockResolvedValue(JSON.stringify({ type: 'bearer', token: 't' }));
    const auth = await loadAuth();
    expect(auth?.type).toBe('bearer');
  });

  it('saveAuth clears auth via IDB on web', async () => {
    await saveAuth(null);
    await expect(loadAuth()).resolves.toBeNull();
  });

  it('capturePageAuthSnapshot returns stored false for invalid auth JSON', async () => {
    readKeyMock.mockResolvedValue(JSON.stringify({ type: 'invalid-type' }));
    await expect(capturePageAuthSnapshot()).resolves.toEqual({ stored: false });
  });

  it('normalizePageAuthSnapshot handles stored true with null auth', () => {
    expect(normalizePageAuthSnapshot({ stored: true, auth: null })).toEqual({ stored: true, auth: null });
    expect(normalizePageAuthSnapshot({ stored: true, auth: { type: 'bad' } })).toBeUndefined();
  });

  it('demo prior page endpoint backup round-trips empty as null', async () => {
    await saveDemoPriorPageEndpointBackup(null);
    readKeyMock.mockResolvedValue('');
    await expect(loadDemoPriorPageEndpointBackup()).resolves.toBeNull();
    await clearDemoPriorPageEndpointBackup();
    expect(removeKeyMock).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_ENDPOINT_KEY);
  });

  it('restorePageEndpointSnapshot removes key for blank endpoint', async () => {
    await restorePageEndpointSnapshot('   ');
    expect(removeKeyMock).toHaveBeenCalledWith(ENDPOINT_STORAGE_KEY);
  });

  it('loadTlsCerts returns empty object on parse error', async () => {
    readKeyMock.mockResolvedValue('{bad');
    await expect(loadTlsCerts()).resolves.toEqual({});
  });

  it('saveTlsCerts removes key when all PEM fields empty', async () => {
    await saveTlsCerts({ caCert: '  ', clientCert: '', clientKey: undefined });
    expect(removeKeyMock).toHaveBeenCalledWith(TLS_CERTS_STORAGE_KEY);
  });

  it('normalizeTlsCertsStorage ignores non-string PEM fields', () => {
    expect(normalizeTlsCertsStorage({ caCert: 123, clientCert: null, clientKey: undefined })).toEqual({});
  });

  it('disposeTabModels swallows Monaco errors', () => {
    const tab: GqlStudioTab = {
      id: 'gql-tab-3',
      label: 'T',
      modelUri: 'bad-uri',
      query: 'q',
      variables: '{}',
      headers: [],
      operationType: 'query',
      unsavedChanges: false,
    };
    expect(() => disposeTabModels({
      editor: { getModel: () => { throw new Error('no model'); } },
      Uri: { parse: () => { throw new Error('bad uri'); } },
    }, tab)).not.toThrow();
  });
});
