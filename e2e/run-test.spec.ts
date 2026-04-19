import { test, expect } from '@playwright/test';
import { seedAppDataWithTest } from './helpers';

test.describe('Run Test flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppDataWithTest(page);
    await page.goto('/');
    await page.waitForSelector('.app-header');
  });

  test('navigate to Test Runner tab', async ({ page }) => {
    await page.click('.tab:has-text("Test Runner")');
    await expect(page.locator('.tab.active')).toHaveText('Test Runner');
  });

  test('shows scenarios to select', async ({ page }) => {
    await page.click('.tab:has-text("Test Runner")');
    await expect(page.getByText('E2E Scenario')).toBeVisible();
  });

  test('run a test and see completion banner', async ({ page }) => {
    await page.click('.tab:has-text("Test Runner")');

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
    await page.click('.tab:has-text("Test Runner")');

    const scenarioLabel = page.getByText('E2E Scenario');
    await scenarioLabel.locator('..').locator('input[type="checkbox"]').check();

    await page.click('button:has-text("Run Test")');

    // Wait for completion then click "View Full Results →"
    await expect(page.getByText('View Full Results')).toBeVisible({ timeout: 30000 });
    await page.click('button:has-text("View Full Results")');

    // Now we should be on Results tab
    await expect(page.locator('.tab.active')).toHaveText('Results');
    await expect(page.locator('.metric-label:has-text("TPS")')).toBeVisible({ timeout: 5000 });
  });
});
