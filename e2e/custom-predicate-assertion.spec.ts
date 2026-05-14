import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

async function openValidationTab(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('Custom-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('Custom-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  const validationTab = page.locator('.builder-tab:has-text("Validation")');
  await validationTab.click();
}

function addButton(page: import('@playwright/test').Page) {
  return page.locator('.modal-overlay button:has-text("+ Add")');
}

test.describe('Custom Predicate Assertion (Phase 9.3)', () => {
  test('Custom Predicate appears in the +Add menu', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await expect(page.locator('.assertions-add-menu')).toBeVisible();
    await expect(page.locator('.assertions-add-menu button:has-text("Custom Predicate")')).toBeVisible();
    await expect(page.locator('.assertions-add-menu :text("Write an expression that evaluates to truthy/falsy")')).toBeVisible();
  });

  test('add a Custom Predicate assertion and see CUSTOM badge', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    await expect(row).toBeVisible();
    await expect(row.locator('.assertion-type-badge')).toHaveText('CUSTOM');
  });

  test('custom assertion row has expression textarea and description input', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    await expect(row.locator('textarea.assertion-textarea--expression')).toBeVisible();
    await expect(row.locator('input.assertion-input--description')).toBeVisible();
  });

  test('custom assertion row displays hint with variable references', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const hint = page.locator('.assertion-custom-hint');
    await expect(hint).toBeVisible();
    await expect(hint.locator('code:has-text("$.body")')).toBeVisible();
    await expect(hint.locator('code:has-text("$.status")')).toBeVisible();
  });

  test('type expression and description in custom assertion', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    const textarea = row.locator('textarea.assertion-textarea--expression');
    await textarea.fill('$gt($.body.count, 0)');
    await expect(textarea).toHaveValue('$gt($.body.count, 0)');

    const descInput = row.locator('input.assertion-input--description');
    await descInput.fill('Count must be positive');
    await expect(descInput).toHaveValue('Count must be positive');
  });

  test('negate toggle works on custom assertion', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    const negateBtn = row.locator('.assertion-negate-toggle');
    await expect(negateBtn).toBeVisible();

    await negateBtn.click();
    await expect(row).toHaveClass(/assertion-row--negated/);
  });

  test('remove custom assertion', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const rowsBefore = await page.locator('.assertion-row').count();
    await page.locator('.assertion-row').last().locator('.assertion-remove').click();
    const rowsAfter = await page.locator('.assertion-row').count();
    expect(rowsAfter).toBe(rowsBefore - 1);
  });
});
