/**
 * E2E: Template Gallery Modal and +New Dropdown.
 * Verifies the gallery opens from the sidebar dropdown,
 * shows categorized cards, and loads templates correctly.
 * Also verifies the +New dropdown with Blank Workflow / From Template.
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

async function navigateToWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.goto('/?tab=workflow');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

/** Open the Template Gallery via sidebar +New → From Template */
async function openGallery(page: import('@playwright/test').Page) {
  await page.locator('button:has-text("+ New")').click();
  await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();
}

// ── Template Gallery Modal ───────────────────────────

test.describe('Template Gallery Modal', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToWorkflow(page);
  });

  test('Gallery opens from sidebar +New dropdown', async ({ page }) => {
    await openGallery(page);

    // Modal should appear
    const modal = page.locator('.tg-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.tg-title')).toHaveText('Template Gallery');
  });

  test('gallery shows category filter tabs', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Should show all category tabs
    await expect(page.locator('.tg-tab', { hasText: 'All Templates' })).toBeVisible();
    await expect(page.locator('.tg-tab', { hasText: 'Basics' })).toBeVisible();
    await expect(page.locator('.tg-tab', { hasText: 'Triggers' })).toBeVisible();
    await expect(page.locator('.tg-tab', { hasText: 'Logic' })).toBeVisible();
    await expect(page.locator('.tg-tab', { hasText: 'Advanced' })).toBeVisible();
  });

  test('gallery shows template cards with icons and descriptions', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Should show template cards
    const cards = page.locator('.tg-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(8); // We have 8 samples

    // Each card should have name, description, icon, and meta info
    const firstCard = cards.first();
    await expect(firstCard.locator('.tg-card-icon')).toBeVisible();
    await expect(firstCard.locator('.tg-card-name')).toBeVisible();
    await expect(firstCard.locator('.tg-card-desc')).toBeVisible();
    await expect(firstCard.locator('.tg-card-nodes')).toBeVisible();
    await expect(firstCard.locator('.tg-card-category')).toBeVisible();
  });

  test('filtering by category shows only matching templates', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Click Triggers category
    await page.locator('.tg-tab', { hasText: 'Triggers' }).click();

    // Should show only trigger templates
    const cards = page.locator('.tg-card');
    const count = await cards.count();
    expect(count).toBe(2); // Webhook + Schedule

    // All shown cards should have "triggers" category label
    const categories = await cards.locator('.tg-card-category').allTextContents();
    categories.forEach(cat => expect(cat.toLowerCase()).toBe('triggers'));
  });

  test('filtering by Logic shows Switch and Loop templates', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    await page.locator('.tg-tab', { hasText: 'Logic' }).click();

    const cards = page.locator('.tg-card');
    const count = await cards.count();
    expect(count).toBe(2); // Switch + Loop/Aggregate

    // Verify we see the new node templates
    await expect(page.locator('.tg-card-name', { hasText: 'Switch' })).toBeVisible();
    await expect(page.locator('.tg-card-name', { hasText: 'Paginated' })).toBeVisible();
  });

  test('clicking a template card loads it as preview', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Click the first card
    await page.locator('.tg-card').first().click();

    // Gallery should close
    await expect(page.locator('.tg-modal')).not.toBeVisible();

    // Should see "Use as Template" button (preview mode)
    await expect(page.locator('button', { hasText: 'Use as Template' })).toBeVisible({ timeout: 5000 });
  });

  test('Use as Template saves the workflow to sidebar', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Click a template
    await page.locator('.tg-card').first().click();
    await expect(page.locator('.tg-modal')).not.toBeVisible();

    // Click "Use as Template"
    await page.locator('button', { hasText: 'Use as Template' }).click();

    // Should now see a workflow in the sidebar
    await expect(page.locator('.wf-sidebar-item')).toBeVisible({ timeout: 5000 });
  });

  test('gallery closes on Escape key', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('.tg-modal')).not.toBeVisible();
  });

  test('gallery closes on backdrop click', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Click the overlay (outside the modal)
    await page.locator('.tg-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.tg-modal')).not.toBeVisible();
  });

  test('gallery close button works', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    await page.locator('.tg-close').click();
    await expect(page.locator('.tg-modal')).not.toBeVisible();
  });

  test('category tab counts match actual template counts', async ({ page }) => {
    await openGallery(page);
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });

    // Check count badges on category tabs
    const basicsCount = page.locator('.tg-tab', { hasText: 'Basics' }).locator('.tg-tab-count');
    await expect(basicsCount).toHaveText('3');

    const triggersCount = page.locator('.tg-tab', { hasText: 'Triggers' }).locator('.tg-tab-count');
    await expect(triggersCount).toHaveText('2');

    const logicCount = page.locator('.tg-tab', { hasText: 'Logic' }).locator('.tg-tab-count');
    await expect(logicCount).toHaveText('2');

    const advancedCount = page.locator('.tg-tab', { hasText: 'Advanced' }).locator('.tg-tab-count');
    await expect(advancedCount).toHaveText('4');
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

  test('From Template opens the gallery modal', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await page.locator('.wf-new-dropdown-item', { hasText: 'From Template' }).click();

    // Gallery modal should open
    await expect(page.locator('.tg-modal')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.tg-title')).toHaveText('Template Gallery');
  });

  test('+New dropdown closes when clicking outside', async ({ page }) => {
    await page.locator('.wf-new-dropdown-wrap .btn-primary').click();
    await expect(page.locator('.wf-new-dropdown')).toBeVisible();

    // Click outside the dropdown
    await page.locator('.wf-sidebar-list').click({ force: true });
    await expect(page.locator('.wf-new-dropdown')).not.toBeVisible();
  });
});
