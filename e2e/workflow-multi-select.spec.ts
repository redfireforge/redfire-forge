import { test, expect, type Page } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow, WorkflowFolder } from '../src/features/workflow/types/workflow';

const ts = Date.now();

function makeWorkflow(id: string, name: string, folderId?: string, folderOrder?: number): Workflow {
  return {
    id,
    name,
    schemaVersion: 5,
    createdAt: ts,
    updatedAt: ts,
    variables: {},
    nodes: [
      { id: 'n1', type: 'http', position: { x: 100, y: 100 }, data: { label: 'Step' } },
    ],
    edges: [],
    folderId,
    folderOrder,
  } as Workflow;
}

function makeFolder(id: string, name: string, order: number): WorkflowFolder {
  return { id, name, order, collapsed: false };
}

const folders: WorkflowFolder[] = [
  makeFolder('f-perf', 'Performance', 0),
  makeFolder('f-int', 'Integration', 1),
];

const workflows: Workflow[] = [
  makeWorkflow('w1', 'Peak Load', 'f-perf', 0),
  makeWorkflow('w2', 'Sustained Load', 'f-perf', 1),
  makeWorkflow('w3', 'Checkout Flow', 'f-int', 0),
  makeWorkflow('w4', 'Health Check'),
  makeWorkflow('w5', 'Smoke Test'),
];

async function seedData(page: Page) {
  await seedAppData(page);
  await page.addInitScript((data: { wf: string; folders: string }) => {
    localStorage.setItem('workflows', data.wf);
    localStorage.setItem('workflow_folders', data.folders);
    localStorage.setItem('workflows_selected_id', 'w1');
  }, { wf: JSON.stringify(workflows), folders: JSON.stringify(folders) });
}

test.describe('Workflow Multi-Select', () => {
  test.beforeEach(async ({ page }) => {
    await seedData(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('Ctrl+click selects multiple workflows and shows checkboxes', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click();
    await page.locator('.wf-sidebar-item:has-text("Sustained Load")').click({ modifiers: ['ControlOrMeta'] });

    const checks = page.locator('.wf-multi-check.checked');
    await expect(checks).toHaveCount(2);

    const allChecks = page.locator('.wf-multi-check');
    expect(await allChecks.count()).toBeGreaterThan(2);
  });

  test('plain click clears multi-selection', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click();
    await page.locator('.wf-sidebar-item:has-text("Sustained Load")').click({ modifiers: ['ControlOrMeta'] });

    await expect(page.locator('.wf-multi-check.checked')).toHaveCount(2);

    await page.locator('.wf-sidebar-item:has-text("Checkout Flow")').click();
    await expect(page.locator('.wf-multi-check')).toHaveCount(0);
  });

  test('Shift+click selects a range of workflows', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click();
    await page.locator('.wf-sidebar-item:has-text("Checkout Flow")').click({ modifiers: ['Shift'] });

    const checks = page.locator('.wf-multi-check.checked');
    expect(await checks.count()).toBeGreaterThanOrEqual(2);
  });

  test('multi-selected items get highlighted styling', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click();
    await page.locator('.wf-sidebar-item:has-text("Sustained Load")').click({ modifiers: ['ControlOrMeta'] });

    const highlighted = page.locator('.wf-sidebar-item.wf-multi-selected');
    await expect(highlighted).toHaveCount(2);
  });

  test('right-click on multi-selected shows bulk context menu', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click();
    await page.locator('.wf-sidebar-item:has-text("Sustained Load")').click({ modifiers: ['ControlOrMeta'] });

    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click({ button: 'right' });

    await expect(page.locator('.wf-sidebar-ctx-header:has-text("2 workflows selected")')).toBeVisible();
    await expect(page.locator('.wf-sidebar-ctx-item:has-text("Delete 2 workflows")')).toBeVisible();
  });

  test('right-click on non-selected workflow during multi-select shows single context menu', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Peak Load")').click();
    await page.locator('.wf-sidebar-item:has-text("Sustained Load")').click({ modifiers: ['ControlOrMeta'] });

    await page.locator('.wf-sidebar-item:has-text("Checkout Flow")').click({ button: 'right' });

    await expect(page.locator('.wf-sidebar-ctx-item:has-text("Rename Workflow")')).toBeVisible();
    await expect(page.locator('.wf-sidebar-ctx-header')).not.toBeVisible();
  });

  test('bulk move to folder via context menu', async ({ page }) => {
    await page.locator('.wf-sidebar-item:has-text("Health Check")').click();
    await page.locator('.wf-sidebar-item:has-text("Smoke Test")').click({ modifiers: ['ControlOrMeta'] });

    await page.locator('.wf-sidebar-item:has-text("Health Check")').click({ button: 'right' });

    const moveBtn = page.locator('.wf-sidebar-ctx-item:has-text("Move 2 workflows to Folder")');
    await moveBtn.click();

    await page.locator('.wf-sidebar-ctx-item:has-text("Performance")').click();

    const perfFolder = page.locator('.wf-folder-group').filter({ hasText: 'Performance' });
    await expect(perfFolder.locator('.wf-sidebar-item:has-text("Health Check")')).toBeVisible();
    await expect(perfFolder.locator('.wf-sidebar-item:has-text("Smoke Test")')).toBeVisible();
  });
});
