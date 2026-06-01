/**
 * E2E: Correlation Wait node.
 * Verifies canvas rendering, palette block, node config modal, and webhook callback.
 */
import { test, expect } from '@playwright/test';
import { gotoAppTab, seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

/** Workflow with Start → HTTP → CorrelationWait → HTTP → End */
function makeCorrelationWorkflow(): Workflow {
  return {
    id: 'wf-corr',
    name: 'Correlation Wait E2E',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { orderId: 'order-123' },
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start-1', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'http-1', type: 'http', position: { x: 280, y: 120 },
        data: {
          label: 'Submit Order',
          method: 'POST',
          url: 'http://localhost:5173/api/orders',
          headers: [],
          body: '{"orderId": "{{orderId}}"}',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
      {
        id: 'cw-1', type: 'correlationWait', position: { x: 260, y: 280 },
        data: {
          label: 'Wait for Payment',
          correlationIdExpression: '{{orderId}}',
          webhookPath: '/webhooks/callback/payment',
          timeoutMs: 30000,
          correlationSource: 'body' as const,
          correlationJsonPath: '$.paymentId',
          extractVariables: [
            { name: 'paymentStatus', jsonPath: '$.status' },
          ],
          webhookFilter: '',
          notes: 'Wait for payment callback',
        },
      },
      {
        id: 'http-2', type: 'http', position: { x: 280, y: 440 },
        data: {
          label: 'Confirm Order',
          method: 'POST',
          url: 'http://localhost:5173/api/confirm',
          headers: [],
          body: '{"status": "{{paymentStatus}}"}',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
      {
        id: 'end-1', type: 'end', position: { x: 300, y: 600 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'http-1' },
      { id: 'e2', source: 'http-1', target: 'cw-1' },
      { id: 'e3', source: 'cw-1', target: 'http-2' },
      { id: 'e4', source: 'http-2', target: 'end-1' },
    ],
  };
}

async function seedAndNavigate(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-corr');
  }, JSON.stringify([makeCorrelationWorkflow()]));
  await gotoAppTab(page, 'workflow');
}

// ── Canvas rendering ─────────────────────────────────

test.describe('Correlation Wait Node — Canvas', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('renders CorrelationWait node with label', async ({ page }) => {
    const node = page.locator('.wf-node-correlationWait');
    await expect(node).toBeVisible({ timeout: 5000 });
    await expect(node.locator('.wf-node-label')).toHaveText('Wait for Payment');
  });

  test('shows correlation ID preview', async ({ page }) => {
    const node = page.locator('.wf-node-correlationWait');
    await expect(node).toBeVisible({ timeout: 5000 });
    await expect(node.locator('.wf-correlation-id')).toContainText('{{orderId}}');
  });

  test('shows webhook path', async ({ page }) => {
    const node = page.locator('.wf-node-correlationWait');
    await expect(node).toBeVisible({ timeout: 5000 });
    await expect(node.locator('.wf-correlation-path')).toContainText('/webhooks/callback/payment');
  });

  test('shows timeout', async ({ page }) => {
    const node = page.locator('.wf-node-correlationWait');
    await expect(node).toBeVisible({ timeout: 5000 });
    await expect(node.locator('.wf-correlation-timeout')).toContainText('30s');
  });

  test('has Configure button', async ({ page }) => {
    const node = page.locator('.wf-node-correlationWait');
    await expect(node).toBeVisible({ timeout: 5000 });
    await expect(node.locator('.wf-node-configure-badge')).toBeVisible();
  });

  test('has input and output handles', async ({ page }) => {
    const node = page.locator('.wf-node-correlationWait');
    await expect(node).toBeVisible({ timeout: 5000 });
    // Should have at least a top/bottom handle
    await expect(node.locator('.react-flow__handle')).toHaveCount(2);
  });
});

// ── Config Modal ─────────────────────────────────────

test.describe('Correlation Wait Node — Config Modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('opens config modal', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wf-config-modal-title')).toContainText('CORRELATIONWAIT');
  });

  test('config modal shows label field', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    // Should have a label input with current value
    const labelInput = modal.locator('.wf-config-field input').first();
    await expect(labelInput).toHaveValue('Wait for Payment');
  });

  test('config modal closes on Close button', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });
});

// ── Palette ──────────────────────────────────────────

test.describe('Correlation Wait Node — Palette', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('palette Actions category shows Correlation Wait block', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    await expect(page.locator('.wf-palette-block-correlationWait .wf-pb-title')).toHaveText('Correlation Wait');
  });

  test('clicking Correlation Wait palette block adds a node to canvas', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    await blocksTab.click();

    await expect(page.locator('.wf-node-correlationWait')).toHaveCount(1);
    await page.locator('.wf-palette-block-correlationWait').click();
    await expect(page.locator('.wf-node-correlationWait')).toHaveCount(2);
  });
});

// ── Config Modal — Test Webhook section ──────────────

test.describe('Correlation Wait Node — Test Webhook', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('config modal shows Test Webhook section', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    const testWebhookSection = modal.locator('[data-testid="test-webhook-section"]');
    await testWebhookSection.scrollIntoViewIfNeeded();
    await expect(testWebhookSection).toBeVisible();
    await expect(modal.locator('.wf-test-webhook-title')).toHaveText('Test Webhook');
  });

  test('Test Webhook textarea has default payload', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    const textarea = modal.locator('[data-testid="test-webhook-payload"]');
    await expect(textarea).toBeVisible();
    const value = await textarea.inputValue();
    expect(value).toContain('paymentId');
  });

  test('Test Webhook has Send button', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal.locator('[data-testid="test-webhook-send"]')).toBeVisible();
    await expect(modal.locator('[data-testid="test-webhook-send"]')).toContainText('Send Test Webhook');
  });

  test('default payload includes extract variables', async ({ page }) => {
    await page.locator('.wf-node-correlationWait .wf-node-configure-badge').click();
    const modal = page.locator('.wf-config-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    const textarea = modal.locator('[data-testid="test-webhook-payload"]');
    const value = await textarea.inputValue();
    // Should include paymentStatus from extractVariables config
    expect(value).toContain('status');
  });
});

// ── Execution History — Paused Tab ───────────────────

test.describe('Execution History — Paused Tab', () => {
  test('paused filter option exists in execution history', async ({ page }) => {
    await seedAppData(page);

    // Mock API endpoints so the component renders without a real backend
    await page.route('**/api/executions*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ executions: [] }) })
    );
    await page.route('**/api/correlations', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ correlations: [] }) })
    );

    await gotoAppTab(page, 'workflow-executions');

    // The dropdown should have a paused option
    const select = page.locator('.exh-select').first();
    await expect(select).toBeVisible({ timeout: 5000 });
    const options = await select.locator('option').allTextContents();
    const hasPaused = options.some(t => t.includes('Paused'));
    expect(hasPaused).toBe(true);
  });
});
