/**
 * E2E: Verifies the "Insert…" button appears in node config modals
 * for Condition, Switch, LogDebug, and WaitForCondition nodes.
 */
import { test, expect, type Page } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeInsertBtnWorkflow(): Workflow {
  return {
    id: 'wf-insert-btn-1',
    name: 'Insert Btn Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { status: 'active' },
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
          label: 'Fetch',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-1', name: 'Fetch', url: '/get', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
          initialVariables: { token: 'abc' },
        },
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 400, y: 100 },
        data: {
          label: 'Check Status',
          left: '{{status}}',
          operator: '==',
          right: '200',
        },
      },
      {
        id: 'switch-1',
        type: 'switch',
        position: { x: 400, y: 300 },
        data: {
          label: 'Route by Region',
          expression: '{{region}}',
          cases: [
            { id: 'c1', value: 'US', label: 'US' },
            { id: 'c2', value: 'EU', label: 'EU' },
          ],
        },
      },
      {
        id: 'log-1',
        type: 'logDebug',
        position: { x: 700, y: 100 },
        data: {
          label: 'Log Info',
          message: 'Status is {{status}}',
          logLevel: 'info',
          snapshotVariables: false,
        },
      },
      {
        id: 'wait-1',
        type: 'waitForCondition',
        position: { x: 700, y: 300 },
        data: {
          label: 'Wait Done',
          conditionExpression: '{{status}} == done',
          pollIntervalMs: 1000,
          timeoutMs: 30000,
          maxAttempts: 10,
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'http-1', target: 'cond-1' },
      { id: 'e2', source: 'http-1', target: 'switch-1' },
      { id: 'e3', source: 'cond-1', target: 'log-1', sourceHandle: 'true', label: 'Yes' },
      { id: 'e4', source: 'cond-1', target: 'wait-1', sourceHandle: 'false', label: 'No' },
    ],
  };
}

async function seedInsertBtnWorkflow(page: Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-insert-btn-1');
    localStorage.setItem('workflows_sample_dismissed', 'true');
  }, JSON.stringify([makeInsertBtnWorkflow()]));
}

async function openNodeConfig(page: Page, nodeLabel: string) {
  const node = page.locator('.react-flow__node', { hasText: nodeLabel });
  await node.waitFor({ state: 'visible', timeout: 10_000 });

  await page.evaluate((label) => {
    const nodes = document.querySelectorAll('.react-flow__node');
    for (const n of nodes) {
      if (n.textContent?.includes(label)) {
        const evt = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
        n.dispatchEvent(evt);
        break;
      }
    }
  }, nodeLabel);

  const modal = page.locator('.ram-modal');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  return modal;
}

test.describe('Insert Variable button in node configs', () => {
  test.beforeEach(async ({ page }) => {
    await seedInsertBtnWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 25_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.wf-designer', { timeout: 25_000 });
  });

  test('condition node config shows Insert button', async ({ page }) => {
    const modal = await openNodeConfig(page, 'Check Status');
    // Switch to expression mode to see the Insert button for left operand
    const exprRadio = modal.locator('label', { hasText: 'Expression' });
    if (await exprRadio.isVisible()) {
      await exprRadio.click();
    }
    // Should have Insert button(s)
    const insertBtns = modal.locator('button', { hasText: 'Insert…' });
    await expect(insertBtns.first()).toBeVisible({ timeout: 3_000 });
  });

  test('switch node config shows Insert button', async ({ page }) => {
    const modal = await openNodeConfig(page, 'Route by Region');
    const insertBtn = modal.locator('button', { hasText: 'Insert…' });
    await expect(insertBtn.first()).toBeVisible({ timeout: 3_000 });
  });

  test('logDebug node config shows Insert button', async ({ page }) => {
    const modal = await openNodeConfig(page, 'Log Info');
    const insertBtn = modal.locator('button', { hasText: 'Insert…' });
    await expect(insertBtn.first()).toBeVisible({ timeout: 3_000 });
  });

  test('waitForCondition node config shows Insert button', async ({ page }) => {
    const modal = await openNodeConfig(page, 'Wait Done');
    const insertBtn = modal.locator('button', { hasText: 'Insert…' });
    await expect(insertBtn.first()).toBeVisible({ timeout: 3_000 });
  });

  test('condition node shows Insert buttons in expression mode', async ({ page }) => {
    const modal = await openNodeConfig(page, 'Check Status');
    // Switch to expression mode
    const exprRadio = modal.locator('label', { hasText: 'Expression' });
    await exprRadio.click();
    // Should have at least 2 Insert buttons in expression mode (left operand + right value)
    // Additional Insert buttons come from the variables section
    const insertBtns = modal.locator('button', { hasText: 'Insert…' });
    const count = await insertBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
