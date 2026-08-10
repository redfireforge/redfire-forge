/**
 * Shared helpers for Demo Hub → Workflows domain lesson E2E walks.
 */
import { expect, type Page } from '@playwright/test';
import { openDemoHub, startLesson, playThroughLesson } from './demo-player-helpers';

export type WfCategoryTab = 'Fundamentals' | 'Logic' | 'Tools';

/** Open Demo Hub → Workflows → category tab → lesson player (before Start Demo). */
export async function openWorkflowLesson(
  page: Page,
  category: WfCategoryTab,
  lessonNameFragment: string | RegExp,
): Promise<void> {
  await openDemoHub(page);

  const workflowsCard = page
    .locator('.demo-domain-card')
    .filter({ hasText: /Workflows/i })
    .first();
  await expect(workflowsCard).toBeVisible({ timeout: 15_000 });
  await workflowsCard.click();
  await page.waitForSelector('.demo-lesson-list', { timeout: 15_000 });

  const categoryRe =
    category === 'Fundamentals'
      ? /Fundamentals/i
      : category === 'Logic'
        ? /Logic/i
        : /Tools/i;
  const tab = page.locator('.demo-category-tab').filter({ hasText: categoryRe }).first();
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(300);
  }

  const lessonItem = page
    .locator('.demo-lesson-item')
    .filter({ hasText: lessonNameFragment })
    .first();
  await expect(lessonItem).toBeVisible({ timeout: 15_000 });
  await lessonItem.click();
  await page.waitForSelector('.demo-lesson-player', { timeout: 15_000 });
}

/** Start + full walk; asserts live counter "1 / expectedSteps". */
export async function smokeWalkWorkflowLesson(
  page: Page,
  opts: {
    category: WfCategoryTab;
    lessonName: string | RegExp;
    expectedSteps: number;
    actionTimeoutMs?: number;
  },
): Promise<void> {
  const actionTimeoutMs = opts.actionTimeoutMs ?? 150_000;
  await openWorkflowLesson(page, opts.category, opts.lessonName);
  await startLesson(page);

  const counter = (await page.locator('.demo-live-step-counter').textContent()) ?? '';
  const match = counter.match(/^\s*1\s*\/\s*(\d+)\s*$/);
  expect(match, `Expected live step counter "1 / N", got "${counter}"`).toBeTruthy();
  const totalSteps = Number(match?.[1] ?? 0);
  expect(totalSteps).toBe(opts.expectedSteps);

  await playThroughLesson(page, totalSteps, actionTimeoutMs);

  const completeBtn = page.locator('[aria-label="Complete lesson"]');
  await expect(completeBtn).toBeVisible({ timeout: 15_000 });
  await expect(completeBtn).toBeEnabled();
}
