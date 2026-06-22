/**
 * Demo — GQL-1 Your First GraphQL Query: step-through validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql1
 *
 * Full lesson (introspect/execute/history) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 */

import { test, expect } from '@playwright/test';
import {
  launchGqlLesson,
  advanceSteps,
  restartLesson,
  completeCurrentStepAction,
  exitLesson,
  getStepInfo,
  takeNamedScreenshot,
} from './demo-player-helpers';
import {
  GQL_HEALTH,
  GQL_HTTP,
  isGraphqlServerHealthy,
  silenceLogStream,
} from './graphql-helpers';
import {
  GQL1_LESSON,
  prepareGql1DockerLesson,
  walkFullGql1Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL1_LESSON.name;
const _TOTAL_STEPS = GQL1_LESSON.steps;
const DEMO_ACTION_TIMEOUT = 180_000;

const GQL_DEMO_ENV = 'GraphQL Demo';
const GQL_DEMO_SVC = 'graphql-demo';

test.describe.configure({ retries: 0 });

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

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test.describe('GQL-1 — lesson shell', () => {
  test('concept slide unlocks Start after prerequisite gate', async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const { title } = await getStepInfo(page);
    expect(title).toMatch(/GraphQL Studio/i);
    await takeNamedScreenshot(page, 'gql1-lesson-start');
  });

  test('lesson has 13 steps', async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(/1\s*[/]\s*13/);
  });
});

test.describe('GQL-1 — Environment Manager', () => {
  test('graphql-demo is GraphQL-only with GraphQL Demo deployed and endpoint saved', async ({ page }) => {
    test.setTimeout(180_000);
    await launchGqlLesson(page, LESSON_NAME);
    await restartLesson(page);

    await advanceSteps(page, 2, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('.env-manager')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-env-name="${GQL_DEMO_ENV}"]`)).toBeVisible();
    await expect(page.locator(`[data-svc-name="${GQL_DEMO_SVC}"]`)).toBeVisible();
    await expect(page.locator('[data-testid="em-protocol-tab-http"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="em-protocol-tab-graphql"]')).toBeVisible();

    const gqlDemoRow = page.locator('tr').filter({ hasText: GQL_DEMO_ENV });
    await expect(gqlDemoRow.locator('input[type="checkbox"]')).toBeChecked();

    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);
    await expect(gqlDemoRow.locator('code.em-url-text')).toContainText('localhost:4010');
    await expect(page.locator('[data-testid="derived-vars-graphql"]')).toContainText('{{graphqlUrl}}');

    await takeNamedScreenshot(page, 'gql1-env-config-done');
  });
});

test.describe('GQL-1 — endpoint variable resolution', () => {
  test('studio shows {{graphqlUrl}} and resolved preview after header setup', async ({ page }) => {
    test.setTimeout(240_000);
    await launchGqlLesson(page, LESSON_NAME);
    await restartLesson(page);

    await advanceSteps(page, 5, DEMO_ACTION_TIMEOUT);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue('{{graphqlUrl}}');
    const preview = page.locator('[data-testid="gql-endpoint-preview"]');
    await expect(preview).toBeVisible({ timeout: 10_000 });
    await expect(preview).toContainText(GQL_HTTP.replace('http://', '').replace('https://', ''));

    await takeNamedScreenshot(page, 'gql1-endpoint-resolved');
  });
});

test.describe('GQL-1 — full lesson (Docker)', () => {
  test('all 13 steps complete with schema badge, health response, and history entry', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql1DockerLesson(page, request);

    await walkFullGql1Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/13\s*[/]\s*13/);
    expect(title).toMatch(/History/i);

    // Assert studio outcomes while still in live demo (exit returns to concept — studio is hidden).
    await expect(page.getByText(/Schema loaded/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gql-history-entry').first()).toBeVisible({ timeout: 15_000 });

    // Demo panel overlaps response tabs — force clicks reach through the narration overlay.
    await page.locator('[data-testid="gql-right-tab-response"]').click({ force: true });
    await page.locator('[data-testid="gql-rv-tab-body"]').click({ force: true });
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('health');

    await exitLesson(page);
    await takeNamedScreenshot(page, 'gql1-lesson-complete');
  });
});
