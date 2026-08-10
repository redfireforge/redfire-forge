/**
 * E2E: Switch, Loop, SetVariable, and Aggregate nodes.
 * Verifies canvas rendering, palette blocks, node config modals, and palette categories.
 */
import { test, expect } from '@playwright/test';
import { gotoAppTab, seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

// This suite mutates shared workflow/localStorage state across many steps.
// Running tests serially avoids cross-test interference under fullyParallel mode.
test.describe.configure({ mode: 'serial' });

/** Workflow with all 4 new node types wired together. */
function makeNewNodesWorkflow(): Workflow {
  return {
    id: 'wf-new-nodes',
    name: 'New Nodes E2E',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { orderType: 'express', items: '[1,2,3]' },
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start-1', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'setvar-1', type: 'setVariable', position: { x: 260, y: 120 },
        data: {
          label: 'Init Vars',
          assignments: [
            { id: 'a1', name: 'counter', expression: '0' },
            { id: 'a2', name: 'result', expression: '' },
          ],
        },
      },
      {
        id: 'switch-1', type: 'switch', position: { x: 280, y: 260 },
        data: {
          label: 'Route Order',
          expression: '{{orderType}}',
          cases: [
            { id: 'c1', value: 'standard', label: 'Standard' },
            { id: 'c2', value: 'express', label: 'Express' },
          ],
        },
      },
      {
        id: 'loop-1', type: 'loop', position: { x: 100, y: 420 },
        data: {
          label: 'Process Items',
          mode: 'forEach' as const,
          sourceExpression: '{{items}}',
          itemVariable: 'item',
          indexVariable: 'idx',
          maxIterations: 50,
        },
      },
      {
        id: 'agg-1', type: 'aggregate', position: { x: 100, y: 580 },
        data: {
          label: 'Sum Results',
          mappings: [
            { id: 'm1', sourceExpression: '{{item}}', targetVariable: 'total', strategy: 'sum' as const },
            { id: 'm2', sourceExpression: '{{item}}', targetVariable: 'allItems', strategy: 'concat' as const },
          ],
        },
      },
      {
        id: 'end-1', type: 'end', position: { x: 300, y: 720 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'setvar-1' },
      { id: 'e2', source: 'setvar-1', target: 'switch-1' },
      { id: 'e3', source: 'switch-1', target: 'loop-1', sourceHandle: 'case-c1' },
      { id: 'e4', source: 'switch-1', target: 'end-1', sourceHandle: 'default' },
      { id: 'e5', source: 'loop-1', target: 'agg-1', sourceHandle: 'body' },
      { id: 'e6', source: 'loop-1', target: 'end-1', sourceHandle: 'done' },
    ],
  };
}

async function seedAndNavigate(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-new-nodes');
  }, JSON.stringify([makeNewNodesWorkflow()]));
  await gotoAppTab(page, 'workflow');
}

// ── Canvas rendering ─────────────────────────────────

test.describe('New Node Types — Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('renders Switch node with label and expression', async ({ page }) => {
    const switchNode = page.locator('.wf-node-switch');
    await expect(switchNode).toBeVisible({ timeout: 5000 });
    await expect(switchNode.locator('.wf-node-label')).toHaveText('Route Order');
    await expect(switchNode.locator('.wf-switch-expr')).toContainText('{{orderType}}');
  });

  test('Switch node shows case count badge', async ({ page }) => {
    const badge = page.locator('.wf-node-switch .wf-switch-cases-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('2 cases');
  });

  test('Switch node has case handles and default handle', async ({ page }) => {
    // Case handles
    await expect(page.locator('.wf-node-switch .wf-handle-case')).toHaveCount(2);
    // Default handle
    await expect(page.locator('.wf-node-switch .wf-handle-default')).toBeVisible();
  });

  test('renders Loop node with label and mode badge', async ({ page }) => {
    const loopNode = page.locator('.wf-node-loop');
    await expect(loopNode).toBeVisible({ timeout: 5000 });
    await expect(loopNode.locator('.wf-node-label')).toHaveText('Process Items');
    // Mode badge should show forEach mode
    await expect(loopNode.locator('.wf-loop-badge')).toContainText('item');
  });

  test('renders SetVariable node with assignment count', async ({ page }) => {
    const setVarNode = page.locator('.wf-node-setVariable');
    await expect(setVarNode).toBeVisible({ timeout: 5000 });
    await expect(setVarNode.locator('.wf-node-label')).toHaveText('Init Vars');
    // Should show 2 assignments
    await expect(setVarNode.locator('.wf-setvar-badge')).toContainText('2 assignments');
  });

  test('renders Aggregate node with mapping count', async ({ page }) => {
    const aggNode = page.locator('.wf-node-aggregate');
    await expect(aggNode).toBeVisible({ timeout: 5000 });
    await expect(aggNode.locator('.wf-node-label')).toHaveText('Sum Results');
    // Should show 2 mappings
    await expect(aggNode.locator('.wf-aggregate-badge')).toContainText('2 mappings');
  });

  test('all new nodes have Configure buttons', async ({ page }) => {
    await expect(page.locator('.wf-node-switch .wf-node-configure-badge')).toBeVisible();
    await expect(page.locator('.wf-node-loop .wf-node-configure-badge')).toBeVisible();
    await expect(page.locator('.wf-node-setVariable .wf-node-configure-badge')).toBeVisible();
    await expect(page.locator('.wf-node-aggregate .wf-node-configure-badge')).toBeVisible();
  });
});

// ── Node config modals ───────────────────────────────

test.describe('New Node Types — Config Modals', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('opens Switch config modal with expression and cases', async ({ page }) => {
    await page.locator('.wf-node-switch .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    // Modal title
    await expect(page.locator('#wf-config-modal-title')).toContainText('Switch');
  });

  test('opens Loop config modal with mode selector', async ({ page }) => {
    await page.locator('.wf-node-loop .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wf-config-modal-title')).toContainText('Loop');
  });

  test('opens SetVariable config modal', async ({ page }) => {
    await page.locator('.wf-node-setVariable .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wf-config-modal-title')).toContainText('Set Variable');
  });

  test('opens Aggregate config modal', async ({ page }) => {
    const aggNode = page.locator('.wf-node-aggregate');
    await aggNode.waitFor({ state: 'visible', timeout: 10_000 });
    await aggNode.locator('.wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#wf-config-modal-title')).toContainText('Aggregate');
  });

  test('Switch config modal closes on Close', async ({ page }) => {
    await page.locator('.wf-node-switch .wf-node-configure-badge').click();
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).not.toBeVisible();
  });
});

// ── Palette categories ───────────────────────────────

test.describe('New Node Types — Palette', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('palette Logic category shows Switch and Loop blocks', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Navigate to Logic category
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();

    // Logic category should be visible in the panel title
    await expect(page.locator('.wf-palette-rail-title', { hasText: 'Logic' })).toBeVisible();

    // Should contain Switch and Loop
    await expect(page.locator('.wf-palette-block-switch .wf-pb-title')).toHaveText('Switch');
    await expect(page.locator('.wf-palette-block-loop .wf-pb-title')).toHaveText('Loop');
    await expect(page.locator('.wf-palette-block-condition .wf-pb-title')).toHaveText('Condition');
  });

  test('palette Data category shows SetVariable and Aggregate blocks', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Navigate to Data category
    await page.locator('[data-testid="wf-palette-rail-data"]').click();

    // Data category blocks should be visible
    await expect(page.locator('.wf-palette-block-setVariable .wf-pb-title')).toHaveText('Set Variable');
    await expect(page.locator('.wf-palette-block-aggregate .wf-pb-title')).toHaveText('Aggregate');
  });

  test('palette Flow category shows Fork, Join, End blocks', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Navigate to Flow category
    await page.locator('[data-testid="wf-palette-rail-flow"]').click();

    await expect(page.locator('.wf-palette-rail-title', { hasText: 'Flow' })).toBeVisible();
    await expect(page.locator('.wf-palette-block-fork .wf-pb-title')).toHaveText('Parallel Fork');
    await expect(page.locator('.wf-palette-block-join .wf-pb-title')).toHaveText('Join');
    await expect(page.locator('.wf-palette-block-end .wf-pb-title')).toHaveText('End');
  });

  test('palette category headers show item counts', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Navigate to Logic and verify count matches blocks
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();
    const logicCount = page.locator('.wf-palette-rail-title .wf-palette-count');
    await expect(logicCount).toHaveText(/\d+/);

    // Navigate to Data and verify count
    await page.locator('[data-testid="wf-palette-rail-data"]').click();
    const dataCount = page.locator('.wf-palette-rail-title .wf-palette-count');
    await expect(dataCount).toHaveText(/\d+/);

    // Navigate to Flow and verify count
    await page.locator('[data-testid="wf-palette-rail-flow"]').click();
    const flowCount = page.locator('.wf-palette-rail-title .wf-palette-count');
    await expect(flowCount).toHaveText(/\d+/);
  });

  test('clicking Switch palette block adds a Switch node to canvas', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();

    // Should already have 1 switch node from seeded data
    await expect(page.locator('.wf-node-switch')).toHaveCount(1);

    // Click the Switch palette block
    await page.locator('.wf-palette-block-switch').click();

    // Should now have 2 switch nodes
    await expect(page.locator('.wf-node-switch')).toHaveCount(2);
  });

  test('clicking Loop palette block adds a Loop node to canvas', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();

    await expect(page.locator('.wf-node-loop')).toHaveCount(1, { timeout: 5000 });
    await page.locator('.wf-palette-block-loop').click();
    await expect(page.locator('.wf-node-loop')).toHaveCount(2, { timeout: 5000 });
  });

  test('clicking SetVariable palette block adds a SetVariable node', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();
    await page.locator('[data-testid="wf-palette-rail-data"]').click();

    await expect(page.locator('.wf-node-setVariable')).toHaveCount(1);
    await page.locator('.wf-palette-block-setVariable').click();
    await expect(page.locator('.wf-node-setVariable')).toHaveCount(2);
  });

  test('clicking Aggregate palette block adds an Aggregate node', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();
    await page.locator('[data-testid="wf-palette-rail-data"]').click();

    await expect(page.locator('.wf-node-aggregate')).toHaveCount(1);
    await page.locator('.wf-palette-block-aggregate').click();
    await expect(page.locator('.wf-node-aggregate')).toHaveCount(2);
  });

  test('collapsing and expanding category hides and shows blocks', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    // Navigate to Logic — Switch block visible
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();
    await expect(page.locator('.wf-palette-block-switch')).toBeVisible();

    // Switch to Data category — Switch block should be hidden
    await page.locator('[data-testid="wf-palette-rail-data"]').click();
    await expect(page.locator('.wf-palette-block-switch')).not.toBeVisible();

    // Switch back to Logic — Switch block visible again
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();
    await expect(page.locator('.wf-palette-block-switch')).toBeVisible();
  });
});
