import { test, expect, type Locator, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  offers: [
    { associatedOfferingCode: 'OHZF', rank: 1, offerName: 'Trial A' },
    { associatedOfferingCode: 'DAFC', rank: 3, offerName: 'Trial B' },
  ],
};

async function openValidationTab(page: Page): Promise<void> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('Mapper-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('Mapper-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/offers');
  await page.locator('.builder-tab:has-text("Validation")').click();
}

async function openMapperFromValidation(page: Page): Promise<Locator> {
  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();
  return mapper;
}

test.describe('Validation Rules Data Mapper clear-all', () => {
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

  test('clear all keeps response schema visible after Keep Rules update flow', async ({ page }) => {
    await openValidationTab(page);

    const mapperInitial = await openMapperFromValidation(page);
    await mapperInitial.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await mapperInitial.locator('.dm-modal-footer button', { hasText: 'Save' }).click();
    await expect(mapperInitial).not.toBeVisible();

    await page.locator('button:has-text("Fetch Response")').click();
    await expect(page.locator('.fetch-confirm-bar')).toBeVisible();
    await page.locator('.fetch-confirm-actions button:has-text("Keep Rules & Update Response")').click();

    const mapperAfterKeep = page.locator('.dm-modal-overlay');
    await expect(mapperAfterKeep).toBeVisible();

    await mapperAfterKeep.locator('.dm-toolbar-cluster--core button', { hasText: 'Clear all' }).click();

    // After clear: full response JSON tree visible with zero mappings
    const rootNode = mapperAfterKeep.locator('.dm-panel--target .dm-tree-node[data-path=""]').first();
    await expect(rootNode).toBeVisible();
    await expect(rootNode.locator('button[aria-label="Collapse"]')).toBeVisible();
    // No mapping badges should remain
    await expect(mapperAfterKeep.locator('.dm-panel--target .dm-mapped-src-ref')).toHaveCount(0);
    // The toolbar should show "No mappings yet"
    await expect(mapperAfterKeep.locator('.dm-toolbar-status')).toContainText('No mappings');
  });
});
