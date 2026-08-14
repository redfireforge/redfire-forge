/**
 * Demo lesson smoke — AM-08 `am-08-selection-policy`
 * (Boolean Groups, Priority & Selection Policy).
 *
 * Run: npm run test:e2e:demo:am08
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — every verdict comes from Simulate — so the companion on :3001 is
 * not required.
 *
 * Proves the lesson's own beats end to end: a nested Any-of tenant group under All of,
 * a None-of debug guard with the fail-closed note, Simulate reporting AMBIGUOUS on the
 * overlapping request, Regional raised to priority 20, then the two multiple-match
 * policies (highest-priority Winner vs reject-multiple 409 vs specificity breakdown).
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

const RULE_COUNT = 2;
const NESTED_GROUPS = API_MOCK.NESTED_GROUPS;
const PRIORITY = API_MOCK.PRIORITY_INPUT;
const FAIL_CLOSED = '[data-testid^="api-mock-group-failclosed-"]';
const GROUP_COMBINATOR = '[data-testid^="api-mock-group-combinator-"]';

const regionalDelete = 'Delete rule Regional catalog';

test.describe('Demo lesson AM-08 — Boolean Groups, Priority & Selection Policy', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends with both catalog rules still in the explorer', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am08');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am08} / ${AM_LESSON_STEPS.am08}`);
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(NESTED_GROUPS)).toHaveCount(2);
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.SETTINGS_MODAL)).toHaveCount(0);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });

  test('opens on two overlapping GET /catalog rules and nests an Any-of group', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);

    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.getByLabel(regionalDelete)).toHaveCount(1);
    await expect(page.getByLabel('Delete rule Default catalog')).toHaveCount(1);

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(NESTED_GROUPS)).toHaveCount(1);
    await expect(page.locator(NESTED_GROUPS).locator(GROUP_COMBINATOR)).toHaveAttribute('data-value', 'any');
  });

  test('authors both tenant exacts inside the nested Any-of', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    const tenantValues = page.locator(`${NESTED_GROUPS} input[aria-label="Condition value"]`);
    await expect(tenantValues).toHaveCount(2);
    await expect(tenantValues.nth(0)).toHaveValue('acme-eu');
    await expect(tenantValues.nth(1)).toHaveValue('acme-us');
  });

  test('adds a None-of guard and shows the fail-closed note', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(NESTED_GROUPS)).toHaveCount(2);
    await expect(page.locator(FAIL_CLOSED)).toHaveCount(1);
    await expect(page.locator(FAIL_CLOSED)).toContainText('Fails closed');
  });

  test('proves the overlap in Simulate, then closes it', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT);
  });

  test('raises Regional priority to 20 and closes Settings', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SETTINGS_MODAL)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(PRIORITY)).toHaveValue('20');
  });

  test('proves the quiet policy, then closes Simulate', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(PRIORITY)).toHaveValue('20');
  });

  test('rejects multiple matches even at priority 20, then closes overlays', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SETTINGS_MODAL)).toHaveCount(0);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });

  test('breaks the equal-priority tie by specificity', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am08);
    await advanceSteps(page, 7, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SETTINGS_MODAL)).toHaveCount(0);
    await expect(page.locator(PRIORITY)).toHaveValue('10');
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });
});
