/**
 * Demo lesson smoke — AM-22 `am-22-workflow`
 * (Workflow Orchestration: Start → Apply → Reset → Assert → Stop).
 *
 * Run: npm run test:e2e:demo:am22
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Quick
 * Test starts an isolated mock listener and POSTs `/cart`. No Docker.
 *
 * Proves the lesson's own beats end to end: the five mock palette blocks,
 * a configured Start node, then Quick Test greens the assert node.
 */
import { test, expect } from '@playwright/test';
import { API_MOCK } from '../src/shared/selectors/apiMock';
import { WF } from '../src/shared/selectors/wf';
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

test.describe('Demo lesson AM-22 — Workflow Orchestration', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 9 steps and ends with a green assert node', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am22');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am22} / ${AM_LESSON_STEPS.am22}`);
    await expect(page.locator(`${API_MOCK.CANVAS_ASSERT}.wf-node-pass`)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('shows the five mock palette blocks after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am22);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(WF.PAL_API_MOCK_START)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(WF.PAL_API_MOCK_APPLY)).toBeVisible();
    await expect(page.locator(WF.PAL_API_MOCK_RESET)).toBeVisible();
    await expect(page.locator(WF.PAL_API_MOCK_STOP)).toBeVisible();
    await expect(page.locator(WF.PAL_SEARCH)).toHaveValue('Mock');
  });

  test('drops a Start Mock node after the second step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am22);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CANVAS_START)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
