/**
 * Demo lesson smoke — AM-12 `am-12-variants-sequence`
 * (Response Variants: Rules & Sequence Modes).
 *
 * Run: npm run test:e2e:demo:am12
 * Prereqs: companion :3001 + dev server :5173 (Playwright `webServer`). Apply
 * and the three live fetches bind a listener and send real traffic.
 *
 * Proves the lesson's own beats end to end: a 404 sibling, JSONPath conditions,
 * Default, Simulate 404 then 200, Sequence, three journaled responses, and the
 * live sequence cursor on the State tab.
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

test.describe('Demo lesson AM-12 — Response Variants: Rules & Sequence Modes', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await isApiMockCompanionReady(request)), 'API Mock companion (:3001) not reachable');
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on the live sequence cursor', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am12');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am12} / ${AM_LESSON_STEPS.am12}`);
    await expect(page.locator(API_MOCK.DOCK_SEQ_ROW).first()).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
  });

  test('adds a 404 sibling after the first step', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am12);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.VARIANT_CARD)).toHaveCount(2);
    await expect(page.locator(API_MOCK.VARIANT_CARD_LAST)).toContainText('404');
  });

  test('sets a JSONPath condition on the not-found variant', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am12);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SELECTION_CONDITION)).toContainText('$.sku');
  });

  test('switches to sequence and shows the position cursor', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am12);
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SEQUENCE_POSITION)).toBeVisible();
    await expect(page.locator(API_MOCK.RESPONSE_MODE_SEQUENCE)).toHaveAttribute('aria-pressed', 'true');
  });
});
