/**
 * Demo — GQL-10 Export & Share Queries: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql10
 *
 * Full lesson (builder SDL, copy, edit in editor, history cURL) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 5 disables Next — use walkFullGql10Lesson (GQL-4 style), not runNextStep on the final step.
 */

import { test, expect, type Page } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, GQL_HTTP, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL10_LESSON,
  prepareGql10DockerLesson,
  walkFullGql10Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL10_LESSON.name;
const TOTAL_STEPS = GQL10_LESSON.steps;

/** Open History left panel without toggling it closed when already active. */
async function ensureHistoryPanelOpen(page: Page): Promise<void> {
  const panel = page.locator('[data-testid="gql-history-panel"]');
  if (await panel.isVisible().catch(() => false)) return;

  const historyBtn = page.locator('[data-testid="gql-activity-history"]');
  if ((await historyBtn.getAttribute('aria-selected')) === 'true') {
    await page.locator('[data-testid="gql-activity-collections"]').click({ force: true });
  }
  await historyBtn.click({ force: true });
  await expect(panel).toBeVisible({ timeout: 15_000 });
}

/** Unlock the Docker prerequisite gate when port 4010 is not running locally. */
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

test.describe('GQL-10 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-10 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql10DockerLesson(page, request);
    await walkFullGql10Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Share as cURL/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);
    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-mode-editor"]')).toHaveClass(/gql-mode-btn--active/);
    await expect(page.locator('[data-testid="gql-editor"]')).toContainText('health');
    await expect(page.locator('[data-testid="gql-editor"]')).toContainText('user');

    await ensureHistoryPanelOpen(page);
    await expect(page.locator('[data-testid="gql-history-entry"]').first()).toBeVisible({ timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql10-export-share-lesson-complete');
    await exitLesson(page);
  });
});
