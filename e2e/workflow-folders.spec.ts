import { test, expect, type Page } from '@playwright/test';
import { makeFolderForE2E, makeWorkflowForE2E, seedAppData } from './helpers';
import type { Workflow, WorkflowFolder } from '../src/features/workflow/types/workflow';

const folders: WorkflowFolder[] = [
  makeFolderForE2E('f-perf', 'Performance'),
  makeFolderForE2E('f-load', 'Load Tests', 'f-perf'),
  makeFolderForE2E('f-int', 'Integration'),
];

const workflows: Workflow[] = [
  makeWorkflowForE2E('w1', 'Peak Load', 'f-load', 0),
  makeWorkflowForE2E('w2', 'Sustained Load', 'f-load', 1),
  makeWorkflowForE2E('w3', 'Checkout Flow', 'f-int', 0),
  makeWorkflowForE2E('w4', 'Health Check'),
];

async function seedFolderData(page: Page) {
  await seedAppData(page);
  await page.addInitScript((data: { wf: string; folders: string }) => {
    localStorage.setItem('workflows', data.wf);
    localStorage.setItem('workflow_folders', data.folders);
    localStorage.setItem('workflows_selected_id', 'w1');
  }, { wf: JSON.stringify(workflows), folders: JSON.stringify(folders) });
}

test.describe('Workflow Folders', () => {
  test.beforeEach(async ({ page }) => {
    await seedFolderData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('renders folder tree with nested folders in sidebar', async ({ page }) => {
    await expect(page.locator('.wf-folder-header:has-text("Performance")')).toBeVisible();
    await expect(page.locator('.wf-folder-header:has-text("Load Tests")')).toBeVisible();
    await expect(page.locator('.wf-folder-header:has-text("Integration")')).toBeVisible();
  });

  test('shows workflows inside their folders', async ({ page }) => {
    await expect(page.locator('.wf-sidebar-item:has-text("Peak Load")')).toBeVisible();
    await expect(page.locator('.wf-sidebar-item:has-text("Sustained Load")')).toBeVisible();
    await expect(page.locator('.wf-sidebar-item:has-text("Checkout Flow")')).toBeVisible();
  });

  test('shows unfiled workflows at the bottom', async ({ page }) => {
    await expect(page.locator('.wf-sidebar-item:has-text("Health Check")')).toBeVisible();
  });

  test('collapses and expands folder on click', async ({ page }) => {
    const perfHeader = page.locator('.wf-folder-header:has-text("Performance")');
    await expect(page.locator('.wf-sidebar-item:has-text("Peak Load")')).toBeVisible();

    await perfHeader.click();
    await expect(page.locator('.wf-sidebar-item:has-text("Peak Load")')).not.toBeVisible();

    await perfHeader.click();
    await expect(page.locator('.wf-sidebar-item:has-text("Peak Load")')).toBeVisible();
  });

  test('search filters workflows and shows breadcrumb paths', async ({ page }) => {
    const searchInput = page.locator('[data-testid="wf-sidebar-search"]');
    await searchInput.fill('peak');

    await expect(page.locator('.wf-search-result-item:has-text("Peak Load")')).toBeVisible();
    await expect(page.locator('.wf-search-result-breadcrumb:has-text("Performance / Load Tests")')).toBeVisible();
    await expect(page.locator('.wf-sidebar-item:has-text("Health Check")')).not.toBeVisible();
  });

  test('search shows no-results message for unmatched query', async ({ page }) => {
    const searchInput = page.locator('[data-testid="wf-sidebar-search"]');
    await searchInput.fill('nonexistent');
    await expect(page.locator('.wf-sidebar-empty:has-text("No workflows match")')).toBeVisible();
  });

  test('search clear button resets to tree view', async ({ page }) => {
    const searchInput = page.locator('[data-testid="wf-sidebar-search"]');
    await searchInput.fill('peak');
    await expect(page.locator('.wf-search-result-item')).toBeVisible();

    await page.locator('.wf-sidebar-search-clear').click();
    await expect(page.locator('.wf-folder-header:has-text("Performance")')).toBeVisible();
    await expect(page.locator('.wf-search-result-item')).not.toBeVisible();
  });

  test('creates a new folder via + New menu', async ({ page }) => {
    await page.locator('button:has-text("+ New")').click();
    await page.locator('.wf-new-dropdown-item:has-text("New Folder")').click();

    const dialogInput = page.locator('.req-confirm-dialog input');
    await dialogInput.fill('My New Folder');
    await page.locator('.req-confirm-ok').click();

    await expect(page.locator('.wf-folder-header:has-text("My New Folder")')).toBeVisible();
  });

  test('renames a folder via context menu', async ({ page }) => {
    await page.locator('.wf-folder-header:has-text("Integration")').click({ button: 'right' });
    await page.locator('.wf-sidebar-ctx-item:has-text("Rename Folder")').click();

    const renameInput = page.locator('.wf-folder-inline-rename');
    await renameInput.clear();
    await renameInput.fill('API Integration');
    await renameInput.press('Enter');

    await expect(page.locator('.wf-folder-header:has-text("API Integration")')).toBeVisible();
  });

  test('deletes a folder via context menu', async ({ page }) => {
    await page.locator('.wf-folder-header:has-text("Integration")').click({ button: 'right' });
    await page.locator('.wf-sidebar-ctx-item:has-text("Delete Folder")').click();

    await page.locator('.req-confirm-ok:has-text("Delete")').click();

    await expect(page.locator('.wf-folder-header:has-text("Integration")')).not.toBeVisible();
    await expect(page.locator('.wf-sidebar-item:has-text("Checkout Flow")')).toBeVisible();
  });

  test('creates a sub-folder via context menu', async ({ page }) => {
    await page.locator('.wf-folder-header:has-text("Performance")').click({ button: 'right' });
    await page.locator('.wf-sidebar-ctx-item:has-text("New Sub-Folder")').click();

    const dialogInput = page.locator('.req-confirm-dialog input');
    await dialogInput.fill('Stress Tests');
    await page.locator('.req-confirm-ok').click();

    await expect(page.locator('.wf-folder-header:has-text("Stress Tests")')).toBeVisible();
  });
});

test.describe('Workflow Picker (Runner)', () => {
  test.beforeEach(async ({ page }) => {
    await seedFolderData(page);
    await page.goto('/?tab=workflow-runner');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('shows custom dropdown trigger with placeholder', async ({ page }) => {
    const trigger = page.locator('[data-testid="workflow-select"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Select a workflow');
  });

  test('opens dropdown and shows navigable folders plus unfiled workflows', async ({ page }) => {
    await page.locator('[data-testid="workflow-select"]').click();

    const panel = page.locator('.workflow-picker .wfp-dropdown-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.wft-dropdown-folder:has-text("Performance")')).toBeVisible();
    await expect(panel.locator('.wft-dropdown-folder:has-text("Integration")')).toBeVisible();
    await expect(panel.locator('.wfp-dropdown-item:has-text("Health Check")')).toBeVisible();
  });

  test('filters workflows by search in dropdown', async ({ page }) => {
    await page.locator('[data-testid="workflow-select"]').click();
    await page.locator('[data-testid="wfp-search-input"]').fill('peak');

    await expect(page.locator('.wfp-dropdown-item:has-text("Peak Load")')).toBeVisible();
    await expect(page.locator('.wfp-dropdown-item:has-text("Health Check")')).not.toBeVisible();
  });

  test('selects a workflow from dropdown and closes it', async ({ page }) => {
    const panel = page.locator('.wfp-dropdown-panel');
    await page.locator('[data-testid="workflow-select"]').click();
    await expect(panel).toBeVisible();

    await panel.locator('button.wft-dropdown-folder:has-text("Performance")').click();
    await page.waitForTimeout(200);
    await panel.locator('button.wft-dropdown-folder:has-text("Load Tests")').click();
    await page.waitForTimeout(200);
    await panel.locator('.wfp-dropdown-item:has-text("Peak Load")').click();

    await expect(page.locator('.wfp-dropdown-panel')).not.toBeVisible();
    await expect(page.locator('[data-testid="workflow-select"]')).toContainText('Peak Load');
  });

  test('shows no-match message for unmatched search', async ({ page }) => {
    await page.locator('[data-testid="workflow-select"]').click();
    await page.locator('[data-testid="wfp-search-input"]').fill('zzzzzzz');
    await expect(page.locator('.wfp-dropdown-empty')).toBeVisible();
  });
});
