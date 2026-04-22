import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/types/workflow';

function makeSampleWorkflow(): Workflow {
  return {
    id: 'wf-e2e-1',
    name: 'E2E Workflow',
    schemaVersion: 3,
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
    localStorage.setItem('workflows_selected_id', 'wf-e2e-1');
  }, JSON.stringify([makeSampleWorkflow()]));
}

test.describe('Workflow Designer', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/');
    await page.waitForSelector('.app-header');
  });

  test('navigates to workflow tab and shows the workflow', async ({ page }) => {
    // Click the WORKFLOW nav button in the sidebar
    const workflowTab = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowTab.click();

    // Should show the workflow designer
    await expect(page.locator('.wf-designer')).toBeVisible();
  });

  test('loads workflow and displays toolbar', async ({ page }) => {
    const workflowTab = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowTab.click();
    await expect(page.locator('.wf-designer')).toBeVisible();

    // Should see workflow toolbar
    await expect(page.locator('.wf-toolbar')).toBeVisible();
  });

  test('opens and closes service registry panel', async ({ page }) => {
    const workflowTab = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowTab.click();
    await expect(page.locator('.wf-designer')).toBeVisible();

    // Open services panel
    const servicesBtn = page.locator('.wf-toolbar-services-btn');
    await servicesBtn.click();

    // Service panel should show "Services" inline header
    await expect(page.locator('.wf-svc-inline-list')).toBeVisible({ timeout: 3000 });

    // Close services panel by clicking again
    await servicesBtn.click();
    await expect(page.locator('.wf-svc-inline-list')).not.toBeVisible();
  });

  test('shows service count badge in toolbar', async ({ page }) => {
    const workflowTab = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowTab.click();
    await expect(page.locator('.wf-designer')).toBeVisible();

    // Badge should be visible with a non-zero count
    const badge = page.locator('.wf-toolbar-services-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(Number(text)).toBeGreaterThan(0);
  });

  test('can save workflow', async ({ page }) => {
    const workflowTab = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowTab.click();
    await expect(page.locator('.wf-designer')).toBeVisible();

    // Click Save
    const saveBtn = page.locator('.wf-toolbar button', { hasText: /Save/ }).first();
    await saveBtn.click();

    // Verify workflow was persisted
    const stored = await page.evaluate(() => localStorage.getItem('workflows'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.some((w: { name: string }) => w.name === 'E2E Workflow')).toBe(true);
  });
});

test.describe('Workflow Creation', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/');
    await page.waitForSelector('.app-header');
  });

  test('creates a new workflow from sidebar', async ({ page }) => {
    // Navigate to workflow tab via USB nav
    const workflowNavBtn = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowNavBtn.click();

    // Click "+ New" button in sidebar
    const newBtn = page.locator('.wf-sidebar button', { hasText: '+ New' });

    // Handle the prompt dialog
    page.on('dialog', async (dialog) => {
      await dialog.accept('My E2E Workflow');
    });
    await newBtn.click();

    // Sidebar should have the new workflow
    await expect(page.locator('.wf-sidebar-item-name', { hasText: 'My E2E Workflow' })).toBeVisible();
  });

  test('loads sample workflow', async ({ page }) => {
    const workflowNavBtn = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowNavBtn.click();

    // Click "Load Sample Workflow"
    const loadSampleBtn = page.locator('button', { hasText: 'Load Sample Workflow' });
    await loadSampleBtn.click();

    // Should see a workflow item appear in sidebar
    await expect(page.locator('.wf-sidebar-item')).toBeVisible();
  });
});

test.describe('Workflow Node Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/');
    await page.waitForSelector('.app-header');
    const workflowTab = page.locator('button.usb-nav-btn', { hasText: /WORKFLOW/i });
    await workflowTab.click();
    await expect(page.locator('.wf-designer')).toBeVisible();
  });

  test('shows default config panel with hint text', async ({ page }) => {
    // When no node is selected, hint text should be visible
    await expect(page.locator('text=Select a node to configure')).toBeVisible({ timeout: 3000 });
  });

  test('displays workflow palette with add options', async ({ page }) => {
    // Palette should be visible on the left
    await expect(page.locator('.wf-palette')).toBeVisible();
  });
});
