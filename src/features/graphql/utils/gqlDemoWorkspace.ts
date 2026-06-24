/**
 * Demo Hub ↔ GraphQL Studio workspace isolation (§11.0).
 * Persists demo tabs separately from user tabs; reloads Studio via custom event.
 */
import { DEMO_HUB_ENABLED } from '../../../config/features';
import { readKey, writeKey, removeKey } from '../../../shared/utils/storage';
import {
  type GqlStudioTab,
  type GqlPageAuthSnapshot,
  MAX_TABS,
  MAX_USER_TABS,
  makeBlankTab,
  advanceSeqPastRestoredIds,
  loadActiveTabId,
  loadTabs,
  makeDemoTab,
  saveTabs,
  countUserTabs,
  capturePageAuthSnapshot,
  restorePageAuthSnapshot,
  stripDemoTabAuthOverride,
  saveDemoPriorPageAuthBackup,
  loadDemoPriorPageAuthBackup,
  clearDemoPriorPageAuthBackup,
  capturePageEndpointSnapshot,
  restorePageEndpointSnapshot,
  saveDemoPriorPageEndpointBackup,
  loadDemoPriorPageEndpointBackup,
  clearDemoPriorPageEndpointBackup,
  normalizePageAuthSnapshot,
} from './tabPersistence';

export { MAX_USER_TABS };
export { MAX_TABS } from './tabPersistence';

export const DEMO_SESSION_KEY = 'gql_demo_session_v1';
export const GQL_TABS_RELOAD_EVENT = 'gql-tabs-reload';
/** Fired after demo cleanup restores page-level auth (Phase 6H Slice 6). */
export const GQL_PAGE_AUTH_RELOAD_EVENT = 'gql-page-auth-reload';
/** Fired after demo cleanup restores page-level endpoint (§11.0). */
export const GQL_PAGE_ENDPOINT_RELOAD_EVENT = 'gql-page-endpoint-reload';

export interface GqlDemoSession {
  lessonId: string;
  priorActiveTabId: string;
  demoTabId: string;
  /** Slots reserved for this lesson (default 1). */
  tabBudget?: number;
  /** Primary demo tab label for follow-on tabs. */
  displayName?: string;
  /** Page auth before the lesson started — restored on close. */
  priorPageAuth?: GqlPageAuthSnapshot;
  /** Page endpoint (`gql_endpoint_v1`) before the lesson — restored on close (§11.0). */
  priorPageEndpoint?: string | null;
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

export function dispatchGqlPageAuthReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_PAGE_AUTH_RELOAD_EVENT));
  }
}

export function dispatchGqlPageEndpointReload(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GQL_PAGE_ENDPOINT_RELOAD_EVENT));
  }
}

export type DemoTabConnectionPatch = Pick<
  GqlStudioTab,
  'endpoint' | 'skipTlsVerify' | 'tlsCaCert' | 'tlsClientCert' | 'tlsClientKey'
>;

/**
 * Persist connection fields on the active demo tab (§11.0).
 * Used when DOM fills are racy (tab reload / wrong active tab) or when an explicit
 * per-tab override must survive even if it matches the page default.
 */
export async function patchDemoTabConnection(patch: DemoTabConnectionPatch): Promise<boolean> {
  if (!DEMO_HUB_ENABLED) return false;
  const session = await loadDemoSession();
  if (!session?.demoTabId) return false;
  const tabs = await loadTabs();
  if (!tabs.some((t) => t.id === session.demoTabId)) return false;
  const nextTabs = tabs.map((t) => {
    if (t.id !== session.demoTabId) return t;
    const next: GqlStudioTab = { ...t, ...patch, unsavedChanges: true };
    if (patch.skipTlsVerify === undefined) delete next.skipTlsVerify;
    if (patch.tlsCaCert === undefined) delete next.tlsCaCert;
    if (patch.tlsClientCert === undefined) delete next.tlsClientCert;
    if (patch.tlsClientKey === undefined) delete next.tlsClientKey;
    return next;
  });
  await saveTabs(nextTabs, session.demoTabId);
  dispatchGqlTabsReload();
  return true;
}

export async function loadDemoSession(): Promise<GqlDemoSession | null> {
  try {
    const raw = await readKey(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GqlDemoSession;
    if (!parsed?.lessonId || !parsed.demoTabId) return null;
    if (parsed.priorPageAuth !== undefined) {
      const normalized = normalizePageAuthSnapshot(parsed.priorPageAuth);
      if (normalized === undefined) {
        delete parsed.priorPageAuth;
      } else {
        parsed.priorPageAuth = normalized;
      }
    }
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
  // Active demo session is valid only while Demo Hub is enabled.
  if (session && DEMO_HUB_ENABLED) return false;

  const tabs = await loadTabs();
  const userTabs = tabs.filter((t) => !t.demoLessonId);
  const hadDemoTabs = userTabs.length < tabs.length;

  if (!hadDemoTabs && !session) return false;

  const authSnapshot = session?.priorPageAuth !== undefined
    ? session.priorPageAuth
    : await loadDemoPriorPageAuthBackup();
  if (authSnapshot !== undefined) {
    await restorePageAuthSnapshot(authSnapshot);
    dispatchGqlPageAuthReload();
    await clearDemoPriorPageAuthBackup();
  }

  const endpointSnapshot = session?.priorPageEndpoint !== undefined
    ? session.priorPageEndpoint
    : await loadDemoPriorPageEndpointBackup();
  if (endpointSnapshot !== undefined) {
    await restorePageEndpointSnapshot(endpointSnapshot);
    dispatchGqlPageEndpointReload();
    await clearDemoPriorPageEndpointBackup();
  }

  if (hadDemoTabs) {
    const activeId = await loadActiveTabId();
    if (userTabs.length > 0) {
      const nextActive = pickRestoreActiveId(userTabs, activeId);
      await saveTabs(userTabs, nextActive);
    } else {
      const blank = makeBlankTab();
      await saveTabs([blank], blank.id);
    }
  }

  if (session) {
    await saveDemoSession(null);
  }

  return hadDemoTabs || !!session;
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
  if (!DEMO_HUB_ENABLED) {
    return { ok: false, reason: 'storage_unavailable' };
  }
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
    if (lessonId === 'gql-https-tls') {
      // Step 1 must show plain HTTP even when the page default is still HTTPS from a prior run.
      demoTab.endpoint = 'http://localhost:4010/graphql';
    }
    const nextTabs = userTabs.length > 0 ? [...userTabs, demoTab] : [makeBlankTab(), demoTab];
    const priorUserActive = userTabs.some((t) => t.id === priorActiveId)
      ? priorActiveId
      : (userTabs[0]?.id ?? nextTabs[0].id);

    const existingSession = await loadDemoSession();
    if (
      existingSession?.priorPageAuth !== undefined
      && existingSession.lessonId !== lessonId
    ) {
      await restorePageAuthSnapshot(existingSession.priorPageAuth);
      dispatchGqlPageAuthReload();
    }
    const priorPageAuth = existingSession?.lessonId === lessonId && existingSession.priorPageAuth !== undefined
      ? existingSession.priorPageAuth
      : await capturePageAuthSnapshot();

    const priorPageEndpoint = existingSession?.lessonId === lessonId && existingSession.priorPageEndpoint !== undefined
      ? existingSession.priorPageEndpoint
      : await capturePageEndpointSnapshot();

    await saveDemoPriorPageAuthBackup(priorPageAuth);
    await saveDemoPriorPageEndpointBackup(priorPageEndpoint);
    await saveDemoSession({
      lessonId,
      priorActiveTabId: priorUserActive,
      demoTabId: demoTab.id,
      tabBudget: budget,
      displayName: label,
      priorPageAuth,
      priorPageEndpoint,
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
    const shouldCloseSession = !lessonId || session?.lessonId === lessonId;
    const hadDemoTabsToRemove = tabs.some(
      (t) => t.demoLessonId && (!lessonId || t.demoLessonId === lessonId),
    );

    tabs = tabs.map((t) => {
      if (!t.demoLessonId) return t;
      const willRemove = !lessonId || t.demoLessonId === lessonId;
      return willRemove ? stripDemoTabAuthOverride(t) : t;
    });

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

    const shouldRestorePageAuth =
      hadDemoTabsToRemove && (shouldCloseSession || !session);

    if (shouldRestorePageAuth) {
      const snapshot = session?.priorPageAuth !== undefined
        ? session.priorPageAuth
        : await loadDemoPriorPageAuthBackup();
      if (snapshot !== undefined) {
        await restorePageAuthSnapshot(snapshot);
        dispatchGqlPageAuthReload();
      }
      const endpointSnapshot = session?.priorPageEndpoint !== undefined
        ? session.priorPageEndpoint
        : await loadDemoPriorPageEndpointBackup();
      if (endpointSnapshot !== undefined) {
        await restorePageEndpointSnapshot(endpointSnapshot);
        dispatchGqlPageEndpointReload();
      }
    }

    if (shouldCloseSession || (!session && hadDemoTabsToRemove)) {
      await clearDemoPriorPageAuthBackup();
      await clearDemoPriorPageEndpointBackup();
    }

    if (shouldCloseSession) {
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
