/**
 * §11.0 — Demo workspace isolation acceptance E2E
 *
 * Proves GraphQL demo lessons use reserved demo tab(s) and never mutate the
 * user's free-form GraphQL Studio workspace (tabs 1–7 + page endpoint).
 *
 * Run via:
 *   npm run test:e2e:demo:gql110
 *
 * Requires Docker GraphQL on port 4010 for GQL-1 start:
 *   cd docker/graphql && docker compose up -d
 */

import { test, expect } from '@playwright/test';
import {
  advanceSteps,
  exitLesson,
  startLesson,
  waitForPrerequisiteGateUp,
  waitForReadingPhase,
} from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  closeOneUserTabInStorage,
  expectUserWorkspaceIntact,
  goBackToLessonList,
  navigateToGraphqlStudio,
  openGqlLessonConcept,
  readGqlWorkspaceSnapshot,
  seedGqlUserWorkspace,
  USER_WORKSPACE_TAB_ID,
  USER_WORKSPACE_TAB_LABEL,
  waitForGqlDemoCleanup,
  waitForGqlDemoTab,
} from './graphql-demo-workspace-helpers';
import { GQL1_LESSON } from './graphql-lesson-smoke-helpers';

const GQL1_NAME = GQL1_LESSON.name;
const GQL2_NAME = 'Variables & Arguments';
const GQL14_NAME = 'Multi-Tab Workspaces';
const DEMO_ACTION_TIMEOUT = 180_000;

async function mockGraphqlHealthProbe(page: Parameters<typeof silenceLogStream>[0]): Promise<void> {
  await page.route(GQL_HEALTH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );
}

test.describe.configure({ retries: 0 });

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test.describe('§11.0 — user workspace survives GQL-1', () => {
  test('custom endpoint and tab title unchanged after lesson exit', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(600_000);
    await seedGqlUserWorkspace(page);
    await openGqlLessonConcept(page, GQL1_NAME);

    const before = await readGqlWorkspaceSnapshot(page);
    expectUserWorkspaceIntact(before);

    await waitForPrerequisiteGateUp(page);
    await startLesson(page);

    await expect(page.locator('[data-testid="gql-tab-bar"] [role="tab"]')).toHaveCount(2, {
      timeout: 15_000,
    });
    await waitForGqlDemoTab(page, 'gql-first-query');

    await advanceSteps(page, 3, DEMO_ACTION_TIMEOUT);

    const during = await readGqlWorkspaceSnapshot(page);
    expect(during.userTabs).toHaveLength(1);
    expect(during.userTabs[0].label).toBe(USER_WORKSPACE_TAB_LABEL);
    expect(during.demoTabs).toHaveLength(1);
    expect(during.demoSession?.lessonId).toBe('gql-first-query');

    await exitLesson(page);
    await waitForGqlDemoCleanup(page);

    const after = await readGqlWorkspaceSnapshot(page);
    expectUserWorkspaceIntact(after);

    await navigateToGraphqlStudio(page);
    await expect(
      page.locator(`[data-testid="gql-tab-${USER_WORKSPACE_TAB_ID}"]`),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.locator(`[data-testid="gql-tab-${USER_WORKSPACE_TAB_ID}"]`),
    ).toContainText(USER_WORKSPACE_TAB_LABEL);
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(
      before.endpoint ?? '',
    );
  });
});

test.describe('§11.0 — seven user tabs + GQL-1', () => {
  test('GQL-1 starts on slot 8 and restores 7 user tabs after exit', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(600_000);
    await seedGqlUserWorkspace(page, { userTabCount: 7 });
    await openGqlLessonConcept(page, GQL1_NAME);
    expectUserWorkspaceIntact(await readGqlWorkspaceSnapshot(page), { userTabCount: 7 });

    await waitForPrerequisiteGateUp(page);
    await expect(page.locator('.demo-start-btn')).toBeEnabled({ timeout: 20_000 });
    await startLesson(page);

    await expect(page.locator('[data-testid="gql-tab-bar"] [role="tab"]')).toHaveCount(8, {
      timeout: 15_000,
    });

    await exitLesson(page);
    await waitForGqlDemoCleanup(page);

    expectUserWorkspaceIntact(await readGqlWorkspaceSnapshot(page), { userTabCount: 7 });
  });
});

test.describe('§11.0 — GQL-14 tab capacity gate', () => {
  test('blocks Start when 7 user tabs open until one tab is closed', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(120_000);
    await seedGqlUserWorkspace(page, { userTabCount: 7 });
    await openGqlLessonConcept(page, GQL14_NAME);
    await waitForPrerequisiteGateUp(page);

    await expect(page.locator('[data-testid="prereq-tab-capacity"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="prereq-tab-capacity"]')).toContainText(
      /Close at least\s+1\s+tab/i,
    );
    await expect(page.locator('.demo-start-btn')).toBeDisabled();

    await closeOneUserTabInStorage(page);

    await expect(page.locator('[data-testid="prereq-tab-capacity-ok"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('.demo-start-btn')).toBeEnabled({ timeout: 10_000 });
  });
});

test.describe('§11.0 — switch GQL-1 → GQL-2', () => {
  test('demo tab is recreated for GQL-2 with no GQL-1 demo tab leftover', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(600_000);
    await seedGqlUserWorkspace(page);
    await openGqlLessonConcept(page, GQL1_NAME);
    await waitForPrerequisiteGateUp(page);
    await startLesson(page);
    await advanceSteps(page, 2, DEMO_ACTION_TIMEOUT);
    await exitLesson(page);
    await waitForGqlDemoCleanup(page);

    expectUserWorkspaceIntact(await readGqlWorkspaceSnapshot(page));

    await goBackToLessonList(page);
    const { openLesson } = await import('./demo-player-helpers');
    await openLesson(page, GQL2_NAME);
    await waitForPrerequisiteGateUp(page);
    await startLesson(page);
    await waitForGqlDemoTab(page, 'gql-variables');

    const duringGql2 = await readGqlWorkspaceSnapshot(page);
    expect(duringGql2.demoSession?.lessonId).toBe('gql-variables');
    expect(duringGql2.demoTabs).toHaveLength(1);
    expect(duringGql2.demoTabs.every((t) => t.demoLessonId === 'gql-variables')).toBe(true);
    expect(duringGql2.demoTabs.some((t) => t.demoLessonId === 'gql-first-query')).toBe(false);

    await exitLesson(page);
    await waitForGqlDemoCleanup(page);
    expectUserWorkspaceIntact(await readGqlWorkspaceSnapshot(page));
  });
});

test.describe('§11.0 — hard refresh mid GQL-1', () => {
  test('active demo session and live overlay survive reload; orphans purged after exit', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010');

    test.setTimeout(600_000);
    await page.goto('http://localhost:5173/?tab=demo', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.removeItem('gql110_user_workspace_init'));
    await seedGqlUserWorkspace(page, { surviveHardReload: true });
    await openGqlLessonConcept(page, GQL1_NAME);

    const before = await readGqlWorkspaceSnapshot(page);
    expectUserWorkspaceIntact(before);

    await waitForPrerequisiteGateUp(page);
    await startLesson(page);
    await waitForGqlDemoTab(page, 'gql-first-query');
    await advanceSteps(page, 2, DEMO_ACTION_TIMEOUT);

    const stepBeforeReload = await page.locator('.demo-live-step-counter').textContent();
    const during = await readGqlWorkspaceSnapshot(page);
    expect(during.demoSession?.lessonId).toBe('gql-first-query');
    expect(during.userTabs[0]?.label).toBe(USER_WORKSPACE_TAB_LABEL);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="demo-live-panel"]')).toBeVisible({ timeout: 60_000 });
    await waitForReadingPhase(page, DEMO_ACTION_TIMEOUT);

    const stepAfterReload = await page.locator('.demo-live-step-counter').textContent();
    expect(stepAfterReload).toBe(stepBeforeReload);

    const afterReload = await readGqlWorkspaceSnapshot(page);
    expect(afterReload.demoSession?.lessonId).toBe('gql-first-query');
    expect(afterReload.userTabs[0]?.label).toBe(USER_WORKSPACE_TAB_LABEL);
    expect(afterReload.endpoint).toBe(before.endpoint);
    expect(afterReload.demoTabs).toHaveLength(1);

    await exitLesson(page);
    await waitForGqlDemoCleanup(page, 30_000);
    await navigateToGraphqlStudio(page);
    expectUserWorkspaceIntact(await readGqlWorkspaceSnapshot(page));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await navigateToGraphqlStudio(page);
    await expect(
      page.locator('[data-testid="gql-tab-bar"] [role="tab"][data-demo-lesson="gql-first-query"]'),
    ).toHaveCount(0, { timeout: 15_000 });
    expectUserWorkspaceIntact(await readGqlWorkspaceSnapshot(page));
  });
});
