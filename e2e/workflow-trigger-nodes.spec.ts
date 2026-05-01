import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeWorkflowWithStart(): Workflow {
  return {
    id: 'wf-trigger-e2e',
    name: 'Trigger Test Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start', inputVariables: { token: 'test-abc' } },
      },
      {
        id: 'n1',
        type: 'http',
        position: { x: 250, y: 200 },
        data: {
          label: 'Get Data',
          scenario: {
            id: 'sc-1', name: 'Get Data', url: '/get', method: 'GET',
            headers: [], body: '',
            auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'start-1', sourceHandle: 'out', target: 'n1', targetHandle: null }],
  };
}

async function seedWorkflowData(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-trigger-e2e');
  }, JSON.stringify([makeWorkflowWithStart()]));
}

test.describe('Workflow Trigger Nodes', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 5000 });
  });

  test('shows Start node on canvas', async ({ page }) => {
    // Start node should be visible on the canvas
    await expect(page.locator('.wf-node-start')).toBeVisible();
    await expect(page.locator('.wf-node-start .wf-node-label')).toHaveText('Start');
  });

  test('shows trigger input variables count on Start node', async ({ page }) => {
    // Start node should show "1 input variable"
    await expect(page.locator('.wf-node-start .wf-start-vars')).toHaveText('1 input variable');
  });

  test('palette shows Triggers category with Manual Start block', async ({ page }) => {
    // Open blocks tab in palette
    await expect(page.locator('.wf-palette')).toBeVisible();
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Should show Triggers category header
    await expect(page.locator('.wf-palette-category-title', { hasText: 'Triggers' })).toBeVisible();

    // Should show Manual Start block
    await expect(page.locator('.wf-palette-block-start .wf-pb-title')).toHaveText('Manual Start');
  });

  test('palette shows Flow category with Parallel Fork block', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    await expect(page.locator('.wf-palette-category-title', { hasText: 'Flow' })).toBeVisible();
    await expect(page.locator('.wf-palette-block-fork .wf-pb-title')).toHaveText('Parallel Fork');
  });

  test('palette shows Actions category with HTTP and Delay blocks', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    await expect(page.locator('.wf-palette-category-title', { hasText: 'Actions' })).toBeVisible();
    await expect(page.locator('.wf-palette-block-http .wf-pb-title')).toHaveText('HTTP Request');
    await expect(page.locator('.wf-palette-block-delay .wf-pb-title')).toHaveText('Delay');
  });

  test('toolbar shows Workflow Variables button instead of Defaults', async ({ page }) => {
    const varBtn = page.locator('.wf-toolbar-variables-btn', { hasText: 'Workflow Variables' });
    await expect(varBtn).toBeVisible();
    // Should NOT show "Defaults"
    await expect(page.locator('.wf-toolbar-services-btn', { hasText: 'Defaults' })).not.toBeVisible();
  });

  test('clicking Workflow Variables opens the modal with correct title', async ({ page }) => {
    const varBtn = page.locator('.wf-toolbar-variables-btn', { hasText: 'Workflow Variables' });
    await varBtn.click();

    // Modal should show "Workflow Variables" as title
    await expect(page.locator('#wf-defaults-modal-title')).toHaveText('Workflow Variables');
  });

  test('adding Manual Start from palette creates a Start node', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Click the Manual Start block to add it
    await page.locator('.wf-palette-block-start').click();

    // Should now have 2 start nodes on canvas
    const startNodes = page.locator('.wf-node-start');
    await expect(startNodes).toHaveCount(2);
  });

  test('adding Parallel Fork from palette creates a Fork node', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Click the Fork block to add it
    await page.locator('.wf-palette-block-fork').click();

    // Should see a fork node on canvas
    await expect(page.locator('.wf-node-fork')).toBeVisible();
    await expect(page.locator('.wf-node-fork .wf-node-label')).toHaveText('Parallel Fork');
  });
});
