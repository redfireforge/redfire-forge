/**
 * Demo lesson smoke — AM-10 `am-10-response-content`
 * (Response Content: Status, Headers, Cookies & Body Kinds).
 *
 * Run: npm run test:e2e:demo:am10
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Apply and
 * the journal proof bind a listener and send real traffic.
 *
 * Proves the lesson's own beats end to end: 201 + custom reason, Format, two
 * headers, an HttpOnly cookie, the rendered preview, HTML/binary kinds restored
 * to JSON, Apply bumping generation, and a real GET /orders in TX_DETAIL.
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

test.describe('Demo lesson AM-10 — Response Content: Status, Headers, Cookies & Body Kinds', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on the journaled response', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am10');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am10} / ${AM_LESSON_STEPS.am10}`);
    await expect(page.locator(API_MOCK.TX_DETAIL)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.TX_RESPONSE)).toContainText('201');
  });

  test('authors 201 and a custom reason phrase', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.VARIANT_STATUS)).toHaveValue('201');
    await expect(page.locator(API_MOCK.VARIANT_STATUS_REASON)).toHaveValue('Resource created');
    await expect(page.locator(API_MOCK.PREVIEW_STATUS)).toContainText('201 Resource created');
  });

  test('formats the minified JSON body and updates the size badge', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.BODY_SIZE)).toBeVisible();
    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toContainText('ord-1001');
  });

  test('adds two response headers', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.HEADER_ROW)).toHaveCount(2);
    await expect(page.locator(API_MOCK.PREVIEW_HEADERS)).toContainText('2 header');
  });

  test('names an HttpOnly cookie', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.COOKIE_ROW)).toBeVisible();
    await expect(page.locator(API_MOCK.COOKIE_NAME)).toHaveValue('sid');
    await expect(page.locator(API_MOCK.COOKIE_HTTPONLY)).toBeChecked();
    await expect(page.locator(API_MOCK.PREVIEW_COOKIES)).toContainText('1 cookie');
  });

  test('reads the rendered preview', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.RESPONSE_PREVIEW)).toBeVisible();
    await expect(page.locator(API_MOCK.PREVIEW_STATUS)).toContainText('201');
    await expect(page.locator(API_MOCK.PREVIEW_HEADERS)).toBeVisible();
    await expect(page.locator(API_MOCK.PREVIEW_COOKIES)).toBeVisible();
  });

  test('tours HTML and binary then restores JSON', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PREVIEW_BODY)).toContainText('ord-1001');
    await expect(page.locator(API_MOCK.BODY_BINARY_HINT)).toHaveCount(0);
  });

  test('applies the running listener and bumps generation', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am10);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.GENERATION)).toBeVisible();
    await expect(page.locator(API_MOCK.STATUS_LABEL)).toContainText(/running/i);
  });
});
