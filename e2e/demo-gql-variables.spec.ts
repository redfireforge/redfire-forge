/**
 * Demo — GQL-2 Variables & Arguments: step-through validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql2
 *
 * Full lesson (introspect, execute, history compare) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 */

import { test, expect, type Page } from '@playwright/test';
import {
  launchGqlLesson,
  advanceSteps,
  completeCurrentStepAction,
  finishDemoStep,
  getStepInfo,
  runNextStep,
  takeNamedScreenshot,
} from './demo-player-helpers';
import {
  GQL_HEALTH,
  GQL_HTTP,
  isGraphqlServerHealthy,
  silenceLogStream,
} from './graphql-helpers';
import {
  GQL2_LESSON,
  prepareGql2DockerLesson,
  walkFullGql2Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL2_LESSON.name;
const TOTAL_STEPS = GQL2_LESSON.steps;
const DEMO_ACTION_TIMEOUT = 180_000;

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

/** Current 1-based step number from the live panel counter (e.g. "12 / 16" → 12). */
async function currentStepNumber(page: Page): Promise<number> {
  const counter = await page.locator('.demo-live-step-counter').textContent();
  const match = counter?.match(/(\d+)\s*\/\s*\d+/);
  return match ? parseInt(match[1], 10) : 0;
}

/** Advance from the current step to `targetStep` (inclusive reading phase). */
async function advanceToStep(
  page: Page,
  targetStep: number,
  timeout = DEMO_ACTION_TIMEOUT,
): Promise<void> {
  const current = await currentStepNumber(page);
  const delta = targetStep - current;
  if (delta > 0) {
    await advanceSteps(page, delta, timeout);
  }
}

/** Read compact data.user card text (force click through demo overlay if needed). */
async function responseUserCardText(page: Page): Promise<string> {
  await page.locator('[data-testid="gql-right-tab-response"]').click({ force: true });
  const card = page.locator('[data-testid="gql-response-data-user"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  return (await card.textContent()) ?? '';
}

test.describe.configure({ retries: 0 });

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test.describe('GQL-2 — lesson shell', () => {
  test('concept slide unlocks Start after prerequisite gate', async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const { title } = await getStepInfo(page);
    expect(title).toMatch(/Variables/i);
    await takeNamedScreenshot(page, 'gql2-lesson-start');
  });

  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-2 — endpoint & schema browse (Docker)', () => {
  test('step 3 shows Query type after introspection — not empty schema', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(360_000);
    await prepareGql2DockerLesson(page, request);

    // Steps 1–2: intro → introspect (env/endpoint already quiet in setup)
    await advanceSteps(page, 1, DEMO_ACTION_TIMEOUT);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Schema loaded/i)).toBeVisible();
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue('{{graphqlUrl}}');
    await expect(page.locator('[data-testid="gql-endpoint-preview"]')).toContainText(
      GQL_HTTP.replace('http://', ''),
    );

    // Step 3: Browse the Query Type
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="gql-right-tab-schema"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('[data-testid="gql-se-type-Query"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-se-empty-idle"]')).toHaveCount(0);

    await takeNamedScreenshot(page, 'gql2-step3-query-type');
  });
});

test.describe('GQL-2 — Alice & Bob execution (Docker)', () => {
  test('steps 4–12 execute GetUser for Alice then Bob with variables panel', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(600_000);
    await prepareGql2DockerLesson(page, request);

    // Through step 12 (Read Bob's Response) — reading phase on step 13
    await advanceToStep(page, 12, 300_000);
    await completeCurrentStepAction(page, 300_000);

    await expect(page.getByText(/Schema loaded/i)).toBeVisible({ timeout: 15_000 });
    const bobCard = await responseUserCardText(page);
    expect(bobCard).toMatch(/Bob/i);

    await expect(page.locator('[data-testid="gql-bottom-tab-variables"]')).toBeVisible();
    await takeNamedScreenshot(page, 'gql2-bob-response');
  });
});

test.describe('GQL-2 — history search & compare (Docker)', () => {
  test('steps 13–16 open history, search GetUser, mark A/B, and show diff table', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(600_000);
    await prepareGql2DockerLesson(page, request);

    // Through step 12 (Read Bob's Response) — reading phase on step 13
    await advanceToStep(page, 13, 300_000);
    const bobBeforeHistory = await responseUserCardText(page);
    expect(bobBeforeHistory).toMatch(/Bob/i);

    // Step 13: Open History
    await completeCurrentStepAction(page, 300_000);
    await expect(page.getByTestId('gql-history-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gql-history-entry').first()).toBeVisible({ timeout: 15_000 });
    const historyCount = await page.getByTestId('gql-history-entry').count();
    expect(historyCount).toBeGreaterThanOrEqual(2);

    // Step 14: Search History
    await runNextStep(page, 300_000);
    await completeCurrentStepAction(page, 300_000);
    const search = page.getByTestId('gql-history-search');
    await expect(search).toHaveValue('GetUser');
    await expect(page.getByTestId('gql-history-entry').first()).toBeVisible();

    // Response panel should still show Bob (history guards must not re-execute)
    const bobDuringSearch = await responseUserCardText(page);
    expect(bobDuringSearch).toMatch(/Bob/i);

    // Step 15: Mark runs for comparison
    await runNextStep(page, 300_000);
    await completeCurrentStepAction(page, 300_000);
    await expect(page.getByTestId('gql-history-compare-toggle')).toHaveClass(/gql-history-compare-toggle--active/);
    await expect(page.getByTestId('gql-history-compare-slot-a')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('gql-history-compare-slot-b')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('gql-history-compare-btn')).toBeEnabled();

    const bobDuringMark = await responseUserCardText(page);
    expect(bobDuringMark).toMatch(/Bob/i);

    // Step 16: View comparison (last step — Next stays disabled; use finishDemoStep)
    await page.locator('[aria-label="Next step"]').click();
    await finishDemoStep(page, 300_000);

    await expect(page.getByTestId('gql-history-compare-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gql-history-compare-table')).toBeVisible();
    await expect(page.getByTestId('gql-history-compare-vars-table')).toBeVisible();

    const diffRows = page.locator('[data-testid="gql-history-compare-row"][data-diff="true"]');
    await expect(diffRows.first()).toBeVisible({ timeout: 10_000 });
    const compareTable = page.locator('[data-testid="gql-history-compare-table"]');
    await expect(compareTable.getByText('user.name')).toBeVisible();
    await expect(compareTable.getByText('Alice').first()).toBeVisible();
    await expect(compareTable.getByText('Bob').first()).toBeVisible();

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Compare/i);

    await takeNamedScreenshot(page, 'gql2-history-compare-done');
  });
});

test.describe('GQL-2 — full lesson (Docker)', () => {
  test(`all ${TOTAL_STEPS} steps complete with history search and compare`, async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql2DockerLesson(page, request);

    await walkFullGql2Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Compare/i);

    await expect(page.getByText(/Schema loaded/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gql-history-compare-table')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('gql-history-compare-panel')).toBeVisible();

    await takeNamedScreenshot(page, 'gql2-lesson-complete');
  });
});
