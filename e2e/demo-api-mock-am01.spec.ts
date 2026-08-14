/**
 * Demo lesson smoke — AM-01 `am-01-studio-tour` (Studio Tour & Your First Mock).
 *
 * Run: npm run test:e2e:demo:am01
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`).
 *
 * Proves the lesson's own beats end to end: server created, rule authored, listener
 * started, real traffic journaled, transaction detail readable, listener stopped.
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

test.describe('Demo lesson AM-01 — Studio Tour & Your First Mock', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends with the listener stopped', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am01');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am01} / ${AM_LESSON_STEPS.am01}`);
    // Final beat frees the port: Start is back, Stop is gone.
    await expect(page.locator(API_MOCK.START)).toBeVisible({ timeout: AM_LESSON_STEP_TIMEOUT });
    await expect(page.locator(API_MOCK.STATUS_LABEL)).toContainText(/stopped/i);
  });

  test('journals real traffic and opens the transaction detail', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am01);
    // 6 advances from step 1 → step 7 reading: create → author → start → send-traffic.
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);

    const firstRow = page.locator(API_MOCK.JOURNAL_FIRST_ROW).first();
    await expect(firstRow).toBeVisible({ timeout: AM_LESSON_STEP_TIMEOUT });
    await expect(firstRow).toContainText('/health');
    await expect(firstRow).toContainText('200');

    // Step 7 expands the row. Do not advance to 8 — its guard navigates back to Studio.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.TX_DETAIL)).toBeVisible({ timeout: AM_LESSON_STEP_TIMEOUT });
  });
});
