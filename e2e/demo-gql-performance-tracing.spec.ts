/**
 * Demo — GQL-11 Performance Tracing: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql11
 *
 * Full lesson (complexity badge, Apollo tracing waterfall, latency histogram) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 8 disables Next — use walkFullGql11Lesson (GQL-4 style), not runNextStep on the final step.
 */

import { test, expect, type Page } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, GQL_HTTP, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL11_LESSON,
  prepareGql11DockerLesson,
  walkFullGql11Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL11_LESSON.name;
const TOTAL_STEPS = GQL11_LESSON.steps;

/** Open Tracing tab — lesson overlay can block Playwright pointer clicks after step 8. */
async function openTracingTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tab = document.querySelector<HTMLElement>('[data-testid="gql-rv-tab-tracing"]');
    const badge = document.querySelector<HTMLElement>('[data-testid="gql-rv-tracing-badge"]');
    (tab ?? badge)?.click();
  });
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

test.describe('GQL-11 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-11 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql11DockerLesson(page, request);
    await walkFullGql11Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Latency Histogram/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);
    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-complexity-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="gql-rv-tracing-badge"]')).toBeVisible({ timeout: 15_000 });
    await openTracingTab(page);
    await expect(page.locator('[data-testid="gql-trace-view"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-histogram-strip"]')).toBeVisible({ timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql11-performance-tracing-lesson-complete');
    await exitLesson(page);
  });
});
