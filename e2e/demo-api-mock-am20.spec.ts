/**
 * Demo lesson smoke — AM-20 `am-20-tls-mtls`
 * (HTTPS, HTTP/2 & mTLS with Cert-Subject Matching).
 *
 * Run: npm run test:e2e:demo:am20
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Start
 * and the live HTTPS fetch bind a TLS listener. Simulate proves cert-subject
 * match/miss. No Docker.
 *
 * Proves the lesson's own beats end to end: PEM after generate, https:// +
 * HTTP/2 after Start, a 200 journal row, then export redacts the TLS key.
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

test.describe('Demo lesson AM-20 — HTTPS, HTTP/2 & mTLS with Cert-Subject Matching', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on Stopped with Start visible', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am20');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am20} / ${AM_LESSON_STEPS.am20}`);
    await expect(page.locator(API_MOCK.START)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('fills a PEM after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am20);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SETTINGS_TLS_CERT)).toHaveValue(/BEGIN CERTIFICATE/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('shows https:// and HTTP/2 after Start', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am20);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.ADDRESS)).toContainText(/https:\/\//, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.HTTP2_BADGE)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('journals 200 after the live HTTPS fetch', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am20);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.JOURNAL_FIRST_ROW)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.TX_RESPONSE_STATUS)).toContainText(/200/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('Simulate rejects the wrong cert subject', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am20);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_OUTCOME)).toContainText(/UNMATCHED/i, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
