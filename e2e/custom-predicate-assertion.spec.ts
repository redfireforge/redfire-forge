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
    const customPred = page.locator('.assertions-add-menu button:has-text("Custom Predicate")');
    await expect(customPred).toBeVisible();
    await expect(customPred).toHaveAttribute('title', 'Write an expression that evaluates to truthy/falsy');
  });

  test('add a Custom Predicate assertion and see CUSTOM badge', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    await expect(row).toBeVisible();
    await expect(row.locator('.assertion-type-badge')).toHaveText('CUSTOM');
  });

  test('custom assertion row has expression input and description input', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    await expect(row.locator('input.assertion-input--expression-inline')).toBeVisible();
    await expect(row.locator('input.assertion-input--desc-inline')).toBeVisible();
  });

  test('custom assertion row displays info tooltip', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const tip = page.locator('.assertion-custom-hint-tip');
    await expect(tip).toBeVisible();
    const title = await tip.getAttribute('title');
    expect(title).toContain('$.body');
    expect(title).toContain('$.status');
  });

  test('type expression and description in custom assertion', async ({ page }) => {
    await openValidationTab(page);
    await addButton(page).click();
    await page.click('.assertions-add-menu button:has-text("Custom Predicate")');

    const row = page.locator('.assertion-row').last();
    const exprInput = row.locator('input.assertion-input--expression-inline');
    await exprInput.fill('$gt($.body.count, 0)');
    await expect(exprInput).toHaveValue('$gt($.body.count, 0)');

    const descInput = row.locator('input.assertion-input--desc-inline');
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
