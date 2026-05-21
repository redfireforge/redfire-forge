import { test, expect } from '@playwright/test';
import { seedAppDataWithTest } from './helpers';

async function createAndDeleteFeatureGroup(page: import('@playwright/test').Page) {
  const deleteBtn = page.locator('.feature-group-card .btn-danger:has-text("Delete")');
  await expect(deleteBtn).toBeVisible({ timeout: 5000 });
  await deleteBtn.click();

  const confirmBtn = page.locator('.popup-modal .btn-danger:has-text("Move to Trash")');
  await expect(confirmBtn).toBeVisible({ timeout: 3000 });
  await confirmBtn.click();
}

test.describe('Trash Box', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppDataWithTest(page);
    await page.goto('/?tab=scenarios');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Trash button is visible in the header', async ({ page }) => {
    const trashBtn = page.locator('button:has-text("Trash")');
    await expect(trashBtn).toBeVisible({ timeout: 5000 });
  });

  test('delete Feature Group shows undo toast', async ({ page }) => {
    await createAndDeleteFeatureGroup(page);

    const toast = page.locator('.trash-toast-container');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('moved to Trash');
  });

  test('clicking Undo on toast restores the item', async ({ page }) => {
    const fgCard = page.locator('.feature-group-card');
    await expect(fgCard).toBeVisible({ timeout: 5000 });

    await createAndDeleteFeatureGroup(page);

    const undoBtn = page.locator('.trash-toast-undo');
    await expect(undoBtn).toBeVisible({ timeout: 3000 });
    await undoBtn.click();

    await expect(page.locator('.feature-group-card')).toBeVisible({ timeout: 5000 });
  });

  test('Trash panel opens and shows deleted items', async ({ page }) => {
    await createAndDeleteFeatureGroup(page);

    const toast = page.locator('.trash-toast-container');
    await expect(toast).toBeVisible({ timeout: 5000 });

    const dismissBtn = page.locator('.trash-toast-dismiss');
    if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissBtn.click();
    }

    const trashBtn = page.locator('button:has-text("Trash")');
    await trashBtn.click();

    const trashPanel = page.locator('.popup-modal');
    await expect(trashPanel).toBeVisible({ timeout: 5000 });
    await expect(trashPanel).toContainText('E2E Feature');
  });

  test('Trash panel allows restoring items', async ({ page }) => {
    await createAndDeleteFeatureGroup(page);

    await page.waitForTimeout(500);

    const dismissBtn = page.locator('.trash-toast-dismiss');
    if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await dismissBtn.click();
    }

    await page.locator('button:has-text("Trash")').click();

    const trashPanel = page.locator('.popup-modal');
    await expect(trashPanel).toBeVisible({ timeout: 5000 });

    const restoreBtn = trashPanel.locator('button:has-text("Restore")').first();
    await expect(restoreBtn).toBeVisible({ timeout: 3000 });
    await restoreBtn.click();

    const closeBtn = trashPanel.locator('button:has-text("Close")');
    await closeBtn.click();

    await expect(page.locator('.feature-group-card')).toBeVisible({ timeout: 5000 });
  });

  test('Trash badge shows count of deleted items', async ({ page }) => {
    await createAndDeleteFeatureGroup(page);

    await page.waitForTimeout(500);

    const trashBtn = page.locator('button:has-text("Trash")');
    const badge = trashBtn.locator('.count-badge');
    await expect(badge).toBeVisible({ timeout: 5000 });
    await expect(badge).toContainText('1');
  });
});
