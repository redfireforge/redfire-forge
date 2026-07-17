/**
 * Demo — GQL-13 Mock Server: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql13
 *
 * Full lesson needs:
 *   - Docker GraphQL on port 4010: cd docker/graphql && docker compose up -d
 *   - Node proxy on port 3001: npm run server
 *
 * Last-step rule: step 15 disables Next — use walkFullGql13Lesson (GQL-4 style).
 */

import { test, expect } from '@playwright/test';
import { exitLesson, getStepInfo, launchGqlLesson, takeNamedScreenshot } from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL13_LESSON,
  GQL13_MOCK_CONFIG_URL,
  installGql13E2eDesktopShim,
  isGqlMockProxyHealthy,
  prepareGql13DockerLesson,
  walkFullGql13Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL13_LESSON.name;
const TOTAL_STEPS = GQL13_LESSON.steps;

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
  await installGql13E2eDesktopShim(page);
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test.describe('GQL-13 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-13 — full lesson (Docker + mock proxy)', () => {
  test.beforeEach(async ({ request }) => {
    await request.post(GQL13_MOCK_CONFIG_URL, { data: { enabled: false } }).catch(() => {});
  });

  test('auto-play completes without errors', async ({ page, request }) => {
    const dockerHealthy = await isGraphqlServerHealthy(request);
    test.skip(!dockerHealthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    const mockHealthy = await isGqlMockProxyHealthy(request);
    test.skip(!mockHealthy, 'Node mock proxy not running on port 3001 — run npm run server');

    test.setTimeout(900_000);
    await prepareGql13DockerLesson(page, request);
    await walkFullGql13Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Read the Live Response/i);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(
      /http:\/\/(localhost|127\.0\.0\.1):4010\/graphql/,
    );
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('"ok"', { timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql13-mock-server-lesson-complete');
    await exitLesson(page);
  });
});
