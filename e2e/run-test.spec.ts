import { test, expect } from '@playwright/test';
import { seedAppDataWithTest } from './helpers';

test.describe('Run Test flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppDataWithTest(page);
    await page.goto('/?tab=runner');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('navigate to Test Runner tab', async ({ page }) => {
    // Already on Test Runner tab from beforeEach
    await expect(page.locator('.sub-nav-tab.active')).toHaveText('Runner');
  });

  test('shows scenarios to select', async ({ page }) => {
    // Already on Test Runner tab from beforeEach
    await expect(page.getByText('E2E Scenario')).toBeVisible();
  });

  test('run a test and see completion banner', async ({ page }) => {
    // Already on Test Runner tab from beforeEach

    // Check the scenario checkbox
    const scenarioLabel = page.getByText('E2E Scenario');
    await expect(scenarioLabel).toBeVisible();
    const scenarioCheckbox = scenarioLabel.locator('..').locator('input[type="checkbox"]');
    await scenarioCheckbox.check();

    // Click Run Test
    await page.click('button:has-text("Run Test")');

    // Wait for completion banner to appear (test runs against localhost, should be fast)
    await expect(page.getByText('Test completed')).toBeVisible({ timeout: 30000 });

    // View Full Results button should appear
    await expect(page.getByText('View Full Results')).toBeVisible();
  });

  test('navigate to results after run', async ({ page }) => {
    // Already on Test Runner tab from beforeEach

    const scenarioLabel = page.getByText('E2E Scenario');
    await scenarioLabel.locator('..').locator('input[type="checkbox"]').check();

    await page.click('button:has-text("Run Test")');

    // Wait for completion then click "View Full Results →"
    await expect(page.getByText('View Full Results')).toBeVisible({ timeout: 30000 });
    await page.click('button:has-text("View Full Results")');

    // Wait for navigation to complete
    await page.waitForLoadState('networkidle');

    // Now we should be on Results tab
    await expect(page.locator('.sub-nav-tab.active')).toHaveText('Results', { timeout: 10000 });
  });
});
