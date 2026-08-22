/**
 * Demo lesson smoke — AM-09 `am-09-conflicts`
 * (Conflict Inspector: Four Overlap Kinds → Fix → Acknowledge).
 *
 * Run: npm run test:e2e:demo:am09
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — analysis is static and the witness is proven in Simulate — so the
 * companion on :3001 is not required.
 *
 * Proves the lesson's own beats end to end: Analyze writes four findings,
 * Duplicate fingerprints, Simulate the health witness (AMBIGUOUS), Open in
 * Studio then return, then Shadowed → Simulate MATCHED, then Definite →
 * Simulate daily 409 and non-daily 200, then Potential → Simulate header
 * 409 and no-header 404, raising Daily reclassifies Definite to empty, and
 * acknowledging then editing a fingerprint marks the pair Stale.
 */
import { test, expect, type Page } from '@playwright/test';
import { API_MOCK } from '../src/shared/selectors/apiMock';
import { advanceSteps, completeCurrentStepAction, launchApiMockLesson } from './demo-player-helpers';
import {
  AM_LESSON_NAMES,
  AM_LESSON_STEPS,
  AM_LESSON_STEP_TIMEOUT,
  AM_LESSON_TIMEOUT,
  cleanupApiMockLessonRun,
  prepareApiMockLessonRun,
  readStepCounter,
  walkApiMockLesson,
} from './api-mock-lesson-smoke-helpers';

const RULE_COUNT = 8;
const FILTER_DUPLICATE = API_MOCK.conflictFilter('duplicate');
const FILTER_SHADOWED = API_MOCK.conflictFilter('shadowed');
const FILTER_DEFINITE = API_MOCK.conflictFilter('definite_overlap');
const FILTER_POTENTIAL = API_MOCK.conflictFilter('potential_overlap');

/**
 * Step 8/10 switch Results to **Rendered response**, which unmounts the
 * Decision-trace Winner badge. Fast mode also replaces the 409 body within a
 * tick. Record every rendered body so assertions do not race the tab switch.
 */
async function watchSimulateRenderedBodies(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as Window & { __amSimBodies?: string[] };
    w.__amSimBodies = [];
    const take = () => {
      const el = document.querySelector('[data-testid="api-mock-sim-rendered-body"]');
      const text = el?.textContent?.trim() ?? '';
      if (!text) return;
      const list = w.__amSimBodies!;
      if (list[list.length - 1] !== text) list.push(text);
    };
    take();
    new MutationObserver(take).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}

async function expectWatchedRenderedBody(page: Page, pattern: RegExp): Promise<void> {
  await expect.poll(
    async () => page.evaluate(
      () => (window as Window & { __amSimBodies?: string[] }).__amSimBodies?.join('\n') ?? '',
    ),
    { timeout: AM_LESSON_STEP_TIMEOUT },
  ).toMatch(pattern);
}

test.describe('Demo lesson AM-09 — Conflict Inspector: Four Overlap Kinds', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 12 steps and ends on a stale acknowledgement', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am09');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am09} / ${AM_LESSON_STEPS.am09}`);
    await expect(page.locator(API_MOCK.CONFLICT_STALE)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('analyzes eight overlapping rules into four findings', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);

    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_LIST)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_SUMMARY)).toContainText('4 finding');
    await expect(page.locator(API_MOCK.FIRST_FINDING)).toHaveCount(4);
    await expect(page.locator(API_MOCK.FIRST_FINDING).first()).toHaveAttribute('data-kind', 'duplicate');
    await expect(page.locator(`${API_MOCK.CONFLICT_FILTERS} button`)).toHaveText([
      /All/,
      /Duplicate/,
      /Shadowed/,
      /Definite/,
      /Potential/,
      /Unreachable/,
    ]);
  });

  test('filters Duplicate and opens rule fingerprints', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_DUPLICATE)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINTS_OPEN)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_HASHES)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_LEFT)).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_RIGHT)).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_RELATION)).toContainText('Different hashes');
    await expect(page.locator(API_MOCK.FIRST_FINDING)).toHaveCount(1);
  });

  test('simulates the duplicate witness then closes Simulate', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    const acting = completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.SIMULATE_RENDERED_BODY)).toContainText(/ambiguous/i, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await acting;

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('opens the left rule in Studio then returns to Conflicts', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
    await expect(page.locator(API_MOCK.ROUTE_EDITOR)).toHaveCount(0);
  });

  test('filters Shadowed and shows the dimension table', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_SHADOWED)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_DETAIL)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_DIMENSIONS)).toBeVisible();
  });

  test('simulates the shadowed witness then closes Simulate', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);
    const acting = completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.SIMULATE_RENDERED_BODY)).toContainText(/"scope"\s*:\s*"all"/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_HEADERS).filter({ visible: true })).toHaveValue(/x-tenant:\s*acme/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_WINNER)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_RENDERED_BODY)).toContainText(/"scope"\s*:\s*"all"/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await acting;

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('filters Definite and shows the daily vs glob pair', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_DEFINITE)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_DETAIL)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_DIMENSIONS)).toBeVisible();
  });

  test('simulates Definite on /reports/daily then /reports/non-daily', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 7, AM_LESSON_STEP_TIMEOUT);
    await watchSimulateRenderedBodies(page);
    const acting = completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expectWatchedRenderedBody(page, /ambiguous/i);
    await expectWatchedRenderedBody(page, /"report"\s*:\s*"any"/);
    await acting;

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('filters Potential and shows the unknown header dimension', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 8, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_POTENTIAL)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_DIM_UNKNOWN)).toBeVisible();
  });

  test('simulates Potential with a matching header then no header', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 9, AM_LESSON_STEP_TIMEOUT);
    await watchSimulateRenderedBodies(page);
    const acting = completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expectWatchedRenderedBody(page, /ambiguous/i);
    await expectWatchedRenderedBody(page, /not_found/i);
    await acting;

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('raises Daily priority and empties the Definite filter', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 10, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_SUMMARY)).toContainText('4 finding');
    await expect(page.locator(FILTER_SHADOWED)).toHaveClass(/active/);
  });

  test('acknowledges the duplicate then marks it Stale after a fingerprint edit', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 11, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_STALE)).toBeVisible();
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
  });
});
