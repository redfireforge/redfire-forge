/**
 * Demo — GQL-9 Collections & History: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql9
 *
 * Full lesson (execute, history preview/load/run, save, export/import) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 8 disables Next — use walkFullGql9Lesson (GQL-4 style), not runNextStep on the final step.
 */

import { test, expect, type Page } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, GQL_HTTP, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL9_LESSON,
  prepareGql9DockerLesson,
  walkFullGql9Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL9_LESSON.name;
const TOTAL_STEPS = GQL9_LESSON.steps;
const RENAMED_ITEM = 'Lesson 8 Health';

/** Open Collections left panel (activity tabs toggle — avoid closing an already-open panel). */
async function ensureCollectionsPanelOpen(page: Page): Promise<void> {
  const panel = page.locator('[data-testid="gql-collections-panel"]');
  if (await panel.isVisible().catch(() => false)) return;

  await page.locator('[data-testid="gql-activity-history"]').click({ force: true });
  await page.locator('[data-testid="gql-activity-collections"]').click({ force: true });
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

test.describe('GQL-9 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-9 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql9DockerLesson(page, request);
    await walkFullGql9Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Delete.*Import/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);
    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });

    await ensureCollectionsPanelOpen(page);
    await expect(page.locator('[data-testid="gql-col-item"]')).toContainText(RENAMED_ITEM);

    await takeNamedScreenshot(page, 'gql9-collections-history-lesson-complete');
    await exitLesson(page);
  });
});
