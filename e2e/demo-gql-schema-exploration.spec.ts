/**
 * Demo — GQL-3 Schema Exploration: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql3
 *
 * Full lesson (introspect, Try → insert, execute, SDL export) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 8 disables Next — use walkFullGql3Lesson (GQL-1 style), not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL3_LESSON,
  prepareGql3DockerLesson,
  walkFullGql3Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL3_LESSON.name;
const TOTAL_STEPS = GQL3_LESSON.steps;

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

test.describe('GQL-3 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-3 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql3DockerLesson(page, request);
    await walkFullGql3Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/SDL/i);

    await expect(page.getByText(/Schema loaded/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-se-detail-panel"]')).toBeVisible({ timeout: 15_000 });

    await page.locator('[data-testid="gql-right-tab-response"]').click({ force: true });
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('"health": "ok"', {
      timeout: 15_000,
    });

    await takeNamedScreenshot(page, 'gql3-schema-lesson-complete');
    await exitLesson(page);
  });
});
