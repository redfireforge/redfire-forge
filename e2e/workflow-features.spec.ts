import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeSampleWorkflow(): Workflow {
  return {
    id: 'wf-e2e-feat',
    name: 'Feature Test Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: { baseUrl: 'https://httpbin.org', apiKey: 'test-key-123' },
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
        id: 'n1',
        type: 'http',
        position: { x: 100, y: 100 },
        data: {
          label: 'Get Status',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-1', name: 'Get Status', url: '/get', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'n2',
        type: 'condition',
        position: { x: 100, y: 300 },
        data: { label: 'Check Status', left: '{{status}}', operator: '==', right: '200' },
      },
      {
        id: 'n3',
        type: 'http',
        position: { x: 100, y: 500 },
        data: {
          label: 'Post Data',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-2', name: 'Post Data', url: '/post', method: 'POST',
            headers: [], body: '{"key":"value"}', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'n4',
        type: 'delay',
        position: { x: 400, y: 500 },
        data: { label: 'Wait', delayMs: 1000, mode: 'fixed' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'true', label: 'Yes' },
      { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 'false', label: 'No' },
    ],
  };
}

async function seedAndNavigate(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-e2e-feat');
  }, JSON.stringify([makeSampleWorkflow()]));
  await page.goto('/?tab=workflow');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 5000 });
}

test.describe('Canvas Controls', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('fit view and save layout buttons are visible in canvas controls', async ({ page }) => {
    const fitBtn = page.locator('.wf-pill-btn[title="Fit view"], .wf-pill-btn[title="Restore saved view"]');
    await expect(fitBtn).toBeVisible({ timeout: 5000 });

    const saveBtn = page.locator('[data-testid="save-layout-btn"]');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });

  test('clicking fit view keeps nodes visible', async ({ page }) => {
    const httpNodes = page.locator('.wf-node-http');
    await expect(httpNodes.first()).toBeVisible({ timeout: 5000 });

    const fitBtn = page.locator('.wf-pill-btn[title="Fit view"], .wf-pill-btn[title="Restore saved view"]');
    await fitBtn.click();

    await expect(httpNodes.first()).toBeVisible({ timeout: 3000 });

    const viewport = page.locator('.react-flow__viewport');
    await expect(viewport).toBeVisible();
  });
});

test.describe('Defaults Modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('Defaults button is visible in toolbar with badge', async ({ page }) => {
    const defaultsBtn = page.locator('.wf-toolbar-variables-btn', { hasText: /Workflow Variables/i });
    await expect(defaultsBtn).toBeVisible();

    // Badge should show count (2 variables seeded)
    const badge = defaultsBtn.locator('.wf-toolbar-services-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(Number(text)).toBe(2);
  });

  test('opens and closes defaults modal', async ({ page }) => {
    const defaultsBtn = page.locator('.wf-toolbar-variables-btn', { hasText: /Workflow Variables/i });
    await defaultsBtn.click();

    // Modal should be visible
    const modal = page.locator('[aria-labelledby="wf-defaults-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#wf-defaults-modal-title')).toHaveText('Workflow Variables');

    // Close via the × button (use dispatchEvent because workflow-designer-mount intercepts pointer events)
    const closeBtn = modal.locator('.ram-modal-close');
    await closeBtn.dispatchEvent('click');
    await expect(modal).not.toBeVisible();
  });

  test('displays seeded workflow variables', async ({ page }) => {
    const defaultsBtn = page.locator('.wf-toolbar-variables-btn', { hasText: /Workflow Variables/i });
    await defaultsBtn.click();

    const modal = page.locator('[aria-labelledby="wf-defaults-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Should see the seeded variable keys
    const keyInputs = modal.locator('.wf-var-key-input');
    const count = await keyInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      keys.push(await keyInputs.nth(i).inputValue());
    }
    expect(keys).toContain('baseUrl');
    expect(keys).toContain('apiKey');
  });

  test('can expand defaults modal to full screen', async ({ page }) => {
    const defaultsBtn = page.locator('.wf-toolbar-variables-btn', { hasText: /Workflow Variables/i });
    await defaultsBtn.click();

    const modal = page.locator('[aria-labelledby="wf-defaults-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Click the shared expand control in the modal header.
    const expandBtn = modal.getByRole('button', { name: 'Expand modal' }).first();
    await expandBtn.dispatchEvent('click');

    // Shared fullscreen expand mode adds the modal-fullscreen class.
    await expect(page.locator('.modal-fullscreen').first()).toBeVisible();
  });
});

test.describe('Node Config Modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('Configure badge is visible on HTTP nodes', async ({ page }) => {
    const configBadge = page.locator('.wf-node-configure-badge').first();
    await expect(configBadge).toBeVisible({ timeout: 5000 });
    await expect(configBadge).toHaveAttribute('title', /Configure/);
  });

  test('clicking Configure badge opens node config modal', async ({ page }) => {
    // Wait for nodes to render in the canvas
    const configBadge = page.locator('.wf-node-http .wf-node-configure-badge').first();
    await expect(configBadge).toBeVisible({ timeout: 5000 });
    // Use dispatchEvent because React Flow intercepts pointer events on the canvas
    await configBadge.dispatchEvent('click');

    // Config modal should open
    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Title should contain HTTP type
    await expect(page.locator('#wf-config-modal-title')).toContainText('HTTP');
  });

  test('double-clicking a node opens config modal', async ({ page }) => {
    // Use dispatchEvent('dblclick') because React Flow intercepts pointer events
    const node = page.locator('.wf-node-http').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.dispatchEvent('dblclick');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('config modal has Save and Close buttons', async ({ page }) => {
    const configBadge = page.locator('.wf-node-http .wf-node-configure-badge').first();
    await expect(configBadge).toBeVisible({ timeout: 5000 });
    await configBadge.dispatchEvent('click');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await expect(modal.locator('button', { hasText: 'Save' })).toBeVisible();
    await expect(modal.locator('button', { hasText: 'Close' })).toBeVisible();
  });

  test('closing config modal via Close does not persist changes', async ({ page }) => {
    // Wait for auto-enrichment/auto-save to settle
    await page.waitForTimeout(1000);

    // Capture node scenarios before opening the modal
    const nodesBefore = await page.evaluate(() => {
      const stored = localStorage.getItem('workflows');
      if (!stored) return null;
      const wfs = JSON.parse(stored);
      const wf = wfs.find((w: { id: string }) => w.id === 'wf-e2e-feat');
      return wf?.nodes?.map((n: { id: string; data: { scenario?: unknown; label?: string } }) => ({
        id: n.id,
        label: n.data.label,
        scenario: n.data.scenario,
      }));
    });

    // Open config modal
    const configBadge = page.locator('.wf-node-http .wf-node-configure-badge').first();
    await expect(configBadge).toBeVisible({ timeout: 5000 });
    await configBadge.dispatchEvent('click');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Click Close
    await modal.locator('button', { hasText: 'Close' }).click();
    await expect(modal).not.toBeVisible();

    // Node configurations should not have changed
    const nodesAfter = await page.evaluate(() => {
      const stored = localStorage.getItem('workflows');
      if (!stored) return null;
      const wfs = JSON.parse(stored);
      const wf = wfs.find((w: { id: string }) => w.id === 'wf-e2e-feat');
      return wf?.nodes?.map((n: { id: string; data: { scenario?: unknown; label?: string } }) => ({
        id: n.id,
        label: n.data.label,
        scenario: n.data.scenario,
      }));
    });

    expect(nodesAfter).toEqual(nodesBefore);
  });

  test('condition node shows Configure badge', async ({ page }) => {
    const condBadge = page.locator('.wf-node-condition .wf-node-configure-badge');
    await expect(condBadge).toBeVisible({ timeout: 5000 });
  });

  test('delay node shows Configure badge', async ({ page }) => {
    const delayBadge = page.locator('.wf-node-delay .wf-node-configure-badge');
    await expect(delayBadge).toBeVisible({ timeout: 5000 });
  });

  test('config modal has Save button with primary styling', async ({ page }) => {
    const configBadge = page.locator('.wf-node-http .wf-node-configure-badge').first();
    await expect(configBadge).toBeVisible({ timeout: 5000 });
    await configBadge.dispatchEvent('click');

    const modal = page.locator('[aria-labelledby="wf-config-modal-title"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Save button should have primary styling
    await expect(modal.locator('button.btn-primary', { hasText: 'Save' })).toBeVisible();
  });
});

test.describe('MiniMap Status Colors', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('minimap is visible with nodes', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 5000 });

    // MiniMap should contain SVG node representations
    const minimapNodes = minimap.locator('.react-flow__minimap-node');
    const count = await minimapNodes.count();
    expect(count).toBeGreaterThanOrEqual(4); // 4 nodes seeded
  });
});
