/**
 * Demo Hub ↔ GraphQL Studio workspace isolation (§11.0).
 * Persists demo tabs separately from user tabs; reloads Studio via custom event.
 */
import { readKey, writeKey, removeKey } from '../../../shared/utils/storage';
import {
  type GqlStudioTab,
  MAX_TABS,
  MAX_USER_TABS,
  makeBlankTab,
  advanceSeqPastRestoredIds,
  loadActiveTabId,
  loadTabs,
  makeDemoTab,
  saveTabs,
  countUserTabs,
} from './tabPersistence';

export { MAX_USER_TABS };
export { MAX_TABS } from './tabPersistence';

export const DEMO_SESSION_KEY = 'gql_demo_session_v1';
export const GQL_TABS_RELOAD_EVENT = 'gql-tabs-reload';

export interface GqlDemoSession {
  lessonId: string;
  priorActiveTabId: string;
  demoTabId: string;
  /** Slots reserved for this lesson (default 1). */
  tabBudget?: number;
  /** Primary demo tab label for follow-on tabs. */
  displayName?: string;
}

export interface PrepareDemoWorkspaceResult {
  ok: boolean;
  demoTabId?: string;
  reason?: 'max_tabs' | 'storage_unavailable';
}

export function dispatchGqlTabsReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_TABS_RELOAD_EVENT));
  }
}

export async function loadDemoSession(): Promise<GqlDemoSession | null> {
  try {
    const raw = await readKey(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GqlDemoSession;
    if (!parsed?.lessonId || !parsed.demoTabId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveDemoSession(session: GqlDemoSession | null): Promise<void> {
  try {
    if (session) {
      await writeKey(DEMO_SESSION_KEY, JSON.stringify(session));
    } else {
      await removeKey(DEMO_SESSION_KEY);
    }
  } catch {
    /* quota / unavailable */
  }
}

function stripDemoTabs(tabs: GqlStudioTab[], lessonId?: string): GqlStudioTab[] {
  return tabs.filter((t) => {
    if (!t.demoLessonId) return true;
    if (!lessonId) return false;
    return t.demoLessonId !== lessonId;
  });
}

function pickRestoreActiveId(userTabs: GqlStudioTab[], priorId: string | undefined): string {
  if (priorId && userTabs.some((t) => t.id === priorId)) return priorId;
  return userTabs[0]?.id ?? '';
}

/** Strip demo tabs from a snapshot before persisting when no demo session is active. */
export function filterTabsForPersistence(
  tabs: GqlStudioTab[],
  session: GqlDemoSession | null,
): GqlStudioTab[] {
  if (session) {
    return tabs.filter((t) => !t.demoLessonId || t.demoLessonId === session.lessonId);
  }
  return tabs.filter((t) => !t.demoLessonId);
}

export function pickPersistedActiveTabId(
  tabs: GqlStudioTab[],
  activeId: string,
): string {
  if (tabs.some((t) => t.id === activeId)) return activeId;
  return tabs[0]?.id ?? activeId;
}

/**
 * Remove demo tabs when no active demo session exists (orphan sweep on Studio mount).
 */
export async function purgeOrphanDemoTabs(): Promise<boolean> {
  const session = await loadDemoSession();
  if (session) return false;

  const tabs = await loadTabs();
  const userTabs = tabs.filter((t) => !t.demoLessonId);
  if (userTabs.length === tabs.length) return false;

  const activeId = await loadActiveTabId();
  const nextActive = pickRestoreActiveId(userTabs, activeId);
  await saveTabs(userTabs.length > 0 ? userTabs : tabs.slice(0, 1), nextActive);
  return true;
}

/**
 * Create demo tab(s) for `lessonId`, preserving user tabs and page endpoint.
 * Creates one demo tab; additional slots (tabBudget > 1) are filled via Studio +.
 */
export async function prepareDemoWorkspace(
  lessonId: string,
  label: string,
  tabBudget = 1,
): Promise<PrepareDemoWorkspaceResult> {
  try {
    const budget = Math.max(1, tabBudget);
    let tabs = await loadTabs();
    const priorActiveId = await loadActiveTabId();

    tabs = stripDemoTabs(tabs);
    const userTabs = tabs.filter((t) => !t.demoLessonId);

    if (userTabs.length > MAX_TABS - budget) {
      return { ok: false, reason: 'max_tabs' };
    }

    if (userTabs.length + 1 > MAX_TABS) {
      return { ok: false, reason: 'max_tabs' };
    }

    const demoTab = makeDemoTab(lessonId, label);
    const nextTabs = userTabs.length > 0 ? [...userTabs, demoTab] : [makeBlankTab(), demoTab];
    const priorUserActive = userTabs.some((t) => t.id === priorActiveId)
      ? priorActiveId
      : (userTabs[0]?.id ?? nextTabs[0].id);

    await saveDemoSession({
      lessonId,
      priorActiveTabId: priorUserActive,
      demoTabId: demoTab.id,
      tabBudget: budget,
      displayName: label,
    });
    advanceSeqPastRestoredIds(nextTabs);
    await saveTabs(nextTabs, demoTab.id);
    return { ok: true, demoTabId: demoTab.id };
  } catch {
    return { ok: false, reason: 'storage_unavailable' };
  }
}

/** Close demo tab(s) and restore the user's prior active tab. */
export async function closeDemoWorkspace(lessonId?: string): Promise<void> {
  try {
    const session = await loadDemoSession();
    let tabs = await loadTabs();
    const activeId = await loadActiveTabId();

    tabs = stripDemoTabs(tabs, lessonId);
    const userTabs = tabs.filter((t) => !t.demoLessonId);

    if (userTabs.length === 0) {
      const blank = makeBlankTab();
      await saveTabs([blank], blank.id);
    } else {
      const restoreId = pickRestoreActiveId(
        userTabs,
        session?.priorActiveTabId ?? activeId,
      );
      await saveTabs(userTabs, restoreId);
    }

    if (!lessonId || session?.lessonId === lessonId) {
      await saveDemoSession(null);
    }
  } catch {
    /* silent */
  }
}

/** Count user tabs from storage (for tab-capacity gate). */
export async function countUserTabsInStorage(): Promise<number> {
  const tabs = await loadTabs();
  return countUserTabs(tabs);
}

/** How many user tabs must be closed before a lesson with `tabBudget` can start. */
export function userTabsToCloseForLesson(
  userTabCount: number,
  tabBudget = 1,
): number {
  const budget = Math.max(1, tabBudget);
  const maxUserForLesson = MAX_TABS - budget;
  return Math.max(0, userTabCount - maxUserForLesson);
}

export function isGraphqlStudioLesson(lesson: { initialTab?: string; category?: string }): boolean {
  return lesson.initialTab === 'graphql-studio' || lesson.category === 'graphql';
}
