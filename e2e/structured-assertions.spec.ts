import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

/**
 * Helper: navigate to Feature Groups tab, create a Feature Group + Scenario,
 * open the test editor, and switch to the Validation tab.
 */
async function openValidationTab(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
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

/** Click the "+ Add" button inside the modal (avoids matching "+ Add Feature Group" outside) */
function addButton(page: import('@playwright/test').Page) {
  return page.locator('.modal-overlay button:has-text("+ Add")');
}

test.describe('Structured Assertions UI', () => {
  test('add an Array Length assertion via menu', async ({ page }) => {
    await openValidationTab(page);

    // Open add menu
    await addButton(page).click();
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

    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Numeric Compare")');

    const row = page.locator('.assertion-row').last();
    await expect(row).toBeVisible();
    await expect(row.locator('.assertion-type-badge')).toHaveText('NUMBER');
    await expect(row.locator('input.assertion-input-path')).toBeVisible();
  });

  test('add a Date Compare assertion via menu', async ({ page }) => {
    await openValidationTab(page);

    await addButton(page).click();
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

    await addButton(page).click();
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

    await addButton(page).click();
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
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Array Length")');
    await expect(page.locator('.assertion-row')).toHaveCount(1);

    // Delete it
    await page.click('.assertion-remove');
    await expect(page.locator('.assertion-row')).toHaveCount(0);
  });

  test('add multiple structured assertions of different types', async ({ page }) => {
    await openValidationTab(page);

    // Add Array Length
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Array Length")');

    // Add Numeric Compare
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Numeric Compare")');

    // Add Date Compare
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Date Compare")');

    // All 3 should be visible
    await expect(page.locator('.assertion-row')).toHaveCount(3);
    const badges = page.locator('.assertion-type-badge');
    await expect(badges.nth(0)).toHaveText('ARRAY');
    await expect(badges.nth(1)).toHaveText('NUMBER');
    await expect(badges.nth(2)).toHaveText('DATE');
  });
});

test.describe('Date Precise — calendar/precision layout', () => {
  test('calendar button and precision dropdown do not overlap', async ({ page }) => {
    await openValidationTab(page);

    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Date Precise")');

    const row = page.locator('.assertion-row').last();
    await expect(row.locator('.assertion-type-badge')).toHaveText('DATE⁺');

    const calBtn = row.locator('.assertion-date-btn');
    const precisionSelect = row.locator('.assertion-select--precision');
    await expect(calBtn).toBeVisible();
    await expect(precisionSelect).toBeVisible();

    const calBox = await calBtn.boundingBox();
    const precBox = await precisionSelect.boundingBox();
    expect(calBox).toBeTruthy();
    expect(precBox).toBeTruthy();

    // Calendar button's right edge must not exceed precision dropdown's left edge
    const calRight = calBox!.x + calBox!.width;
    const overlap = calRight - precBox!.x;
    expect(overlap).toBeLessThanOrEqual(1); // allow 1px for rounding
  });

  test('precision dropdown text is fully visible (not clipped)', async ({ page }) => {
    await openValidationTab(page);

    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Date Precise")');

    const row = page.locator('.assertion-row').last();
    const precisionSelect = row.locator('.assertion-select--precision');
    await expect(precisionSelect).toBeVisible();

    const precBox = await precisionSelect.boundingBox();
    expect(precBox).toBeTruthy();
    // The select should be at least 80px wide to fit "Second" + dropdown arrow
    expect(precBox!.width).toBeGreaterThanOrEqual(80);
  });
});

test.describe('Assertion Presets', () => {
  test('Presets menu opens and shows preset cards', async ({ page }) => {
    await openValidationTab(page);

    // Click the Presets button
    await page.click('button:has-text("Presets")');
    const menu = page.locator('.assertion-preset-menu');
    await expect(menu).toBeVisible();

    // Verify header
    await expect(menu.locator('.apm-title')).toHaveText('Assertion Presets');

    // Verify category tabs
    const tabs = menu.locator('.apm-tab');
    await expect(tabs).toHaveCount(4); // All, API Validation, Data Quality, Security

    // Verify preset cards are visible (7 presets total: 5 original + Data Type Guard + Required Fields)
    const cards = menu.locator('.apm-card');
    await expect(cards).toHaveCount(7);

    // Verify first card has expected structure
    const firstCard = cards.first();
    await expect(firstCard.locator('.apm-card-name')).toBeVisible();
    await expect(firstCard.locator('.apm-card-desc')).toBeVisible();
    await expect(firstCard.locator('.apm-difficulty')).toBeVisible();
    await expect(firstCard.locator('.apm-count')).toBeVisible();
  });

  test('clicking a preset imports assertions into the list', async ({ page }) => {
    await openValidationTab(page);

    // No assertions initially
    await expect(page.locator('.assertion-row')).toHaveCount(0);

    // Open Presets menu and click "API Health Check" (2 assertions)
    await page.click('button:has-text("Presets")');
    await page.click('.apm-card:has-text("API Health Check")');

    // Menu should close after import
    await expect(page.locator('.assertion-preset-menu')).not.toBeVisible();

    // 2 assertions should be imported
    await expect(page.locator('.assertion-row')).toHaveCount(2);
  });

  test('imported preset assertions are editable', async ({ page }) => {
    await openValidationTab(page);

    // Import "Paginated List Validation" preset (3 assertions: arrayLength, numeric, numeric)
    await page.click('button:has-text("Presets")');
    await page.click('.apm-card:has-text("Paginated List")');
    await expect(page.locator('.assertion-row')).toHaveCount(3);

    // Edit the first assertion's JSONPath
    const firstRow = page.locator('.assertion-row').first();
    const pathInput = firstRow.locator('input.assertion-input-path');
    await pathInput.fill('$.results');
    await expect(pathInput).toHaveValue('$.results');

    // Delete one assertion — should go from 3 to 2
    await page.locator('.assertion-remove').first().click();
    await expect(page.locator('.assertion-row')).toHaveCount(2);
  });
});
