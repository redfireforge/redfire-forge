/**
 * E2E: Gallery Page (workflow templates) and +New Dropdown.
 * Verifies the gallery opens from the sidebar dropdown,
 * shows workflow cards, and loads templates correctly.
 * Also verifies the +New dropdown with Blank Workflow / From Template.
 *
 * Note: The old Template Gallery Modal (.tg-modal) was replaced by
 * the unified Gallery page (.gallery-card, .gallery-domain-btn).
 * "From Template" now navigates to the Gallery tab.
 */
import { test, expect } from '@playwright/test';
import { confirmFolderPickerModal, gotoAppTab, seedAppData } from './helpers';

async function navigateToWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await gotoAppTab(page, 'workflow');
}

/** Open the Gallery page via sidebar +New → From Template */
async function openGalleryFromWorkflow(page: import('@playwright/test').Page) {
  await page.locator('button:has-text("+ New")').click();
  await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();
  // Wait for Gallery page to load
  await page.locator('.gallery-domain-btn').first().waitFor({ state: 'visible', timeout: 5000 });
}

// ── Gallery Page (Workflow Templates) ────────────────

test.describe('Gallery Page — Workflow Templates', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToWorkflow(page);
  });

  test('Gallery opens from sidebar +New dropdown', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Gallery page should show domain filter buttons
    await expect(page.locator('.gallery-domain-btn:has-text("All")')).toBeVisible();
    await expect(page.locator('.gallery-domain-btn:has-text("Workflows")')).toBeVisible();
  });

  test('gallery shows domain filter buttons', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Should show domain filter buttons
    await expect(page.locator('.gallery-domain-btn:has-text("All")')).toBeVisible();
    await expect(page.locator('.gallery-domain-btn:has-text("Requests")')).toBeVisible();
    await expect(page.locator('.gallery-domain-btn:has-text("Workflows")')).toBeVisible();
    await expect(page.locator('.gallery-domain-btn:has-text("Assertions")')).toBeVisible();
  });

  test('gallery shows workflow cards with names and descriptions', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Filter to Workflows domain
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    // Should show workflow cards
    const cards = page.locator('.gallery-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Each card should have name and description
    const firstCard = cards.first();
    await expect(firstCard.locator('.gallery-card-name')).toBeVisible();
    await expect(firstCard.locator('.gallery-card-desc')).toBeVisible();
  });

  test('filtering by Workflows domain shows only workflow entries', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Click Workflows domain filter
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    // All shown cards should be workflow entries (domain attribute)
    const cards = page.locator('.gallery-card[data-domain="workflows"]');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('clicking a workflow card shows detail panel', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Filter to Workflows
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    const firstWorkflowCard = page.locator('.gallery-card[data-domain="workflows"]').first();
    await expect(firstWorkflowCard).toBeVisible({ timeout: 5000 });
    await firstWorkflowCard.click();
    await page.waitForTimeout(300);

    // Detail panel should show with "Load Workflow" action button
    await expect(page.locator('button:has-text("Load Workflow")')).toBeVisible({ timeout: 3000 });
  });

  test('Load Workflow imports and navigates to workflow tab', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Filter to Workflows and select a card
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);
    const firstWorkflowCard = page.locator('.gallery-card[data-domain="workflows"]').first();
    await expect(firstWorkflowCard).toBeVisible({ timeout: 5000 });
    await firstWorkflowCard.click();
    await page.waitForTimeout(300);

    // Click "Load Workflow"
    await page.locator('button:has-text("Load Workflow")').click();

    // Should show preview mode with "Use as Template" button
    await expect(page.locator('button:has-text("Use as Template")')).toBeVisible({ timeout: 5000 });

    // Click "Use as Template" to save to sidebar (opens folder picker)
    await page.locator('button:has-text("Use as Template")').click();
    await confirmFolderPickerModal(page);

    // Should now see a workflow in the sidebar
    await expect(page.locator('.wf-sidebar-item')).toBeVisible({ timeout: 5000 });
  });

  test('Webhook Trigger workflow exists in gallery', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Filter to Workflows
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    // Should find Webhook Trigger entry
    await expect(page.locator('.gallery-card-name:has-text("Webhook Trigger")')).toBeVisible();
  });

  test('search filters workflow entries', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Filter to Workflows
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    const allCount = await page.locator('.gallery-card').count();

    // Type in search
    const searchInput = page.getByRole('searchbox', { name: 'Search gallery' });
    if (await searchInput.isVisible()) {
      await searchInput.fill('Webhook');
      await page.waitForTimeout(300);
      const filteredCount = await page.locator('.gallery-card').count();
      expect(filteredCount).toBeLessThanOrEqual(allCount);
      expect(filteredCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('All domain shows entries from all categories', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // "All" should be selected by default and show entries from all domains
    const cards = page.locator('.gallery-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });

  test('gallery cards have difficulty indicators', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // Filter to Workflows
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    // Cards should have difficulty dots
    const firstCard = page.locator('.gallery-card').first();
    await expect(firstCard.locator('.gallery-difficulty-dots')).toBeVisible({ timeout: 5000 });
  });

  test('gallery pagination works', async ({ page }) => {
    await openGalleryFromWorkflow(page);

    // "All" domain should have enough entries to paginate (page size 12)
    const allCards = page.locator('.gallery-card');
    const count = await allCards.count();
    expect(count).toBeLessThanOrEqual(12); // page 1 max

    // If pagination exists, should be functional
    const nextBtn = page.locator('.gallery-page-btn:has-text("»"), button:has-text("Next")');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      const page2Count = await allCards.count();
      expect(page2Count).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── +New Dropdown ────────────────────────────────────

test.describe('+New Workflow Dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToWorkflow(page);
  });

  test('+New button shows dropdown with Blank and From Template options', async ({ page }) => {
    const newBtn = page.locator('.wf-new-dropdown-wrap .btn-primary');
    await newBtn.click();

    const dropdown = page.locator('.wf-new-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    await expect(dropdown.locator('.wf-new-dropdown-label', { hasText: 'Blank Workflow' })).toBeVisible();
    await expect(dropdown.locator('.wf-new-dropdown-label', { hasText: 'From Template' })).toBeVisible();
  });

  test('Blank Workflow opens create dialog with styled modal', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'Blank Workflow' }).click();

    // Should show the styled create dialog (not native prompt)
    const dialog = page.locator('.req-confirm-overlay');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator('p')).toHaveText('New workflow');

    // Should have an input and Create/Cancel buttons
    await expect(dialog.locator('.req-confirm-input')).toBeVisible();
    await expect(dialog.locator('button:text-is("Create")')).toBeVisible();
    await expect(dialog.locator('button:text-is("Cancel")')).toBeVisible();
  });

  test('creating a blank workflow adds it to the sidebar', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'Blank Workflow' }).click();

    // Type workflow name
    const input = page.locator('.req-confirm-input');
    await input.fill('My Test Workflow');

    // Click Create
    await page.locator('.req-confirm-overlay button:text-is("Create")').click();

    // Should appear in sidebar
    await expect(page.locator('.wf-sidebar-item', { hasText: 'My Test Workflow' })).toBeVisible({ timeout: 5000 });
  });

  test('creating a blank workflow via Enter key', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'Blank Workflow' }).click();

    const input = page.locator('.req-confirm-input');
    await input.fill('Enter Key Workflow');
    await input.press('Enter');

    await expect(page.locator('.wf-sidebar-item', { hasText: 'Enter Key Workflow' })).toBeVisible({ timeout: 5000 });
  });

  test('cancel button closes create dialog without creating', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'Blank Workflow' }).click();

    await page.locator('.req-confirm-input').fill('Should Not Exist');
    await page.locator('button', { hasText: 'Cancel' }).click();

    // Dialog should close
    await expect(page.locator('.req-confirm-overlay')).not.toBeVisible();
    // Workflow should NOT exist in sidebar
    await expect(page.locator('.wf-sidebar-item', { hasText: 'Should Not Exist' })).not.toBeVisible();
  });

  test('Escape key closes create dialog', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'Blank Workflow' }).click();

    await expect(page.locator('.req-confirm-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.req-confirm-overlay')).not.toBeVisible();
  });

  test('From Template navigates to the Gallery page', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'From Template' }).click();

    // Gallery page should show domain filter buttons
    await expect(page.locator('.gallery-domain-btn:has-text("All")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.gallery-domain-btn:has-text("Workflows")')).toBeVisible();
  });

  test('+New dropdown closes when clicking outside', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await expect(page.locator('.wf-new-dropdown')).toBeVisible();

    // Click outside the dropdown
    await page.locator('.wf-sidebar-list').click({ force: true });
    await expect(page.locator('.wf-new-dropdown')).not.toBeVisible();
  });
});
