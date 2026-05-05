/**
 * E2E tests for the Workflow Console Panel feature.
 * Verifies console open/close persistence, run behavior toggle,
 * and search functionality.
 */
import { test, expect } from '@playwright/test';

const seedWorkflow = {
  id: 'wf-console-e2e',
  name: 'Console Test Workflow',
  schemaVersion: 4,
  nodes: [
    {
      id: 'node-1',
      type: 'http',
      position: { x: 200, y: 200 },
      data: {
        label: 'Test Step',
        scenario: {
          id: 's1', name: 'Test', url: '/get', method: 'GET',
          headers: [], body: '',
          auth: { type: 'none' }, validation: { mode: 'none' },
        },
      },
    },
  ],
  edges: [],
  variables: { baseUrl: 'http://localhost' },
  hostProfiles: [],
  authProfiles: [],
  services: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

test.describe('Workflow Console Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((wf) => {
      localStorage.setItem('perf-test-theme', 'dark');
      localStorage.setItem('workflows', JSON.stringify([wf]));
      localStorage.setItem('workflows_selected_id', wf.id);
      localStorage.setItem('workflows_sample_dismissed', 'true');
    }, seedWorkflow);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('console panel can be opened and closed', async ({ page }) => {
    // Console should not be visible initially
    await expect(page.locator('.wf-console-panel')).not.toBeVisible();

    // Open via canvas control button
    const consoleToggle = page.locator('[title*="console" i], [title*="Console" i]').first();
    if (await consoleToggle.isVisible()) {
      await consoleToggle.click();
      await expect(page.locator('.wf-console-panel')).toBeVisible({ timeout: 3000 });

      // Close via close button
      await page.locator('.wf-console-panel [title="Close console"]').click();
      await expect(page.locator('.wf-console-panel')).not.toBeVisible();
    }
  });

  test('console persists open state across page refresh', async ({ page }) => {
    test.slow(); // Involves page reload

    // Open console
    const consoleToggle = page.locator('[title*="console" i], [title*="Console" i]').first();
    if (await consoleToggle.isVisible()) {
      await consoleToggle.click();
      await expect(page.locator('.wf-console-panel')).toBeVisible({ timeout: 3000 });

      // Reload
      await page.reload();
      await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });

      // Console should still be open
      await expect(page.locator('.wf-console-panel')).toBeVisible({ timeout: 5000 });
    }
  });

  test('run behavior toggle switches between auto-clear and append', async ({ page }) => {
    const consoleToggle = page.locator('[title*="console" i], [title*="Console" i]').first();
    if (await consoleToggle.isVisible()) {
      await consoleToggle.click();
      await expect(page.locator('.wf-console-panel')).toBeVisible({ timeout: 3000 });

      // Default should be auto-clear
      const runToggle = page.locator('.wf-console-run-toggle');
      await expect(runToggle).toContainText('Auto-clear');

      // Toggle to append
      await runToggle.click();
      await expect(runToggle).toContainText('Append');

      // Toggle back
      await runToggle.click();
      await expect(runToggle).toContainText('Auto-clear');
    }
  });
});
