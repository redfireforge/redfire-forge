/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../config/features', () => ({ DEMO_HUB_ENABLED: true }));
vi.mock('../../../shared/utils/storage', () => ({
  readKey: vi.fn(async () => null),
  writeKey: vi.fn(async () => {}),
  removeKey: vi.fn(async () => {}),
}));
vi.mock('../../../shared/utils/platform', () => ({ isTauri: vi.fn(() => true) }));
vi.mock('./monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql-vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

import {
  dispatchGqlTabsReload,
  dispatchGqlPageAuthReload,
  dispatchGqlPageEndpointReload,
  isGraphqlStudioLesson,
  patchDemoTabConnection,
  prepareDemoWorkspace,
  filterTabsForPersistence,
  pickPersistedActiveTabId,
  loadDemoSession,
  userTabsToCloseForLesson,
  DEMO_SESSION_KEY,
} from './gqlDemoWorkspace';
import { makeBlankTab, makeDemoTab, STORAGE_KEY } from './tabPersistence';
import { readKey, writeKey } from '@shared/utils/storage';

const mockReadKey = vi.mocked(readKey);
const mockWriteKey = vi.mocked(writeKey);

function seedTabs(tabs: ReturnType<typeof makeBlankTab>[], activeId: string): void {
  mockReadKey.mockImplementation(async (key: string) => {
    if (key === STORAGE_KEY) return JSON.stringify(tabs);
    if (key === `${STORAGE_KEY}_active`) return activeId;
    return null;
  });
}

describe('gqlDemoWorkspace — coverage gaps', () => {
  beforeEach(() => {
    resetAllMocks();
    mockWriteKey.mockResolvedValue(undefined);
  });

  it('dispatch helpers no-op when window is undefined', () => {
    const saved = globalThis.window;
    // @ts-expect-error SSR
    delete globalThis.window;
    expect(() => dispatchGqlTabsReload()).not.toThrow();
    expect(() => dispatchGqlPageAuthReload()).not.toThrow();
    expect(() => dispatchGqlPageEndpointReload()).not.toThrow();
    globalThis.window = saved;
  });

  it('isGraphqlStudioLesson returns false for non-gql lessons', () => {
    expect(isGraphqlStudioLesson({ initialTab: 'workflow', category: 'ws' })).toBe(false);
    expect(isGraphqlStudioLesson({ initialTab: 'graphql-studio', category: 'graphql' })).toBe(true);
  });

  it('patchDemoTabConnection deletes endpoint override when patch sets undefined', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-1', 'Demo');
    demo.endpoint = 'https://old.example/graphql';
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({ lessonId: 'gql-1', priorActiveTabId: user.id, demoTabId: demo.id });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });
    const ok = await patchDemoTabConnection({ endpoint: undefined });
    expect(ok).toBe(true);
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const saved = JSON.parse(String(tabsWrite?.[1])) as Array<{ id: string; endpoint?: string }>;
    const savedDemo = saved.find((t) => t.id === demo.id);
    expect(savedDemo?.endpoint).toBeUndefined();
  });

  it('prepareDemoWorkspace restores prior page auth when switching lessons mid-session', async () => {
    const user = makeBlankTab();
    seedTabs([user], user.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({
          lessonId: 'gql-old',
          priorActiveTabId: user.id,
          demoTabId: 'old-demo',
          priorPageAuth: { type: 'bearer', token: 'keep' },
        });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user]);
      if (key === `${STORAGE_KEY}_active`) return user.id;
      return null;
    });
    const result = await prepareDemoWorkspace('gql-new', 'New lesson');
    expect(result.ok).toBe(true);
    expect(mockWriteKey).toHaveBeenCalled();
  });

  it('loadDemoSession returns null for invalid JSON', async () => {
    mockReadKey.mockResolvedValue('{not-json');
    await expect(loadDemoSession()).resolves.toBeNull();
  });

  it('filterTabsForPersistence drops foreign demo tabs during active session', () => {
    const user = makeBlankTab();
    const activeDemo = { ...makeDemoTab('gql-a', 'A'), demoLessonId: 'gql-a' };
    const foreignDemo = { ...makeDemoTab('gql-b', 'B'), demoLessonId: 'gql-b' };
    const session = { lessonId: 'gql-a', priorActiveTabId: user.id, demoTabId: activeDemo.id };
    expect(filterTabsForPersistence([user, activeDemo, foreignDemo], session)).toEqual([user, activeDemo]);
  });

  it('pickPersistedActiveTabId keeps orphan activeId when tabs list is empty', () => {
    expect(pickPersistedActiveTabId([], 'missing')).toBe('missing');
  });

  it('prepareDemoWorkspace returns max_tabs when user tab budget exceeded', async () => {
    const users = Array.from({ length: 8 }, (_, i) => makeBlankTab(`u${i}`));
    seedTabs(users, users[0]!.id);
    const result = await prepareDemoWorkspace('gql-1', 'Lesson');
    expect(result).toEqual({ ok: false, reason: 'max_tabs' });
  });

  it('prepareDemoWorkspace sets plain HTTP endpoint for gql-https-tls lesson', async () => {
    seedTabs([], '');
    mockReadKey.mockResolvedValue(null);
    const result = await prepareDemoWorkspace('gql-https-tls', 'TLS');
    expect(result.ok).toBe(true);
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    const saved = JSON.parse(String(tabsWrite?.[1])) as Array<{ demoLessonId?: string; endpoint?: string }>;
    const demo = saved.find((t) => t.demoLessonId === 'gql-https-tls');
    expect(demo?.endpoint).toBe('http://localhost:4010/graphql');
  });

  it('patchDemoTabConnectionById patches matching demo tab', async () => {
    const user = makeBlankTab();
    const demo = makeDemoTab('gql-x', 'Demo');
    seedTabs([user, demo], demo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({ lessonId: 'gql-x', priorActiveTabId: user.id, demoTabId: demo.id });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, demo]);
      if (key === `${STORAGE_KEY}_active`) return demo.id;
      return null;
    });
    const { patchDemoTabConnectionById } = await import('./gqlDemoWorkspace');
    const ok = await patchDemoTabConnectionById(demo.id, { skipTlsVerify: true });
    expect(ok).toBe(true);
  });

  it('userTabsToCloseForLesson returns slots to free', () => {
    expect(userTabsToCloseForLesson(8, 2)).toBe(2);
    expect(userTabsToCloseForLesson(3, 1)).toBe(0);
  });

  it('patchDemoTabConnectionById returns false when demo session is missing', async () => {
    mockReadKey.mockResolvedValue(null);
    const { patchDemoTabConnectionById } = await import('./gqlDemoWorkspace');
    expect(await patchDemoTabConnectionById('tab-1', { endpoint: 'http://x/graphql' })).toBe(false);
  });

  it('patchDemoTabConnectionById returns false when tab is not part of active lesson', async () => {
    const user = makeBlankTab();
    const foreignDemo = { ...makeDemoTab('gql-other', 'Other'), demoLessonId: 'gql-other' };
    seedTabs([user, foreignDemo], foreignDemo.id);
    mockReadKey.mockImplementation(async (key: string) => {
      if (key === DEMO_SESSION_KEY) {
        return JSON.stringify({ lessonId: 'gql-active', priorActiveTabId: user.id, demoTabId: 'demo-x' });
      }
      if (key === STORAGE_KEY) return JSON.stringify([user, foreignDemo]);
      if (key === `${STORAGE_KEY}_active`) return foreignDemo.id;
      return null;
    });
    const { patchDemoTabConnectionById } = await import('./gqlDemoWorkspace');
    expect(await patchDemoTabConnectionById(foreignDemo.id, { endpoint: 'http://x/graphql' })).toBe(false);
  });

  it('loadDemoSession strips invalid priorPageAuth snapshot', async () => {
    mockReadKey.mockResolvedValue(JSON.stringify({
      lessonId: 'gql-1',
      demoTabId: 'demo-1',
      priorPageAuth: { type: 'bogus' },
    }));
    const session = await loadDemoSession();
    expect(session?.priorPageAuth).toBeUndefined();
  });
});

describe('gqlDemoWorkspace — demo hub disabled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('../../../config/features', () => ({ DEMO_HUB_ENABLED: false }));
  });

  afterEach(() => {
    vi.doUnmock('../../../config/features');
    vi.resetModules();
  });

  it('patchDemoTabConnectionById returns false when demo hub is disabled', async () => {
    const mod = await import('./gqlDemoWorkspace');
    expect(await mod.patchDemoTabConnectionById('tab-1', { endpoint: 'http://x/graphql' })).toBe(false);
  });
});
