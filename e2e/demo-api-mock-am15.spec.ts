/**
 * Demo lesson smoke — AM-15 `am-15-import`
 * (Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog).
 *
 * Run: npm run test:e2e:demo:am15
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). The
 * listener stays down until the final enable-and-prove step, which Applies
 * and sends live traffic so the journal can show matched.
 *
 * Proves the lesson's own beats end to end: import review, generalized
 * `/users/:id`, a draft row, three OpenAPI drafts, a WireMock loss report,
 * and a matched journal row after enable.
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

test.describe('Demo lesson AM-15 — Import Everything: cURL, OpenAPI, WireMock, HAR, Catalog', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 9 steps and ends on a matched journal row', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am15');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am15} / ${AM_LESSON_STEPS.am15}`);
    await expect(page.locator(API_MOCK.TX_OUTCOME).first()).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('opens import review after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am15);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.IMPORT_REVIEW)).toBeVisible();
    await expect(page.locator(API_MOCK.IMPORT_SOURCES)).toBeVisible();
  });

  test('generalizes /users/42 to /users/:id after the second step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am15);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.IMPORT_PREVIEW_PATH)).toHaveText('/users/:id');
  });

  test('shows a draft row after the third step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am15);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.DRAFT_ROUTE).first()).toBeVisible();
  });

  test('shows the WireMock loss report after the fifth step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am15);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.IMPORT_LOSS)).toBeVisible();
  });
});
