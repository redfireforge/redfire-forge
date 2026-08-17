/**
 * Demo lesson smoke — AM-13 `am-13-stateful`
 * (Stateful Mocks: A Cart That Remembers).
 *
 * Run: npm run test:e2e:demo:am13
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Apply
 * and the live fetches bind a listener and send real traffic.
 *
 * Proves the lesson's own beats end to end: State mode, EMPTY → HAS_ITEMS
 * with a counter, a second wired variant, a journaled first call, live state,
 * Reset + Run all, Weighted 90/10 with a seed, and a masked variable.
 */
import { test, expect } from '@playwright/test';
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
import { isApiMockCompanionReady } from './api-mock-multi-server-helpers';

test.describe('Demo lesson AM-13 — Stateful Mocks: A Cart That Remembers', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on a resolved tenant preview', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am13');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am13} / ${AM_LESSON_STEPS.am13}`);
    await expect(page.locator(API_MOCK.VAR_VALUE_LAST).first()).toHaveAttribute('type', 'password', {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toContainText('acme', {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('switches to state mode after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am13);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.RESPONSE_MODE_STATE)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(API_MOCK.VARIANT_REQUIRED_STATE)).toBeVisible();
  });

  test('adds a counter row after the second step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am13);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.COUNTER_ROW)).toBeVisible();
    await expect(page.locator(API_MOCK.COUNTER_KEY)).toHaveValue('items');
  });

  test('journals the empty-cart response after the first live call', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am13);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.DOCK_STATE_LIVE)).toBeVisible({ timeout: AM_LESSON_STEP_TIMEOUT });
  });
});
