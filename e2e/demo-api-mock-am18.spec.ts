/**
 * Demo lesson smoke — AM-18 `am-18-journal`
 * (Journal Forensics: Near-Misses, Candidates & Promotion).
 *
 * Run: npm run test:e2e:demo:am18
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Start
 * and the live fetches bind a listener and write real journal rows. No Docker.
 *
 * Proves the lesson's own beats end to end: matching journal rows, filter empty
 * then restore, a typo near-miss, closest-match debug body, create-route editor,
 * save-example + Requests handoff, copy/export/clear, then Simulate passing.
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

test.describe('Demo lesson AM-18 — Journal Forensics: Near-Misses, Candidates & Promotion', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on the simulated example', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am18');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am18} / ${AM_LESSON_STEPS.am18}`);
    await expect(page.locator(API_MOCK.SIMULATE_OUTCOME)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('writes matching journal rows after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am18);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.JOURNAL_FIRST_ROW).first()).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await page.locator(API_MOCK.JOURNAL_FIRST_ROW).first().click();
    await expect(page.locator(API_MOCK.TX_OUTCOME).first()).toContainText(/matched/i);
  });

  test('shows near-misses after the typo fetch', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am18);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TX_NEAR_MISSES)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('opens a seeded route editor after create-route', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am18);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.ROUTE_EDITOR)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(/produts/);
  });

  test('clears the journal after copy and export', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am18);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.RUNTIME_GUIDE)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
