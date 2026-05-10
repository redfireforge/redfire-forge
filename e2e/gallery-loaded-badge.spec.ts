/**
 * E2E: Gallery "✓ Loaded" badge lifecycle for workflow samples.
 *
 * Tests the full flow:
 * 1. Load a workflow sample from gallery → badge shows "✓ Loaded"
 * 2. Navigate back to gallery → badge still visible
 * 3. "Use as Template" → badge persists (now tracked via saved workflow)
 * 4. Delete the saved workflow → badge disappears
 * 5. "Close Preview" without saving → badge disappears
 */
import { test, expect } from '@playwright/test';
import { confirmFolderPickerModal, seedAppData } from './helpers';

const SAMPLE_NAME = 'Parallel API Calls';

async function goToGalleryWorkflows(page: import('@playwright/test').Page) {
  await page.goto('/?tab=gallery');
  await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
  await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
  await page.waitForTimeout(300);
}

function sampleCard(page: import('@playwright/test').Page) {
  return page.locator('.gallery-card', { hasText: SAMPLE_NAME });
}

function loadedBadge(page: import('@playwright/test').Page) {
  return sampleCard(page).locator('.gallery-card-status-badge', { hasText: '✓ Loaded' });
}

test.describe('Gallery Loaded Badge Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
  });

  test('no badge initially on workflow samples', async ({ page }) => {
    await goToGalleryWorkflows(page);
    const card = sampleCard(page);
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(loadedBadge(page)).not.toBeVisible();
  });

  test('badge appears after loading a workflow sample and returning to gallery', async ({ page }) => {
    await goToGalleryWorkflows(page);

    // Click the card and then "Load Workflow"
    await sampleCard(page).click();
    await page.waitForTimeout(300);
    await page.locator('.gallery-detail-btn-primary', { hasText: 'Load Workflow' }).click();
    await page.waitForTimeout(500);

    // Should be on workflow tab with preview banner — persisted samples only count as loaded
    await expect(page.locator('.wf-preview-banner')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Use as Template")').click();
    await confirmFolderPickerModal(page);

    // Navigate back to gallery
    await page.goto('/?tab=gallery');
    await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(300);

    // Badge should show
    await expect(loadedBadge(page)).toBeVisible({ timeout: 5000 });
  });

  test('badge persists after "Use as Template" and disappears after deleting the workflow', async ({ page }) => {
    await goToGalleryWorkflows(page);

    // Load the sample
    await sampleCard(page).click();
    await page.waitForTimeout(300);
    await page.locator('.gallery-detail-btn-primary', { hasText: 'Load Workflow' }).click();
    await page.waitForTimeout(500);

    // Use as Template
    await expect(page.locator('button:has-text("Use as Template")')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Use as Template")').click();
    await confirmFolderPickerModal(page);

    // Workflow should be in sidebar now
    const sidebarItem = page.locator('.wf-sidebar-item').first();
    await expect(sidebarItem).toBeVisible({ timeout: 5000 });

    // Navigate to gallery — badge should still show
    await page.goto('/?tab=gallery');
    await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(300);
    await expect(loadedBadge(page)).toBeVisible({ timeout: 5000 });

    // Now delete the workflow: go to workflow tab, right-click sidebar item, delete
    await page.goto('/?tab=workflow');
    await page.waitForTimeout(500);
    const wfItem = page.locator('.wf-sidebar-item').first();
    await expect(wfItem).toBeVisible({ timeout: 5000 });
    await wfItem.click({ button: 'right' });
    await page.waitForTimeout(300);
    await page.locator('button:has-text("Delete Workflow")').click();
    await page.waitForTimeout(200);
    // Confirm deletion
    await page.locator('.req-confirm-ok, button:text-is("Delete")').click();
    await page.waitForTimeout(500);

    // Navigate to gallery — badge should be GONE
    await page.goto('/?tab=gallery');
    await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(300);
    await expect(loadedBadge(page)).not.toBeVisible();
  });

  test('badge disappears after closing preview without saving', async ({ page }) => {
    await goToGalleryWorkflows(page);

    // Load the sample
    await sampleCard(page).click();
    await page.waitForTimeout(300);
    await page.locator('.gallery-detail-btn-primary', { hasText: 'Load Workflow' }).click();
    await page.waitForTimeout(500);

    // Should show preview banner
    await expect(page.locator('.wf-preview-banner')).toBeVisible({ timeout: 5000 });

    // Close Preview without saving
    await page.locator('button:has-text("Close Preview")').click();
    await page.waitForTimeout(300);

    // Navigate to gallery — badge should be GONE
    await page.goto('/?tab=gallery');
    await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(300);
    await expect(loadedBadge(page)).not.toBeVisible();
  });

  test('clicking "✓ Loaded" navigates to workflow tab instead of showing modal', async ({ page }) => {
    await goToGalleryWorkflows(page);

    // Load the sample
    await sampleCard(page).click();
    await page.waitForTimeout(300);
    await page.locator('.gallery-detail-btn-primary', { hasText: 'Load Workflow' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('.wf-preview-banner')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Use as Template")').click();
    await confirmFolderPickerModal(page);

    // Go back to gallery
    await page.goto('/?tab=gallery');
    await page.waitForSelector('.gallery-domain-btn', { timeout: 10000 });
    await page.locator('.gallery-domain-btn', { hasText: 'Workflows' }).click();
    await page.waitForTimeout(300);

    // Click the card and then the "✓ Loaded" action button
    await sampleCard(page).click();
    await page.waitForTimeout(300);
    const actionBtn = page.locator('.gallery-detail-btn-primary');
    await expect(actionBtn).toContainText('✓ Loaded');
    await actionBtn.click();
    await page.waitForTimeout(500);

    // Should navigate to workflow tab, not show a modal
    expect(page.url()).toContain('tab=workflow');
    await expect(page.locator('.popup-modal')).not.toBeVisible();
  });
});
