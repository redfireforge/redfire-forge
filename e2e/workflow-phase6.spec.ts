import { test, expect } from '@playwright/test';
import { gotoAppTab, seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

// These interactions share seeded workflow/app state and are flaky in parallel.
test.describe.configure({ mode: 'serial' });

function makeSampleWorkflow(): Workflow {
  return {
    id: 'wf-e2e-p6',
    name: 'Phase6 E2E Workflow',
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
        id: 'n1',
        type: 'http',
        position: { x: 100, y: 100 },
        data: {
          label: 'Get Status',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-1',
            name: 'Get Status',
            url: '/get',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'n2',
        type: 'http',
        position: { x: 400, y: 100 },
        data: {
          label: 'Post Data',
          serviceId: 'svc-1',
          scenario: {
            id: 'sc-2',
            name: 'Post Data',
            url: '/post',
            method: 'POST',
            headers: [],
            body: '{"key":"value"}',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
  };
}

async function seedWorkflowData(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-e2e-p6');
  }, JSON.stringify([makeSampleWorkflow()]));
}

test.describe('Phase 6 – Canvas Controls', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await gotoAppTab(page, 'workflow');
  });

  test('canvas pill controls are visible', async ({ page }) => {
    await expect(page.locator('.wf-pill-controls')).toBeVisible();
  });

  test('zoom in / zoom out / fit buttons work', async ({ page }) => {
    const zoomInBtn = page.locator('.wf-pill-btn[title="Zoom in"]');
    const zoomOutBtn = page.locator('.wf-pill-btn[title="Zoom out"]');
    const fitBtn = page.locator('.wf-pill-btn[title="Fit view"]');

    await expect(zoomInBtn).toBeVisible();
    await expect(zoomOutBtn).toBeVisible();
    await expect(fitBtn).toBeVisible();

    // Click each without errors
    await zoomInBtn.click();
    await zoomOutBtn.click();
    await fitBtn.click();
  });

  test('minimap toggle works', async ({ page }) => {
    const minimapBtn = page.locator('.wf-pill-btn[title="Toggle minimap"]');
    await expect(minimapBtn).toBeVisible();

    // Toggle minimap off then on
    await minimapBtn.click();
    await minimapBtn.click();
  });

  test('fit view and save layout buttons are visible', async ({ page }) => {
    const fitBtn = page.locator('.wf-pill-btn[title="Fit view"], .wf-pill-btn[title="Restore saved view"]');
    await expect(fitBtn).toBeVisible();

    const saveBtn = page.locator('[data-testid="save-layout-btn"]');
    await expect(saveBtn).toBeVisible();
  });
});

test.describe('Phase 6 – Keyboard Shortcuts Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await gotoAppTab(page, 'workflow');
  });

  test('pressing ? opens shortcuts overlay', async ({ page }) => {
    // Focus the canvas area first
    await page.locator('.react-flow').click();
    await page.keyboard.press('?');
    await expect(page.locator('.wf-shortcuts-overlay')).toBeVisible({ timeout: 3000 });
  });

  test('shortcuts overlay shows categories and can be closed', async ({ page }) => {
    await page.locator('.react-flow').click();
    await page.keyboard.press('?');
    const overlay = page.locator('.wf-shortcuts-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    // Should have shortcut entries
    const entries = overlay.locator('.wf-shortcuts-row');
    expect(await entries.count()).toBeGreaterThan(0);

    // Close by pressing Escape
    await page.keyboard.press('Escape');
    await expect(overlay).not.toBeVisible();
  });
});

test.describe('Phase 6 – Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await gotoAppTab(page, 'workflow');
  });

  test('⌘K opens command palette', async ({ page }) => {
    await page.locator('.react-flow').click();
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.wf-cmd-palette')).toBeVisible({ timeout: 3000 });
  });

  test('command palette search filters results', async ({ page }) => {
    await page.locator('.react-flow').click();
    await page.keyboard.press('Meta+k');
    const palette = page.locator('.wf-cmd-palette');
    await expect(palette).toBeVisible({ timeout: 3000 });

    const input = palette.locator('input[type="text"]');
    await input.fill('zoom');
    // Should show filtered results
    const items = palette.locator('.wf-cmd-item');
    expect(await items.count()).toBeGreaterThan(0);
  });

  test('Escape closes command palette', async ({ page }) => {
    await page.locator('.react-flow').click();
    await page.keyboard.press('Meta+k');
    await expect(page.locator('.wf-cmd-palette')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.wf-cmd-palette')).not.toBeVisible();
  });
});

test.describe('Phase 6 – Node Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await gotoAppTab(page, 'workflow');
  });

  test('right-click on node shows context menu', async ({ page }) => {
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click({ button: 'right' });
    await expect(page.locator('.wf-node-ctx-menu')).toBeVisible({ timeout: 3000 });
  });

  test('context menu has Copy, Duplicate, Delete options', async ({ page }) => {
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click({ button: 'right' });
    const menu = page.locator('.wf-node-ctx-menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    await expect(menu.locator('text=Copy')).toBeVisible();
    await expect(menu.locator('text=Duplicate')).toBeVisible();
    await expect(menu.locator('text=Delete')).toBeVisible();
  });

  test('clicking outside closes context menu', async ({ page }) => {
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click({ button: 'right' });
    await expect(page.locator('.wf-node-ctx-menu')).toBeVisible({ timeout: 3000 });

    // Click the explicit backdrop rendered behind the context menu.
    await page.locator('.wf-node-ctx-backdrop').click();
    await expect(page.locator('.wf-node-ctx-menu')).not.toBeVisible();
  });
});

test.describe('Phase 6 – Toast Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 25000 });
    await page.waitForLoadState('networkidle');
  });

  test('copy node triggers toast notification', async ({ page }) => {
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click({ button: 'right' });
    const menu = page.locator('.wf-node-ctx-menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    await menu.locator('text=Copy').click();
    // Toast should appear
    await expect(page.locator('.wf-toast')).toBeVisible({ timeout: 3000 });
  });

  test('duplicate node triggers toast', async ({ page }) => {
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click({ button: 'right' });
    const menu = page.locator('.wf-node-ctx-menu');
    await expect(menu).toBeVisible({ timeout: 3000 });

    await menu.locator('text=Duplicate').click();
    await expect(page.locator('.wf-toast')).toBeVisible({ timeout: 3000 });
  });
});
