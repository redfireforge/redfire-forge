import { expect, type Page } from '@playwright/test';
import type { Workflow, WorkflowFolder } from '../src/features/workflow/types/workflow';

async function safeReload(page: Page): Promise<void> {
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    return;
  } catch {
    await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
  }
}

export async function waitForAppShell(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
}

export async function waitForWorkflowReady(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const visible = await page.locator('.wf-designer').isVisible({ timeout: 15000 }).catch(() => false);
    if (visible) {
      return;
    }

    if (attempt === 0) {
      await page.goto('/?tab=workflow', { waitUntil: 'domcontentloaded' });
    }
  }

  await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 20000 });
}

export async function openWorkflowBlocksTab(page: Page): Promise<void> {
  await expect(page.locator('.wf-palette')).toBeVisible({ timeout: 5000 });
  const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
  await blocksTab.click();
  await expect(page.locator('.wf-palette-category-title').first()).toBeVisible({ timeout: 5000 });
}

export async function gotoAppTab(page: Page, tab: string): Promise<void> {
  await page.goto(`/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (tab === 'workflow') {
    await waitForWorkflowReady(page);
    return;
  }
  await waitForAppShell(page);
}

export async function reloadAppTab(page: Page, tab?: string): Promise<void> {
  if (tab) {
    await page.goto(`/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  } else {
    await safeReload(page);
  }
  if (tab === 'workflow') {
    await waitForWorkflowReady(page);
    return;
  }
  await waitForAppShell(page);
}

/**
 * Seeds localStorage with flat v3 data so the app starts with an
 * environment and microservice already selected — prerequisite for most tests.
 * Also dismisses onboarding hints to prevent tooltip interference with tests.
 */
export async function seedAppData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
      id: 'svc-1', name: 'test-service',
      baseUrls: { 'env-1': 'http://localhost:5173' },
    }]));
    localStorage.setItem('perf-test-v3-feature-groups', '[]');
    localStorage.setItem('perf-test-v3-selected-env', 'env-1');
    localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
    localStorage.setItem('perf-test-v3-migrated', 'true');
    localStorage.setItem('perf-test-theme', 'dark');
    // Dismiss all onboarding hints to prevent tooltip interference with E2E tests
    localStorage.setItem('redfire-onboarding-dismissed', JSON.stringify([
      'palette-drag', 'command-palette', 'node-config', 'connect-nodes', 'quick-test',
    ]));
  });
}

/**
 * Seeds flat v3 data with a Feature Group, Scenario, and one Test already present.
 * Also dismisses onboarding hints to prevent tooltip interference with tests.
 */
export async function seedAppDataWithTest(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
      id: 'svc-1', name: 'test-service',
      baseUrls: { 'env-1': 'http://localhost:5173' },
    }]));
    localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
      id: 'fg-1',
      name: 'E2E Feature',
      microserviceId: 'svc-1',
      environmentId: 'env-1',
      scenarios: [{
        id: 'sc-1',
        name: 'E2E Scenario',
        tests: [{
          id: 'test-1',
          name: 'GET Homepage',
          url: 'http://localhost:5173/',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        }],
      }],
    }]));
    localStorage.setItem('perf-test-v3-selected-env', 'env-1');
    localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
    localStorage.setItem('perf-test-v3-migrated', 'true');
    localStorage.setItem('perf-test-theme', 'dark');
    // Dismiss all onboarding hints to prevent tooltip interference with E2E tests
    localStorage.setItem('redfire-onboarding-dismissed', JSON.stringify([
      'palette-drag', 'command-palette', 'node-config', 'connect-nodes', 'quick-test',
    ]));
  });
}

/** Confirm save destination in FolderPickerModal (opened by "Use as Template" gallery flow). */
export async function confirmFolderPickerModal(page: Page, opts?: { timeout?: number }) {
  const timeout = opts?.timeout ?? 5000;
  await page.locator('.fp-dialog').waitFor({ state: 'visible', timeout });
  await page.locator('.fp-dialog .btn-primary').click();
  await page.waitForTimeout(500);
}

/** Navigate Harness → Results sub-tab (without opening Results Explorer). */
export async function navigateToHarnessResults(page: Page, waitMs = 0): Promise<void> {
  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();

  const resultsTab = page.locator('button.sub-nav-tab:has-text("Results")');
  await expect(resultsTab).toBeVisible({ timeout: 5000 });
  await resultsTab.click();

  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }
}

export type OpenResultsExplorerOptions = {
  /** Retry Harness click if Results sub-nav didn't appear */
  retryHarness?: boolean;
  /** Milliseconds to wait after clicking Results tab and Explorer button */
  waitAfterNavMs?: number;
};

/** Navigate Harness → Results → Results Explorer. */
export async function openResultsExplorer(page: Page, options?: OpenResultsExplorerOptions): Promise<void> {
  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();

  const resultsTab = page.locator('button.sub-nav-tab:has-text("Results")');
  if (options?.retryHarness && !await resultsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await harnessBtn.click();
  }
  const resultsTimeout = options?.retryHarness ? 8000 : 5000;
  await expect(resultsTab).toBeVisible({ timeout: resultsTimeout });
  await resultsTab.click();

  if (options?.waitAfterNavMs) {
    await page.waitForTimeout(options.waitAfterNavMs);
  }

  const explorerBtn = page.locator('button:has-text("Results Explorer")');
  const explorerTimeout = options?.retryHarness ? 10000 : 8000;
  await expect(explorerBtn.first()).toBeVisible({ timeout: explorerTimeout });
  await explorerBtn.first().click();

  if (options?.waitAfterNavMs) {
    await page.waitForTimeout(options.waitAfterNavMs);
  }
}

/** Click Fit view when the canvas control is visible. */
export async function clickFitViewIfVisible(page: Page, timeout = 3000): Promise<void> {
  const fitBtn = page.locator('button[title="Fit view"]').first();
  if (await fitBtn.isVisible({ timeout }).catch(() => false)) {
    await fitBtn.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Seed a workflow in localStorage, seed a test run in IndexedDB, and reload
 * so the app picks up both.
 */
export async function seedWorkflowAndTestRun(
  page: Page,
  workflow: unknown,
  testRun: unknown,
): Promise<void> {
  await page.addInitScript((wfs) => {
    localStorage.setItem('workflows', JSON.stringify(wfs));
  }, [workflow]);

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('domcontentloaded');

  const seeded = await seedTestRunsViaIDB(page, [testRun]);
  expect(seeded).toBe('ok');

  await reloadAppTab(page);
}

/**
 * Seeds test runs into IndexedDB via page.evaluate so E2E tests can
 * start with pre-populated results data. Creates all required object
 * stores if they don't already exist (matching src/shared/utils/idbOpen.ts).
 */
export function makeWorkflowForE2E(
  id: string,
  name: string,
  folderId?: string,
  folderOrder?: number,
): Workflow {
  const ts = Date.now();
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

export function makeFolderForE2E(
  id: string,
  name: string,
  parentId?: string,
): WorkflowFolder {
  return { id, name, parentId, order: 0 };
}

export async function seedTestRunsViaIDB(page: Page, runs: unknown[]): Promise<string> {
  return await page.evaluate((testRuns) => {
    return new Promise<string>((resolve) => {
      const req = indexedDB.open('redfireforge', 5);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('testRuns')) {
          const store = db.createObjectStore('testRuns', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('featureGroups')) db.createObjectStore('featureGroups');
        if (!db.objectStoreNames.contains('sharedDataSources')) db.createObjectStore('sharedDataSources');
        if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash');
        if (!db.objectStoreNames.contains('workflows')) db.createObjectStore('workflows');
        if (!db.objectStoreNames.contains('workflowFolders')) db.createObjectStore('workflowFolders');
        if (!db.objectStoreNames.contains('requests')) db.createObjectStore('requests');
        if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog');
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('testRuns', 'readwrite');
        const store = tx.objectStore('testRuns');
        for (const run of testRuns) store.put(run);
        tx.oncomplete = () => resolve('ok');
      };
      req.onerror = () => resolve('idb-error');
    });
  }, runs);
}
