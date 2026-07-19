import { test, expect, type Page } from '@playwright/test';
import { openDemoHub, startLesson, playThroughLesson } from './demo-player-helpers';

/**
 * REQ-3 — Multi-Environment Requests (api › requests) smoke spec.
 *
 * Walks the full 7-step lesson: create Settings environments → manual ENV
 * collection → add request + resolved URL → switch env + send → Linked
 * Microservice collection → send from it → manual-vs-linked summary.
 *
 * Steps 4 & 5 are heavy (microservice config + two live DummyJSON sends), so
 * the per-step action timeout is generous. Live sends are resilient: the lesson
 * `waitFor(STATUS_PILL)` has its own short timeout, so a slow/failed network
 * request will not hang the walk — the step still reaches `data-step-phase=done`.
 *
 * See e2e/DEMO-LESSON-E2E-MEMO.md — last-step handling lives in playThroughLesson.
 *
 * Run:
 *   npm run test:e2e:demo:req3
 */

test.describe.configure({ mode: 'serial', retries: 0 });

async function openMultiEnvLesson(page: Page): Promise<void> {
  await openDemoHub(page);

  const apiDomain = page.locator('.demo-domain-card').filter({ hasText: /api/i }).first();
  if (await apiDomain.count()) {
    await apiDomain.click();
  } else {
    await page
      .locator('.demo-domain-card')
      .filter({ hasNot: page.locator('.coming-soon') })
      .first()
      .click();
  }
  await page.waitForSelector('.demo-lesson-list', { timeout: 15_000 });

  const requestsTab = page.locator('.demo-category-tab').filter({ hasText: /requests/i }).first();
  if (await requestsTab.count()) {
    await requestsTab.click();
    await page.waitForTimeout(300);
  }

  const lessonItem = page
    .locator('.demo-lesson-item')
    .filter({ hasText: /Multi-Environment Requests/i })
    .first();
  await expect(lessonItem).toBeVisible({ timeout: 15_000 });
  await lessonItem.click();
  await page.waitForSelector('.demo-lesson-player', { timeout: 15_000 });
}

test('Multi-Environment Requests lesson smoke (req-multi-env)', async ({ page }) => {
  test.setTimeout(600_000);

  await openMultiEnvLesson(page);
  await startLesson(page);

  const counter = (await page.locator('.demo-live-step-counter').textContent()) ?? '';
  const match = counter.match(/^\s*1\s*\/\s*(\d+)\s*$/);
  expect(match, `Expected live step counter "1 / N", got "${counter}"`).toBeTruthy();
  const totalSteps = Number(match?.[1] ?? 0);
  expect(totalSteps).toBe(7);

  await playThroughLesson(page, totalSteps, 150_000);

  const completeBtn = page.locator('[aria-label="Complete lesson"]');
  await expect(completeBtn).toBeVisible({ timeout: 15_000 });
  await expect(completeBtn).toBeEnabled();
});
