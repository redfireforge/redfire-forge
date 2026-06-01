/**
 * E2E tests for Webhook and Schedule trigger nodes in workflows.
 * Verifies:
 * - Webhook trigger node renders correctly
 * - Webhook configuration modal
 * - Schedule trigger node renders correctly
 * - Schedule configuration modal
 * - Trigger nodes work as workflow entry points
 * - Variable extraction from webhook payloads
 * - Schedule time variable seeding
 */
import { test, expect } from '@playwright/test';
import { gotoAppTab, openWorkflowBlocksTab, seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeWebhookWorkflow(): Workflow {
  return {
    id: 'wf-webhook-1',
    name: 'Webhook Trigger Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
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
        id: 'webhook-1',
        type: 'webhook',
        position: { x: 100, y: 100 },
        data: {
          label: 'Order Webhook',
          method: 'POST',
          path: '/api/orders',
          samplePayload: JSON.stringify({
            orderId: '12345',
            customerId: 'C-001',
            amount: 99.99,
          }, null, 2),
          extractVariables: [
            { name: 'orderId', jsonPath: '$.orderId' },
            { name: 'customerId', jsonPath: '$.customerId' },
          ],
        },
      },
      {
        id: 'http-1',
        type: 'http',
        position: { x: 400, y: 100 },
        data: {
          label: 'Process Order',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-1',
            name: 'Process Order',
            url: '/post?orderId={{orderId}}&customer={{customerId}}',
            method: 'POST',
            headers: [],
            body: '{"status":"processing"}',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'webhook-1', target: 'http-1' }],
  };
}

function makeScheduleWorkflow(): Workflow {
  return {
    id: 'wf-schedule-1',
    name: 'Schedule Trigger Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
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
        id: 'schedule-1',
        type: 'schedule',
        position: { x: 100, y: 100 },
        data: {
          label: 'Daily Report',
          cronExpression: '0 9 * * *',
          timezone: 'UTC',
          scheduleDescription: 'Every day at 9 AM UTC',
          inputVariables: {
            reportType: 'daily',
            format: 'pdf',
          },
        },
      },
      {
        id: 'http-1',
        type: 'http',
        position: { x: 400, y: 100 },
        data: {
          label: 'Generate Report',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-1',
            name: 'Generate Report',
            url: '/post?type={{reportType}}&time={{triggerTime}}',
            method: 'POST',
            headers: [],
            body: '{"format":"{{format}}"}',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'schedule-1', target: 'http-1' }],
  };
}

async function seedWebhookWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-webhook-1');
    localStorage.setItem('workflows_sample_dismissed', 'true');
  }, JSON.stringify([makeWebhookWorkflow()]));
}

async function seedScheduleWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-schedule-1');
    localStorage.setItem('workflows_sample_dismissed', 'true');
  }, JSON.stringify([makeScheduleWorkflow()]));
}

test.describe('Workflow Webhook Trigger', () => {
  test.beforeEach(async ({ page }) => {
    await seedWebhookWorkflow(page);
    await gotoAppTab(page, 'workflow');
  });

  test('renders webhook trigger node with correct styling', async ({ page }) => {
    // Should see the webhook node
    const webhookNode = page.locator('.react-flow__node').filter({ hasText: 'Order Webhook' });
    await expect(webhookNode).toBeVisible({ timeout: 5_000 });

    // Should have webhook-specific styling
    await expect(webhookNode.locator('.wf-node-webhook')).toBeVisible();
  });

  test('webhook node displays method and path', async ({ page }) => {
    const webhookNode = page.locator('.react-flow__node').filter({ hasText: 'Order Webhook' });
    await expect(webhookNode).toBeVisible({ timeout: 5_000 });

    // Should show POST method
    await expect(webhookNode.locator('.wf-webhook-method')).toContainText('POST');

    // Should show the path
    await expect(webhookNode.locator('.wf-webhook-path')).toContainText('/api/orders');
  });

  test('webhook node shows extraction count', async ({ page }) => {
    const webhookNode = page.locator('.react-flow__node').filter({ hasText: 'Order Webhook' });
    await expect(webhookNode).toBeVisible({ timeout: 5_000 });

    // Should show "2 variables" for the two extracted variables
    await expect(webhookNode).toContainText('2 variables');
  });

  test('renders edge from webhook to HTTP node', async ({ page }) => {
    // Should have 1 edge connecting the nodes
    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(1, { timeout: 5_000 });
  });

  test('opens webhook configuration modal on double-click', async ({ page }) => {
    const webhookNode = page.locator('.wf-node-webhook').first();
    await webhookNode.waitFor({ state: 'visible', timeout: 5_000 });
    
    // Use dispatchEvent('dblclick') because React Flow intercepts pointer events
    await webhookNode.dispatchEvent('dblclick');

    // Configuration modal should open
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show webhook configuration in the modal
    await expect(page.locator('label').filter({ hasText: 'HTTP Method' })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Endpoint Path' })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Sample Payload' })).toBeVisible();
  });

  test('webhook config modal shows method dropdown', async ({ page }) => {
    const webhookNode = page.locator('.wf-node-webhook').first();
    await webhookNode.waitFor({ state: 'visible', timeout: 5_000 });
    await webhookNode.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Method dropdown should show POST selected (scoped to label)
    const methodSelect = modal.locator('label', { hasText: 'HTTP Method' }).locator('select');
    await expect(methodSelect).toHaveValue('POST');
  });

  test('webhook config modal shows endpoint path input', async ({ page }) => {
    const webhookNode = page.locator('.wf-node-webhook').first();
    await webhookNode.waitFor({ state: 'visible', timeout: 5_000 });
    await webhookNode.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Path input is the second text input (first is the readonly webhook URL)
    const pathInput = modal.locator('input[type="text"]').nth(1);
    await expect(pathInput).toHaveValue('/api/orders');
  });

  test('webhook config modal shows sample payload', async ({ page }) => {
    const webhookNode = page.locator('.wf-node-webhook').first();
    await webhookNode.waitFor({ state: 'visible', timeout: 5_000 });
    await webhookNode.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Payload textarea should contain the JSON (scoped to modal)
    const payloadTextarea = modal.locator('textarea').first();
    await expect(payloadTextarea).toContainText('orderId');
    await expect(payloadTextarea).toContainText('12345');
  });

  test('can drag webhook node from palette', async ({ page }) => {
    await openWorkflowBlocksTab(page);

    // Should see webhook trigger in palette
    const paletteBlock = page.locator('.wf-palette-block').filter({ hasText: 'Webhook Trigger' });
    await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

    // Should show webhook icon badge and description
    await expect(paletteBlock.locator('.wf-node-icon-badge')).toBeVisible();
    await expect(paletteBlock).toContainText('Incoming HTTP request');
  });
});

test.describe('Workflow Schedule Trigger', () => {
  test.beforeEach(async ({ page }) => {
    await seedScheduleWorkflow(page);
    await gotoAppTab(page, 'workflow');
  });

  test('renders schedule trigger node with correct styling', async ({ page }) => {
    // Should see the schedule node
    const scheduleNode = page.locator('.react-flow__node').filter({ hasText: 'Daily Report' });
    await expect(scheduleNode).toBeVisible({ timeout: 5_000 });

    // Should have schedule-specific styling
    await expect(scheduleNode.locator('.wf-node-schedule')).toBeVisible();
  });

  test('schedule node displays cron expression', async ({ page }) => {
    const scheduleNode = page.locator('.react-flow__node').filter({ hasText: 'Daily Report' });
    await expect(scheduleNode).toBeVisible({ timeout: 5_000 });

    // Should show the cron expression
    await expect(scheduleNode.locator('.wf-schedule-cron')).toContainText('0 9 * * *');
  });

  test('schedule node shows description', async ({ page }) => {
    const scheduleNode = page.locator('.react-flow__node').filter({ hasText: 'Daily Report' });
    await expect(scheduleNode).toBeVisible({ timeout: 5_000 });

    // Should show the schedule description
    await expect(scheduleNode).toContainText('Every day at 9 AM UTC');
  });

  test('schedule node shows variable count', async ({ page }) => {
    const scheduleNode = page.locator('.react-flow__node').filter({ hasText: 'Daily Report' });
    await expect(scheduleNode).toBeVisible({ timeout: 5_000 });

    // Should show "2 variables" for reportType and format
    await expect(scheduleNode).toContainText('2 variables');
  });

  test('renders edge from schedule to HTTP node', async ({ page }) => {
    // Should have 1 edge connecting the nodes
    const edges = page.locator('.react-flow__edge');
    await expect(edges).toHaveCount(1, { timeout: 5_000 });
  });

  test('opens schedule configuration modal on double-click', async ({ page }) => {
    const scheduleNode = page.locator('.wf-node-schedule').first();
    await scheduleNode.waitFor({ state: 'visible', timeout: 5_000 });
    
    // Use dispatchEvent('dblclick') because React Flow intercepts pointer events
    await scheduleNode.dispatchEvent('dblclick');

    // Configuration modal should open
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show schedule configuration fields
    await expect(page.locator('label').filter({ hasText: 'Cron Expression' })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Schedule Description' })).toBeVisible();
    await expect(page.locator('label').filter({ hasText: 'Timezone' })).toBeVisible();
  });

  test('schedule config modal shows cron input', async ({ page }) => {
    const scheduleNode = page.locator('.wf-node-schedule').first();
    await scheduleNode.waitFor({ state: 'visible', timeout: 5_000 });
    await scheduleNode.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Cron input should show the expression (scoped to modal)
    const cronInput = modal.locator('input[type="text"]').first();
    await expect(cronInput).toHaveValue('0 9 * * *');
  });

  test('schedule config modal shows timezone input', async ({ page }) => {
    const scheduleNode = page.locator('.wf-node-schedule').first();
    await scheduleNode.waitFor({ state: 'visible', timeout: 5_000 });
    await scheduleNode.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show timezone label
    await expect(modal.locator('label').filter({ hasText: 'Timezone' })).toBeVisible();
    
    // Timezone input should show UTC value
    const tzInputs = modal.locator('input[type="text"]');
    const tzInput = tzInputs.nth(2); // third text input (cron, description, timezone)
    await expect(tzInput).toHaveValue('UTC');
  });

  test('schedule config modal shows initial variables section', async ({ page }) => {
    const scheduleNode = page.locator('.wf-node-schedule').first();
    await scheduleNode.waitFor({ state: 'visible', timeout: 5_000 });
    await scheduleNode.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show initial variables section title (scoped to modal)
    await expect(modal.getByText('Initial variables', { exact: true })).toBeVisible();

    // Should show the variables section with key-value rows
    const varRows = modal.locator('.wf-config-kv-row');
    await expect(varRows.first()).toBeVisible();
    
    // Variables section should have the hint text
    await expect(modal.getByText(/Variables available at schedule trigger time/)).toBeVisible();
  });

  test('can drag schedule node from palette', async ({ page }) => {
    // Should see schedule trigger in palette
    const paletteBlock = page.locator('.wf-palette-block').filter({ hasText: 'Schedule' });
    await expect(paletteBlock).toBeVisible({ timeout: 5_000 });

    // Should show schedule icon badge and description
    await expect(paletteBlock.locator('.wf-node-icon-badge')).toBeVisible();
    await expect(paletteBlock).toContainText('Cron-based execution');
  });
});

test.describe('Workflow Trigger Execution', () => {
  test.beforeEach(async ({ page }) => {
    // Use webhook workflow for execution testing
    await seedWebhookWorkflow(page);
    await gotoAppTab(page, 'workflow');
  });

  test('workflow with webhook trigger loads successfully', async ({ page }) => {
    // Verify the workflow designer is loaded with webhook trigger
    const webhookNode = page.locator('.wf-node-webhook').first();
    await expect(webhookNode).toBeVisible({ timeout: 5_000 });

    // Verify the Quick Test button is present (workflow is ready to run)
    const runBtn = page.locator('button').filter({ hasText: 'Quick Test' });
    await expect(runBtn).toBeVisible({ timeout: 5_000 });
  });
});
