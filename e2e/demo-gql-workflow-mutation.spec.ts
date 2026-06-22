/**
 * Demo — GQL-18 Mutation Node in Workflow: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql18
 *
 * Full lesson needs Docker GraphQL on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 8 disables Next — use walkFullGql18Lesson, not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL18_LESSON,
  prepareGql18DockerLesson,
  walkFullGql18Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL18_LESSON.name;
const TOTAL_STEPS = GQL18_LESSON.steps;
const WF_NAME = 'GraphQL User CRUD Demo';

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

test.describe('GQL-18 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-18 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql18DockerLesson(page, request);
    await walkFullGql18Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Teardown with deleteUser/i);

    await expect(page.locator('.wf-canvas-area')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-canvas-mutation-node"]')).toHaveCount(2, { timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-canvas-query-node"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-canvas-assert-node"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="wf-toolbar-select"]')).toContainText(WF_NAME, { timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql18-workflow-mutation-lesson-complete');
    await exitLesson(page);
  });
});
