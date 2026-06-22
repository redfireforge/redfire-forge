/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  filterTabsForPersistence,
  isGraphqlStudioLesson,
  loadDemoSession,
  pickPersistedActiveTabId,
  prepareDemoWorkspace,
  purgeOrphanDemoTabs,
  userTabsToCloseForLesson,
  DEMO_SESSION_KEY,
  GQL_TABS_RELOAD_EVENT,
} from './gqlDemoWorkspace';
import { STORAGE_KEY, makeBlankTab, makeDemoTab } from './tabPersistence';

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
    const tabsWrite = mockWriteKey.mock.calls.find(([k]) => k === STORAGE_KEY);
    expect(tabsWrite).toBeTruthy();
    const savedTabs = JSON.parse(tabsWrite![1] as string) as { demoLessonId?: string }[];
    expect(savedTabs).toHaveLength(2);
    expect(savedTabs.filter((t) => t.demoLessonId === 'gql-first-query')).toHaveLength(1);
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
});
