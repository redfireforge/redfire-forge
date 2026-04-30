import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

/**
 * Helper: navigate to Scenarios tab, create a Feature Group + Scenario,
 * open the test editor, and switch to the Validation tab.
 */
async function openValidationTab(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Create Feature Group
  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('Assert-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  // Create Scenario
  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('Assert-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  // Open test editor modal
  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  // Switch to Validation tab
  const validationTab = page.locator('.builder-tab:has-text("Validation")');
  await validationTab.click();
}

test.describe('Structured Assertions UI', () => {
  test('add an Array Length assertion via menu', async ({ page }) => {
    await openValidationTab(page);

    // Open add menu
    await page.click('button:has-text("+ Add")');
    await expect(page.locator('.assertions-add-menu')).toBeVisible();

    // Click Array Length option
    await page.click('.assertions-add-menu button:has-text("Array Length")');

    // Verify assertion row appears
    const row = page.locator('.assertion-row').last();
    await expect(row).toBeVisible();
    await expect(row.locator('.assertion-type-badge')).toHaveText('ARRAY');

    // Verify inputs are present
    await expect(row.locator('input.assertion-input-path')).toBeVisible();
    await expect(row.locator('select.assertion-select')).toBeVisible();
    await expect(row.locator('input[type="number"]')).toBeVisible();
  });

  test('add a Numeric Compare assertion via menu', async ({ page }) => {
    await openValidationTab(page);

    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Numeric Compare")');

    const row = page.locator('.assertion-row').last();
    await expect(row).toBeVisible();
    await expect(row.locator('.assertion-type-badge')).toHaveText('NUMBER');
    await expect(row.locator('input.assertion-input-path')).toBeVisible();
  });

  test('add a Date Compare assertion via menu', async ({ page }) => {
    await openValidationTab(page);

    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Date Compare")');

    const row = page.locator('.assertion-row').last();
    await expect(row).toBeVisible();
    await expect(row.locator('.assertion-type-badge')).toHaveText('DATE');
    await expect(row.locator('input.assertion-input-path')).toBeVisible();

    // Verify "today" is the default reference
    const refSelect = row.locator('select').nth(1);
    await expect(refSelect).toHaveValue('today');
  });

  test('edit Array Length assertion fields', async ({ page }) => {
    await openValidationTab(page);

    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Array Length")');

    const row = page.locator('.assertion-row').last();

    // Fill in JSONPath
    const pathInput = row.locator('input.assertion-input-path');
    await pathInput.fill('$.items');
    await expect(pathInput).toHaveValue('$.items');

    // Change operator
    const operatorSelect = row.locator('select.assertion-select');
    await operatorSelect.selectOption('>');
    await expect(operatorSelect).toHaveValue('>');

    // Set value
    const valueInput = row.locator('input[type="number"]');
    await valueInput.fill('5');
    await expect(valueInput).toHaveValue('5');
  });

  test('toggle Date assertion between today and fixed', async ({ page }) => {
    await openValidationTab(page);

    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Date Compare")');

    const row = page.locator('.assertion-row').last();

    // Default is "today" — should show timezone select
    const refSelect = row.locator('select').nth(1);
    await expect(refSelect).toHaveValue('today');
    await expect(row.locator('select').nth(2)).toBeVisible(); // timezone select

    // Switch to "fixed date"
    await refSelect.selectOption('fixed');
    await expect(row.locator('input[type="date"]')).toBeVisible();
  });

  test('delete an assertion', async ({ page }) => {
    await openValidationTab(page);

    // Add assertion
    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Array Length")');
    await expect(page.locator('.assertion-row')).toHaveCount(1);

    // Delete it
    await page.click('.assertion-remove');
    await expect(page.locator('.assertion-row')).toHaveCount(0);
  });

  test('add multiple structured assertions of different types', async ({ page }) => {
    await openValidationTab(page);

    // Add Array Length
    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Array Length")');

    // Add Numeric Compare
    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Numeric Compare")');

    // Add Date Compare
    await page.click('button:has-text("+ Add")');
    await page.click('.assertions-add-menu button:has-text("Date Compare")');

    // All 3 should be visible
    await expect(page.locator('.assertion-row')).toHaveCount(3);
    const badges = page.locator('.assertion-type-badge');
    await expect(badges.nth(0)).toHaveText('ARRAY');
    await expect(badges.nth(1)).toHaveText('NUMBER');
    await expect(badges.nth(2)).toHaveText('DATE');
  });
});
