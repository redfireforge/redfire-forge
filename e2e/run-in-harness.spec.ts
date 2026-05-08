import { test, expect, type Page } from '@playwright/test';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeTestWorkflow(id: string, name: string): Workflow {
  return {
    id,
    name,
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      { id: 'start', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
      { id: 'http', type: 'http', position: { x: 100, y: 200 }, data: { label: 'Request', method: 'GET', url: '/test' } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'http' },
    ],
  };
}

async function seedWorkflows(page: Page, workflows: Workflow[]) {
  await page.addInitScript((wfs) => {
    localStorage.setItem('workflows', JSON.stringify(wfs));
  }, workflows);
}

test.describe('Run in Harness Navigation', () => {
  test('should preserve workflow selection when navigating from Designer to Runner', async ({ page }) => {
    const workflow = makeTestWorkflow('wf-run-harness', 'Test Run Harness');
    await seedWorkflows(page, [workflow]);
    
    // Navigate to workflow designer
    await page.goto('/?tab=workflow');
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 10000 });
    
    // Wait for workflow to be loaded - the sidebar item should be visible
    await expect(page.locator('.wf-sidebar-item-name', { hasText: 'Test Run Harness' })).toBeVisible({ timeout: 5000 });
    
    // Click "Run in Harness" button
    const runInHarnessBtn = page.locator('button:has-text("Run in Harness")');
    await expect(runInHarnessBtn).toBeVisible();
    await runInHarnessBtn.click();
    
    // Should navigate to Workflow Runner tab
    await expect(page.locator('h2', { hasText: 'Workflow Runner' })).toBeVisible({ timeout: 5000 });
    
    // Verify workflow is selected in the dropdown
    const workflowSelect = page.locator('.workflow-picker-select');
    await expect(workflowSelect).toBeVisible();
    
    // The workflow should be selected
    await expect(workflowSelect).toHaveValue('wf-run-harness');
  });

  test('should not reset workflow selection when clicking Run in Harness multiple times', async ({ page }) => {
    const workflowA = makeTestWorkflow('wf-a', 'Workflow A');
    const workflowB = makeTestWorkflow('wf-b', 'Workflow B');
    await seedWorkflows(page, [workflowA, workflowB]);
    
    // Navigate to workflow designer
    await page.goto('/?tab=workflow');
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 10000 });
    
    // Select Workflow A in the designer dropdown - use the workflow selector specifically
    const designerDropdown = page.locator('.wf-toolbar-select').first();
    await expect(designerDropdown).toBeVisible();
    await designerDropdown.selectOption('wf-a');
    await page.waitForTimeout(300);
    
    // Click "Run in Harness" for Workflow A
    await page.locator('button:has-text("Run in Harness")').click();
    await expect(page.locator('h2', { hasText: 'Workflow Runner' })).toBeVisible({ timeout: 5000 });
    
    // Workflow A should be selected
    const workflowSelect = page.locator('.workflow-picker-select');
    await expect(workflowSelect).toHaveValue('wf-a');
    
    // Go back to Designer
    await page.goto('/?tab=workflow');
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 10000 });
    
    // Select Workflow B
    await expect(designerDropdown).toBeVisible();
    await designerDropdown.selectOption('wf-b');
    await page.waitForTimeout(300);
    
    // Click "Run in Harness" for Workflow B
    await page.locator('button:has-text("Run in Harness")').click();
    await expect(page.locator('h2', { hasText: 'Workflow Runner' })).toBeVisible({ timeout: 5000 });
    
    // Workflow B should now be selected (overrides A)
    await expect(workflowSelect).toHaveValue('wf-b');
  });
});
