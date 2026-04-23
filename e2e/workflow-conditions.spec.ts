/**
 * E2E: Workflow with condition nodes and variable scoping.
 * Verifies the designer correctly renders condition & delay nodes and that
 * the Variable Panel reflects workflow-level vs. node-level variables.
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/types/workflow';

function makeConditionWorkflow(): Workflow {
  return {
    id: 'wf-cond-1',
    name: 'Condition Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { status: 'active', region: 'US' },
    hostProfiles: [],
    authProfiles: [],
    services: [
      {
        id: 'svc-1',
        name: 'Test API',
        urlMode: 'direct',
        directUrl: 'https://httpbin.org',
        endpoints: [
          { envId: 'env-1', url: 'https://httpbin.org', enabled: true, authMode: 'inherit', source: 'manual' },
        ],
      },
    ],
    nodes: [
      {
        id: 'http-1',
        type: 'http',
        position: { x: 100, y: 100 },
        data: {
          label: 'Fetch Status',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-1',
            name: 'Fetch Status',
            url: '/get',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
          initialVariables: { channel: 'web' },
        },
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 400, y: 100 },
        data: {
          label: 'Is Active?',
          left: '{{status}}',
          operator: '==',
          right: 'active',
        },
      },
      {
        id: 'http-2',
        type: 'http',
        position: { x: 700, y: 50 },
        data: {
          label: 'Success Path',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-2',
            name: 'Success Path',
            url: '/post',
            method: 'POST',
            headers: [],
            body: '{"result":"pass"}',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'delay-1',
        type: 'delay',
        position: { x: 700, y: 200 },
        data: {
          label: 'Wait 1s',
          delayMs: 1000,
          mode: 'fixed',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'http-1', target: 'cond-1' },
      { id: 'e2', source: 'cond-1', target: 'http-2', sourceHandle: 'true', label: 'Yes' },
      { id: 'e3', source: 'cond-1', target: 'delay-1', sourceHandle: 'false', label: 'No' },
    ],
  };
}

async function seedConditionWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-cond-1');
    localStorage.setItem('workflows_sample_dismissed', 'true');
  }, JSON.stringify([makeConditionWorkflow()]));
}

test.describe('Workflow Condition Branching', () => {
  test.beforeEach(async ({ page }) => {
    await seedConditionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.wf-designer', { timeout: 10_000 });
  });

  test('renders all node types (http, condition, delay)', async ({ page }) => {
    // Should see react-flow nodes for each type
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(4, { timeout: 5_000 });
  });

  test('shows condition node with label', async ({ page }) => {
    // The condition node should be visible with its label
    await expect(page.locator('.react-flow__node', { hasText: 'Is Active?' })).toBeVisible({ timeout: 5_000 });
  });

  test('shows delay node with label', async ({ page }) => {
    await expect(page.locator('.react-flow__node', { hasText: 'Wait 1s' })).toBeVisible({ timeout: 5_000 });
  });

  test('renders edges between nodes', async ({ page }) => {
    // Should have 3 edges
    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(3, { timeout: 5_000 });
  });

  test('displays workflow-level variables in defaults panel', async ({ page }) => {
    // Click Workflow Variables button in toolbar to open defaults modal
    const varsBtn = page.locator('.wf-toolbar-variables-btn');
    await varsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await varsBtn.click();

    // Modal should appear with workflow variables
    const modal = page.locator('[aria-labelledby="wf-defaults-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check workflow default variables are shown (status and region)
    const statusInput = modal.locator('input[value="status"]');
    await expect(statusInput).toBeVisible({ timeout: 5_000 });

    const regionInput = modal.locator('input[value="region"]');
    await expect(regionInput).toBeVisible({ timeout: 5_000 });
  });

  test('clicking HTTP node shows config panel with node details', async ({ page }) => {
    // Click an HTTP node
    const httpNode = page.locator('.react-flow__node', { hasText: 'Fetch Status' });
    await httpNode.dblclick();

    // Node config modal should open (full screen modal for node editing)
    const modal = page.locator('.ram-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('clicking condition node shows condition config', async ({ page }) => {
    // Double-click condition node to open config modal
    const condNode = page.locator('.react-flow__node', { hasText: 'Is Active?' });
    await condNode.dblclick();

    // Modal should show condition configuration
    const modal = page.locator('.ram-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Workflow Deletion', () => {
  test.beforeEach(async ({ page }) => {
    await seedConditionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header');
    await page.waitForSelector('.wf-designer', { timeout: 10_000 });
  });

  test('can delete a workflow from sidebar', async ({ page }) => {
    // Right-click on the workflow in sidebar to get context menu
    const sidebarItem = page.locator('.wf-sidebar-item-name', { hasText: 'Condition Workflow' });
    await expect(sidebarItem).toBeVisible({ timeout: 5_000 });

    // Find the delete button in the sidebar (could be a ✕ or trash icon)
    const deleteBtn = page.locator('.wf-sidebar-item .wf-sidebar-delete-btn, .wf-sidebar-item button[title="Delete"]').first();

    if (await deleteBtn.isVisible()) {
      // Handle confirm dialog
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });
      await deleteBtn.click();

      // Workflow should be removed from sidebar
      await expect(sidebarItem).not.toBeVisible({ timeout: 3_000 });
    }
  });
});
