import { test, expect, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  offers: [
    { associatedOfferingCode: 'ACMB', rank: 1, offerName: 'Trial A', productCode: 'Acme Pro', billingCadence: 'Prepaid', planType: 'Trial' },
    { associatedOfferingCode: 'DATP', rank: 3, offerName: 'Trial B', productCode: 'Acme Plus', billingCadence: 'Monthly', planType: 'Standard' },
  ],
};

async function selectModalMode(page: Page, modal: import('@playwright/test').Locator, label: string) {
  await modal.locator('.vr-modal-mode-select .cs-trigger').click();
  await page.locator('.cs-menu[role="listbox"] .cs-item[role="option"]', { hasText: label }).click();
}

async function openValidationMapper(page: Page) {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('ZIndex-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('ZIndex-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/offers');
  await page.locator('.builder-tab:has-text("Validation")').click();

  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();
  return mapper;
}

test.describe('Validation Rules Modal z-index', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/__proxy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleResponse),
        }),
      });
    });
  });

  test('docked rules modal is visible and interactive above the mapper', async ({ page }) => {
    await openValidationMapper(page);

    const rulesBtn = page.locator('.dm-toolbar button:has-text("Rules")');
    await expect(rulesBtn).toBeVisible();
    await rulesBtn.click();

    const modal = page.locator('.vr-modal-panel');
    await expect(modal).toBeVisible({ timeout: 3000 });

    const modalRect = await modal.boundingBox();
    expect(modalRect).toBeTruthy();
    expect(modalRect!.width).toBeGreaterThan(200);
    expect(modalRect!.height).toBeGreaterThan(100);

    await expect(modal.locator('.vr-modal-header-title')).toContainText('Validation Rules');
    await expect(modal.locator('.vr-modal-editor-pane')).toBeVisible();
    await expect(modal.locator('.vr-reference-pane')).toBeVisible();

    const centerX = modalRect!.x + modalRect!.width / 2;
    const centerY = modalRect!.y + modalRect!.height / 2;
    const isOnTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('.vr-modal-panel');
    }, { x: centerX, y: centerY });

    expect(isOnTop).toBe(true);
  });

  test('Cancel dismisses the rules modal', async ({ page }) => {
    await openValidationMapper(page);

    await page.locator('.dm-toolbar button:has-text("Rules")').click();
    const modal = page.locator('.vr-modal-panel');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await modal.locator('button.vr-modal-btn--secondary', { hasText: 'Cancel' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('mode selector switches between docked, floating, and maximized', async ({ page }) => {
    await openValidationMapper(page);

    await page.locator('.dm-toolbar button:has-text("Rules")').click();
    const modal = page.locator('.vr-modal-panel');
    await expect(modal).toBeVisible({ timeout: 3000 });
    expect(await modal.getAttribute('class')).toContain('vr-modal-panel--docked');

    await selectModalMode(page, modal, 'Floating');
    await expect(page.locator('.vr-modal-panel--floating')).toBeVisible();

    await selectModalMode(page, page.locator('.vr-modal-panel--floating'), 'Full Screen');
    await expect(page.locator('.vr-modal-panel--maximized')).toBeVisible();

    await selectModalMode(page, page.locator('.vr-modal-panel--maximized'), 'Bottom');
    await expect(page.locator('.vr-modal-panel--docked')).toBeVisible();
  });

  test('reference panel can be toggled', async ({ page }) => {
    await openValidationMapper(page);

    await page.locator('.dm-toolbar button:has-text("Rules")').click();
    const modal = page.locator('.vr-modal-panel');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await expect(modal.locator('.vr-reference-pane')).toBeVisible();

    await modal.locator('button[title="Toggle DSL reference"]').click();
    await expect(modal.locator('.vr-reference-pane')).not.toBeVisible();

    await modal.locator('button[title="Toggle DSL reference"]').click();
    await expect(modal.locator('.vr-reference-pane')).toBeVisible();
  });
});
