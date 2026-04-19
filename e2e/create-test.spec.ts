import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

test.describe('Create Test flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/');
    await page.waitForSelector('.app-header');
  });

  test('app loads with Feature Groups tab active', async ({ page }) => {
    const header = page.locator('.app-header h1');
    await expect(header).toContainText('RedfireForge');
    const activeTab = page.locator('.tab.active');
    await expect(activeTab).toHaveText('Feature Groups');
  });

  test('create a Feature Group', async ({ page }) => {
    await page.click('button:has-text("+ Add Feature Group")');
    const input = page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]');
    await input.fill('My Feature');
    await page.click('button:has-text("Create")');

    await expect(page.locator('.feature-group-card')).toBeVisible();
    await expect(page.locator('.feature-group-card')).toContainText('My Feature');
  });

  test('create a Scenario inside a Feature Group', async ({ page }) => {
    // Create Feature Group
    await page.click('button:has-text("+ Add Feature Group")');
    await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('FG-1');
    await page.click('button:has-text("Create")');

    // Create Scenario
    await page.click('button:has-text("+ Scenario")');
    const input = page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]');
    await input.fill('Happy Path');
    await page.locator('.feature-group-card button:has-text("Create")').click();

    await expect(page.locator('.scenario-group-card')).toBeVisible();
    await expect(page.locator('.scenario-group-name')).toContainText('Happy Path');
  });

  test('create a Test inside a Scenario and save it', async ({ page }) => {
    // Create Feature Group
    await page.click('button:has-text("+ Add Feature Group")');
    await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('FG-1');
    await page.click('button:has-text("Create")');

    // Create Scenario
    await page.click('button:has-text("+ Scenario")');
    await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('Scenario-1');
    await page.locator('.feature-group-card button:has-text("Create")').click();

    // Open test editor
    await page.click('button:has-text("+ Test")');
    await expect(page.locator('.modal-overlay')).toBeVisible();

    // Fill in test name
    await page.locator('input[placeholder="e.g. Get User Profile"]').fill('GET Health Check');

    // Fill in URL
    await page.locator('input.url-input').fill('http://localhost:5173/');

    // Save test
    await page.click('.modal-overlay button:has-text("Save")');

    // Verify test appears in the scenario
    await expect(page.getByText('GET Health Check')).toBeVisible();
  });
});
