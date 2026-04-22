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
    await page.waitForSelector('.app-header');
  });

  test('pre-fills search with variable name on Insert…', async ({ page }) => {
    // The right panel shows "Workflow Defaults" variables immediately (no node selection needed)
    await page.waitForSelector('.wf-config-panel', { timeout: 10_000 });
    await page.waitForSelector('.wf-config-kv-row', { timeout: 5_000 });
    await page.screenshot({ path: 'test-results/wf-01-panel.png' });

    // Helpers to find Insert… button for a variable by DOM property (input.value ≠ html attribute)
    const clickInsertForVar = async (varName: string) => {
      const rowIndex = await page.evaluate((name: string) => {
        const rows = [...document.querySelectorAll<HTMLElement>('.wf-config-kv-row')];
        return rows.findIndex(row => {
          const inp = row.querySelector<HTMLInputElement>('.wf-var-key-input');
          return inp?.value === name;
        });
      }, varName);
      if (rowIndex < 0) throw new Error(`No row found for variable "${varName}"`);
      console.log(`[DEBUG] Row index for "${varName}": ${rowIndex}`);
      await page.locator('.wf-config-kv-row').nth(rowIndex).locator('button:has-text("Insert…")').click();
    };

    // ── enrollmentType ───────────────────────────────────────────────────
    await clickInsertForVar('enrollmentType');

    const modal = page.locator('.wf-var-insert-modal');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'test-results/wf-02-modal-enrollmentType.png' });

    const searchValue = await modal.locator('input[placeholder="Search all variables…"]').inputValue();
    console.log('[DEBUG] Search after enrollmentType Insert…:', JSON.stringify(searchValue));

    await expect(modal.locator('input[placeholder="Search all variables…"]')).toHaveValue('enrollmentType');

    // ── Close and re-open with "status" ──────────────────────────────────
    await modal.locator('.ram-modal-close').click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });

    await clickInsertForVar('status');

    const modal2 = page.locator('.wf-var-insert-modal');
    await expect(modal2).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: 'test-results/wf-03-modal-status.png' });

    const search2 = await modal2.locator('input[placeholder="Search all variables…"]').inputValue();
    console.log('[DEBUG] Search after status Insert…:', JSON.stringify(search2));

    await expect(modal2.locator('input[placeholder="Search all variables…"]')).toHaveValue('status');
  });
});
