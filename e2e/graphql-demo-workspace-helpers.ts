/**
 * §11.0 — GraphQL Demo Hub workspace isolation E2E helpers.
 *
 * Seeds a user-owned GraphQL Studio workspace (tabs + page endpoint) and
 * reads persistence snapshots to verify demo lessons never mutate user state.
 */
import { expect, type Page } from '@playwright/test';
import { GQL_STUDIO_URL } from './graphql-helpers';

export const USER_WORKSPACE_ENDPOINT = 'https://user-custom.example.com/graphql';
export const USER_WORKSPACE_TAB_ID = 'user-workspace-primary';
export const USER_WORKSPACE_TAB_LABEL = 'My Workspace Tab';

export interface GqlWorkspaceSnapshot {
  userTabs: Array<{ id: string; label: string; endpoint?: string; query?: string; demoLessonId?: string }>;
  demoTabs: Array<{ id: string; label: string; demoLessonId?: string }>;
  activeId: string | null;
  endpoint: string | null;
  demoSession: { lessonId: string; demoTabId: string } | null;
}

/** Seed user tabs + page endpoint before the first navigation (§11.0 acceptance). */
export async function seedGqlUserWorkspace(
  page: Page,
  opts: {
    endpoint?: string;
    primaryTabLabel?: string;
    primaryTabId?: string;
    userTabCount?: number;
  } = {},
): Promise<void> {
  const endpoint = opts.endpoint ?? USER_WORKSPACE_ENDPOINT;
  const primaryTabLabel = opts.primaryTabLabel ?? USER_WORKSPACE_TAB_LABEL;
  const primaryTabId = opts.primaryTabId ?? USER_WORKSPACE_TAB_ID;
  const userTabCount = opts.userTabCount ?? 1;

  await page.addInitScript(
    ({ endpoint: ep, primaryTabLabel: label, primaryTabId: primaryId, userTabCount: count }) => {
      const tabs = [];
      for (let i = 0; i < count; i++) {
        const id = i === 0 ? primaryId : `user-tab-${i + 1}`;
        const tabLabel = i === 0 ? label : `User Tab ${i + 1}`;
        tabs.push({
          id,
          label: tabLabel,
          labelManual: true,
          modelUri: `inmemory://graphql/${id}`,
          query: 'query UserWorkspace { __typename }',
          variables: '{\n  \n}',
          headers: [],
          operationType: 'query',
          unsavedChanges: false,
        });
      }
      localStorage.setItem('gql_endpoint_v1', ep);
      localStorage.setItem('gql_tabs_v1', JSON.stringify(tabs));
      localStorage.setItem('gql_tabs_v1_active', tabs[0].id);
      localStorage.removeItem('gql_demo_session_v1');
      localStorage.removeItem('gql_demo_prior_page_auth_v1');
    },
    { endpoint, primaryTabLabel, primaryTabId, userTabCount },
  );
}

export async function readGqlWorkspaceSnapshot(page: Page): Promise<GqlWorkspaceSnapshot> {
  return page.evaluate(() => {
    const tabsRaw = localStorage.getItem('gql_tabs_v1');
    const activeRaw = localStorage.getItem('gql_tabs_v1_active');
    const endpoint = localStorage.getItem('gql_endpoint_v1');
    const demoRaw = localStorage.getItem('gql_demo_session_v1');
    const tabs = tabsRaw ? (JSON.parse(tabsRaw) as Array<Record<string, unknown>>) : [];
    let demoSession: { lessonId: string; demoTabId: string } | null = null;
    if (demoRaw) {
      try {
        const parsed = JSON.parse(demoRaw) as { lessonId?: string; demoTabId?: string };
        if (parsed.lessonId && parsed.demoTabId) {
          demoSession = { lessonId: parsed.lessonId, demoTabId: parsed.demoTabId };
        }
      } catch {
        demoSession = null;
      }
    }
    const userTabs = tabs.filter((t) => !t.demoLessonId);
    const demoTabs = tabs.filter((t) => t.demoLessonId);
    return {
      userTabs: userTabs as GqlWorkspaceSnapshot['userTabs'],
      demoTabs: demoTabs as GqlWorkspaceSnapshot['demoTabs'],
      activeId: activeRaw,
      endpoint,
      demoSession,
    };
  });
}

export async function navigateToGraphqlStudio(page: Page): Promise<void> {
  await page.goto(`http://localhost:5173${GQL_STUDIO_URL}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="gql-studio-page"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="gql-tab-bar"]')).toBeVisible({ timeout: 15_000 });
}

/** Open lesson concept view without starting the demo. */
export async function openGqlLessonConcept(page: Page, lessonNameFragment: string): Promise<void> {
  const { openDemoHub, selectProtocolsDomain, selectCategory, openLesson } = await import('./demo-player-helpers');
  await openDemoHub(page);
  await selectProtocolsDomain(page);
  await selectCategory(page, 'GraphQL');
  await openLesson(page, lessonNameFragment);
}

export async function goBackToLessonList(page: Page): Promise<void> {
  await page.locator('.demo-hub-breadcrumb-item').filter({ hasText: /Protocols/i }).click();
  await page.waitForSelector('.demo-lesson-list', { timeout: 15_000 });
}

/** Remove one user tab from localStorage (simulates closing a tab in Studio). */
export async function closeOneUserTabInStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const raw = localStorage.getItem('gql_tabs_v1');
    if (!raw) return;
    const tabs = JSON.parse(raw) as Array<{ id: string; demoLessonId?: string }>;
    const userTabs = tabs.filter((t) => !t.demoLessonId);
    if (userTabs.length === 0) return;
    const removeId = userTabs[userTabs.length - 1].id;
    const next = tabs.filter((t) => t.id !== removeId);
    localStorage.setItem('gql_tabs_v1', JSON.stringify(next));
    localStorage.setItem('gql_tabs_v1_active', next[0]?.id ?? '');
  });
}

export function expectUserWorkspaceIntact(
  snapshot: GqlWorkspaceSnapshot,
  opts: {
    endpoint?: string;
    primaryTabId?: string;
    primaryTabLabel?: string;
    userTabCount?: number;
  } = {},
): void {
  const endpoint = opts.endpoint ?? USER_WORKSPACE_ENDPOINT;
  const primaryTabId = opts.primaryTabId ?? USER_WORKSPACE_TAB_ID;
  const primaryTabLabel = opts.primaryTabLabel ?? USER_WORKSPACE_TAB_LABEL;
  const userTabCount = opts.userTabCount ?? 1;

  expect(snapshot.demoTabs).toHaveLength(0);
  expect(snapshot.demoSession).toBeNull();
  expect(snapshot.endpoint).toBe(endpoint);
  expect(snapshot.userTabs).toHaveLength(userTabCount);

  const primary = snapshot.userTabs.find((t) => t.id === primaryTabId);
  expect(primary).toBeDefined();
  expect(primary!.label).toBe(primaryTabLabel);
  expect(snapshot.activeId).toBe(primaryTabId);
}

/** Wait until demo lesson cleanup finished (async after exit click). */
export async function waitForGqlDemoCleanup(page: Page, timeout = 15_000): Promise<void> {
  await expect
    .poll(async () => {
      const snapshot = await readGqlWorkspaceSnapshot(page);
      return snapshot.demoTabs.length === 0 && snapshot.demoSession === null;
    }, { timeout })
    .toBe(true);
}

/** Wait for a demo-tagged tab for the given lesson id in the tab bar. */
export async function waitForGqlDemoTab(page: Page, lessonId: string, timeout = 15_000): Promise<void> {
  await expect(
    page.locator(`[data-testid="gql-tab-bar"] [role="tab"][data-demo-lesson="${lessonId}"]`),
  ).toHaveCount(1, { timeout });
}
