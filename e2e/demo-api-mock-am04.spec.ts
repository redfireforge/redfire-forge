/**
 * Demo lesson smoke — AM-04 `am-04-path-matching` (Path Matching & the Pattern Toolbox).
 *
 * Run: npm run test:e2e:demo:am04
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — every verdict comes from Simulate — so the companion on :3001 is
 * not required.
 *
 * Proves the lesson's own beats end to end: a literal rewritten as a template, two
 * rules authored live through the toolbox (a generalized order lookup and an asset
 * glob), an anchored regex applied from the pattern library, and Simulate rejecting
 * the request the tightened matcher is supposed to reject.
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

/** The corpus ships one literal rule; the lesson authors two more live. */
const FINAL_RULE_COUNT = 3;

const LITERAL_PATH = '/products/42';
const PARAM_PATH = '/products/:id';
const REGEX_PATH = '^/products/[0-9]+$';
const ORDER_TEMPLATE_PATH = '/orders/:orderId';
const ASSET_GLOB_PATH = '/assets/**';

test.describe('Demo lesson AM-04 — Path Matching', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 7 steps and ends on three rules with an anchored regex', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am04');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am04} / ${AM_LESSON_STEPS.am04}`);
    // Each toolbox beat re-opened an existing rule rather than adding a duplicate.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(FINAL_RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    // The products rule ended on the regex the library beat applied.
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(REGEX_PATH);
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('regex');
    // Simulate was closed on the way out, so the Studio is back on screen.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });

  test('infers the parameterized kind from the path text alone', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am04);

    // The corpus rule is the literal a recording leaves behind.
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(LITERAL_PATH, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('exact');

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(PARAM_PATH);
    // No selector was touched — the badge re-inferred itself from `:id`.
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('parameterized');
  });

  test('proves the loose template matches a non-numeric id', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am04);
    // 1 advance from step 1 → step 2 reading: the exact-to-parameterized rewrite.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);

    // Step 2 runs /products/7, then /products/abc — both against the template.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    // `:id` accepts any single segment, which is the point the step is making.
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('parameterized', {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    // The step closes Simulate so the next spotlight lands on the editor.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
  });

  test('leaves the rule untouched when the toolbox is cancelled', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am04);
    // 2 advances from step 1 → step 3 reading: rewrite, then the Simulate proof.
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);

    // Step 3 loads three presets into the toolbox and cancels out of it.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    // Presets never reached the rule: the path is still the step-1 template.
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(PARAM_PATH);
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('parameterized');
  });

  test('generalizes a recorded order path, then applies a glob for a subtree', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am04);
    // 3 advances from step 1 → step 4 reading: rewrite, proof, toolbox tour.
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);

    // Step 4 adds the order rule and generalizes its id segment in the toolbox.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(ORDER_TEMPLATE_PATH, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('parameterized');

    // Step 5 adds the asset catch-all and applies `**` after the `*` contrast.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(ASSET_GLOB_PATH, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('glob');
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(FINAL_RULE_COUNT);
  });

  test('rejects a non-numeric id once the anchored regex is applied', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am04);
    // 5 advances from step 1 → step 6 reading: through the generalize and glob beats.
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);

    // Step 6 picks the library pattern, anchors it to the whole path, and applies.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.PATH_INPUT)).toHaveValue(REGEX_PATH, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.PATH_KIND)).toHaveText('regex');

    // Step 7 runs /products/abc (rejected) then /products/42 (still served).
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(FINAL_RULE_COUNT);
  });
});
