import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

test.describe('Settings and navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/');
    await page.waitForSelector('.app-header');
  });

  test('sidebar shows environment items', async ({ page }) => {
    // Use the sidebar-specific locator (sidebar has class config-sidebar)
    const sidebar = page.locator('.config-sidebar');
    await expect(sidebar.getByText('t01')).toBeVisible({ timeout: 5000 });
  });

  test('can switch between tabs', async ({ page }) => {
    await page.click('.tab:has-text("Test Runner")');
    await expect(page.locator('.tab.active')).toHaveText('Test Runner');

    await page.click('.tab:has-text("Results")');
    await expect(page.locator('.tab.active')).toHaveText('Results');

    await page.click('.tab:has-text("Feature Groups")');
    await expect(page.locator('.tab.active')).toHaveText('Feature Groups');
  });

  test('toggle dark/light theme', async ({ page }) => {
    const themeBtn = page.locator('.theme-toggle');
    await themeBtn.click();

    const body = page.locator('.app');
    await expect(body).toBeVisible();
  });

  test('sidebar toggle collapses and expands', async ({ page }) => {
    const sidebar = page.locator('.config-sidebar');
    await expect(sidebar).toBeVisible();

    // Click the float toggle to collapse
    const toggleBtn = page.locator('.sidebar-float-toggle');
    await toggleBtn.click();

    // Sidebar should disappear
    await expect(sidebar).toBeHidden();

    // Click again to expand
    await toggleBtn.click();
    await expect(sidebar).toBeVisible();
  });

  test('context tags show service and environment', async ({ page }) => {
    await expect(page.locator('.context-tag:has-text("test-service")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.context-tag:has-text("t01")')).toBeVisible();
  });
});
