/**
 * Demo lesson smoke — AM-16 `am-16-export`
 * (Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction).
 *
 * Run: npm run test:e2e:demo:am16
 * Prereqs: dev server :5173 (Playwright `webServer`). Offline — the lesson
 * never binds a listener. Companion :3001 is not required.
 *
 * Proves the lesson's own beats end to end: export confirmation, redacted TLS
 * key, WireMock loss notes, HAR entry count, duplicated copy rows, and the
 * copyable CLI handoff in the routes footer.
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

test.describe('Demo lesson AM-16 — Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 6 steps and ends on the CLI handoff', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am16');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am16} / ${AM_LESSON_STEPS.am16}`);
    await expect(page.locator(API_MOCK.CLI_SIMULATE).first()).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('opens the export confirmation after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am16);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.EXPORT_CONFIRM)).toBeVisible();
    await expect(page.locator(API_MOCK.EXPORT_SAVE)).toBeVisible();
    await expect(page.locator(API_MOCK.EXPORT_PREVIEW)).toBeVisible();
  });

  test('shows the redacted TLS key after the redaction step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am16);
    // Step 1 exports Workspace JSON; step 2 (redaction) reuses that same confirm.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.EXPORT_TLS_KEY)).toHaveText('***REDACTED***');
    await expect(page.locator(API_MOCK.EXPORT_REDACTION)).toBeVisible();
  });

  test('shows the WireMock loss report after the interop step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am16);
    // Step 4 (interop) exports HAR then WireMock, ending on the loss report.
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.EXPORT_LOSS)).toBeVisible();
  });

  test('duplicates rules after the round-trip step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am16);
    // Round-trip is now step 5.
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.COPIED_ROUTE).first()).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
