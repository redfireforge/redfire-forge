/**
 * Demo — GQL-4 Authentication & Headers: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql4
 *
 * Full lesson (Bearer, API Key, Basic, inherit profile, connection profile) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 12 disables Next — use walkFullGql4Lesson (GQL-1 style), not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL4_LESSON,
  prepareGql4DockerLesson,
  walkFullGql4Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL4_LESSON.name;
const TOTAL_STEPS = GQL4_LESSON.steps;
const LESSON6_AUTH_TOKEN = 'lesson6-demo-jwt';

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

test.describe('GQL-4 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-4 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql4DockerLesson(page, request);
    await walkFullGql4Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Subscription/i);

    await page.locator('[data-testid="gql-right-tab-response"]').click({ force: true });
    await page.locator('[data-testid="gql-rv-tab-metadata"]').click({ force: true });
    const headers = page.locator('[data-testid="gql-rv-request-headers"]');
    await expect(headers).toBeVisible({ timeout: 15_000 });
    await expect(headers).toContainText(LESSON6_AUTH_TOKEN);
    await expect(headers).toContainText('Authorization');

    await expect(page.getByTestId('gql-profile-badge')).toBeVisible();

    await takeNamedScreenshot(page, 'gql4-auth-lesson-complete');
    await exitLesson(page);
  });
});
