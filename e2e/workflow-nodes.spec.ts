import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeWorkflowWithNodes(): Workflow {
  return {
    id: 'wf-nodes-1',
    name: 'Node Test Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start1',
        type: 'start',
        position: { x: 50, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'log1',
        type: 'logDebug',
        position: { x: 300, y: 100 },
        data: {
          label: 'Debug Log',
          message: 'User {{userId}} logged in',
          logLevel: 'info',
          snapshotVariables: true,
        },
      },
      {
        id: 'err1',
        type: 'errorHandler',
        position: { x: 300, y: 300 },
        data: {
          label: 'Error Guard',
          errorFilter: 'all',
          maxRetries: 3,
          retryBackoffStrategy: 'fixed',
          retryDelayMs: 1000,
          failWorkflowOnError: false,
        },
      },
      {
        id: 'wait1',
        type: 'waitForCondition',
        position: { x: 600, y: 200 },
        data: {
          label: 'Wait Ready',
          conditionExpression: '{{status}} == ready',
          pollIntervalMs: 2000,
          timeoutMs: 30000,
          maxAttempts: 10,
        },
      },
      {
        id: 'end1',
        type: 'end',
        position: { x: 900, y: 200 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start1', target: 'log1' },
      { id: 'e2', source: 'log1', target: 'err1' },
      { id: 'e3', source: 'err1', target: 'wait1', sourceHandle: 'done' },
      { id: 'e4', source: 'wait1', target: 'end1', sourceHandle: 'done' },
    ],
  };
}

async function seedWorkflowData(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-nodes-1');
  }, JSON.stringify([makeWorkflowWithNodes()]));
}

test.describe('Workflow - Log/Debug, Error Handler, Wait for Condition nodes', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('renders Log/Debug node on canvas', async ({ page }) => {
    await expect(page.locator('.wf-node-logDebug')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-node-logDebug .wf-node-label')).toContainText('Debug Log');
  });

  test('renders Error Handler node on canvas', async ({ page }) => {
    await expect(page.locator('.wf-node-errorHandler')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-node-errorHandler .wf-node-label')).toContainText('Error Guard');
  });

  test('renders Wait for Condition node on canvas', async ({ page }) => {
    await expect(page.locator('.wf-node-waitForCondition')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-node-waitForCondition .wf-node-label')).toContainText('Wait Ready');
  });

  test('Log/Debug node shows message preview and level', async ({ page }) => {
    const logNode = page.locator('.wf-node-logDebug');
    await expect(logNode).toBeVisible({ timeout: 5000 });
    await expect(logNode.locator('.wf-logdebug-message')).toContainText('User {{userId}} logged in');
    await expect(logNode.locator('.wf-logdebug-level')).toBeVisible();
  });

  test('Wait for Condition node shows condition and meta', async ({ page }) => {
    const waitNode = page.locator('.wf-node-waitForCondition');
    await expect(waitNode).toBeVisible({ timeout: 5000 });
    await expect(waitNode.locator('.wf-waitcond-condition')).toContainText('{{status}} == ready');
  });

  test('palette shows Log/Debug and Wait for Condition entries', async ({ page }) => {
    await expect(page.locator('.wf-palette')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-palette').getByText('Log/Debug')).toBeVisible();
    await expect(page.locator('.wf-palette').getByText('Wait for Condition')).toBeVisible();
  });

  test('opens Log/Debug config modal on double-click', async ({ page }) => {
    const logNode = page.locator('.wf-node-logDebug');
    await expect(logNode).toBeVisible({ timeout: 5000 });
    await logNode.dispatchEvent('dblclick');
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wf-config-modal-title')).toContainText('LOGDEBUG');
  });

  test('opens Wait for Condition config modal on double-click', async ({ page }) => {
    const waitNode = page.locator('.wf-node-waitForCondition');
    await expect(waitNode).toBeVisible({ timeout: 5000 });
    await waitNode.dispatchEvent('dblclick');
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wf-config-modal-title')).toContainText('WAITFORCONDITION');
  });
});
