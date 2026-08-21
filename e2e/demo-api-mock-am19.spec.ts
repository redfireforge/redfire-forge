/**
 * Demo lesson smoke — AM-19 `am-19-runtime-ops`
 * (Runtime Ops: CORS, Limits, Redaction, Diagnostics & Console).
 *
 * Run: npm run test:e2e:demo:am19
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Start
 * and the live fetches bind a listener, prove CORS preflight, redaction, and
 * the setHeader transform. No Docker.
 *
 * Proves the lesson's own beats end to end: CORS origins, redacted journal
 * detail, diagnostics p95, outbound transform, then X-Mocked-By on a live
 * response.
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

test.describe('Demo lesson AM-19 — Runtime Ops: CORS, Limits, Redaction, Diagnostics & Console', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on the injected transform header', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am19');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am19} / ${AM_LESSON_STEPS.am19}`);
    await expect(page.locator(API_MOCK.TX_RESPONSE)).toContainText(/X-Mocked-By/i, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('fills CORS origins after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am19);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.RUNTIME_SETTINGS_CORS_ORIGINS)).toHaveValue(/localhost:5173/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('fills redact paths after redaction-config', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am19);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.RUNTIME_SETTINGS_REDACT_PATHS)).toHaveValue(/\$\.password/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('masks the secret in journal detail after prove-redaction', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am19);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TX_REQUEST)).toContainText(/REDACTED/, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('shows match p95 after persist-and-diagnostics', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am19);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.DIAG_MATCH_P95)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
