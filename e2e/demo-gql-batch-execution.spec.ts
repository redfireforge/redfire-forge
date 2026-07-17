/**
 * Demo — GQL-15 Batch Execution: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql15
 *
 * Full lesson needs Docker GraphQL on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 10 disables Next — use walkFullGql15Lesson, not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL15_LESSON,
  prepareGql15DockerLesson,
  walkFullGql15Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL15_LESSON.name;
const TOTAL_STEPS = GQL15_LESSON.steps;

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

test.describe('GQL-15 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-15 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql15DockerLesson(page, request);
    await walkFullGql15Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Batch History & CI Export/i);

    await expect(page.locator('[data-testid="gql-history-panel"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-batch-summary-chip"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-rv-batch-banner"]')).toBeVisible({ timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql15-batch-execution-lesson-complete');
    await exitLesson(page);
  });
});
