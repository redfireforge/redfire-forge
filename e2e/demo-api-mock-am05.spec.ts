/**
 * Demo lesson smoke — AM-05 `am-05-request-predicates`
 * (Query, Header, Cookie & Security Conditions).
 *
 * Run: npm run test:e2e:demo:am05
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — every verdict comes from Simulate — so the companion on :3001 is
 * not required.
 *
 * Proves the lesson's own beats end to end: the unconditioned rule grows a query
 * condition, a header condition walks the operator list, the Security source swaps the
 * key field for a facet picker, a nested None-of group guards on presence, a cookie
 * regex is applied from the wand, and the toolbox's Query & headers tab lands two more
 * rows in one pass — seven condition rows across five sources.
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

/** The corpus ships one rule and the lesson never adds another. */
const RULE_COUNT = 1;

/**
 * Condition rows at the end, nested leaf included: query `page`, header `x-tenant`,
 * security `scheme`, the guard's `x-debug`, cookie `sid`, then the two the
 * Query & headers tab applied (`x-api-version`, `format`).
 */
const FINAL_CONDITION_COUNT = 7;

const QUERY_VALUE = '2';
const HEADER_VALUE = 'acme-eu';
const SECURITY_VALUE = 'Bearer';
const COOKIE_REGEX = '^S-[0-9]{4}$';

/** Value box of the row that was authored last — rows carry generated ids. */
const CONDITION_VALUES = `${API_MOCK.CONDITION_ROWS} input[aria-label="Condition value"]`;

test.describe('Demo lesson AM-05 — Request Conditions', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on seven conditions across five sources', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am05');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am05} / ${AM_LESSON_STEPS.am05}`);
    // Conditions were authored onto the one corpus rule — no rule was ever added.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(FINAL_CONDITION_COUNT);
    // The guard survived every later step that rebuilt the tree.
    await expect(page.locator(API_MOCK.NESTED_GROUPS)).toHaveCount(1);
    await expect(page.locator(API_MOCK.NESTED_GROUPS)).toContainText('None of');
    // Both overlays were closed on the way out, so the Studio is back on screen.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });

  test('starts unconditioned, then grows its first query condition', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am05);

    // The corpus rule matches on method and path alone — that is the problem statement.
    await expect(page.locator(API_MOCK.CONDITIONS_EMPTY)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(0);

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    await expect(page.locator(API_MOCK.CONDITIONS_EMPTY)).toHaveCount(0);
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(QUERY_VALUE);
  });

  test('proves the query condition in both directions and closes Simulate', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am05);
    // 1 advance from step 1 → step 2 reading: the first condition is already authored.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);

    // Step 2 runs `?page=2` (matched) then `?page=3` (conditions failed).
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    // Simulate never edits the rule — the condition it probed is untouched.
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
    await expect(page.locator(CONDITION_VALUES).first()).toHaveValue(QUERY_VALUE);
  });

  test('pins the header exactly, then reads auth through the Security facet', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am05);
    // 2 advances from step 1 → step 3 reading: first condition, then the Simulate proof.
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);

    // Step 3 adds the tenant header, tries Prefix, then pins Exact.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(2, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(CONDITION_VALUES).last()).toHaveValue(HEADER_VALUE);

    // Step 4 switches the source to Security; the key field becomes a facet picker.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(3, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(CONDITION_VALUES).last()).toHaveValue(SECURITY_VALUE);
  });

  test('guards with a nested None-of group whose value box is disabled', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am05);
    // 4 advances from step 1 → step 5 reading: query, proof, header, security.
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.NESTED_GROUPS)).toHaveCount(0);

    // Step 5 adds the group, sets None of, and puts a Present check inside it.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.NESTED_GROUPS)).toHaveCount(1, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.NESTED_GROUPS)).toContainText('None of');
    // Presence needs nothing to compare against, so the value box is disabled.
    await expect(page.locator(`${API_MOCK.NESTED_GROUPS} input[aria-label="Condition value"]`))
      .toBeDisabled();
  });

  test('applies a cookie regex from the wand, then two rows from the composer', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am05);
    // 5 advances from step 1 → step 6 reading: through the guard-group beat.
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);

    // Step 6 tests the pattern in the toolbox, flips Ignore case, and applies.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(5);
    await expect(page.locator(CONDITION_VALUES).last()).toHaveValue(COOKIE_REGEX);

    // Step 7 composes two constraints and applies them as ordinary condition rows.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(FINAL_CONDITION_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0);
  });
});
