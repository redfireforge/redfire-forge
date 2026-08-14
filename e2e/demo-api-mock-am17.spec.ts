/**
 * Demo lesson smoke — AM-17 `am-17-proxy-record`
 * (Proxy Passthrough & Record-to-Drafts).
 *
 * Run: npm run test:e2e:demo:am17
 * Prereqs: companion :3001 + echo :4017 (`cd docker/api-mock && docker compose up -d`)
 * + dev server :5173 (Playwright `webServer`). Start and the live fetches bind a
 * listener and proxy unmatched traffic to the echo.
 *
 * Proves the lesson's own beats end to end: proxy allowlist, private-net fence,
 * record + unmatched Proxy, Running, a proxied journal row, a recorded draft,
 * then a matched take-over and the 508 / closest-match guards.
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
  isApiMockEchoReady,
  prepareApiMockLessonRun,
  readStepCounter,
  walkApiMockLesson,
} from './api-mock-lesson-smoke-helpers';
import { isApiMockCompanionReady } from './api-mock-multi-server-helpers';

test.describe('Demo lesson AM-17 — Proxy Passthrough & Record-to-Drafts', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    test.skip(!(await isApiMockEchoReady(request)), 'API Mock echo (:4017) not reachable — cd docker/api-mock && docker compose up -d');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on closest-match fallback', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am17');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am17} / ${AM_LESSON_STEPS.am17}`);
    await expect(page.locator(API_MOCK.SETTINGS_FALLBACK_MODE)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('fills the echo allowlist after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am17);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SETTINGS_PROXY_ALLOWLIST)).toHaveValue('http://localhost:4017');
    await expect(page.locator(API_MOCK.SETTINGS_PROXY_DENY)).toBeVisible();
  });

  test('shows the private-network fence after the safety step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am17);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SETTINGS_PROXY_PRIVATE)).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator(API_MOCK.SETTINGS_PROXY_FORWARD_AUTH)).toHaveAttribute('aria-checked', 'true');
  });

  test('shows a proxied journal row after the live fetch', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am17);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.TX_OUTCOME).first()).toContainText(/proxied/i, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });
});
