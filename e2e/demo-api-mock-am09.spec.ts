/**
 * Demo lesson smoke — AM-09 `am-09-conflicts`
 * (Conflict Inspector: Four Overlap Kinds → Fix → Acknowledge).
 *
 * Run: npm run test:e2e:demo:am09
 * Prereqs: dev server :5173 (Playwright `webServer`). The lesson binds no listener and
 * sends no traffic — analysis is static and the witness is proven in Simulate — so the
 * companion on :3001 is not required.
 *
 * Proves the lesson's own beats end to end: Analyze writes four findings, Duplicate
 * fingerprints, Shadowed dimensions, Definite vs Potential unknown, a GET /health
 * witness coming back AMBIGUOUS, Open in Studio then return, raising Daily reclassifies
 * Definite to empty, and acknowledging then editing a fingerprint marks the pair Stale.
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

const RULE_COUNT = 8;
const FILTER_DUPLICATE = API_MOCK.conflictFilter('duplicate');
const FILTER_SHADOWED = API_MOCK.conflictFilter('shadowed');
const FILTER_DEFINITE = API_MOCK.conflictFilter('definite_overlap');
const FILTER_POTENTIAL = API_MOCK.conflictFilter('potential_overlap');

test.describe('Demo lesson AM-09 — Conflict Inspector: Four Overlap Kinds', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on a stale acknowledgement', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am09');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am09} / ${AM_LESSON_STEPS.am09}`);
    await expect(page.locator(API_MOCK.CONFLICT_STALE)).toBeVisible({
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('analyzes eight overlapping rules into four findings', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);

    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(RULE_COUNT, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });

    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_LIST)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_SUMMARY)).toContainText('4 finding');
    await expect(page.locator(API_MOCK.FIRST_FINDING)).toHaveCount(4);
  });

  test('filters Duplicate and opens rule fingerprints', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 1, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_DUPLICATE)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINTS_OPEN)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_HASHES)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_LEFT)).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_RIGHT)).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.locator(API_MOCK.CONFLICT_FINGERPRINT_RELATION)).toContainText('Different hashes');
    await expect(page.locator(API_MOCK.FIRST_FINDING)).toHaveCount(1);
  });

  test('filters Shadowed and shows the dimension table', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 2, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_SHADOWED)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_DETAIL)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_DIMENSIONS)).toBeVisible();
  });

  test('contrasts Definite with Potential unknown', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(FILTER_POTENTIAL)).toHaveClass(/active/);
    await expect(page.locator(API_MOCK.CONFLICT_DIM_UNKNOWN)).toBeVisible();
    await expect(page.locator(FILTER_DEFINITE)).toBeVisible();
  });

  test('simulates the duplicate witness then closes Simulate', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 4, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
  });

  test('opens the left rule in Studio then returns to Conflicts', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 5, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
    await expect(page.locator(API_MOCK.ROUTE_EDITOR)).toHaveCount(0);
  });

  test('raises Daily priority and empties the Definite filter', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_SUMMARY)).toContainText('4 finding');
    await expect(page.locator(FILTER_SHADOWED)).toHaveClass(/active/);
  });

  test('acknowledges the duplicate then marks it Stale after a fingerprint edit', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am09);
    await advanceSteps(page, 7, AM_LESSON_STEP_TIMEOUT);
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);

    await expect(page.locator(API_MOCK.CONFLICT_STALE)).toBeVisible();
    await expect(page.locator(API_MOCK.SIMULATE_WORKSPACE)).toHaveCount(0);
  });
});
