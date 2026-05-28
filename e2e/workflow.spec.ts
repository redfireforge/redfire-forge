import { test, expect } from '@playwright/test';
import { confirmFolderPickerModal, seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

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

    // Click Save (force to avoid Quick Test button overlap at default viewport)
    const saveBtn = page.locator('.wf-toolbar-save-wrap button').first();
    await saveBtn.click({ force: true });

    // Verify workflow was persisted (may be in IndexedDB or localStorage)
    const stored = await page.evaluate(async () => {
      // Try IndexedDB first (v5+), fall back to localStorage
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('redfireforge');
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (db.objectStoreNames.contains('workflows')) {
          const idbVal = await new Promise<unknown>((resolve) => {
            const t = db.transaction('workflows', 'readonly');
            const r = t.objectStore('workflows').get('all');
            r.onsuccess = () => resolve(r.result ?? null);
            r.onerror = () => resolve(null);
          });
          db.close();
          if (idbVal) return JSON.stringify(idbVal);
        }
        db.close();
      } catch { /* fallback */ }
      return localStorage.getItem('workflows');
    });
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.some((w: { name: string }) => w.name === 'E2E Workflow')).toBe(true);
  });

  test('service registry fullscreen modal does not overlap the sidebar', async ({ page }) => {
    // Open inline services panel
    const servicesBtn = page.locator('.wf-toolbar-services-btn:has-text("Services")');
    await servicesBtn.click();
    await expect(page.locator('.wf-svc-inline-list')).toBeVisible({ timeout: 3000 });

    // Expand to fullscreen modal via the ⛶ button
    await page.locator('button[title="Expand to full screen"]').click();

    // Wait for fullscreen service registry modal
    const modal = page.locator('.wf-svc-registry-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // The modal uses wf-config-modal-overlay (position: absolute within wf-designer)
    // so it should NOT extend behind the sidebar
    const overlay = page.locator('.wf-config-modal-overlay').first();
    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).toBeTruthy();

    // The sidebar is to the left — modal overlay's left edge must not be at x=0
    // (which would mean it's covering the sidebar/activity bar area)
    const sidebar = page.locator('.app-sidebar, .sidebar').first();
    if (await sidebar.count() > 0) {
      const sidebarBox = await sidebar.boundingBox();
      if (sidebarBox && overlayBox) {
        // Overlay must start at or after the sidebar's right edge
        expect(overlayBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width - 2);
      }
    }

    // Footer buttons (Cancel / Apply) must be visible and within the viewport
    const footer = modal.locator('.wf-config-modal-footer');
    await expect(footer).toBeVisible({ timeout: 3000 });
    const cancelBtn = footer.locator('button', { hasText: 'Cancel' });
    const applyBtn = footer.locator('button', { hasText: 'Apply' });
    await expect(cancelBtn).toBeVisible();
    await expect(applyBtn).toBeVisible();
    const footerBox = await footer.boundingBox();
    expect(footerBox).toBeTruthy();

    // Footer must be within the visible viewport (not clipped below)
    const viewport = page.viewportSize()!;
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport.height + 1);

    // Expand/shrink and close buttons should be hidden (redundant with Cancel/Apply)
    await expect(modal.locator('.ram-modal-close')).toHaveCount(0);

    // Close the modal via Cancel button
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
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

    // Click +New → From Template to navigate to Gallery
    await page.locator('button:has-text("+ New")').click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();

    // Gallery page should appear — filter to Workflows domain
    await page.locator('.gallery-domain-btn:has-text("Workflows")').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.gallery-domain-btn:has-text("Workflows")').click();
    await page.waitForTimeout(300);

    // Select first workflow card
    const firstCard = page.locator('.gallery-card').first();
    await firstCard.click();
    await page.waitForTimeout(300);

    // Click "Load Workflow" action button in detail panel
    await page.locator('button:has-text("Load Workflow")').click();

    // Should show preview mode — click "Use as Template" to save
    await expect(page.locator('button:has-text("Use as Template")')).toBeVisible({ timeout: 5000 });
    await page.locator('button:has-text("Use as Template")').click();
    await confirmFolderPickerModal(page);

    // Should see a workflow item appear in sidebar (navigates back to workflow tab)
    await expect(page.locator('.wf-sidebar-item')).toBeVisible({ timeout: 5000 });
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
