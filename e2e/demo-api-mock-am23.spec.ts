/**
 * Demo lesson smoke — AM-23 `am-23-harness-ci`
 * (Test Runner Fixtures & CI Handoff).
 *
 * Run: npm run test:e2e:demo:am23
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). The
 * fixture starts an isolated Store listener and GETs `/products` + `/cart`.
 * No Docker.
 *
 * Proves the lesson's own beats end to end: fixture panel with Store selected,
 * isolate on, then the explorer footer after the full walk.
 */
import { test, expect } from '@playwright/test';
import { API_MOCK } from '../src/shared/selectors/apiMock';
import { HAR } from '../src/shared/selectors/har';
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

test.describe('Demo lesson AM-23 — Test Runner Fixtures & CI Handoff', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 7 steps and ends on the explorer footer', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am23');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am23} / ${AM_LESSON_STEPS.am23}`);
    await expect(page.locator(API_MOCK.ROUTES_FOOTER)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CLI_VERIFY)).toBeVisible();
  });

  test('selects Store API in the fixture panel after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am23);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(HAR.HARNESS_MOCK_SERVER)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(HAR.HARNESS_MOCK_SERVER)).toHaveAttribute('data-value', /./);
    await expect(page.locator(`${HAR.HARNESS_MOCK_SERVER} .cs-text`)).toContainText(/Store/i);
  });

  test('leaves isolate on after the second step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am23);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(HAR.HARNESS_MOCK_ISOLATE)).toBeChecked({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(HAR.HOST_SELECTOR).first()).toBeVisible();
    await expect(page.locator(HAR.HOST_MOCK_SERVER).first()).toBeVisible();
    await expect(page.locator(HAR.HARNESS_MOCK_SERVER).first()).toBeVisible();
  });
});
