/**
 * Demo lesson smoke — AM-24 `am-24-capstone`
 * (Ship a Contract Mock).
 *
 * Run: npm run test:e2e:demo:am24
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`).
 * The lesson imports OpenAPI as drafts, authors the Orders contract live,
 * then Starts a listener and finishes with a Workflow Quick Test.
 * No Docker.
 *
 * Proves the lesson's own beats end to end: drafts after the first step,
 * then a green Assert node after the full walk.
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

test.describe('Demo lesson AM-24 — Ship a Contract Mock', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 9 steps and ends on a green Assert node', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am24');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am24} / ${AM_LESSON_STEPS.am24}`);
    await expect(page.locator(`${API_MOCK.CANVAS_ASSERT}.wf-node-pass`)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('imports OpenAPI drafts and enables POST /orders after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am24);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.ROUTE_ENABLED)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER).getByText('/orders').first()).toBeVisible();
  });

  test('leaves a JSONPath matcher after the second step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am24);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATH_TOOLBOX)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
