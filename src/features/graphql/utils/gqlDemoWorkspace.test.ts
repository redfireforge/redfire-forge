/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql-vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(),
  writeKey: vi.fn(),
  removeKey: vi.fn(),
}));

import { readKey, writeKey, removeKey } from '../../../shared/utils/storage';
import {
  closeDemoWorkspace,
  countUserTabsInStorage,
  dispatchGqlTabsReload,
  dispatchGqlPageAuthReload,
  dispatchGqlPageEndpointReload,
  filterTabsForPersistence,
  isGraphqlStudioLesson,
  loadDemoSession,
  patchDemoTabConnection,
  pickPersistedActiveTabId,
  prepareDemoWorkspace,
  purgeOrphanDemoTabs,
  userTabsToCloseForLesson,
  DEMO_SESSION_KEY,
  GQL_TABS_RELOAD_EVENT,
  GQL_PAGE_AUTH_RELOAD_EVENT,
  GQL_PAGE_ENDPOINT_RELOAD_EVENT,
} from './gqlDemoWorkspace';
import { STORAGE_KEY, AUTH_STORAGE_KEY, DEMO_PRIOR_PAGE_AUTH_KEY, DEMO_PRIOR_PAGE_ENDPOINT_KEY, ENDPOINT_STORAGE_KEY, makeBlankTab, makeDemoTab } from './tabPersistence';

const mockReadKey = vi.mocked(readKey);
const mockWriteKey = vi.mocked(writeKey);
const mockRemoveKey = vi.mocked(removeKey);

function seedTabs(tabs: ReturnType<typeof makeBlankTab>[], activeId: string): void {
  mockReadKey.mockImplementation(async (key: string) => {
    if (key === STORAGE_KEY) return JSON.stringify(tabs);
    if (key === `${STORAGE_KEY}_active`) return activeId;
    return null;
  });
}

describe('gqlDemoWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteKey.mockResolvedValue(undefined);
    mockRemoveKey.mockResolvedValue(undefined);
  });

  it('dispatchGqlTabsReload fires a custom event', () => {
    const handler = vi.fn();
    window.addEventListener(GQL_TABS_RELOAD_EVENT, handler);
    dispatchGqlTabsReload();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(GQL_TABS_RELOAD_EVENT, handler);
  });

  it('dispatchGqlPageAuthReload fires a custom event', () => {
    const handler = vi.fn();
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, handler);
    dispatchGqlPageAuthReload();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, handler);
  });

  it('dispatchGqlPageEndpointReload fires a custom event', () => {
    const handler = vi.fn();
    window.addEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, handler);
    dispatchGqlPageEndpointReload();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, handler);
  });

  it('dispatch helpers no-op when window is undefined', async () => {
    const savedWindow = globalThis.window;
    // @ts-expect-error — simulate non-browser runtime
    delete globalThis.window;
    expect(() => {
      dispatchGqlTabsReload();
      dispatchGqlPageAuthReload();
      dispatchGqlPageEndpointReload();
    }).not.toThrow();
    globalThis.window = savedWindow;
  });

  it('prepareDemoWorkspace appends a demo tab and saves session', async () => {
    const user = makeBlankTab();
    user.label = 'My Query';
    seedTabs([user], user.id);

    const result = await prepareDemoWorkspace('gql-first-query', 'Demo: First Query');
    expect(result.ok).toBe(true);
    expect(result.demoTabId).toMatch(/^gql-tab-/);

    expect(mockWriteKey).toHaveBeenCalledWith(
      DEMO_SESSION_KEY,
      expect.stringContaining('"lessonId":"gql-first-query"'),
    );
    const sessionWrite = mockWriteKey.mock.calls.find(([k]) => k === DEMO_SESSION_KEY);
    const session = JSON.parse(sessionWrite![1] as string) as { priorPageAuth?: { stored: boolean } };
    expect(session.priorPageAuth).toEqual({ stored: false });
    expect(mockWriteKey).toHaveBeenCalledWith(
      DEMO_PRIOR_PAGE_AUTH_KEY,
      JSON.stringify({ stored: false }),
    );
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    expect(tabsWrite).toBeTruthy();
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string }[];
    expect(savedTabs).toHaveLength(2);
    expect(savedTabs.filter((t) => t.demoLessonId === 'gql-first-query')).toHaveLength(1);
  });

  it('prepareDemoWorkspace seeds gql-https-tls demo tab with plain HTTP endpoint', async () => {
    const user = makeBlankTab();
    seedTabs([user], user.id);

    const result = await prepareDemoWorkspace('gql-https-tls', 'Demo: HTTPS, TLS & Certificates');
    expect(result.ok).toBe(true);

    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string; endpoint?: string }[];
    const demo = savedTabs.find((t) => t.demoLessonId === 'gql-https-tls');
    expect(demo?.endpoint).toBe('http://localhost:4010/graphql');
  });

  it('patchDemoTabConnection updates demo tab endpoint and dispatches reload', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-https-tls', 'Demo: TLS');
    demo.endpoint = 'https://localhost:4443/graphql';
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-https-tls',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    const handler = vi.fn();
    window.addEventListener(GQL_TABS_RELOAD_EVENT, handler);

    const ok = await patchDemoTabConnection({ endpoint: 'http://localhost:4010/graphql' });
    expect(ok).toBe(true);
    expect(handler).toHaveBeenCalled();

    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { id: string; endpoint?: string }[];
    expect(savedTabs.find((t) => t.id === demo.id)?.endpoint).toBe('http://localhost:4010/graphql');

    window.removeEventListener(GQL_TABS_RELOAD_EVENT, handler);
  });

  it('patchDemoTabConnection clears TLS fields when patch omits them', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-https-tls', 'Demo: TLS');
    demo.skipTlsVerify = true;
    demo.tlsCaCert = 'ca-pem';
    demo.tlsClientCert = 'client-pem';
    demo.tlsClientKey = 'key-pem';
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-https-tls',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    const ok = await patchDemoTabConnection({ endpoint: 'https://localhost:4443/graphql' });
    expect(ok).toBe(true);

    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const saved = JSON.parse(tabsWrite![1] as string) as Record<string, unknown>[];
    const patched = saved.find((t) => t.id === demo.id)!;
    expect(patched.endpoint).toBe('https://localhost:4443/graphql');
    expect(patched.skipTlsVerify).toBeUndefined();
    expect(patched.tlsCaCert).toBeUndefined();
    expect(patched.tlsClientCert).toBeUndefined();
    expect(patched.tlsClientKey).toBeUndefined();
  });

  it('patchDemoTabConnection preserves TLS fields when explicitly included in patch', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-https-tls', 'Demo: TLS');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-https-tls',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    const ok = await patchDemoTabConnection({
      endpoint: 'https://localhost:4443/graphql',
      skipTlsVerify: true,
      tlsCaCert: 'new-ca',
    });
    expect(ok).toBe(true);

    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const patched = JSON.parse(tabsWrite![1] as string).find((t: { id: string }) => t.id === demo.id);
    expect(patched.skipTlsVerify).toBe(true);
    expect(patched.tlsCaCert).toBe('new-ca');
  });

  it('patchDemoTabConnection returns false when demo tab id missing from storage', async () => {
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-first-query',
          priorActiveTabId: 'user-1',
          demoTabId: 'missing-demo-tab',
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([makeBlankTab()]);
      return null;
    });
    await expect(patchDemoTabConnection({ endpoint: 'http://localhost:4010/graphql' })).resolves.toBe(false);
  });

  it('patchDemoTabConnection returns false when no demo session', async () => {
    mockReadKey.mockResolvedValue(null);
    await expect(patchDemoTabConnection({ endpoint: 'http://localhost:4010/graphql' })).resolves.toBe(false);
  });

  it('prepareDemoWorkspace rejects when user tab cap exceeded for tabBudget', async () => {
    const users = Array.from({ length: 7 }, () => makeBlankTab());
    seedTabs(users, users[0].id);

    const result = await prepareDemoWorkspace('gql-multi-tab', 'Demo: X', 2);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max_tabs');
  });

  it('closeDemoWorkspace removes demo tabs and clears session', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-first-query', 'Demo: First');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-first-query',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    await closeDemoWorkspace('gql-first-query');
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_SESSION_KEY);
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_AUTH_KEY);
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { id: string }[];
    expect(savedTabs).toHaveLength(1);
    expect(savedTabs[0].id).toBe(user.id);
  });

  it('purgeOrphanDemoTabs strips demo tabs when session missing', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('orphan', 'Demo: Orphan');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    const purged = await purgeOrphanDemoTabs();
    expect(purged).toBe(true);
  });

  it('purgeOrphanDemoTabs restores page auth from backup when session is missing', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('orphan', 'Demo: Orphan');
    const priorAuth = JSON.stringify({ type: 'inherit', globalProfileId: 'prof-1' });
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      if (key === AUTH_STORAGE_KEY) return JSON.stringify({ type: 'bearer', token: 'lesson-pollution' });
      if (key === DEMO_PRIOR_PAGE_AUTH_KEY) {
        return JSON.stringify({
          stored: true,
          auth: { type: 'inherit', globalProfileId: 'prof-1' },
        });
      }
      return null;
    });

    const authHandler = vi.fn();
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);

    const purged = await purgeOrphanDemoTabs();
    expect(purged).toBe(true);
    expect(mockWriteKey).toHaveBeenCalledWith(AUTH_STORAGE_KEY, priorAuth);
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_AUTH_KEY);
    expect(authHandler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);
  });

  it('purgeOrphanDemoTabs restores page endpoint from backup when session is missing', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('orphan', 'Demo: Orphan');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      if (key === DEMO_PRIOR_PAGE_ENDPOINT_KEY) return 'https://restored.example.com/graphql';
      return null;
    });

    const endpointHandler = vi.fn();
    window.addEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, endpointHandler);

    const purged = await purgeOrphanDemoTabs();
    expect(purged).toBe(true);
    expect(mockWriteKey).toHaveBeenCalledWith(ENDPOINT_STORAGE_KEY, 'https://restored.example.com/graphql');
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_ENDPOINT_KEY);
    expect(endpointHandler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, endpointHandler);
  });

  it('loadDemoSession parses stored session and normalizes priorPageAuth', async () => {
    mockReadKey.mockResolvedValue(
      JSON.stringify({
        lessonId: 'gql-first-query',
        priorActiveTabId: 'a',
        demoTabId: 'b',
        priorPageAuth: { stored: true, auth: { type: 'inherit', globalProfileId: 'prof-1' } },
      }),
    );
    const session = await loadDemoSession();
    expect(session?.lessonId).toBe('gql-first-query');
    expect(session?.priorPageAuth).toEqual({
      stored: true,
      auth: { type: 'inherit', globalProfileId: 'prof-1' },
    });
  });

  it('loadDemoSession drops corrupt priorPageAuth', async () => {
    mockReadKey.mockResolvedValue(
      JSON.stringify({
        lessonId: 'gql-first-query',
        priorActiveTabId: 'a',
        demoTabId: 'b',
        priorPageAuth: { stored: true, auth: { type: 'not-a-real-type' } },
      }),
    );
    const session = await loadDemoSession();
    expect(session?.priorPageAuth).toBeUndefined();
  });

  it('loadDemoSession parses stored session', async () => {
    mockReadKey.mockResolvedValue(
      JSON.stringify({ lessonId: 'gql-first-query', priorActiveTabId: 'a', demoTabId: 'b' }),
    );
    const session = await loadDemoSession();
    expect(session?.lessonId).toBe('gql-first-query');
  });

  it('userTabsToCloseForLesson respects tabBudget', () => {
    expect(userTabsToCloseForLesson(7, 1)).toBe(0);
    expect(userTabsToCloseForLesson(8, 1)).toBe(1);
    expect(userTabsToCloseForLesson(7, 2)).toBe(1);
  });

  it('countUserTabsInStorage excludes demo tabs', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('x', 'Demo');
    seedTabs([user, demo], user.id);
    await expect(countUserTabsInStorage()).resolves.toBe(1);
  });

  it('filterTabsForPersistence removes demo tabs when session is null', () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-batch-execution', 'Demo: Batch');
    expect(filterTabsForPersistence([user, demo], null)).toEqual([user]);
  });

  it('filterTabsForPersistence keeps demo tabs for active session lesson', () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-batch-execution', 'Demo: Batch');
    const session = {
      lessonId: 'gql-batch-execution',
      priorActiveTabId: user.id,
      demoTabId: demo.id,
    };
    expect(filterTabsForPersistence([user, demo], session)).toEqual([user, demo]);
  });

  it('pickPersistedActiveTabId returns activeId when it exists in tabs', () => {
    const user = makeBlankTab();
    expect(pickPersistedActiveTabId([user], user.id)).toBe(user.id);
  });

  it('pickPersistedActiveTabId falls back to first tab when activeId is missing', () => {
    const user = makeBlankTab();
    const other = makeBlankTab();
    expect(pickPersistedActiveTabId([user, other], 'missing-id')).toBe(user.id);
  });

  it('pickPersistedActiveTabId returns activeId when tabs array is empty', () => {
    expect(pickPersistedActiveTabId([], 'orphan-id')).toBe('orphan-id');
  });

  it('isGraphqlStudioLesson detects graphql-studio initialTab or graphql category', () => {
    expect(isGraphqlStudioLesson({ initialTab: 'graphql-studio' })).toBe(true);
    expect(isGraphqlStudioLesson({ category: 'graphql' })).toBe(true);
    expect(isGraphqlStudioLesson({ initialTab: 'requests', category: 'http' })).toBe(false);
  });

  it('loadDemoSession returns null for missing or invalid stored session', async () => {
    mockReadKey.mockResolvedValueOnce(null);
    await expect(loadDemoSession()).resolves.toBeNull();

    mockReadKey.mockResolvedValueOnce('not-json');
    await expect(loadDemoSession()).resolves.toBeNull();

    mockReadKey.mockResolvedValueOnce(JSON.stringify({ lessonId: 'x' }));
    await expect(loadDemoSession()).resolves.toBeNull();
  });

  it('prepareDemoWorkspace creates blank tab when no user tabs exist', async () => {
    seedTabs([], 'missing');
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === STORAGE_KEY) return JSON.stringify([]);
      if (key === `${STORAGE_KEY}_active`) return null;
      return null;
    });

    const result = await prepareDemoWorkspace('gql-first-query', 'Demo: First Query');
    expect(result.ok).toBe(true);
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string }[];
    expect(savedTabs).toHaveLength(2);
    expect(savedTabs.filter((t) => t.demoLessonId === 'gql-first-query')).toHaveLength(1);
  });

  it('prepareDemoWorkspace returns storage_unavailable when persistence throws', async () => {
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === `${STORAGE_KEY}_active`) throw new Error('storage unavailable');
      if (key === STORAGE_KEY) return JSON.stringify([]);
      return null;
    });
    const result = await prepareDemoWorkspace('gql-first-query', 'Demo: First Query');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('storage_unavailable');
  });

  it('prepareDemoWorkspace rejects via second max_tabs guard', async () => {
    const users = Array.from({ length: 8 }, () => makeBlankTab());
    seedTabs(users, users[0].id);
    const result = await prepareDemoWorkspace('gql-first-query', 'Demo: X', 0);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('max_tabs');
  });

  it('closeDemoWorkspace creates blank tab when all tabs were demo-only', async () => {
    const demo = makeDemoTab('gql-first-query', 'Demo: First');
    seedTabs([demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-first-query',
          priorActiveTabId: demo.id,
          demoTabId: demo.id,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    await closeDemoWorkspace('gql-first-query');
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { id: string }[];
    expect(savedTabs).toHaveLength(1);
    expect(savedTabs[0].id).toMatch(/^gql-tab-/);
  });

  it('closeDemoWorkspace keeps session when lessonId does not match active session', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-first-query', 'Demo: First');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-first-query',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });

    await closeDemoWorkspace('gql-other-lesson');
    expect(mockRemoveKey).not.toHaveBeenCalledWith(DEMO_SESSION_KEY);
    expect(mockWriteKey).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY, expect.anything());
    expect(mockRemoveKey).not.toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(mockRemoveKey).not.toHaveBeenCalledWith(DEMO_PRIOR_PAGE_AUTH_KEY);
  });

  it('closeDemoWorkspace swallows persistence errors', async () => {
    mockReadKey.mockRejectedValueOnce(new Error('storage down'));
    await expect(closeDemoWorkspace()).resolves.toBeUndefined();
  });

  it('purgeOrphanDemoTabs returns false when demo session is active', async () => {
    mockReadKey.mockResolvedValueOnce(
      JSON.stringify({ lessonId: 'gql-first-query', priorActiveTabId: 'a', demoTabId: 'b' }),
    );
    await expect(purgeOrphanDemoTabs()).resolves.toBe(false);
  });

  it('purgeOrphanDemoTabs returns false when no demo tabs exist', async () => {
    const user = makeBlankTab();
    seedTabs([user], user.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([user]);
      if (key === `${STORAGE_KEY}_active`) return user.id;
      return null;
    });
    await expect(purgeOrphanDemoTabs()).resolves.toBe(false);
  });

  it('purgeOrphanDemoTabs creates blank tab when storage contained only demo tabs', async () => {
    const demo = makeDemoTab('gql-first-query', 'Demo');
    seedTabs([demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });
    const purged = await purgeOrphanDemoTabs();
    expect(purged).toBe(true);
    const tabsWrite = mockWriteKey.mock.calls.find(([key]) => key === STORAGE_KEY);
    expect(tabsWrite).toBeDefined();
    const saved = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string }[];
    expect(saved).toHaveLength(1);
    expect(saved[0].demoLessonId).toBeUndefined();
  });

  it('filterTabsForPersistence drops demo tabs from other lessons during active session', () => {
    const user = makeBlankTab();
    const activeDemo = makeDemoTab('gql-batch-execution', 'Demo: Batch');
    const otherDemo = makeDemoTab('gql-multi-tab', 'Demo: Multi');
    const session = {
      lessonId: 'gql-batch-execution',
      priorActiveTabId: user.id,
      demoTabId: activeDemo.id,
    };
    expect(filterTabsForPersistence([user, activeDemo, otherDemo], session)).toEqual([
      user,
      activeDemo,
    ]);
  });

  it('userTabsToCloseForLesson clamps tabBudget below 1 to 1', () => {
    expect(userTabsToCloseForLesson(8, 0)).toBe(1);
  });

  it('closeDemoWorkspace restores page auth snapshot and dispatches reload event', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-auth-headers', 'Demo: Auth');
    const priorAuth = JSON.stringify({ type: 'inherit', globalProfileId: 'prof-1' });
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-auth-headers',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
          priorPageAuth: { stored: true, auth: { type: 'inherit', globalProfileId: 'prof-1' } },
        });
      }
      if (key === STORAGE_KEY) {
        return JSON.stringify([user, { ...demo, auth: { type: 'bearer', token: 'lesson' } }]);
      }
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      if (key === AUTH_STORAGE_KEY) return JSON.stringify({ type: 'bearer', token: 'lesson-pollution' });
      return null;
    });

    const authHandler = vi.fn();
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);

    await closeDemoWorkspace('gql-auth-headers');

    expect(mockWriteKey).toHaveBeenCalledWith(AUTH_STORAGE_KEY, priorAuth);
    expect(authHandler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);
  });

  it('closeDemoWorkspace clears page auth when snapshot was stored:false', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-auth-headers', 'Demo: Auth');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-auth-headers',
          priorActiveTabId: user.id,
          demoTabId: demo.id,
          priorPageAuth: { stored: false },
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      if (key === AUTH_STORAGE_KEY) return JSON.stringify({ type: 'bearer', token: 'lesson' });
      return null;
    });

    const authHandler = vi.fn();
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);

    await closeDemoWorkspace('gql-auth-headers');

    expect(mockRemoveKey).toHaveBeenCalledWith(AUTH_STORAGE_KEY);
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_AUTH_KEY);
    expect(authHandler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);
  });

  it('closeDemoWorkspace restores page auth from backup when session is missing', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-auth-headers', 'Demo: Auth');
    const priorAuth = JSON.stringify({ type: 'bearer', token: 'pre-lesson' });
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      if (key === AUTH_STORAGE_KEY) return JSON.stringify({ type: 'bearer', token: 'lesson-pollution' });
      if (key === DEMO_PRIOR_PAGE_AUTH_KEY) {
        return JSON.stringify({ stored: true, auth: { type: 'bearer', token: 'pre-lesson' } });
      }
      return null;
    });

    const authHandler = vi.fn();
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);

    await closeDemoWorkspace('gql-auth-headers');

    expect(mockWriteKey).toHaveBeenCalledWith(AUTH_STORAGE_KEY, priorAuth);
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_AUTH_KEY);
    expect(authHandler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);
  });

  it('prepareDemoWorkspace restores prior page auth when switching lessons without cleanup', async () => {
    const user = makeBlankTab();
    seedTabs([user], user.id);
    const priorAuth = JSON.stringify({ type: 'bearer', token: 'pre-lesson-a' });
    let authStorage: string | null = JSON.stringify({ type: 'bearer', token: 'lesson-a-pollution' });
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-auth-headers',
          priorActiveTabId: user.id,
          demoTabId: 'old-demo',
          priorPageAuth: { stored: true, auth: { type: 'bearer', token: 'pre-lesson-a' } },
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user]);
      if (key === `${STORAGE_KEY}_active`) return user.id;
      if (key === AUTH_STORAGE_KEY) return authStorage;
      return null;
    });
    mockWriteKey.mockImplementation(async (key: string, value: string) => {
      if (key === AUTH_STORAGE_KEY) authStorage = value;
    });

    const authHandler = vi.fn();
    window.addEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);

    const result = await prepareDemoWorkspace('gql-multi-tab', 'Demo: Multi-Tab', 2);
    expect(result.ok).toBe(true);

    expect(mockWriteKey).toHaveBeenCalledWith(AUTH_STORAGE_KEY, priorAuth);
    expect(authHandler).toHaveBeenCalled();

    const sessionWrite = mockWriteKey.mock.calls.find(([k]) => k === DEMO_SESSION_KEY);
    const session = JSON.parse(sessionWrite![1] as string) as {
      lessonId: string;
      priorPageAuth: { stored: boolean; auth: { token: string } };
    };
    expect(session.lessonId).toBe('gql-multi-tab');
    expect(session.priorPageAuth.auth.token).toBe('pre-lesson-a');

    window.removeEventListener(GQL_PAGE_AUTH_RELOAD_EVENT, authHandler);
  });

  it('closeDemoWorkspace removes all demo tabs for a multi-tab lesson', async () => {
    const user = makeBlankTab();
    const demo1 = makeDemoTab('gql-batch-execution', 'Demo: Batch Execution');
    const demo2 = makeDemoTab('gql-batch-execution', 'Demo: Batch Execution — 2');
    seedTabs([user, demo1, demo2], demo2.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-batch-execution',
          priorActiveTabId: user.id,
          demoTabId: demo1.id,
          tabBudget: 2,
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo1, demo2]);
      if (key === `${STORAGE_KEY}_active`) return demo2.id;
      return null;
    });

    await closeDemoWorkspace('gql-batch-execution');
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string }[];
    expect(savedTabs).toHaveLength(1);
    expect(savedTabs[0]?.demoLessonId).toBeUndefined();
  });

  it('closeDemoWorkspace restores page endpoint from backup when session is missing', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-first-query', 'Demo: First Query');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) return null;
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      if (key === ENDPOINT_STORAGE_KEY) return 'https://lesson-pollution.example.com/graphql';
      if (key === DEMO_PRIOR_PAGE_ENDPOINT_KEY) return 'https://pre-lesson.example.com/graphql';
      return null;
    });

    const endpointHandler = vi.fn();
    window.addEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, endpointHandler);

    await closeDemoWorkspace('gql-first-query');

    expect(mockWriteKey).toHaveBeenCalledWith(ENDPOINT_STORAGE_KEY, 'https://pre-lesson.example.com/graphql');
    expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_PRIOR_PAGE_ENDPOINT_KEY);
    expect(endpointHandler).toHaveBeenCalled();
    window.removeEventListener(GQL_PAGE_ENDPOINT_RELOAD_EVENT, endpointHandler);
  });

  describe('when DEMO_HUB_ENABLED is false', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_ENABLE_DEMO_HUB', 'false');
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('prepareDemoWorkspace returns storage_unavailable without writing', async () => {
      const { prepareDemoWorkspace } = await import('./gqlDemoWorkspace');
      const user = makeBlankTab();
      seedTabs([user], user.id);
      const result = await prepareDemoWorkspace('gql-first-query', 'Demo: Test');
      expect(result).toEqual({ ok: false, reason: 'storage_unavailable' });
      expect(mockWriteKey).not.toHaveBeenCalledWith(DEMO_SESSION_KEY, expect.anything());
    });

    it('closeDemoWorkspace still cleans up when demo hub is disabled', async () => {
      const { closeDemoWorkspace } = await import('./gqlDemoWorkspace');
      const user = makeBlankTab();
      const demo = makeDemoTab('gql-first-query', 'Demo');
      seedTabs([user, demo], demo.id);
      mockReadKey.mockImplementation(async (key: string) => {
        if (key === DEMO_SESSION_KEY) {
          return JSON.stringify({
            lessonId: 'gql-first-query',
            priorActiveTabId: user.id,
            demoTabId: demo.id,
          });
        }
        if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
        if (key === `${STORAGE_KEY}_active`) return demo.id;
        return null;
      });
      await closeDemoWorkspace('gql-first-query');
      expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_SESSION_KEY);
      const tabsWrite = mockWriteKey.mock.calls.find(([key]) => key === STORAGE_KEY);
      expect(tabsWrite).toBeDefined();
      const saved = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string }[];
      expect(saved.every((t) => !t.demoLessonId)).toBe(true);
    });

    it('patchDemoTabConnection returns false', async () => {
      const { patchDemoTabConnection } = await import('./gqlDemoWorkspace');
      mockReadKey.mockResolvedValueOnce(
        JSON.stringify({ lessonId: 'gql-https-tls', priorActiveTabId: 'a', demoTabId: 'b' }),
      );
      await expect(patchDemoTabConnection({ endpoint: 'http://localhost:4010/graphql' })).resolves.toBe(false);
    });

    it('purgeOrphanDemoTabs clears stale session and demo tabs when demo disabled', async () => {
      const { purgeOrphanDemoTabs } = await import('./gqlDemoWorkspace');
      const user = makeBlankTab();
      const demo = makeDemoTab('gql-first-query', 'Demo');
      seedTabs([user, demo], demo.id);
      mockReadKey.mockImplementation(async (key: string) => {
        if (key === DEMO_SESSION_KEY) {
          return JSON.stringify({
            lessonId: 'gql-first-query',
            priorActiveTabId: user.id,
            demoTabId: demo.id,
          });
        }
        if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
        if (key === `${STORAGE_KEY}_active`) return demo.id;
        return null;
      });
      const purged = await purgeOrphanDemoTabs();
      expect(purged).toBe(true);
      expect(mockRemoveKey).toHaveBeenCalledWith(DEMO_SESSION_KEY);
      const tabsWrite = mockWriteKey.mock.calls.find(([key]) => key === STORAGE_KEY);
      expect(tabsWrite).toBeDefined();
      expect(tabsWrite![1] as string).not.toContain('demoLessonId');
    });

    it('purgeOrphanDemoTabs still removes orphan demo tabs when session missing', async () => {
      const { purgeOrphanDemoTabs } = await import('./gqlDemoWorkspace');
      const user = makeBlankTab();
      const demo = makeDemoTab('gql-first-query', 'Demo');
      seedTabs([user, demo], user.id);
      mockReadKey.mockImplementation(async (key: string) => {
        if (key === DEMO_SESSION_KEY) return null;
        if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
        if (key === `${STORAGE_KEY}_active`) return user.id;
        return null;
      });
      const purged = await purgeOrphanDemoTabs();
      expect(purged).toBe(true);
      expect(mockWriteKey).toHaveBeenCalledWith(STORAGE_KEY, expect.not.stringContaining('demoLessonId'));
    });
  });
});
