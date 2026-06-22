/**
 * Demo — GQL-7 Subscriptions — Real-Time Data: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql7
 *
 * Full lesson (createOrder, subscribe, pause/filter, disconnect) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 12 disables Next — use walkFullGql7Lesson (GQL-4 style), not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, GQL_HTTP, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL7_LESSON,
  prepareGql7DockerLesson,
  walkFullGql7Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL7_LESSON.name;
const TOTAL_STEPS = GQL7_LESSON.steps;

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

test.describe('GQL-7 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-7 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql7DockerLesson(page, request);
    await walkFullGql7Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Stop the Subscription/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);
    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });

    const log = page.locator('[data-testid="gql-sub-message-list"]');
    await expect(page.locator('[data-testid="gql-sub-log"]')).toBeVisible({ timeout: 15_000 });
    await expect(log).toContainText('PENDING', { timeout: 15_000 });
    await expect(log).toContainText('PROCESSING', { timeout: 15_000 });
    // Step 12 re-subscribes then stops quickly — log may show 2 rows without COMPLETE.
    await expect(page.locator('[data-testid="gql-sub-row"]')).toHaveCount(2, { timeout: 10_000 });
    await expect(page.locator('[data-testid="gql-assertion-row"]')).toBeVisible({ timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql7-subscriptions-lesson-complete');
    await exitLesson(page);
  });
});
