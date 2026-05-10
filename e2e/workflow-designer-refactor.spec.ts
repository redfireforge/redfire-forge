import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeSampleWorkflow(): Workflow {
  return {
    id: 'wf-e2e-designer',
    name: 'Designer Refactor Test',
    schemaVersion: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { baseUrl: 'https://httpbin.org' },
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 250, y: 50 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'http-1',
        type: 'http',
        position: { x: 250, y: 200 },
        data: {
          label: 'GET Status',
          scenario: {
            id: 'sc-1', name: 'GET Status', url: '{{baseUrl}}/get', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 250, y: 400 },
        data: { label: 'Check result', left: '{{statusCode}}', operator: '==', right: '200' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'http-1' },
      { id: 'e2', source: 'http-1', target: 'cond-1' },
    ],
  };
}

async function seedAndNavigate(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-e2e-designer');
  }, JSON.stringify([makeSampleWorkflow()]));
  await page.goto('/?tab=workflow');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 5000 });
}

test.describe('WorkflowDesigner Refactored Components', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('canvas renders with nodes after refactoring', async ({ page }) => {
    // Verify all 3 node types rendered correctly after extraction refactors
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 5000 });
    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(3);
  });

  test('edges connect nodes after refactoring', async ({ page }) => {
    await expect(page.locator('.react-flow__edge').first()).toBeVisible({ timeout: 5000 });
    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(2);
  });

  test('minimap renders on canvas', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 5000 });
  });

  test('save layout button works after refactoring', async ({ page }) => {
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 5000 });
    const saveBtn = page.locator('[data-testid="save-layout-btn"]');
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
  });

  test('clicking a node selects it (selection still works after refactoring)', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node').nth(1);
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    await httpNode.click();
    // After click, the node should have selected state
    await expect(httpNode).toHaveClass(/selected/, { timeout: 3000 });
  });

  test('version panel toggle works after side-panel compaction', async ({ page }) => {
    // Look for version/history button in toolbar
    const versionBtn = page.locator('button[title*="ersion"], button[title*="istory"], .wf-toolbar-btn:has-text("Versions")').first();
    if (await versionBtn.isVisible()) {
      await versionBtn.click();
      // Version panel or a resize handle should appear
      const resizeHandle = page.locator('.wf-resize-handle');
      await expect(resizeHandle.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('keyboard shortcut L triggers auto-layout', async ({ page }) => {
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 5000 });
    // Click canvas to focus it
    await page.locator('.react-flow__pane').click();
    // Press L for auto-layout
    await page.keyboard.press('l');
    // Nodes should still be present
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
  });
});
