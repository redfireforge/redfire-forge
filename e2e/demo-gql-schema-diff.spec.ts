/**
 * Demo — GQL-12 Schema Diff & Breaking Changes: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql12
 *
 * Full lesson (snapshot, changelog diff, severity filters, JSON export) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 7 disables Next — use walkFullGql12Lesson (GQL-4 style), not runNextStep on the final step.
 */

import { test, expect, type Page } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL12_LESSON,
  prepareGql12DockerLesson,
  walkFullGql12Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL12_LESSON.name;
const TOTAL_STEPS = GQL12_LESSON.steps;

/** Open Schema right tab — lesson overlay can block pointer clicks after the final step. */
async function ensureSchemaTabOpen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tab = document.querySelector<HTMLElement>('[data-testid="gql-right-tab-schema"]');
    if (tab?.getAttribute('aria-selected') !== 'true') tab?.click();
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

test.describe('GQL-12 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-12 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql12DockerLesson(page, request);
    await walkFullGql12Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Export Diff as JSON/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(
      /http:\/\/(localhost|127\.0\.0\.1):4010\/graphql/,
    );
    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });
    await ensureSchemaTabOpen(page);
    await page.locator('[data-testid="gql-se-tab-changelog"]').click({ force: true });
    await expect(page.locator('[data-testid="gql-changelog-panel"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-diff-modal"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-diff-export-json"]')).toBeVisible();
    await expect(page.locator('.gql-diff-filter--breaking')).toBeVisible();

    await takeNamedScreenshot(page, 'gql12-schema-diff-lesson-complete');
    await exitLesson(page);
  });
});
