/**
 * Demo — GQL-14 Multi-Tab Workspaces: smoke validation
 *
 * ONLY this lesson — run via:
 *   npm run test:e2e:demo:gql14
 *
 * Full lesson needs Docker GraphQL on port 4010:
 *   cd docker/graphql && docker compose up -d
 *
 * Last-step rule: step 10 disables Next — use walkFullGql14Lesson, not runNextStep on the final step.
 */

import { test, expect } from '@playwright/test';
import {
  exitLesson,
  finishDemoStep,
  getStepInfo,
  launchGqlLesson,
  restartLesson,
  takeNamedScreenshot,
  waitForReadingPhase,
} from './demo-player-helpers';
import { GQL_HEALTH, isGraphqlServerHealthy, silenceLogStream } from './graphql-helpers';
import {
  GQL14_LESSON,
  MUTATION_TIMEOUT,
  prepareGql14DockerLesson,
  walkFullGql14Lesson,
} from './graphql-lesson-smoke-helpers';

const LESSON_NAME = GQL14_LESSON.name;
const TOTAL_STEPS = GQL14_LESSON.steps;
const LIVE_PANEL = '[data-testid="demo-live-panel"]';

async function enableAutoPlay(page: Parameters<typeof waitForReadingPhase>[0]): Promise<void> {
  const playBtn = page.locator('.demo-live-play-btn');
  const title = await playBtn.getAttribute('title');
  if (title?.includes('Play')) {
    await playBtn.click();
  }
}

/** Wait until auto-play reaches the last step and its action finishes (1× — no reading skip). */
async function waitForAutoPlayComplete(page: Parameters<typeof waitForReadingPhase>[0]): Promise<void> {
  const deadline = Date.now() + 840_000;
  while (Date.now() < deadline) {
    const info = await getStepInfo(page);
    const phase = await page.locator(LIVE_PANEL).getAttribute('data-step-phase');
    console.log(`[GQL-14 auto-play] ${info.counter} — ${info.title} (phase=${phase})`);
    const match = info.counter.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      if (current === TOTAL_STEPS && total === TOTAL_STEPS && phase === 'done') return;
    }
    await page.waitForTimeout(5_000);
  }
  throw new Error('GQL-14 auto-play did not reach step 10/10 done within 14 minutes');
}

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

test.describe('GQL-14 — lesson shell', () => {
  test(`lesson has ${TOTAL_STEPS} steps`, async ({ page }) => {
    await launchGqlLesson(page, LESSON_NAME);
    const counter = await page.locator('.demo-live-step-counter').textContent();
    expect(counter).toMatch(new RegExp(`1\\s*[/]\\s*${TOTAL_STEPS}`));
  });
});

test.describe('GQL-14 — full lesson (Docker)', () => {
  test('auto-play completes without errors', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql14DockerLesson(page, request);
    await walkFullGql14Lesson(page);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Per-Tab Schema Polling/i);

    await expect(page.locator('[data-testid="gql-tab-bar"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /Staging/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /Production/i })).toBeVisible({ timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql14-multi-tab-lesson-complete');
    await exitLesson(page);
  });

  test('Phase 8 — 1× auto-play completes all 10 steps', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql14DockerLesson(page, request);
    await restartLesson(page);
    await waitForReadingPhase(page, MUTATION_TIMEOUT);

    const step9Shot = page
      .waitForSelector('[data-testid="gql-auth-inherit-banner"]', { timeout: MUTATION_TIMEOUT })
      .then(() => takeNamedScreenshot(page, 'gql14-step9-inherit-banner'))
      .catch(() => undefined);

    const step10Shot = page
      .waitForSelector('[data-testid="gql-polling-popover"]', { timeout: MUTATION_TIMEOUT })
      .then(() => takeNamedScreenshot(page, 'gql14-step10-polling-popover'))
      .catch(() => undefined);

    await enableAutoPlay(page);
    await waitForAutoPlayComplete(page);
    await Promise.all([step9Shot, step10Shot]);

    const { counter, title } = await getStepInfo(page);
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Per-Tab Schema Polling/i);

    const phase = await page.locator(LIVE_PANEL).getAttribute('data-step-phase');
    expect(phase).toBe('done');

    await expect(page.getByRole('tab', { name: /Staging/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('tab', { name: /Production/i })).toBeVisible({ timeout: 15_000 });

    await takeNamedScreenshot(page, 'gql14-autoplay-complete');
    await exitLesson(page);
  });

  test('Phase 8 — rapid Next preAction guards recover on step 10', async ({ page, request }) => {
    const healthy = await isGraphqlServerHealthy(request);
    test.skip(!healthy, 'GraphQL test server not running on port 4010 — start docker/graphql');

    test.setTimeout(900_000);
    await prepareGql14DockerLesson(page, request);
    await restartLesson(page);

    for (let i = 0; i < TOTAL_STEPS - 1; i++) {
      await waitForReadingPhase(page, MUTATION_TIMEOUT);
      await page.locator('[aria-label="Next step"]').click();
      await page.waitForTimeout(200);
    }

    let { counter, title } = await getStepInfo(page);
    // Rapid Next skips actions — land on step 9/10 until finishDemoStep runs step 10 preAction.
    expect(counter).toMatch(/9\s*[/]\s*10/);

    // Last step: Next stays disabled — use finishDemoStep, not completeCurrentStepAction.
    await finishDemoStep(page, MUTATION_TIMEOUT);
    ({ counter, title } = await getStepInfo(page));
    expect(counter).toMatch(new RegExp(`${TOTAL_STEPS}\\s*[/]\\s*${TOTAL_STEPS}`));
    expect(title).toMatch(/Per-Tab Schema Polling/i);
    // Step action closes the popover — reopen to confirm polling UI is reachable.
    const pollingBtn = page.locator(
      '[data-testid="gql-polling-config-btn"], [data-testid="gql-polling-config-btn-standalone"]',
    ).first();
    await pollingBtn.click({ force: true });
    await expect(page.locator('[data-testid="gql-polling-popover"]')).toBeVisible({ timeout: MUTATION_TIMEOUT });
    await takeNamedScreenshot(page, 'gql14-rapid-next-step10-recovery');
    await exitLesson(page);
  });
});
