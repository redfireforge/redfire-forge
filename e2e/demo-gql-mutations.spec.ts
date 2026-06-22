/**
 * Demo — GQL-6 Mutations: step-through validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql6
 *
 * Full lesson (introspect, mutations, idempotent delete) needs Docker on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 15 disables Next — use finishDemoStep, never runNextStep on the final step.
 */

import { test, expect, type Page } from '@playwright/test';
import {
  launchGqlLesson,
  advanceSteps,
  completeCurrentStepAction,
  finishDemoStep,
  getStepInfo,
  takeNamedScreenshot,
} from './demo-player-helpers';
import {
  GQL_HEALTH,
  GQL_HTTP,
  ensureGql3StudioEndpoint,
  isGraphqlServerHealthy,
  silenceLogStream,
} from './graphql-helpers';
import {
  GQL6_LESSON,
  prepareGql6DockerLesson,
  walkFullGql6Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL6_LESSON.name;
const DEMO_ACTION_TIMEOUT = 180_000;
const MUTATION_TIMEOUT = 300_000;

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

/** Current 1-based step number from the live panel counter (e.g. "8 / 15" → 8). */
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

/** Advance to `targetStep` reading phase, then re-assert the full GraphQL endpoint URL. */
async function advanceToStepWithEndpoint(
  page: Page,
  targetStep: number,
  timeout = DEMO_ACTION_TIMEOUT,
): Promise<void> {
  await ensureGql3StudioEndpoint(page);
  await advanceToStep(page, targetStep, timeout);
  await ensureGql3StudioEndpoint(page);
}


/** Read compact data.createUser card text (force click through demo overlay if needed). */
async function createUserCardText(page: Page): Promise<string> {
  await page.locator('[data-testid="gql-right-tab-response"]').click({ force: true });
  const card = page.locator('[data-testid="gql-response-data-create-user"]');
  await expect(card).toBeVisible({ timeout: 15_000 });
  return (await card.textContent()) ?? '';
}

/** Read raw response body JSON from the Body tab. */
async function responseBodyText(page: Page): Promise<string> {
  await page.locator('[data-testid="gql-right-tab-response"]').click({ force: true });
  await page.locator('[data-testid="gql-rv-tab-body"]').click({ force: true });
  const body = page.locator('[data-testid="gql-response-body"]');
  await expect(body).toBeVisible({ timeout: 15_000 });
  return (await body.textContent()) ?? '';
}

test.describe.configure({ retries: 0 });

test.beforeEach(async ({ page }) => {
  await silenceLogStream(page);
  await mockGraphqlHealthProbe(page);
});

test.describe('GQL-6 — lesson shell', () => {
  test('concept slide unlocks Start after prerequisite gate', async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const { title } = await getStepInfo(page);
    expect(title).toMatch(/Mutation/i);
    await takeNamedScreenshot(page, 'gql3-lesson-start');
  });

  test('lesson has 15 steps', async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(/1\s*[/]\s*15/);
  });
});

test.describe('GQL-6 — schema & Mutation type (Docker)', () => {
  test('step 4 shows Mutation type after introspection — not empty schema', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(360_000);
    await prepareGql6DockerLesson(page, request);

    // Steps 1–3: intro → endpoint → introspect
    await advanceSteps(page, 3, DEMO_ACTION_TIMEOUT);
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);

    // Step 4: Browse the Mutation Type
    await completeCurrentStepAction(page, DEMO_ACTION_TIMEOUT);

    await expect(page.locator('[data-testid="gql-right-tab-schema"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('[data-testid="gql-se-type-Mutation"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="gql-se-empty-idle"]')).toHaveCount(0);

    await takeNamedScreenshot(page, 'gql3-step4-mutation-type');
  });
});

test.describe('GQL-6 — createUser mutation (Docker)', () => {
  test('steps 5–8 write createUser, execute for Carol, and show createUser response', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(600_000);
    await prepareGql6DockerLesson(page, request);

    // Through step 8 (Read Create Response) — reading phase on step 9
    await advanceToStepWithEndpoint(page, 8, MUTATION_TIMEOUT);
    await completeCurrentStepAction(page, MUTATION_TIMEOUT);

    const activeTab = page.locator('[data-testid="gql-tab-bar"] [role="tab"][aria-selected="true"]');
    await expect(activeTab).toHaveClass(/gql-tab--mutation/);

    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });
    const carolCard = await createUserCardText(page);
    expect(carolCard).toMatch(/Carol/i);
    expect(carolCard).toMatch(/carol@demo\.local/i);

    await takeNamedScreenshot(page, 'gql3-carol-created');
  });
});

test.describe('GQL-6 — createOrder mutation (Docker)', () => {
  test('steps 9–11 write createOrder with OrderInput and execute successfully', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(600_000);
    await prepareGql6DockerLesson(page, request);

    // Through step 11 (Execute createOrder) — reading phase on step 12
    await advanceToStepWithEndpoint(page, 11, MUTATION_TIMEOUT);
    await completeCurrentStepAction(page, MUTATION_TIMEOUT);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(GQL_HTTP);

    const body = await responseBodyText(page);
    expect(body).toMatch(/createOrder/i);
    expect(body).toMatch(/cust-demo/i);

    await takeNamedScreenshot(page, 'gql3-order-created');
  });
});

test.describe('GQL-6 — deleteUser & idempotency (Docker)', () => {
  test('steps 12–15 delete Carol, then second delete returns success: false', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(600_000);
    await prepareGql6DockerLesson(page, request);

    // Through step 14 (first delete) — reading phase on step 15
    await advanceToStepWithEndpoint(page, 14, MUTATION_TIMEOUT);
    await completeCurrentStepAction(page, MUTATION_TIMEOUT);

    const firstDeleteBody = await responseBodyText(page);
    expect(firstDeleteBody).toMatch(/deleteUser/i);
    expect(firstDeleteBody).toMatch(/"success"\s*:\s*true/i);

    // Step 15: Idempotent second delete (last step — Next stays disabled; use finishDemoStep)
    await page.locator('[aria-label="Next step"]').click();
    await finishDemoStep(page, MUTATION_TIMEOUT);

    const secondDeleteBody = await responseBodyText(page);
    expect(secondDeleteBody).toMatch(/deleteUser/i);
    expect(secondDeleteBody).toMatch(/"success"\s*:\s*false/i);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/15\s*[/]\s*15/);
    expect(title).toMatch(/Idempotency/i);

    await takeNamedScreenshot(page, 'gql3-idempotent-delete');
  });
});

test.describe('GQL-6 — full lesson (Docker)', () => {
  test('all 15 steps complete with create, order, delete, and idempotent re-delete', async ({
    page,
    request,
  }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql6DockerLesson(page, request);

    await walkFullGql6Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(/15\s*[/]\s*15/);
    expect(title).toMatch(/Idempotency/i);

    await expect(page.locator('[data-testid="gql-schema-badge-ok"]')).toBeVisible({ timeout: 15_000 });

    const body = await responseBodyText(page);
    expect(body).toMatch(/"success"\s*:\s*false/i);

    await takeNamedScreenshot(page, 'gql3-lesson-complete');
  });
});
