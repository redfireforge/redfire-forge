/**
 * Demo — GQL-8 Query Builder — Visual Operations: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql8
 *
 * Full lesson (introspect, builder tree, alias/@include, edit in editor) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 10 disables Next — use walkFullGql8Lesson (GQL-4 style), not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, GQL_HTTP, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL8_LESSON,
  prepareGql8DockerLesson,
  walkFullGql8Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL8_LESSON.name;
const TOTAL_STEPS = GQL8_LESSON.steps;
const EDITOR_COMMENT = '# edited in editor';

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

test.describe('GQL-8 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-8 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql8DockerLesson(page, request);
    await walkFullGql8Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/One-Way Sync/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);
    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });
    // Final step switches to Builder to demonstrate one-way sync — not Editor mode.
    await expect(page.locator('[data-testid="gql-mode-builder"]')).toHaveClass(/gql-mode-btn--active/);
    const qbCode = page.locator('[data-testid="gql-qb-code"]');
    await expect(qbCode).toBeVisible({ timeout: 15_000 });
    await expect(qbCode).not.toContainText(EDITOR_COMMENT);

    await takeNamedScreenshot(page, 'gql8-query-builder-lesson-complete');
    await exitLesson(page);
  });
});
