import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for Phase 8c: Parallel Execution Visualization.
 * Verifies swim-lane overlay and branch comparison table for fork/join workflows.
 */

const FORK_JOIN_WORKFLOW = {
  id: 'wf-fork-join-e2e',
  name: 'Fork/Join E2E Test',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start' } },
    { id: 'fork', type: 'fork', position: { x: 240, y: 120 }, data: { label: 'Parallel Fork' } },
    { id: 'branch-a', type: 'http', position: { x: 50, y: 280 }, data: { label: 'Branch A: Users', scenario: { id: 'sc1', name: 'Users', method: 'GET', url: 'https://jsonplaceholder.typicode.com/users', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'branch-b', type: 'http', position: { x: 400, y: 280 }, data: { label: 'Branch B: Posts', scenario: { id: 'sc2', name: 'Posts', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'join', type: 'join', position: { x: 240, y: 440 }, data: { label: 'Join' } },
    { id: 'end', type: 'end', position: { x: 250, y: 560 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'fork' },
    { id: 'e2', source: 'fork', target: 'branch-a' },
    { id: 'e3', source: 'fork', target: 'branch-b' },
    { id: 'e4', source: 'branch-a', target: 'join' },
    { id: 'e5', source: 'branch-b', target: 'join' },
    { id: 'e6', source: 'join', target: 'end' },
  ],
};

function makeTestRunWithForkJoin() {
  const now = Date.now();
  return {
    id: 'run-fork-join-e2e',
    timestamp: now,
    config: { executionMode: 'workflow', iterations: 1, concurrency: 1, thinkTime: { type: 'none' }, scenarioWeights: [] },
    summary: {
      totalRequests: 2, successfulRequests: 2, failedRequests: 0,
      totalDurationMs: 500, tps: 4, avgResponseTime: 150,
      minResponseTime: 100, maxResponseTime: 200,
      p50ResponseTime: 150, p95ResponseTime: 200, p99ResponseTime: 200,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [],
    workflowName: 'Fork/Join E2E Test',
    executionTrace: {
      workflowId: 'wf-fork-join-e2e',
      workflowName: 'Fork/Join E2E Test',
      totalIterations: 1,
      totalDurationMs: 500,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'],
      workflowSnapshot: { nodes: FORK_JOIN_WORKFLOW.nodes, edges: FORK_JOIN_WORKFLOW.edges },
      iterations: [
        {
          index: 0, passed: true, durationMs: 500,
          traversedEdges: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'],
          finalVariables: {},
          events: [
            { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'fork', nodeType: 'fork', nodeLabel: 'Parallel Fork', timestamp: now + 1, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'branch-a', nodeType: 'http', nodeLabel: 'Branch A: Users', timestamp: now + 2, state: 'pass' as const, durationMs: 100, details: { statusCode: 200, method: 'GET', url: '/users' } },
            { nodeId: 'branch-b', nodeType: 'http', nodeLabel: 'Branch B: Posts', timestamp: now + 2, state: 'pass' as const, durationMs: 200, details: { statusCode: 200, method: 'GET', url: '/posts' } },
            { nodeId: 'join', nodeType: 'join', nodeLabel: 'Join', timestamp: now + 202, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'end', nodeType: 'end', nodeLabel: 'End', timestamp: now + 203, state: 'pass' as const, durationMs: 1 },
          ],
        },
      ],
    },
  };
}

async function seedTestRunsViaIDB(page: Page, runs: unknown[]): Promise<string> {
  return await page.evaluate((testRuns) => {
    return new Promise<string>((resolve) => {
      const req = indexedDB.open('redfireforge', 3);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('testRuns')) {
          db.createObjectStore('testRuns', { keyPath: 'id' });
        }
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

async function openResultsExplorer(page: Page) {
  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();

  const resultsTab = page.locator('button.sub-nav-tab:has-text("Results")');
  await expect(resultsTab).toBeVisible({ timeout: 5000 });
  await resultsTab.click();
  await page.waitForTimeout(1500);

  const explorerBtn = page.locator('button:has-text("Results Explorer")');
  await expect(explorerBtn.first()).toBeVisible({ timeout: 8000 });
  await explorerBtn.first().click();
  await page.waitForTimeout(1500);

  // Fit view to ensure nodes are visible
  const fitViewBtn = page.locator('button[title="Fit view"]').first();
  if (await fitViewBtn.isVisible()) {
    await fitViewBtn.click();
    await page.waitForTimeout(300);
  }
}

test.describe('Parallel Execution Visualization (Phase 8c)', () => {
  test.beforeEach(async ({ page }) => {
    page.addInitScript((workflow) => {
      localStorage.setItem('workflows', JSON.stringify([workflow]));
    }, FORK_JOIN_WORKFLOW);

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    const seeded = await seedTestRunsViaIDB(page, [makeTestRunWithForkJoin()]);
    expect(seeded).toBe('ok');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('swim lanes are rendered for fork/join branches', async ({ page }) => {
    await openResultsExplorer(page);

    // Swim lane labels should be visible — search for "Branch A" and "Branch B" text
    const branchA = page.locator('.swim-lane-label').filter({ hasText: 'Branch A' });
    await expect(branchA).toBeVisible({ timeout: 5000 });

    const branchB = page.locator('.swim-lane-label').filter({ hasText: 'Branch B' });
    await expect(branchB).toBeVisible({ timeout: 5000 });

    // Should have 2 swim lanes
    const lanes = page.locator('.swim-lane');
    expect(await lanes.count()).toBe(2);

    await page.screenshot({ path: 'playwright-report/swim-lanes.png' });
  });

  test('critical path is highlighted in swim lanes', async ({ page }) => {
    await openResultsExplorer(page);

    // One of the swim lanes should have the critical class
    const criticalLane = page.locator('.swim-lane-critical');
    await expect(criticalLane).toBeVisible({ timeout: 5000 });

    // Critical path badge should show "Critical Path"
    const criticalBadge = page.locator('.swim-lane-critical-badge');
    await expect(criticalBadge).toContainText('Critical Path');
  });

  test('branch comparison table appears when clicking fork node', async ({ page }) => {
    await openResultsExplorer(page);

    // Click fork node within the results explorer flow canvas
    const forkNode = page.locator('.results-explorer-flow .react-flow__node').filter({ hasText: 'Parallel Fork' }).first();
    await forkNode.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Branch comparison should be visible in detail panel
    const branchComparison = page.locator('[data-testid="branch-comparison"]');
    await expect(branchComparison).toBeVisible({ timeout: 5000 });

    // Table should show 2 branches
    const branchRows = page.locator('[data-testid^="branch-row-"]');
    expect(await branchRows.count()).toBe(2);

    // Critical path badge should appear
    const criticalBadge = page.locator('[data-testid="critical-path-badge"]');
    await expect(criticalBadge).toBeVisible();

    await page.screenshot({ path: 'playwright-report/branch-comparison.png' });
  });

  test('branch comparison table appears when clicking join node', async ({ page }) => {
    await openResultsExplorer(page);

    const joinNode = page.locator('.results-explorer-flow .react-flow__node').filter({ hasText: 'Join' }).first();
    await joinNode.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    const branchComparison = page.locator('[data-testid="branch-comparison"]');
    await expect(branchComparison).toBeVisible({ timeout: 5000 });
  });

  test('no branch comparison for non-fork/join nodes', async ({ page }) => {
    await openResultsExplorer(page);

    // Click the "Branch A: Users" HTTP node — should NOT show branch comparison
    const httpNode = page.locator('.results-explorer-flow .react-flow__node').filter({ hasText: 'Branch A: Users' }).first();
    await httpNode.click({ timeout: 10000 });
    await page.waitForTimeout(500);

    const branchComparison = page.locator('[data-testid="branch-comparison"]');
    await expect(branchComparison).not.toBeVisible();
  });
});
