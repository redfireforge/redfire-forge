/**
 * Demo lesson smoke — AM-06 `am-06-body-matching`
 * (Body Matching: Subset, Strict, JSONPath & JSON Schema).
 *
 * Run: npm run test:e2e:demo:am06
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — every verdict comes from Simulate — so the companion on :3001 is
 * not required.
 *
 * Proves the lesson's own beats end to end: the corpus subset matcher survives a detour
 * through strict equality, a JSONPath row is derived from a selection in the toolbox
 * sample body, the match-style button widens it to a substring reading, and a JSON Schema
 * lands as a third condition — three body matchers on one rule, no rule ever added.
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

/** Subset baseline, the JSONPath matcher, and the schema contract. */
const FINAL_CONDITION_COUNT = 3;

const JSONPATH = '$.items[0].sku';
const SKU = 'RF-100';
const SKU_FAMILY = 'RF-';

/** Operator pickers carry the chosen operator on `data-value`. */
const CONDITION_OPERATORS = '[data-testid^="api-mock-condition-operator-"]';
/** Expected-JSON textarea of a subset / strict / schema row. */
const CONDITION_SCHEMAS = 'textarea[aria-label="Condition schema"]';
const CONDITION_JSONPATHS = 'input[aria-label="Condition JSONPath"]';
const CONDITION_VALUES = `${API_MOCK.CONDITION_ROWS} input[aria-label="Condition value"]`;
const CONDITION_MATCH_STYLES = '[data-testid^="api-mock-condition-matchstyle-"]';

test.describe('Demo lesson AM-06 — Body Matching', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 6 steps and ends on three body matchers', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am06');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am06} / ${AM_LESSON_STEPS.am06}`);
    // Matchers were authored onto the one corpus rule — no rule was ever added.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(FINAL_CONDITION_COUNT);
    await expect(page.locator(CONDITION_OPERATORS).nth(0)).toHaveAttribute('data-value', 'json_subset');
    await expect(page.locator(CONDITION_OPERATORS).nth(1)).toHaveAttribute('data-value', 'jsonPath_equals');
    await expect(page.locator(CONDITION_OPERATORS).nth(2)).toHaveAttribute('data-value', 'jsonSchema');
    // Both overlays were closed on the way out, so the Studio is back on screen.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });

  test('opens on a body condition with no key, and proves subset ignores extras', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am06);

    // The corpus rule already reads the body — that is the starting point, not the payoff.
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'json_subset');
    await expect(page.locator(CONDITION_SCHEMAS).first()).toContainText('gold');
    // A body row has nothing to name, so there is no key input at all.
    await expect(page.locator(`${API_MOCK.CONDITION_ROWS} input[aria-label="Condition key"]`))
      .toHaveCount(0);

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    // Simulate never edits the rule, and the step closes it before advancing.
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
  });

  test('detours through strict equality and restores the subset baseline', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am06);
    // 1 advance from step 1 → step 2 reading: the baseline proof already ran.
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);

    // Step 2 switches to json_strict, proves the failure, then switches back.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(CONDITION_OPERATORS).first())
      .toHaveAttribute('data-value', 'json_subset');
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(1);
  });

  test('derives a JSONPath matcher from the toolbox sample body', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am06);
    // 2 advances from step 1 → step 3 reading: baseline proof, then the strict detour.
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);

    // Step 3 pastes a payload, selects a value, and applies the derived matcher.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(2);
    await expect(page.locator(CONDITION_OPERATORS).last())
      .toHaveAttribute('data-value', 'jsonPath_equals');
    // The path was never typed — it came from the selection in the sample editor.
    await expect(page.locator(CONDITION_JSONPATHS).last()).toHaveValue(JSONPATH);
    await expect(page.locator(CONDITION_VALUES).last()).toHaveValue(SKU);
    // A filled Expected value is what makes this equals rather than exists.
    await expect(page.locator(CONDITION_MATCH_STYLES)).toHaveText('equals');
  });

  test('widens the JSONPath row from equals to contains', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am06);
    // 3 advances from step 1 → step 4 reading: through the pick-from-JSON beat.
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(CONDITION_MATCH_STYLES)).toHaveText('equals', {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });

    // Step 4 flips the match style and widens the value to the SKU family.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(CONDITION_MATCH_STYLES)).toHaveText('contains');
    await expect(page.locator(CONDITION_VALUES).last()).toHaveValue(SKU_FAMILY);
    await expect(page.locator(CONDITION_JSONPATHS).last()).toHaveValue(JSONPATH);
  });

  test('applies a JSON Schema contract as a third body matcher', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am06);
    // 4 advances from step 1 → step 5 reading: through the match-style beat.
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);

    // Step 5 lands a preset, replaces it with the contract, and applies.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.PATTERN_TOOLBOX)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(FINAL_CONDITION_COUNT);
    await expect(page.locator(CONDITION_OPERATORS).last())
      .toHaveAttribute('data-value', 'jsonSchema');
    // The preset was replaced — the applied schema is the real contract.
    await expect(page.locator(CONDITION_SCHEMAS).last()).toContainText('platinum');
  });

  test('closes Simulate on the closing proof and leaves the rule intact', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am06);
    // 5 advances from step 1 → step 6 reading: through the schema beat.
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);

    // Step 6 runs the short payload, then the complete one, and reads Rendered.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONDITION_ROWS)).toHaveCount(FINAL_CONDITION_COUNT);
    await expect(page.locator(API_MOCK.ROUTE_EXPLORER)).toBeVisible();
  });
});
