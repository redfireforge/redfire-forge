/**
 * Demo lesson smoke — AM-03 `am-03-rule-library` (Rule Library: Folders, Search, Filters & Docs).
 *
 * Run: npm run test:e2e:demo:am03
 * Prereqs: dev server :5173 (Playwright `webServer`). No listener is bound by this
 * lesson, so the companion on :3001 is not required.
 *
 * Proves the lesson's own beats end to end: a folder authored and filled by drag,
 * a rule deleted and restored through the undo window, documentation written and
 * then found by search, and Analyze flagging the deliberate overlap.
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

/** The corpus ships twelve rules; the lesson must end with all twelve intact. */
const LIBRARY_SIZE = 12;
/** Two rules ship disabled — the drafts the filter step hides and re-shows. */
const DRAFT_COUNT = 2;
/** Folder authored live in the folders step. */
const NEW_FOLDER = 'Checkout';

test.describe('Demo lesson AM-03 — Rule Library', () => {
  test.beforeEach(async ({ page, request }) => {
    await prepareApiMockLessonRun(page, request);
  });

  test.afterEach(async ({ request }) => {
    await cleanupApiMockLessonRun(request);
  });

  test('walks all 8 steps and ends on an analyzed, intact library', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await walkApiMockLesson(page, 'am03');

    expect(await readStepCounter(page)).toContain(`${AM_LESSON_STEPS.am03} / ${AM_LESSON_STEPS.am03}`);
    // Analyze all jumps to Conflicts; the overlap is the inspector's first finding.
    await expect(page.locator(API_MOCK.CONFLICTS_PAGE)).toBeVisible({ timeout: AM_LESSON_STEP_TIMEOUT });
    await expect(page.locator(API_MOCK.CONFLICT_INSPECTOR)).toBeVisible();
    await expect(page.locator(API_MOCK.CONFLICT_SUMMARY)).toContainText(/finding/i);
  });

  test('authors a folder and files the write rule into it by drag', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am03);
    // 3 advances from step 1 → step 4 reading: tour, search, then filters.
    await advanceSteps(page, 3, AM_LESSON_STEP_TIMEOUT);

    // Search cleared and drafts re-shown by the end of the filters step.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(LIBRARY_SIZE, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.DRAFT_ROUTE)).toHaveCount(DRAFT_COUNT);

    // Step 4 adds the folder, renames it, and drags POST /orders in.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    const folder = page.locator(API_MOCK.folderNamed(NEW_FOLDER));
    await expect(folder).toHaveCount(1, { timeout: AM_LESSON_STEP_TIMEOUT });
    await expect(folder.locator('.am-route-path')).toHaveText(['/orders']);
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(LIBRARY_SIZE);
  });

  test('documents a draft rule, then finds it by the tag just written', async ({ page }) => {
    test.setTimeout(AM_LESSON_TIMEOUT);

    await launchApiMockLesson(page, AM_LESSON_NAMES.am03);
    // 6 advances from step 1 → step 7 reading: through disable and delete/undo.
    await advanceSteps(page, 6, AM_LESSON_STEP_TIMEOUT);

    // The undo window restored the deleted draft, so nothing was lost on the way here.
    await expect(page.locator(API_MOCK.ROUTE_ROW)).toHaveCount(LIBRARY_SIZE, {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });

    // Step 7 writes summary, operationId, and tags on GET /products/search.
    await completeCurrentStepAction(page, AM_LESSON_STEP_TIMEOUT);
    await expect(page.locator(API_MOCK.DOCS_OPERATION_ID)).toHaveValue('searchProducts', {
      timeout: AM_LESSON_STEP_TIMEOUT,
    });
    await expect(page.locator(API_MOCK.DOCS_TAGS)).toHaveValue(/regression/);
    await expect(page.locator(API_MOCK.ROUTE_TITLE)).toContainText('Search products by keyword');
    // The step probes search with the new tag and clears it again.
    await expect(page.locator(API_MOCK.ROUTE_SEARCH)).toHaveValue('');
  });
});
