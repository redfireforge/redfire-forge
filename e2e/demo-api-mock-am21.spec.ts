/**
 * Demo lesson smoke — AM-21 `am-21-simulation-suite`
 * (Simulation as a Test Suite: Examples, Assertions, Trace).
 *
 * Run: npm run test:e2e:demo:am21
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson never starts
 * a listener — every verdict comes from Simulate — so the companion on :3001
 * is not required.
 *
 * Proves the lesson's own beats end to end: saved samples, an ad-hoc result,
 * FAIL after an expectation edit, run-all tally, and an attached example.
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

test.describe('Demo lesson AM-21 — Simulation as a Test Suite', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on the attached example', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am21');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am21} / ${AM_LESSON_STEPS.am21}`);
    await expect(page.locator(API_MOCK.exampleRow('sample-orphan'))).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
  });

  test('shows saved samples after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am21);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_SECTION_SAVED)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_OUTCOME)).toBeVisible();
  });

  test('fails the health sample after the expectation edit', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am21);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_FAIL_BADGE)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('shows a run-all tally after the fifth step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am21);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_SUMMARY)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
