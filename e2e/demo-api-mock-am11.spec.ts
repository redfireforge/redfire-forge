/**
 * Demo lesson smoke — AM-11 `am-11-templating`
 * (Dynamic Responses: Templates, Faker & Body Mapper).
 *
 * Run: npm run test:e2e:demo:am11
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Apply
 * and the two live fetches bind a listener and send real traffic.
 *
 * Proves the lesson's own beats end to end: Monaco `{{` completions, Browse
 * helpers, the TEMPLATE badge, faker/variables preview, Apply + two journaled
 * responses, Map body, and a template diagnostic that clears.
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

test.describe('Demo lesson AM-11 — Dynamic Responses: Templates, Faker & Body Mapper', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 9 steps and ends on a clean preview', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am11');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am11} / ${AM_LESSON_STEPS.am11}`);
    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.TEMPLATE_ERROR)).toHaveCount(0);
  });

  test('opens Browse helpers on step 1 then leaves the catalog closed', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am11);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TEMPLATE_HELPERS_BROWSE)).toBeVisible();
    await expect(page.locator(API_MOCK.TEMPLATE_HELPERS_MODAL)).toHaveCount(0);
  });

  test('opens the TEMPLATE badge after echoing the request', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am11);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.BODY_TEMPLATE_BADGE)).toBeVisible();
    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toContainText('42');
  });

  test('resolves a tenant variable in the preview', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am11);
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toContainText('acme');
  });

  test('applies and journals two different responses', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am11);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TX_DETAIL)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.TX_RESPONSE)).toContainText('42');
  });

  test('reports a broken helper then clears it', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am11);
    await advanceSteps(page, 8, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TEMPLATE_ERROR)).toHaveCount(0);
    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toBeVisible();
  });
});
