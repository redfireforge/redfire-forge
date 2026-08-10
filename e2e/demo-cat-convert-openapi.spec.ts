import { test, expect, type Page } from '@playwright/test';
import { openDemoHub, startLesson, playThroughLesson } from './demo-player-helpers';

test.describe.configure({ mode: 'serial', retries: 0 });

async function openCatalogConvertLesson(page: Page): Promise<void> {
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

  const catalogTab = page.locator('.demo-category-tab').filter({ hasText: /catalog/i }).first();
  if (await catalogTab.count()) {
    await catalogTab.click();
  }

  const lessonItem = page
    .locator('.demo-lesson-item')
    .filter({ hasText: /Convert Swagger 2\.0.*OpenAPI 3/i })
    .first();
  await expect(lessonItem).toBeVisible({ timeout: 15_000 });
  await lessonItem.click();
  await page.waitForSelector('.demo-lesson-player', { timeout: 15_000 });
}

test('Catalog convert lesson smoke (cat-convert-openapi)', async ({ page }) => {
  test.setTimeout(240_000);

  await openCatalogConvertLesson(page);
  await startLesson(page);

  const counter = (await page.locator('.demo-live-step-counter').textContent()) ?? '';
  const match = counter.match(/^\s*1\s*\/\s*(\d+)\s*$/);
  expect(match, `Expected live step counter "1 / N", got "${counter}"`).toBeTruthy();
  const totalSteps = Number(match?.[1] ?? 0);
  expect(totalSteps).toBeGreaterThanOrEqual(6);

  await playThroughLesson(page, totalSteps, 90_000);

  const completeBtn = page.locator('[aria-label="Complete lesson"]');
  await expect(completeBtn).toBeVisible({ timeout: 15_000 });
  await expect(completeBtn).toBeEnabled();
});

