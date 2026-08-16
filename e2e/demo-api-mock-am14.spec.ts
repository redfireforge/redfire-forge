/**
 * Demo lesson smoke — AM-14 `am-14-timing-faults`
 * (When Payments Hang: Latency, Eligibility & Connection Faults).
 *
 * Run: npm run test:e2e:demo:am14
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Apply
 * and the live fetches bind a listener and send real traffic. Timeout is
 * aborted on the client so the walk does not wait the safety cap.
 *
 * Proves the lesson's own beats end to end: delay ± jitter, Simulate virtual
 * delay then a journaled duration, max-matches fall-through, eligibility,
 * the faults panel, a caught timeout, reset, and the dribble timeline.
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

test.describe('Demo lesson AM-14 — When Payments Hang: Latency, Eligibility & Connection Faults', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on the fault timeline', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am14');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am14} / ${AM_LESSON_STEPS.am14}`);
    await expect(page.locator(API_MOCK.SIMULATE_TIMELINE_FAULT).first()).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('shows the delay spread after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am14);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TIMING_SPREAD)).toContainText('800±200');
  });

  test('shows the eligibility summary after the fourth step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am14);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.ELIGIBILITY_SUMMARY)).toBeVisible();
    await expect(page.locator(API_MOCK.ELIGIBILITY_SUMMARY)).toContainText('Limit 1');
  });

  test('opens the faults panel after the fifth step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am14);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.FAULTS_PANEL)).toBeVisible();
    await expect(page.locator(API_MOCK.FAULT_TIMEOUT)).toBeVisible();
  });
});
