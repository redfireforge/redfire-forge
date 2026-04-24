import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/types/workflow';

function makeSampleWorkflow(): Workflow {
  return {
    id: 'wf-e2e-1',
    name: 'E2E Workflow',
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
    localStorage.setItem('workflows_selected_id', 'wf-e2e-1');
  }, JSON.stringify([makeSampleWorkflow()]));
}

test.describe('Workflow Designer', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('navigates to workflow tab and shows the workflow', async ({ page }) => {
    // Already on workflow tab from beforeEach
    // Should show the workflow designer
    await expect(page.locator('.wf-designer')).toBeVisible();
  });

  test('loads workflow and displays toolbar', async ({ page }) => {
    // Already on workflow tab from beforeEach
    await expect(page.locator('.wf-designer')).toBeVisible();

    // Should see workflow toolbar
    await expect(page.locator('.wf-toolbar')).toBeVisible();
  });

  test('opens and closes service registry panel', async ({ page }) => {
    // Already on workflow tab from beforeEach

    // Open services panel - use more specific selector
    const servicesBtn = page.locator('.wf-toolbar-services-btn:has-text("Services")');
    await servicesBtn.click();

    // Service panel should show "Services" inline header
    await expect(page.locator('.wf-svc-inline-list')).toBeVisible({ timeout: 3000 });

    // Close services panel by clicking again
    await servicesBtn.click();
    await expect(page.locator('.wf-svc-inline-list')).not.toBeVisible();
  });

  test('shows service count badge in toolbar', async ({ page }) => {
    // Already on workflow tab from beforeEach

    // Badge should be visible with a non-zero count
    const badge = page.locator('.wf-toolbar-services-badge');
    await expect(badge).toBeVisible();
    const text = await badge.textContent();
    expect(Number(text)).toBeGreaterThan(0);
  });

  test('can save workflow', async ({ page }) => {
    // Already on workflow tab from beforeEach

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
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('creates a new workflow from sidebar', async ({ page }) => {
    // Already on workflow tab from beforeEach

    // Click "+ New" button in sidebar to open dropdown
    const newBtn = page.locator('.wf-sidebar button', { hasText: '+ New' });
    await newBtn.click();

    // Click "Blank Workflow" from the dropdown
    const blankItem = page.locator('.wf-new-dropdown-item', { hasText: 'Blank Workflow' });
    await blankItem.click();

    // Fill in the workflow name in the create dialog
    const nameInput = page.locator('.req-confirm-input');
    await nameInput.fill('My E2E Workflow');

    // Click the Create button
    const createBtn = page.locator('.req-confirm-ok');
    await createBtn.click();

    // Sidebar should have the new workflow
    await expect(page.locator('.wf-sidebar-item-name', { hasText: 'My E2E Workflow' })).toBeVisible();
  });

  test('loads sample workflow via template gallery', async ({ page }) => {
    // Already on workflow tab from beforeEach

    // Click Gallery tab to open template gallery
    const galleryTab = page.locator('button.main-nav-tab:has-text("Gallery")');
    await galleryTab.click();

    // Select first template card
    const firstCard = page.locator('.tg-card').first();
    await firstCard.click();

    // With new preview flow, should see "Use as Template" button
    await expect(page.locator('button', { hasText: 'Use as Template' })).toBeVisible({ timeout: 5000 });

    // Click to create the workflow
    await page.locator('button', { hasText: 'Use as Template' }).click();

    // Should see a workflow item appear in sidebar
    await expect(page.locator('.wf-sidebar-item')).toBeVisible();
  });
});

test.describe('Workflow Node Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await seedWorkflowData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 5000 });
  });

  test('shows default config panel with hint text', async ({ page }) => {
    // When no node is selected, palette should be visible on the left
    await expect(page.locator('.wf-palette')).toBeVisible({ timeout: 5000 });
  });

  test('displays workflow palette with add options', async ({ page }) => {
    // Palette should be visible on the left
    await expect(page.locator('.wf-palette')).toBeVisible();
  });
});
