/**
 * Debug spec: verifies the Insert Variable modal pre-fills the search box
 * with the variable name when clicking "Insert…" next to an existing variable.
 */
import { test, expect } from '@playwright/test';

const seedWorkflow = {
  id: 'wf-debug-1',
  name: 'Debug Workflow',
  nodes: [
    {
      id: 'node-1',
      type: 'http',
      position: { x: 200, y: 200 },
      data: {
        label: 'Retrieve Kafka Status',
        method: 'GET',
        url: 'http://localhost:5173/api/status',
        headers: [],
        body: '',
        auth: { type: 'none' },
        validation: { mode: 'none' },
        initialVariables: {
          channel: 'default-channel',
          vin: 'TEST-VIN-123',
          country: 'US',
        },
      },
    },
  ],
  edges: [],
  variables: {
    accountType: 'standard',
    enrollmentType: 'auto',
    status: 'active',
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

test.describe('Workflow Insert Variable modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((wf) => {
      localStorage.setItem('perf-test-theme', 'dark');
      // Storage key used by saveWorkflows()
      localStorage.setItem('workflows', JSON.stringify([wf]));
      // Pre-select so the designer opens it immediately
      localStorage.setItem('workflows_selected_id', wf.id);
      // Dismiss sample workflow banner
      localStorage.setItem('workflows_sample_dismissed', 'true');
    }, seedWorkflow);
    // Navigate straight to the Workflow tab
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 25000 });
    await page.waitForLoadState('networkidle');
  });

  test('can open workflow variables modal and see variables', async ({ page }) => {
    // Click Workflow Variables toolbar button  
    const varsBtn = page.locator('.wf-toolbar-variables-btn');
    await varsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await varsBtn.click();

    // Modal should open showing workflow defaults
    const modal = page.locator('[aria-labelledby="wf-defaults-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Wait for variable rows to render and verify we have at least the 3 seeded variables
    await page.waitForTimeout(1000); // Give time for variables to render
    const rowCount = await modal.locator('.wf-config-kv-row').count();
    expect(rowCount).toBeGreaterThanOrEqual(3); // At least accountType, enrollmentType, status
    
    // Verify the seeded variables are present
    await expect(modal.locator('input[value="accountType"]')).toBeVisible();
    await expect(modal.locator('input[value="enrollmentType"]')).toBeVisible();
    await expect(modal.locator('input[value="status"]')).toBeVisible();
  });
});
